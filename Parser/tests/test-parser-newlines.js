// Simple test to verify the parser handles newlines
const fs = require('fs');
const path = require('path');
const vm = require('vm');

// Load parser
const parserPath = path.join(__dirname, '..', 'babble.parser.js');
const parserCode = fs.readFileSync(parserPath, 'utf8');

const context = {
    babble: {}
};

vm.runInNewContext(parserCode, context);

console.log('Parser loaded:', !!context.babble.parser);

// Test 1: Simple expression with newlines
const test1 = '(+\n  1\n  2)';
console.log('\nTest 1: Simple expression with newlines');
console.log('Input:', JSON.stringify(test1));
try {
    const result1 = context.babble.parser.parse(test1);
    console.log('✓ Success!');
    console.log('Result:', JSON.stringify(result1, null, 2));
} catch (error) {
    console.log('✗ Failed:', error.message);
    if (error.location) {
        console.log('Location:', JSON.stringify(error.location));
    }
}

// Test 2: Complex nested expression
const test2 = '(let []\n  (defn inner-fn [x]\n    (* x x))\n  (inner-fn 5))';
console.log('\nTest 2: Complex nested expression');
console.log('Input:', JSON.stringify(test2));
try {
    const result2 = context.babble.parser.parse(test2);
    console.log('✓ Success!');
    console.log('Result:', JSON.stringify(result2, null, 2));
} catch (error) {
    console.log('✗ Failed:', error.message);
    if (error.location) {
        console.log('Location:', JSON.stringify(error.location));
    }
}

// Test 3: Same expression without newlines
const test3 = '(let [] (defn inner-fn [x] (* x x)) (inner-fn 5))';
console.log('\nTest 3: Same expression without newlines');
console.log('Input:', JSON.stringify(test3));
try {
    const result3 = context.babble.parser.parse(test3);
    console.log('✓ Success!');
    console.log('Result:', JSON.stringify(result3, null, 2));
} catch (error) {
    console.log('✗ Failed:', error.message);
    if (error.location) {
        console.log('Location:', JSON.stringify(error.location));
    }
}
