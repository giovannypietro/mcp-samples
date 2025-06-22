import WebSocket from 'ws';
import fetch from 'node-fetch';
import { 
  MCPRequest, 
  MCPResponse, 
  MCP_METHODS 
} from './mcp-types';
import { OAuthClient } from './oauth-client';
import { DEFAULT_OAUTH_CONFIG, MCP_SERVER_URI } from './oauth-config';

class SimpleMCPClient {
  private ws: WebSocket | null = null;
  private serverUrl: string;
  private requestId = 0;
  private oauthClient: OAuthClient;
  private debug: boolean;

  constructor(serverUrl: string = 'http://localhost:3000', oauthConfig = DEFAULT_OAUTH_CONFIG, debug: boolean = false) {
    this.serverUrl = serverUrl;
    this.debug = debug;
    this.oauthClient = new OAuthClient(oauthConfig, debug);
    
    if (this.debug) {
      console.log('[SimpleMCPClient] Initialized with debug mode enabled');
      console.log('[SimpleMCPClient] Server URL:', serverUrl);
    }
  }

  // Initialize OAuth authentication
  async initializeAuth(): Promise<void> {
    if (this.debug) {
      console.log('[SimpleMCPClient] Starting OAuth initialization...');
    }
    
    try {
      // Try to register client dynamically
      console.log('Attempting dynamic client registration...');
      if (this.debug) {
        console.log('[SimpleMCPClient] Attempting dynamic client registration...');
      }
      
      const clientInfo = await this.oauthClient.registerClient();
      console.log('Client registered successfully:', clientInfo.clientId);
      
      if (this.debug) {
        console.log('[SimpleMCPClient] Dynamic client registration successful');
        console.log('[SimpleMCPClient] Client ID:', clientInfo.clientId);
        console.log('[SimpleMCPClient] Has Client Secret:', !!clientInfo.clientSecret);
      }
    } catch (error) {
      console.log('Dynamic client registration failed, using configured client ID');
      if (this.debug) {
        console.log('[SimpleMCPClient] Dynamic client registration failed:', error);
        console.log('[SimpleMCPClient] Falling back to configured client ID');
      }
    }

    // Start authorization flow
    console.log('Starting OAuth authorization flow...');
    if (this.debug) {
      console.log('[SimpleMCPClient] Starting OAuth authorization flow...');
    }
    
    const { authUrl, state, codeVerifier } = await this.oauthClient.startAuthorization();
    
    if (this.debug) {
      console.log('[SimpleMCPClient] Authorization flow started:');
      console.log('[SimpleMCPClient] State:', state);
      console.log('[SimpleMCPClient] Code verifier present:', !!codeVerifier);
    }
    
    console.log('\n=== OAuth Authorization Required ===');
    console.log('Please visit the following URL to authorize this application:');
    console.log(authUrl);
    console.log('\nAfter authorization, you will be redirected to a callback URL.');
    console.log('Please provide the authorization code from the callback URL.');
    
    // In a real application, you would:
    // 1. Open the auth URL in a browser
    // 2. Handle the callback automatically
    // 3. Extract the authorization code from the callback
    
    // For this demo, we'll simulate the authorization flow
    console.log('\n=== Demo Mode: Simulating Authorization ===');
    console.log('In a real application, the user would complete the OAuth flow.');
    console.log('For this demo, we\'ll assume authorization was successful.');
    
    if (this.debug) {
      console.log('[SimpleMCPClient] Demo mode: simulating authorization code');
    }
    
    // Simulate getting an authorization code (in real app, this comes from callback)
    const simulatedCode = 'demo_authorization_code_' + Date.now();
    
    if (this.debug) {
      console.log('[SimpleMCPClient] Simulated authorization code:', simulatedCode);
      console.log('[SimpleMCPClient] Exchanging code for tokens...');
    }
    
    // Exchange code for tokens
    await this.oauthClient.exchangeCodeForTokens(simulatedCode, codeVerifier, state, state);
    console.log('OAuth authorization completed successfully!');
    
    if (this.debug) {
      console.log('[SimpleMCPClient] OAuth authorization completed successfully');
      console.log('[SimpleMCPClient] Token status:', {
        hasAccessToken: this.oauthClient.hasValidToken(),
        isAuthenticated: this.isAuthenticated()
      });
    }
  }

  // Connect via WebSocket
  async connectWebSocket(): Promise<void> {
    if (this.debug) {
      console.log('[SimpleMCPClient] Connecting to WebSocket...');
    }
    
    return new Promise((resolve, reject) => {
      const wsUrl = this.serverUrl.replace('http', 'ws');
      this.ws = new WebSocket(wsUrl);

      this.ws.on('open', () => {
        console.log('Connected to MCP server via WebSocket');
        if (this.debug) {
          console.log('[SimpleMCPClient] WebSocket connection established');
        }
        resolve();
      });

      this.ws.on('error', (error: any) => {
        console.error('WebSocket connection error:', error);
        if (this.debug) {
          console.error('[SimpleMCPClient] WebSocket connection error:', error);
        }
        reject(error);
      });

      this.ws.on('close', () => {
        console.log('Disconnected from MCP server');
        if (this.debug) {
          console.log('[SimpleMCPClient] WebSocket connection closed');
        }
      });
    });
  }

  // Send request via WebSocket
  async sendWebSocketRequest(method: string, params?: any): Promise<any> {
    if (!this.ws) {
      throw new Error('WebSocket not connected');
    }

    if (this.debug) {
      console.log('[SimpleMCPClient] Sending WebSocket request:', { method, params });
    }

    return new Promise((resolve, reject) => {
      const id = (++this.requestId).toString();
      const request: MCPRequest = { 
        jsonrpc: '2.0',
        id, 
        method, 
        params 
      };

      const messageHandler = (data: WebSocket.Data) => {
        try {
          const response: MCPResponse = JSON.parse(data.toString());
          if (response.id === id) {
            if (this.ws) {
              this.ws.off('message', messageHandler);
            }
            if (response.error) {
              if (this.debug) {
                console.error('[SimpleMCPClient] WebSocket request failed:', response.error);
              }
              reject(new Error(response.error.message));
            } else {
              if (this.debug) {
                console.log('[SimpleMCPClient] WebSocket request successful');
              }
              resolve(response.result);
            }
          }
        } catch (error) {
          console.error('Error parsing WebSocket response:', error);
          if (this.debug) {
            console.error('[SimpleMCPClient] WebSocket response parsing error:', error);
          }
        }
      };

      if (this.ws) {
        this.ws.on('message', messageHandler);
        this.ws.send(JSON.stringify(request));
      } else {
        reject(new Error('WebSocket not connected'));
      }
    });
  }

  // Send request via HTTP with OAuth token
  async sendHTTPRequest(method: string, params?: any): Promise<any> {
    if (this.debug) {
      console.log('[SimpleMCPClient] Sending HTTP request:', { method, params });
    }
    
    const request: MCPRequest = {
      jsonrpc: '2.0',
      id: (++this.requestId).toString(),
      method,
      params,
    };

    // Get valid access token
    const accessToken = await this.oauthClient.getValidAccessToken();
    
    if (this.debug) {
      console.log('[SimpleMCPClient] Using access token (first 20 chars):', accessToken.substring(0, 20) + '...');
    }

    const response = await fetch(`${this.serverUrl}/mcp`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`,
      },
      body: JSON.stringify(request),
    });

    if (response.status === 401) {
      // Token might be invalid, try to refresh
      console.log('Token expired, attempting refresh...');
      if (this.debug) {
        console.log('[SimpleMCPClient] Token expired (401), attempting refresh...');
      }
      
      await this.oauthClient.refreshAccessToken();
      const newToken = await this.oauthClient.getValidAccessToken();
      
      if (this.debug) {
        console.log('[SimpleMCPClient] Token refreshed, retrying request with new token');
      }
      
      // Retry with new token
      const retryResponse = await fetch(`${this.serverUrl}/mcp`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${newToken}`,
        },
        body: JSON.stringify(request),
      });

      if (!retryResponse.ok) {
        const error = `HTTP error: ${retryResponse.status}`;
        if (this.debug) {
          console.error('[SimpleMCPClient] Retry request failed:', error);
        }
        throw new Error(error);
      }

      const text = await retryResponse.text();
      const mcpResponse: MCPResponse = JSON.parse(text);
      
      if (mcpResponse.error) {
        if (this.debug) {
          console.error('[SimpleMCPClient] MCP response error:', mcpResponse.error);
        }
        throw new Error(mcpResponse.error.message);
      }
      
      if (this.debug) {
        console.log('[SimpleMCPClient] HTTP request successful after token refresh');
      }
      
      return mcpResponse.result;
    }

    if (!response.ok) {
      const error = `HTTP error: ${response.status}`;
      if (this.debug) {
        console.error('[SimpleMCPClient] HTTP request failed:', error);
      }
      throw new Error(error);
    }

    const text = await response.text();
    const mcpResponse: MCPResponse = JSON.parse(text);
    
    if (mcpResponse.error) {
      if (this.debug) {
        console.error('[SimpleMCPClient] MCP response error:', mcpResponse.error);
      }
      throw new Error(mcpResponse.error.message);
    }
    
    if (this.debug) {
      console.log('[SimpleMCPClient] HTTP request successful');
    }
    
    return mcpResponse.result;
  }

  // List available tools
  async listTools(useWebSocket: boolean = false): Promise<any> {
    if (useWebSocket && this.ws) {
      return this.sendWebSocketRequest(MCP_METHODS.TOOLS_LIST);
    } else {
      return this.sendHTTPRequest(MCP_METHODS.TOOLS_LIST);
    }
  }

  // Call a tool
  async callTool(name: string, args: any, useWebSocket: boolean = false): Promise<any> {
    const params = { name, arguments: args };
    if (useWebSocket && this.ws) {
      return this.sendWebSocketRequest(MCP_METHODS.TOOLS_CALL, params);
    } else {
      return this.sendHTTPRequest(MCP_METHODS.TOOLS_CALL, params);
    }
  }

  // List available resources
  async listResources(useWebSocket: boolean = false): Promise<any> {
    if (useWebSocket && this.ws) {
      return this.sendWebSocketRequest(MCP_METHODS.RESOURCES_LIST);
    } else {
      return this.sendHTTPRequest(MCP_METHODS.RESOURCES_LIST);
    }
  }

  // Read a resource
  async readResource(uri: string, useWebSocket: boolean = false): Promise<any> {
    const params = { uri };
    if (useWebSocket && this.ws) {
      return this.sendWebSocketRequest(MCP_METHODS.RESOURCES_READ, params);
    } else {
      return this.sendHTTPRequest(MCP_METHODS.RESOURCES_READ, params);
    }
  }

  // Get server info
  async getServerInfo(useWebSocket: boolean = false): Promise<any> {
    if (useWebSocket && this.ws) {
      return this.sendWebSocketRequest(MCP_METHODS.SERVER_INFO);
    } else {
      return this.sendHTTPRequest(MCP_METHODS.SERVER_INFO);
    }
  }

  // Close WebSocket connection
  close(): void {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  // Check if OAuth is authenticated
  isAuthenticated(): boolean {
    return this.oauthClient.hasValidToken();
  }
}

// Simple Agent that uses the MCP client with OAuth
class SimpleAgent {
  private client: SimpleMCPClient;
  private debug: boolean;

  constructor(serverUrl: string = 'http://localhost:3000', debug: boolean = false) {
    this.debug = debug;
    this.client = new SimpleMCPClient(serverUrl, DEFAULT_OAUTH_CONFIG, debug);
    
    if (this.debug) {
      console.log('[SimpleAgent] Initialized with debug mode enabled');
      console.log('[SimpleAgent] Server URL:', serverUrl);
    }
  }

  async initialize(): Promise<void> {
    if (this.debug) {
      console.log('[SimpleAgent] Starting initialization...');
    }
    
    try {
      // Initialize OAuth authentication
      if (this.debug) {
        console.log('[SimpleAgent] Initializing OAuth authentication...');
      }
      await this.client.initializeAuth();
      
      // Connect to WebSocket if authentication successful
      if (this.client.isAuthenticated()) {
        if (this.debug) {
          console.log('[SimpleAgent] OAuth authenticated, connecting to WebSocket...');
        }
        await this.client.connectWebSocket();
        console.log('Agent initialized and connected to MCP server with OAuth');
      } else {
        console.log('OAuth authentication required before connecting');
        if (this.debug) {
          console.log('[SimpleAgent] OAuth authentication failed or incomplete');
        }
      }
    } catch (error) {
      console.log('WebSocket connection failed, will use HTTP transport');
      if (this.debug) {
        console.log('[SimpleAgent] WebSocket connection failed:', error);
        console.log('[SimpleAgent] Will fall back to HTTP transport');
      }
    }
  }

  async demonstrateServerInfo(): Promise<void> {
    if (this.debug) {
      console.log('[SimpleAgent] Demonstrating server info...');
    }
    
    console.log('\n=== Server Information ===');
    try {
      const serverInfo = await this.client.getServerInfo();
      console.log('Server info:', serverInfo);
    } catch (error) {
      console.error('Error getting server info:', error);
      if (this.debug) {
        console.error('[SimpleAgent] Server info demonstration failed:', error);
      }
    }
  }

  async demonstrateTools(): Promise<void> {
    if (this.debug) {
      console.log('[SimpleAgent] Demonstrating MCP tools...');
    }
    
    console.log('\n=== Demonstrating MCP Tools ===');

    try {
      // List available tools
      console.log('1. Listing available tools...');
      const tools = await this.client.listTools();
      console.log('Available tools:', tools.tools.map((t: any) => t.name));

      // Call get_current_time tool
      console.log('\n2. Getting current time...');
      const timeResult = await this.client.callTool('get_current_time', {});
      console.log('Time result:', timeResult.content[0].text);

      // Call calculate tool
      console.log('\n3. Performing calculation...');
      const calcResult = await this.client.callTool('calculate', { expression: '2 + 3 * 4' });
      console.log('Calculation result:', calcResult.content[0].text);

      // Call echo tool
      console.log('\n4. Echoing message...');
      const echoResult = await this.client.callTool('echo', { message: 'Hello, MCP!' });
      console.log('Echo result:', echoResult.content[0].text);

    } catch (error) {
      console.error('Error demonstrating tools:', error);
      if (this.debug) {
        console.error('[SimpleAgent] Tools demonstration failed:', error);
      }
    }
  }

  async demonstrateResources(): Promise<void> {
    if (this.debug) {
      console.log('[SimpleAgent] Demonstrating MCP resources...');
    }
    
    console.log('\n=== Demonstrating MCP Resources ===');

    try {
      // List available resources
      console.log('1. Listing available resources...');
      const resources = await this.client.listResources();
      console.log('Available resources:', resources.resources.map((r: any) => r.uri));

      // Read server info resource
      console.log('\n2. Reading server info...');
      const serverInfo = await this.client.readResource('simple://server-info');
      console.log('Server info:', serverInfo.contents[0].text);

      // Read system status resource
      console.log('\n3. Reading system status...');
      const systemStatus = await this.client.readResource('simple://system-status');
      console.log('System status:', systemStatus.contents[0].text);

    } catch (error) {
      console.error('Error demonstrating resources:', error);
      if (this.debug) {
        console.error('[SimpleAgent] Resources demonstration failed:', error);
      }
    }
  }

  async run(): Promise<void> {
    if (this.debug) {
      console.log('[SimpleAgent] Starting agent run...');
    }
    
    try {
      await this.initialize();
      await this.demonstrateServerInfo();
      await this.demonstrateTools();
      await this.demonstrateResources();
      
      if (this.debug) {
        console.log('[SimpleAgent] Agent run completed successfully');
      }
    } catch (error) {
      console.error('Agent run failed:', error);
      if (this.debug) {
        console.error('[SimpleAgent] Agent run failed:', error);
      }
    } finally {
      this.client.close();
    }
  }
}

// Main execution
async function main() {
  const debug = process.argv.includes('--debug');
  
  if (debug) {
    console.log('[Main] Starting with debug mode enabled');
  }
  
  const agent = new SimpleAgent('http://localhost:3000', debug);
  await agent.run();
}

// Run if this file is executed directly
if (require.main === module) {
  main().catch(console.error);
} 