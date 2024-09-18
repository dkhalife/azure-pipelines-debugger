import { Subject } from 'await-notify';
import { Stack } from './stack';
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

export class Expression extends Variable {
	private static next_id: number = 4;
	constructor(public readonly name: string, public value: string, private children: Expression[] = []) {
		super(name, value, children.length > 0 ? Expression.next_id++ : undefined);
	}
};

export type ExecutionContext = {
	execution: Subject;
	executionPointer: ExecutionPointer | null;
	parameters: Expression[];
	variables: Expression[];
	scopes: Stack<Map<number, Expression[]>>
};
