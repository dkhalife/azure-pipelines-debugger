import { isScalar, Node, Scalar } from "yaml";
import { ExecutionContext } from "./executionContext";
import { Expression, getExpression } from "./expression";

export const isTemplateExpression = (node: Node): boolean => {
    if (!isScalar(node)) {
        return false;
    }

    const scalarValue = (node.value as Scalar).toString().trim()
    return scalarValue.startsWith("${{") ?? false;
}

export const addTemplateExpressions = (ctxt: ExecutionContext, expressions: Expression[]) => {
    if (ctxt.templateExpressionsReferenceId == -1) {
        new Expression("Template expressions", "", expressions);
        return;
    }

    getExpression(ctxt.templateExpressionsReferenceId).children.push(...expressions);
}