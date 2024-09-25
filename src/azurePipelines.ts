import { YAMLMap, YAMLSeq, isMap, isScalar } from "yaml";
import { Expression } from "./expression";

export function parseParameters(params: YAMLMap<unknown, unknown>): Expression[] {
    // TODO: implement and support recursive properties
    return [
        new Expression("foo", "", [
            new Expression("a", "1"),
            new Expression("x", "2"),
        ])
    ];
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