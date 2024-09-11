'use strict';

import * as vscode from 'vscode';
import { WorkspaceFolder, DebugConfiguration, ProviderResult, CancellationToken } from 'vscode';

class ConfigurationProvider implements vscode.DebugConfigurationProvider {
	resolveDebugConfiguration(folder: WorkspaceFolder | undefined, config: DebugConfiguration, token?: CancellationToken): ProviderResult<DebugConfiguration> {
		// if launch.json is missing or empty
		if (!config.type && !config.request && !config.name) {
			const editor = vscode.window.activeTextEditor;
			if (editor && editor.document.languageId === 'azure-pipelines') {
				config.type = 'azurepipelines';
				config.name = 'Azure Pipelines: Debug current file';
				config.request = 'launch';
				config.pipeline = '${file}';
			}
		}

		if (!config.pipeline) {
			return vscode.window.showInformationMessage("Cannot find a pipeline to debug").then(_ => {
				return undefined;	// abort launch
			});
		}

		return config;
	}
}

export function registerConfigurationProviders(context: vscode.ExtensionContext) {
	// register a configuration provider for 'azurepipelines' debug type
	const provider = new ConfigurationProvider();
	context.subscriptions.push(vscode.debug.registerDebugConfigurationProvider('azurepipelines', provider));

	// register a dynamic configuration provider for 'azurepipelines' debug type
	context.subscriptions.push(vscode.debug.registerDebugConfigurationProvider('azurepipelines', {
		provideDebugConfigurations(folder: WorkspaceFolder | undefined): ProviderResult<DebugConfiguration[]> {
			return [
				{
					name: "Azure Pipelines: Debug current file",
					request: "launch",
					type: "azurepipelines",
					pipeline: "${file}"
				},
			];
		}
	}, vscode.DebugConfigurationProviderTriggerKind.Dynamic));
}
