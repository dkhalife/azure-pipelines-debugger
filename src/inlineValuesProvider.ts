'use strict';

import * as vscode from 'vscode';

const EXPRESSION_RE = /\$\{\{(.+?)\}\}/g;
const CONTROL_FLOW_RE = /^\s*(if|elseif|else|each)\b/;

const inlineDecorationType = vscode.window.createTextEditorDecorationType({
    after: {
        color: new vscode.ThemeColor('editorInlayHint.foreground'),
        backgroundColor: new vscode.ThemeColor('editorInlayHint.background'),
        margin: '0 0 0 8px',
        fontStyle: 'italic',
    },
});

function isCommentLine(text: string): boolean {
    return text.trimStart().startsWith('#');
}

function isInComment(text: string, index: number): boolean {
    const commentIdx = text.indexOf('#');
    return commentIdx >= 0 && index > commentIdx;
}

async function updateDecorations(editor: vscode.TextEditor, session: vscode.DebugSession) {
    const document = editor.document;
    const decorations: vscode.DecorationOptions[] = [];

    for (let lineNum = 0; lineNum < document.lineCount; lineNum++) {
        const line = document.lineAt(lineNum);

        if (isCommentLine(line.text)) {
            continue;
        }

        let match: RegExpExecArray | null;
        EXPRESSION_RE.lastIndex = 0;

        while ((match = EXPRESSION_RE.exec(line.text)) !== null) {
            if (isInComment(line.text, match.index)) {
                continue;
            }

            // Skip control flow expressions — they are not value expressions
            const inner = match[1];
            if (CONTROL_FLOW_RE.test(inner)) {
                continue;
            }

            try {
                const result = await session.customRequest('evaluate', {
                    expression: match[0],
                    context: 'hover',
                });

                if (result && result.result) {
                    const range = new vscode.Range(lineNum, match.index, lineNum, match.index + match[0].length);
                    decorations.push({
                        range,
                        renderOptions: {
                            after: { contentText: ` = ${result.result}` },
                        },
                    });
                }
            } catch {
                // Expression failed to evaluate — skip decoration
            }
        }
    }

    editor.setDecorations(inlineDecorationType, decorations);
}

function clearDecorations(editor: vscode.TextEditor) {
    editor.setDecorations(inlineDecorationType, []);
}

export function registerInlineValuesProvider(context: vscode.ExtensionContext) {
    // Update decorations when the debugger stops
    context.subscriptions.push(
        vscode.debug.registerDebugAdapterTrackerFactory('azurepipelines', {
            createDebugAdapterTracker(session) {
                return {
                    onDidSendMessage(message: any) {
                        if (message.type === 'event' && message.event === 'stopped') {
                            const editor = vscode.window.activeTextEditor;
                            if (editor) {
                                // Small delay to let the debug session fully settle
                                setTimeout(() => updateDecorations(editor, session), 100);
                            }
                        }
                        if (message.type === 'event' && (message.event === 'continued' || message.event === 'terminated')) {
                            const editor = vscode.window.activeTextEditor;
                            if (editor) {
                                clearDecorations(editor);
                            }
                        }
                    },
                };
            },
        }),
    );

    // Update when the active editor changes during debugging
    context.subscriptions.push(
        vscode.window.onDidChangeActiveTextEditor(editor => {
            if (editor && vscode.debug.activeDebugSession) {
                updateDecorations(editor, vscode.debug.activeDebugSession);
            }
        }),
    );

    // Clear decorations when debug session ends
    context.subscriptions.push(
        vscode.debug.onDidTerminateDebugSession(() => {
            const editor = vscode.window.activeTextEditor;
            if (editor) {
                clearDecorations(editor);
            }
        }),
    );
}
