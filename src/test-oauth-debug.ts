#!/usr/bin/env node

import { OAuthClient } from './oauth-client';
import { DEFAULT_OAUTH_CONFIG } from './oauth-config';

/**
 * Test script to demonstrate OAuth debug output
 * This script shows the detailed debug information during the OAuth flow
 */

async function testOAuthDebug() {
  console.log('=== OAuth Debug Test ===\n');
  
  // Create OAuth client with debug mode enabled
  const oauthClient = new OAuthClient(DEFAULT_OAUTH_CONFIG, true);
  
  try {
    console.log('1. Testing PKCE generation...');
    const { codeVerifier, codeChallenge } = oauthClient['generatePKCE']();
    console.log('   Code Verifier:', codeVerifier);
    console.log('   Code Challenge:', codeChallenge);
    console.log('   PKCE Challenge Method: S256\n');
    
    console.log('2. Testing state generation...');
    const state = oauthClient['generateState']();
    console.log('   State:', state, '\n');
    
    console.log('3. Testing authorization server metadata...');
    try {
      const metadata = await oauthClient.getAuthorizationServerMetadata();
      console.log('   Metadata retrieved successfully');
      console.log('   Authorization Endpoint:', metadata.authorization_endpoint);
      console.log('   Token Endpoint:', metadata.token_endpoint);
      console.log('   Registration Endpoint:', metadata.registration_endpoint || 'Not supported');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.log('   Metadata fetch failed (expected in demo):', errorMessage, '\n');
    }
    
    console.log('4. Testing client registration...');
    try {
      const clientInfo = await oauthClient.registerClient();
      console.log('   Client registration successful');
      console.log('   Client ID:', clientInfo.clientId);
      console.log('   Has Client Secret:', !!clientInfo.clientSecret);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.log('   Client registration failed (expected in demo):', errorMessage, '\n');
    }
    
    console.log('5. Testing authorization flow start...');
    try {
      const authFlow = await oauthClient.startAuthorization();
      console.log('   Authorization URL generated');
      console.log('   State:', authFlow.state);
      console.log('   Code Verifier present:', !!authFlow.codeVerifier);
      console.log('   Auth URL (first 100 chars):', authFlow.authUrl.substring(0, 100) + '...\n');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.log('   Authorization flow failed:', errorMessage, '\n');
    }
    
    console.log('6. Testing token exchange simulation...');
    try {
      const simulatedCode = 'demo_code_' + Date.now();
      const simulatedState = 'demo_state_' + Date.now();
      const simulatedCodeVerifier = 'demo_verifier_' + Date.now();
      
      await oauthClient.exchangeCodeForTokens(
        simulatedCode,
        simulatedCodeVerifier,
        simulatedState,
        simulatedState
      );
      console.log('   Token exchange simulation completed');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.log('   Token exchange failed (expected in demo):', errorMessage, '\n');
    }
    
    console.log('7. Testing token validation...');
    const hasValidToken = oauthClient.hasValidToken();
    console.log('   Has Valid Token:', hasValidToken, '\n');
    
    console.log('8. Testing token refresh simulation...');
    try {
      await oauthClient.refreshAccessToken();
      console.log('   Token refresh simulation completed');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.log('   Token refresh failed (expected in demo):', errorMessage, '\n');
    }
    
    console.log('9. Testing token clearing...');
    oauthClient.clearTokens();
    console.log('   Tokens cleared');
    console.log('   Has Valid Token after clearing:', oauthClient.hasValidToken(), '\n');
    
  } catch (error) {
    console.error('Test failed:', error);
  }
  
  console.log('=== OAuth Debug Test Complete ===');
}

// Run the test
if (require.main === module) {
  testOAuthDebug().catch(console.error);
}

export { testOAuthDebug }; 