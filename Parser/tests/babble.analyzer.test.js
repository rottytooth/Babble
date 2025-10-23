/**
 * @jest-environment node
 */

const fs = require('fs');
const path = require('path');
const vm = require('vm');

/**
 * Loads the Babble modules (parser, analyzer, executor) in a VM context.
 * This ensures modules are loaded with their interdependencies intact.
 * @returns {Object} Object containing babble.parser, babble.analyzer, babble.executor
 */
function loadBabbleModules() {
    const parserCode = fs.readFileSync(path.join(__dirname, '../babble.parser.js'), 'utf8');
    const analyzerCode = fs.readFileSync(path.join(__dirname, '../babble.analyzer.js'), 'utf8');
    const executorCode = fs.readFileSync(path.join(__dirname, '../babble.executor.js'), 'utf8');

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
    vm.runInNewContext(executorCode, context);

    return context.babble;
}

let babble;

beforeAll(() => {
    babble = loadBabbleModules();
});

// ============================================================================
// ANALYZER TESTS FOR DEF, DEFN, AND DEFINE
// ============================================================================

describe('babble.analyzer def/defn/define validation', () => {
    
    describe('def validation', () => {
        test('should accept valid def with value', () => {
            const code = '(def x 42)';
            const ast = babble.parser.parse(code);
            const result = babble.analyzer.analyze(ast);
            
            // Debug output
            if (result.status !== 'success') {
                console.log('Result:', JSON.stringify(result, null, 2));
            }
            
            expect(result.status).toBe('success');
        });
        
        test('should accept valid def with docstring and value', () => {
            const code = '(def x "my variable" 42)';
            const ast = babble.parser.parse(code);
            const result = babble.analyzer.analyze(ast);
            expect(result.status).toBe('success');
        });
        
        test('should reject def with no value', () => {
            const code = '(def x)';
            const ast = babble.parser.parse(code);
            const result = babble.analyzer.analyze(ast);
            expect(result.status).toBe('error');
            expect(result.message).toContain('requires at least 2 arguments');
        });
        
        test('should reject def with too many arguments', () => {
            const code = '(def x "doc" 42 extra)';
            const ast = babble.parser.parse(code);
            const result = babble.analyzer.analyze(ast);
            expect(result.status).toBe('error');
            expect(result.message).toContain('accepts at most 3 arguments');
        });
        
        test('should reject def with non-string docstring', () => {
            const code = '(def x 123 42)';
            const ast = babble.parser.parse(code);
            const result = babble.analyzer.analyze(ast);
            expect(result.status).toBe('error');
            expect(result.message).toContain('docstring must be a string');
        });
        
        test('should reject def at non-top-level', () => {
            const code = '(let [] (def x 42))';
            const ast = babble.parser.parse(code);
            const result = babble.analyzer.analyze(ast);
            expect(result.status).toBe('error');
            expect(result.message).toContain('can only be used at the top level');
        });
    });
    
    describe('defn validation', () => {
        test('should accept valid single-arity defn', () => {
            const code = '(defn square [x] (* x x))';
            const ast = babble.parser.parse(code);
            const result = babble.analyzer.analyze(ast);
            expect(result.status).toBe('success');
        });
        
        test('should accept defn with docstring', () => {
            const code = '(defn square "Squares a number" [x] (* x x))';
            const ast = babble.parser.parse(code);
            const result = babble.analyzer.analyze(ast);
            expect(result.status).toBe('success');
        });
        
        test('should accept multi-arity defn', () => {
            const code = '(defn add ([x] x) ([x y] (+ x y)) ([x y z] (+ x y z)))';
            const ast = babble.parser.parse(code);
            const result = babble.analyzer.analyze(ast);
            expect(result.status).toBe('success');
        });
        
        test('should accept multi-arity defn with docstring', () => {
            const code = '(defn add "Adds numbers" ([x] x) ([x y] (+ x y)))';
            const ast = babble.parser.parse(code);
            const result = babble.analyzer.analyze(ast);
            expect(result.status).toBe('success');
        });
        
        test('should reject defn without parameters', () => {
            const code = '(defn foo)';
            const ast = babble.parser.parse(code);
            const result = babble.analyzer.analyze(ast);
            expect(result.status).toBe('error');
            expect(result.message).toContain('requires at least 2 arguments');
        });
        
        test('should reject defn without body', () => {
            const code = '(defn foo [x])';
            const ast = babble.parser.parse(code);
            const result = babble.analyzer.analyze(ast);
            expect(result.status).toBe('error');
            expect(result.message).toContain('requires at least one body expression');
        });
        
        test('should reject defn with non-vector params', () => {
            const code = '(defn foo (x y) (+ x y))';
            const ast = babble.parser.parse(code);
            const result = babble.analyzer.analyze(ast);
            expect(result.status).toBe('error');
            // When params are not a vector, it's treated as multi-arity with invalid clause
            expect(result.message).toContain('arity clause must start with a parameter vector');
        });
        
        test('should reject multi-arity defn with duplicate arities', () => {
            const code = '(defn add ([x y] (+ x y)) ([a b] (* a b)))';
            const ast = babble.parser.parse(code);
            const result = babble.analyzer.analyze(ast);
            expect(result.status).toBe('error');
            expect(result.message).toContain('duplicate arity');
        });
        
        test('should reject defn at non-top-level', () => {
            const code = '(let [] (defn foo [x] x))';
            const ast = babble.parser.parse(code);
            const result = babble.analyzer.analyze(ast);
            expect(result.status).toBe('error');
            expect(result.message).toContain('can only be used at the top level');
        });
    });
    
    describe('define validation', () => {
        test('should accept define as def', () => {
            const code = '(define x 42)';
            const ast = babble.parser.parse(code);
            const result = babble.analyzer.analyze(ast);
            expect(result.status).toBe('success');
        });
        
        test('should accept define as def with docstring', () => {
            const code = '(define x "my variable" 42)';
            const ast = babble.parser.parse(code);
            const result = babble.analyzer.analyze(ast);
            expect(result.status).toBe('success');
        });
        
        test('should accept define as defn', () => {
            const code = '(define square [x] (* x x))';
            const ast = babble.parser.parse(code);
            const result = babble.analyzer.analyze(ast);
            expect(result.status).toBe('success');
        });
        
        test('should accept define as defn with docstring', () => {
            const code = '(define square "Squares a number" [x] (* x x))';
            const ast = babble.parser.parse(code);
            const result = babble.analyzer.analyze(ast);
            expect(result.status).toBe('success');
        });
        
        test('should accept define as multi-arity defn', () => {
            const code = '(define add ([x] x) ([x y] (+ x y)))';
            const ast = babble.parser.parse(code);
            const result = babble.analyzer.analyze(ast);
            
            // Debug output
            if (result.status !== 'success') {
                console.log('Result:', JSON.stringify(result, null, 2));
                console.log('AST:', JSON.stringify(ast, null, 2));
            }
            
            expect(result.status).toBe('success');
        });
        
        test('should reject define at non-top-level', () => {
            const code = '(let [] (define x 42))';
            const ast = babble.parser.parse(code);
            const result = babble.analyzer.analyze(ast);
            expect(result.status).toBe('error');
            expect(result.message).toContain('can only be used at the top level');
        });
    });
});

// ============================================================================
// ANALYZER TESTS FOR SYMBOL TRACKING
// ============================================================================

describe('babble.analyzer symbol tracking', () => {
    
    test('should track built-in symbols', () => {
        const code = '(+ 1 2)';
        const ast = babble.parser.parse(code);
        const result = babble.analyzer.analyze(ast);
        
        expect(result.status).toBe('success');
        expect(result.symbols).toBeDefined();
        expect(result.symbols.builtIns).toContain('+');
        expect(result.symbols.locallyDefined).toEqual([]);
        expect(result.symbols.unknowns).toEqual([]);
    });
    
    test('should mark built-in symbols in AST', () => {
        const code = '(+ 1 2)';
        const ast = babble.parser.parse(code);
        const result = babble.analyzer.analyze(ast);
        
        const plusSymbol = result.ast[0].value[0];
        expect(plusSymbol.type).toBe('symbol');
        expect(plusSymbol.value).toBe('+');
        expect(plusSymbol.symbolType).toBe('builtin');
    });
    
    test('should track locally-defined symbols', () => {
        const code = '(let [x 5] (* x 2))';
        const ast = babble.parser.parse(code);
        const result = babble.analyzer.analyze(ast);
        
        expect(result.status).toBe('success');
        expect(result.symbols.builtIns).toContain('*');
        expect(result.symbols.locallyDefined).toContain('x');
    });
    
    test('should mark local symbols in AST', () => {
        const code = '(let [x 5] x)';
        const ast = babble.parser.parse(code);
        const result = babble.analyzer.analyze(ast);
        
        // Find the 'x' symbol in the body (not the binding)
        const letForm = result.ast[0];
        const bodyX = letForm.value[2]; // Third element is the body 'x'
        
        expect(bodyX.type).toBe('symbol');
        expect(bodyX.value).toBe('x');
        expect(bodyX.symbolType).toBe('local');
    });
    
    test('should track unknown symbols', () => {
        const code = '(my-fn 1 2)';
        const ast = babble.parser.parse(code);
        const result = babble.analyzer.analyze(ast);
        
        expect(result.status).toBe('success');
        expect(result.symbols.unknowns).toContain('my-fn');
        expect(result.symbols.builtIns).toEqual([]);
        expect(result.symbols.locallyDefined).toEqual([]);
    });
    
    test('should mark unknown symbols in AST', () => {
        const code = '(my-fn 1)';
        const ast = babble.parser.parse(code);
        const result = babble.analyzer.analyze(ast);
        
        const myFnSymbol = result.ast[0].value[0];
        expect(myFnSymbol.type).toBe('symbol');
        expect(myFnSymbol.value).toBe('my-fn');
        expect(myFnSymbol.symbolType).toBe('unknown');
    });
    
    test('should track mixed symbol types', () => {
        const code = '(let [x 5] (+ x (custom-fn 3)))';
        const ast = babble.parser.parse(code);
        const result = babble.analyzer.analyze(ast);
        
        expect(result.status).toBe('success');
        expect(result.symbols.builtIns).toContain('+');
        expect(result.symbols.locallyDefined).toContain('x');
        expect(result.symbols.unknowns).toContain('custom-fn');
    });
    
    test('should track symbols in defn parameters', () => {
        const code = '(defn square [x] (* x x))';
        const ast = babble.parser.parse(code);
        const result = babble.analyzer.analyze(ast);
        
        expect(result.status).toBe('success');
        expect(result.symbols.builtIns).toContain('*');
        expect(result.symbols.locallyDefined).toContain('x');
    });
    
    test('should not track special symbols', () => {
        const code = '(fn [& rest] rest)';
        const ast = babble.parser.parse(code);
        const result = babble.analyzer.analyze(ast);
        
        expect(result.status).toBe('success');
        // '&' should not appear in any category
        expect(result.symbols.builtIns).not.toContain('&');
        expect(result.symbols.locallyDefined).not.toContain('&');
        expect(result.symbols.unknowns).not.toContain('&');
    });
});
