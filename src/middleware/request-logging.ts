import { Request, Response, NextFunction } from 'express';
import { logger } from '../config/logger';

/**
 * Request logging middleware
 * Logs all incoming HTTP requests with metadata
 */
export function requestLoggingMiddleware(req: Request, _res: Response, next: NextFunction): void {
  logger.debug("HTTP Request", {
    method: req.method,
    url: req.url,
    ip: req.ip,
    userAgent: req.get("User-Agent"),
  });
  next();
}