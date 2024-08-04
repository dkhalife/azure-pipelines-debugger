import { DebugProtocol } from '@vscode/debugprotocol';

export interface ILaunchRequestArguments extends DebugProtocol.LaunchRequestArguments {
	/** An absolute path to the pipeline to debug. */
	pipeline: string;
}

export interface IAttachRequestArguments extends ILaunchRequestArguments { }
