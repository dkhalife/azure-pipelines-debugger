import { DebugProtocol } from '@vscode/debugprotocol';

export interface ILaunchRequestArguments extends DebugProtocol.LaunchRequestArguments {
	/** An absolute path to the pipeline to debug. */
	pipeline: string;
	/** Automatically stop target after launch. Defaults to false. */
	stopOnEntry?: boolean
}

export interface IAttachRequestArguments extends ILaunchRequestArguments { }
