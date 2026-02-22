import { Node, Scalar, YAMLMap, YAMLSeq, isCollection, isMap, isScalar, isSeq } from "yaml";
import { Expression, hasNamedChild } from "./expression";
import { evaluate, ExpressionError } from "./expressionEngine/index";
import { EvaluationContext } from "./expressionEngine/types";

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
        let defaultValueJSON: string | null = null
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
                    defaultValue = parseParameterArguments(attribute.value)
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

export function parseVariables(vars: YAMLSeq<unknown>): Expression[] {
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

        ret.push(new Expression(name, value));
    }

    return ret;
}

export const parseTemplateExpression = (expression: string, context: EvaluationContext): Expression[] => {
    // Strip ${{ }} wrapper if present
    let inner = expression.trim();
    if (inner.startsWith('${{')) {
        inner = inner.slice(3, inner.endsWith('}}') ? -2 : undefined).trim();
    }

    try {
        const result = evaluate(inner, context);
        const valueStr = result.value === null || result.value === undefined
            ? ''
            : typeof result.value === 'object' ? JSON.stringify(result.value) : String(result.value);
        return [new Expression(inner, valueStr)];
    } catch (e) {
        // Fallback: show the raw expression with the error as value
        const msg = e instanceof ExpressionError ? e.message : String(e);
        return [new Expression(inner, `<error: ${msg}>`)];
    }
}