import { Subject } from 'await-notify';

export type ExecutionPointer = {
	file: string;
	symbol: string;
	position: { line: number, col: number }
};

export type ExecutionContext = {
	execution: Subject;
	executionPointer: ExecutionPointer | null;
	parameters: Object;
	variables: Object;
};
