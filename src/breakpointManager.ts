import { Document, LineCounter, Pair, visit, visitor } from "yaml";
import { DecoratedDocument } from "./fileLoader";
import { Breakpoint, Source } from "@vscode/debugadapter";
import { basename } from "path";

export class BreakpointManager {
    private reachableLines: Map<string, Set<number>> = new Map();
    private breakpoints: Map<string, Set<number>> = new Map();

    private getReachableLines = (doc: Document, lineCounter: LineCounter): Set<number> => {
        const validLines = new Set<number>();
    
        // Whether we can reach that line through a Pair visitor determines whether it will hit
        // That should take care of comment lines and whitespace
        const visitor: visitor = {
            Pair: (_, value: Pair) => {
                const position = lineCounter.linePos((value.key as any).range[0]);
                if (!validLines.has(position.line)) {
                    validLines.add(position.line);
                }
            }
        };
        visit(doc, visitor);
    
        return validLines;
    };

    public initializeDocument = (doc: DecoratedDocument) => {
        if (this.reachableLines.has(doc.source)) {
            return;
        }

        this.reachableLines.set(doc.source, this.getReachableLines(doc.document, doc.lineCounter));
    };

    public setBreakpoints = async (doc: DecoratedDocument, clientLines: number[]) => {
		const breakpointLines = new Set<number>();

		const validatedBreakpoints = clientLines.map(line => {
			const isValid = this.reachableLines.get(doc.source)?.has(line);
			const source = new Source(basename(doc.source), doc.source);
			const bp = new Breakpoint(!!isValid, line, 1, source);

			if (isValid && !breakpointLines.has(line)) {
				breakpointLines.add(line);
			}

			return bp;
		});

		this.breakpoints.set(doc.source, breakpointLines);
		return validatedBreakpoints;
    };

    public shouldBreak = (doc: DecoratedDocument, line: number) => {
        if (!this.breakpoints.has(doc.source)) {
            return false;
        }

        return this.breakpoints.get(doc.source)?.has(line);
    };
}
