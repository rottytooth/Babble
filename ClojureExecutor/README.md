# Babble ClojureScript Executor

ClojureScript executor component for the Babble project.

## Overview

This directory contains the ClojureScript code that compiles to JavaScript for use by the Babble server. It uses **SCI (Small Clojure Interpreter)** to provide **safe, sandboxed** evaluation of Clojure/ClojureScript code.

### 🔒 Security Features

The executor uses [SCI (Small Clojure Interpreter)](https://github.com/babashka/sci) which provides:

- **Sandboxed Execution**: Code runs in an isolated environment
- **No Direct JavaScript Access**: Cannot access `js/window`, `js/document`, or other dangerous globals
- **Termination Safety**: Protected against infinite loops and resource exhaustion
- **Controlled API Surface**: Only exposes safe, whitelisted functionality
- **No Arbitrary Code Execution**: Cannot break out of the sandbox

This makes it safe to evaluate untrusted user code without compromising the application or browser environment.

## Project Structure

```
ClojureExecutor/
├── deps.edn           # Clojure deps configuration
├── shadow-cljs.edn    # Shadow-CLJS build configuration
├── src/
│   └── babble/
│       ├── core.cljs  # Core functionality
│       └── utils.cljs # Utility functions
└── README.md
```

## Prerequisites

- [Java JDK](https://adoptium.net/) (version 11 or higher)
- [Clojure CLI tools](https://clojure.org/guides/install_clojure)
- [Node.js](https://nodejs.org/) (for shadow-cljs)

## Installation

1. Install shadow-cljs globally (recommended):
   ```bash
   npm install -g shadow-cljs
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

## Development

### Watch mode (auto-recompile on changes)
```bash
npx shadow-cljs watch app
```

### Build for development
```bash
npx shadow-cljs compile app
```

### Build for production
```bash
npx shadow-cljs release app
```

The compiled JavaScript will be output to `../Server/wwwroot/executor/`.

## Demo

An interactive demo is available at `demo.html`. After building the project, you can:

1. Open `demo.html` in a browser (served through the Babble server at `/executor/demo.html`)
2. Try the interactive ClojureScript evaluator
3. Test pre-defined examples
4. Parse EDN data structures

The demo showcases:
- Real-time ClojureScript code evaluation
- Error handling
- EDN data parsing
- Common ClojureScript patterns (map, filter, reduce, etc.)

## Integration with Server

The ClojureScript Executor build is integrated into the main Babble.csproj build process:
- During build, ClojureScript is compiled to JavaScript
- Output files are placed in `Server/wwwroot/executor/`
- The server can serve these files to the client
- The main `index.html` automatically loads the executor via `<script src="/executor/babble.core.js"></script>`

## Usage in Browser

Once compiled, you can use the ClojureScript functions from JavaScript:

```javascript
// After loading the compiled babble.core.js

// Simple examples
babble.core.greet("World");  // "Hello from ClojureScript, World!"
babble.core.add(2, 3);       // 5

// Evaluate ClojureScript code strings
const result = babble.core.eval_clojure("(+ 1 2 3)");
console.log(result);  // {success: true, result: 6, error: null}

const mapResult = babble.core.eval_clojure("(map inc [1 2 3])");
console.log(mapResult.result);  // [2, 3, 4]

// Safe evaluation (never throws)
const safeResult = babble.core.eval_clojure_safe("(+ 10 20)");
if (safeResult.success) {
    console.log("Result:", safeResult.result);  // 30
} else {
    console.error("Error:", safeResult.error);
}

// Read EDN data (without code evaluation)
const data = babble.core.read_clojure('{:name "Alice" :age 30}');
console.log(data.result);  // {name: "Alice", age: 30}
```

## Testing

Run the ClojureScript tests:

```bash
# Using shadow-cljs test runner
npx shadow-cljs compile test

# Or run tests in the browser
npx shadow-cljs watch test
# Then open http://localhost:8022 in your browser
```

Test files are located in `src/babble/core_test.cljs`.

## REPL

Start a ClojureScript REPL:
```bash
npx shadow-cljs cljs-repl app
```

## Available Functions

### babble.core

#### Code Evaluation (SCI-based Sandboxed Execution)

- `eval_clojure(code)` - Evaluates ClojureScript code in a sandboxed SCI environment
  - **Parameters**: `code` (string) - ClojureScript code to evaluate
  - **Returns**: `{success: boolean, result: any, error: string|null}`
  - **Security**: Runs in isolated SCI context, safe for untrusted code
  - **Example**: `eval_clojure("(+ 1 2 3)")` → `{success: true, result: 6}`

- `eval_clojure_safe(code)` - Alias for `eval_clojure` (both are equally safe with SCI)
  - **Parameters**: `code` (string) - ClojureScript code to evaluate
  - **Returns**: `{success: boolean, result: any, error: string|null}`
  - **Security**: TRUE sandboxing via SCI - prevents arbitrary JavaScript execution
  - **Example**: `eval_clojure_safe("(+ 1 2)")` → `{success: true, result: 3}`

- `eval_with_bindings(code, bindings)` - Evaluate code with custom variable bindings
  - **Parameters**: 
    - `code` (string) - ClojureScript code to evaluate
    - `bindings` (object) - JavaScript object with variable bindings
  - **Returns**: `{success: boolean, result: any, error: string|null}`
  - **Example**: `eval_with_bindings("(+ x y)", {x: 10, y: 20})` → `{success: true, result: 30}`

- `get_sci_namespaces()` - Get list of available namespaces in SCI context
  - **Returns**: Array of namespace names
  - **Example**: `get_sci_namespaces()` → `['clojure.core', 'clojure.string', ...]`

- `read_clojure(edn)` - Reads EDN data without evaluating code
  - **Parameters**: `edn` (string) - EDN data structure
  - **Returns**: `{success: boolean, result: any, error: string|null}`
  - **Example**: `read_clojure("{:x 1}")` → `{success: true, result: {x: 1}}`

#### Utility Functions
- `greet(name)` - Returns a greeting string
- `add(a, b)` - Adds two numbers
- `multiply(a, b)` - Multiplies two numbers
- `init()` - Initialization function

### babble.utils
- `format-code(code)` - Formats Babble code
- `parse-ast(json)` - Parse AST from JSON
- `ast-to-json(data)` - Convert to JSON
- `deep-merge(maps...)` - Recursively merge maps

## Security Model

### What SCI Protects Against ✅

- **Arbitrary JavaScript Execution**: Cannot use `js/eval` or execute raw JavaScript
- **DOM Manipulation**: Cannot access `js/document`, `js/window`, or browser APIs
- **Network Requests**: Cannot make `fetch()` or XHR requests
- **File System Access**: Cannot access local files or storage APIs
- **Infinite Loops**: Termination-safe preset prevents runaway code
- **Resource Exhaustion**: Protected against memory and CPU abuse
- **Prototype Pollution**: Isolated environment prevents attacks on JavaScript prototypes

### What IS Available ✅

- **Core Clojure Functions**: `map`, `filter`, `reduce`, `etc.`
- **Data Structures**: Vectors, maps, sets, lists
- **Math Operations**: All standard arithmetic and math functions
- **String Manipulation**: `str`, `subs`, `split`, etc.
- **Safe I/O**: `println`, `prn` (outputs to console)
- **Custom Bindings**: Variables provided via `eval_with_bindings`

### Safe for Untrusted Code

Because of SCI's sandboxing, you can safely evaluate user-provided code without security concerns. Examples of what attackers CANNOT do:

```javascript
// ❌ These are all BLOCKED by SCI:
eval_clojure_safe("(js/alert 'hacked')");           // Error: js/alert not found
eval_clojure_safe("(.removeChild js/document)");    // Error: js/document not found
eval_clojure_safe("(js/fetch 'evil.com')");         // Error: js/fetch not found
eval_clojure_safe("(js/localStorage.clear)");       // Error: js/localStorage not found
```

```javascript
// ✅ These work fine (and are safe):
eval_clojure_safe("(map inc [1 2 3])");             // [2, 3, 4]
eval_clojure_safe("(reduce + (range 1000))");       // 499500
eval_clojure_safe("(filter odd? [1 2 3 4])");       // [1, 3]
```

## Notes

- All public API functions are marked with `^:export` to prevent name mangling during advanced compilation
- The output is configured to work with the existing Babble server architecture
- SCI provides a safe, sandboxed environment suitable for evaluating untrusted user code
