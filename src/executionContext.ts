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

export type ExecutionContext = {
	execution: Subject;
	executionPointer: ExecutionPointer | null;
	paramsReferenceId: number;
	variablesReferenceId: number;
	scopesReferenceId: number
};
