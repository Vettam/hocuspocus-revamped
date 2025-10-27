import express, { Request, Response, NextFunction } from "express";
import expressWebsockets from "express-ws";
import helmet from "helmet";
import { Hocuspocus } from "@hocuspocus/server";
import { jwtVerify } from "jose";
import { serverConfig } from "../config";
import { logger } from "../config/logger";
import { vettamAPI } from "../services/vettam-api";
import { documentService } from "../services/document";
import { handleErrorResponse } from "../utils";
import {
  apiKeyMiddleware,
  rateLimitMiddleware,
  requestLoggingMiddleware,
  corsMiddleware,
} from "../middleware";
import {
  HocuspocusAuthPayload,
  AuthContext,
  AuthorizationRequest,
} from "../types";

// Routes Imports
import indexRouter from "../routes/index";
import healthRouter from "../routes/health";
import catchAllRouter from "../routes/catch-all";
import stateRouter from "../routes/state";

export class ExpressServer {
  private app: expressWebsockets.Application; // Express app with WebSocket support
  private server?: any;
  private hocuspocus: Hocuspocus;

  constructor() {
    // Configure Hocuspocus
    this.hocuspocus = new Hocuspocus({
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

    // Setup your express instance using the express-ws extension
    const { app } = expressWebsockets(express());
    this.app = app;

    // Trust proxy headers (e.g., X-Forwarded-For) when behind a proxy
    // Used to get the real IP of the client, especially when behind
    // load balancers or reverse proxies
    this.app.set("trust proxy", true);

    this.setupMiddleware();
    this.setupRoutes();
    this.setupErrorHandling();
  }

  /**
   * Setup Express middleware
   */
  private setupMiddleware(): void {
    // Security middleware with enhanced headers
    this.app.use(
      helmet({
        contentSecurityPolicy: {
          directives: {
            defaultSrc: ["'self'"],
            connectSrc: ["'self'", "wss:", "ws:"],
          },
        },
        crossOriginEmbedderPolicy: false,
      })
    );

    // Additional security headers
    this.app.use((_req: Request, res: Response, next: NextFunction) => {
      res.setHeader("X-Frame-Options", "DENY");
      res.setHeader("X-Content-Type-Options", "nosniff");
      res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
      next();
    });

    // CORS middleware with environment-based configuration
    this.app.use(corsMiddleware());

    // JWT-based rate limiting middleware for HTTP endpoints only
    // WebSocket connections and health endpoints are excluded
    this.app.use(rateLimitMiddleware);

    // API key authentication middleware
    // Protects all endpoints except those in DEFAULT_OPEN_LOCATIONS
    this.app.use(apiKeyMiddleware);

    // Body parsing middleware
    this.app.use(express.json({ limit: "10mb" }));
    this.app.use(express.urlencoded({ extended: true, limit: "10mb" }));

    // Request logging middleware
    this.app.use(requestLoggingMiddleware);
  }

  /**
   * Setup Express routes
   */
  private setupRoutes(): void {
    console.log("Setting up websocket route for Hocuspocus");
    // Add a websocket route for Hocuspocus
    // You can set any contextual data like in the onConnect hook
    // and pass it to the handleConnection method.
    this.app.ws("/collaboration", (websocket: any, request: any) => {
      const context = {};

      this.hocuspocus.handleConnection(websocket, request, context);
    });

    // Load modularized route modules
    this.loadRoutes();
  }

  /**
   * Load route modules
   */
  private loadRoutes(): void {
    // Import and load modularized route files
    try {
      // Root endpoint (API info)
      this.app.use("/", indexRouter);

      // Health check endpoint
      this.app.use("/health", healthRouter);

      // Load state routes
      this.app.use("/v1/state", stateRouter);

      // Catch remaining
      this.app.use("*", catchAllRouter);

      logger.info("Loaded all modularized routes");
    } catch (error) {
      logger.error("Failed to load modularized routes", {
        error: (error as Error).message,
      });
    }

    // Catch-all route for unmatched endpoints (must be last)
    try {
      const catchAllRoutes = require("../routes/catch-all");
      this.app.use("*", catchAllRoutes.default || catchAllRoutes);
      logger.info("Loaded catch-all route");
    } catch (error) {
      logger.error("Failed to load catch-all route", {
        error: (error as Error).message,
      });
    }
  }

  /**
   * Setup error handling middleware
   */
  private setupErrorHandling(): void {
    // Global error handler using standardized error handling
    this.app.use(
      (err: any, req: Request, res: Response, _next: NextFunction) => {
        const context = {
          operation: `${req.method} ${req.path}`,
          userId: req.headers["x-user-id"] as string,
          correlationId: req.headers["x-correlation-id"] as string,
        };

        handleErrorResponse(err, res, context);
      }
    );

    // Handle unhandled promise rejections
    process.on("unhandledRejection", (reason, promise) => {
      logger.error("Unhandled Rejection at:", { promise, reason });
    });

    // Handle uncaught exceptions
    process.on("uncaughtException", (error) => {
      logger.error("Uncaught Exception:", {
        error: error.message,
        stack: error.stack,
      });
      process.exit(1);
    });
  }

  /**
   * Start the Express server
   */
  async start(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        this.server = this.app.listen(serverConfig.port.express, () => {
          logger.info(
            `Express server with WebSocket started on port ${serverConfig.port.express}`
          );
          resolve();
        });

        this.server.on("error", (error: any) => {
          logger.error("Express server error", { error: error.message });
          reject(error);
        });
      } catch (error) {
        logger.error("Failed to start Express server", {
          error: (error as Error).message,
        });
        reject(error);
      }
    });
  }

  /**
   * Stop the Express server
   */
  async stop(): Promise<void> {
    // First, shut down document service
    try {
      logger.info("Shutting down document service...");
      await documentService.shutdown();
      logger.info("Document service shut down successfully");
    } catch (error) {
      logger.error("Error shutting down document service", {
        error: (error as Error).message,
      });
    }

    return new Promise((resolve, reject) => {
      // Then, gracefully shut down Hocuspocus
      if (this.hocuspocus) {
        try {
          logger.info("Shutting down Hocuspocus instance...");
          // Hocuspocus will be cleaned up when the WebSocket server closes
          // No explicit destroy method available in current version
          logger.info(
            "Hocuspocus instance will be cleaned up with WebSocket server"
          );
        } catch (error) {
          logger.error("Error shutting down Hocuspocus", {
            error: (error as Error).message,
          });
        }
      }

      // Finally close the Express server
      if (this.server) {
        this.server.close((error?: Error) => {
          if (error) {
            logger.error("Error stopping Express server", {
              error: error.message,
            });
            reject(error);
          } else {
            logger.info("Express server stopped");
            resolve();
          }
        });
      } else {
        resolve();
      }
    });
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
   * Get Express app instance (for testing or advanced usage)
   */
  getInstance(): any {
    return this.app;
  }
}

export default ExpressServer;
