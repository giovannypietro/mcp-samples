# OAuth 2.1 MCP Implementation Guide

This guide provides detailed technical information about the OAuth 2.1 implementation for the Model Context Protocol (MCP) server and client.

## Architecture Overview

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   MCP Client    │    │  OAuth Callback  │    │  Authorization  │
│   (OAuth Client)│    │     Server       │    │     Server      │
└─────────────────┘    └──────────────────┘    └─────────────────┘
         │                       │                       │
         │ 1. Auth Request       │                       │
         │───────────────────────┼───────────────────────▶│
         │                       │                       │
         │ 2. User Authorization │                       │
         │◀──────────────────────┼───────────────────────│
         │                       │                       │
         │ 3. Auth Callback      │                       │
         │◀──────────────────────┼───────────────────────│
         │                       │                       │
         │ 4. Token Exchange     │                       │
         │───────────────────────┼───────────────────────▶│
         │                       │                       │
         │ 5. API Requests       │                       │
         │───────────────────────┼───────────────────────┼
         │                       │                       │
         ▼                       ▼                       ▼
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   MCP Server    │    │   Protected      │    │   Token         │
│ (Resource Server)│   │   Resource       │    │   Validation    │
└─────────────────┘    │   Metadata       │    └─────────────────┘
                       └──────────────────┘
```

## Implementation Components

### 1. OAuth Configuration (`src/oauth-config.ts`)

**Purpose**: Defines OAuth 2.1 types, constants, and configuration.

**Key Components**:
- `OAuthConfig` interface for client configuration
- `AuthorizationServerMetadata` for RFC 8414 compliance
- `ProtectedResourceMetadata` for RFC 9728 compliance
- `TokenResponse` and `AuthorizationError` types
- OAuth 2.1 constants and default configuration

**Configuration Example**:
```typescript
export const DEFAULT_OAUTH_CONFIG: OAuthConfig = {
  authorizationServer: 'https://oauthserver.example.com',
  clientId: 'agentic_ai',
  redirectUri: 'http://localhost:3001/callback',
  scope: 'mcp:read mcp:write',
};
```

### 2. OAuth Client (`src/oauth-client.ts`)

**Purpose**: Implements OAuth 2.1 client functionality with PKCE and dynamic registration.

**Key Methods**:
- `generatePKCE()`: Creates PKCE challenge/verifier pair
- `generateState()`: Creates CSRF protection state parameter
- `registerClient()`: Dynamic client registration (RFC 7591)
- `startAuthorization()`: Initiates OAuth flow with resource indicators
- `exchangeCodeForTokens()`: Exchanges authorization code for tokens
- `refreshAccessToken()`: Refreshes expired access tokens
- `getValidAccessToken()`: Returns valid token (refreshes if needed)

**PKCE Implementation**:
```typescript
private generatePKCE(): { codeVerifier: string; codeChallenge: string } {
  const codeVerifier = crypto.randomBytes(32).toString('base64url');
  const codeChallenge = crypto
    .createHash('sha256')
    .update(codeVerifier)
    .digest('base64url');
  
  return { codeVerifier, codeChallenge };
}
```

**Resource Indicators (RFC 8707)**:
```typescript
const params = new URLSearchParams({
  response_type: OAUTH_CONSTANTS.RESPONSE_TYPE_CODE,
  client_id: this.config.clientId,
  redirect_uri: this.config.redirectUri,
  scope: this.config.scope,
  state,
  code_challenge: codeChallenge,
  code_challenge_method: OAUTH_CONSTANTS.PKCE_CHALLENGE_METHOD,
  resource: MCP_SERVER_URI, // RFC 8707 Resource Indicators
});
```

### 3. OAuth Resource Server (`src/server.ts`)

**Purpose**: Implements OAuth 2.1 resource server functionality in the MCP server.

**Key Components**:
- `TokenValidator` class for token validation
- Protected Resource Metadata endpoint (RFC 9728)
- Bearer token validation on all MCP requests
- Proper error responses with WWW-Authenticate headers

**Protected Resource Metadata Endpoint**:
```typescript
this.app.get('/.well-known/oauth-resource-metadata', (req: express.Request, res: express.Response) => {
  res.json(this.mcpServer.getProtectedResourceMetadata());
});
```

**Token Validation**:
```typescript
// Extract and validate authorization header
const authHeader = req.headers.authorization;
if (!authHeader || !authHeader.startsWith('Bearer ')) {
  res.setHeader('WWW-Authenticate', `Bearer realm="${MCP_SERVER_URI}", resource="${MCP_SERVER_URI}"`);
  return res.status(401).json({
    error: 'unauthorized',
    error_description: 'Bearer token required',
  });
}

const token = authHeader.substring(7);
const tokenValidation = await this.tokenValidator.validateToken(token);
```

### 4. OAuth Callback Server (`src/oauth-callback-server.ts`)

**Purpose**: Handles OAuth authorization callbacks and manages authorization sessions.

**Key Features**:
- Authorization callback endpoint (`/callback`)
- Session management for authorization state (in-memory, must be same process as client)
- Debug mode enabled by default
- Error handling and user-friendly responses
- Automatic window closing after successful authorization

> **Important:**
> The callback server and client must share the same Node.js process for session storage to work. If you run the callback server as a separate process, you will get "Invalid Session" errors unless you implement persistent session storage.

**Callback Handling**:
```typescript
this.app.get('/callback', async (req: express.Request, res: express.Response) => {
  const { code, state, error, error_description } = req.query;
  
  if (error) {
    // Handle OAuth errors
    return;
  }
  
  const session = this.authSessions.get(state as string);
  if (!session) {
    // Handle invalid session
    return;
  }
  
  // Exchange authorization code for tokens
  await session.oauthClient.exchangeCodeForTokens(
    code as string,
    session.codeVerifier,
    state as string,
    session.state
  );
});
```

## OAuth Flow Implementation

### 1. Dynamic Client Registration

```typescript
async registerClient(): Promise<{ clientId: string; clientSecret?: string }> {
  const metadata = await this.getAuthorizationServerMetadata();
  
  if (!metadata.registration_endpoint) {
    throw new Error('Authorization server does not support dynamic client registration');
  }

  const registrationRequest = {
    client_name: 'MCP Client',
    client_uri: 'http://localhost:3001',
    redirect_uris: [this.config.redirectUri],
    grant_types: [OAUTH_CONSTANTS.GRANT_TYPE_AUTHORIZATION_CODE],
    response_types: [OAUTH_CONSTANTS.RESPONSE_TYPE_CODE],
    token_endpoint_auth_method: 'client_secret_basic',
    scope: this.config.scope,
  };

  const response = await fetch(metadata.registration_endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(registrationRequest),
  });

  return response.json();
}
```

### 2. Authorization Request with PKCE

```typescript
async startAuthorization(): Promise<{ authUrl: string; state: string; codeVerifier: string }> {
  const metadata = await this.getAuthorizationServerMetadata();
  const { codeVerifier, codeChallenge } = this.generatePKCE();
  const state = this.generateState();

  const params = new URLSearchParams({
    response_type: OAUTH_CONSTANTS.RESPONSE_TYPE_CODE,
    client_id: this.config.clientId,
    redirect_uri: this.config.redirectUri,
    scope: this.config.scope,
    state,
    code_challenge: codeChallenge,
    code_challenge_method: OAUTH_CONSTANTS.PKCE_CHALLENGE_METHOD,
    resource: MCP_SERVER_URI, // RFC 8707 Resource Indicators
  });

  const authUrl = `${metadata.authorization_endpoint}?${params.toString()}`;
  
  return { authUrl, state, codeVerifier };
}
```

### 3. Token Exchange with Resource Indicators

```typescript
async exchangeCodeForTokens(
  code: string, 
  codeVerifier: string, 
  state: string, 
  expectedState: string
): Promise<TokenResponse> {
  if (state !== expectedState) {
    throw new Error('State parameter mismatch - possible CSRF attack');
  }

  const metadata = await this.getAuthorizationServerMetadata();
  
  const tokenRequest = {
    grant_type: OAUTH_CONSTANTS.GRANT_TYPE_AUTHORIZATION_CODE,
    client_id: this.config.clientId,
    code,
    redirect_uri: this.config.redirectUri,
    code_verifier: codeVerifier,
    resource: MCP_SERVER_URI, // RFC 8707 Resource Indicators
  };

  const response = await fetch(metadata.token_endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(tokenRequest),
  });

  return response.json();
}
```

## Security Implementation

### 1. PKCE (Proof Key for Code Exchange)

**Purpose**: Prevents authorization code interception attacks.

**Implementation**:
- Generate random 32-byte code verifier
- Create SHA256 hash of code verifier as challenge
- Send challenge in authorization request
- Send verifier in token exchange request

### 2. CSRF Protection

**Purpose**: Prevents cross-site request forgery attacks.

**Implementation**:
- Generate random state parameter
- Include state in authorization request
- Validate state in callback
- Reject requests with mismatched state

### 3. Resource Indicators (RFC 8707)

**Purpose**: Binds tokens to specific resources, preventing token misuse.

**Implementation**:
- Include `resource` parameter in authorization request
- Include `resource` parameter in token request
- Validate token audience on resource server
- Reject tokens not intended for this resource

### 4. Token Validation

**Purpose**: Ensures tokens are valid and intended for this resource.

**Implementation**:
- Validate Bearer token presence
- Check token format and structure
- Validate audience claim (RFC 8707)
- Check token expiration
- Verify token scope

## Error Handling

### 1. OAuth Error Responses

```typescript
// 401 Unauthorized - Missing or invalid token
res.setHeader('WWW-Authenticate', `Bearer realm="${MCP_SERVER_URI}", resource="${MCP_SERVER_URI}"`);
res.status(401).json({
  error: 'unauthorized',
  error_description: 'Bearer token required',
});

// 401 Unauthorized - Invalid token
res.setHeader('WWW-Authenticate', `Bearer realm="${MCP_SERVER_URI}", resource="${MCP_SERVER_URI}"`);
res.status(401).json({
  error: 'invalid_token',
  error_description: 'Invalid or expired access token',
});

// 403 Forbidden - Invalid audience
res.status(403).json({
  error: 'insufficient_scope',
  error_description: 'Token not intended for this resource',
});
```

### 2. MCP Error Responses

```typescript
const mcpResponse: MCPResponse = {
  jsonrpc: '2.0',
  id: mcpRequest.id,
  error: {
    code: MCP_ERROR_CODES.INVALID_REQUEST,
    message: 'Invalid JSON-RPC 2.0 request',
  },
};
```

## Testing

### 1. Functional Testing

```bash
# Test Protected Resource Metadata
curl http://localhost:3000/.well-known/oauth-resource-metadata

# Test Unauthorized Access
curl -X POST http://localhost:3000/mcp \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":"1","method":"server/info"}'

# Test OAuth Flow
npm run client
```

### 2. Security Testing

```bash
# Test PKCE Implementation
# Verify code challenge is SHA256 hash of code verifier

# Test CSRF Protection
# Verify state parameter validation

# Test Resource Indicators
# Verify resource parameter in requests

# Test Token Validation
# Verify audience validation
```

## Production Deployment
> [!IMPORTANT] >This is a sample implementation and it is NOT meant for production use. Please contact @giovannypietro or @apietro777 for production usage.

### 1. Example Configuration

```bash
# Production OAuth Configuration
export OAUTH_AUTHORIZATION_SERVER="https://your-production-oauth-server.com"
export OAUTH_CLIENT_ID="your-production-client-id"
export OAUTH_CLIENT_SECRET="your-production-client-secret"
export MCP_SERVER_URL="https://your-mcp-server.com"
```

### 2. Security Requirements

- **HTTPS**: Enable HTTPS for all endpoints
- **JWT Validation**: Implement proper JWT validation with JWKS
- **Token Storage**: Use encrypted storage for tokens
- **Rate Limiting**: Implement rate limiting for API endpoints
- **Monitoring**: Add logging and monitoring
- **Session Management**: Implement proper session management

### 3. OAuth Server Integration

**Supported OAuth Servers**:
- Strata Maverics (Identity Orchestrator)
- Any OAuth 2.1 compliant server

**Configuration Steps**:
1. Create OAuth application in your OAuth server
2. Configure redirect URI: `https://your-domain.com/callback`
3. Set required scopes: `mcp:read mcp:write`
4. Enable PKCE support
5. Configure resource indicators support
6. Set up dynamic client registration (optional)

## Troubleshooting

### Common Issues

1. **Dynamic Client Registration Fails**
   - Check if authorization server supports RFC 7591
   - Verify registration endpoint in metadata
   - Check registration policies

2. **Token Validation Fails**
   - Verify token format and structure
   - Check audience claim matches resource URI
   - Verify token hasn't expired
   - Check token scope includes required permissions

3. **Authorization Flow Fails**
   - Verify redirect URI matches registered URI
   - Check PKCE implementation
   - Verify state parameter validation
   - Check resource parameter inclusion

4. **CORS Issues**
   - Configure CORS headers properly
   - Verify allowed origins
   - Check preflight requests

5. **Invalid Session Error**
   - Cause: The callback server is running in a different process from the client, so the session is not shared (in-memory only).
   - Solution: Always let the client/agent start and manage the callback server. Do not run the callback server separately unless you implement persistent session storage.

### Debug Mode

Enable debug logging by setting environment variables:

```bash
export DEBUG=oauth:*
export DEBUG=mcp:*
```

## References

- [MCP Authorization Specification](https://modelcontextprotocol.io/specification/2025-06-18/basic/authorization)
- [OAuth 2.1 Specification](https://datatracker.ietf.org/doc/html/draft-ietf-oauth-v2-1-12)
- [RFC 7636 - PKCE](https://datatracker.ietf.org/doc/html/rfc7636)
- [RFC 8707 - Resource Indicators](https://datatracker.ietf.org/doc/html/rfc8707)
- [RFC 7591 - Dynamic Client Registration](https://datatracker.ietf.org/doc/html/rfc7591)
- [RFC 9728 - Protected Resource Metadata](https://datatracker.ietf.org/doc/html/rfc9728)
- [RFC 8414 - Authorization Server Metadata](https://datatracker.ietf.org/doc/html/rfc8414) 