import { DecoratedDocument, FileLoader } from "./fileLoader";
import { FileAccessor } from "./fileUtils";
import { BreakpointManager } from "./breakpointManager";

export class DocumentManager {
	private fileLoader: FileLoader;
	private documents: Map<string, DecoratedDocument> = new Map();

	constructor(fileAccessor: FileAccessor, private breakpointManager: BreakpointManager) {
		this.fileLoader = new FileLoader(fileAccessor, this.breakpointManager);
	}

	public async getDoc(file: string): Promise<DecoratedDocument> {
		if (this.documents.has(file)) {
			return this.documents.get(file) as DecoratedDocument;
		}

		const doc = await this.fileLoader.load(file);
		this.documents.set(file, doc);
		return doc;
	}
}