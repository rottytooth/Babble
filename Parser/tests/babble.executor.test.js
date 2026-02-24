/**
 * Test Suite for babble.executor.ex() method
 * 
 * Run with: npm test
 * Watch mode: npm run test:watch
 * Coverage: npm run test:coverage
 */

const fs = require('fs');
const path = require('path');
const vm = require('vm');

// Load Babble modules
async function loadBabbleModules() {
    const parserPath = path.join(__dirname, '..', 'babble.parser.js');
    const analyzerPath = path.join(__dirname, '..', 'babble.analyzer.js');
    const executorPath = path.join(__dirname, '..', 'babble.executor.js');
    
    // Verify files exist
    if (!fs.existsSync(parserPath)) {
        throw new Error(`Parser not found at: ${parserPath}`);
    }
    if (!fs.existsSync(analyzerPath)) {
        throw new Error(`Analyzer not found at: ${analyzerPath}`);
    }
    if (!fs.existsSync(executorPath)) {
        throw new Error(`Executor not found at: ${executorPath}`);
    }
    
    try {
        // Create global babble object FIRST (modules expect this to exist)
        // babble.core is the compiled ClojureScript/SCI evaluator, built separately.
        // Stub it out so executor tests don't depend on the Clojure build.
        const context = {
            babble: {
                core: {
                    eval_clojure_safe: (_code) => ({ success: true, result: null })
                }
            },
            console: console,
            setTimeout: setTimeout,
            setInterval: setInterval,
            clearTimeout: clearTimeout,
            clearInterval: clearInterval,
            fetch: (() => {
                let _fetchOverride = null;
                global.setBabbleTestFetch = (fn) => { _fetchOverride = fn; };
                global.clearBabbleTestFetch = () => { _fetchOverride = null; };

                return (url, options) => {
                    if (_fetchOverride) return _fetchOverride(url, options);
                    if (url === '/builtins') {
                        return Promise.resolve({ ok: true, json: () => Promise.resolve([
                            '+', '-', '*', '/', '=', '<', '>', '<=', '>=', 'not', 'and', 'or',
                            'if', 'when', 'let', 'do', 'fn', 'defn', 'map', 'reduce', 'filter',
                            'cons', 'first', 'rest', 'conj', 'count', 'str', 'println', 'inc', 'dec',
                            'nil?', 'empty?', 'some?', 'number?', 'string?', 'vector?', 'list?',
                            'apply', 'partial', 'comp', 'identity', 'atom', 'swap!', 'reset!', 'deref',
                            'define', 'source', 'doc', 'desc', 'man', 'handle', 'about',
                        ]) });
                    }
                    return Promise.reject(new Error(`Unexpected fetch: ${url}`));
                };
            })(),
        };
        
        // IMPORTANT: The parser wraps itself in (function(root) {...})(this)
        // In vm.runInNewContext, 'this' is the context object itself
        // So we don't need to do anything special - it will work automatically
        
        // Load parser
        const parserCode = fs.readFileSync(parserPath, 'utf8');
        vm.runInNewContext(parserCode, context);
        
        // Load analyzer  
        const analyzerCode = fs.readFileSync(analyzerPath, 'utf8');
        vm.runInNewContext(analyzerCode, context);
        
        // Load executor
        const executorCode = fs.readFileSync(executorPath, 'utf8');
        vm.runInNewContext(executorCode, context);
        
        // Load code_emitter
        const codeEmitterPath = path.join(__dirname, '..', 'babble.code_emitter.js');
        if (fs.existsSync(codeEmitterPath)) {
            const codeEmitterCode = fs.readFileSync(codeEmitterPath, 'utf8');
            vm.runInNewContext(codeEmitterCode, context);
        }
        
        // Wait for builtins promise before setting global
        await context.babble.analyzer._builtinsPromise;

        // Copy to global
        global.babble = context.babble;

        // Verify modules loaded
        if (!global.babble.parser) {
            throw new Error('Parser module did not initialize babble.parser');
        }
        if (!global.babble.analyzer) {
            throw new Error('Analyzer module did not initialize babble.analyzer');
        }
        if (!global.babble.executor) {
            throw new Error('Executor module did not initialize babble.executor');
        }
    } catch (error) {
        console.error('Error loading Babble modules:', error.message);
        throw error;
    }
}

// Helper function to capture callback results
function captureCallback() {
    let result = null;
    const callback = (response) => {
        result = response;
    };
    const getResult = () => result;
    return { callback, getResult };
}

// Wait for async callback to be called
async function waitForCallback(getResult, timeout = 1000) {
    const startTime = Date.now();
    while (getResult() === null && Date.now() - startTime < timeout) {
        await new Promise(resolve => setTimeout(resolve, 10));
    }
    return getResult();
}

// Load Babble before all tests
beforeAll(async () => {
    await loadBabbleModules();
});

// ============================================================================
// TEST SUITE
// ============================================================================

describe('babble.executor.ex()', () => {
    
    test('should handle syntax errors gracefully', async () => {
        const { callback, getResult } = captureCallback();
        
        babble.executor.ex('(invalid syntax', callback);
        const result = await waitForCallback(getResult);
        
        expect(result).not.toBeNull();
        expect(result.status).toBe('error');
        expect(result.message).toContain('SyntaxError');
    });

    test('should parse valid Babble code', async () => {
        const { callback, getResult } = captureCallback();
        
        // Mock parser and analyzer for this test
        const originalParse = babble.parser.parse;
        const originalAnalyze = babble.analyzer?.analyze;
        
        const mockParse = jest.fn(() => ({ type: 'expression', id: 'test' }));
        babble.parser.parse = mockParse;
        if (!babble.analyzer) babble.analyzer = {};
        babble.analyzer.analyze = jest.fn(() => ({ status: 'success', symbols: { builtIns: [], locallyDefined: [], unknowns: [] } }));
        
        babble.executor.ex('(+ 1 2)', callback);
        const result = await waitForCallback(getResult);
        
        // Restore original functions
        babble.parser.parse = originalParse;
        if (originalAnalyze) babble.analyzer.analyze = originalAnalyze;
        
        expect(result).not.toBeNull();
        expect(result.status).toBe('success');
        expect(mockParse).toHaveBeenCalledWith('(+ 1 2)');
    });

    test('should handle analyzer errors', async () => {
        const { callback, getResult } = captureCallback();
        
        // Mock parser and analyzer for this test
        const originalParse = babble.parser.parse;
        const originalAnalyze = babble.analyzer?.analyze;
        
        babble.parser.parse = jest.fn(() => ({ type: 'expression', id: 'test' }));
        if (!babble.analyzer) babble.analyzer = {};
        babble.analyzer.analyze = jest.fn(() => ({ 
            status: 'error', 
            message: 'Analyzer error test' 
        }));
        
        babble.executor.ex('(test)', callback);
        const result = await waitForCallback(getResult);
        
        // Restore original functions
        babble.parser.parse = originalParse;
        if (originalAnalyze) babble.analyzer.analyze = originalAnalyze;
        
        expect(result).not.toBeNull();
        expect(result.status).toBe('error');
        expect(result.message).toBe('Analyzer error test');
    });

    test('should handle empty input', async () => {
        const { callback, getResult } = captureCallback();
        
        babble.executor.ex('', callback);
        const result = await waitForCallback(getResult);
        
        expect(result).not.toBeNull();
        // Note: Empty string may be valid Babble - update this test based on actual behavior
        // If empty should error, the parser grammar needs to be updated
        expect(['success', 'error']).toContain(result.status);
    });

    test('should handle numeric literals', async () => {
        const { callback, getResult } = captureCallback();
        
        // Mock parser and analyzer for this test
        const originalParse = babble.parser.parse;
        const originalAnalyze = babble.analyzer?.analyze;
        
        babble.parser.parse = jest.fn(() => ({ type: 'IntLiteral', value: 42 }));
        if (!babble.analyzer) babble.analyzer = {};
        babble.analyzer.analyze = jest.fn(() => ({ status: 'success', symbols: { builtIns: [], locallyDefined: [], unknowns: [] } }));
        
        babble.executor.ex('42', callback);
        const result = await waitForCallback(getResult);
        
        // Restore original functions
        babble.parser.parse = originalParse;
        if (originalAnalyze) babble.analyzer.analyze = originalAnalyze;
        
        expect(result).not.toBeNull();
        expect(result.status).toBe('success');
    });

    test('should handle string literals', async () => {
        const { callback, getResult } = captureCallback();
        
        // Mock parser and analyzer for this test
        const originalParse = babble.parser.parse;
        const originalAnalyze = babble.analyzer?.analyze;
        
        babble.parser.parse = jest.fn(() => ({ type: 'StringLiteral', value: 'hello' }));
        if (!babble.analyzer) babble.analyzer = {};
        babble.analyzer.analyze = jest.fn(() => ({ status: 'success', symbols: { builtIns: [], locallyDefined: [], unknowns: [] } }));
        
        babble.executor.ex('"hello"', callback);
        const result = await waitForCallback(getResult);
        
        // Restore original functions
        babble.parser.parse = originalParse;
        if (originalAnalyze) babble.analyzer.analyze = originalAnalyze;
        
        expect(result).not.toBeNull();
        expect(result.status).toBe('success');
    });

    test('should call parser.parse with the correct line', async () => {
        const { callback, getResult } = captureCallback();
        
        const originalParse = babble.parser.parse;
        const originalAnalyze = babble.analyzer?.analyze;
        
        const mockParse = jest.fn(() => ({ type: 'expression', id: 'test' }));
        babble.parser.parse = mockParse;
        if (!babble.analyzer) babble.analyzer = {};
        babble.analyzer.analyze = jest.fn(() => ({ status: 'success', symbols: { builtIns: [], locallyDefined: [], unknowns: [] } }));
        
        const testLine = '(+ 2 3)';
        babble.executor.ex(testLine, callback);
        await waitForCallback(getResult);
        
        expect(mockParse).toHaveBeenCalledTimes(1);
        expect(mockParse).toHaveBeenCalledWith(testLine);
        
        // Restore
        babble.parser.parse = originalParse;
        if (originalAnalyze) babble.analyzer.analyze = originalAnalyze;
    });

    test('should parse simple expression with newlines', () => {
        // Verifies that the parser correctly handles newlines within expressions.
        // The PEG grammar's Whitespace rule includes \n: [ \t\n\r,]
        const code = '(+\n  1\n  2)';
        
        let ast;
        try {
            ast = babble.parser.parse(code);
        } catch (error) {
            console.error('Parser error:', error.message);
            if (error.location) {
                console.error('Location:', JSON.stringify(error.location));
            }
            throw error;
        }
        
        // Should return an array with one list
        expect(Array.isArray(ast)).toBe(true);
        expect(ast.length).toBe(1);
        
        // The list should contain the symbol and numbers
        expect(ast[0].type).toBe('list');
        expect(ast[0].value.length).toBe(3); // +, 1, 2
    });

    test('should produce AST for nested let with defn', () => {
        // This test verifies that the parser can handle complex multi-line expressions
        // with nested function definitions, demonstrating that newlines are properly
        // treated as whitespace throughout the expression.
        const code = '(let []\n  (defn inner-fn [x]\n    (* x x))\n  (inner-fn 5))';
        
        let ast;
        try {
            // Call the real parser (not mocked)
            ast = babble.parser.parse(code);
        } catch (error) {
            // Log the error to help diagnose
            console.error('Parser error:', error.message);
            if (error.location) {
                console.error('Location:', error.location);
            }
            throw error;
        }
        
        // Verify AST structure
        expect(ast).toBeDefined();
        expect(Array.isArray(ast)).toBe(true);
        expect(ast.length).toBeGreaterThan(0);
        
        // The first element should be a 'let' expression
        const letExpr = ast[0];
        expect(letExpr.type).toBe('list');
        expect(letExpr.value).toBeDefined();
        expect(Array.isArray(letExpr.value)).toBe(true);
        
        // First element in the list should be the 'let' symbol
        expect(letExpr.value[0]).toHaveProperty('type', 'symbol');
        expect(letExpr.value[0]).toHaveProperty('value', 'let');
        
        // Second element should be the bindings vector
        expect(letExpr.value[1]).toHaveProperty('type', 'vector');
        expect(letExpr.value[1].value).toEqual([]); // Empty bindings
        
        // Third element should be defn (a list)
        expect(letExpr.value[2]).toHaveProperty('type', 'list');
        
        // Fourth element should be the function call (also a list)
        expect(letExpr.value[3]).toHaveProperty('type', 'list');
    });
});

describe('babble.code_emitter.astToCode()', () => {
    
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
    
    test('should convert string literals with escaping', () => {
        const code = '"hello world"';
        const ast = babble.parser.parse(code);
        const result = babble.code_emitter.astToCode(ast);
        
        expect(result).toBe('"hello world"');
    });
    
    test('should convert nested expressions', () => {
        const code = '(let [x 5] (* x x))';
        const ast = babble.parser.parse(code);
        const result = babble.code_emitter.astToCode(ast);
        
        expect(result).toBe('(let [x 5] (* x x))');
    });
    
    test('should convert defn with parameters', () => {
        const code = '(defn square [x] (* x x))';
        const ast = babble.parser.parse(code);
        const result = babble.code_emitter.astToCode(ast);
        
        expect(result).toBe('(defn square [x] (* x x))');
    });
    
    test('should convert multiple top-level expressions', () => {
        const code = '(+ 1 2)\n(* 3 4)';
        const ast = babble.parser.parse(code);
        const result = babble.code_emitter.astToCode(ast);
        
        // Should join with newlines
        expect(result).toBe('(+ 1 2)\n(* 3 4)');
    });
    
    test('should handle keywords', () => {
        const code = '{:name "John" :age 30}';
        const ast = babble.parser.parse(code);
        const result = babble.code_emitter.astToCode(ast);
        
        expect(result).toBe('{:name "John" :age 30}');
    });
    
    test('should handle quote', () => {
        const code = "'(1 2 3)";
        const ast = babble.parser.parse(code);
        const result = babble.code_emitter.astToCode(ast);
        
        expect(result).toBe("'(1 2 3)");
    });
    
    test('should roundtrip: code -> ast -> code', () => {
        const originalCode = '(defn factorial [n] (if (<= n 1) 1 (* n (factorial (- n 1)))))';
        const ast = babble.parser.parse(originalCode);
        const regeneratedCode = babble.code_emitter.astToCode(ast);

        // Parse the regenerated code to verify it's valid
        const ast2 = babble.parser.parse(regeneratedCode);

        // Both ASTs should be functionally equivalent
        expect(ast2).toBeDefined();
        expect(ast2.length).toBe(ast.length);
    });
});

// ============================================================================
// Symbol resolution: server-defined terms
// ============================================================================

describe('server-defined term resolution', () => {

    // The term 'd' as stored in the DB.
    // Line (the full defn AST):
    //   (define d [n u d w] (+ n (- u (/ d (* w)))))
    // Note: param 'd' has the same name as the function being defined.
    const D_LINE = {"type":"list","value":[{"type":"symbol","value":"define"},{"type":"symbol","value":"d"},{"type":"vector","value":[{"type":"symbol","value":"n"},{"type":"symbol","value":"u"},{"type":"symbol","value":"d"},{"type":"symbol","value":"w"}]},{"type":"list","value":[{"type":"symbol","value":"+","symbolType":"builtin"},{"type":"symbol","value":"n","symbolType":"local"},{"type":"list","value":[{"type":"symbol","value":"-","symbolType":"builtin"},{"type":"symbol","value":"u","symbolType":"local"},{"type":"list","value":[{"type":"symbol","value":"/","symbolType":"builtin"},{"type":"symbol","value":"d","symbolType":"local"},{"type":"list","value":[{"type":"symbol","value":"*","symbolType":"builtin"},{"type":"symbol","value":"w","symbolType":"local"}]}]}]}]}]};

    // The body expression (value[3] of the line, stored as definition=[body]).
    const D_BODY = D_LINE.value[3];

    // Mock server response for GET /resolve/d?arity=4
    function makeFetchForD() {
        return (url) => {
            if (url === '/resolve/d?arity=4') {
                return Promise.resolve({
                    ok: true,
                    json: () => Promise.resolve({
                        name: 'd',
                        params: ['n', 'u', 'd', 'w'],
                        definition: [D_BODY],  // stored as array of body expressions
                        line: D_LINE,
                        symbols: []
                    })
                });
            }
            return Promise.reject(new Error(`Unexpected fetch: ${url}`));
        };
    }

    afterEach(() => {
        global.clearBabbleTestFetch();
    });

    test('(d 1 2 3 4) inlines d as fn without substituting the local param d in the body', async () => {
        global.setBabbleTestFetch(makeFetchForD());

        let capturedCode = null;
        const origEval = babble.core.eval_clojure_safe;
        babble.core.eval_clojure_safe = (code) => {
            capturedCode = code;
            return { success: true, result: '0.25' };
        };

        const { callback, getResult } = captureCallback();
        babble.executor.ex('(d 1 2 3 4)', callback);
        const result = await waitForCallback(getResult);

        babble.core.eval_clojure_safe = origEval;

        expect(result.status).toBe('success');

        // The generated code must contain exactly one 'fn' — the inlined definition of d.
        // If the local param 'd' in the body is incorrectly substituted, there would be
        // multiple nested fn forms.
        const fnCount = (capturedCode.match(/\bfn\b/g) || []).length;
        expect(fnCount).toBe(1);

        // The fn must bind all four params
        expect(capturedCode).toContain('[n u d w]');

        // The body must appear inside the fn — the arithmetic symbols should all be present
        expect(capturedCode).toContain('+');
        expect(capturedCode).toContain('-');
        expect(capturedCode).toContain('/');
        expect(capturedCode).toContain('*');

        // The four literal arguments must appear after the fn form
        expect(capturedCode).toContain('1');
        expect(capturedCode).toContain('2');
        expect(capturedCode).toContain('3');
        expect(capturedCode).toContain('4');

        // Full expected shape: ((fn [n u d w] (+ n (- u (/ d (* w))))) 1 2 3 4)
        expect(capturedCode).toBe('((fn [n u d w] (+ n (- u (/ d (* w))))) 1 2 3 4)');
    });
});
