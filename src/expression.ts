import { Variable } from "@vscode/debugadapter";

let expressionStore: Expression[] = [];
export class Expression extends Variable {
	private static next_id: number = 0;

	public static resetStore() {
		expressionStore = [];
		Expression.next_id = 0;
	}

	constructor(public readonly name: string, public value: string, public children: Expression[] = [], forceRef: boolean = false) {
		super(name, value, (forceRef || children.length > 0) ? Expression.next_id++ : undefined);

		if (forceRef || children.length > 0) {
			expressionStore.push(this);
		}
	}
};

export const getExpression = (id: number): Expression => {
	if (id < 0 || id >= expressionStore.length) {
		throw new Error("Invalid argument: id=" + id);
	}

	return expressionStore[id] as Expression;
}

export const hasNamedChild = (expr: Expression, name: string): boolean => {
	for (const child of expr.children) {
		if (child.name === name) {
			return true;
		}
	}

	return false;
}
