import { Request, Response, NextFunction } from "express";
import { ZodError, ZodTypeAny } from "zod";
import { fromZodError } from "zod-validation-error";

/**
 * Middleware to validate request body, query, or params using Zod
 * @param schema The Zod schema to validate against
 * @param target 'body' | 'query' | 'params'
 */
export const validateRequest = (schema: ZodTypeAny, target: "body" | "query" | "params" = "body") => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const validatedData = await schema.parseAsync(req[target]);
      req[target] = validatedData;
      next();
    } catch (err) {
      if (err instanceof ZodError) {
        const validationError = fromZodError(err);
        return res.status(400).json({
          message: "Validation failed",
          errors: validationError.details,
        });
      }
      next(err);
    }
  };
};
