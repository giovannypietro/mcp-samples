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

  constructor(port: number = 3001) {
    this.app = express();
    this.setupRoutes();
  }

  private setupRoutes() {
    // OAuth callback endpoint
    this.app.get('/callback', async (req: express.Request, res: express.Response) => {
      const { code, state, error, error_description } = req.query;

      if (error) {
        console.error('OAuth error:', error, error_description);
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
      if (!session) {
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
        // Exchange authorization code for tokens
        await session.oauthClient.exchangeCodeForTokens(
          code as string,
          session.codeVerifier,
          state as string,
          session.state
        );

        // Clean up session
        this.authSessions.delete(state as string);

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
      } catch (error) {
        console.error('Token exchange failed:', error);
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
      res.json({ status: 'ok', server: 'OAuth Callback Server' });
    });
  }

  // Start the callback server
  start(): Promise<void> {
    return new Promise((resolve) => {
      this.server = this.app.listen(3001, () => {
        console.log('OAuth callback server running on http://localhost:3001');
        resolve();
      });
    });
  }

  // Stop the callback server
  stop(): void {
    if (this.server) {
      this.server.close();
    }
  }

  // Store authorization session
  storeSession(state: string, codeVerifier: string, oauthClient: OAuthClient): void {
    this.authSessions.set(state, { state, codeVerifier, oauthClient });
  }

  // Get authorization session
  getSession(state: string): AuthSession | undefined {
    return this.authSessions.get(state);
  }
}

// Export singleton instance
export const oauthCallbackServer = new OAuthCallbackServer();

// Start server if run directly
if (require.main === module) {
  oauthCallbackServer.start().then(() => {
    console.log('OAuth callback server ready');
  });
} 