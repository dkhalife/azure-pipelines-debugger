'use strict';

import {
	Logger, logger,
	LoggingDebugSession,
	InitializedEvent,
    StoppedEvent,
    Scope,
    Thread,
    Handles
	
	} from '@vscode/debugadapter';
import { DebugProtocol } from '@vscode/debugprotocol';
import { FileAccessor } from './fileUtils';
import { IAttachRequestArguments, ILaunchRequestArguments } from './debugProtocol';
import { Subject } from 'await-notify';
import { Debugger } from './debugger';

export class DebugSession extends LoggingDebugSession {
	private _variableHandles = new Handles<'locals' | 'globals'>();
	private _configurationDone = new Subject();
    private debugger: Debugger;

	/**
	 * Creates a new debug adapter that is used for one debug session.
	 * We configure the default implementation of a debug adapter here.
	 */
	public constructor(fileAccessor: FileAccessor) {
		super("azure-pipelines.txt");

        this.setDebuggerLinesStartAt1(true);
		this.setDebuggerColumnsStartAt1(true);

        this.debugger = new Debugger(fileAccessor);
		this.debugger.on('stopOnBreakpoint', () => {
			this.sendEvent(new StoppedEvent('breakpoint', 1));
		});
	}

	/**
	 * The 'initialize' request is the first request called by the frontend
	 * to interrogate the features the debug adapter provides.
	 */
	protected initializeRequest(response: DebugProtocol.InitializeResponse, args: DebugProtocol.InitializeRequestArguments): void {
		// build and return the capabilities of this debug adapter:
		response.body = response.body || {};

		// the adapter implements the configurationDone request.
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
		response.body.supportSuspendDebuggee = true;
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

	protected disconnectRequest(response: DebugProtocol.DisconnectResponse, args: DebugProtocol.DisconnectArguments, request?: DebugProtocol.Request): void {
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

	protected continueRequest(response: DebugProtocol.ContinueResponse, args: DebugProtocol.ContinueArguments): void {
		this.sendResponse(response);
	}

	protected nextRequest(response: DebugProtocol.NextResponse, args: DebugProtocol.NextArguments): void {
		this.sendResponse(response);
	}

	protected stepInRequest(response: DebugProtocol.StepInResponse, args: DebugProtocol.StepInArguments): void {
		this.sendResponse(response);
	}

	protected stepOutRequest(response: DebugProtocol.StepOutResponse, args: DebugProtocol.StepOutArguments): void {
		this.sendResponse(response);
	}

	protected threadsRequest(response: DebugProtocol.ThreadsResponse): void {

		// runtime supports no threads so just return a default thread.
		response.body = {
			threads: [
				new Thread(1, "thread 1"),
				new Thread(2, "thread 2"),
			]
		};
		this.sendResponse(response);
	}

	protected stackTraceRequest(response: DebugProtocol.StackTraceResponse, args: DebugProtocol.StackTraceArguments): void {
		response.body = {
			stackFrames: [{
                id: 1,
                /** The name of the stack frame, typically a method name. */
                name: "frame name",
                /** The source of the frame. */
                //source?: Source;
                /** The line within the source of the frame. If the source attribute is missing or doesn't exist, `line` is 0 and should be ignored by the client. */
                line: 10,
                /** Start position of the range covered by the stack frame. It is measured in UTF-16 code units and the client capability `columnsStartAt1` determines whether it is 0- or 1-based. If attribute `source` is missing or doesn't exist, `column` is 0 and should be ignored by the client. */
                column: 0,
                /** The end line of the range covered by the stack frame. */
                // endLine?: number;
                /** End position of the range covered by the stack frame. It is measured in UTF-16 code units and the client capability `columnsStartAt1` determines whether it is 0- or 1-based. */
                // endColumn?: number;
                /** A memory reference for the current instruction pointer in this frame. */
                // instructionPointerReference?: string;
                /** The module associated with this frame, if any. */
                // moduleId?: number | string;
                /** A hint for how to present this frame in the UI.
                    A value of `label` can be used to indicate that the frame is an artificial frame that is used as a visual label or separator. A value of `subtle` can be used to change the appearance of a frame in a 'subtle' way.
                */
                presentationHint: 'normal'
            }],
			totalFrames: 1			// stk.count is the correct size, should result in a max. of two requests
		};
		this.sendResponse(response);
	}

	protected scopesRequest(response: DebugProtocol.ScopesResponse, args: DebugProtocol.ScopesArguments): void {

		response.body = {
			scopes: [
				new Scope("Locals", this._variableHandles.create('locals'), false),
				new Scope("Globals", this._variableHandles.create('globals'), true)
			]
		};
		this.sendResponse(response);
	}
}
