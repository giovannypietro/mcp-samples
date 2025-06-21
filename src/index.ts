#!/usr/bin/env node

import { spawn } from 'child_process';
import path from 'path';

const args = process.argv.slice(2);
const command = args[0];

if (command === 'server') {
  // Start the server
  console.log('Starting MCP Server...');
  import('./server');
} else if (command === 'client') {
  // Start the client
  console.log('Starting MCP Client...');
  import('./client');
} else {
  console.log('Simple MCP Agent and Server');
  console.log('');
  console.log('Usage:');
  console.log('  npm run server  - Start the MCP server');
  console.log('  npm run client  - Run the MCP client/agent');
  console.log('');
  console.log('Or directly:');
  console.log('  npx ts-node src/server.ts  - Start server');
  console.log('  npx ts-node src/client.ts  - Run client');
  console.log('');
  console.log('The server will be available at:');
  console.log('  HTTP: http://localhost:3000/mcp');
  console.log('  WebSocket: ws://localhost:3000');
  console.log('  Health: http://localhost:3000/health');
} 