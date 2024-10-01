'use strict';

import { FileAccessor } from "./fileUtils";
import { EventEmitter } from 'events';
import { DocumentManager } from "./documentManager";
import { Scope, StackFrame, Thread, Variable } from "@vscode/debugadapter";
import { DebugProtocol } from "@vscode/debugprotocol";
import { BreakpointManager } from "./breakpointManager";
import { ExecutionContextManager } from "./executionContextManager";
import { DocumentTraverser, TarversalControl } from "./documentTraverser";
import { Expression, getExpression } from "./expression";

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

export class Debugger extends EventEmitter {
	private documentManager: DocumentManager;
	private breakpointManager: BreakpointManager = new BreakpointManager();
	private executionContextManager: ExecutionContextManager = new ExecutionContextManager();
	private static readonly MainThreadId: number = 1;
	private traversalControl: TarversalControl = 'NextBreakPoint';
	private stopOnNextNode: boolean = false;

	constructor(fileAccessor: FileAccessor) {
		super();

		this.documentManager = new DocumentManager(fileAccessor, this.breakpointManager);
	}

	private async newDocument(file: string, parametersReferenceId: number, stopOnEntry?: boolean) {
		const doc = await this.documentManager.getDoc(file);
		const ctxt = this.executionContextManager.new(parametersReferenceId);

		if (stopOnEntry) {
			this.stopOnNextNode = true;
		}

		const traverser = new DocumentTraverser(doc, ctxt, {
			onTemplate: async (path: string, paramsReferenceId: number) => {
				await this.newDocument(path, paramsReferenceId).then(() => {
					this.executionContextManager.pop();
					ctxt.execution.notify();
				});
			},
			onFileSystemError: async (message) => {
				this.emit("stopOnError", Debugger.MainThreadId, message);
				await ctxt.execution.wait();
			},
			onYamlParsingError: async (title, message, position) => {
				ctxt.executionPointer = {
					file: doc.source,
					position, 
					symbol: title,
				};

				this.emit("stopOnError", Debugger.MainThreadId, message);
				await ctxt.execution.wait();
			},
			onStep: async (position) => {
				if (this.stopOnNextNode) {
					if (position.line === 1) {
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
	
				return this.traversalControl;
			}
		});

		return traverser.traverse();
	}

	public async start(file: string, stopOnEntry?: boolean): Promise<void> {
		Expression.resetStore();
		const startupParams = new Expression("Parameters", "", [], true);
		this.newDocument(file, startupParams.variablesReference, stopOnEntry).then(() => {
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
		// TODO: implement
	}

	public getVariables(variablesReference: number, start: number, count: number): Variable[] {
		return getExpression(variablesReference).children;
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
