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
}

// HTTP Stream Transport Server with proper MCP protocol
class HTTPStreamTransport {
  private app: express.Application;
  private wss!: WebSocketServer;
  private server: any;
  private mcpServer: SimpleMCPServer;

  constructor(port: number = 3000) {
    this.app = express();
    this.mcpServer = new SimpleMCPServer();
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

    // MCP endpoint for HTTP stream transport
    this.app.post('/mcp', async (req: express.Request, res: express.Response) => {
      try {
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