import { Subject } from 'await-notify';

export type SourceLocation = {
	line: number;
	col: number;
};

export type ExecutionPointer = {
	file: string;
	symbol: string;
	position: SourceLocation
};

export type ExecutionContext = {
	execution: Subject;
	executionPointer: ExecutionPointer | null;
	parameters: Object;
	variables: Object;
};
