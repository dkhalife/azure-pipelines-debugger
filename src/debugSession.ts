'use strict';

import {
	Logger, logger,
	LoggingDebugSession,
	InitializedEvent} from '@vscode/debugadapter';
import { DebugProtocol } from '@vscode/debugprotocol';
import { FileAccessor } from './fileUtils';
import { IAttachRequestArguments, ILaunchRequestArguments } from './debugProtocol';
import { Subject } from 'await-notify';
import { Debugger } from './debugger';
import { registerEvents } from './eventManager';

export class DebugSession extends LoggingDebugSession {
	private _configurationDone = new Subject();
    private debugger: Debugger;

	public constructor(fileAccessor: FileAccessor) {
		super("azure-pipelines.txt");

        this.setDebuggerLinesStartAt1(true);
		this.setDebuggerColumnsStartAt1(true);

        this.debugger = new Debugger(fileAccessor);
		registerEvents(this, this.debugger);
	}

	protected initializeRequest(response: DebugProtocol.InitializeResponse, args: DebugProtocol.InitializeRequestArguments): void {
		response.body = response.body || {};

		response.body.supportsConfigurationDoneRequest = true;
		response.body.supportsEvaluateForHovers = false;
		response.body.supportsStepBack = false;
		response.body.supportsDataBreakpoints = false;
		response.body.supportsCompletionsRequest = false;
		response.body.completionTriggerCharacters = [];
		response.body.supportsCancelRequest = true;
		response.body.supportsBreakpointLocationsRequest = false;
		response.body.supportsStepInTargetsRequest = false;
		response.body.supportsExceptionFilterOptions = false;
		response.body.exceptionBreakpointFilters = [];
		response.body.supportsExceptionInfoRequest = false;
		response.body.supportsSetVariable = false;
    	response.body.supportsSetExpression = false;
		response.body.supportsDisassembleRequest = false;
		response.body.supportsSteppingGranularity = false;
		response.body.supportsInstructionBreakpoints = false;
		response.body.supportsReadMemoryRequest = false;
		response.body.supportsWriteMemoryRequest = false;
		response.body.supportSuspendDebuggee = false;
		response.body.supportTerminateDebuggee = false;
		response.body.supportsFunctionBreakpoints = false;
		response.body.supportsDelayedStackTraceLoading = true;

		this.sendResponse(response);
		this.sendEvent(new InitializedEvent());
	}

	/**
	 * Called at the end of the configuration sequence.
	 * Indicates that all breakpoints etc. have been sent to the DA and that the 'launch' can start.
	 */
	protected configurationDoneRequest(response: DebugProtocol.ConfigurationDoneResponse, args: DebugProtocol.ConfigurationDoneArguments): void {
		super.configurationDoneRequest(response, args);

		// notify the launchRequest that configuration has finished
		this._configurationDone.notify();
	}

	protected async attachRequest(response: DebugProtocol.AttachResponse, args: IAttachRequestArguments) {
		return this.launchRequest(response, args);
	}

	protected async launchRequest(response: DebugProtocol.LaunchResponse, args: ILaunchRequestArguments) {
		logger.setup(Logger.LogLevel.Stop, false);

		// wait 1 second until configuration has finished (and configurationDoneRequest has been called)
		await this._configurationDone.wait(1000);
        await this.debugger.start(args.entry);

        this.sendResponse(response);
	}

	protected async setBreakPointsRequest(response: DebugProtocol.SetBreakpointsResponse, args: DebugProtocol.SetBreakpointsArguments): Promise<void> {
		response.body = {
			breakpoints: this.debugger.setBreakpoints(args)
		};
		this.sendResponse(response);
	}

	protected continueRequest(response: DebugProtocol.ContinueResponse, args: DebugProtocol.ContinueArguments): void {
		this.debugger.resume();
		this.sendResponse(response);
	}

	protected nextRequest(response: DebugProtocol.NextResponse, args: DebugProtocol.NextArguments): void {
		this.debugger.stepOver();
		this.sendResponse(response);
	}

	protected stepInRequest(response: DebugProtocol.StepInResponse, args: DebugProtocol.StepInArguments): void {
		this.debugger.stepInto();
		this.sendResponse(response);
	}

	protected stepOutRequest(response: DebugProtocol.StepOutResponse, args: DebugProtocol.StepOutArguments): void {
		this.debugger.stepOut();
		this.sendResponse(response);
	}

	protected threadsRequest(response: DebugProtocol.ThreadsResponse): void {
		response.body = response.body || {};
		response.body.threads = this.debugger.getThreads();

		this.sendResponse(response);
	}

	protected stackTraceRequest(response: DebugProtocol.StackTraceResponse, args: DebugProtocol.StackTraceArguments): void {
		const frames = this.debugger.getStackTrace(args.startFrame, args.levels);

		response.body = response.body || {};
		response.body.stackFrames = frames;
		response.body.totalFrames = frames.length;

		this.sendResponse(response);
	}

	protected scopesRequest(response: DebugProtocol.ScopesResponse, args: DebugProtocol.ScopesArguments): void {
		response.body = response.body || {};
		response.body.scopes = this.debugger.getScopes();

		this.sendResponse(response);
	}

	protected exceptionInfoRequest(response: DebugProtocol.ExceptionInfoResponse, args: DebugProtocol.ExceptionInfoArguments) {
		response.body = this.debugger.getExceptionInfo();

		this.sendResponse(response);
	}
}
