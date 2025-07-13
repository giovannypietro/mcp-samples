// OAuth 2.1 Configuration for MCP Authorization
// Based on MCP Authorization Specification: https://modelcontextprotocol.io/specification/2025-06-18/basic/authorization

export interface OAuthConfig {
  authorizationServer: string;
  clientId: string;
  clientSecret?: string;
  redirectUri: string;
  scope: string;
}

export interface AuthorizationServerMetadata {
  issuer: string;
  authorization_endpoint: string;
  token_endpoint: string;
  registration_endpoint?: string;
  jwks_uri: string;
  response_types_supported: string[];
  grant_types_supported: string[];
  token_endpoint_auth_methods_supported: string[];
  scopes_supported?: string[];
  code_challenge_methods_supported?: string[];
}

export interface ProtectedResourceMetadata {
  resource: string;
  authorization_servers: string[];
  scopes: string[];
  token_endpoint_auth_methods_supported: string[];
}

export interface TokenResponse {
  access_token: string;
  token_type: string;
  expires_in?: number;
  refresh_token?: string;
  scope?: string;
}

export interface AuthorizationError {
  error: string;
  error_description?: string;
  error_uri?: string;
  state?: string;
}

// OAuth 2.1 Constants
export const OAUTH_CONSTANTS = {
  GRANT_TYPE_AUTHORIZATION_CODE: 'authorization_code',
  GRANT_TYPE_REFRESH_TOKEN: 'refresh_token',
  RESPONSE_TYPE_CODE: 'code',
  TOKEN_TYPE_BEARER: 'Bearer',
  PKCE_CHALLENGE_METHOD: 'S256',
} as const;

// Standard OAuth scopes
export const OAUTH_SCOPES = {
  OPENID: 'openid',
  PROFILE: 'profile',
  EMAIL: 'email',
  READ: 'read',
  WRITE: 'write',
  OFFLINE_ACCESS: 'offline_access',
} as const;

// Default OAuth configuration (should be overridden in production)
export const DEFAULT_OAUTH_CONFIG: OAuthConfig = {
  authorizationServer: 'https://authserver.example.com',
  clientId: 'agentic_ai',
  clientSecret: '[.....]',
  redirectUri: 'http://localhost:3001/callback',
  scope: `${OAUTH_SCOPES.OPENID} ${OAUTH_SCOPES.READ} ${OAUTH_SCOPES.WRITE}`,
};

// MCP Server canonical URI (should match the resource parameter)
export const MCP_SERVER_URI = 'http://localhost:3000'; 