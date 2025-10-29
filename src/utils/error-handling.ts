import { Response } from 'express';
import { APIErrorResponse } from '../types';
import { logger } from '../config/logger';

/**
 * Standard error types for consistent handling
 */
export enum ErrorType {
  AUTHENTICATION_ERROR = 'AuthenticationError',
  AUTHORIZATION_ERROR = 'AuthorizationError', 
  VALIDATION_ERROR = 'ValidationError',
  NOT_FOUND_ERROR = 'NotFoundError',
  INTERNAL_SERVER_ERROR = 'InternalServerError',
}

/**
 * Standard error class with consistent structure
 */
export class StandardError extends Error {
  public readonly errorType: ErrorType;
  public readonly statusCode: number;
  public readonly isOperational: boolean;

  constructor(
    message: string,
    errorType: ErrorType,
    statusCode: number,
    isOperational: boolean = true
  ) {
    super(message);
    this.name = errorType;
    this.errorType = errorType;
    this.statusCode = statusCode;
    this.isOperational = isOperational;

    // Capture stack trace
    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * Predefined error creators for common scenarios
 */
export class ErrorFactory {
  static authentication(message: string = 'Authentication required'): StandardError {
    return new StandardError(message, ErrorType.AUTHENTICATION_ERROR, 401);
  }

  static authorization(message: string = 'Insufficient permissions'): StandardError {
    return new StandardError(message, ErrorType.AUTHORIZATION_ERROR, 403);
  }

  static validation(message: string): StandardError {
    return new StandardError(message, ErrorType.VALIDATION_ERROR, 400);
  }

  static notFound(resource: string = 'Resource'): StandardError {
    return new StandardError(`${resource} not found`, ErrorType.NOT_FOUND_ERROR, 404);
  }

  static internal(message: string = 'Internal server error'): StandardError {
    return new StandardError(message, ErrorType.INTERNAL_SERVER_ERROR, 500, false);
  }
}

/**
 * Sanitize error message to prevent information leakage
 */
export function sanitizeErrorMessage(error: any, includeStack: boolean = false): string {
  if (error instanceof StandardError) {
    return error.message;
  }

  // For non-operational errors, return generic message in production
  if (process.env.DEBUG === 'false') {
    return 'An internal error occurred';
  }

  // In development, show the actual error
  return includeStack && error.stack ? error.stack : error.message || 'Unknown error';
}

/**
 * Standard error response handler
 */
export function handleErrorResponse(
  error: any,
  res: Response,
  context?: { 
    operation?: string; 
    userId?: string; 
    roomId?: string; 
    correlationId?: string;
  }
): void {
  let statusCode: number;
  let errorType: string;
  let message: string;

  if (error instanceof StandardError) {
    statusCode = error.statusCode;
    errorType = error.errorType;
    message = error.message;
    
    // Log based on severity
    if (error.isOperational) {
      logger.warn('Operational error', {
        errorType: error.errorType,
        message: error.message,
        statusCode: error.statusCode,
        context,
      });
    } else {
      logger.error('System error', {
        errorType: error.errorType,
        message: error.message,
        statusCode: error.statusCode,
        stack: error.stack,
        context,
      });
    }
  } else {
    // Handle unexpected errors
    statusCode = 500;
    errorType = ErrorType.INTERNAL_SERVER_ERROR;
    message = sanitizeErrorMessage(error);
    
    logger.error('Unexpected error', {
      error: error.message,
      stack: error.stack,
      context,
    });
  }

  const errorResponse: APIErrorResponse = {
    error: errorType,
    message: message,
    statusCode: statusCode,
    timestamp: new Date().toISOString(),
  };

  res.status(statusCode).json(errorResponse);
}

/**
 * Async error wrapper for route handlers
 */
export function asyncHandler(
  fn: (req: any, res: Response, next: any) => Promise<any>
) {
  return (req: any, res: Response, next: any) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}