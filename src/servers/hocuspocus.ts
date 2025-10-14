import { Server } from '@hocuspocus/server';
import { jwtVerify } from 'jose';
import { serverConfig } from '../config';
import { logger } from '../config/logger';
import { vettamAPI } from '../services/vettam-api';
import { documentService } from '../services/document';
import { 
  HocuspocusAuthPayload, 
  AuthContext,
  AuthorizationRequest 
} from '../types';

export class HocuspocusServer {
  private server: Server;

  constructor() {
    this.server = new Server({
      port: serverConfig.port.hocuspocus,
      
      // Authentication hook
      onAuthenticate: async (data) => {
        try {
          const payload = await this.authenticateConnection(data);
          logger.info('User authenticated for Hocuspocus', {
            userId: payload.user.id,
            roomId: payload.roomId,
          });
          return payload;
        } catch (error) {
          logger.error('Authentication failed', { error: (error as Error).message });
          throw error;
        }
      },

      // Document loading hook
      onLoadDocument: async (data) => {
        try {
          const { documentName } = data;
          logger.debug('Loading document', { documentName });
          
          // Get the Yjs document from our document service
          const yDoc = documentService.getDocument(documentName);
          
          // Return the document state
          return yDoc;
        } catch (error) {
          logger.error('Failed to load document', { 
            documentName: data.documentName,
            error: (error as Error).message 
          });
          throw error;
        }
      },

      // Document creation hook
      onCreateDocument: async (data) => {
        const { documentName } = data;
        logger.debug('Document created', { documentName });
        
        // Ensure document exists in our service
        documentService.getDocument(documentName);
      },

      // Connection established hook
      onConnect: async (data) => {
        const { documentName } = data;
        logger.info('Client connected to document', { documentName });
      },

      // Connection closed hook
      onDisconnect: async (data) => {
        const { documentName } = data;
        logger.info('Client disconnected from document', { documentName });
      },

      // Error handling
      onDestroy: async () => {
        logger.info('Hocuspocus server is shutting down');
      },
    });

    // Note: Hocuspocus server doesn't have a direct 'on' method for errors
    // Error handling is done through the hooks above
  }

  /**
   * Authenticate a connection using JWT and Vettam API
   */
  private async authenticateConnection(data: any): Promise<AuthContext> {
    const { token, documentName } = data.connection.readOnly 
      ? { token: null, documentName: data.documentName }
      : this.parseAuthPayload(data);

    if (!token) {
      throw new Error('Authentication token is required');
    }

    if (!documentName) {
      throw new Error('Document name is required');
    }

    try {
      // Verify JWT token
      const secret = new TextEncoder().encode(serverConfig.jwt.secret);
      const { payload } = await jwtVerify(token, secret);

      if (!payload.sub) {
        throw new Error('Invalid token: missing user ID');
      }

      const userId = payload.sub as string;
      const roomId = documentName; // Assuming documentName maps to roomId

      // Check authorization with Vettam API
      const authRequest: AuthorizationRequest = {
        userId,
        roomId,
        action: 'write', // Default to write access
      };

      const authResponse = await vettamAPI.authorizeUser(authRequest);

      if (!authResponse.authorized) {
        throw new Error('User not authorized to access this room');
      }

      // Return auth context
      const authContext: AuthContext = {
        user: authResponse.user,
        roomId,
        permissions: authResponse.permissions,
      };

      return authContext;
    } catch (error) {
      logger.error('Authentication failed', { 
        error: (error as Error).message,
        documentName 
      });
      throw new Error(`Authentication failed: ${(error as Error).message}`);
    }
  }

  /**
   * Parse authentication payload from connection data
   */
  private parseAuthPayload(data: any): HocuspocusAuthPayload {
    const { request } = data;
    
    // Try to get token from different sources
    let token: string | undefined;
    
    // 1. From query parameters
    if (request.url) {
      const url = new URL(request.url, 'http://localhost');
      token = url.searchParams.get('token') || undefined;
    }
    
    // 2. From headers
    if (!token && request.headers.authorization) {
      const authHeader = request.headers.authorization;
      if (authHeader.startsWith('Bearer ')) {
        token = authHeader.substring(7);
      }
    }
    
    // 3. From WebSocket subprotocol (if available)
    if (!token && request.headers['sec-websocket-protocol']) {
      const protocols = request.headers['sec-websocket-protocol'].split(', ');
      const tokenProtocol = protocols.find((p: string) => p.startsWith('token.'));
      if (tokenProtocol) {
        token = tokenProtocol.substring(6); // Remove 'token.' prefix
      }
    }

    if (!token) {
      throw new Error('No authentication token found in request');
    }

    return {
      token,
      roomName: data.documentName,
      documentName: data.documentName,
    };
  }

  /**
   * Start the Hocuspocus server
   */
  async start(): Promise<void> {
    try {
      await this.server.listen();
      logger.info(`Hocuspocus server started on port ${serverConfig.port.hocuspocus}`);
    } catch (error) {
      logger.error('Failed to start Hocuspocus server', { error: (error as Error).message });
      throw error;
    }
  }

  /**
   * Stop the Hocuspocus server
   */
  async stop(): Promise<void> {
    try {
      await this.server.destroy();
      logger.info('Hocuspocus server stopped');
    } catch (error) {
      logger.error('Error stopping Hocuspocus server', { error: (error as Error).message });
      throw error;
    }
  }

  /**
   * Get server instance (for testing or advanced usage)
   */
  getInstance(): Server {
    return this.server;
  }
}

export default HocuspocusServer;