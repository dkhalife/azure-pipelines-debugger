import { Subject } from 'await-notify';
import { Variable } from '@vscode/debugadapter';
import { EvaluationContext } from './expressionEngine/types';

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
	templateExpressionsReferenceId: number;
	evaluationContext: EvaluationContext;
	/** Depth in the template include stack (0 = root pipeline) */
	depth: number;
	/** Whether this context represents an extends (vs a template include) */
	isExtends: boolean;
};
