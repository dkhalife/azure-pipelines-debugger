'use strict';

import * as vscode from 'vscode';
import { registerDebugAdapterFactory } from './debugAdapterFactory';
import { registerConfigurationProviders } from './configurationProvider';

export function activate(context: vscode.ExtensionContext) {
	registerConfigurationProviders(context);
	registerDebugAdapterFactory(context);
}

export function deactivate() {
	// nothing to do
}
