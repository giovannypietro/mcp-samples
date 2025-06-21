import express from 'express';
import cors from 'cors';
import { WebSocketServer } from 'ws';
import { 
  MCPRequest, 
  MCPResponse, 
  MCPError, 
  MCP_METHODS, 
  MCP_ERROR_CODES,
  Tool,
  CallToolRequest,
  CallToolResult,
  Resource,
  ReadResourceRequest,
  ReadResourceResult
} from './mcp-types';
import { 
  ProtectedResourceMetadata, 
  MCP_SERVER_URI,
  OAUTH_CONSTANTS 
} from './oauth-config';

// Simple MCP Server implementation following the official specification
class SimpleMCPServer {
  private name: string;
  private version: string;

  constructor() {
    this.name = 'simple-mcp-server';
    this.version = '1.0.0';
  }

  // List available tools
  async listTools(): Promise<{ tools: Tool[] }> {
    return {
      tools: [
        {
          name: 'get_current_time',
          description: 'Get the current date and time',
          inputSchema: {
            type: 'object',
            properties: {},
            required: [],
          },
        },
        {
          name: 'calculate',
          description: 'Perform basic mathematical calculations',
          inputSchema: {
            type: 'object',
            properties: {
              expression: {
                type: 'string',
                description: 'Mathematical expression to evaluate (e.g., "2 + 2")',
              },
            },
            required: ['expression'],
          },
        },
        {
          name: 'echo',
          description: 'Echo back the input message',
          inputSchema: {
            type: 'object',
            properties: {
              message: {
                type: 'string',
                description: 'Message to echo back',
              },
            },
            required: ['message'],
          },
        },
      ],
    };
  }

  // Call a tool
  async callTool(request: CallToolRequest): Promise<CallToolResult> {
    const { name, arguments: args } = request;

    switch (name) {
      case 'get_current_time':
        return {
          content: [
            {
              type: 'text',
              text: `Current time: ${new Date().toISOString()}`,
            },
          ],
        };

      case 'calculate':
        try {
          const expression = args.expression as string;
          // Note: In production, you'd want to use a safer evaluation method
          const result = eval(expression);
          return {
            content: [
              {
                type: 'text',
                text: `${expression} = ${result}`,
              },
            ],
          };
        } catch (error) {
          return {
            content: [
              {
                type: 'text',
                text: `Error evaluating expression: ${error}`,
              },
            ],
          };
        }

      case 'echo':
        return {
          content: [
            {
              type: 'text',
              text: `Echo: ${args.message}`,
            },
          ],
        };

      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  }

  // List available resources
  async listResources(): Promise<{ resources: Resource[] }> {
    return {
      resources: [
        {
          uri: 'simple://server-info',
          name: 'Server Information',
          description: 'Basic information about this MCP server',
          mimeType: 'text/plain',
        },
        {
          uri: 'simple://system-status',
          name: 'System Status',
          description: 'Current system status and statistics',
          mimeType: 'application/json',
        },
      ],
    };
  }

  // Read a resource
  async readResource(request: ReadResourceRequest): Promise<ReadResourceResult> {
    const { uri } = request;

    switch (uri) {
      case 'simple://server-info':
        return {
          contents: [
            {
              uri: 'simple://server-info',
              mimeType: 'text/plain',
              text: `Simple MCP Server v1.0.0
Started at: ${new Date().toISOString()}
Available tools: get_current_time, calculate, echo
Available resources: server-info, system-status`,
            },
          ],
        };

      case 'simple://system-status':
        return {
          contents: [
            {
              uri: 'simple://system-status',
              mimeType: 'application/json',
              text: JSON.stringify({
                server: 'Simple MCP Server',
                version: '1.0.0',
                uptime: process.uptime(),
                memory: process.memoryUsage(),
                timestamp: new Date().toISOString(),
              }, null, 2),
            },
          ],
        };

      default:
        throw new Error(`Unknown resource: ${uri}`);
    }
  }

  // Get server info
  getServerInfo() {
    return {
      name: this.name,
      version: this.version,
    };
  }

  // Get protected resource metadata (RFC9728)
  getProtectedResourceMetadata(): ProtectedResourceMetadata {
    return {
      resource: MCP_SERVER_URI,
      authorization_servers: [
        process.env.OAUTH_AUTHORIZATION_SERVER || 'https://oauth.example.com'
      ],
      scopes: ['mcp:read', 'mcp:write'],
      token_endpoint_auth_methods_supported: ['client_secret_basic', 'client_secret_post'],
    };
  }
}

// Simple token validator (in production, use a proper JWT library)
class TokenValidator {
  private authorizationServer: string;

  constructor(authorizationServer: string) {
    this.authorizationServer = authorizationServer;
  }

  // Validate access token (simplified - in production, validate JWT properly)
  async validateToken(token: string): Promise<{ valid: boolean; audience?: string; scope?: string }> {
    try {
      // In a real implementation, you would:
      // 1. Decode and validate the JWT
      // 2. Verify the signature using the authorization server's JWKS
      // 3. Check the audience claim matches this server's URI
      // 4. Check the token hasn't expired
      // 5. Verify the scope includes required permissions

      // For this demo, we'll do a simple check
      if (!token || token.length < 10) {
        return { valid: false };
      }

      // Simulate token validation
      // In production, decode JWT and validate properly
      return {
        valid: true,
        audience: MCP_SERVER_URI,
        scope: 'mcp:read mcp:write',
      };
    } catch (error) {
      return { valid: false };
    }
  }
}

// HTTP Stream Transport Server with OAuth 2.1 resource server functionality
class HTTPStreamTransport {
  private app: express.Application;
  private wss!: WebSocketServer;
  private server: any;
  private mcpServer: SimpleMCPServer;
  private tokenValidator: TokenValidator;

  constructor(port: number = 3000) {
    this.app = express();
    this.mcpServer = new SimpleMCPServer();
    this.tokenValidator = new TokenValidator(
      process.env.OAUTH_AUTHORIZATION_SERVER || 'https://oauth.example.com'
    );
    this.setupExpress();
    this.setupWebSocket(port);
  }

  private setupExpress() {
    this.app.use(cors());
    this.app.use(express.json());

    // Health check endpoint
    this.app.get('/health', (req: express.Request, res: express.Response) => {
      res.json({ status: 'ok', server: 'Simple MCP Server' });
    });

    // Protected Resource Metadata endpoint (RFC9728)
    this.app.get('/.well-known/oauth-resource-metadata', (req: express.Request, res: express.Response) => {
      res.json(this.mcpServer.getProtectedResourceMetadata());
    });

    // MCP endpoint for HTTP stream transport with OAuth protection
    this.app.post('/mcp', async (req: express.Request, res: express.Response) => {
      try {
        // Extract and validate authorization header
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
          // Return 401 with WWW-Authenticate header as per RFC9728
          res.setHeader('WWW-Authenticate', `Bearer realm="${MCP_SERVER_URI}", resource="${MCP_SERVER_URI}"`);
          return res.status(401).json({
            error: 'unauthorized',
            error_description: 'Bearer token required',
          });
        }

        const token = authHeader.substring(7); // Remove 'Bearer ' prefix

        // Validate the access token
        const tokenValidation = await this.tokenValidator.validateToken(token);
        if (!tokenValidation.valid) {
          res.setHeader('WWW-Authenticate', `Bearer realm="${MCP_SERVER_URI}", resource="${MCP_SERVER_URI}"`);
          return res.status(401).json({
            error: 'invalid_token',
            error_description: 'Invalid or expired access token',
          });
        }

        // Check if token audience matches this server
        if (tokenValidation.audience !== MCP_SERVER_URI) {
          return res.status(403).json({
            error: 'insufficient_scope',
            error_description: 'Token not intended for this resource',
          });
        }

        const mcpRequest: MCPRequest = req.body;
        
        // Validate JSON-RPC 2.0 request
        if (mcpRequest.jsonrpc !== '2.0' || !mcpRequest.id || !mcpRequest.method) {
          const errorResponse: MCPResponse = {
            jsonrpc: '2.0',
            id: mcpRequest.id || null,
            error: {
              code: MCP_ERROR_CODES.INVALID_REQUEST,
              message: 'Invalid JSON-RPC 2.0 request',
            },
          };
          return res.status(400).json(errorResponse);
        }

        // Set headers for streaming
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Transfer-Encoding', 'chunked');

        let result: any;
        let error: MCPError | undefined;

        try {
          switch (mcpRequest.method) {
            case MCP_METHODS.TOOLS_LIST:
              result = await this.mcpServer.listTools();
              break;
            case MCP_METHODS.TOOLS_CALL:
              result = await this.mcpServer.callTool(mcpRequest.params);
              break;
            case MCP_METHODS.RESOURCES_LIST:
              result = await this.mcpServer.listResources();
              break;
            case MCP_METHODS.RESOURCES_READ:
              result = await this.mcpServer.readResource(mcpRequest.params);
              break;
            case MCP_METHODS.SERVER_INFO:
              result = this.mcpServer.getServerInfo();
              break;
            default:
              error = {
                code: MCP_ERROR_CODES.METHOD_NOT_FOUND,
                message: `Method not found: ${mcpRequest.method}`,
              };
          }
        } catch (methodError: any) {
          error = {
            code: MCP_ERROR_CODES.INTERNAL_ERROR,
            message: methodError.message,
          };
        }

        const mcpResponse: MCPResponse = {
          jsonrpc: '2.0',
          id: mcpRequest.id,
          ...(result && { result }),
          ...(error && { error }),
        };

        // Stream the result
        res.write(JSON.stringify(mcpResponse) + '\n');
        res.end();
      } catch (error: any) {
        const errorResponse: MCPResponse = {
          jsonrpc: '2.0',
          id: req.body?.id || null,
          error: {
            code: MCP_ERROR_CODES.PARSE_ERROR,
            message: error.message,
          },
        };
        res.status(500).json(errorResponse);
      }
    });
  }

  private setupWebSocket(port: number) {
    this.server = this.app.listen(port, () => {
      console.log(`MCP Server running on http://localhost:${port}`);
      console.log(`WebSocket server available on ws://localhost:${port}`);
      console.log(`Protected Resource Metadata: http://localhost:${port}/.well-known/oauth-resource-metadata`);
    });

    this.wss = new WebSocketServer({ server: this.server });

    this.wss.on('connection', (ws) => {
      console.log('Client connected via WebSocket');

      ws.on('message', async (message) => {
        let data: any;
        try {
          data = JSON.parse(message.toString());
          const mcpRequest: MCPRequest = data;

          // Validate JSON-RPC 2.0 request
          if (mcpRequest.jsonrpc !== '2.0' || !mcpRequest.id || !mcpRequest.method) {
            const errorResponse: MCPResponse = {
              jsonrpc: '2.0',
              id: mcpRequest.id || null,
              error: {
                code: MCP_ERROR_CODES.INVALID_REQUEST,
                message: 'Invalid JSON-RPC 2.0 request',
              },
            };
            ws.send(JSON.stringify(errorResponse));
            return;
          }

          let result: any;
          let error: MCPError | undefined;

          try {
            switch (mcpRequest.method) {
              case MCP_METHODS.TOOLS_LIST:
                result = await this.mcpServer.listTools();
                break;
              case MCP_METHODS.TOOLS_CALL:
                result = await this.mcpServer.callTool(mcpRequest.params);
                break;
              case MCP_METHODS.RESOURCES_LIST:
                result = await this.mcpServer.listResources();
                break;
              case MCP_METHODS.RESOURCES_READ:
                result = await this.mcpServer.readResource(mcpRequest.params);
                break;
              case MCP_METHODS.SERVER_INFO:
                result = this.mcpServer.getServerInfo();
                break;
              default:
                error = {
                  code: MCP_ERROR_CODES.METHOD_NOT_FOUND,
                  message: `Method not found: ${mcpRequest.method}`,
                };
            }
          } catch (methodError: any) {
            error = {
              code: MCP_ERROR_CODES.INTERNAL_ERROR,
              message: methodError.message,
            };
          }

          const mcpResponse: MCPResponse = {
            jsonrpc: '2.0',
            id: mcpRequest.id,
            ...(result && { result }),
            ...(error && { error }),
          };

          ws.send(JSON.stringify(mcpResponse));
        } catch (error: any) {
          const errorResponse: MCPResponse = {
            jsonrpc: '2.0',
            id: data?.id || null,
            error: {
              code: MCP_ERROR_CODES.PARSE_ERROR,
              message: error.message,
            },
          };
          ws.send(JSON.stringify(errorResponse));
        }
      });

      ws.on('close', () => {
        console.log('Client disconnected');
      });
    });
  }

  public stop() {
    this.wss.close();
    this.server.close();
  }
}

// Start the server
if (require.main === module) {
  const port = parseInt(process.env.PORT || '3000');
  const transport = new HTTPStreamTransport(port);

  process.on('SIGINT', () => {
    console.log('\nShutting down server...');
    transport.stop();
    process.exit(0);
  });
} 