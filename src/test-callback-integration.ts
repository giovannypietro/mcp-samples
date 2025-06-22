#!/usr/bin/env node

import { oauthCallbackServer } from './oauth-callback-server';
import { OAuthClient } from './oauth-client';
import { DEFAULT_OAUTH_CONFIG } from './oauth-config';

/**
 * Test script to verify callback server integration
 * This script tests the session storage and retrieval functionality
 */

async function testCallbackIntegration() {
  console.log('=== Callback Server Integration Test ===\n');
  
  try {
    // Start the callback server
    console.log('1. Starting callback server...');
    await oauthCallbackServer.start();
    console.log('   Callback server started successfully');
    console.log('   Status:', oauthCallbackServer.getStatus());
    
    // Create an OAuth client
    console.log('\n2. Creating OAuth client...');
    const oauthClient = new OAuthClient(DEFAULT_OAUTH_CONFIG, true);
    console.log('   OAuth client created');
    
    // Generate test session data
    console.log('\n3. Generating test session data...');
    const testState = 'test_state_' + Date.now();
    const testCodeVerifier = 'test_code_verifier_' + Date.now();
    console.log('   Test State:', testState);
    console.log('   Test Code Verifier:', testCodeVerifier);
    
    // Store session
    console.log('\n4. Storing session with callback server...');
    oauthCallbackServer.storeSession(testState, testCodeVerifier, oauthClient);
    console.log('   Session stored');
    console.log('   Status:', oauthCallbackServer.getStatus());
    
    // Retrieve session
    console.log('\n5. Retrieving session from callback server...');
    const retrievedSession = oauthCallbackServer.getSession(testState);
    if (retrievedSession) {
      console.log('   Session retrieved successfully');
      console.log('   Retrieved State:', retrievedSession.state);
      console.log('   Retrieved Code Verifier:', retrievedSession.codeVerifier);
      console.log('   OAuth Client Present:', !!retrievedSession.oauthClient);
    } else {
      console.log('   ERROR: Session not found!');
    }
    
    // Test with non-existent state
    console.log('\n6. Testing with non-existent state...');
    const nonExistentSession = oauthCallbackServer.getSession('non_existent_state');
    if (!nonExistentSession) {
      console.log('   Correctly returned null for non-existent session');
    } else {
      console.log('   ERROR: Found session for non-existent state!');
    }
    
    // Clean up
    console.log('\n7. Cleaning up...');
    oauthCallbackServer.stop();
    console.log('   Callback server stopped');
    
    console.log('\n=== Test Completed Successfully ===');
    
  } catch (error) {
    console.error('Test failed:', error);
  }
}

// Run the test
if (require.main === module) {
  testCallbackIntegration().catch(console.error);
}

export { testCallbackIntegration }; 