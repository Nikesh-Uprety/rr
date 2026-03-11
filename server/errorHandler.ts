/**
 * Centralized error handling and API response utilities
 * Standardizes error handling across all API routes
 */

import { Response } from "express";
import { logger } from "./logger";

export interface ApiError {
  success: false;
  error: string;
  details?: unknown;
  code?: string;
}

export interface ApiSuccess<T> {
  success: true;
  data?: T;
  message?: string;
}

export type ApiResponse<T> = ApiSuccess<T> | ApiError;

/**
 * Send a successful JSON response
 */
export function sendSuccess<T>(
  res: Response,
  data?: T,
  message?: string,
  statusCode: number = 200
): Response {
  const response: ApiSuccess<T> = {
    success: true,
    ...(data !== undefined && { data }),
    ...(message && { message }),
  };
  return res.status(statusCode).json(response);
}

/**
 * Send an error JSON response
 */
export function sendError(
  res: Response,
  error: string,
  details?: unknown,
  statusCode: number = 500,
  code?: string
): Response {
  const response: ApiError = {
    success: false,
    error,
    ...(details !== undefined && { details }),
    ...(code && { code }),
  };
  return res.status(statusCode).json(response);
}

/**
 * Centralized error handler for async route handlers
 * Wraps route handler to catch errors and log them consistently
 */
export function asyncHandler(
  fn: (req: any, res: Response, next: any) => Promise<any>
) {
  return (req: any, res: Response, next: any) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

/**
 * Parse and safely extract query parameters
 */
export function getQueryParam(
  param: string | string[] | undefined | any
): string | undefined {
  if (!param) return undefined;
  if (Array.isArray(param)) return param[0];
  if (typeof param === "string") return param;
  return undefined;
}

/**
 * Handle common error scenarios
 */
export function handleApiError(
  res: Response,
  error: unknown,
  context: string,
  statusCode: number = 500
): Response {
  const errorMessage = error instanceof Error ? error.message : String(error);

  logger.error(`Error in ${context}`, { source: context }, error);

  if (statusCode === 400) {
    return sendError(res, "Invalid request", errorMessage, statusCode, "BAD_REQUEST");
  }

  if (statusCode === 401) {
    return sendError(res, "Unauthorized", undefined, statusCode, "UNAUTHORIZED");
  }

  if (statusCode === 403) {
    return sendError(res, "Forbidden", undefined, statusCode, "FORBIDDEN");
  }

  if (statusCode === 404) {
    return sendError(res, "Not found", undefined, statusCode, "NOT_FOUND");
  }

  if (statusCode === 409) {
    return sendError(res, "Conflict", errorMessage, statusCode, "CONFLICT");
  }

  return sendError(res, "Internal server error", errorMessage, statusCode, "INTERNAL_ERROR");
}

/**
 * Validate required fields in request
 */
export function validateRequired(
  data: Record<string, any>,
  fields: string[]
): { valid: boolean; missing: string[] } {
  const missing = fields.filter((field) => !data[field]);
  return {
    valid: missing.length === 0,
    missing,
  };
}
