import * as assert from 'assert';
import { tokenize } from '../../expressionEngine/lexer';
import { TokenType } from '../../expressionEngine/types';

suite('Expression Lexer', () => {
    test('tokenizes identifiers', () => {
        const tokens = tokenize('parameters');
        assert.strictEqual(tokens.length, 2); // identifier + EOF
        assert.strictEqual(tokens[0].type, TokenType.Identifier);
        assert.strictEqual(tokens[0].value, 'parameters');
    });

    test('tokenizes dotted property access', () => {
        const tokens = tokenize('parameters.environment');
        assert.strictEqual(tokens.length, 4); // identifier, dot, identifier, EOF
        assert.strictEqual(tokens[0].type, TokenType.Identifier);
        assert.strictEqual(tokens[1].type, TokenType.Dot);
        assert.strictEqual(tokens[2].type, TokenType.Identifier);
        assert.strictEqual(tokens[2].value, 'environment');
    });

    test('tokenizes string literals with single quotes', () => {
        const tokens = tokenize("'hello world'");
        assert.strictEqual(tokens[0].type, TokenType.StringLiteral);
        assert.strictEqual(tokens[0].value, 'hello world');
    });

    test('tokenizes string literals with escaped quotes', () => {
        const tokens = tokenize("'it''s'");
        assert.strictEqual(tokens[0].type, TokenType.StringLiteral);
        assert.strictEqual(tokens[0].value, "it's");
    });

    test('tokenizes number literals', () => {
        const tokens = tokenize('42');
        assert.strictEqual(tokens[0].type, TokenType.NumberLiteral);
        assert.strictEqual(tokens[0].value, '42');
    });

    test('tokenizes negative numbers', () => {
        const tokens = tokenize('-5');
        assert.strictEqual(tokens[0].type, TokenType.NumberLiteral);
        assert.strictEqual(tokens[0].value, '-5');
    });

    test('tokenizes boolean literals', () => {
        const trueTokens = tokenize('true');
        assert.strictEqual(trueTokens[0].type, TokenType.BooleanLiteral);
        assert.strictEqual(trueTokens[0].value, 'true');

        const falseTokens = tokenize('false');
        assert.strictEqual(falseTokens[0].type, TokenType.BooleanLiteral);
        assert.strictEqual(falseTokens[0].value, 'false');
    });

    test('tokenizes null literal', () => {
        const tokens = tokenize('null');
        assert.strictEqual(tokens[0].type, TokenType.NullLiteral);
    });

    test('tokenizes operators', () => {
        for (const op of ['==', '!=', '>=', '<=', '>', '<']) {
            const tokens = tokenize(op);
            assert.strictEqual(tokens[0].type, TokenType.Operator);
            assert.strictEqual(tokens[0].value, op);
        }
    });

    test('tokenizes function call syntax', () => {
        const tokens = tokenize("eq(parameters.env, 'prod')");
        const types = tokens.map(t => t.type);
        assert.deepStrictEqual(types, [
            TokenType.Identifier,     // eq
            TokenType.LParen,         // (
            TokenType.Identifier,     // parameters
            TokenType.Dot,            // .
            TokenType.Identifier,     // env
            TokenType.Comma,          // ,
            TokenType.StringLiteral,  // 'prod'
            TokenType.RParen,         // )
            TokenType.EOF,
        ]);
    });

    test('tokenizes brackets for index access', () => {
        const tokens = tokenize('a[0]');
        assert.strictEqual(tokens[1].type, TokenType.LBracket);
        assert.strictEqual(tokens[3].type, TokenType.RBracket);
    });

    test('skips whitespace', () => {
        const tokens = tokenize('  eq ( a , b )  ');
        assert.strictEqual(tokens.filter(t => t.type !== TokenType.EOF).length, 6);
    });

    test('throws on unexpected character', () => {
        assert.throws(() => tokenize('@'), /Unexpected character/);
    });
});
