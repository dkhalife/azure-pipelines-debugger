'use strict';

import { FileAccessor } from "./fileUtils";
import { EventEmitter } from 'events';
import { DocumentManager } from "./documentManager";
import { asyncVisitor, isMap, isScalar, Node, Pair, visit, visitAsync } from "yaml";
import { Subject } from 'await-notify';
import { Scope, Source, StackFrame, Thread, Variable } from "@vscode/debugadapter";
import { DebugProtocol } from "@vscode/debugprotocol";
import { basename, dirname, isAbsolute, join } from "path";
import { FileSystemError } from "vscode";
import { BreakpointManager } from "./breakpointManager";
import { ExecutionContextManager } from "./executionContextManager";

export type ExceptionBreakMode = 'never' | 'always' | 'unhandled' | 'userUnhandled';

export 	interface ExceptionDetails {
	/** Message contained in the exception. */
	message?: string;
	/** Short type name of the exception object. */
	typeName?: string;
	/** Fully-qualified type name of the exception object. */
	fullTypeName?: string;
	/** An expression that can be evaluated in the current scope to obtain the exception object. */
	evaluateName?: string;
	/** Stack trace at the time the exception was thrown. */
	stackTrace?: string;
	/** Details of the exception contained by this exception, if any. */
	innerException?: ExceptionDetails[];
};

export type ExceptionInfo = {
	/** ID of the exception that was thrown. */
	exceptionId: string;
	/** Descriptive text for the exception. */
	description?: string;
	/** Mode that caused the exception notification to be raised. */
	breakMode: ExceptionBreakMode;
	/** Detailed information about the exception. */
	details?: ExceptionDetails;
};

type VisitorControl = 'NextBreakPoint' | 'StepOver' | 'StepInto';

export class Debugger extends EventEmitter {
	private documentManager: DocumentManager;
	private breakpointManager: BreakpointManager = new BreakpointManager();
	private executionContextManager: ExecutionContextManager = new ExecutionContextManager();
	private static readonly MainThreadId: number = 1;
	private traversalControl: VisitorControl = 'NextBreakPoint';
	private stopOnNextNode: boolean = false;
	private shouldAbort: boolean = false;

	constructor(fileAccessor: FileAccessor) {
		super();

		this.documentManager = new DocumentManager(fileAccessor, this.breakpointManager);
	}

	private async newDocument(file: string, parameters: Object, stopOnEntry?: boolean) {
		const doc = await this.documentManager.getDoc(file);
		const lineCounter = doc.lineCounter;
		const visitor: asyncVisitor = {
			Pair: async (symbol, value: Pair, path): Promise<void | symbol> => {
				// When referenced documents generate errors, the following condition
				// allows aborting the entire debugging session
				if (this.shouldAbort) {
					return visit.BREAK;
				}

				const ctxt = this.executionContextManager.currentContext();
				const position = lineCounter.linePos((value.key as any).range[0]);
				ctxt.executionPointer = {
					file,
					symbol: (value as any).key.value,
					position
				};

				if (isScalar(value.key) && value.key.value === "variables" && isMap(value.value)) {
					ctxt.variables = value.value.toJSON();
				}

				// Encountered a pair that needs to be expanded
				if (isScalar(value.key) && value.key.value === "template" && isScalar(value.value)) {
					let targetDocPath = value.value.toString();
					if (!isAbsolute(targetDocPath)) {
						targetDocPath = join(dirname(doc.source), targetDocPath);
					}

					// Attempt to find any parameters for that template
					const parentNode = path[path.length-1] as Node;
					let params = {};
					if (isMap(parentNode)) {
						for (const kvp of parentNode.items) {
							if (isScalar(kvp.key) && kvp.key.value === "parameters" && isMap(kvp.value)) {
								params = kvp.value.toJSON();
							}
						}
					}

					try {
						await this.newDocument(targetDocPath, params).then(() => {
							this.executionContextManager.pop();
							ctxt.execution.notify();
						});
					} catch (error) {
						this.shouldAbort = true;
						if (error instanceof FileSystemError) {
							this.emit("stopOnError", Debugger.MainThreadId, error.message);
							await ctxt.execution.wait();
							return visit.BREAK;
						}
						else {
							throw error;
						}
					}
				}

				if (this.stopOnNextNode) {
					if (position.line === 1 && stopOnEntry) {
						this.emit("stopOnEntry", Debugger.MainThreadId);
					} else {
						this.emit("stopOnStep", Debugger.MainThreadId);
					}
					this.stopOnNextNode = false;
					await ctxt.execution.wait();
				} else if (this.breakpointManager.shouldBreak(doc, position.line)) {
					this.emit("stopOnBreakpoint", Debugger.MainThreadId);
					await ctxt.execution.wait();
				}

				if (this.traversalControl === 'StepInto') {
					return undefined; // explicit instead of early return to make it clear
				} else if (this.traversalControl === 'StepOver') {
					// TODO: How to deal with breakpoint in child node
					return visit.SKIP; // Skips children
				}
			},
		};

		this.executionContextManager.new(parameters);

		const errors = doc.document.errors;
		if (errors.length > 0) {
			this.shouldAbort = true;

			for (const error of errors) {
				const ctxt = this.executionContextManager.currentContext();
				const pos = lineCounter.linePos(error.pos[0]);
				ctxt.executionPointer = {
					file,
					symbol: error.name,
					position: { line: pos.line, col: pos.col }
				};

				this.emit("stopOnError", Debugger.MainThreadId, error.message);
				await ctxt.execution.wait();
			}

			return;
		}

		if (stopOnEntry) {
			this.stopOnNextNode = true;
		}

		return visitAsync(doc.document, visitor);
	}

	public async start(file: string, stopOnEntry?: boolean): Promise<void> {
		this.newDocument(file, {}, stopOnEntry).then(() => {
			this.emit("stop");
		});
	}

	public resume() {
		this.traversalControl = 'NextBreakPoint';
		this.emit("continue", Debugger.MainThreadId);
		this.executionContextManager.currentContext().execution.notify();
	}

	public async setBreakpoints(args: DebugProtocol.SetBreakpointsArguments) {
		const path = args.source.path as string;
		const clientLines: number[] = args.lines || [];

		const doc = await this.documentManager.getDoc(path);
		return await this.breakpointManager.setBreakpoints(doc, clientLines);
	}

	public setVariable(variablesReference: number, name: string, newValue: string) {
		return this.executionContextManager.setVariable(variablesReference, name, newValue);
	}

	public stepOver() {
		this.traversalControl = 'StepOver';
		this.stopOnNextNode = true;
		this.emit("continue", Debugger.MainThreadId);
		this.executionContextManager.currentContext().execution.notify();
	}

	public stepInto() {
		this.traversalControl = 'StepInto';
		this.stopOnNextNode = true;
		this.emit("continue", Debugger.MainThreadId);
		this.executionContextManager.currentContext().execution.notify();
	}

	public stepOut() {
	}

	public getVariables(variablesReference: number, start: number, count: number): Variable[] {
		return this.executionContextManager.getVariables(variablesReference, start, count);
	}

	public getThreads(): Thread[] {
		return [
			{
				id: Debugger.MainThreadId,
				name: "main"
			}
		];
	}

	public getStackTrace(startFrame: number | undefined, levels: number | undefined): StackFrame[] {
		return this.executionContextManager.getStackTrace(startFrame, levels);
	}

	public getScopes(): Scope[] {
		return this.executionContextManager.getScopes();
	}

	public getExceptionInfo(): ExceptionInfo {
		return {
			breakMode: "always",
			exceptionId: "1",
			description: "",
		};
	}
}
