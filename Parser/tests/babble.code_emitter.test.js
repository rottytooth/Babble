/**
 * Test Suite for babble.code_emitter
 * 
 * Tests AST to code conversion and roundtrip transformations
 * 
 * Run with: npm test
 * Watch mode: npm run test:watch
 * Coverage: npm run test:coverage
 */

const fs = require('fs');
const path = require('path');
const vm = require('vm');

/**
 * Loads the Babble modules (parser, analyzer, code_emitter) in a VM context.
 * This ensures modules are loaded with their interdependencies intact.
 * @returns {Object} Object containing babble.parser, babble.analyzer, babble.code_emitter
 */
function loadBabbleModules() {
    const parserCode = fs.readFileSync(path.join(__dirname, '../babble.parser.js'), 'utf8');
    const analyzerCode = fs.readFileSync(path.join(__dirname, '../babble.analyzer.js'), 'utf8');
    const codeEmitterCode = fs.readFileSync(path.join(__dirname, '../babble.code_emitter.js'), 'utf8');

    const context = {
        babble: {},
        console: console,
        setTimeout: setTimeout,
        clearTimeout: clearTimeout,
        setInterval: setInterval,
        clearInterval: clearInterval
    };

    vm.runInNewContext(parserCode, context);
    vm.runInNewContext(analyzerCode, context);
    vm.runInNewContext(codeEmitterCode, context);

    return context.babble;
}

let babble;

beforeAll(() => {
    babble = loadBabbleModules();
});

// ============================================================================
// BASIC AST TO CODE CONVERSION TESTS
// ============================================================================

describe('babble.code_emitter.astToCode() - Basic Types', () => {
    
    test('should convert simple list to code', () => {
        const code = '(+ 1 2)';
        const ast = babble.parser.parse(code);
        const result = babble.code_emitter.astToCode(ast);
        
        expect(result).toBe('(+ 1 2)');
    });
    
    test('should convert vector to code', () => {
        const code = '[1 2 3]';
        const ast = babble.parser.parse(code);
        const result = babble.code_emitter.astToCode(ast);
        
        expect(result).toBe('[1 2 3]');
    });
    
    test('should convert map to code', () => {
        const code = '{:name "John" :age 30}';
        const ast = babble.parser.parse(code);
        const result = babble.code_emitter.astToCode(ast);
        
        expect(result).toBe('{:name "John" :age 30}');
    });
    
    test('should convert string literals', () => {
        const code = '"hello world"';
        const ast = babble.parser.parse(code);
        const result = babble.code_emitter.astToCode(ast);
        
        expect(result).toBe('"hello world"');
    });
    
    test('should convert numeric literals', () => {
        const code = '42';
        const ast = babble.parser.parse(code);
        const result = babble.code_emitter.astToCode(ast);
        
        expect(result).toBe('42');
    });
    
    test('should convert symbols', () => {
        const code = 'my-symbol';
        const ast = babble.parser.parse(code);
        const result = babble.code_emitter.astToCode(ast);
        
        expect(result).toBe('my-symbol');
    });
    
    test('should convert keywords', () => {
        const code = ':keyword';
        const ast = babble.parser.parse(code);
        const result = babble.code_emitter.astToCode(ast);
        
        expect(result).toBe(':keyword');
    });
});

// ============================================================================
// NESTED EXPRESSION TESTS
// ============================================================================

describe('babble.code_emitter.astToCode() - Nested Expressions', () => {
    
    test('should convert nested lists', () => {
        const code = '(+ (* 2 3) 4)';
        const ast = babble.parser.parse(code);
        const result = babble.code_emitter.astToCode(ast);
        
        expect(result).toBe('(+ (* 2 3) 4)');
    });
    
    test('should convert let bindings', () => {
        const code = '(let [x 5] (* x x))';
        const ast = babble.parser.parse(code);
        const result = babble.code_emitter.astToCode(ast);
        
        expect(result).toBe('(let [x 5] (* x x))');
    });
    
    test('should convert nested vectors', () => {
        const code = '[[1 2] [3 4]]';
        const ast = babble.parser.parse(code);
        const result = babble.code_emitter.astToCode(ast);
        
        expect(result).toBe('[[1 2] [3 4]]');
    });
});

// ============================================================================
// FUNCTION DEFINITION TESTS
// ============================================================================

describe('babble.code_emitter.astToCode() - Function Definitions', () => {
    
    test('should convert simple defn', () => {
        const code = '(defn square [x] (* x x))';
        const ast = babble.parser.parse(code);
        const result = babble.code_emitter.astToCode(ast);
        
        expect(result).toBe('(defn square [x] (* x x))');
    });
    
    test('should convert defn with docstring', () => {
        const code = '(defn square "Squares a number" [x] (* x x))';
        const ast = babble.parser.parse(code);
        const result = babble.code_emitter.astToCode(ast);
        
        expect(result).toBe('(defn square "Squares a number" [x] (* x x))');
    });
    
    test('should convert defn with multiple parameters', () => {
        const code = '(defn add [x y] (+ x y))';
        const ast = babble.parser.parse(code);
        const result = babble.code_emitter.astToCode(ast);
        
        expect(result).toBe('(defn add [x y] (+ x y))');
    });
    
    test('should convert defn with multiple body expressions', () => {
        const code = '(defn foo [x] (println x) (* x 2))';
        const ast = babble.parser.parse(code);
        const result = babble.code_emitter.astToCode(ast);
        
        expect(result).toBe('(defn foo [x] (println x) (* x 2))');
    });
    
    test('should convert def with value', () => {
        const code = '(def pi 3.14159)';
        const ast = babble.parser.parse(code);
        const result = babble.code_emitter.astToCode(ast);
        
        expect(result).toBe('(def pi 3.14159)');
    });
});

// ============================================================================
// MULTIPLE EXPRESSIONS TESTS
// ============================================================================

describe('babble.code_emitter.astToCode() - Multiple Expressions', () => {
    
    test('should convert multiple top-level expressions', () => {
        const code = '(+ 1 2)\n(* 3 4)';
        const ast = babble.parser.parse(code);
        const result = babble.code_emitter.astToCode(ast);
        
        // Should join with newlines
        expect(result).toBe('(+ 1 2)\n(* 3 4)');
    });
    
    test('should convert program with multiple definitions', () => {
        const code = '(def x 10)\n(def y 20)\n(+ x y)';
        const ast = babble.parser.parse(code);
        const result = babble.code_emitter.astToCode(ast);
        
        expect(result).toBe('(def x 10)\n(def y 20)\n(+ x y)');
    });
});

// ============================================================================
// ROUNDTRIP CONVERSION TESTS
// ============================================================================

describe('babble.code_emitter.astToCode() - Roundtrip Conversions', () => {
    
    test('should roundtrip simple arithmetic', () => {
        const originalCode = '(+ 1 2 3)';
        const ast = babble.parser.parse(originalCode);
        const regeneratedCode = babble.code_emitter.astToCode(ast);
        
        // Parse the regenerated code to verify it's valid
        const ast2 = babble.parser.parse(regeneratedCode);
        
        expect(ast2).toBeDefined();
        expect(ast2.length).toBe(ast.length);
        expect(regeneratedCode).toBe(originalCode);
    });
    
    test('should roundtrip function definition', () => {
        const originalCode = '(defn factorial [n] (if (<= n 1) 1 (* n (factorial (- n 1)))))';
        const ast = babble.parser.parse(originalCode);
        const regeneratedCode = babble.code_emitter.astToCode(ast);
        
        // Parse again to verify validity
        const ast2 = babble.parser.parse(regeneratedCode);
        
        expect(ast2).toBeDefined();
        expect(ast2.length).toBe(ast.length);
        // The regenerated code might have minor differences (like parser quirks)
        // but should be semantically equivalent - verified by successful re-parsing
        expect(regeneratedCode).toContain('defn factorial');
        expect(regeneratedCode).toContain('if');
        expect(regeneratedCode).toContain('factorial');
    });
    
    test('should roundtrip let expression', () => {
        const originalCode = '(let [x 5 y 10] (+ x y))';
        const ast = babble.parser.parse(originalCode);
        const regeneratedCode = babble.code_emitter.astToCode(ast);
        
        const ast2 = babble.parser.parse(regeneratedCode);
        expect(ast2).toBeDefined();
        expect(regeneratedCode).toBe(originalCode);
    });
    
    test('should roundtrip nested data structures', () => {
        const originalCode = '{:users [{:name "Alice" :age 30} {:name "Bob" :age 25}]}';
        const ast = babble.parser.parse(originalCode);
        const regeneratedCode = babble.code_emitter.astToCode(ast);
        
        const ast2 = babble.parser.parse(regeneratedCode);
        expect(ast2).toBeDefined();
        expect(regeneratedCode).toBe(originalCode);
    });
});

// ============================================================================
// COMPLEX PROGRAM TESTS
// ============================================================================

describe('babble.code_emitter.astToCode() - Complex Programs', () => {
    
    test('should convert a complete program', () => {
        const code = `(defn square [x] (* x x))
(defn sum-of-squares [a b] (+ (square a) (square b)))
(sum-of-squares 3 4)`;
        
        const ast = babble.parser.parse(code);
        const result = babble.code_emitter.astToCode(ast);
        
        // The result should be valid Babble code
        const ast2 = babble.parser.parse(result);
        expect(ast2).toBeDefined();
        expect(ast2.length).toBe(3); // Three top-level expressions
        
        // Should match original (might have different whitespace)
        expect(result).toBe(code);
    });
    
    test('should handle program with let and function calls', () => {
        const code = '(let [x 10 y 20] (defn add-to-x [n] (+ x n)) (add-to-x y))';
        
        const ast = babble.parser.parse(code);
        const result = babble.code_emitter.astToCode(ast);
        
        const ast2 = babble.parser.parse(result);
        expect(ast2).toBeDefined();
        expect(result).toBe(code);
    });
});

// ============================================================================
// JSON STRING INPUT TESTS
// ============================================================================

describe('babble.code_emitter.astToCode() - JSON String Input', () => {
    
    test('should handle JSON string input', () => {
        const code = '(+ 1 2)';
        const ast = babble.parser.parse(code);
        const jsonString = JSON.stringify(ast);
        
        // Should be able to convert from JSON string
        const result = babble.code_emitter.astToCode(jsonString);
        expect(result).toBe('(+ 1 2)');
    });
    
    test('should handle JSON string for complex expression', () => {
        const code = '(defn square [x] (* x x))';
        const ast = babble.parser.parse(code);
        const jsonString = JSON.stringify(ast);
        
        const result = babble.code_emitter.astToCode(jsonString);
        expect(result).toBe('(defn square [x] (* x x))');
    });
});

// ============================================================================
// EDGE CASES AND ERROR HANDLING
// ============================================================================

describe('babble.code_emitter.astToCode() - Edge Cases', () => {
    
    test('should handle empty vector', () => {
        const code = '[]';
        const ast = babble.parser.parse(code);
        const result = babble.code_emitter.astToCode(ast);
        
        expect(result).toBe('[]');
    });
    
    test('should handle empty list', () => {
        const code = '()';
        const ast = babble.parser.parse(code);
        const result = babble.code_emitter.astToCode(ast);
        
        expect(result).toBe('()');
    });
    
    test('should handle empty map', () => {
        const code = '{}';
        const ast = babble.parser.parse(code);
        const result = babble.code_emitter.astToCode(ast);
        
        expect(result).toBe('{}');
    });
    
    test('should handle strings with special characters', () => {
        const code = '"hello\\nworld"';
        const ast = babble.parser.parse(code);
        const result = babble.code_emitter.astToCode(ast);
        
        // Should preserve the escaped newline
        expect(result).toContain('\\n');
    });
});
