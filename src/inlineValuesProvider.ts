'use strict';

import * as vscode from 'vscode';

export class PipelineInlineValuesProvider implements vscode.InlineValuesProvider {
    onDidChangeInlineValues?: vscode.Event<void>;

    provideInlineValues(
        document: vscode.TextDocument,
        viewPort: vscode.Range,
        context: vscode.InlineValueContext,
    ): vscode.ProviderResult<vscode.InlineValue[]> {
        const result: vscode.InlineValue[] = [];
        const expressionRe = /\$\{\{(.+?)\}\}/g;

        for (let lineNum = viewPort.start.line; lineNum <= viewPort.end.line; lineNum++) {
            const line = document.lineAt(lineNum);
            let match: RegExpExecArray | null;

            while ((match = expressionRe.exec(line.text)) !== null) {
                const startCol = match.index;
                const endCol = match.index + match[0].length;
                const range = new vscode.Range(lineNum, startCol, lineNum, endCol);
                // Use EvaluatableExpression so the debug adapter's evaluateRequest resolves it
                result.push(new vscode.InlineValueEvaluatableExpression(range, match[0]));
            }
        }

        return result;
    }
}

export function registerInlineValuesProvider(context: vscode.ExtensionContext) {
    context.subscriptions.push(
        vscode.languages.registerInlineValuesProvider(
            { language: 'azure-pipelines' },
            new PipelineInlineValuesProvider(),
        )
    );
}
