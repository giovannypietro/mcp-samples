#!/usr/bin/env node

import { SimpleAgent } from './client';
import { oauthCallbackServer } from './oauth-callback-server';

/**
 * Test script to verify the full OAuth flow with debug output
 * This script will help identify where the session issue occurs
 */

async function testFullOAuthFlow() {
  console.log('=== Full OAuth Flow Test (Debug Mode) ===\n');
  
  try {
    // Create agent with debug mode enabled
    console.log('1. Creating MCP agent with debug mode...');
    const agent = new SimpleAgent('http://localhost:3000', true);
    console.log('   Agent created with debug mode');
    
    // Check callback server status before starting
    console.log('\n2. Checking callback server status...');
    const initialStatus = oauthCallbackServer.getStatus();
    console.log('   Initial status:', initialStatus);
    
    // Start OAuth initialization
    console.log('\n3. Starting OAuth initialization...');
    console.log('   This will start the authorization flow...');
    
    // Set a timeout for the authorization flow
    const authPromise = agent.initialize();
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Authorization timeout - this is expected for testing')), 30000);
    });
    
    try {
      await Promise.race([authPromise, timeoutPromise]);
    } catch (error) {
      if (error instanceof Error && error.message.includes('timeout')) {
        console.log('\n   Authorization flow started successfully (timeout expected)');
        console.log('   The flow is waiting for manual authorization completion');
      } else {
        throw error;
      }
    }
    
    // Check callback server status after initialization
    console.log('\n4. Checking callback server status after initialization...');
    const finalStatus = oauthCallbackServer.getStatus();
    console.log('   Final status:', finalStatus);
    
    // Test session retrieval
    console.log('\n5. Testing session retrieval...');
    // Note: We don't have the actual state here, but we can check if any sessions exist
    if (finalStatus.sessions > 0) {
      console.log('   Sessions exist in callback server');
      console.log('   This means the session storage is working');
    } else {
      console.log('   No sessions found in callback server');
      console.log('   This indicates a session storage issue');
    }
    
    console.log('\n=== Test Completed ===');
    console.log('If you see "Sessions exist in callback server", the session storage is working correctly.');
    console.log('If you see "No sessions found", there is a session storage issue.');
    
  } catch (error) {
    console.error('Test failed:', error);
  } finally {
    // Clean up
    try {
      oauthCallbackServer.stop();
      console.log('\nCallback server stopped');
    } catch (error) {
      console.log('Error stopping callback server:', error);
    }
  }
}

// Run the test
if (require.main === module) {
  testFullOAuthFlow().catch(console.error);
}

export { testFullOAuthFlow }; 