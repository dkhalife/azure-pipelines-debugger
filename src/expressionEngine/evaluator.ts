import { parse } from './parser';
import { AstNode, EvaluationContext, ExpressionError, ExpressionResult } from './types';
import { getBuiltinFunction } from './functions';

function resolveProperty(segments: string[], context: EvaluationContext): any {
    const root = segments[0];
    let obj: any;

    if (root === 'parameters') {
        obj = context.parameters;
    } else if (root === 'variables') {
        obj = context.variables;
    } else {
        // Could be a single identifier used as function arg, return as-is
        if (segments.length === 1) {
            return undefined;
        }
        throw new ExpressionError(`Unknown root '${root}'`, segments.join('.'));
    }

    for (let i = 1; i < segments.length; i++) {
        if (obj === null || obj === undefined) {
            return undefined;
        }
        obj = obj[segments[i]];
    }
    return obj;
}

function evaluateNode(node: AstNode, context: EvaluationContext, sourceExpr: string): any {
    switch (node.kind) {
        case 'Literal':
            return node.value;

        case 'PropertyAccess':
            return resolveProperty(node.segments, context);

        case 'FunctionCall': {
            const fn = getBuiltinFunction(node.name);
            if (!fn) {
                throw new ExpressionError(`Unknown function '${node.name}'`, sourceExpr);
            }
            const args = node.args.map(a => evaluateNode(a, context, sourceExpr));
            return fn(args, sourceExpr);
        }

        case 'BinaryExpression': {
            const left = evaluateNode(node.left, context, sourceExpr);
            const right = evaluateNode(node.right, context, sourceExpr);
            switch (node.operator) {
                case '==': return String(left).toLowerCase() === String(right).toLowerCase();
                case '!=': return String(left).toLowerCase() !== String(right).toLowerCase();
                case '<':  return Number(left) < Number(right);
                case '<=': return Number(left) <= Number(right);
                case '>':  return Number(left) > Number(right);
                case '>=': return Number(left) >= Number(right);
                default:
                    throw new ExpressionError(`Unknown operator '${node.operator}'`, sourceExpr);
            }
        }

        case 'IndexAccess': {
            const obj = evaluateNode(node.object, context, sourceExpr);
            const idx = evaluateNode(node.index, context, sourceExpr);
            if (obj === null || obj === undefined) { return undefined; }
            return obj[idx];
        }
    }
}

function typeOf(value: any): string {
    if (value === null || value === undefined) { return 'null'; }
    if (Array.isArray(value)) { return 'object'; }
    return typeof value;
}

/**
 * Evaluate a compile-time template expression.
 * @param expression The expression string WITHOUT the ${{ }} wrapper.
 * @param context The evaluation context with parameters and variables.
 */
export function evaluate(expression: string, context: EvaluationContext): ExpressionResult {
    const ast = parse(expression);
    const value = evaluateNode(ast, context, expression);
    return {
        value,
        type: typeOf(value),
        sourceExpression: expression,
    };
}

/**
 * Evaluate a full `${{ expression }}` string — strips the delimiters automatically.
 * If the input doesn't start with `${{`, returns it as a literal string.
 */
export function evaluateTemplateString(input: string, context: EvaluationContext): ExpressionResult {
    const trimmed = input.trim();
    if (!trimmed.startsWith('${{')) {
        return { value: input, type: 'string', sourceExpression: input };
    }

    const inner = trimmed.slice(3, trimmed.endsWith('}}') ? -2 : undefined).trim();
    return evaluate(inner, context);
}
