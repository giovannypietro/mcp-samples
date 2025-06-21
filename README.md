# Simple MCP Agent and Server

This project implements a simple Model Context Protocol (MCP) server and client using HTTP stream transport, fully compliant with the [MCP specification](https://modelcontextprotocol.io/introduction).

## Overview

The Model Context Protocol (MCP) is an open protocol that standardizes how applications provide context to LLMs. This implementation demonstrates:

- A fully MCP-compliant server with proper JSON-RPC 2.0 protocol
- A client/agent that connects to the server using standard MCP methods
- HTTP stream transport for communication
- WebSocket support for real-time communication
- Proper error handling and validation

## MCP Compliance

This implementation follows the official MCP specification:

- **JSON-RPC 2.0**: All requests and responses use the JSON-RPC 2.0 format
- **Standard Methods**: Uses official MCP method names (`tools/list`, `tools/call`, `resources/list`, `resources/read`, `server/info`)
- **Error Codes**: Implements standard MCP error codes and error handling
- **Type Safety**: Full TypeScript support with proper MCP type definitions

## Architecture

### MCP Server
The server provides:
- **Tools**: `get_current_time`, `calculate`, `echo`
- **Resources**: `simple://server-info`, `simple://system-status`
- **Transport**: HTTP POST endpoint and WebSocket support
- **Protocol**: JSON-RPC 2.0 compliant

### MCP Client/Agent
The client can:
- Connect via HTTP or WebSocket
- Use proper MCP protocol methods
- Handle JSON-RPC 2.0 responses and errors
- Demonstrate MCP functionality

## Installation

1. Install dependencies:
```bash
npm install
```

2. Build the project:
```bash
npm run build
```

## Usage

### Start the Server

```bash
npm run server
```

The server will start on `http://localhost:3000` with:
- HTTP endpoint: `POST /mcp` (JSON-RPC 2.0)
- WebSocket endpoint: `ws://localhost:3000`
- Health check: `GET /health`

### Run the Client/Agent

```bash
npm run client
```

The agent will:
1. Connect to the MCP server
2. Get server information
3. List available tools and resources
4. Demonstrate tool calls
5. Read resources
6. Display results

### Test HTTP Transport

```bash
npm run test
```

Tests the HTTP transport with various MCP methods and error conditions.

## MCP Protocol Implementation

### Request Format (JSON-RPC 2.0)
```json
{
  "jsonrpc": "2.0",
  "id": "1",
  "method": "tools/list",
  "params": {}
}
```

### Response Format (JSON-RPC 2.0)
```json
{
  "jsonrpc": "2.0",
  "id": "1",
  "result": {
    "tools": [...]
  }
}
```

### Error Response Format
```json
{
  "jsonrpc": "2.0",
  "id": "1",
  "error": {
    "code": -32601,
    "message": "Method not found"
  }
}
```

## Available MCP Methods

### Tools
- `tools/list` - List available tools
- `tools/call` - Call a tool with parameters

### Resources
- `resources/list` - List available resources
- `resources/read` - Read a resource by URI

### Server
- `server/info` - Get server information

## Available Tools

### get_current_time
Returns the current date and time in ISO format.

### calculate
Performs basic mathematical calculations.
```json
{
  "jsonrpc": "2.0",
  "id": "1",
  "method": "tools/call",
  "params": {
    "name": "calculate",
    "arguments": {
      "expression": "2 + 3 * 4"
    }
  }
}
```

### echo
Echoes back the input message.
```json
{
  "jsonrpc": "2.0",
  "id": "1",
  "method": "tools/call",
  "params": {
    "name": "echo",
    "arguments": {
      "message": "Hello, MCP!"
    }
  }
}
```

## Available Resources

### simple://server-info
Returns basic server information in plain text format.

### simple://system-status
Returns system status and statistics in JSON format.

## MCP Error Codes

The implementation uses standard JSON-RPC 2.0 error codes:
- `-32700`: Parse error
- `-32600`: Invalid request
- `-32601`: Method not found
- `-32602`: Invalid params
- `-32603`: Internal error

## Development

### Project Structure
```
src/
├── mcp-types.ts    # MCP protocol type definitions
├── server.ts       # MCP server implementation
├── client.ts       # MCP client/agent implementation
├── test-http.ts    # HTTP transport test
└── index.ts        # Main entry point
```

### Scripts
- `npm run build` - Build TypeScript to JavaScript
- `npm run server` - Start the MCP server
- `npm run client` - Run the MCP client/agent
- `npm run test` - Test HTTP transport
- `npm run dev` - Run in development mode

## Transport Layer

### HTTP Transport
- **Endpoint**: `POST /mcp`
- **Content-Type**: `application/json`
- **Protocol**: JSON-RPC 2.0 over HTTP
- **Streaming**: Chunked transfer encoding

### WebSocket Transport
- **Endpoint**: `ws://localhost:3000`
- **Protocol**: JSON-RPC 2.0 over WebSocket
- **Real-time**: Bidirectional communication

## Security Notes

- The `calculate` tool uses `eval()` for demonstration purposes. In production, use a safer mathematical expression parser.
- The server includes CORS headers for web client access.
- Consider implementing authentication for production use.
- All input is validated according to MCP specification.

## References

- [Model Context Protocol Documentation](https://modelcontextprotocol.io/introduction)
- [MCP Specification](https://modelcontextprotocol.io/specification)
- [MCP Architecture](https://modelcontextprotocol.io/architecture)
- [JSON-RPC 2.0 Specification](https://www.jsonrpc.org/specification) 