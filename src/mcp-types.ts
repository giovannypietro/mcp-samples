// MCP Protocol Types based on the official specification
// https://modelcontextprotocol.io/specification

export interface MCPRequest {
  jsonrpc: "2.0";
  id: string | number;
  method: string;
  params?: any;
}

export interface MCPResponse {
  jsonrpc: "2.0";
  id: string | number | null;
  result?: any;
  error?: MCPError;
}

export interface MCPError {
  code: number;
  message: string;
  data?: any;
}

// Tool-related types
export interface Tool {
  name: string;
  description: string;
  inputSchema: {
    type: string;
    properties: Record<string, any>;
    required: string[];
  };
}

export interface CallToolRequest {
  name: string;
  arguments: Record<string, any>;
}

export interface CallToolResult {
  content: Array<{
    type: string;
    text: string;
  }>;
}

// Resource-related types
export interface Resource {
  uri: string;
  name: string;
  description: string;
  mimeType: string;
}

export interface ReadResourceRequest {
  uri: string;
}

export interface ReadResourceResult {
  contents: Array<{
    uri: string;
    mimeType: string;
    text: string;
  }>;
}

// MCP Methods
export const MCP_METHODS = {
  // Tool methods
  TOOLS_LIST: "tools/list",
  TOOLS_CALL: "tools/call",
  
  // Resource methods
  RESOURCES_LIST: "resources/list",
  RESOURCES_READ: "resources/read",
  
  // Server methods
  SERVER_INFO: "server/info",
  SERVER_NOTIFY_CAPABILITIES: "server/notify/capabilities",
} as const;

// MCP Error Codes
export const MCP_ERROR_CODES = {
  PARSE_ERROR: -32700,
  INVALID_REQUEST: -32600,
  METHOD_NOT_FOUND: -32601,
  INVALID_PARAMS: -32602,
  INTERNAL_ERROR: -32603,
  SERVER_ERROR_START: -32000,
  SERVER_ERROR_END: -32099,
} as const; 