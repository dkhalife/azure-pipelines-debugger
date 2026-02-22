# Copilot Instructions

## Build & Lint

```sh
yarn install          # install dependencies
yarn run compile      # build (tsc → out/)
yarn run lint         # eslint src/**/*.ts
yarn run test         # VS Code integration tests (requires VS Code host)
```

There are no unit-test-level test commands; the only test suite runs inside VS Code via `@vscode/test-cli` + `@vscode/test-electron`.

## Architecture

This is a **VS Code Debug Adapter** extension for Azure Pipelines YAML files. It lets users set breakpoints in pipeline YAML and step through template expansions.

### Activation & wiring

`extension.ts` registers two things on activation:
1. **ConfigurationProvider** — resolves debug launch configs for the `azurepipelines` debug type.
2. **InlineDebugAdapterFactory** — creates a `DebugSession` (runs in-process, not as a separate DAP server).

### Debug session flow

`DebugSession` (extends `LoggingDebugSession`) owns a `Debugger` instance. The session translates DAP requests (launch, setBreakpoints, continue, stepIn, etc.) into calls on `Debugger`.

### Core debugger loop

`Debugger` orchestrates execution by:
1. Loading YAML documents via `DocumentManager` → `FileLoader` (parses with the `yaml` library).
2. Walking the parsed AST with `DocumentTraverser.traverse()` using `yaml`'s `visitAsync`.
3. At each YAML `Pair` node, the traverser fires callbacks (`onStep`, `onTemplate`, `onFileSystemError`, `onYamlParsingError`).
4. `onStep` checks breakpoints / step mode and suspends execution via `await-notify` `Subject` until the user resumes.
5. `onTemplate` recursively calls `Debugger.newDocument()` for referenced template files, pushing a new `ExecutionContext` onto the stack.

### Key data structures

- **`ExecutionContext`** — tracks the current execution pointer, parameter/variable/template-expression reference IDs. Managed as a stack by `ExecutionContextManager` to support nested template calls.
- **`Expression`** — extends `Variable`; stored in a global `expressionStore` array indexed by `variablesReference` ID. Used to represent parameters, variables, and template expressions in the debugger's Variables pane.
- **`DecoratedDocument`** — bundles the parsed `yaml.Document`, its source path, and a `LineCounter` for mapping AST offsets to line/column positions.

### Event system

`Debugger` extends `EventEmitter`. `eventManager.ts` wires debugger events (`stopOnEntry`, `stopOnStep`, `stopOnBreakpoint`, `stopOnError`, `stop`, `continue`) to DAP protocol events (`StoppedEvent`, `ContinuedEvent`, `TerminatedEvent`).

## Conventions

- The extension uses **yarn** (with a `.yarnrc`); do not use npm.
- TypeScript strict mode is enabled but `noImplicitAny` is off.
- `'use strict';` is used at the top of modules that interact with VS Code APIs.
- The `FileAccessor` interface abstracts file I/O to allow future non-VS-Code hosts; `workspaceFileAccessor` is the VS Code implementation.
