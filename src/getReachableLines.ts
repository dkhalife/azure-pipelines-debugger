import { Document, LineCounter, Pair, visit, visitor } from "yaml";

export const getReachableLines = (doc: Document, lineCounter: LineCounter): Set<number> => {
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