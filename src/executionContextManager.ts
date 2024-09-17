import { Scope, Source, StackFrame, Variable } from "@vscode/debugadapter";
import { ExecutionContext } from "./executionContext";
import { Stack } from "./stack";
import { Subject } from 'await-notify';
import { basename } from "path";

export class ExecutionContextManager {
    private contexts: Stack<ExecutionContext> = new Stack();

	public currentContext(): ExecutionContext {
		const ctxt = this.contexts.top();
		if (!ctxt) {
			throw new Error("Expected to have at least one execution context.");
		}

		return ctxt;
	}

    public new(parameters: Object) {
        this.contexts.push({
			execution: new Subject(),
			executionPointer: null,
			parameters,
			variables: {}
		});
    }

    public pop() {
        this.contexts.pop();
    }

    public getScopes(): Scope[] {
		return [{
			expensive: false,
			name: "Parameters",
			variablesReference: 1
		},{
			expensive: false,
			name: "Variables",
			variablesReference: 2
		}];
    }

    public getVariables(variablesReference: number, start: number, count: number): Variable[] {
        if (this.contexts.isEmpty()) {
			return [];
		}

		const executionContext = this.contexts.top();
		if (!executionContext) {
			return [];
		}

		// TODO: Design a scalable way to reference objects with variablesReference?
		const ret: Variable[] = [];
		let scope: Object = {};
		if (variablesReference === 1) {
			scope = executionContext.parameters;
		} else if (variablesReference === 2) {
			scope = executionContext.variables;
		}

		for (const key in scope) {
			// TODO: Set indexed/name child variable values
			// TODO: Set line numbers
			const value = scope[key];
			ret.push(new Variable(key, value.default !== undefined ? value.default.toString() : value.toString()));
		}

		return ret;
    }

    public setVariable(variablesReference: number, name: string, newValue: string) {
        return newValue + "_changed";
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