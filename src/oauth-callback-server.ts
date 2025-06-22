import express from 'express';
import { OAuthClient } from './oauth-client';
import { DEFAULT_OAUTH_CONFIG } from './oauth-config';

interface AuthSession {
  state: string;
  codeVerifier: string;
  oauthClient: OAuthClient;
}

class OAuthCallbackServer {
  private app: express.Application;
  private server: any;
  private authSessions: Map<string, AuthSession> = new Map();
  private debug: boolean;

  constructor(port: number = 3001, debug: boolean = false) {
    this.app = express();
    this.debug = debug;
    this.setupRoutes();
    if (this.debug) {
      console.log('[OAuthCallbackServer] Initialized with debug mode enabled');
    }
  }

  private setupRoutes() {
    // OAuth callback endpoint
    this.app.get('/callback', async (req: express.Request, res: express.Response) => {
      const { code, state, error, error_description } = req.query;

      if (this.debug) {
        console.log('[OAuthCallbackServer] Received callback request:');
        console.log('  Code:', code ? 'present' : 'missing');
        console.log('  State:', state);
        console.log('  Error:', error);
        console.log('  Error Description:', error_description);
        console.log('  Query Parameters:', req.query);
      }

      if (error) {
        console.error('OAuth error:', error, error_description);
        if (this.debug) {
          console.error('[OAuthCallbackServer] OAuth error in callback:', { error, error_description });
        }
        res.status(400).send(`
          <html>
            <body>
              <h1>Authorization Failed</h1>
              <p>Error: ${error}</p>
              <p>Description: ${error_description}</p>
            </body>
          </html>
        `);
        return;
      }

      if (!code || !state) {
        if (this.debug) {
          console.error('[OAuthCallbackServer] Missing required parameters:', { code: !!code, state: !!state });
        }
        res.status(400).send(`
          <html>
            <body>
              <h1>Invalid Callback</h1>
              <p>Missing authorization code or state parameter.</p>
            </body>
          </html>
        `);
        return;
      }

      const session = this.authSessions.get(state as string);
      if (this.debug) {
        console.log('[OAuthCallbackServer] Looking up session for state:', state);
        console.log('  Session found:', !!session);
        console.log('  Active sessions count:', this.authSessions.size);
      }
      
      if (!session) {
        if (this.debug) {
          console.error('[OAuthCallbackServer] No session found for state:', state);
          console.error('[OAuthCallbackServer] Available session states:', Array.from(this.authSessions.keys()));
        }
        res.status(400).send(`
          <html>
            <body>
              <h1>Invalid Session</h1>
              <p>Authorization session not found or expired.</p>
            </body>
          </html>
        `);
        return;
      }

      try {
        if (this.debug) {
          console.log('[OAuthCallbackServer] Starting token exchange...');
          console.log('  Session state:', session.state);
          console.log('  Code verifier present:', !!session.codeVerifier);
          console.log('  OAuth client configured:', !!session.oauthClient);
        }

        // Exchange authorization code for tokens
        await session.oauthClient.exchangeCodeForTokens(
          code as string,
          session.codeVerifier,
          state as string,
          session.state
        );

        // Clean up session
        this.authSessions.delete(state as string);
        if (this.debug) {
          console.log('[OAuthCallbackServer] Session cleaned up for state:', state);
          console.log('  Remaining sessions:', this.authSessions.size);
        }

        res.send(`
          <html>
            <body>
              <h1>Authorization Successful!</h1>
              <p>You have successfully authorized the MCP client.</p>
              <p>You can now close this window and return to the application.</p>
              <script>
                // Close window after 3 seconds
                setTimeout(() => window.close(), 3000);
              </script>
            </body>
          </html>
        `);

        console.log('OAuth authorization completed successfully');
        if (this.debug) {
          console.log('[OAuthCallbackServer] Authorization flow completed successfully');
        }
      } catch (error) {
        console.error('Token exchange failed:', error);
        if (this.debug) {
          console.error('[OAuthCallbackServer] Token exchange failed with error:', error);
        }
        res.status(500).send(`
          <html>
            <body>
              <h1>Authorization Failed</h1>
              <p>Failed to exchange authorization code for tokens.</p>
              <p>Error: ${error}</p>
            </body>
          </html>
        `);
      }
    });

    // Health check
    this.app.get('/health', (req: express.Request, res: express.Response) => {
      if (this.debug) {
        console.log('[OAuthCallbackServer] Health check requested');
      }
      res.json({ 
        status: 'ok', 
        server: 'OAuth Callback Server',
        debug: this.debug,
        activeSessions: this.authSessions.size
      });
    });
  }

  // Start the callback server
  start(): Promise<void> {
    return new Promise((resolve, reject) => {
      // Check if server is already running
      if (this.server && this.server.listening) {
        if (this.debug) {
          console.log('[OAuthCallbackServer] Server already running on port 3001');
        }
        resolve();
        return;
      }

      this.server = this.app.listen(3001, () => {
        console.log('OAuth callback server running on http://localhost:3001');
        if (this.debug) {
          console.log('[OAuthCallbackServer] Server started with debug mode');
        }
        resolve();
      });

      this.server.on('error', (error: any) => {
        if (error.code === 'EADDRINUSE') {
          if (this.debug) {
            console.log('[OAuthCallbackServer] Port 3001 already in use, server may already be running');
          }
          resolve(); // Resolve anyway since the server is likely already running
        } else {
          if (this.debug) {
            console.error('[OAuthCallbackServer] Server start error:', error);
          }
          reject(error);
        }
      });
    });
  }

  // Stop the callback server
  stop(): void {
    if (this.debug) {
      console.log('[OAuthCallbackServer] Stopping server...');
    }
    if (this.server) {
      this.server.close();
      if (this.debug) {
        console.log('[OAuthCallbackServer] Server stopped');
      }
    }
  }

  // Check if server is running
  isRunning(): boolean {
    return !!(this.server && this.server.listening);
  }

  // Get server status
  getStatus(): { running: boolean; port: number; sessions: number; debug: boolean } {
    return {
      running: this.isRunning(),
      port: 3001,
      sessions: this.authSessions.size,
      debug: this.debug
    };
  }

  // Store authorization session
  storeSession(state: string, codeVerifier: string, oauthClient: OAuthClient): void {
    if (this.debug) {
      console.log('[OAuthCallbackServer] Storing session:');
      console.log('  State:', state);
      console.log('  Code verifier present:', !!codeVerifier);
      console.log('  OAuth client present:', !!oauthClient);
      console.log('  Sessions before:', this.authSessions.size);
      console.log('  Server running:', this.isRunning());
    }
    
    this.authSessions.set(state, { state, codeVerifier, oauthClient });
    
    if (this.debug) {
      console.log('[OAuthCallbackServer] Session stored successfully');
      console.log('  Sessions after:', this.authSessions.size);
    }
  }

  // Get authorization session
  getSession(state: string): AuthSession | undefined {
    const session = this.authSessions.get(state);
    if (this.debug) {
      console.log('[OAuthCallbackServer] Getting session for state:', state);
      console.log('  Session found:', !!session);
    }
    return session;
  }
}

// Export singleton instance
export const oauthCallbackServer = new OAuthCallbackServer(3001, true);

// Start server if run directly
if (require.main === module) {
  oauthCallbackServer.start().then(() => {
    console.log('OAuth callback server ready');
  });
} 