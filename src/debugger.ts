'use strict';

import { FileAccessor } from "./fileUtils";
import { EventEmitter } from 'events';
import { DocumentManager } from "./documentManager";
import { asyncVisitor, visitAsync } from "yaml";
import { Subject } from 'await-notify';
import { Scope, StackFrame, Thread } from "@vscode/debugadapter";

export type ExceptionBreakMode = 'never' | 'always' | 'unhandled' | 'userUnhandled';

export 	interface ExceptionDetails {
	/** Message contained in the exception. */
	message?: string;
	/** Short type name of the exception object. */
	typeName?: string;
	/** Fully-qualified type name of the exception object. */
	fullTypeName?: string;
	/** An expression that can be evaluated in the current scope to obtain the exception object. */
	evaluateName?: string;
	/** Stack trace at the time the exception was thrown. */
	stackTrace?: string;
	/** Details of the exception contained by this exception, if any. */
	innerException?: ExceptionDetails[];
};

export type ExceptionInfo = {
	/** ID of the exception that was thrown. */
	exceptionId: string;
	/** Descriptive text for the exception. */
	description?: string;
	/** Mode that caused the exception notification to be raised. */
	breakMode: ExceptionBreakMode;
	/** Detailed information about the exception. */
	details?: ExceptionDetails;
};

export class Debugger extends EventEmitter {
	private documentManager: DocumentManager;
	private execution = new Subject();

	constructor(fileAccessor: FileAccessor) {
		super();

		this.documentManager = new DocumentManager(fileAccessor);
	}

	public async start(entry: string): Promise<void> {
		const doc = await this.documentManager.getDoc(entry);

		const DocumentVisitor: asyncVisitor = {
			Pair: async (key, value, path): Promise<symbol | void> => {
			}
		};

		visitAsync(doc, DocumentVisitor);
	}

	public resume() {
		this.execution.notify();
	}

	public stepOver() {
	}

	public stepInto() {
	}

	public stepOut() {
	}

	public getThreads(): Thread[] {
		return [];
	}

	public getStackTrace(): StackFrame[] {
		return [];
	}

	public getScopes(): Scope[] {
		return [];
	}

	public getExceptionInfo(): ExceptionInfo {
		return {
			breakMode: "always",
			exceptionId: "1",
			description: "",
		};
	}
}
