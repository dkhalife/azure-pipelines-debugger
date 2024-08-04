'use strict';

import * as vscode from 'vscode';
import { InlineDebugAdapterFactory } from './debugAdapterFactory';
import { registerConfigurationProviders } from './configurationProvider';

function registerDebugAdapterFactory(context: vscode.ExtensionContext) {
	const factory: vscode.DebugAdapterDescriptorFactory = new InlineDebugAdapterFactory();
	context.subscriptions.push(vscode.debug.registerDebugAdapterDescriptorFactory('azurepipelines', factory));
	if ('dispose' in factory) {
		context.subscriptions.push(factory as any);
	}
}

export function activate(context: vscode.ExtensionContext) {
	registerConfigurationProviders(context);
	registerDebugAdapterFactory(context);
}

export function deactivate() {
	// nothing to do
}
