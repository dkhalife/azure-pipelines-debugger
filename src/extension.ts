'use strict';

import * as vscode from 'vscode';
import { registerDebugAdapterFactory } from './debugAdapterFactory';
import { registerConfigurationProviders } from './configurationProvider';
import { registerInlineValuesProvider } from './inlineValuesProvider';

export function activate(context: vscode.ExtensionContext) {
	registerConfigurationProviders(context);
	registerDebugAdapterFactory(context);
	registerInlineValuesProvider(context);
}

export function deactivate() {
	// nothing to do
}
