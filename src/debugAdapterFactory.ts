'use strict';

import * as vscode from 'vscode';
import { DebugSession } from "./debugSession";
import { workspaceFileAccessor } from './fileUtils';

export class InlineDebugAdapterFactory implements vscode.DebugAdapterDescriptorFactory {
	createDebugAdapterDescriptor(_session: vscode.DebugSession): vscode.ProviderResult<vscode.DebugAdapterDescriptor> {
		return new vscode.DebugAdapterInlineImplementation(new DebugSession(workspaceFileAccessor));
	}
}
