import { ContinuedEvent, LoggingDebugSession, StoppedEvent, TerminatedEvent } from "@vscode/debugadapter";
import { Debugger } from "./debugger";

export class EventManager {
    constructor(session: LoggingDebugSession, runtime: Debugger) {
        runtime.on("stop", () => {
            session.sendEvent(new TerminatedEvent());
        });

        runtime.on("continue", () => {
            session.sendEvent(new ContinuedEvent(1, true));
        });

        runtime.on("stopOnStep", () => {
            session.sendEvent(new StoppedEvent('step', 1));
        });
    }
}
