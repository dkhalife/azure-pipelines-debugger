# Sample Pipelines

These YAML files demonstrate every feature of the Azure Pipelines Template
Debugger. When you press **F5** in the root of this extension, VS Code opens
this folder in a new Extension Development Host window with the debugger
extension loaded.

## Quick Start

1. Open any `.yml` file in the Extension Development Host.
2. Pick a launch config from the **Run and Debug** panel:
   | Config | File | Shows |
   |---|---|---|
   | **Debug: Main pipeline** | `azure-pipelines.yml` | Parameters, variables, template includes, conditionals, loops |
   | **Debug: Extends pipeline** | `extends-pipeline.yml` | `extends:` keyword, `[extends]` call stack frames, nested templates |
   | **Debug: Current file** | whichever file is open | Ad-hoc debugging of any file |
3. Press **F5** (or the green ▶ button).

## Feature Walkthrough

### Parameters & Variables
`azure-pipelines.yml` defines parameters (`environment`, `deployRegions`,
`runTests`, `buildConfiguration`) and variables (`solution`, `buildPlatform`,
`imageTag`). Step through the file and inspect both scopes in the
**Variables** panel.

### Template Includes (Step In / Step Out)
The main pipeline includes `templates/build-steps.yml` and
`templates/deploy-steps.yml`. Use **Step In (F11)** on a `template:` line to
enter the template file. The **Call Stack** shows the include chain. Use
**Step Out (Shift+F11)** to return to the caller.

### Conditionals (`${{ if / elseif / else }}`)
The main pipeline has an if/elseif/else chain that selects a stage based on
`parameters.environment`. Step through to see which branch is taken and the
evaluated result in **Template Expressions**.

### Loops (`${{ each }}`)
The deploy stage iterates over `parameters.deployRegions`. Each iteration
shows the current loop variable and index in the Variables panel and fires a
debug console message.

### Extends
`extends-pipeline.yml` uses `extends: template:` to inherit from
`templates/base-pipeline.yml`. The Call Stack labels the frame `[extends]`
instead of `[template]`.

### Watch & Hover
Add `parameters.environment` or `eq(parameters.runTests, 'true')` as a
**Watch** expression. Hover over any `${{ }}` expression in the editor to see
its resolved value.

### Conditional Breakpoints
Right-click the breakpoint gutter and add a condition like
`eq(parameters.environment, 'production')`. The debugger only stops when the
condition is true.

### Inline Values
While paused, resolved `${{ }}` values appear as inline decorations next to
each expression in the editor.

## File Map

```
sample/
├── azure-pipelines.yml          ← main pipeline (start here)
├── extends-pipeline.yml         ← extends sample
├── templates/
│   ├── build-steps.yml          ← build step template
│   ├── deploy-steps.yml         ← deploy step template (called per region)
│   ├── base-pipeline.yml        ← base template for extends
│   └── shared-variables.yml     ← variable template
└── .vscode/
    └── launch.json              ← debug launch configs
```
