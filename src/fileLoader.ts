import { Document, parseDocument } from "yaml";
import { FileAccessor } from "./fileUtils";

export class FileLoader {
    constructor(private fileAccessor: FileAccessor) {
	}

	public async load(file: string): Promise<Document> {
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
		return parseDocument(new TextDecoder().decode(memory));
	}
}