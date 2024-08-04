'use strict';

import { FileAccessor } from "./fileUtils";
import { EventEmitter } from 'events';
import { DocumentManager } from "./documentManager";
import { asyncVisitor, visitAsync } from "yaml";
import { Subject } from 'await-notify';
import { Breakpoint, Scope, Source, StackFrame, Thread } from "@vscode/debugadapter";
import { DebugProtocol } from "@vscode/debugprotocol";
import { Stack } from "./stack";
import assert from "assert";

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
	symbol: number | "key" | "value" | string | null;
	// path: readonly (Node | Document<Node, true> | Pair<unknown, unknown>)[];
};

type ExecutionContext = {
	execution: Subject;
	executionPointer: ExecutionPointer | null;
};

export class Debugger extends EventEmitter {
	private documentManager: DocumentManager;
	private static readonly MainThreadId: number = 1;
	private contexts: Stack<ExecutionContext> = new Stack();

	constructor(fileAccessor: FileAccessor) {
		super();

		this.documentManager = new DocumentManager(fileAccessor);
		this.contexts.push({
			execution: new Subject(),
			executionPointer: null
		});
	}

	private currentContext(): ExecutionContext {
		const ctxt = this.contexts.top();
		if (!ctxt) {
			throw new Error("Expected to have at least one execution context.");
		}

		return ctxt;
	}

	private async newDocument(file: string) {
		const doc = await this.documentManager.getDoc(file);
		const visitor: asyncVisitor = {
			Pair: async (symbol, value, path): Promise<symbol | void> => {
				const ctxt = this.currentContext();
				ctxt.executionPointer = {
					file,
					symbol,
					// path
				};

				const k = value.key?.toString();
				if (k?.startsWith("abc")) {
					this.emit("stopOnStep", Debugger.MainThreadId);
					await ctxt.execution.wait();
				}
			}
		};

		return visitAsync(doc, visitor);
	}

	public async start(file: string): Promise<void> {
		this.newDocument(file).then(() => {
			this.emit("stop");
		});
	}

	public resume() {
		this.currentContext().execution.notify();
		this.emit("continue", Debugger.MainThreadId);
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
	}

	public stepInto() {
	}

	public stepOut() {
	}

	public getThreads(): Thread[] {
		return [
			{
				id: 1,
				name: "main"
			}
		];
	}

	private line = 0;
	public getStackTrace(startFrame: number | undefined, levels: number | undefined): StackFrame[] {
		if (startFrame === 0) {
			return [{
                id: 1,
                name: "frame name",
                source: new Source("frame", this.currentContext().executionPointer?.file),
                line: ++this.line,
                column: 1,
            }];
		}

		return [];
	}

	public getScopes(): Scope[] {
		return [];
	}

	public getExceptionInfo(): ExceptionInfo {
		return {
			breakMode: "always",
			exceptionId: "1",
			description: "",
		};
	}
}
