import express, { Request, Response, NextFunction } from "express";
import expressWebsockets from "express-ws";
import helmet from "helmet";
import { Hocuspocus } from "@hocuspocus/server";
import { jwtVerify, createRemoteJWKSet } from "jose";
import { serverConfig } from "../config";
import { logger } from "../config/logger";
import { vettamAPI } from "../services/vettam-api";
import { documentService } from "../services/document";
import { hocuspocusInstance } from "../services/hocuspocus-instance";
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
import { Server } from "http";


// Create JWKS function that fetches public keys from the JWKS endpoint
const JWKS = createRemoteJWKSet(new URL(serverConfig.jwt.jwksUrl));

export class ExpressServer {
  private app: expressWebsockets.Application; // Express app with WebSocket support
  private server?: Server;
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

      // Document loading hook - Load document state from API
      // Applies the loaded state to Hocuspocus's internal Y.Doc
      onLoadDocument: async (data) => {
        const roomId = data.context?.room_id || data.documentName;
        logger.info("onLoadDocument called for room", { roomId });

        // Check if document is already registered in documentService (reconnection scenario)
        // If already registered, skip loading to prevent duplication
        if (documentService.isDocumentRegistered(roomId)) {
          logger.info(
            "Document already registered in service, returning existing instance",
            {
              roomId,
            }
          );
          return documentService.getDocument(roomId);
        }

        // Use documentService to load initial state with locking
        await documentService.loadInitialStateFromAPI(roomId, data.document);
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

      // After document is loaded/created - register with document service
      afterLoadDocument: async (data) => {
        const roomId = data.context?.room_id || data.documentName;

        logger.info("afterLoadDocument called", {
          roomId,
        });

        // Register Hocuspocus's YDoc instance with our service
        // At this point, the document already has data loaded from onLoadDocument
        // On reconnection, registerHocuspocusDocument will skip re-registration
        documentService.registerHocuspocusDocument(roomId, data.document);

        logger.debug("afterLoadDocument complete", { roomId });
      },

      // Connection closed hook
      onDisconnect: async (data) => {
        const roomId = data.context.room_id ?? data.documentName;

        logger.info("Client disconnected from document", { roomId });

        // If clients are still connected, skip saving snapshot
        if (data.clientsCount !== 0) {
          logger.info("Other clients still connected, skipping unregister", {
            roomId,
            clientsCount: data.clientsCount,
          });
          return;
        }

        // Persist and cleanup document using documentService
        await documentService.persistAndCleanupDocument(
          roomId,
          data.document,
          data.instance
        );
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

    // Register Hocuspocus instance in singleton service for routes to access
    hocuspocusInstance.setInstance(this.hocuspocus);
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
    logger.debug("Setting up websocket route for Hocuspocus");
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
        const host = serverConfig.host.bindHost;
        const port = serverConfig.port.express;

        this.server = this.app.listen(port, host, () => {
          logger.info(
            `Express server with WebSocket started on ${host}:${port}`
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
    logger.info("Initiating Express server shutdown process");

    try {
      // First, stop accepting new connections
      if (this.server) {
        logger.info("Closing Express server and stopping new connections");
        this.server.close();
      }

      // Then cleanup document service
      logger.info("Starting document service cleanup during server shutdown");
      await documentService.shutdown(this.hocuspocus);
      logger.info("Document service cleanup completed successfully");

      logger.info("Express server shutdown process completed successfully");
    } catch (error) {
      logger.error("Critical error during Express server shutdown", {
        error: (error as Error).message,
        stack: (error as Error).stack,
      });
    }

    logger.info("Terminating Node.js process");
    process.exit(1);
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
      const { payload } = await jwtVerify(token, JWKS, {
        audience: serverConfig.jwt.audience,
        issuer: serverConfig.jwt.issuer,
      });

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

  /**
   * Get Hocuspocus instance (for REST API routes to open direct connections)
   */
  getHocuspocus(): Hocuspocus {
    return this.hocuspocus;
  }
}

export default ExpressServer;
