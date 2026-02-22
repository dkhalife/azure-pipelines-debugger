# Azure Pipelines Template Debugger

**Understand your templates, one step at a time.**

Azure Pipelines Template Debugger is a VS Code extension that lets you set breakpoints in Azure Pipelines YAML files and step through template expansion — seeing how parameters flow, how `${{ }}` expressions resolve, and which conditional branches are taken — all without executing any pipeline tasks.

## 🎯 Goals and principles

* **Template expansion, not task execution** — we simulate Azure DevOps' compile-time template processing, not the pipeline runtime.
* **Familiar debugging UX** — breakpoints, call stack, variables, watch, hover, step in/out work exactly like they do for code.
* **Offline by default** — everything runs locally against files on disk. No Azure DevOps connection required.

## ✨ Features

🔍 **Step through template expansion** — walk through your pipeline YAML node by node with Step In, Step Over, and Step Out

📂 **Template include stack** — the Call Stack shows the full chain of `template:` includes and `extends:` references

🧮 **Expression evaluation** — `${{ }}` compile-time expressions are evaluated in real time with 17+ built-in functions (`eq`, `ne`, `contains`, `format`, `coalesce`, and more)

🔀 **Conditional stepping** — step through `${{ if }}` / `${{ elseif }}` / `${{ else }}` blocks and see which branch is taken

🔁 **Loop iteration** — `${{ each }}` loops are unrolled one iteration at a time with the loop variable visible in the Variables pane

📌 **Breakpoints with conditions** — set conditional breakpoints like `eq(parameters.environment, 'production')` to stop only when it matters

👁️ **Watch & hover** — add watch expressions or hover over `${{ }}` text to see resolved values

✏️ **Inline values** — resolved expression values appear as inline decorations in the editor while paused

📋 **Parameters & variables scopes** — inspect parameters (with defaults), variables, and template expressions for each stack frame

🔄 **Restart** — restart template expansion from the root pipeline without relaunching

## 🚀 Getting Started

### Prerequisites

* [VS Code](https://code.visualstudio.com) 1.92+
* [Azure Pipelines](https://marketplace.visualstudio.com/items?itemName=ms-azure-devops.azure-pipelines) extension (installed automatically as a dependency)

### Installation

> **Note:** This extension is currently in development and not yet published to the marketplace.

1. Clone the repository
2. Run `yarn install` to install dependencies
3. Press **F5** to open the Extension Development Host with the [sample pipelines](./sample/) loaded
4. Pick a launch config from the **Run and Debug** panel and start debugging

### Usage

1. Open any Azure Pipelines YAML file
2. Set breakpoints by clicking the gutter
3. Open the **Run and Debug** panel and select an `azurepipelines` launch config
4. Press **F5** to start debugging

| Action | Shortcut | Description |
|---|---|---|
| Step In | `F11` | Enter a `template:` reference or dive into a block |
| Step Over | `F10` | Execute a template reference without entering it |
| Step Out | `Shift+F11` | Return from the current template to the caller |
| Continue | `F5` | Resume to the next breakpoint |
| Restart | `Ctrl+Shift+F5` | Re-run expansion from the root pipeline |

### Launch Configuration

Add to your `.vscode/launch.json`:

```json
{
    "type": "azurepipelines",
    "request": "launch",
    "name": "Debug pipeline",
    "pipeline": "${workspaceFolder}/azure-pipelines.yml",
    "stopOnEntry": true
}
```

| Property | Type | Required | Description |
|---|---|---|---|
| `pipeline` | `string` | ✅ | Absolute path to the pipeline YAML file |
| `stopOnEntry` | `boolean` | | Pause on the first line (default: `false`) |
| `parameters` | `string` | | Path to a YAML file with parameter value overrides |

## 📐 Architecture

The extension implements the [Debug Adapter Protocol](https://microsoft.github.io/debug-adapter-protocol/) in-process (no separate DAP server). The main components are:

```
extension.ts                          ← activation: registers providers
├── configurationProvider.ts          ← resolves launch configs
├── debugAdapterFactory.ts            ← creates DebugSession instances
├── inlineValuesProvider.ts           ← inline ${{ }} value decorations
│
debugSession.ts                       ← DAP request/response handling
└── debugger.ts                       ← core execution engine
    ├── documentManager.ts            ← YAML loading & caching
    │   └── fileLoader.ts             ← file I/O + YAML parsing
    ├── documentTraverser.ts          ← AST walking, template/if/each handling
    ├── executionContextManager.ts    ← call stack (context per template)
    │   └── executionContext.ts       ← pointer, params, variables, depth
    ├── breakpointManager.ts          ← breakpoints + conditional evaluation
    ├── eventManager.ts               ← debugger events → DAP events
    └── expressionEngine/             ← ${{ }} expression evaluator
        ├── lexer.ts                  ← tokenizer
        ├── parser.ts                 ← token → AST
        ├── evaluator.ts             ← AST → resolved value
        ├── functions.ts              ← built-in functions (eq, ne, etc.)
        └── types.ts                  ← Token, AST node, context types
```

## 🛠️ Development

### 📃 Requirements

* [Node.js](https://nodejs.org) 18+
* [yarn](https://yarnpkg.com) 1.x

### Build & Test

```sh
yarn install            # install dependencies
yarn run compile        # build (tsc → out/)
yarn run lint           # eslint
yarn run test:unit      # expression engine tests (mocha, no VS Code host)
yarn run test           # VS Code integration tests
```

### Running the Extension

Press **F5** in VS Code — it compiles the extension and opens a new Extension Development Host window with the [`sample/`](./sample/) folder loaded. The sample folder contains pipelines that exercise every debugger feature (parameters, template includes, conditionals, loops, extends).

### Sample Pipelines

| File | Demonstrates |
|---|---|
| [`azure-pipelines.yml`](./sample/azure-pipelines.yml) | Parameters, variables, template includes, `if/elseif/else`, `each` loops |
| [`extends-pipeline.yml`](./sample/extends-pipeline.yml) | `extends: template:` with `[extends]` call stack frames |
| [`templates/build-steps.yml`](./sample/templates/build-steps.yml) | Step In/Out, conditionals inside templates, hover & watch |
| [`templates/deploy-steps.yml`](./sample/templates/deploy-steps.yml) | Per-region deployment from `each` loop, conditional steps |
| [`templates/base-pipeline.yml`](./sample/templates/base-pipeline.yml) | Base template for extends with nested includes |
| [`templates/shared-variables.yml`](./sample/templates/shared-variables.yml) | Variable template |

## 🗺️ Roadmap

* 🔜 Remote template resolution for `resources.repositories` references within the same Azure DevOps organization
* 🔜 Parameter type validation against declared types (`string`, `number`, `boolean`, `object`, `stepList`, etc.)
* 🔜 Loaded sources tracking (see all template files involved in expansion)

## 🤝 Contributing

Contributions are welcome! Feel free to fork the repo and submit pull requests. If you have ideas but aren't familiar with the code, you can also [open issues](https://github.com/dkhalife/azure-pipelines-debugger/issues).

## 🔒 License

See the [LICENSE](LICENSE) file for more details.
