import { validateConfig, serverConfig } from "./config";
import { logger } from "./config/logger";
import HocuspocusServer from "./servers/hocuspocus";
import ExpressServer from "./servers/express";
import { vettamAPI } from "./services/vettam-api";

class VettamBackendServer {
  private hocuspocusServer: HocuspocusServer;
  private expressServer: ExpressServer;
  private isShuttingDown = false;

  constructor() {
    this.hocuspocusServer = new HocuspocusServer();
    this.expressServer = new ExpressServer();

    this.setupGracefulShutdown();
  }

  /**
   * Start both servers
   */
  async start(): Promise<void> {
    try {
      logger.info("Starting Vettam Backend Server...");

      // Validate configuration
      validateConfig();
      logger.info("Configuration validated successfully");

      // Health check Vettam API
      const apiHealthy = await vettamAPI.healthCheck();
      if (apiHealthy) {
        logger.info("Vettam API is healthy");
      } else {
        logger.warn("Vettam API health check failed, continuing startup...");
      }

      // Start Express server first
      await this.expressServer.start();
      logger.info(
        `✓ Express REST API server started on port ${serverConfig.port.express}`
      );

      // Start Hocuspocus server
      await this.hocuspocusServer.start();
      logger.info(
        `✓ Hocuspocus WebSocket server started on port ${serverConfig.port.hocuspocus}`
      );

      logger.info("🚀 Vettam Backend Server started successfully!");
      logger.info("Server endpoints:", {
        "REST API": `http://${serverConfig.host.express}:${serverConfig.port.express}`,
        WebSocket: `ws://${serverConfig.host.hocuspocus}:${serverConfig.port.hocuspocus}`,
        "Health Check": `http://${serverConfig.host.express}:${serverConfig.port.express}/health`,
      });
    } catch (error) {
      logger.error("Failed to start server", {
        error: (error as Error).message,
      });
      process.exit(1);
    }
  }

  /**
   * Stop both servers gracefully
   */
  async stop(): Promise<void> {
    if (this.isShuttingDown) {
      logger.info("Shutdown already in progress...");
      return;
    }

    this.isShuttingDown = true;
    logger.info("Shutting down Vettam Backend Server...");

    try {
      // Stop servers in reverse order
      await this.hocuspocusServer.stop();
      logger.info("✓ Hocuspocus server stopped");

      await this.expressServer.stop();
      logger.info("✓ Express server stopped");

      logger.info("✓ Vettam Backend Server shut down successfully");
    } catch (error) {
      logger.error("Error during shutdown", {
        error: (error as Error).message,
      });
      process.exit(1);
    }
  }

  /**
   * Setup graceful shutdown handlers
   */
  private setupGracefulShutdown(): void {
    // Handle SIGTERM (e.g., from Docker, Kubernetes, or process managers)
    process.on("SIGTERM", async () => {
      logger.info("Received SIGTERM signal, starting graceful shutdown...");
      await this.stop();
      process.exit(0);
    });

    // Handle SIGINT (e.g., Ctrl+C)
    process.on("SIGINT", async () => {
      logger.info("Received SIGINT signal, starting graceful shutdown...");
      await this.stop();
      process.exit(0);
    });

    // Handle SIGUSR2 (used by nodemon for restart)
    process.on("SIGUSR2", async () => {
      logger.info("Received SIGUSR2 signal, starting graceful shutdown...");
      await this.stop();
      process.kill(process.pid, "SIGUSR2");
    });

    // Handle unhandled promise rejections
    process.on("unhandledRejection", (reason, promise) => {
      logger.error("Unhandled Promise Rejection", { reason, promise });
      // Don't exit the process, just log the error
    });

    // Handle uncaught exceptions
    process.on("uncaughtException", (error) => {
      logger.error("Uncaught Exception", {
        error: error.message,
        stack: error.stack,
      });
      // For uncaught exceptions, we should exit
      process.exit(1);
    });

    // Handle process warnings
    process.on("warning", (warning) => {
      logger.warn("Process Warning", {
        name: warning.name,
        message: warning.message,
        stack: warning.stack,
      });
    });
  }
}

// Create and start the server if this file is run directly
if (require.main === module) {
  const server = new VettamBackendServer();

  server.start().catch((error) => {
    logger.error("Failed to start server", { error: error.message });
    process.exit(1);
  });
}

export default VettamBackendServer;
