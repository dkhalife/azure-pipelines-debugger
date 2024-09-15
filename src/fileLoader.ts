import { Document, LineCounter, parseDocument } from "yaml";
import { FileAccessor } from "./fileUtils";
import { BreakpointManager } from "./breakpointManager";

export type DecoratedDocument = {
	source: string
	document: Document
	lineCounter: LineCounter
};

export class FileLoader {
    constructor(private fileAccessor: FileAccessor, private breakpointManager: BreakpointManager) {
	}

	public async load(file: string): Promise<DecoratedDocument> {
		file = this.normalizePathAndCasing(file);
		return this.initialize(file, await this.fileAccessor.readFile(file));
	}

	private normalizePathAndCasing(path: string) {
		if (this.fileAccessor.isWindows) {
			return path.replace(/\//g, '\\').toLowerCase();
		} else {
			return path.replace(/\\/g, '/');
		}
	}

	private initialize(source: string, contents: Uint8Array) {
		const lineCounter = new LineCounter();
		const document = parseDocument(new TextDecoder().decode(contents), {
			lineCounter
		});

		const doc = {
			source,
			document,
			lineCounter
		};

		this.breakpointManager.initializeDocument(doc);
		return doc;
	}
}