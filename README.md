# Simple MCP Agent and Server with OAuth 2.1 Authorization

This project implements an example and simple Model Context Protocol (MCP) server and client (for the purpose of showcasing agent and MCP server authorization support) using HTTP stream transport with **OAuth 2.1 authorization**, fully compliant with the [MCP authorization specification](https://modelcontextprotocol.io/specification/2025-06-18/basic/authorization). This project uses Strata Maverics for the OAuth/OIDC authentication and authorization platform. See more information at [Maverics Identity for agentic AI](https://www.strata.io/agentic/).

## Overview

The Model Context Protocol (MCP) is an open protocol that standardizes how applications provide context to LLMs. This example implementation demonstrates:

- A fully MCP-compliant server with proper JSON-RPC 2.0 protocol
- **OAuth 2.1 authorization** with PKCE, dynamic client registration, and resource indicators
- A client/agent that connects to the server using standard MCP methods with OAuth authentication
- HTTP stream transport for communication
- WebSocket support for real-time communication
- Proper error handling and validation

## MCP Authorization Compliance

This implementation follows the official MCP authorization specification:

- **OAuth 2.1**: Full OAuth 2.1 implementation with PKCE (RFC 7636)
- **Resource Indicators**: RFC 8707 implementation for token audience binding
- **Dynamic Client Registration**: RFC 7591 support for automatic client registration
- **Protected Resource Metadata**: RFC 9728 implementation for authorization server discovery
- **Authorization Server Metadata**: RFC 8414 support for OAuth server discovery
- **Token Validation**: Proper JWT validation and audience checking
- **Security Best Practices**: CSRF protection, secure token storage, and communication security

## Architecture

### MCP Server (OAuth Resource Server)
The server provides:
- **Tools**: `get_current_time`, `calculate`, `echo`
- **Resources**: `simple://server-info`, `simple://system-status`
- **Transport**: HTTP POST endpoint and WebSocket support
- **Protocol**: JSON-RPC 2.0 compliant
- **Authorization**: OAuth 2.1 resource server with token validation
- **Protected Resource Metadata**: RFC 9728 endpoint at `/.well-known/oauth-resource-metadata`

### MCP Client/Agent (OAuth Client)
The client can:
- Connect via HTTP or WebSocket with OAuth authentication
- Use proper MCP protocol methods
- Handle JSON-RPC 2.0 responses and errors
- Perform OAuth 2.1 authorization flow with PKCE
- Support dynamic client registration
- Handle token refresh automatically
- Demonstrate MCP functionality

### OAuth Callback Server
- Handles OAuth authorization callbacks
- Manages authorization sessions (in-memory, must be same process as client)
- Provides user-friendly authorization completion

> **Important:**
> The callback server is started and managed by the client/agent process. **Do not run the callback server as a separate process** unless you implement persistent session storage. If you run it separately, you will get "Invalid Session" errors because the session is not shared between processes.

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

### Start the MCP Server

```bash
npm run server
```

The server will start on `http://localhost:3000` with:
- HTTP endpoint: `POST /mcp` (JSON-RPC 2.0 with OAuth protection)
- WebSocket endpoint: `ws://localhost:3000`
- Health check: `GET /health`
- Protected Resource Metadata: `GET /.well-known/oauth-resource-metadata`

### Run the Client/Agent

```bash
npm run client
```

The agent will:
1. Start the OAuth callback server (in-memory, same process)
2. Attempt dynamic client registration with the OAuth server
3. Start OAuth 2.1 authorization flow with PKCE
4. Store authorization session with the callback server
5. Display the authorization URL for manual completion
6. Wait for authorization to complete (up to 5 minutes)
7. Connect to the MCP server with valid access token
8. Get server information
9. List available tools and resources
10. Demonstrate tool calls
11. Read resources
12. Display results

**Important Notes:**
- The callback server is started automatically by the client and runs in the same process
- **Do not start the callback server separately** unless you implement persistent session storage
- If you run the callback server as a separate process, you will get "Invalid Session" errors
- The authorization flow requires manual completion in your browser

### Run with Debug Output

```bash
npm run client:debug
```

Enables comprehensive debug output for the OAuth flow, callback server, and MCP client.

### Test HTTP Transport

```bash
npm run test
```

Tests the HTTP transport with various MCP methods and error conditions.

## Debug Output

The OAuth client flow includes comprehensive debug output to help track the authorization process. This is useful for development, troubleshooting, and understanding the OAuth flow.

### Enable Debug Mode

#### Run Client with Debug Output
```bash
npm run client:debug
```

#### Run OAuth Debug Test
```bash
npm run test:oauth-debug
```

This test demonstrates all OAuth client functionality with detailed debug output.

### Debug Output Features

The debug output provides detailed information about:

#### OAuth Client Debug Information
- **Initialization**: Configuration details and OAuth client setup
- **PKCE Generation**: Code verifier and challenge generation
- **State Generation**: CSRF protection state parameter
- **Metadata Discovery**: Authorization server metadata retrieval
- **Client Registration**: Dynamic client registration process
- **Authorization Flow**: Authorization URL generation and parameters
- **Token Exchange**: Authorization code exchange for tokens
- **Token Refresh**: Access token refresh operations
- **Token Validation**: Token expiry and validity checks
- **Error Handling**: Detailed error information and context

#### OAuth Callback Server Debug Information
- **Callback Requests**: Incoming authorization callbacks
- **Session Management**: Authorization session storage and retrieval
- **Token Exchange**: Token exchange process within callback
- **Error Handling**: Callback error processing

#### MCP Client Debug Information
- **OAuth Initialization**: OAuth flow initialization process
- **WebSocket Connections**: WebSocket connection status
- **HTTP Requests**: HTTP request details with OAuth tokens
- **Token Management**: Token usage and refresh operations
- **Error Handling**: Request failures and retry logic

### Debug Output Example

When running with debug mode enabled, you'll see output like:

```
[OAuthClient] Initialized with config: {
  authorizationServer: 'https://maverics7.stratademo.io',
  clientId: 'agentic_ai',
  redirectUri: 'http://localhost:3001/callback',
  scope: 'openid read write',
  hasClientSecret: false
}

[OAuthClient] Fetching authorization server metadata from: https://maverics7.stratademo.io/.well-known/oauth-authorization-server

[OAuthClient] Authorization server metadata:
  Authorization Endpoint: https://maverics7.stratademo.io/oauth/authorize
  Token Endpoint: https://maverics7.stratademo.io/oauth/token
  Registration Endpoint: https://maverics7.stratademo.io/oauth/register

[OAuthClient] Starting dynamic client registration...

[OAuthClient] Client registration request: {
  client_name: 'Sample MCP Client',
  client_uri: 'http://localhost:3001',
  redirect_uris: ['http://localhost:3001/callback'],
  grant_types: ['authorization_code'],
  response_types: ['code'],
  token_endpoint_auth_method: 'client_secret_basic',
  scope: 'openid read write'
}

[OAuthClient] Generated PKCE:
  Code Verifier: abc123...
  Code Challenge: xyz789...

[OAuthClient] Generated state parameter: def456...

[OAuthClient] Authorization URL generated:
  Base URL: https://maverics7.stratademo.io/oauth/authorize
  Parameters:
    response_type: code
    client_id: agentic_ai
    redirect_uri: http://localhost:3001/callback
    scope: openid read write
    state: def456...
    code_challenge: xyz789...
    code_challenge_method: S256
    resource: http://localhost:3000
```

### Debug Output Benefits

1. **Development**: Understand the OAuth flow step-by-step
2. **Troubleshooting**: Identify issues in the authorization process
3. **Security**: Verify PKCE, state parameters, and token handling
4. **Compliance**: Ensure proper OAuth 2.1 implementation
5. **Integration**: Debug OAuth server integration issues

### Disabling Debug Output

Debug output is disabled by default. To disable it when enabled:

- Remove the `--debug` flag from command line arguments
- Set `debug: false` in constructor parameters
- Debug output can be controlled per component (OAuth client, callback server, MCP client)

## OAuth Configuration

### Current Configuration

The implementation is configured to use:
- **Authorization Server**: `https://maverics7.stratademo.io`
- **Client ID**: `agentic_ai`
- **Redirect URI**: `http://localhost:3001/callback`
- **Scope**: `openid read write`
- **Resource**: `http://localhost:3000`

> **Note:**
> This project now uses standard OAuth scopes including `openid` for OpenID Connect support, along with `read` and `write` for resource access. You can customize the scopes in `src/oauth-config.ts` by editing the `scope` property in `DEFAULT_OAUTH_CONFIG`. You may also add other standard scopes such as `profile`, `email`, or `offline_access` as needed for your use case.

### Environment Variables

Set these environment variables to configure OAuth:

```bash
# OAuth Authorization Server URL
export OAUTH_AUTHORIZATION_SERVER="https://maverics7.stratademo.io"

# MCP Server URL
export MCP_SERVER_URL="http://localhost:3000"

# OAuth Client Configuration (optional - will use dynamic registration)
export OAUTH_CLIENT_ID="agentic_ai"
export OAUTH_CLIENT_SECRET="your-client-secret"
```

## OAuth Authorization Flow

### 1. Dynamic Client Registration
The client attempts to register dynamically with the authorization server using RFC 7591.

### 2. Authorization Request
The client initiates OAuth 2.1 authorization with:
- PKCE challenge and verifier
- State parameter for CSRF protection
- Resource indicator (RFC 8707)
- Required scopes

### 3. Session Storage
The client stores the authorization session (state, code verifier, OAuth client) with the callback server for later retrieval. **This is in-memory and only works if the callback server is running in the same process as the client.**

### 4. User Authorization
User is redirected to the authorization server to grant permissions using the provided authorization URL.

### 5. Authorization Callback
The authorization server redirects back to the callback server with an authorization code.

### 6. Session Retrieval
The callback server retrieves the stored session using the state parameter. If the session is not found, ensure you are not running the callback server as a separate process.

### 7. Token Exchange
The callback server exchanges the authorization code for access and refresh tokens using the stored OAuth client.

### 8. Client Notification
The client polls for authorization completion and proceeds with API access once tokens are available.

### 9. API Access
The client uses the access token to make authenticated requests to the MCP server.

## MCP Protocol Implementation

### Request Format (JSON-RPC 2.0 with OAuth)
```http
POST /mcp HTTP/1.1
Host: localhost:3000
Content-Type: application/json
Authorization: Bearer <access-token>

{
  "jsonrpc": "2.0",
  "id": "1",
  "method": "tools/call",
  "params": {
    "name": "calculate",
    "arguments": {
      "expression": "2 + 2"
    }
  }
}
```

### Response Format (JSON-RPC 2.0)
```json
{
  "jsonrpc": "2.0",
  "id": "1",
  "result": {
    "content": [
      {
        "type": "text",
        "text": "2 + 2 = 4"
      }
    ]
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

### OAuth Error Response
```http
HTTP/1.1 401 Unauthorized
WWW-Authenticate: Bearer realm="http://localhost:3000", resource="http://localhost:3000"

{
  "error": "invalid_token",
  "error_description": "Invalid or expired access token"
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

## OAuth Security Features

### PKCE (Proof Key for Code Exchange)
- Prevents authorization code interception attacks
- Uses SHA256 challenge method
- Required for public clients

### Resource Indicators (RFC 8707)
- Binds tokens to specific resources
- Prevents token misuse across services
- Ensures proper audience validation

### Dynamic Client Registration (RFC 7591)
- Automatic client registration
- No manual configuration required
- Supports registration policies

### Token Validation
- JWT signature verification
- Audience claim validation
- Expiration checking
- Scope validation

## Development

### Project Structure
```
src/
├── mcp-types.ts              # MCP protocol type definitions
├── oauth-config.ts           # OAuth configuration and types
├── oauth-client.ts           # OAuth 2.1 client implementation
├── oauth-callback-server.ts  # OAuth callback server (managed by client)
├── server.ts                 # MCP server with OAuth resource server
├── client.ts                 # MCP client with OAuth authentication
├── test-http.ts              # HTTP transport test
├── test-oauth-debug.ts       # OAuth debug test
├── test-callback-integration.ts # Callback server integration test
├── test-full-oauth-flow.ts   # Full OAuth flow test
└── index.ts                  # Main entry point
```

> **Note:** The callback server (`oauth-callback-server.ts`) is now managed by the client and runs in the same process for session sharing.

### Scripts
- `npm run build` - Build TypeScript to JavaScript
- `npm run server` - Start the MCP server
- `npm run client` - Run the MCP client/agent (starts callback server automatically)
- `npm run client:debug` - Run client with debug output
- `npm run test` - Test HTTP transport
- `npm run test:oauth-debug` - Test OAuth debug functionality
- `npm run test:callback-integration` - Test callback server integration
- `npm run test:full-oauth-flow` - Test full OAuth flow with debug
- `npm run dev` - Run in development mode

## Transport Layer

### HTTP Transport
- **Endpoint**: `POST /mcp`
- **Content-Type**: `application/json`
- **Protocol**: JSON-RPC 2.0 over HTTP
- **Authorization**: OAuth 2.1 Bearer tokens
- **Streaming**: Chunked transfer encoding

### WebSocket Transport
- **Endpoint**: `ws://localhost:3000`
- **Protocol**: JSON-RPC 2.0 over WebSocket
- **Real-time**: Bidirectional communication

## Security Considerations

### OAuth 2.1 Compliance
- All communication over HTTPS (in production)
- PKCE for authorization code protection
- Secure token storage and handling
- Proper audience validation
- No token passthrough

### Production Deployment
> [!IMPORTANT] >This is a sample implementation and it is NOT meant for production use. Please contact @giovannypietro or @apietro777 for production usage.

- Use a production ready Identity Orchestrator (e.g. Strata Maverics)
- Use a production ready OAuth 2.1 server
- Implement proper JWT validation with JWKS
- Use HTTPS for all endpoints
- Implement proper session management
- Add rate limiting and monitoring

### Token Security
- Store tokens securely (encrypted at rest)
- Implement token refresh logic
- Validate token audience claims
- Use short-lived access tokens
- Implement proper logout procedures

## Documentation

This project includes comprehensive documentation for implementation, compliance, and security:

### 📋 [Compliance Report](COMPLIANCE_REPORT.md)
Complete compliance assessment against the MCP Authorization Specification, including:
- Full compliance matrix with all requirements
- Implementation details and testing results
- Production readiness assessment
- 100% compliance score with detailed breakdown

### 🔧 [Implementation Guide](IMPLEMENTATION_GUIDE.md)
Detailed technical implementation guide covering:
- OAuth 2.1 architecture and flow implementation
- Security features and best practices
- Code examples and configuration
- Troubleshooting and production deployment

## References

- [Model Context Protocol Documentation](https://modelcontextprotocol.io/introduction)
- [MCP Authorization Specification](https://modelcontextprotocol.io/specification/2025-06-18/basic/authorization)
- [MCP Specification](https://modelcontextprotocol.io/specification)
- [MCP Architecture](https://modelcontextprotocol.io/architecture)
- [OAuth 2.1 Specification](https://datatracker.ietf.org/doc/html/draft-ietf-oauth-v2-1-12)
- [RFC 7636 - PKCE](https://datatracker.ietf.org/doc/html/rfc7636)
- [RFC 8707 - Resource Indicators](https://datatracker.ietf.org/doc/html/rfc8707)
- [RFC 7591 - Dynamic Client Registration](https://datatracker.ietf.org/doc/html/rfc7591)
- [RFC 9728 - Protected Resource Metadata](https://datatracker.ietf.org/doc/html/rfc9728)
- [RFC 8414 - Authorization Server Metadata](https://datatracker.ietf.org/doc/html/rfc8414)
- [JSON-RPC 2.0 Specification](https://www.jsonrpc.org/specification)

### Test Scripts

#### Callback Server Integration Test
```bash
npm run test:callback-integration
```
Runs `src/test-callback-integration.ts` to verify callback server session storage and retrieval.

#### Full OAuth Flow Debug Test
```bash
npm run test:full-oauth-flow
```
Runs `src/test-full-oauth-flow.ts` to verify the full OAuth flow and session handling with debug output.