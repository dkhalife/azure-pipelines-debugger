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
				config.name = 'Launch';
				config.request = 'launch';
				config.entry = '${file}';
			}
		}

		if (!config.entry) {
			return vscode.window.showInformationMessage("Cannot find an entry to debug").then(_ => {
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
					name: "Dynamic Launch",
					request: "launch",
					type: "azurepipelines",
					program: "${file}"
				},
				{
					name: "Another Dynamic Launch",
					request: "launch",
					type: "azurepipelines",
					program: "${file}"
				},
				{
					name: "Mock Launch",
					request: "launch",
					type: "azurepipelines",
					program: "${file}"
				}
			];
		}
	}, vscode.DebugConfigurationProviderTriggerKind.Dynamic));
}
