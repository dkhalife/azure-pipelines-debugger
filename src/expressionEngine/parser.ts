import { tokenize } from './lexer';
import { AstNode, Token, TokenType, ExpressionError } from './types';

class Parser {
    private tokens: Token[];
    private pos: number = 0;
    private input: string;

    constructor(input: string) {
        this.input = input;
        this.tokens = tokenize(input);
    }

    private peek(): Token {
        return this.tokens[this.pos];
    }

    private advance(): Token {
        return this.tokens[this.pos++];
    }

    private expect(type: TokenType): Token {
        const tok = this.advance();
        if (tok.type !== type) {
            throw new ExpressionError(
                `Expected ${type} but got ${tok.type} ('${tok.value}')`,
                this.input,
                tok.position,
            );
        }
        return tok;
    }

    public parse(): AstNode {
        const node = this.parseExpression();
        if (this.peek().type !== TokenType.EOF) {
            const tok = this.peek();
            throw new ExpressionError(
                `Unexpected token '${tok.value}'`,
                this.input,
                tok.position,
            );
        }
        return node;
    }

    private parseExpression(): AstNode {
        return this.parseComparison();
    }

    private parseComparison(): AstNode {
        let left = this.parsePrimary();

        while (this.peek().type === TokenType.Operator) {
            const op = this.advance();
            const right = this.parsePrimary();
            left = { kind: 'BinaryExpression', operator: op.value, left, right };
        }

        return left;
    }

    private parsePrimary(): AstNode {
        const tok = this.peek();

        if (tok.type === TokenType.StringLiteral) {
            this.advance();
            return { kind: 'Literal', value: tok.value, literalType: 'string' };
        }

        if (tok.type === TokenType.NumberLiteral) {
            this.advance();
            const num = parseFloat(tok.value);
            return { kind: 'Literal', value: num, literalType: 'number' };
        }

        if (tok.type === TokenType.BooleanLiteral) {
            this.advance();
            return { kind: 'Literal', value: tok.value === 'true', literalType: 'boolean' };
        }

        if (tok.type === TokenType.NullLiteral) {
            this.advance();
            return { kind: 'Literal', value: null, literalType: 'null' };
        }

        if (tok.type === TokenType.Identifier) {
            return this.parseIdentifierExpression();
        }

        if (tok.type === TokenType.LParen) {
            this.advance();
            const expr = this.parseExpression();
            this.expect(TokenType.RParen);
            return expr;
        }

        throw new ExpressionError(
            `Unexpected token '${tok.value}'`,
            this.input,
            tok.position,
        );
    }

    private parseIdentifierExpression(): AstNode {
        const name = this.advance(); // Identifier

        // Function call: name(args...)
        if (this.peek().type === TokenType.LParen) {
            this.advance(); // consume '('
            const args = this.parseArgList();
            this.expect(TokenType.RParen);
            let node: AstNode = { kind: 'FunctionCall', name: name.value, args };
            return this.parsePostfix(node);
        }

        // Property access: name.prop.subprop
        const segments = [name.value];
        while (this.peek().type === TokenType.Dot) {
            this.advance(); // consume '.'
            const prop = this.expect(TokenType.Identifier);
            segments.push(prop.value);
        }

        let node: AstNode = {
            kind: 'PropertyAccess',
            segments,
            source: segments.join('.'),
        };

        return this.parsePostfix(node);
    }

    private parsePostfix(node: AstNode): AstNode {
        // Index access: node[expr]
        while (this.peek().type === TokenType.LBracket) {
            this.advance(); // consume '['
            const index = this.parseExpression();
            this.expect(TokenType.RBracket);
            node = { kind: 'IndexAccess', object: node, index };
        }
        return node;
    }

    private parseArgList(): AstNode[] {
        const args: AstNode[] = [];
        if (this.peek().type === TokenType.RParen) {
            return args;
        }
        args.push(this.parseExpression());
        while (this.peek().type === TokenType.Comma) {
            this.advance(); // consume ','
            args.push(this.parseExpression());
        }
        return args;
    }
}

/** Parse a template expression string into an AST node. Does NOT include the ${{ }} wrapper. */
export function parse(input: string): AstNode {
    return new Parser(input).parse();
}
