import crypto from 'crypto';
import fetch from 'node-fetch';
import { 
  OAuthConfig, 
  AuthorizationServerMetadata, 
  TokenResponse, 
  AuthorizationError,
  OAUTH_CONSTANTS,
  MCP_SERVER_URI
} from './oauth-config';

export class OAuthClient {
  private config: OAuthConfig;
  private accessToken: string | null = null;
  private refreshToken: string | null = null;
  private tokenExpiry: number | null = null;

  constructor(config: OAuthConfig) {
    this.config = config;
  }

  // Generate PKCE challenge and verifier
  private generatePKCE(): { codeVerifier: string; codeChallenge: string } {
    const codeVerifier = crypto.randomBytes(32).toString('base64url');
    const codeChallenge = crypto
      .createHash('sha256')
      .update(codeVerifier)
      .digest('base64url');
    
    return { codeVerifier, codeChallenge };
  }

  // Generate state parameter for CSRF protection
  private generateState(): string {
    return crypto.randomBytes(16).toString('hex');
  }

  // Get authorization server metadata
  async getAuthorizationServerMetadata(): Promise<AuthorizationServerMetadata> {
    const metadataUrl = `${this.config.authorizationServer}/.well-known/oauth-authorization-server`;
    
    const response = await fetch(metadataUrl);
    if (!response.ok) {
      throw new Error(`Failed to fetch authorization server metadata: ${response.status}`);
    }
    
    return response.json();
  }

  // Dynamic client registration (RFC7591)
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
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(registrationRequest),
    });

    if (!response.ok) {
      throw new Error(`Client registration failed: ${response.status}`);
    }

    const clientInfo = await response.json();
    return {
      clientId: clientInfo.client_id,
      clientSecret: clientInfo.client_secret,
    };
  }

  // Start authorization flow
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

  // Exchange authorization code for tokens
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

    const headers: Record<string, string> = {
      'Content-Type': 'application/x-www-form-urlencoded',
    };

    // Add client authentication if client secret is available
    if (this.config.clientSecret) {
      const auth = Buffer.from(`${this.config.clientId}:${this.config.clientSecret}`).toString('base64');
      headers.Authorization = `Basic ${auth}`;
    }

    const response = await fetch(metadata.token_endpoint, {
      method: 'POST',
      headers,
      body: new URLSearchParams(tokenRequest),
    });

    if (!response.ok) {
      const error: AuthorizationError = await response.json();
      throw new Error(`Token exchange failed: ${error.error} - ${error.error_description}`);
    }

    const tokenResponse: TokenResponse = await response.json();
    
    // Store tokens
    this.accessToken = tokenResponse.access_token;
    this.refreshToken = tokenResponse.refresh_token || null;
    this.tokenExpiry = tokenResponse.expires_in 
      ? Date.now() + (tokenResponse.expires_in * 1000)
      : null;

    return tokenResponse;
  }

  // Refresh access token
  async refreshAccessToken(): Promise<TokenResponse> {
    if (!this.refreshToken) {
      throw new Error('No refresh token available');
    }

    const metadata = await this.getAuthorizationServerMetadata();
    
    const tokenRequest = {
      grant_type: OAUTH_CONSTANTS.GRANT_TYPE_REFRESH_TOKEN,
      client_id: this.config.clientId,
      refresh_token: this.refreshToken,
      resource: MCP_SERVER_URI, // RFC 8707 Resource Indicators
    };

    const headers: Record<string, string> = {
      'Content-Type': 'application/x-www-form-urlencoded',
    };

    if (this.config.clientSecret) {
      const auth = Buffer.from(`${this.config.clientId}:${this.config.clientSecret}`).toString('base64');
      headers.Authorization = `Basic ${auth}`;
    }

    const response = await fetch(metadata.token_endpoint, {
      method: 'POST',
      headers,
      body: new URLSearchParams(tokenRequest),
    });

    if (!response.ok) {
      const error: AuthorizationError = await response.json();
      throw new Error(`Token refresh failed: ${error.error} - ${error.error_description}`);
    }

    const tokenResponse: TokenResponse = await response.json();
    
    // Update stored tokens
    this.accessToken = tokenResponse.access_token;
    this.refreshToken = tokenResponse.refresh_token || this.refreshToken;
    this.tokenExpiry = tokenResponse.expires_in 
      ? Date.now() + (tokenResponse.expires_in * 1000)
      : null;

    return tokenResponse;
  }

  // Get valid access token (refresh if necessary)
  async getValidAccessToken(): Promise<string> {
    if (!this.accessToken) {
      throw new Error('No access token available - authorization required');
    }

    // Check if token is expired or will expire soon (within 30 seconds)
    if (this.tokenExpiry && Date.now() > (this.tokenExpiry - 30000)) {
      await this.refreshAccessToken();
    }

    return this.accessToken!;
  }

  // Check if we have a valid token
  hasValidToken(): boolean {
    return !!this.accessToken && (!this.tokenExpiry || Date.now() < this.tokenExpiry);
  }

  // Clear stored tokens
  clearTokens(): void {
    this.accessToken = null;
    this.refreshToken = null;
    this.tokenExpiry = null;
  }
} 