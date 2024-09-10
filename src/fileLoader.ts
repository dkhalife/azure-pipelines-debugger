import { Document, LineCounter, parseDocument } from "yaml";
import { FileAccessor } from "./fileUtils";

export type DecoratedDocument = {
	document: Document
	lineCounter: LineCounter
};

export class FileLoader {
    constructor(private fileAccessor: FileAccessor) {
	}

	public async load(file: string): Promise<DecoratedDocument> {
		file = this.normalizePathAndCasing(file);
		return this.initializeContents(await this.fileAccessor.readFile(file));
	}

	private normalizePathAndCasing(path: string) {
		if (this.fileAccessor.isWindows) {
			return path.replace(/\//g, '\\').toLowerCase();
		} else {
			return path.replace(/\\/g, '/');
		}
	}

	private initializeContents(memory: Uint8Array) {
		const lineCounter = new LineCounter();
		return {
			document: parseDocument(new TextDecoder().decode(memory), {
				lineCounter
			}),
			lineCounter
		};
	}
}