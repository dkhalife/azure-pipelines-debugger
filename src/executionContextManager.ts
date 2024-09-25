import { Scope, Source, StackFrame, Variable } from "@vscode/debugadapter";
import { ExecutionContext, Expression, getExpression } from "./executionContext";
import { Stack } from "./stack";
import { Subject } from 'await-notify';
import { basename } from "path";

export class ExecutionContextManager {
	private static readonly ScopesReferenceId: number = 3;

    private contexts: Stack<ExecutionContext> = new Stack();

	public currentContext(): ExecutionContext {
		return this.contexts.top();
	}

    public new(paramsReferenceId: number): ExecutionContext {
        this.contexts.push({
			execution: new Subject(),
			executionPointer: null,
			paramsReferenceId,
			variablesReferenceId: -1,
			scopes: new Stack<Map<number, Expression[]>>()
		});

		return this.currentContext();
    }

    public pop() {
        this.contexts.pop();
    }

    public getScopes(): Scope[] {
		const ctxt = this.currentContext();

		return [{
			expensive: false,
			name: "Parameters",
			variablesReference: ctxt.paramsReferenceId,
		},{
			expensive: false,
			name: "Variables",
			variablesReference: ctxt.variablesReferenceId
		},{
			expensive: false,
			name: "Scopes",
			variablesReference: ExecutionContextManager.ScopesReferenceId
		}];
    }

    public getExpressions(id: number, start: number, count: number): Variable[] {
        if (this.contexts.isEmpty()) {
			return [];
		}

		const executionContext = this.contexts.top();

		let items: Expression[] = [];
		if (!executionContext.scopes.isEmpty()) {
			const innermostScope = executionContext.scopes.top();
			if (innermostScope.has(id)) {
				items = innermostScope.get(id)!;
			}
		} else {
			items = getExpression(id).children;
		}

		return items;
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
}