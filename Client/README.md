# Babble Client

A Node.js application to run Babble code.

## Setup

1. Install dependencies:
   ```bash
   npm install
   ```

2. Run the build process to copy Parser contents:
   ```bash
   npm run build
   ```

3. Start the application:
   ```bash
   npm start
   ```

## Scripts

- `npm run build` - Copies contents from ../Parser to ./parser
- `npm start` - Starts the client
- `npm run dev` - Starts the client in development mode
- `npm run clean` - Removes parser and dist directories

## API Endpoints

- `GET /` - Basic API info and parser availability status
- `GET /parser-status` - Detailed parser directory status and file listing

## Build Process

The build script (`scripts/build.js`) will:
1. Look for a `Parser` directory in the parent Babble folder
2. Copy all contents to a local `parser` subfolder
3. Provide feedback on the copy operation

If the Parser directory is not found, the build will fail with an error message.
