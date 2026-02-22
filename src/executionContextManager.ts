import { Scope, Source, StackFrame, Variable } from "@vscode/debugadapter";
import { ExecutionContext } from "./executionContext";
import { Stack } from "./stack";
import { Subject } from 'await-notify';
import { basename } from "path";
import { EvaluationContext } from "./expressionEngine/types";
import { Expression, getExpression } from "./expression";

export class ExecutionContextManager {
    private contexts: Stack<ExecutionContext> = new Stack();

	public currentContext(): ExecutionContext {
		return this.contexts.top();
	}

    public new(paramsReferenceId: number, evalCtx?: EvaluationContext, isExtends: boolean = false): ExecutionContext {
        const depth = this.contexts.size();
        this.contexts.push({
			execution: new Subject(),
			executionPointer: null,
			paramsReferenceId,
			variablesReferenceId: -1,
			templateExpressionsReferenceId: -1,
			evaluationContext: evalCtx || { parameters: {}, variables: {} },
			depth,
			isExtends,
		});

		return this.currentContext();
    }

    public size(): number {
        return this.contexts.size();
    }

    public pop() {
        this.contexts.pop();
    }

    public getScopes(): Scope[] {
		const ctxt = this.currentContext();

		const ret = [{
			expensive: false,
			name: "Parameters",
			variablesReference: ctxt.paramsReferenceId,
		}];
		
		if (ctxt.variablesReferenceId !== -1) {
			ret.push({
				expensive: false,
				name: "Variables",
				variablesReference: ctxt.variablesReferenceId
			});
		}

		if (ctxt.templateExpressionsReferenceId !== -1) {
			ret.push({
				expensive: false,
				name: "Template Expressions",
				variablesReference: ctxt.templateExpressionsReferenceId
			});
		}

		return ret;
	}

    public getStackTrace(startFrame: number | undefined, levels: number | undefined): StackFrame[] {
		if (startFrame === 0) {
			const ret: StackFrame[] = [];
			const contexts = this.contexts;
			for (let i=contexts.size()-1; i>=0; --i) {
				const ctx = contexts.item(i);
				const exectutionPointer = ctx?.executionPointer;
				const pos = exectutionPointer?.position;
				const prefix = ctx && ctx.depth > 0 ? (ctx.isExtends ? '[extends] ' : '[template] ') : '';
				const label = prefix + (exectutionPointer?.symbol || "unknown");
				ret.push(new StackFrame(i, label, new Source(basename(exectutionPointer?.file || "unknown"), exectutionPointer?.file), pos?.line, pos?.col));
			}
			return ret;
		}

		return [];
    }
}