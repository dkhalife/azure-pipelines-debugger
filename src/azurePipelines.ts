import { Node, Scalar, YAMLMap, YAMLSeq, isCollection, isMap, isScalar, isSeq } from "yaml";
import { Expression } from "./expression";

export function parseParameters(params: YAMLMap<unknown, unknown> | YAMLSeq<unknown>): Expression[] {
    const ret: Expression[] = [];
    
    if (isMap(params)) {
        for (const item of params.items) {
            if (!isScalar(item.key)) {
                continue;
            }

            const value = isScalar(item.value) ? item.value.toString() : "";
            let children = isCollection(item.value) ? parseParameters(item.value) : [];

            ret.push(new Expression(item.key.value as string, value, children));
        }
    } else if (isSeq(params)) {
        for (let i = 0; i < params.items.length; ++i) {
            const item = params.items[i];
            const value = isScalar(item) ? item.toString() : "";
            let children = isCollection(item) ? parseParameters(item) : [];

            ret.push(new Expression(i.toString(), value, children));
        }
    }

    return ret;
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