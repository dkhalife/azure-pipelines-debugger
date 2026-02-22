# Copilot Instructions

## Build, Lint & Test

```sh
yarn install            # install dependencies
yarn run compile        # build (tsc → out/)
yarn run lint           # eslint src/**/*.ts
yarn run test:unit      # expression engine unit tests (mocha, no VS Code host)
yarn run test           # VS Code integration tests (requires VS Code host)
```

The `test:unit` script runs standalone mocha tests under `out/test/expressionEngine/` with `--ui tdd`. The `test` script runs the full VS Code integration suite via `@vscode/test-cli` + `@vscode/test-electron`.

## Architecture

This is a **VS Code Debug Adapter** extension for Azure Pipelines YAML files. It lets users set breakpoints in pipeline YAML and step through template expansions, including `${{ if/elseif/else }}` conditionals, `${{ each }}` loops, and `extends:` templates.

### Activation & wiring

`extension.ts` registers three things on activation:
1. **ConfigurationProvider** — resolves debug launch configs for the `azurepipelines` debug type.
2. **InlineDebugAdapterFactory** — creates a `DebugSession` (runs in-process, not as a separate DAP server).
3. **InlineValuesProvider** — shows resolved `${{ }}` expression values as editor decorations during debugging.

### Debug session flow

`DebugSession` (extends `LoggingDebugSession`) owns a `Debugger` instance. The session translates DAP requests into calls on `Debugger`.

Supported DAP requests: `launch`, `attach`, `setBreakpoints` (with conditions), `continue`, `next` (stepOver), `stepIn`, `stepOut`, `stackTrace`, `scopes`, `variables`, `threads`, `evaluate` (watch + hover), `restart`, `exceptionInfo`.

### Core debugger loop

`Debugger` orchestrates execution by:
1. Loading YAML documents via `DocumentManager` → `FileLoader` (parses with the `yaml` library).
2. Walking the parsed AST with `DocumentTraverser.traverse()` using `yaml`'s `visitAsync`.
3. At each YAML `Pair` node, the traverser fires callbacks (`onStep`, `onTemplate`, `onConditionalEvaluated`, `onEachIteration`, `onFileSystemError`, `onYamlParsingError`).
4. `onStep` checks breakpoints (including conditional breakpoints) / step mode / stepOut depth and suspends execution via `await-notify` `Subject` until the user resumes.
5. `onTemplate` recursively calls `Debugger.newDocument()` for referenced template files, pushing a new `ExecutionContext` onto the stack. The `isExtends` flag distinguishes `extends:` from `template:` includes.

### Expression engine (`src/expressionEngine/`)

A full compile-time `${{ }}` expression evaluator that replaced the earlier heuristic-based approach:

- **`lexer.ts`** — tokenizes expression strings into `Token[]`.
- **`parser.ts`** — parses tokens into an AST (`PropertyAccess`, `FunctionCall`, `BinaryExpression`, `Literal`, `IndexAccess` nodes).
- **`evaluator.ts`** — walks the AST and resolves values against an `EvaluationContext` (parameters + variables). Exposes `evaluate()` and `evaluateTemplateString()`.
- **`functions.ts`** — built-in Azure Pipelines compile-time functions: `eq`, `ne`, `not`, `and`, `or`, `contains`, `startsWith`, `endsWith`, `format`, `join`, `split`, `coalesce`, `convertToJson`, `length`, `counter`, `lower`, `upper`, `replace`, `in`, `notIn`.
- **`types.ts`** — shared types (`Token`, `TokenType`, AST node interfaces, `EvaluationContext`, `ExpressionResult`, `ExpressionError`).
- **`index.ts`** — barrel re-export.

### Key data structures

- **`ExecutionContext`** — tracks the current execution pointer, parameter/variable/template-expression reference IDs, the `EvaluationContext` (resolved parameter/variable values), stack depth, and whether the context is an `extends` frame. Managed as a stack by `ExecutionContextManager`.
- **`EvaluationContext`** — `{ parameters: Record<string, any>, variables: Record<string, any> }` used by the expression engine to resolve property access.
- **`Expression`** — extends DAP `Variable`; stored in a global `expressionStore` array indexed by `variablesReference` ID. Used to represent parameters, variables, and template expressions in the debugger's Variables pane.
- **`DecoratedDocument`** — bundles the parsed `yaml.Document`, its source path, and a `LineCounter` for mapping AST offsets to line/column positions.

### Template traversal features

`DocumentTraverser` handles these Azure Pipelines constructs:

- **`template:` includes** — resolves relative paths, extracts sibling `parameters:`, and calls `onTemplate`.
- **`extends: template:`** — treated as a special template include; call stack frames are labelled `[extends]` vs `[template]`.
- **`${{ if }}` / `${{ elseif }}` / `${{ else }}`** — evaluates conditions via the expression engine; skips blocks whose condition is false; fires `onConditionalEvaluated`.
- **`${{ each var in collection }}`** — resolves the collection, iterates with the loop variable bound in the `EvaluationContext`, fires `onEachIteration` per iteration.
- **Template expressions in keys/values** — any `${{ }}` expression is evaluated and shown in the Template Expressions scope.

### Event system

`Debugger` extends `EventEmitter`. `eventManager.ts` wires debugger events (`stopOnEntry`, `stopOnStep`, `stopOnBreakpoint`, `stopOnError`, `stop`, `continue`, `output`) to DAP protocol events (`StoppedEvent`, `ContinuedEvent`, `TerminatedEvent`, `OutputEvent`).

### Sample pipelines (`sample/`)

The `sample/` directory contains demo Azure Pipelines YAML files that exercise every debugger feature. The extension's `.vscode/launch.json` opens `sample/` as the workspace in the Extension Development Host when pressing F5. The sample folder has its own `.vscode/launch.json` with three pre-configured debug launch configs.

## Conventions

- The extension uses **yarn** (with a `.yarnrc`); do not use npm.
- TypeScript strict mode is enabled but `noImplicitAny` is off.
- `'use strict';` is used at the top of modules that interact with VS Code APIs.
- The `FileAccessor` interface abstracts file I/O to allow future non-VS-Code hosts; `workspaceFileAccessor` is the VS Code implementation.
- `TarversalControl` (sic) is the intentional spelling used for the traversal control type — do not "fix" it.
- Tests use the TDD interface (`suite`/`test`) with Node's built-in `assert`.
