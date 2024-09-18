export class Stack<T> {
    private items: T[] = [];

    push(element: T): void {
        this.items.push(element);
    }

    pop(): T | undefined {
        return this.items.pop();
    }

    item(i: number): T | undefined {
        return this.items[i];
    }

    top(): T {
        if (this.items.length === 0) {
            throw new Error("Stack is empty");
        }

        return this.items[this.items.length-1];
    }

    isEmpty(): boolean {
        return this.items.length === 0;
    }

    size(): number {
        return this.items.length;
    }

    clear(): void {
        this.items = [];
    }
}
