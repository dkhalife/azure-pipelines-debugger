import * as assert from 'assert';
import { evaluate, evaluateTemplateString } from '../../expressionEngine/evaluator';
import { EvaluationContext } from '../../expressionEngine/types';

const ctx: EvaluationContext = {
    parameters: {
        environment: 'production',
        count: 3,
        enabled: true,
        items: ['a', 'b', 'c'],
        nested: { key: 'value' },
    },
    variables: {
        buildConfiguration: 'Release',
        version: '1.0.0',
    },
};

suite('Expression Evaluator', () => {
    suite('property access', () => {
        test('resolves parameter values', () => {
            const result = evaluate('parameters.environment', ctx);
            assert.strictEqual(result.value, 'production');
        });

        test('resolves variable values', () => {
            const result = evaluate('variables.buildConfiguration', ctx);
            assert.strictEqual(result.value, 'Release');
        });

        test('resolves nested properties', () => {
            const result = evaluate('parameters.nested.key', ctx);
            assert.strictEqual(result.value, 'value');
        });

        test('returns undefined for missing properties', () => {
            const result = evaluate('parameters.nonExistent', ctx);
            assert.strictEqual(result.value, undefined);
        });
    });

    suite('eq/ne functions', () => {
        test('eq returns true for matching values (case-insensitive)', () => {
            const result = evaluate("eq(parameters.environment, 'Production')", ctx);
            assert.strictEqual(result.value, true);
        });

        test('eq returns false for non-matching values', () => {
            const result = evaluate("eq(parameters.environment, 'staging')", ctx);
            assert.strictEqual(result.value, false);
        });

        test('ne returns true for different values', () => {
            const result = evaluate("ne(parameters.environment, 'staging')", ctx);
            assert.strictEqual(result.value, true);
        });
    });

    suite('logical functions', () => {
        test('and returns true when all args are truthy', () => {
            const result = evaluate("and(true, true)", ctx);
            assert.strictEqual(result.value, true);
        });

        test('and returns false when any arg is falsy', () => {
            const result = evaluate("and(true, false)", ctx);
            assert.strictEqual(result.value, false);
        });

        test('or returns true when any arg is truthy', () => {
            const result = evaluate("or(false, true)", ctx);
            assert.strictEqual(result.value, true);
        });

        test('not negates the value', () => {
            const result = evaluate("not(false)", ctx);
            assert.strictEqual(result.value, true);
        });
    });

    suite('string functions', () => {
        test('contains checks substring (case-insensitive)', () => {
            const result = evaluate("contains(parameters.environment, 'prod')", ctx);
            assert.strictEqual(result.value, true);
        });

        test('startsWith', () => {
            const result = evaluate("startsWith(parameters.environment, 'prod')", ctx);
            assert.strictEqual(result.value, true);
        });

        test('endsWith', () => {
            const result = evaluate("endsWith(parameters.environment, 'tion')", ctx);
            assert.strictEqual(result.value, true);
        });

        test('format replaces placeholders', () => {
            const result = evaluate("format('Hello {0}, version {1}', parameters.environment, variables.version)", ctx);
            assert.strictEqual(result.value, 'Hello production, version 1.0.0');
        });

        test('lower', () => {
            const result = evaluate("lower('HELLO')", ctx);
            assert.strictEqual(result.value, 'hello');
        });

        test('upper', () => {
            const result = evaluate("upper('hello')", ctx);
            assert.strictEqual(result.value, 'HELLO');
        });

        test('replace', () => {
            const result = evaluate("replace('hello world', 'world', 'there')", ctx);
            assert.strictEqual(result.value, 'hello there');
        });
    });

    suite('collection functions', () => {
        test('length of array', () => {
            const result = evaluate("length(parameters.items)", ctx);
            assert.strictEqual(result.value, 3);
        });

        test('length of string', () => {
            const result = evaluate("length('hello')", ctx);
            assert.strictEqual(result.value, 5);
        });

        test('join', () => {
            const result = evaluate("join(',', parameters.items)", ctx);
            assert.strictEqual(result.value, 'a,b,c');
        });

        test('split', () => {
            const result = evaluate("split('a,b,c', ',')", ctx);
            assert.deepStrictEqual(result.value, ['a', 'b', 'c']);
        });

        test('convertToJson', () => {
            const result = evaluate("convertToJson(parameters.nested)", ctx);
            assert.strictEqual(result.value, '{"key":"value"}');
        });
    });

    suite('coalesce', () => {
        test('returns first non-empty value', () => {
            const result = evaluate("coalesce('', null, 'fallback')", ctx);
            assert.strictEqual(result.value, 'fallback');
        });

        test('returns first non-null value', () => {
            const result = evaluate("coalesce(parameters.environment, 'default')", ctx);
            assert.strictEqual(result.value, 'production');
        });
    });

    suite('in/notIn', () => {
        test('in returns true when value matches', () => {
            const result = evaluate("in(parameters.environment, 'staging', 'production')", ctx);
            assert.strictEqual(result.value, true);
        });

        test('notIn returns true when value does not match', () => {
            const result = evaluate("notIn(parameters.environment, 'dev', 'staging')", ctx);
            assert.strictEqual(result.value, true);
        });
    });

    suite('binary operators', () => {
        test('== comparison', () => {
            const result = evaluate("parameters.count == 3", ctx);
            assert.strictEqual(result.value, true);
        });

        test('!= comparison', () => {
            const result = evaluate("parameters.count != 5", ctx);
            assert.strictEqual(result.value, true);
        });

        test('> comparison', () => {
            const result = evaluate("parameters.count > 2", ctx);
            assert.strictEqual(result.value, true);
        });

        test('<= comparison', () => {
            const result = evaluate("parameters.count <= 3", ctx);
            assert.strictEqual(result.value, true);
        });
    });

    suite('index access', () => {
        test('accesses array by index', () => {
            const result = evaluate("parameters.items[1]", ctx);
            assert.strictEqual(result.value, 'b');
        });
    });

    suite('nested expressions', () => {
        test('evaluates nested function calls', () => {
            const result = evaluate("and(eq(parameters.environment, 'production'), eq(variables.buildConfiguration, 'Release'))", ctx);
            assert.strictEqual(result.value, true);
        });

        test('evaluates complex condition', () => {
            const result = evaluate("or(eq(parameters.environment, 'staging'), not(eq(parameters.count, 5)))", ctx);
            assert.strictEqual(result.value, true);
        });
    });

    suite('evaluateTemplateString', () => {
        test('evaluates ${{ }} wrapped expressions', () => {
            const result = evaluateTemplateString("${{ parameters.environment }}", ctx);
            assert.strictEqual(result.value, 'production');
        });

        test('returns literal for non-expression strings', () => {
            const result = evaluateTemplateString("just a string", ctx);
            assert.strictEqual(result.value, 'just a string');
        });
    });

    suite('error handling', () => {
        test('throws on unknown function', () => {
            assert.throws(() => evaluate("unknownFunc()", ctx), /Unknown function/);
        });

        test('throws on unknown root', () => {
            assert.throws(() => evaluate("resources.repo.name", ctx), /Unknown root/);
        });
    });
});
