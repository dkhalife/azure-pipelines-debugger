import * as assert from 'assert';
import { parse } from '../../expressionEngine/parser';

suite('Expression Parser', () => {
    test('parses a simple property access', () => {
        const ast = parse('parameters.env');
        assert.strictEqual(ast.kind, 'PropertyAccess');
        if (ast.kind === 'PropertyAccess') {
            assert.deepStrictEqual(ast.segments, ['parameters', 'env']);
        }
    });

    test('parses a string literal', () => {
        const ast = parse("'hello'");
        assert.strictEqual(ast.kind, 'Literal');
        if (ast.kind === 'Literal') {
            assert.strictEqual(ast.value, 'hello');
            assert.strictEqual(ast.literalType, 'string');
        }
    });

    test('parses a number literal', () => {
        const ast = parse('42');
        assert.strictEqual(ast.kind, 'Literal');
        if (ast.kind === 'Literal') {
            assert.strictEqual(ast.value, 42);
            assert.strictEqual(ast.literalType, 'number');
        }
    });

    test('parses boolean literals', () => {
        const t = parse('true');
        assert.strictEqual(t.kind, 'Literal');
        if (t.kind === 'Literal') { assert.strictEqual(t.value, true); }

        const f = parse('false');
        assert.strictEqual(f.kind, 'Literal');
        if (f.kind === 'Literal') { assert.strictEqual(f.value, false); }
    });

    test('parses null literal', () => {
        const ast = parse('null');
        assert.strictEqual(ast.kind, 'Literal');
        if (ast.kind === 'Literal') {
            assert.strictEqual(ast.value, null);
            assert.strictEqual(ast.literalType, 'null');
        }
    });

    test('parses a function call with no arguments', () => {
        const ast = parse('coalesce()');
        assert.strictEqual(ast.kind, 'FunctionCall');
        if (ast.kind === 'FunctionCall') {
            assert.strictEqual(ast.name, 'coalesce');
            assert.strictEqual(ast.args.length, 0);
        }
    });

    test('parses a function call with arguments', () => {
        const ast = parse("eq(parameters.env, 'prod')");
        assert.strictEqual(ast.kind, 'FunctionCall');
        if (ast.kind === 'FunctionCall') {
            assert.strictEqual(ast.name, 'eq');
            assert.strictEqual(ast.args.length, 2);
            assert.strictEqual(ast.args[0].kind, 'PropertyAccess');
            assert.strictEqual(ast.args[1].kind, 'Literal');
        }
    });

    test('parses nested function calls', () => {
        const ast = parse("and(eq(parameters.a, '1'), ne(parameters.b, '2'))");
        assert.strictEqual(ast.kind, 'FunctionCall');
        if (ast.kind === 'FunctionCall') {
            assert.strictEqual(ast.name, 'and');
            assert.strictEqual(ast.args.length, 2);
            assert.strictEqual(ast.args[0].kind, 'FunctionCall');
            assert.strictEqual(ast.args[1].kind, 'FunctionCall');
        }
    });

    test('parses binary expressions', () => {
        const ast = parse("parameters.count == 5");
        assert.strictEqual(ast.kind, 'BinaryExpression');
        if (ast.kind === 'BinaryExpression') {
            assert.strictEqual(ast.operator, '==');
            assert.strictEqual(ast.left.kind, 'PropertyAccess');
            assert.strictEqual(ast.right.kind, 'Literal');
        }
    });

    test('parses index access', () => {
        const ast = parse("parameters.items[0]");
        assert.strictEqual(ast.kind, 'IndexAccess');
        if (ast.kind === 'IndexAccess') {
            assert.strictEqual(ast.object.kind, 'PropertyAccess');
            assert.strictEqual(ast.index.kind, 'Literal');
        }
    });

    test('parses parenthesized expressions', () => {
        const ast = parse("(parameters.env)");
        assert.strictEqual(ast.kind, 'PropertyAccess');
    });

    test('throws on unexpected token', () => {
        assert.throws(() => parse('== =='), /Unexpected token/);
    });

    test('throws on trailing tokens', () => {
        assert.throws(() => parse("parameters.env 'extra'"), /Unexpected token/);
    });
});
