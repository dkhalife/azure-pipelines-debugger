import { Node, Scalar, YAMLMap, YAMLSeq, isCollection, isMap, isScalar, isSeq } from "yaml";
import { Expression, hasNamedChild } from "./expression";
import { evaluate, evaluateTemplateString, ExpressionError } from "./expressionEngine/index";
import { AstNode } from "./expressionEngine/types";
import { EvaluationContext } from "./expressionEngine/types";
import { parse } from "./expressionEngine/parser";

export function parseParameterArguments(params: YAMLMap<unknown, unknown> | YAMLSeq<unknown>): Expression[] {
    const ret: Expression[] = [];
    
    if (isMap(params)) {
        for (const item of params.items) {
            if (!isScalar(item.key)) {
                continue;
            }

            const value = isScalar(item.value) ? item.value.toString() : JSON.stringify((item.value as Node).toJSON());
            let children = isCollection(item.value) ? parseParameterArguments(item.value) : [];

            ret.push(new Expression(item.key.value as string, value, children));
        }
    } else if (isSeq(params)) {
        for (let i = 0; i < params.items.length; ++i) {
            const item = params.items[i];
            const value = isScalar(item) ? item.toString() : JSON.stringify((item as Node).toJSON());
            let children = isCollection(item) ? parseParameterArguments(item) : [];

            ret.push(new Expression(i.toString(), value, children));
        }
    }

    return ret;
}

export function parseParameterSpecAndMerge(params: YAMLSeq<unknown>, finalParams: Expression) {
    // Since the parameter values would have already been parsed at the call site,
    // and those take priority, we only care here about returning whichever ones
    // have default values and were not already provided
    for (const v of params.items) {
        if (!isMap(v)) {
            continue;
        }

        let name: string | null = null;
        let defaultValue: Expression[] | undefined;
        let defaultValueJSON: string | null = null;
        let skip = false;

        for (const attribute of v.items) {
            if (isScalar(attribute.key) && attribute.key.value === "name" && isScalar(attribute.value)) {
                name = attribute.value.toString();

                if (hasNamedChild(finalParams, name)) {
                    skip = true;
                }
            }

            if (isScalar(attribute.key) && attribute.key.value === "default") {
                if (isScalar(attribute.value)) {
                    defaultValueJSON = attribute.value.toString();
                } else if (isMap(attribute.value) || isSeq(attribute.value)) {
                    defaultValue = parseParameterArguments(attribute.value);
                    defaultValueJSON = JSON.stringify(attribute.value.toJSON());
                }
            }
        }

        if (skip || !name || !defaultValueJSON) {
            continue;
        }

        // Found a missing key in finalParams that has a default value, let's add it
        finalParams.children.push(new Expression(name, defaultValueJSON, defaultValue));
    }
}

export function parseVariables(vars: YAMLSeq<unknown>, context?: EvaluationContext): Expression[] {
    let ret: Expression[] = [];

    for (const v of vars.items) {
        // schema should prevent this from ever happening
        if (!isMap(v)) {
            continue;
        }

        let name: string | null = null;
        let value: string | null = null;
        
        for (const attribute of v.items) {
            if (isScalar(attribute.key) && attribute.key.value === "name" && isScalar(attribute.value)) {
                name = attribute.value.toString();
            }

            if (isScalar(attribute.key) && attribute.key.value === "value" && isScalar(attribute.value)) {
                value = attribute.value.toString();
            }
        }

        if (!name || !value) {
            continue;
        }

        // Resolve any ${{ }} expressions in the value
        if (context && value.includes('${{')) {
            try {
                const result = evaluateTemplateString(value, context);
                const resolved = result.value === null || result.value === undefined
                    ? ''
                    : typeof result.value === 'object' ? JSON.stringify(result.value) : String(result.value);
                ret.push(new Expression(name, resolved));
            } catch {
                ret.push(new Expression(name, value));
            }
        } else {
            ret.push(new Expression(name, value));
        }
    }

    return ret;
}

function formatValue(value: any): string {
    if (value === null || value === undefined) { return ''; }
    if (typeof value === 'object') { return JSON.stringify(value); }
    return String(value);
}

function astNodeToString(node: AstNode): string {
    switch (node.kind) {
        case 'Literal':
            if (node.literalType === 'string') { return `'${node.value}'`; }
            return String(node.value);
        case 'PropertyAccess':
            return node.source;
        case 'FunctionCall':
            return `${node.name}(${node.args.map(astNodeToString).join(', ')})`;
        case 'BinaryExpression':
            return `${astNodeToString(node.left)} ${node.operator} ${astNodeToString(node.right)}`;
        case 'IndexAccess':
            return `${astNodeToString(node.object)}[${astNodeToString(node.index)}]`;
    }
}

function buildExpressionTree(node: AstNode, context: EvaluationContext): Expression {
    const label = astNodeToString(node);

    switch (node.kind) {
        case 'Literal': {
            return new Expression(label, formatValue(node.value));
        }
        case 'PropertyAccess': {
            const value = evaluate(node.source, context);
            return new Expression(label, formatValue(value.value));
        }
        case 'FunctionCall': {
            const children = node.args.map(arg => buildExpressionTree(arg, context));
            let value: any;
            try { value = evaluate(label, context).value; } catch { value = '<error>'; }
            return new Expression(label, formatValue(value), children);
        }
        case 'BinaryExpression': {
            const children = [
                buildExpressionTree(node.left, context),
                buildExpressionTree(node.right, context),
            ];
            let value: any;
            try { value = evaluate(label, context).value; } catch { value = '<error>'; }
            return new Expression(label, formatValue(value), children);
        }
        case 'IndexAccess': {
            const children = [
                buildExpressionTree(node.object, context),
                buildExpressionTree(node.index, context),
            ];
            let value: any;
            try { value = evaluate(label, context).value; } catch { value = '<error>'; }
            return new Expression(label, formatValue(value), children);
        }
    }
}

export const parseTemplateExpression = (expression: string, context: EvaluationContext): Expression[] => {
    // Strip ${{ }} wrapper if present
    let inner = expression.trim();
    if (inner.startsWith('${{')) {
        inner = inner.slice(3, inner.endsWith('}}') ? -2 : undefined).trim();
    }

    try {
        const ast = parse(inner);
        const tree = buildExpressionTree(ast, context);
        return [tree];
    } catch (e) {
        const msg = e instanceof ExpressionError ? e.message : String(e);
        return [new Expression(inner, `<error: ${msg}>`)];
    }
};