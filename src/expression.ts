import { Variable } from "@vscode/debugadapter";

let expressionStore: Expression[] = [];
export class Expression extends Variable {
	// Start at 1 because DAP treats variablesReference=0 as "no children"
	private static next_id: number = 1;

	public static resetStore() {
		expressionStore = [];
		Expression.next_id = 1;
	}

	constructor(public readonly name: string, public value: string, public children: Expression[] = [], forceRef: boolean = false) {
		super(name, value, (forceRef || children.length > 0) ? Expression.next_id++ : undefined);

		if (forceRef || children.length > 0) {
			expressionStore.push(this);
		}
	}
};

export const getExpression = (id: number): Expression => {
	const index = id - 1; // IDs start at 1, array starts at 0
	if (index < 0 || index >= expressionStore.length) {
		throw new Error("Invalid argument: id=" + id);
	}

	return expressionStore[index] as Expression;
};

export const hasNamedChild = (expr: Expression, name: string): boolean => {
	for (const child of expr.children) {
		if (child.name === name) {
			return true;
		}
	}

	return false;
};
