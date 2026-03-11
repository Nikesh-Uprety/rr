import { Request, Response, NextFunction } from "express";
import { ZodSchema } from "zod";
import { sendError } from "../errorHandler";
import { logger } from "../logger";

/**
 * Middleware factory for Zod schema validation
 * Returns a middleware that validates request body against schema
 */
export function validateRequest(schema: ZodSchema) {
  return (req: Request, res: Response, next: NextFunction) => {
    const parsed = schema.safeParse(req.body);
    
    if (!parsed.success) {
      const errors = parsed.error.errors.map(e => ({
        field: e.path.join('.'),
        message: e.message,
        code: e.code,
      }));
      
      logger.warn(`Validation failed for ${req.method} ${req.path}`, 
        undefined,
        undefined,
        { errors, body: req.body });
      
      return sendError(
        res,
        "Invalid request",
        { validation_errors: errors },
        400,
        "VALIDATION_ERROR"
      );
    }
    
    // Attach validated data to request for use in route handler
    (req as any).validatedBody = parsed.data;
    next();
  };
}
