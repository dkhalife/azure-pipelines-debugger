'use strict';

import { FileAccessor } from "./fileUtils";
import { EventEmitter } from 'events';
import { DocumentManager } from "./documentManager";
import { Scope, StackFrame, Thread, Variable } from "@vscode/debugadapter";
import { DebugProtocol } from "@vscode/debugprotocol";
import { BreakpointManager } from "./breakpointManager";
import { ExecutionContextManager } from "./executionContextManager";
import { DocumentTraverser, TraversalControl } from "./documentTraverser";
import { Expression, getExpression } from "./expression";
import { EvaluationContext } from "./expressionEngine/types";
import { evaluateTemplateString } from "./expressionEngine/evaluator";

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
	private traversalControl: TraversalControl = 'NextBreakPoint';
	private stopOnNextNode: boolean = false;
	private stepOutTargetDepth: number = -1;
	private lastLaunchFile: string = '';
	private lastStopOnEntry: boolean = false;

	constructor(fileAccessor: FileAccessor) {
		super();

		this.documentManager = new DocumentManager(fileAccessor, this.breakpointManager);
	}

	private buildEvaluationContext(paramsReferenceId: number, parentEvalCtx?: EvaluationContext): EvaluationContext {
		const parameters: Record<string, any> = {};
		try {
			const paramsExpr = getExpression(paramsReferenceId);
			for (const child of paramsExpr.children) {
				parameters[child.name] = child.value;
			}
		} catch {
			// No params yet
		}
		return {
			parameters,
			variables: parentEvalCtx?.variables ? { ...parentEvalCtx.variables } : {},
		};
	}

	private async newDocument(file: string, parametersReferenceId: number, stopOnEntry?: boolean, isExtends: boolean = false) {
		const doc = await this.documentManager.getDoc(file);
		const parentCtx = this.executionContextManager.size() > 0 ? this.executionContextManager.currentContext() : undefined;
		const evalCtx = this.buildEvaluationContext(parametersReferenceId, parentCtx?.evaluationContext);
		const ctxt = this.executionContextManager.new(parametersReferenceId, evalCtx, isExtends);

		if (stopOnEntry) {
			this.stopOnNextNode = true;
		}

		const traverser = new DocumentTraverser(doc, ctxt, {
			onTemplate: async (path: string, paramsReferenceId: number, isExtendsCall?: boolean) => {
				const label = isExtendsCall ? 'Extending' : 'Entering template';
				this.emit("output", `${label}: ${path}`, "stdout");
				await this.newDocument(path, paramsReferenceId, false, !!isExtendsCall).then(() => {
					this.executionContextManager.pop();
					this.emit("output", `Returned from: ${path}`, "stdout");
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
			onConditionalEvaluated: (expression, result, position) => {
				this.emit("output", `Condition: $\{{ ${expression} }} → ${result}`, "stdout");
			},
			onEachIteration: (variable, index, total, position) => {
				this.emit("output", `Loop iteration ${index + 1}/${total}: ${variable}`, "stdout");
			},
			onStep: async (position) => {
				// stepOut: skip all nodes until we return to the target depth
				if (this.stepOutTargetDepth >= 0 && ctxt.depth > this.stepOutTargetDepth) {
					if (this.breakpointManager.shouldBreak(doc, position.line, ctxt.evaluationContext)) {
						this.stepOutTargetDepth = -1;
						this.emit("stopOnBreakpoint", Debugger.MainThreadId);
						await ctxt.execution.wait();
					}
					return this.traversalControl;
				}
				if (this.stepOutTargetDepth >= 0 && ctxt.depth <= this.stepOutTargetDepth) {
					this.stepOutTargetDepth = -1;
					this.stopOnNextNode = true;
				}

				if (this.stopOnNextNode) {
					if (position.line === 1) {
						this.emit("stopOnEntry", Debugger.MainThreadId);
					} else {
						this.emit("stopOnStep", Debugger.MainThreadId);
					}
					this.stopOnNextNode = false;
					await ctxt.execution.wait();
				} else if (this.breakpointManager.shouldBreak(doc, position.line, ctxt.evaluationContext)) {
					this.emit("stopOnBreakpoint", Debugger.MainThreadId);
					await ctxt.execution.wait();
				}
	
				return this.traversalControl;
			}
		});

		return traverser.traverse();
	}

	public async start(file: string, stopOnEntry?: boolean): Promise<void> {
		this.lastLaunchFile = file;
		this.lastStopOnEntry = !!stopOnEntry;
		this.stepOutTargetDepth = -1;
		Expression.resetStore();
		const startupParams = new Expression("Parameters", "", [], true);
		this.newDocument(file, startupParams.variablesReference, stopOnEntry).then(() => {
			this.emit("stop");
		});
	}

	public restart() {
		this.start(this.lastLaunchFile, this.lastStopOnEntry);
	}

	public resume() {
		this.traversalControl = 'NextBreakPoint';
		this.emit("continue", Debugger.MainThreadId);
		this.executionContextManager.currentContext().execution.notify();
	}

	public async setBreakpoints(args: DebugProtocol.SetBreakpointsArguments) {
		const path = args.source.path as string;
		const clientLines: number[] = args.lines || [];
		const conditions = args.breakpoints?.map(bp => bp.condition);

		const doc = await this.documentManager.getDoc(path);
		return await this.breakpointManager.setBreakpoints(doc, clientLines, conditions);
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
		const currentDepth = this.executionContextManager.currentContext().depth;
		if (currentDepth === 0) {
			// At root level, just continue
			this.resume();
			return;
		}
		this.stepOutTargetDepth = currentDepth - 1;
		this.traversalControl = 'NextBreakPoint';
		this.emit("continue", Debugger.MainThreadId);
		this.executionContextManager.currentContext().execution.notify();
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

	public evaluateExpression(expression: string): { value: string; type: string } {
		const ctx = this.executionContextManager.currentContext();
		try {
			const result = evaluateTemplateString(expression, ctx.evaluationContext);
			const valueStr = result.value === null || result.value === undefined
				? ''
				: typeof result.value === 'object' ? JSON.stringify(result.value) : String(result.value);
			return { value: valueStr, type: result.type };
		} catch (e) {
			return { value: `<error: ${e instanceof Error ? e.message : String(e)}>`, type: 'error' };
		}
	}
}
