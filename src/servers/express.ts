import express, { Express, Request, Response, NextFunction } from "express";
import cors from "cors";
import helmet from "helmet";
import { serverConfig } from "../config";
import { logger } from "../config/logger";
import { APIErrorResponse } from "../types";

// Routes Imports
import indexRouter from "../routes/index";
import healthRouter from "../routes/health";
import catchAllRouter from "../routes/catch-all";
import roomsRouter from "../routes/rooms";

export class ExpressServer {
  private app: Express;
  private server?: any;

  constructor() {
    this.app = express();
    this.setupMiddleware();
    this.setupRoutes();
    this.setupErrorHandling();
  }

  /**
   * Setup Express middleware
   */
  private setupMiddleware(): void {
    // Security middleware
    this.app.use(helmet());

    // CORS middleware
    this.app.use(
      cors({
        origin: serverConfig.cors.origin,
        //TODO: research on cors credentials
        credentials: serverConfig.cors.credentials,
      })
    );

    // Body parsing middleware
    this.app.use(express.json({ limit: "10mb" }));
    this.app.use(express.urlencoded({ extended: true, limit: "10mb" }));

    // Request logging middleware
    this.app.use((req: Request, _res: Response, next: NextFunction) => {
      logger.debug("HTTP Request", {
        method: req.method,
        url: req.url,
        ip: req.ip,
        userAgent: req.get("User-Agent"),
      });
      next();
    });
  }

  /**
   * Setup Express routes
   */
  private setupRoutes(): void {
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

      // Load room routes
      this.app.use("/v1/room", roomsRouter);

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
    // Global error handler
    this.app.use(
      (err: any, req: Request, res: Response, _next: NextFunction) => {
        logger.error("Express server error", {
          error: err.message,
          stack: err.stack,
          method: req.method,
          url: req.url,
        });

        const statusCode = err.statusCode || err.status || 500;
        const error: APIErrorResponse = {
          error: err.name || "Internal Server Error",
          message: err.message || "An unexpected error occurred",
          statusCode,
          timestamp: new Date().toISOString(),
        };

        res.status(statusCode).json(error);
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
            `Express server started on port ${serverConfig.port.express}`
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
    return new Promise((resolve, reject) => {
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
   * Get Express app instance (for testing or advanced usage)
   */
  getInstance(): Express {
    return this.app;
  }
}

export default ExpressServer;
