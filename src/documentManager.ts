import { Document } from "yaml";
import { FileLoader } from "./fileLoader";
import { FileAccessor } from "./fileUtils";

export class DocumentManager {
	private fileLoader: FileLoader;
	private documents: Map<string, Document> = new Map();

	constructor(fileAccessor: FileAccessor) {
		this.fileLoader = new FileLoader(fileAccessor);
	}

	public async getDoc(file: string): Promise<Document> {
		if (this.documents.has(file)) {
			return this.documents.get(file) as Document;
		}

		const doc = await this.fileLoader.load(file);
		this.documents.set(file, doc);
		return doc;
	}
}