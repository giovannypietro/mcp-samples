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
  private debug: boolean;

  constructor(config: OAuthConfig, debug: boolean = false) {
    this.config = config;
    this.debug = debug;
    if (this.debug) {
      console.log('[OAuthClient] Initialized with config:', {
        authorizationServer: config.authorizationServer,
        clientId: config.clientId,
        redirectUri: config.redirectUri,
        scope: config.scope,
        hasClientSecret: !!config.clientSecret
      });
    }
  }

  // Generate PKCE challenge and verifier
  private generatePKCE(): { codeVerifier: string; codeChallenge: string } {
    const codeVerifier = crypto.randomBytes(32).toString('base64url');
    const codeChallenge = crypto
      .createHash('sha256')
      .update(codeVerifier)
      .digest('base64url');
    
    if (this.debug) {
      console.log('[OAuthClient] Generated PKCE:');
      console.log('  Code Verifier:', codeVerifier);
      console.log('  Code Challenge:', codeChallenge);
    }
    
    return { codeVerifier, codeChallenge };
  }

  // Generate state parameter for CSRF protection
  private generateState(): string {
    const state = crypto.randomBytes(16).toString('hex');
    if (this.debug) {
      console.log('[OAuthClient] Generated state parameter:', state);
    }
    return state;
  }

  // Get authorization server metadata
  async getAuthorizationServerMetadata(): Promise<AuthorizationServerMetadata> {
    const metadataUrl = `${this.config.authorizationServer}/.well-known/oauth-authorization-server`;
    
    if (this.debug) {
      console.log('[OAuthClient] Fetching authorization server metadata from:', metadataUrl);
    }
    
    const response = await fetch(metadataUrl);
    if (!response.ok) {
      const error = `Failed to fetch authorization server metadata: ${response.status}`;
      if (this.debug) {
        console.error('[OAuthClient] Metadata fetch failed:', error);
      }
      throw new Error(error);
    }
    
    const metadata = await response.json();
    if (this.debug) {
      console.log('[OAuthClient] Authorization server metadata:');
      console.log('  Authorization Endpoint:', metadata.authorization_endpoint);
      console.log('  Token Endpoint:', metadata.token_endpoint);
      console.log('  Registration Endpoint:', metadata.registration_endpoint);
      console.log('  Supported Grant Types:', metadata.grant_types_supported);
      console.log('  Supported Response Types:', metadata.response_types_supported);
    }
    
    return metadata;
  }

  // Dynamic client registration (RFC7591)
  async registerClient(): Promise<{ clientId: string; clientSecret?: string }> {
    if (this.debug) {
      console.log('[OAuthClient] Starting dynamic client registration...');
    }
    
    const metadata = await this.getAuthorizationServerMetadata();
    
    if (!metadata.registration_endpoint) {
      const error = 'Authorization server does not support dynamic client registration';
      if (this.debug) {
        console.error('[OAuthClient] Registration failed:', error);
      }
      throw new Error(error);
    }

    const registrationRequest = {
      client_name: 'Sample MCP Client',
      client_uri: 'http://localhost:3001',
      redirect_uris: [this.config.redirectUri],
      grant_types: [OAUTH_CONSTANTS.GRANT_TYPE_AUTHORIZATION_CODE],
      response_types: [OAUTH_CONSTANTS.RESPONSE_TYPE_CODE],
      token_endpoint_auth_method: 'client_secret_basic',
      scope: this.config.scope,
    };

    if (this.debug) {
      console.log('[OAuthClient] Client registration request:', registrationRequest);
    }

    const response = await fetch(metadata.registration_endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(registrationRequest),
    });

    if (!response.ok) {
      const error = `Client registration failed: ${response.status}`;
      if (this.debug) {
        console.error('[OAuthClient] Registration failed:', error);
        console.error('[OAuthClient] Response status:', response.status);
        console.error('[OAuthClient] Response text:', await response.text());
      }
      throw new Error(error);
    }

    const clientInfo = await response.json();
    if (this.debug) {
      console.log('[OAuthClient] Client registration successful:');
      console.log('  Client ID:', clientInfo.client_id);
      console.log('  Has Client Secret:', !!clientInfo.client_secret);
      console.log('  Client Name:', clientInfo.client_name);
      console.log('  Redirect URIs:', clientInfo.redirect_uris);
    }
    
    return {
      clientId: clientInfo.client_id,
      clientSecret: clientInfo.client_secret,
    };
  }

  // Start authorization flow
  async startAuthorization(): Promise<{ authUrl: string; state: string; codeVerifier: string }> {
    if (this.debug) {
      console.log('[OAuthClient] Starting authorization flow...');
    }
    
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
    
    if (this.debug) {
      console.log('[OAuthClient] Authorization URL generated:');
      console.log('  Base URL:', metadata.authorization_endpoint);
      console.log('  Parameters:');
      console.log('    response_type:', OAUTH_CONSTANTS.RESPONSE_TYPE_CODE);
      console.log('    client_id:', this.config.clientId);
      console.log('    redirect_uri:', this.config.redirectUri);
      console.log('    scope:', this.config.scope);
      console.log('    state:', state);
      console.log('    code_challenge:', codeChallenge);
      console.log('    code_challenge_method:', OAUTH_CONSTANTS.PKCE_CHALLENGE_METHOD);
      console.log('    resource:', MCP_SERVER_URI);
      console.log('  Full URL:', authUrl);
    }
    
    console.log('Authorization URL:', authUrl);
    return { authUrl, state, codeVerifier };
  }

  // Exchange authorization code for tokens
  async exchangeCodeForTokens(
    code: string, 
    codeVerifier: string, 
    state: string, 
    expectedState: string
  ): Promise<TokenResponse> {
    if (this.debug) {
      console.log('[OAuthClient] Exchanging authorization code for tokens...');
      console.log('  Authorization Code:', code);
      console.log('  Code Verifier:', codeVerifier);
      console.log('  Received State:', state);
      console.log('  Expected State:', expectedState);
    }
    
    if (state !== expectedState) {
      const error = 'State parameter mismatch - possible CSRF attack';
      if (this.debug) {
        console.error('[OAuthClient] State mismatch:', error);
      }
      throw new Error(error);
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
      if (this.debug) {
        console.log('[OAuthClient] Using client secret authentication');
      }
    } else {
      if (this.debug) {
        console.log('[OAuthClient] No client secret provided, using public client authentication');
      }
    }

    if (this.debug) {
      console.log('[OAuthClient] Token exchange request:');
      console.log('  Token Endpoint:', metadata.token_endpoint);
      console.log('  Headers:', headers);
      console.log('  Body:', tokenRequest);
    }

    const response = await fetch(metadata.token_endpoint, {
      method: 'POST',
      headers,
      body: new URLSearchParams(tokenRequest),
    });

    if (!response.ok) {
      const error: AuthorizationError = await response.json();
      const errorMsg = `Token exchange failed: ${error.error} - ${error.error_description}`;
      if (this.debug) {
        console.error('[OAuthClient] Token exchange failed:');
        console.error('  Status:', response.status);
        console.error('  Error:', error);
      }
      throw new Error(errorMsg);
    }

    const tokenResponse: TokenResponse = await response.json();
    
    if (this.debug) {
      console.log('[OAuthClient] Token exchange successful:');
      console.log('  Access Token (first 20 chars):', tokenResponse.access_token?.substring(0, 20) + '...');
      console.log('  Token Type:', tokenResponse.token_type);
      console.log('  Expires In:', tokenResponse.expires_in);
      console.log('  Has Refresh Token:', !!tokenResponse.refresh_token);
      console.log('  Scope:', tokenResponse.scope);
    }
    
    // Store tokens
    this.accessToken = tokenResponse.access_token;
    this.refreshToken = tokenResponse.refresh_token || null;
    this.tokenExpiry = tokenResponse.expires_in 
      ? Date.now() + (tokenResponse.expires_in * 1000)
      : null;

    if (this.debug) {
      console.log('[OAuthClient] Tokens stored:');
      console.log('  Access Token Stored:', !!this.accessToken);
      console.log('  Refresh Token Stored:', !!this.refreshToken);
      console.log('  Token Expiry:', this.tokenExpiry ? new Date(this.tokenExpiry).toISOString() : 'None');
    }

    return tokenResponse;
  }

  // Refresh access token
  async refreshAccessToken(): Promise<TokenResponse> {
    if (this.debug) {
      console.log('[OAuthClient] Refreshing access token...');
    }
    
    if (!this.refreshToken) {
      const error = 'No refresh token available';
      if (this.debug) {
        console.error('[OAuthClient] Refresh failed:', error);
      }
      throw new Error(error);
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

    if (this.debug) {
      console.log('[OAuthClient] Token refresh request:');
      console.log('  Token Endpoint:', metadata.token_endpoint);
      console.log('  Refresh Token (first 20 chars):', this.refreshToken.substring(0, 20) + '...');
    }

    const response = await fetch(metadata.token_endpoint, {
      method: 'POST',
      headers,
      body: new URLSearchParams(tokenRequest),
    });

    if (!response.ok) {
      const error: AuthorizationError = await response.json();
      const errorMsg = `Token refresh failed: ${error.error} - ${error.error_description}`;
      if (this.debug) {
        console.error('[OAuthClient] Token refresh failed:');
        console.error('  Status:', response.status);
        console.error('  Error:', error);
      }
      throw new Error(errorMsg);
    }

    const tokenResponse: TokenResponse = await response.json();
    
    if (this.debug) {
      console.log('[OAuthClient] Token refresh successful:');
      console.log('  New Access Token (first 20 chars):', tokenResponse.access_token?.substring(0, 20) + '...');
      console.log('  Token Type:', tokenResponse.token_type);
      console.log('  Expires In:', tokenResponse.expires_in);
      console.log('  Has New Refresh Token:', !!tokenResponse.refresh_token);
    }
    
    // Update stored tokens
    this.accessToken = tokenResponse.access_token;
    this.refreshToken = tokenResponse.refresh_token || this.refreshToken;
    this.tokenExpiry = tokenResponse.expires_in 
      ? Date.now() + (tokenResponse.expires_in * 1000)
      : null;

    if (this.debug) {
      console.log('[OAuthClient] Updated stored tokens:');
      console.log('  New Token Expiry:', this.tokenExpiry ? new Date(this.tokenExpiry).toISOString() : 'None');
    }

    return tokenResponse;
  }

  // Get valid access token (refresh if necessary)
  async getValidAccessToken(): Promise<string> {
    if (this.debug) {
      console.log('[OAuthClient] Getting valid access token...');
      console.log('  Has Access Token:', !!this.accessToken);
      console.log('  Token Expiry:', this.tokenExpiry ? new Date(this.tokenExpiry).toISOString() : 'None');
      console.log('  Current Time:', new Date().toISOString());
    }
    
    if (!this.accessToken) {
      const error = 'No access token available - authorization required';
      if (this.debug) {
        console.error('[OAuthClient] No access token:', error);
      }
      throw new Error(error);
    }

    // Check if token is expired or will expire soon (within 30 seconds)
    if (this.tokenExpiry && Date.now() > (this.tokenExpiry - 30000)) {
      if (this.debug) {
        console.log('[OAuthClient] Token expired or expiring soon, refreshing...');
      }
      await this.refreshAccessToken();
    } else if (this.debug) {
      console.log('[OAuthClient] Token is still valid');
    }

    return this.accessToken!;
  }

  // Check if we have a valid token
  hasValidToken(): boolean {
    const hasValid = !!this.accessToken && (!this.tokenExpiry || Date.now() < this.tokenExpiry);
    if (this.debug) {
      console.log('[OAuthClient] Token validity check:');
      console.log('  Has Access Token:', !!this.accessToken);
      console.log('  Token Expiry:', this.tokenExpiry ? new Date(this.tokenExpiry).toISOString() : 'None');
      console.log('  Is Valid:', hasValid);
    }
    return hasValid;
  }

  // Clear stored tokens
  clearTokens(): void {
    if (this.debug) {
      console.log('[OAuthClient] Clearing stored tokens');
    }
    this.accessToken = null;
    this.refreshToken = null;
    this.tokenExpiry = null;
  }
} 