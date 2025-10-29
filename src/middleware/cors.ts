import cors from "cors";
import { serverConfig } from "../config";
import safeRegex from "safe-regex";

/**
 * Converts a wildcard pattern to a RegExp
 * Supports patterns like: https://*.vettam.app, http://*.example.com
 */
function wildcardToRegex(pattern: string): RegExp {
  const escapedPattern = pattern
    .replace(/[.+?^${}()|[\]\\]/g, "\\$&")
    .replace(/\*/g, ".*");

  const regexStr = `^${escapedPattern}$`;
  if (!safeRegex(regexStr)) {
    throw new Error(`Unsafe CORS wildcard pattern: ${pattern}`);
  }

  return new RegExp(regexStr);
}

/**
 * Checks if an origin matches the allowed origins (including wildcard patterns)
 */
function isOriginAllowed(
  origin: string | undefined,
  allowedOrigins: string | string[] | boolean
): boolean {
  if (!origin) return false;

  // If allowedOrigins is true, allow all origins
  if (allowedOrigins === true) return true;

  // If allowedOrigins is false, disallow all origins
  if (allowedOrigins === false) return false;

  // If allowedOrigins is a string, convert to array
  const originsArray = Array.isArray(allowedOrigins)
    ? allowedOrigins
    : [allowedOrigins];

  // Check for wildcard "*" - allow all origins
  if (originsArray.includes("*")) return true;

  // Check each allowed origin
  for (const allowedOrigin of originsArray) {
    // Exact match
    if (allowedOrigin === origin) return true;

    // Wildcard pattern match
    if (allowedOrigin.includes("*")) {
      const regex = wildcardToRegex(allowedOrigin);
      if (regex.test(origin)) return true;
    }
  }

  return false;
}

/**
 * CORS middleware with environment-based configuration
 * Configures Cross-Origin Resource Sharing based on server configuration
 * Supports wildcard patterns like https://*.vettam.app
 */
export const corsMiddleware = () => {
  const corsOrigin = serverConfig.cors.origin;

  const corsOptions = {
    origin: (
      origin: string | undefined,
      callback: (
        err: Error | null,
        origin?: boolean | string | RegExp | (string | RegExp)[]
      ) => void
    ) => {
      // Allow requests with no origin (like mobile apps or curl)
      if (!origin) {
        return callback(null, true);
      }

      if (isOriginAllowed(origin, corsOrigin)) {
        callback(null, true);
      } else {
        callback(new Error(`Origin ${origin} not allowed by CORS`));
      }
    },
    credentials: serverConfig.cors.credentials,
  };

  return cors(corsOptions);
};
