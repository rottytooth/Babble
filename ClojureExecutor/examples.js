/**
 * Example usage of Babble ClojureScript Executor from JavaScript
 * 
 * This file demonstrates how to use the ClojureScript evaluation functions
 * in a JavaScript/Node.js environment.
 * 
 * SECURITY: All evaluation uses SCI (Small Clojure Interpreter) for sandboxing.
 * User code cannot access dangerous JavaScript APIs or escape the sandbox.
 */

// Assuming the compiled ClojureScript is loaded (e.g., via <script> tag or require)

// ============================================================================
// BASIC EVALUATION (SCI-SANDBOXED)
// ============================================================================

console.log('=== Basic Evaluation (SCI-Sandboxed) ===');

// Simple arithmetic
const result1 = babble.core.eval_clojure_safe('(+ 1 2 3)');
console.log('(+ 1 2 3):', result1.result); // 6

// String concatenation
const result2 = babble.core.eval_clojure_safe('(str "Hello, " "World!")');
console.log('String concat:', result2.result); // "Hello, World!"

// Vector operations
const result3 = babble.core.eval_clojure_safe('[1 2 3 4 5]');
console.log('Vector:', result3.result); // [1, 2, 3, 4, 5]

// ============================================================================
// COLLECTION OPERATIONS
// ============================================================================

console.log('\n=== Collection Operations ===');

// Map function
const mapResult = babble.core.eval_clojure_safe('(map inc [1 2 3 4 5])');
console.log('Map inc:', mapResult.result); // [2, 3, 4, 5, 6]

// Filter function
const filterResult = babble.core.eval_clojure_safe('(filter even? [1 2 3 4 5 6])');
console.log('Filter even:', filterResult.result); // [2, 4, 6]

// Reduce function
const reduceResult = babble.core.eval_clojure_safe('(reduce + [1 2 3 4 5])');
console.log('Reduce sum:', reduceResult.result); // 15

// Take and drop
const takeResult = babble.core.eval_clojure_safe('(take 3 [1 2 3 4 5])');
console.log('Take 3:', takeResult.result); // [1, 2, 3]

// ============================================================================
// FUNCTION DEFINITIONS
// ============================================================================

console.log('\n=== Function Definitions ===');

// Define and use a function
const fnResult = babble.core.eval_clojure_safe(`
  (def square (fn [x] (* x x)))
  (square 5)
`);
console.log('Square function:', fnResult.result); // 25

// Define with defn
const defnResult = babble.core.eval_clojure_safe(`
  (defn factorial [n]
    (if (<= n 1)
      1
      (* n (factorial (dec n)))))
  (factorial 5)
`);
console.log('Factorial(5):', defnResult.result); // 120

// ============================================================================
// SECURITY DEMONSTRATION - SCI Sandboxing
// ============================================================================

console.log('\n=== Security Demonstration ===');

// These all fail safely - SCI blocks dangerous operations
const securityTests = [
    '(js/alert "hacked")',           // Cannot access js/alert
    '(js/document.body.innerHTML)',  // Cannot access DOM
    '(js/fetch "evil.com")',         // Cannot make network requests
    '(js/eval "1+1")',               // Cannot use js/eval
    '(js/localStorage.clear)',       // Cannot access storage
    '(js/window.location)',          // Cannot access window
];

console.log('Attempting malicious operations (all should be blocked):');
securityTests.forEach(code => {
    const result = babble.core.eval_clojure_safe(code);
    console.log(`  ${code}`);
    console.log(`    Blocked: ${!result.success}, Error: ${result.error?.substring(0, 50)}...`);
});

console.log('\n✓ All dangerous operations were successfully blocked by SCI!');

// ============================================================================
// CUSTOM BINDINGS
// ============================================================================

console.log('\n=== Custom Bindings ===');

// Provide custom variables to the evaluation
const bindingsResult = babble.core.eval_with_bindings(
    '(+ x y z)',
    {x: 10, y: 20, z: 30}
);
console.log('(+ x y z) with {x:10, y:20, z:30}:', bindingsResult.result); // 60

// Use custom bindings in more complex expressions
const complexBindings = babble.core.eval_with_bindings(
    '(map (fn [item] (* item multiplier)) items)',
    {items: [1, 2, 3, 4, 5], multiplier: 10}
);
console.log('Map with bindings:', complexBindings.result); // [10, 20, 30, 40, 50]

// ============================================================================
// ERROR HANDLING
// ============================================================================

console.log('\n=== Error Handling ===');

// Invalid syntax
const errorResult = babble.core.eval_clojure_safe('(+ 1 2');
console.log('Invalid syntax:');
console.log('  Success:', errorResult.success); // false
console.log('  Error:', errorResult.error);

// Runtime error
const runtimeError = babble.core.eval_clojure_safe('(/ 1 0)');
console.log('Division by zero:', runtimeError);

// ============================================================================
// EDN DATA PARSING
// ============================================================================

console.log('\n=== EDN Data Parsing ===');

// Parse a map
const mapData = babble.core.read_clojure('{:name "Alice" :age 30 :active true}');
console.log('Parsed map:', mapData.result);
// {name: "Alice", age: 30, active: true}

// Parse nested structures
const nestedData = babble.core.read_clojure(`
  {:users [{:name "Bob" :id 1}
           {:name "Carol" :id 2}]
   :count 2}
`);
console.log('Nested structure:', nestedData.result);

// Parse a vector of maps
const vectorData = babble.core.read_clojure('[{:x 1} {:x 2} {:x 3}]');
console.log('Vector of maps:', vectorData.result);

// ============================================================================
// ADVANCED EXAMPLES
// ============================================================================

console.log('\n=== Advanced Examples ===');

// Partial application
const partialResult = babble.core.eval_clojure_safe(`
  (def add-five (partial + 5))
  (add-five 10)
`);
console.log('Partial application:', partialResult.result); // 15

// Threading macro
const threadResult = babble.core.eval_clojure_safe(`
  (-> 5
      (+ 3)
      (* 2)
      (- 1))
`);
console.log('Threading macro:', threadResult.result); // 15

// Map with keyword access
const keywordResult = babble.core.eval_clojure_safe(`
  (def person {:name "Alice" :age 30})
  (:name person)
`);
console.log('Keyword access:', keywordResult.result); // "Alice"

// Higher-order functions
const higherOrderResult = babble.core.eval_clojure_safe(`
  (defn apply-twice [f x]
    (f (f x)))
  (apply-twice inc 10)
`);
console.log('Higher-order function:', higherOrderResult.result); // 12

// ============================================================================
// PRACTICAL USE CASE: Dynamic Configuration
// ============================================================================

console.log('\n=== Practical Use Case ===');

// Load configuration from EDN
const config = babble.core.read_clojure(`
  {:app-name "Babble"
   :version "0.5.0"
   :features #{:eval :parse :compile}
   :limits {:max-iterations 1000
            :timeout-ms 5000}}
`);

if (config.success) {
  console.log('Configuration loaded:');
  console.log('  App:', config.result.appName);
  console.log('  Version:', config.result.version);
  console.log('  Features:', config.result.features);
  console.log('  Limits:', config.result.limits);
}

// ============================================================================
// INTEGRATION PATTERN
// ============================================================================

console.log('\n=== Integration Pattern ===');

// Helper function to safely evaluate and return result
function evalClojure(code, defaultValue = null) {
  const result = babble.core.eval_clojure_safe(code);
  if (result.success) {
    return result.result;
  } else {
    console.error('ClojureScript evaluation error:', result.error);
    return defaultValue;
  }
}

// Use the helper
const sum = evalClojure('(reduce + [1 2 3 4 5])', 0);
console.log('Safe sum:', sum); // 15

const invalid = evalClojure('invalid code', 'fallback');
console.log('With fallback:', invalid); // 'fallback'

console.log('\n=== All examples completed! ===');
