'use strict';

import { FileAccessor } from "./fileUtils";
import { EventEmitter } from 'events';
import { DocumentManager } from "./documentManager";

export class Debugger extends EventEmitter {
	private documentManager: DocumentManager;

	constructor(fileAccessor: FileAccessor) {
		super();

		this.documentManager = new DocumentManager(fileAccessor);
	}

	public async start(entry: string): Promise<void> {
		const doc = await this.documentManager.getDoc(entry);
	}
}