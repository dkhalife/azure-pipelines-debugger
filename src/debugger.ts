'use strict';

import { FileAccessor } from "./fileUtils";
import { EventEmitter } from 'events';
import { DocumentManager } from "./documentManager";
import { asyncVisitor, isCollection, isMap, isPair, isScalar, Scalar, visitAsync, YAMLMap } from "yaml";
import { Subject } from 'await-notify';
import { Breakpoint, Scope, StackFrame, Thread, Variable } from "@vscode/debugadapter";
import { DebugProtocol } from "@vscode/debugprotocol";
import { Stack } from "./stack";

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
	parameters: Object;
};

export class Debugger extends EventEmitter {
	private documentManager: DocumentManager;
	private static readonly MainThreadId: number = 1;
	private contexts: Stack<ExecutionContext> = new Stack();

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

	private async newDocument(file: string, parameters: Object) {
		const doc = await this.documentManager.getDoc(file);
		const visitor: asyncVisitor = {
			Pair: async (symbol, value, path): Promise<void> => {
				const ctxt = this.currentContext();
				ctxt.executionPointer = {
					file,
					symbol,
					// path
				};

				const k = value.key?.toString();
				if (k?.startsWith("wait")) {
					this.emit("stopOnStep", Debugger.MainThreadId);
					await this.currentContext().execution.wait();
				}
			},

			Node: async (key, node, path): Promise<void> => {
				if (isCollection(node)) {
					const firstItem = node.items[0];
					if (isPair(firstItem)) {
						// eslint-disable-next-line eqeqeq
						if (firstItem.key == "template") {
							const params = {};
							for (let i=1; i<node.items.length; ++i) {
								const item = node.items[i];
								// eslint-disable-next-line eqeqeq
								if (isPair(item) && item.key == "parameters") {
									if (isMap(item.value)) {
										for (const p of item.value.items) {
											params[(p.key as Scalar).toString()] = p.value;
										}
									}

									break;
								}
							}

							if (!isScalar(firstItem.value)) {
								return;
							}

							const parentWait = this.currentContext().execution.wait();
							this.newDocument(firstItem.value.value as string, params).then(() => {
								this.contexts.pop();
								this.currentContext().execution.notify();
							});

							await parentWait;
						}
					}
				}
			},
		};

		this.contexts.push({
			execution: new Subject(),
			executionPointer: null,
			parameters,
		});

		return visitAsync(doc, visitor);
	}

	public async start(file: string): Promise<void> {
		this.newDocument(file, new YAMLMap()).then(() => {
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

	private line = 0;
	public getStackTrace(startFrame: number | undefined, levels: number | undefined): StackFrame[] {
		if (startFrame === 0) {
			const ret: StackFrame[] = [];
			const callStack: Stack<ExecutionContext> = Object.assign(Object.create(Object.getPrototypeOf(this.contexts)), this.contexts);
			let i = 0;
			/*while (!callStack.isEmpty()) {
				const exectutionPointer = callStack.pop()?.executionPointer;
				ret.push(new StackFrame(i, "frame name", new Source("frame", exectutionPointer?.file), 1));
			}*/
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
