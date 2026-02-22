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
            const trimmed = line.text.trimStart();

            // Skip comment lines — they are not evaluated by the pipeline
            if (trimmed.startsWith('#')) {
                continue;
            }

            let match: RegExpExecArray | null;

            while ((match = expressionRe.exec(line.text)) !== null) {
                // Skip matches that fall inside a trailing comment
                const commentIdx = line.text.indexOf('#');
                if (commentIdx >= 0 && match.index > commentIdx) {
                    continue;
                }

                const startCol = match.index;
                const endCol = match.index + match[0].length;
                const range = new vscode.Range(lineNum, startCol, lineNum, endCol);
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
