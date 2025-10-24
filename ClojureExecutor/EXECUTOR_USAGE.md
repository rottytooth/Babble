# Using ClojureScript Executor from Browser Console

After the server builds and includes the ClojureScript executor, you can use it directly from the browser console on the main Babble page.

## Quick Start

Open the browser console (F12 or Cmd+Option+I on Mac) and try:

```javascript
// Simple evaluation
babble.core.eval_clojure_safe("(+ 1 2 3)")
// Returns: {success: true, result: 6, error: null}

// Map function
babble.core.eval_clojure_safe("(map inc [1 2 3])")
// Returns: {success: true, result: [2, 3, 4], error: null}

// Filter function
babble.core.eval_clojure_safe("(filter even? [1 2 3 4 5 6])")
// Returns: {success: true, result: [2, 4, 6], error: null}
```

## Available Functions

### `babble.core.eval_clojure_safe(code)`

Safely evaluates ClojureScript code in a sandboxed SCI environment.

**Parameters:**
- `code` (string) - ClojureScript code to evaluate

**Returns:**
- Object with `{success: boolean, result: any, error: string|null}`

**Examples:**

```javascript
// Arithmetic
babble.core.eval_clojure_safe("(+ 1 2 3)")
// => {success: true, result: 6}

// Define and use function
babble.core.eval_clojure_safe(`
  (defn square [x] (* x x))
  (square 5)
`)
// => {success: true, result: 25}

// Data structures
babble.core.eval_clojure_safe("{:name \"Alice\" :age 30}")
// => {success: true, result: {name: "Alice", age: 30}}
```

### `babble.core.eval_with_bindings(code, bindings)`

Evaluates code with custom variable bindings.

**Parameters:**
- `code` (string) - ClojureScript code to evaluate
- `bindings` (object) - JavaScript object with variables

**Returns:**
- Object with `{success: boolean, result: any, error: string|null}`

**Examples:**

```javascript
// Provide custom variables
babble.core.eval_with_bindings("(+ x y z)", {x: 10, y: 20, z: 30})
// => {success: true, result: 60}

// Use in map
babble.core.eval_with_bindings(
  "(map (fn [n] (* n multiplier)) numbers)",
  {numbers: [1, 2, 3, 4, 5], multiplier: 10}
)
// => {success: true, result: [10, 20, 30, 40, 50]}
```

### `babble.core.read_clojure(edn)`

Reads EDN data without evaluating code.

**Parameters:**
- `edn` (string) - EDN data structure

**Returns:**
- Object with `{success: boolean, result: any, error: string|null}`

**Examples:**

```javascript
// Parse map
babble.core.read_clojure('{:name "Bob" :age 25}')
// => {success: true, result: {name: "Bob", age: 25}}

// Parse vector
babble.core.read_clojure('[1 2 3 4 5]')
// => {success: true, result: [1, 2, 3, 4, 5]}
```

### `babble.core.get_sci_namespaces()`

Returns list of available namespaces in the SCI context.

**Returns:**
- Array of namespace names

**Example:**

```javascript
babble.core.get_sci_namespaces()
// => ['clojure.core', 'clojure.string', ...]
```

## Security

All evaluation happens in a **sandboxed SCI (Small Clojure Interpreter)** environment. This means:

✅ **Safe to run untrusted code**
- Cannot access `window`, `document`, or DOM
- Cannot execute JavaScript via `js/eval` or similar
- Cannot make network requests
- Cannot access localStorage or cookies
- Protected against infinite loops

❌ **These are all blocked:**

```javascript
babble.core.eval_clojure_safe("(js/alert 'hack')")
// => {success: false, error: "..."}

babble.core.eval_clojure_safe("(js/document.body)")
// => {success: false, error: "..."}

babble.core.eval_clojure_safe("(js/fetch 'evil.com')")
// => {success: false, error: "..."}
```

## Examples

### Working with Collections

```javascript
// Map, filter, reduce
babble.core.eval_clojure_safe(`
  (->> [1 2 3 4 5 6 7 8 9 10]
       (filter even?)
       (map (fn [x] (* x x)))
       (reduce +))
`)
// => {success: true, result: 220}

// Flatten nested structure
babble.core.eval_clojure_safe("(flatten [[1 2] [3 4] [5 6]])")
// => {success: true, result: [1, 2, 3, 4, 5, 6]}
```

### String Manipulation

```javascript
babble.core.eval_clojure_safe(`
  (require '[clojure.string :as str])
  (str/upper-case "hello world")
`)
// => {success: true, result: "HELLO WORLD"}
```

### Helper Function Pattern

Create a helper to extract results easily:

```javascript
function evalCljs(code, defaultValue = null) {
  const result = babble.core.eval_clojure_safe(code);
  return result.success ? result.result : defaultValue;
}

// Now use it:
evalCljs("(+ 1 2 3)")  // => 6
evalCljs("invalid", 0)  // => 0
```

## Troubleshooting

### Executor not available

If `babble.core.eval_clojure_safe` is undefined:

1. Check that the build completed successfully
2. Verify `/executor/main.js` is being served
3. Check browser console for load errors
4. Rebuild with: `cd ClojureExecutor && npm install && npm run release`

### Build the executor manually

```bash
cd ClojureExecutor
npm install
npm run release
```

The output will be in `../Server/wwwroot/executor/main.js`

## More Information

- Full API documentation: [ClojureExecutor/README.md](../ClojureExecutor/README.md)
- Interactive demo: Open `/executor/demo.html` in your browser
- Examples: [ClojureExecutor/examples.js](../ClojureExecutor/examples.js)
