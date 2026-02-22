// Token types for the Azure Pipelines template expression lexer
export enum TokenType {
    Identifier = 'Identifier',
    Dot = 'Dot',
    LParen = 'LParen',
    RParen = 'RParen',
    LBracket = 'LBracket',
    RBracket = 'RBracket',
    Comma = 'Comma',
    StringLiteral = 'StringLiteral',
    NumberLiteral = 'NumberLiteral',
    BooleanLiteral = 'BooleanLiteral',
    NullLiteral = 'NullLiteral',
    Operator = 'Operator',       // ==, !=, >=, <=, >, <
    EOF = 'EOF',
}

export interface Token {
    type: TokenType;
    value: string;
    position: number;
}

// AST node types
export type AstNode =
    | PropertyAccessNode
    | FunctionCallNode
    | BinaryExpressionNode
    | LiteralNode
    | IndexAccessNode;

export interface PropertyAccessNode {
    kind: 'PropertyAccess';
    segments: string[];           // e.g. ['parameters', 'environment']
    source: string;               // original text, e.g. "parameters.environment"
}

export interface FunctionCallNode {
    kind: 'FunctionCall';
    name: string;                 // e.g. "eq", "contains"
    args: AstNode[];
}

export interface BinaryExpressionNode {
    kind: 'BinaryExpression';
    operator: string;             // ==, !=, >=, <=, >, <
    left: AstNode;
    right: AstNode;
}

export interface LiteralNode {
    kind: 'Literal';
    value: string | number | boolean | null;
    literalType: 'string' | 'number' | 'boolean' | 'null';
}

export interface IndexAccessNode {
    kind: 'IndexAccess';
    object: AstNode;
    index: AstNode;
}

// Evaluation context — provides the data that expressions resolve against
export interface EvaluationContext {
    parameters: Record<string, any>;
    variables: Record<string, any>;
}

// Result of evaluating an expression
export interface ExpressionResult {
    value: any;
    type: string;                 // 'string', 'number', 'boolean', 'object', 'null'
    sourceExpression: string;     // the original expression text
}

// Error during expression evaluation
export class ExpressionError extends Error {
    constructor(
        message: string,
        public readonly expression: string,
        public readonly position?: number,
    ) {
        super(message);
        this.name = 'ExpressionError';
    }
}
