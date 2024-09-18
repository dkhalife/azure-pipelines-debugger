import { Subject } from 'await-notify';
import { Stack } from './stack';

export type SourceLocation = {
	line: number;
	col: number;
};

export type ExecutionPointer = {
	file: string;
	symbol: string;
	position: SourceLocation
};

export class Expression {
	public id: number;

	private static next_id: number = 3;
	constructor(public readonly text: string, public value: string) {
		this.id = Expression.next_id++;
	}
};

export type ExecutionContext = {
	execution: Subject;
	executionPointer: ExecutionPointer | null;
	parameters: Expression[];
	variables: Expression[];
	scopes: Stack<Map<number, Expression[]>>
};
