import { Scope, Source, StackFrame, Variable } from "@vscode/debugadapter";
import { ExecutionContext } from "./executionContext";
import { Stack } from "./stack";
import { Subject } from 'await-notify';
import { basename } from "path";

export class ExecutionContextManager {
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
			scopesReferenceId: -1
		});

		return this.currentContext();
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

		if (ctxt.scopesReferenceId !== -1) {
			ret.push({
				expensive: false,
				name: "Scopes",
				variablesReference: ctxt.scopesReferenceId
			});
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