# Babble

The programming language where globals are truly global.

## Overview

The Babble server, web interface, and node-based interpreter (in progress).

A Clojure-like LISP where `define` adds to the standard library, available to all other programmers immediately.

## Architecture

The project consists of four main components:

### 🔧 Parser
- **Language**: PEG.js grammar definition and executor
- **Location**: `/Parser/`
- **Files**: 
  - `babble.pegjs` - Grammar definition
  - `babble.parser.js` - Generated parser
  - `babble.executor.js` - Runtime executor
  - `babble.analyzer.js` - AST analyzer
  - `babble.code_emitter.js` - AST to code converter

### 🖥️ Server
- **Language**: C# (.NET 9.0)
- **Location**: `/Server/`
- **Description**: ASP.NET Core web application providing Babble execution environment and API
- **Features**:
  - API for lexicon, used by both Server and Client
  - Database for lexicon storage
  - Web-based console interface

### 📱 Client
- **Language**: Node.js
- **Location**: `/Client/`
- **Description**: Standalone Node.js application for running Babble code
= **NOTE**: Still very much in progress, basically not functional atm
- **Features**:
  - Command-line execution environment
  - Parser integration

### ⚡ ClojureScript Executor
- **Language**: ClojureScript
- **Location**: `/ClojureExecutor/`
- **Description**: ClojureScript-based execution engine compiled to JavaScript

> [!WARNING]
> NOTE: If you make changes to the pegjs, you have to do a full build

## Language Features

## Quick Start

### Prerequisites
- .NET 9.0 SDK
- Node.js (for client and ClojureScript executor)
- Java JDK 11+ (for ClojureScript compilation)
- Clojure CLI tools (optional, for ClojureScript development)
- Modern web browser

### Running the Server

1. **Build and run the server**:
   ```bash
   cd Server
   dotnet run
   ```
2. **Access the web interface**:
   Open your browser to `https://localhost:5001` (or the port shown in terminal)

### Running the Client

1. **Install dependencies**:
   ```bash
   cd Client
   npm install
   ```

2. **Build entire solution**:
   ```bash
   # Build entire solution
   dotnet build Babble.sln
   
   # Run specific project
   dotnet run --project Server/Babble.csproj
   ```

The compiled JavaScript will be output to `Server/wwwroot/executor/` and automatically served by the server.

The ClojureScript executor is automatically included in the main `index.html` page and provides safe, sandboxed ClojureScript evaluation accessible via `babble.core.eval_clojure_safe()`.

## License

MIT License - see [LICENSE](LICENSE) file for details.

## Author

Daniel Temkin - https://danieltemkin.com/Esolangs
