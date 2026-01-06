import { Request } from "express";
import { jwtVerify, createRemoteJWKSet } from "jose";
import { serverConfig } from "../config";

// Create JWKS function that fetches public keys from the JWKS endpoint
const JWKS = createRemoteJWKSet(new URL(serverConfig.jwt.jwksUrl));

/**
 * Extract JWT token from request headers or query parameters
 */
export function extractJWTFromRequest(req: Request): string | null {
  // Try Authorization header first
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith("Bearer ")) {
    return authHeader.substring(7);
  }

  return null;
}

/**
 * Extract user ID from JWT token with full signature validation
 * Returns null for invalid/expired tokens
 * Used primarily for rate limiting
 */
export async function getUserIdFromJWT(token: string): Promise<string | null> {
  try {
    const { payload } = await jwtVerify(token, JWKS, {
      audience: serverConfig.jwt.audience,
      issuer: serverConfig.jwt.issuer,
    });
    return payload.sub || null;
  } catch (error) {
    // Return null for invalid tokens, let other middleware handle auth
    return null;
  }
}

/**
 * Create a rate limit key based on user ID or IP
 */
export function createRateLimitKey(req: Request, userId?: string): string {
  if (userId) {
    return `user:${userId}`;
  }
  // Fallback to IP-based rate limiting
  return `ip:${req.ip}`;
}
