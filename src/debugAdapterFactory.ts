'use strict';

import * as vscode from 'vscode';
import { DebugSession } from "./debugSession";
import { workspaceFileAccessor } from './fileUtils';

class InlineDebugAdapterFactory implements vscode.DebugAdapterDescriptorFactory {
	createDebugAdapterDescriptor(_session: vscode.DebugSession): vscode.ProviderResult<vscode.DebugAdapterDescriptor> {
		return new vscode.DebugAdapterInlineImplementation(new DebugSession(workspaceFileAccessor));
	}
}

export function registerDebugAdapterFactory(context: vscode.ExtensionContext) {
	const factory: vscode.DebugAdapterDescriptorFactory = new InlineDebugAdapterFactory();
	context.subscriptions.push(vscode.debug.registerDebugAdapterDescriptorFactory('azurepipelines', factory));
	if ('dispose' in factory) {
		context.subscriptions.push(factory as any);
	}
}
