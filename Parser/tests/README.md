# Babble Parser Tests

Automated test suite for the Babble parser and executor using **Jest**.

## Running Tests

### Installation
```bash
npm install
```

### Run Tests
```bash
# Run all tests
npm test

# Run tests in watch mode (auto-rerun on changes)
npm run test:watch

# Run tests with coverage report
npm run test:coverage
```

## Test Output

Jest provides rich output including:
- ✅ Passed tests
- ❌ Failed tests with detailed error messages
- 📊 Test execution time
- 📈 Code coverage (when using `--coverage`)

Exit code:
- `0` if all tests pass
- `1` if any test fails

## Writing New Tests

Add new tests using Jest syntax:

```javascript
test('description of test', async () => {
    const { callback, getResult } = captureCallback();
    
    babble.executor.ex('(your code)', callback);
    const result = await waitForCallback(getResult);
    
    expect(result.status).toBe('success');
    expect(result.message).toContain('expected text');
});
```

### Jest Matchers
- `expect(value).toBe(expected)` - Strict equality
- `expect(value).toEqual(expected)` - Deep equality
- `expect(value).toContain(item)` - Contains
- `expect(fn).toHaveBeenCalled()` - Mock was called
- And many more...

## Mocking with Jest

Jest provides built-in mocking:

```javascript
const mockFn = jest.fn(() => 'return value');
babble.parser.parse = mockFn;

// Later...
expect(mockFn).toHaveBeenCalledWith('expected argument');
expect(mockFn).toHaveBeenCalledTimes(1);
```

## Test Structure

```
Parser/tests/
├── babble.executor.test.js  # Test suite
├── package.json              # Jest configuration
└── README.md                 # This file
```

## Jest Configuration

Configuration is in `package.json`:
```json
{
  "jest": {
    "testEnvironment": "node",
    "testMatch": ["**/*.test.js"],
    "verbose": true
  }
}
```

## CI/CD Integration

Jest is CI-friendly:

```bash
cd Parser/tests
npm install
npm test
```

Jest will exit with code 1 if any tests fail, perfect for CI pipelines.

## Coverage Reports

Generate HTML coverage reports:

```bash
npm run test:coverage
```

Coverage reports are saved to `coverage/` directory.
