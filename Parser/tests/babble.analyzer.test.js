/**
 * @jest-environment node
 */

const fs = require('fs');
const path = require('path');
const vm = require('vm');

// Mirror of SemanticInterpreter.GetAllBuiltIns() — used to mock the /builtins endpoint.
const MOCK_BUILTINS = [
    '+', '-', '*', '/', 'inc', 'dec', 'quot', 'rem', 'mod', 'max', 'min', 'compare', '=', '==', '<', '>', '<=', '>=',
    'if', 'if-not', 'when', 'when-not', 'cond', 'case', 'condp', 'if-let', 'when-let', 'loop', 'recur', 'do', 'let', 'letfn',
    'cons', 'list', 'conj', 'seq', 'first', 'rest', 'nth', 'peek', 'pop',
    'vec', 'vector', 'vector?', 'map', 'hash-map', 'assoc', 'dissoc', 'get', 'keys', 'vals',
    'merge', 'select-keys', 'zipmap', 'set', 'hash-set', 'sorted-set', 'disj',
    'clojure.set/union', 'clojure.set/intersection', 'clojure.set/difference',
    'nil?', 'true?', 'false?', 'empty?', 'some?', 'every?', 'not-any?', 'not-every?',
    'number?', 'integer?', 'float?', 'ratio?', 'string?', 'keyword?', 'symbol?',
    'map?', 'vector?', 'list?', 'set?', 'seq?', 'coll?', 'fn?', 'ifn?',
    'associative?', 'sequential?', 'sorted?', 'counted?', 'reversible?',
    'fn', 'defn', 'defn-', 'partial', 'comp', 'complement', 'constantly', 'identity',
    'apply', 'filter', 'remove', 'juxt', 'memoize', 'repeatedly', 'iterate',
    'reduce', 'take', 'drop',
    'ns', 'in-ns', 'create-ns', 'find-ns', 'remove-ns', 'refer', 'require', 'use',
    'alias', 'ns-resolve', 'ns-name', 'ns-map', 'ns-publics', 'ns-imports',
    'ns-unmap', 'ns-unalias', 'ns-interns', 'ns-refers', 'ns-aliases', 'ns-keys',
    'with-meta', 'meta', 'vary-meta',
    '->', '->>', 'as->', 'some->', 'some->>',
    'doc', 'pst', 'find-doc', 'dir', 'apropos', 'prn', 'println', 'print', 'clojure.pprint/pprint',
    'source', 'desc', 'man',
    'symbol', 'symbol?', 'gensym', 'keyword', 'keyword?', 'find-keyword', 'true', 'false', 'nil',
    'abs', 'rand', 'rand-int', 'bit-and', 'bit-or', 'bit-xor', 'bit-not', 'bit-shift-left', 'bit-shift-right',
    'slurp', 'spit', 'read-line', 'read-string', 'pr-str', 'str', 'format',
    'quote', 'eval', 'time', 'assert', 'delay', 'force', 'future', 'promise',
    'deref', 'atom', 'swap!', 'reset!', 'compare-and-set!', 'add-watch', 'remove-watch',
    'not', 'and', 'or', 'count', 'update',
];

/**
 * Loads the Babble modules (parser, analyzer, executor) in a VM context,
 * injecting a mock fetch that returns MOCK_BUILTINS for the /builtins endpoint.
 */
async function loadBabbleModules() {
    const parserCode = fs.readFileSync(path.join(__dirname, '../babble.parser.js'), 'utf8');
    const analyzerCode = fs.readFileSync(path.join(__dirname, '../babble.analyzer.js'), 'utf8');
    const executorCode = fs.readFileSync(path.join(__dirname, '../babble.executor.js'), 'utf8');

    const context = {
        babble: {},
        console: console,
        setTimeout: setTimeout,
        clearTimeout: clearTimeout,
        setInterval: setInterval,
        clearInterval: clearInterval,
        fetch: (url) => {
            if (url === '/builtins') {
                return Promise.resolve({
                    ok: true,
                    json: () => Promise.resolve(MOCK_BUILTINS),
                });
            }
            return Promise.reject(new Error(`Unexpected fetch in test: ${url}`));
        },
    };

    vm.runInNewContext(parserCode, context);
    vm.runInNewContext(analyzerCode, context);
    vm.runInNewContext(executorCode, context);

    // Wait for the builtins promise to resolve before any test runs.
    await context.babble.analyzer._builtinsPromise;

    return context.babble;
}

let babble;

beforeAll(async () => {
    babble = await loadBabbleModules();
});

// ============================================================================
// ANALYZER TESTS FOR DEF, DEFN, AND DEFINE
// ============================================================================

describe('babble.analyzer def/defn/define validation', () => {

    describe('def/defn validation', () => {
        test('should reject def — use define instead', async () => {
            const code = '(def x 42)';
            const ast = babble.parser.parse(code);
            const result = await babble.analyzer.analyze(ast);
            expect(result.status).toBe('error');
            expect(result.message).toContain("use 'define' instead");
        });

        test('should reject defn — use define instead', async () => {
            const code = '(defn x [] (+ 4 42))';
            const ast = babble.parser.parse(code);
            const result = await babble.analyzer.analyze(ast);
            expect(result.status).toBe('error');
            expect(result.message).toContain("use 'define' instead");
        });
    });

    describe('define validation', () => {
        test('should accept define as def', async () => {
            const code = '(define x 42)';
            const ast = babble.parser.parse(code);
            const result = await babble.analyzer.analyze(ast);
            expect(result.status).toBe('success');
        });

        test('should accept define as def with docstring', async () => {
            const code = '(define x "my variable" 42)';
            const ast = babble.parser.parse(code);
            const result = await babble.analyzer.analyze(ast);
            expect(result.status).toBe('success');
        });

        test('should accept define as defn', async () => {
            const code = '(define square [x] (* x x))';
            const ast = babble.parser.parse(code);
            const result = await babble.analyzer.analyze(ast);
            expect(result.status).toBe('success');
        });

        test('should accept define as defn with docstring', async () => {
            const code = '(define square "Squares a number" [x] (* x x))';
            const ast = babble.parser.parse(code);
            const result = await babble.analyzer.analyze(ast);
            expect(result.status).toBe('success');
        });

        test('should accept define as multi-arity defn', async () => {
            const code = '(define add ([x] x) ([x y] (+ x y)))';
            const ast = babble.parser.parse(code);
            const result = await babble.analyzer.analyze(ast);
            expect(result.status).toBe('success');
        });

        test('should reject define at non-top-level', async () => {
            const code = '(let [] (define x 42))';
            const ast = babble.parser.parse(code);
            const result = await babble.analyzer.analyze(ast);
            expect(result.status).toBe('error');
            expect(result.message).toContain('can only be used at the top level');
        });
    });

    // -------------------------------------------------------------------------
    // define with body-expression (no explicit params vector)
    // -------------------------------------------------------------------------
    describe('define — body-expression shorthand (no params vector)', () => {
        test('(define r (+ 1 2)) — should succeed with + as builtin', async () => {
            const code = '(define r (+ 1 2))';
            const ast = babble.parser.parse(code);
            const result = await babble.analyzer.analyze(ast);
            expect(result.status).toBe('success');
            expect(result.symbols.builtIns).toContain('+');
            expect(result.symbols.unknowns).toEqual([]);
        });

        test('(define r [] (+ 1 2)) — explicit empty params', async () => {
            const code = '(define r [] (+ 1 2))';
            const ast = babble.parser.parse(code);
            const result = await babble.analyzer.analyze(ast);
            expect(result.status).toBe('success');
            expect(result.symbols.builtIns).toContain('+');
            expect(result.symbols.unknowns).toEqual([]);
        });

        test('(define r [n] (+ 1 n)) — single param', async () => {
            const code = '(define r [n] (+ 1 n))';
            const ast = babble.parser.parse(code);
            const result = await babble.analyzer.analyze(ast);
            expect(result.status).toBe('success');
            expect(result.symbols.builtIns).toContain('+');
            expect(result.symbols.locallyDefined).toContain('n');
            expect(result.symbols.unknowns).toEqual([]);
        });
    });
});

// ============================================================================
// ANALYZER TESTS FOR SYMBOL TRACKING
// ============================================================================

describe('babble.analyzer symbol tracking', () => {

    test('should track built-in symbols', async () => {
        const code = '(+ 1 2)';
        const ast = babble.parser.parse(code);
        const result = await babble.analyzer.analyze(ast);

        expect(result.status).toBe('success');
        expect(result.symbols).toBeDefined();
        expect(result.symbols.builtIns).toContain('+');
        expect(result.symbols.locallyDefined).toEqual([]);
        expect(result.symbols.unknowns).toEqual([]);
    });

    test('should mark built-in symbols in AST', async () => {
        const code = '(+ 1 2)';
        const ast = babble.parser.parse(code);
        const result = await babble.analyzer.analyze(ast);

        const plusSymbol = result.ast[0].value[0];
        expect(plusSymbol.type).toBe('symbol');
        expect(plusSymbol.value).toBe('+');
        expect(plusSymbol.symbolType).toBe('builtin');
    });

    test('should track locally-defined symbols', async () => {
        const code = '(let [x 5] (* x 2))';
        const ast = babble.parser.parse(code);
        const result = await babble.analyzer.analyze(ast);

        expect(result.status).toBe('success');
        expect(result.symbols.builtIns).toContain('*');
        expect(result.symbols.locallyDefined).toContain('x');
    });

    test('should mark local symbols in AST', async () => {
        const code = '(let [x 5] x)';
        const ast = babble.parser.parse(code);
        const result = await babble.analyzer.analyze(ast);

        // Find the 'x' symbol in the body (not the binding)
        const letForm = result.ast[0];
        const bodyX = letForm.value[2]; // Third element is the body 'x'

        expect(bodyX.type).toBe('symbol');
        expect(bodyX.value).toBe('x');
        expect(bodyX.symbolType).toBe('local');
    });

    test('should track unknown symbols', async () => {
        const code = '(my-fn 1 2)';
        const ast = babble.parser.parse(code);
        const result = await babble.analyzer.analyze(ast);

        expect(result.status).toBe('success');
        expect(result.symbols.unknowns).toContainEqual({ name: 'my-fn', arity: 2 });
        expect(result.symbols.builtIns).toEqual([]);
        expect(result.symbols.locallyDefined).toEqual([]);
    });

    test('should mark unknown symbols in AST', async () => {
        const code = '(my-fn 1)';
        const ast = babble.parser.parse(code);
        const result = await babble.analyzer.analyze(ast);

        const myFnSymbol = result.ast[0].value[0];
        expect(myFnSymbol.type).toBe('symbol');
        expect(myFnSymbol.value).toBe('my-fn');
        expect(myFnSymbol.symbolType).toBe('unknown');
    });

    test('should track mixed symbol types', async () => {
        const code = '(let [x 5] (+ x (custom-fn 3)))';
        const ast = babble.parser.parse(code);
        const result = await babble.analyzer.analyze(ast);

        expect(result.status).toBe('success');
        expect(result.symbols.builtIns).toContain('+');
        expect(result.symbols.locallyDefined).toContain('x');
        expect(result.symbols.unknowns).toContainEqual({ name: 'custom-fn', arity: 1 });
    });

    test('should track symbols in define parameters', async () => {
        const code = '(define square [x] (* x x))';
        const ast = babble.parser.parse(code);
        const result = await babble.analyzer.analyze(ast);

        expect(result.status).toBe('success');
        expect(result.symbols.builtIns).toContain('*');
        expect(result.symbols.locallyDefined).toContain('x');
    });

    test('should not track special symbols', async () => {
        const code = '(fn [& rest] rest)';
        const ast = babble.parser.parse(code);
        const result = await babble.analyzer.analyze(ast);

        expect(result.status).toBe('success');
        // '&' should not appear in any category
        expect(result.symbols.builtIns).not.toContain('&');
        expect(result.symbols.locallyDefined).not.toContain('&');
        expect(result.symbols.unknowns.every(u => u.name !== '&')).toBe(true);
    });
});
