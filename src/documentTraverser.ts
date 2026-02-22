import { asyncVisitor, isMap, isScalar, isSeq, LineCounter, Node, Pair, Scalar, visit, visitAsync, YAMLMap, YAMLSeq } from "yaml";
import { DecoratedDocument } from "./fileLoader";
import { dirname, isAbsolute, join } from "path";
import { FileSystemError } from "vscode";
import { ExecutionContext, SourceLocation } from "./executionContext";
import { parseVariables, parseParameterArguments, parseParameterSpecAndMerge, parseTemplateExpression } from "./azurePipelines";
import { Expression, getExpression } from "./expression";
import { addTemplateExpressions, isTemplateExpression } from "./templateExpression";
import { evaluate, ExpressionError } from "./expressionEngine/index";

export interface TraversalCallbacks {
    onTemplate(path: string, parametersReferenceId: number, isExtends?: boolean): Promise<void>
    onFileSystemError(message: string): Promise<void>
    onYamlParsingError(title: string, message: string, position: SourceLocation): Promise<void>
    onStep(position: SourceLocation): Promise<TraversalControl>
    onConditionalEvaluated?(expression: string, result: boolean, position: SourceLocation): void
    onEachIteration?(variable: string, index: number, total: number, position: SourceLocation): void
}

export type TraversalControl = 'NextBreakPoint' | 'StepOver' | 'StepInto';

// Matches ${{ if condition }}, ${{ elseif condition }}, ${{ else }}, ${{ each var in collection }}
const CONDITIONAL_RE = /^\$\{\{\s*(if|elseif|else)\s*(.*?)\s*\}\}$/;
const EACH_RE = /^\$\{\{\s*each\s+(\w+)\s+in\s+(.+?)\s*\}\}$/;

function isLiteralArray(arr: any[]): boolean {
    return arr.every(item => typeof item === 'string' || typeof item === 'number' || typeof item === 'boolean');
}

function formatCollection(collection: any[]): string {
    if (collection.length === 0) {
        return '[]';
    }
    if (isLiteralArray(collection)) {
        return '[' + collection.join(', ') + ']';
    }
    return `${collection.length} items`;
}

export class DocumentTraverser {
	private shouldAbort: boolean = false;
    private lineCounter: LineCounter;

    constructor(private doc: DecoratedDocument, private context: ExecutionContext, private callbacks: TraversalCallbacks) {
        this.lineCounter = doc.lineCounter;
    }

    private parseConditionalKey(keyStr: string): { type: 'if' | 'elseif' | 'else'; condition: string } | null {
        const match = keyStr.match(CONDITIONAL_RE);
        if (!match) { return null; }
        return { type: match[1] as 'if' | 'elseif' | 'else', condition: match[2] || '' };
    }

    private parseEachKey(keyStr: string): { variable: string; collection: string } | null {
        const match = keyStr.match(EACH_RE);
        if (!match) { return null; }
        return { variable: match[1], collection: match[2] };
    }

    private evaluateCondition(condition: string): boolean {
        try {
            const result = evaluate(condition, this.context.evaluationContext);
            return !!result.value;
        } catch {
            return false;
        }
    }

	private visitor: asyncVisitor = {
        Pair: async (symbol, value: Pair, path): Promise<void | symbol> => {
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

            const keyStr = isScalar(value.key) ? String(value.key.value) : '';

            // Handle ${{ if/elseif/else }} conditionals
            const conditional = this.parseConditionalKey(keyStr);
            if (conditional) {
                let condResult = false;
                if (conditional.type === 'else') {
                    condResult = true; // else always matches (if prior branches didn't)
                } else {
                    condResult = this.evaluateCondition(conditional.condition);
                }

                // Show the evaluation result in template expressions scope
                const resultStr = String(condResult);
                addTemplateExpressions(ctxt, [new Expression(keyStr, resultStr)]);
                this.callbacks.onConditionalEvaluated?.(conditional.condition, condResult, position);

                const traversalControl = await this.callbacks.onStep(position);
                if (!condResult) {
                    return visit.SKIP; // Skip the block contents
                }
                if (traversalControl === 'StepOver') {
                    return visit.SKIP;
                }
                return undefined;
            }

            // Handle ${{ each var in collection }} loops
            const each = this.parseEachKey(keyStr);
            if (each) {
                let collection: any[];
                try {
                    const result = evaluate(each.collection, ctxt.evaluationContext);
                    collection = Array.isArray(result.value) ? result.value : [result.value];
                } catch {
                    collection = [];
                }

                addTemplateExpressions(ctxt, [new Expression(keyStr, formatCollection(collection))]);

                for (let i = 0; i < collection.length; i++) {
                    // Bind the loop variable in the evaluation context
                    const prevValue = ctxt.evaluationContext.parameters[each.variable];
                    ctxt.evaluationContext.parameters[each.variable] = collection[i];

                    this.callbacks.onEachIteration?.(each.variable, i, collection.length, position);

                    // Show current iteration state
                    const iterExpr = new Expression(`${each.variable} (iteration ${i + 1}/${collection.length})`, JSON.stringify(collection[i]));
                    addTemplateExpressions(ctxt, [iterExpr]);

                    const traversalControl = await this.callbacks.onStep(position);

                    // Traverse the loop body for each iteration
                    if (isMap(value.value) || isSeq(value.value)) {
                        await visitAsync(value.value, this.visitor);
                    }

                    // Restore previous value
                    if (prevValue !== undefined) {
                        ctxt.evaluationContext.parameters[each.variable] = prevValue;
                    } else {
                        delete ctxt.evaluationContext.parameters[each.variable];
                    }
                }

                return visit.SKIP; // We already traversed the body ourselves
            }

            // Regular template expression evaluation — accumulate across steps
            if (isTemplateExpression(value.key as Node)) {
                addTemplateExpressions(ctxt, parseTemplateExpression((value.key as Scalar).toString(), ctxt.evaluationContext));
            }

            if (isTemplateExpression(value.value as Node)) {
                addTemplateExpressions(ctxt, parseTemplateExpression((value.value as Scalar).toString(), ctxt.evaluationContext));
            }

            if (isScalar(value.key) && value.key.value === "parameters" && isSeq(value.value) && path.length === 2) {
                let finalParams = getExpression(ctxt.paramsReferenceId);
                parseParameterSpecAndMerge(value.value, finalParams);

                // Sync evaluation context with parsed parameters
                for (const child of finalParams.children) {
                    ctxt.evaluationContext.parameters[child.name] = child.value;
                }
            }

            if (isScalar(value.key) && value.key.value === "variables" && isSeq(value.value)) {
                const children = parseVariables(value.value, ctxt.evaluationContext);

                if (children.length > 0) {
                    const vars = new Expression("Variables", "", children);
                    ctxt.variablesReferenceId = vars.variablesReference;

                    // Sync evaluation context with parsed variables
                    for (const child of children) {
                        ctxt.evaluationContext.variables[child.name] = child.value;
                    }
                }
            }

            // Handle extends: template references
            if (isScalar(value.key) && value.key.value === "extends" && isMap(value.value)) {
                for (const kvp of value.value.items) {
                    if (isScalar(kvp.key) && kvp.key.value === "template" && isScalar(kvp.value)) {
                        let targetDocPath = kvp.value.toString();
                        if (!isAbsolute(targetDocPath)) {
                            targetDocPath = join(dirname(this.doc.source), targetDocPath);
                        }

                        let childern: Expression[] = [];
                        for (const extendsKvp of value.value.items) {
                            if (isScalar(extendsKvp.key) && extendsKvp.key.value === "parameters" && isMap(extendsKvp.value)) {
                                childern = parseParameterArguments(extendsKvp.value);
                            }
                        }

                        const params = new Expression("Parameters", "", childern, true);
                        try {
                            await this.callbacks.onTemplate(targetDocPath, params.variablesReference, true);
                        } catch (error) {
                            this.shouldAbort = true;
                            if (error instanceof FileSystemError) {
                                await this.callbacks.onFileSystemError(error.message);
                                return visit.BREAK;
                            } else {
                                throw error;
                            }
                        }
                    }
                }
            }

            // Encountered a pair that needs to be expanded (template include)
            if (isScalar(value.key) && value.key.value === "template" && isScalar(value.value)) {
                let targetDocPath = value.value.toString();
                if (!isAbsolute(targetDocPath)) {
                    targetDocPath = join(dirname(this.doc.source), targetDocPath);
                }

                // Attempt to find any parameters for that template
                const parentNode = path[path.length-1] as Node;
                let childern: Expression[] = [];
                if (isMap(parentNode)) {
                    for (const kvp of parentNode.items) {
                        if (isScalar(kvp.key) && kvp.key.value === "parameters" && isMap(kvp.value)) {
                            childern = parseParameterArguments(kvp.value);
                        }
                    }
                }

                const params = new Expression("Parameters", "", childern, true);
                try {
                    await this.callbacks.onTemplate(targetDocPath, params.variablesReference);
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

    /**
     * Pre-scan the document's top-level to populate parameters and variables
     * into the execution context before traversal begins, so they are visible
     * from the very first stop (including stopOnEntry).
     */
    public prePopulateScopes(): void {
        const ctxt = this.context;
        const doc = this.doc.yaml;

        if (!isMap(doc.contents)) {
            return;
        }

        for (const item of doc.contents.items) {
            if (!isScalar(item.key)) {
                continue;
            }

            // Pre-populate parameter defaults from the spec
            if (item.key.value === "parameters" && isSeq(item.value)) {
                const finalParams = getExpression(ctxt.paramsReferenceId);
                parseParameterSpecAndMerge(item.value, finalParams);
                for (const child of finalParams.children) {
                    ctxt.evaluationContext.parameters[child.name] = child.value;
                }
            }

            // Pre-populate variables
            if (item.key.value === "variables" && isSeq(item.value)) {
                const children = parseVariables(item.value, ctxt.evaluationContext);
                if (children.length > 0) {
                    const vars = new Expression("Variables", "", children);
                    ctxt.variablesReferenceId = vars.variablesReference;
                    for (const child of children) {
                        ctxt.evaluationContext.variables[child.name] = child.value;
                    }
                }
            }
        }
    }

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