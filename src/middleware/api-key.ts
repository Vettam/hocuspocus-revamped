import { Request, Response, NextFunction } from "express";
import { createHash } from "node:crypto";
import { isDevelopment, serverConfig } from "../config";
import { logger } from "../config/logger";
import { ErrorFactory } from "../utils";

/**
 * Generate API key using the same logic as VettamAPIService
 */
function generateApiKey(): string {
  const year = new Date().getFullYear();
  const month = new Date().getMonth() + 1;
  const day = new Date().getDate();
  const date = `${year}-${month.toString().padStart(2, "0")}-${day
    .toString()
    .padStart(2, "0")}`;

  return createHash("sha256")
    .update(`${date}${serverConfig.vettam.apiKey}`, "utf8")
    .digest("hex");
}

/**
 * Check if a route path matches any of the open locations (supports regex)
 */
function isOpenLocation(
  path: string,
  openLocations: (string | RegExp)[]
): boolean {
  return openLocations.some((location) => {
    if (location instanceof RegExp) {
      return location.test(path);
    }
    if (typeof location === "string") {
      // Convert glob-like patterns to regex
      if (location.includes("*")) {
        const regexPattern = location
          .replace(/\*/g, ".*")
          .replace(/\?/g, ".")
          .replace(/\//g, "\\/");
        const regex = new RegExp(`^${regexPattern}$`);
        return regex.test(path);
      }
      // Exact match
      return path === location;
    }
    return false;
  });
}

/**
 * API Key authentication middleware
 *
 * @param openLocations - Array of routes that don't require API key (supports regex and glob patterns)
 */
function createApiKeyMiddleware(openLocations: (string | RegExp)[] = []) {
  return (req: Request, _res: Response, next: NextFunction) => {
    // Bypass API key check in development mode
    if (isDevelopment) {
      return next();
    }

    const requestPath = req.path;

    // Check if this path is in open locations
    if (isOpenLocation(requestPath, openLocations)) {
      logger.debug("Request to open location, skipping API key check", {
        path: requestPath,
      });
      return next();
    }

    // Get API key from header
    const providedApiKey = req.headers["x-api-key"] as string;

    if (!providedApiKey) {
      logger.warn("API key missing in request", {
        path: requestPath,
        ip: req.ip,
        userAgent: req.get("User-Agent"),
      });

      const error = ErrorFactory.authentication("API key required");
      return next(error);
    }

    // Generate expected API key
    const expectedApiKey = generateApiKey();

    if (providedApiKey !== expectedApiKey) {
      logger.warn("Invalid API key provided", {
        path: requestPath,
        ip: req.ip,
        providedKeyLength: providedApiKey.length,
        userAgent: req.get("User-Agent"),
      });

      const error = ErrorFactory.authentication("Invalid API key");
      return next(error);
    }

    // API key is valid
    logger.debug("API key validation successful", {
      path: requestPath,
    });

    next();
  };
}

/**
 * Default open locations for common public endpoints
 */
export const DEFAULT_OPEN_LOCATIONS = [
  "/health",
  "/",
  // WebSocket endpoints
  /^\/collaboration.*/,
];

/**
 * Pre-configured middleware with default open locations
 */
export const apiKeyMiddleware = createApiKeyMiddleware(DEFAULT_OPEN_LOCATIONS);
