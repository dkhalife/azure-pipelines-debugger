'use strict';

import { FileAccessor } from "./fileUtils";
import { EventEmitter } from 'events';

export class Debugger extends EventEmitter {
	constructor(private fileAccessor: FileAccessor) {
		super();
	}

	public async start(entry: string): Promise<void> {
		this.emit("stopOnBreakpoint");
	}
}