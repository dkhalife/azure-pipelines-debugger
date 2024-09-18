import { asyncVisitor, isMap, isScalar, isSeq, LineCounter, Node, Pair, visit, visitAsync, YAMLMap, YAMLSeq } from "yaml";
import { DecoratedDocument } from "./fileLoader";
import { dirname, isAbsolute, join } from "path";
import { FileSystemError } from "vscode";
import { ExecutionContext, Expression, SourceLocation } from "./executionContext";
import { parseVariables, parseParameters } from "./azurePipelines";

export interface TraversalCallbacks {
    onTemplate(path: string, parameters: Expression[]): Promise<void>
    onFileSystemError(message: string): Promise<void>
    onYamlParsingError(title: string, message: string, position: SourceLocation): Promise<void>
    onStep(position: SourceLocation): Promise<TarversalControl>
}

export type TarversalControl = 'NextBreakPoint' | 'StepOver' | 'StepInto';

export class DocumentTraverser {
	private shouldAbort: boolean = false;
    private lineCounter: LineCounter;

    constructor(private doc: DecoratedDocument, private context: ExecutionContext, private callbacks: TraversalCallbacks) {
        this.lineCounter = doc.lineCounter;
    }

	private visitor: asyncVisitor = {
        Pair: async (symbol, value: Pair, path): Promise<void | symbol> => {
            // When referenced documents generate errors, the following condition
            // allows aborting the entire debugging session
            if (this.shouldAbort) {
                return visit.BREAK;
            }

            const ctxt = this.context;
            const position = this.lineCounter.linePos((value.key as any).range[0]);
            ctxt.executionPointer = {
                file: this.doc.source,
                symbol: (value as any).key.value,
                position
            };

            if (isScalar(value.key) && value.key.value === "variables" && isSeq(value.value)) {
                ctxt.variables = parseVariables(value.value);
            }

            // Encountered a pair that needs to be expanded
            if (isScalar(value.key) && value.key.value === "template" && isScalar(value.value)) {
                let targetDocPath = value.value.toString();
                if (!isAbsolute(targetDocPath)) {
                    targetDocPath = join(dirname(this.doc.source), targetDocPath);
                }

                // Attempt to find any parameters for that template
                const parentNode = path[path.length-1] as Node;
                let params: Expression[] = [];
                if (isMap(parentNode)) {
                    for (const kvp of parentNode.items) {
                        if (isScalar(kvp.key) && kvp.key.value === "parameters" && isMap(kvp.value)) {
                            params = parseParameters(kvp.value);
                        }
                    }
                }

                try {
                    await this.callbacks.onTemplate(targetDocPath, params);
                } catch (error) {
                    this.shouldAbort = true;
                    if (error instanceof FileSystemError) {
                        await this.callbacks.onFileSystemError(error.message);
                        return visit.BREAK;
                    }
                    else {
                        throw error;
                    }
                }
            }

            const traversalControl = await this.callbacks.onStep(position);
            if (traversalControl === 'StepInto') {
                return undefined; // explicit instead of early return to make it clear
            } else if (traversalControl === 'StepOver') {
                // TODO: How to deal with breakpoint in child node
                return visit.SKIP; // Skips children
            }
        }
    };

    public async traverse(): Promise<void> {
        const errors = this.doc.yaml.errors;
		if (errors.length > 0) {
			this.shouldAbort = true;

			for (const error of errors) {
                const pos = this.lineCounter.linePos(error.pos[0]);
                const position = { line: pos.line, col: pos.col };
                await this.callbacks.onYamlParsingError(error.name, error.message, position);
			}

			return;
		}

        return visitAsync(this.doc.yaml, this.visitor);
    }
}