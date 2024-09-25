import { Subject } from 'await-notify';
import { Variable } from '@vscode/debugadapter';

export type SourceLocation = {
	line: number;
	col: number;
};

export type ExecutionPointer = {
	file: string;
	symbol: string;
	position: SourceLocation
};

const expressionStore: Expression[] = [];
export class Expression extends Variable {
	private static next_id: number = 0;
	constructor(public readonly name: string, public value: string, public children: Expression[] = []) {
		super(name, value, children.length > 0 ? Expression.next_id++ : undefined);

		if (children.length > 0) {
			expressionStore.push(this);
		}
	}
};

export const getExpression = (id: number): Expression => {
	if (id < 0 || id >= expressionStore.length) {
		throw new Error("Invalid argument: id=" + id);
	}

	return expressionStore[id] as Expression;
}

export type ExecutionContext = {
	execution: Subject;
	executionPointer: ExecutionPointer | null;
	paramsReferenceId: number;
	variablesReferenceId: number;
	scopesReferenceId: number
};
