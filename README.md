# Babble

The programming language where globals are truly global.

## Overview

The Babble server, web interface, and node-based interpreter (in progress).

## Architecture

The project consists of three main components:

### 🔧 Parser
- **Language**: PEG.js grammar definition and executor
- **Location**: `/Parser/`
- **Files**: 
  - `babble.pegjs` - Grammar definition
  - `babble.parser.js` - Generated parser
  - `babble.executor.js` - Runtime executor

### 🖥️ Server
- **Language**: C# (.NET 9.0)
- **Location**: `/Server/`
- **Description**: ASP.NET Core web application providing Babble execution environment and API
- **Features**:
  - Web-based console interface
  - API for client
  - Database for lexicon storage

### 📱 Client
- **Language**: Node.js
- **Location**: `/Client/`
- **Description**: Standalone Node.js application for running Babble code
- **Features**:
  - Command-line execution environment
  - Parser integration

> [!WARNING]
> NOTE: If you make changes to the prgjs, you have to build the Client and then the Server!

## Language Features

## Quick Start

### Prerequisites
- .NET 9.0 SDK
- Node.js (for client)
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

2. **Build the parser**:
   ```bash
   npm run build
   ```

3. **Start the client**:
   ```bash
   npm start
   ```

### Building the Solution

The project includes a Visual Studio solution file for easy development:

```bash
# Build entire solution
dotnet build Babble.sln

# Run specific project
dotnet run --project Server/Babble.csproj
```

## License

MIT License - see [LICENSE](LICENSE) file for details.

## Author

Daniel Temkin - https://danieltemkin.com/Esolangs

---

ChatGPT made this slogan:
*Babble: Where your variables are everyone's variables.*
