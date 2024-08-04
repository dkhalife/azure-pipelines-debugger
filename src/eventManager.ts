import { ContinuedEvent, LoggingDebugSession, StoppedEvent, TerminatedEvent } from "@vscode/debugadapter";
import { Debugger } from "./debugger";

export const registerEvents = (session: LoggingDebugSession, runtime: Debugger) => {
    runtime.on("stop", () => {
        session.sendEvent(new TerminatedEvent());
    });

    runtime.on("continue", (threadId: number) => {
        session.sendEvent(new ContinuedEvent(threadId, true));
    });

    runtime.on("stopOnStep", (threadId: number) => {
        session.sendEvent(new StoppedEvent('step', threadId));
    });
};
