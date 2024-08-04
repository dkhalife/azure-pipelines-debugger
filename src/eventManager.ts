import { LoggingDebugSession, StoppedEvent } from "@vscode/debugadapter";
import { Debugger } from "./debugger";

export class EventManager {
    constructor(session: LoggingDebugSession, runtime: Debugger) {
        runtime.on("stopOnStep", () => {
            session.sendEvent(new StoppedEvent('step', 1));
        });
    }
}
