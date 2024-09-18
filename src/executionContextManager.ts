import { Scope, Source, StackFrame, Variable } from "@vscode/debugadapter";
import { ExecutionContext, Expression } from "./executionContext";
import { Stack } from "./stack";
import { Subject } from 'await-notify';
import { basename } from "path";

export class ExecutionContextManager {
	private static readonly ParametersReferenceId: number = 1;
	private static readonly VariablesReferenceId: number = 2;
    private contexts: Stack<ExecutionContext> = new Stack();

	public currentContext(): ExecutionContext {
		return this.contexts.top();
	}

    public new(parameters: Expression[]): ExecutionContext {
        this.contexts.push({
			execution: new Subject(),
			executionPointer: null,
			parameters,
			variables: [],
			scopes: new Stack<Map<number, Expression[]>>()
		});

		return this.currentContext();
    }

    public pop() {
        this.contexts.pop();
    }

    public getScopes(): Scope[] {
		return [{
			expensive: false,
			name: "Parameters",
			variablesReference: ExecutionContextManager.ParametersReferenceId
		},{
			expensive: false,
			name: "Variables",
			variablesReference: ExecutionContextManager.VariablesReferenceId
		}];
    }

    public getVariables(variablesReference: number, start: number, count: number): Variable[] {
        if (this.contexts.isEmpty()) {
			return [];
		}

		const executionContext = this.contexts.top();

		let items: Expression[] = [];
		if (variablesReference === ExecutionContextManager.ParametersReferenceId) {
			items = executionContext.parameters;
		} else if (variablesReference === ExecutionContextManager.VariablesReferenceId) {
			items = executionContext.variables;
		} else {
			const innermostScope = executionContext.scopes.top();
			if (innermostScope.has(variablesReference)) {
				items = innermostScope.get(variablesReference)!;
			}
		}

		const ret: Variable[] = [];
		for (const item of items) {
			// TODO: Set indexed/name child variable values
			// TODO: Set line numbers
			ret.push(new Variable(item.text, item.value, item.id));
		}

		return ret;
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