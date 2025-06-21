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

  constructor(serverUrl: string = 'http://localhost:3000', oauthConfig = DEFAULT_OAUTH_CONFIG) {
    this.serverUrl = serverUrl;
    this.oauthClient = new OAuthClient(oauthConfig);
  }

  // Initialize OAuth authentication
  async initializeAuth(): Promise<void> {
    try {
      // Try to register client dynamically
      console.log('Attempting dynamic client registration...');
      const clientInfo = await this.oauthClient.registerClient();
      console.log('Client registered successfully:', clientInfo.clientId);
    } catch (error) {
      console.log('Dynamic client registration failed, using configured client ID');
    }

    // Start authorization flow
    console.log('Starting OAuth authorization flow...');
    const { authUrl, state, codeVerifier } = await this.oauthClient.startAuthorization();
    
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
    
    // Simulate getting an authorization code (in real app, this comes from callback)
    const simulatedCode = 'demo_authorization_code_' + Date.now();
    
    // Exchange code for tokens
    await this.oauthClient.exchangeCodeForTokens(simulatedCode, codeVerifier, state, state);
    console.log('OAuth authorization completed successfully!');
  }

  // Connect via WebSocket
  async connectWebSocket(): Promise<void> {
    return new Promise((resolve, reject) => {
      const wsUrl = this.serverUrl.replace('http', 'ws');
      this.ws = new WebSocket(wsUrl);

      this.ws.on('open', () => {
        console.log('Connected to MCP server via WebSocket');
        resolve();
      });

      this.ws.on('error', (error: any) => {
        console.error('WebSocket connection error:', error);
        reject(error);
      });

      this.ws.on('close', () => {
        console.log('Disconnected from MCP server');
      });
    });
  }

  // Send request via WebSocket
  async sendWebSocketRequest(method: string, params?: any): Promise<any> {
    if (!this.ws) {
      throw new Error('WebSocket not connected');
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
              reject(new Error(response.error.message));
            } else {
              resolve(response.result);
            }
          }
        } catch (error) {
          console.error('Error parsing WebSocket response:', error);
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
    const request: MCPRequest = {
      jsonrpc: '2.0',
      id: (++this.requestId).toString(),
      method,
      params,
    };

    // Get valid access token
    const accessToken = await this.oauthClient.getValidAccessToken();

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
      await this.oauthClient.refreshAccessToken();
      const newToken = await this.oauthClient.getValidAccessToken();
      
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
        throw new Error(`HTTP error: ${retryResponse.status}`);
      }

      const text = await retryResponse.text();
      const mcpResponse: MCPResponse = JSON.parse(text);
      
      if (mcpResponse.error) {
        throw new Error(mcpResponse.error.message);
      }
      
      return mcpResponse.result;
    }

    if (!response.ok) {
      throw new Error(`HTTP error: ${response.status}`);
    }

    const text = await response.text();
    const mcpResponse: MCPResponse = JSON.parse(text);
    
    if (mcpResponse.error) {
      throw new Error(mcpResponse.error.message);
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

  constructor(serverUrl: string = 'http://localhost:3000') {
    this.client = new SimpleMCPClient(serverUrl);
  }

  async initialize(): Promise<void> {
    try {
      // Initialize OAuth authentication
      await this.client.initializeAuth();
      
      // Connect to WebSocket if authentication successful
      if (this.client.isAuthenticated()) {
        await this.client.connectWebSocket();
        console.log('Agent initialized and connected to MCP server with OAuth');
      } else {
        console.log('OAuth authentication required before connecting');
      }
    } catch (error) {
      console.log('WebSocket connection failed, will use HTTP transport');
    }
  }

  async demonstrateServerInfo(): Promise<void> {
    console.log('\n=== Server Information ===');
    try {
      const serverInfo = await this.client.getServerInfo();
      console.log('Server info:', serverInfo);
    } catch (error) {
      console.error('Error getting server info:', error);
    }
  }

  async demonstrateTools(): Promise<void> {
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
    }
  }

  async demonstrateResources(): Promise<void> {
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
    }
  }

  async run(): Promise<void> {
    await this.initialize();
    await this.demonstrateServerInfo();
    await this.demonstrateTools();
    await this.demonstrateResources();
    this.client.close();
  }
}

// Start the client/agent
if (require.main === module) {
  const serverUrl = process.env.MCP_SERVER_URL || 'http://localhost:3000';
  const agent = new SimpleAgent(serverUrl);

  agent.run().catch((error) => {
    console.error('Agent error:', error);
    process.exit(1);
  });
} 