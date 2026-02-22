import { Token, TokenType, ExpressionError } from './types';

export function tokenize(input: string): Token[] {
    const tokens: Token[] = [];
    let pos = 0;

    while (pos < input.length) {
        // Skip whitespace
        if (/\s/.test(input[pos])) {
            pos++;
            continue;
        }

        const ch = input[pos];

        if (ch === '(') {
            tokens.push({ type: TokenType.LParen, value: '(', position: pos++ });
        } else if (ch === ')') {
            tokens.push({ type: TokenType.RParen, value: ')', position: pos++ });
        } else if (ch === '[') {
            tokens.push({ type: TokenType.LBracket, value: '[', position: pos++ });
        } else if (ch === ']') {
            tokens.push({ type: TokenType.RBracket, value: ']', position: pos++ });
        } else if (ch === ',') {
            tokens.push({ type: TokenType.Comma, value: ',', position: pos++ });
        } else if (ch === '.') {
            tokens.push({ type: TokenType.Dot, value: '.', position: pos++ });
        } else if (ch === "'" || ch === '"') {
            // String literal — Azure Pipelines uses single-quoted strings
            const quote = ch;
            const start = pos;
            pos++;
            let value = '';
            while (pos < input.length) {
                if (input[pos] === quote) {
                    // Check for escaped quote (doubled)
                    if (pos + 1 < input.length && input[pos + 1] === quote) {
                        value += quote;
                        pos += 2;
                    } else {
                        pos++;
                        break;
                    }
                } else {
                    value += input[pos++];
                }
            }
            tokens.push({ type: TokenType.StringLiteral, value, position: start });
        } else if (ch === '=' || ch === '!' || ch === '<' || ch === '>') {
            const start = pos;
            if (pos + 1 < input.length && input[pos + 1] === '=') {
                tokens.push({ type: TokenType.Operator, value: input.slice(pos, pos + 2), position: start });
                pos += 2;
            } else if (ch === '<' || ch === '>') {
                tokens.push({ type: TokenType.Operator, value: ch, position: start });
                pos++;
            } else {
                throw new ExpressionError(`Unexpected character '${ch}'`, input, pos);
            }
        } else if (/[0-9]/.test(ch) || (ch === '-' && pos + 1 < input.length && /[0-9]/.test(input[pos + 1]))) {
            const start = pos;
            if (ch === '-') { pos++; }
            while (pos < input.length && /[0-9.]/.test(input[pos])) { pos++; }
            tokens.push({ type: TokenType.NumberLiteral, value: input.slice(start, pos), position: start });
        } else if (/[a-zA-Z_]/.test(ch)) {
            const start = pos;
            while (pos < input.length && /[a-zA-Z0-9_]/.test(input[pos])) { pos++; }
            const word = input.slice(start, pos);

            if (word === 'true' || word === 'false') {
                tokens.push({ type: TokenType.BooleanLiteral, value: word, position: start });
            } else if (word === 'null') {
                tokens.push({ type: TokenType.NullLiteral, value: word, position: start });
            } else {
                tokens.push({ type: TokenType.Identifier, value: word, position: start });
            }
        } else {
            throw new ExpressionError(`Unexpected character '${ch}'`, input, pos);
        }
    }

    tokens.push({ type: TokenType.EOF, value: '', position: pos });
    return tokens;
}
