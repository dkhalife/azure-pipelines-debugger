import { DebugProtocol } from '@vscode/debugprotocol';

export interface ILaunchRequestArguments extends DebugProtocol.LaunchRequestArguments {
	/** An absolute path to the "program" to debug. */
	entry: string;
}

export interface IAttachRequestArguments extends ILaunchRequestArguments { }
