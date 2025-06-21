import fetch from 'node-fetch';
import { MCPRequest, MCP_METHODS } from './mcp-types';

async function testHTTPTransport() {
  const serverUrl = 'http://localhost:3000';
  let requestId = 0;

  async function sendRequest(method: string, params?: any) {
    const request: MCPRequest = {
      jsonrpc: '2.0',
      id: (++requestId).toString(),
      method,
      params,
    };

    console.log(`\nSending ${method} request:`, JSON.stringify(request, null, 2));

    const response = await fetch(`${serverUrl}/mcp`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(request),
    });

    const text = await response.text();
    console.log(`Response (${response.status}):`, text);
    
    return JSON.parse(text);
  }

  try {
    console.log('=== Testing MCP HTTP Transport ===\n');

    // Test server info
    console.log('1. Testing server/info...');
    await sendRequest(MCP_METHODS.SERVER_INFO);

    // Test tools/list
    console.log('\n2. Testing tools/list...');
    await sendRequest(MCP_METHODS.TOOLS_LIST);

    // Test tools/call
    console.log('\n3. Testing tools/call...');
    await sendRequest(MCP_METHODS.TOOLS_CALL, {
      name: 'calculate',
      arguments: { expression: '10 * 5 + 2' }
    });

    // Test resources/list
    console.log('\n4. Testing resources/list...');
    await sendRequest(MCP_METHODS.RESOURCES_LIST);

    // Test resources/read
    console.log('\n5. Testing resources/read...');
    await sendRequest(MCP_METHODS.RESOURCES_READ, {
      uri: 'simple://server-info'
    });

    // Test invalid method
    console.log('\n6. Testing invalid method...');
    await sendRequest('invalid/method');

    console.log('\n=== HTTP Transport Test Complete ===');

  } catch (error) {
    console.error('Test failed:', error);
  }
}

if (require.main === module) {
  testHTTPTransport();
} 