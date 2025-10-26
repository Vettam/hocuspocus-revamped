import { Request } from 'express';
import { jwtVerify } from 'jose';
import { serverConfig } from '../config';

/**
 * Extract JWT token from request headers or query parameters
 */
export function extractJWTFromRequest(req: Request): string | null {
  // Try Authorization header first
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.substring(7);
  }

  // Try query parameter as fallback
  if (req.query.token && typeof req.query.token === 'string') {
    return req.query.token;
  }

  return null;
}

/**
 * Extract user ID from JWT token without full validation
 * Used for rate limiting purposes only
 */
export async function getUserIdFromJWT(token: string): Promise<string | null> {
  try {
    const secret = new TextEncoder().encode(serverConfig.jwt.secret);
    const { payload } = await jwtVerify(token, secret);
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