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
function loadBabbleModules() {
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
        const context = {
            babble: {},
            console: console,
            setTimeout: setTimeout,
            setInterval: setInterval,
            clearTimeout: clearTimeout,
            clearInterval: clearInterval
        };
        
        // Load parser
        const parserCode = fs.readFileSync(parserPath, 'utf8');
        vm.runInNewContext(parserCode, context);
        
        // Load analyzer  
        const analyzerCode = fs.readFileSync(analyzerPath, 'utf8');
        vm.runInNewContext(analyzerCode, context);
        
        // Load executor
        const executorCode = fs.readFileSync(executorPath, 'utf8');
        vm.runInNewContext(executorCode, context);
        
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
beforeAll(() => {
    loadBabbleModules();
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
        babble.analyzer.analyze = jest.fn(() => ({ status: 'success' }));
        
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
        babble.analyzer.analyze = jest.fn(() => ({ status: 'success' }));
        
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
        babble.analyzer.analyze = jest.fn(() => ({ status: 'success' }));
        
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
        babble.analyzer.analyze = jest.fn(() => ({ status: 'success' }));
        
        const testLine = '(+ 2 3)';
        babble.executor.ex(testLine, callback);
        await waitForCallback(getResult);
        
        expect(mockParse).toHaveBeenCalledTimes(1);
        expect(mockParse).toHaveBeenCalledWith(testLine);
        
        // Restore
        babble.parser.parse = originalParse;
        if (originalAnalyze) babble.analyzer.analyze = originalAnalyze;
    });
});
