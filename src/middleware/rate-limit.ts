import { Request } from "express";
import rateLimit from "express-rate-limit";
import {
  extractJWTFromRequest,
  getUserIdFromJWT,
  createRateLimitKey,
} from "../utils";

/**
 * Create JWT-based rate limiting middleware
 */
export function createRateLimitMiddleware() {
  return rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: async (req: Request) => {
      // Higher limits for authenticated users
      const token = extractJWTFromRequest(req);
      if (token) {
        const userId = await getUserIdFromJWT(token);
        if (userId) {
          // 100 requests per 15 minutes for authenticated users
          return 100;
        }
      }
      // 30 requests per 15 minutes for unauthenticated users
      return 30;
    },
    keyGenerator: async (req: Request) => {
      const token = extractJWTFromRequest(req);
      if (token) {
        const userId = await getUserIdFromJWT(token);
        if (userId) {
          return createRateLimitKey(req, userId);
        }
      }
      return createRateLimitKey(req);
    },
    message: {
      error: "Too Many Requests",
      message: "Rate limit exceeded. Try again later.",
      statusCode: 429,
    },
    standardHeaders: true,
    legacyHeaders: false,
    // Skip WebSocket upgrade requests and health endpoints
    skip: (req: Request) => {
      // Skip WebSocket upgrade requests
      if (req.headers.upgrade === "websocket") {
        return true;
      }

      // Skip health endpoints
      if (req.path === "/health" || req.path.startsWith("/health/")) {
        return true;
      }

      return false;
    },
  });
}

/**
 * Pre-configured rate limiting middleware
 */
export const rateLimitMiddleware = createRateLimitMiddleware();
