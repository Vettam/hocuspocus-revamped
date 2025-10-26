import { Server } from "@hocuspocus/server";
import { jwtVerify } from "jose";
import { serverConfig } from "../config";
import { logger } from "../config/logger";
import { vettamAPI } from "../services/vettam-api";
import { documentService } from "../services/document";
import {
  HocuspocusAuthPayload,
  AuthContext,
  AuthorizationRequest,
} from "../types";

export class HocuspocusServer {
  private server: Server;

  constructor() {
    this.server = new Server({
      port: serverConfig.port.hocuspocus,

      // Authentication hook
      onAuthenticate: async (data) => {
        try {
          const payload = await this.authenticateConnection(data);
          logger.info("User authenticated for Hocuspocus", payload);
          return payload;
        } catch (error) {
          logger.error("Authentication failed", {
            error: (error as Error).message,
          });
          throw error;
        }
      },

      // Document loading hook - Let Hocuspocus create the document
      // We'll load the initial state in afterLoadDocument
      onLoadDocument: async (data) => {
        const roomId = data.context.room_id;
        logger.debug("onLoadDocument called for room", { roomId });

        // Return undefined to let Hocuspocus create a new empty YDoc
        // We'll populate it in afterLoadDocument
        return undefined;
      },

      // Document creation hook
      onCreateDocument: async (data) => {
        const { documentName } = data;
        logger.debug("Document created", { documentName });
      },

      // Connection established hook
      onConnect: async (data) => {
        const { documentName } = data;
        logger.info("Client connected to document", { documentName });
      },

      // After document is loaded/created - load initial state and register
      afterLoadDocument: async (data) => {
        const roomId = data.context?.room_id || data.documentName;

        logger.info("afterLoadDocument called, registering document", {
          roomId,
        });

        // Register Hocuspocus's YDoc instance with our service
        documentService.registerHocuspocusDocument(roomId, data.document);

        // Load initial state from API into this YDoc
        await documentService.loadInitialStateFromAPI(roomId, data.document);

        logger.info("Document registered and initial state loaded", { roomId });
      },

      // Connection closed hook
      onDisconnect: async (data) => {
        const { documentName } = data;
        logger.info("Client disconnected from document", { documentName });

        try {
          const roomId = data.context?.room_id || data.documentName;
          if (!roomId) {
            logger.warn(
              "No room id/document name available to persist on disconnect",
              { data }
            );
            return;
          }

          logger.debug("Persisting document to storage on disconnect", {
            roomId,
          });

          // Retrieve Yjs document from our document service
          const yDoc = documentService.getDocument(roomId);

          if (!yDoc) {
            logger.warn("No document found to persist", { roomId });
            return;
          }

          // Persist the document state to storage (assumes documentService.saveDocument exists)
          await documentService.saveSnapshot(roomId);

          logger.info("Document persisted to storage on disconnect", {
            roomId,
          });
        } catch (error) {
          logger.error("Failed to persist document on disconnect", {
            documentName: data.documentName,
            error: (error as Error).message,
          });
        }
      },

      // Error handling
      onDestroy: async () => {
        logger.info("Hocuspocus server is shutting down");
      },
    });

    // Note: Hocuspocus server doesn't have a direct 'on' method for errors
    // Error handling is done through the hooks above
  }

  /**
   * Authenticate a connection using JWT and Vettam API
   */
  private async authenticateConnection(data: any): Promise<AuthContext> {
    const { token, documentName } = this.parseAuthPayload(data);

    if (!token) {
      throw new Error("Authentication token is required");
    }

    if (!documentName) {
      throw new Error("Document name is required");
    }

    try {
      // Verify JWT token
      const secret = new TextEncoder().encode(serverConfig.jwt.secret);
      const { payload } = await jwtVerify(token, secret);

      if (!payload.sub) {
        throw new Error("Invalid token: missing user ID");
      }

      const userId = payload.sub as string;
      const draftID = documentService.extractDraftId(documentName);
      const versionId = documentService.extractVersionId(documentName);

      if (!draftID || !versionId) {
        throw new Error("Invalid document name format");
      }

      // Check authorization with Vettam API
      const authRequest: AuthorizationRequest = {
        userId: userId,
        roomId: documentName,
        userJwt: token,
        draftId: draftID,
        versionId: versionId,
      };

      const authResponse = await vettamAPI.authorizeUser(authRequest);

      if (!authResponse.access) {
        throw new Error("User not authorized to access this room");
      }

      // Return auth context
      const authContext: AuthContext = {
        user: authResponse.user,
        room_id: authResponse.room.room_id,
        edit: authResponse.edit,
      };

      return authContext;
    } catch (error) {
      logger.error("Authentication failed", {
        error: (error as Error).message,
        documentName,
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
      const url = new URL(request.url, "http://localhost");
      token = url.searchParams.get("token") || undefined;
    }

    // 2. From headers
    if (!token && request.headers.authorization) {
      const authHeader = request.headers.authorization;
      if (authHeader.startsWith("Bearer ")) {
        token = authHeader.substring(7);
      }
    }

    // 3. From WebSocket subprotocol (if available)
    if (!token && request.headers["sec-websocket-protocol"]) {
      const protocols = request.headers["sec-websocket-protocol"].split(", ");
      const tokenProtocol = protocols.find((p: string) =>
        p.startsWith("token.")
      );
      if (tokenProtocol) {
        token = tokenProtocol.substring(6); // Remove 'token.' prefix
      }
    }

    if (!token && data.token) {
      token = data.token;
    }

    if (!token) {
      throw new Error("No authentication token found in request");
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
      logger.info(
        `Hocuspocus server started on port ${serverConfig.port.hocuspocus}`
      );
    } catch (error) {
      logger.error("Failed to start Hocuspocus server", {
        error: (error as Error).message,
      });
      throw error;
    }
  }

  /**
   * Stop the Hocuspocus server
   */
  async stop(): Promise<void> {
    try {
      await this.server.destroy();
      logger.info("Hocuspocus server stopped");
    } catch (error) {
      logger.error("Error stopping Hocuspocus server", {
        error: (error as Error).message,
      });
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
