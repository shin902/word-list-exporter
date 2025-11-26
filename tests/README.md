# Testing Strategy

This project uses Jest for testing and is divided into two separate test environments to handle the different contexts of the application: a Node.js environment for the backend API and a JSDOM environment for the frontend logic.

## Test Environments

### 1. Node.js Environment (`jest.config.node.js`)

- **Purpose**: To test the backend API, including middleware, routes, and utility functions.
- **Configuration**: `jest.config.node.js`
- **Setup File**: `tests/setup-node.js`
- **Test Location**:
    - `api/__tests__/**/*.test.js`
    - `tests/integration/**/*.test.js`
    - `tests/repro_vuln_*.test.js`
    - `tests/vuln-*.test.js`

### 2. JSDOM Environment (`jest.config.jsdom.js`)

- **Purpose**: To test the frontend logic contained in `public/app.js`, which interacts with the DOM.
- **Configuration**: `jest.config.jsdom.js`
- **Setup File**: `tests/setup.js`
- **Test Location**:
    - `tests/unit/**/*.test.js`

## How to Add New Tests

- **For backend/API changes**: Add your test file to a location that matches the `testMatch` pattern in `jest.config.node.js`.
- **For frontend/DOM changes**: Add your test file to a location that matches the `testMatch` pattern in `jest.config.jsdom.js`.

## Running Tests

To run all tests for both environments, use the following command:

```bash
npm test
```

This command sequentially runs the tests for the `jsdom` environment and then the `node` environment, ensuring complete test coverage for the entire application.
