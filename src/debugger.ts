'use strict';

import { FileAccessor } from "./fileUtils";
import { EventEmitter } from 'events';
import { DocumentManager } from "./documentManager";
import { asyncVisitor, isMap, isPair, isScalar, Pair, Scalar, visit, visitAsync, YAMLMap } from "yaml";
import { Subject } from 'await-notify';
import { Breakpoint, Scope, Source, StackFrame, Thread, Variable } from "@vscode/debugadapter";
import { DebugProtocol } from "@vscode/debugprotocol";
import { Stack } from "./stack";
import { basename } from "path";

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

export type ExecutionPointer = {
	file: string;
	symbol: string;
	position: { line: number, col: number }
};

type ExecutionContext = {
	execution: Subject;
	executionPointer: ExecutionPointer | null;
	parameters: Object;
};

type VisitorControl = 'NextBreakPoint' | 'StepOver' | 'StepInto';

export class Debugger extends EventEmitter {
	private documentManager: DocumentManager;
	private static readonly MainThreadId: number = 1;
	private contexts: Stack<ExecutionContext> = new Stack();
	private traversalControl: VisitorControl = 'NextBreakPoint';
	private stopOnNextNode: boolean = false;

	constructor(fileAccessor: FileAccessor) {
		super();

		this.documentManager = new DocumentManager(fileAccessor);
	}

	private currentContext(): ExecutionContext {
		const ctxt = this.contexts.top();
		if (!ctxt) {
			throw new Error("Expected to have at least one execution context.");
		}

		return ctxt;
	}

	private async newDocument(file: string, parameters: Object, stopOnEntry?: boolean) {
		const doc = await this.documentManager.getDoc(file);
		const lineCounter = doc.lineCounter;
		const visitor: asyncVisitor = {
			Pair: async (symbol, value, path): Promise<void | symbol> => {
				const ctxt = this.currentContext();
				const position = lineCounter.linePos((value.key as any).range[0]);
				ctxt.executionPointer = {
					file,
					symbol: (value as any).key.value,
					position
				};

				const node = value.value;
				if (isMap(node)) { // Adjust so we can catch the case of a template inserted into a list
					const firstProp = node.items[0] as Pair<Scalar, Scalar>;
					const secondProp = node.items[1] as Pair<Scalar, Map<Scalar, unknown>>;
					if (isPair(firstProp) && isPair(secondProp)) {
						if (isScalar(firstProp.key) && firstProp.key.value === "template") {
							if (isScalar(secondProp.key) && secondProp.key.value === "parameters") {
								const params = isMap(secondProp.value) ? secondProp.value.toJSON() : {};

								/*const parentWait = this.currentContext().execution.wait();
								this.newDocument(firstProp.value?.value as string, params).then(() => {
									this.contexts.pop();
									this.currentContext().execution.notify();
								});

								await parentWait;*/

								return visit.SKIP;
							}
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
					await this.currentContext().execution.wait();
				}

				if (this.traversalControl === 'StepInto') {
					return undefined; // explicit instead of early return to make it clear
				} else if (this.traversalControl === 'StepOver') {
					// TODO: How to deal with breakpoint in child node
					return visit.SKIP; // Skips children
				}
			},

			Node: async (key, node, path): Promise<void> => {

			},
		};

		this.contexts.push({
			execution: new Subject(),
			executionPointer: null,
			parameters,
		});

		const errors = doc.document.errors;

		if (errors.length > 0) {
			for (const error of errors) {
				const ctxt = this.currentContext();
				const pos = lineCounter.linePos(error.pos[0]);
				ctxt.executionPointer = {
					file,
					symbol: error.name,
					position: { line: pos.line, col: pos.col }
				};

				this.emit("stopOnError", Debugger.MainThreadId, error.message);
				await this.currentContext().execution.wait();
			}

			return;
		}

		if (stopOnEntry) {
			this.stopOnNextNode = true;
		}

		return visitAsync(doc.document, visitor);
	}

	public async start(file: string, stopOnEntry?: boolean): Promise<void> {
		this.newDocument(file, new YAMLMap(), stopOnEntry).then(() => {
			this.emit("stop");
		});
	}

	public resume() {
		this.traversalControl = 'NextBreakPoint';
		this.emit("continue", Debugger.MainThreadId);
		this.currentContext().execution.notify();
	}

	public setBreakpoints(args: DebugProtocol.SetBreakpointsArguments) {
		const path = args.source.path as string;
		const clientLines = args.lines || [];

		// set and verify breakpoint locations
		return clientLines.map(l => {
			// verified = whether symbol for it was loaded or not
			const bp = new Breakpoint(true, l) as DebugProtocol.Breakpoint;
			bp.id = 10 * l;
			return bp;
		});
	}

	public stepOver() {
		this.traversalControl = 'StepOver';
		this.stopOnNextNode = true;
		this.emit("continue", Debugger.MainThreadId);
		this.currentContext().execution.notify();
	}

	public stepInto() {
		this.traversalControl = 'StepInto';
		this.stopOnNextNode = true;
		this.emit("continue", Debugger.MainThreadId);
		this.currentContext().execution.notify();
	}

	public stepOut() {
	}

	public getVariables(variablesReference: number, start: number, count: number): Variable[] {
		if (this.contexts.isEmpty()) {
			return [];
		}

		const executionContext = this.contexts.top();
		if (!executionContext) {
			return [];
		}

		if (variablesReference !== 1) {
			return [];
		}

		const ret: Variable[] = [];
		for (const key of Object.keys(executionContext.parameters)) {
			// TODO: Design a scalable way to reference objects with variablesReference?
			ret.push(new Variable(key, executionContext.parameters[key].value.toString()));
			/* add source, line, col, endline, end col */
		}
		return ret;
	}

	public getThreads(): Thread[] {
		return [
			{
				id: 1,
				name: "main"
			}
		];
	}

	public getStackTrace(startFrame: number | undefined, levels: number | undefined): StackFrame[] {
		if (startFrame === 0) {
			const ret: StackFrame[] = [];
			const contexts = this.contexts;
			// TODO: Unroll a range for each execution context instead of just the top value
			for (let i=contexts.size()-1; i>=0; --i) {
				const exectutionPointer = contexts.item(i)?.executionPointer;
				const pos = exectutionPointer?.position;
				ret.push(new StackFrame(i, exectutionPointer?.symbol || "unknown", new Source(basename(exectutionPointer?.file || "unknown"), exectutionPointer?.file), pos?.line, pos?.col));
			}
			return ret;
		}

		return [];
	}

	public getScopes(): Scope[] {
		return [{
			expensive: false,
			name: "Parameters",
			variablesReference: 1
		}];
	}

	public getExceptionInfo(): ExceptionInfo {
		return {
			breakMode: "always",
			exceptionId: "1",
			description: "",
		};
	}
}
