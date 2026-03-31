import { NextFunction, Request, Response } from "express";
import { logger } from "../logger";
import { redis } from "../redis";

interface RateLimitStore {
  [key: string]: { count: number; resetTime: number };
}

// const rateLimitStore: RateLimitStore = {};
const RATE_LIMIT_WINDOW = 60; // 1 minute in seconds
const RATE_LIMIT_MAX_REQUESTS = 15; // Increased to 15 for better UX with Redis latency

/**
 * Simple rate limiting middleware for auth endpoints
 * Tracks requests by IP address
 */
export function rateLimit(options?: { windowSec?: number; maxRequests?: number }) {
  const windowSec = options?.windowSec || RATE_LIMIT_WINDOW;
  const maxRequests = options?.maxRequests || RATE_LIMIT_MAX_REQUESTS;

  return async (req: Request, res: Response, next: NextFunction) => {
    const ip = req.ip || req.get("x-forwarded-for") || req.socket.remoteAddress || "unknown";
    const key = `rarenp:ratelimit:${req.path}:${ip}`;

    try {
      const count = await redis.incr(key);

      if (count === 1) {
        await redis.expire(key, windowSec);
      }

      if (count > maxRequests) {
        const ttl = await redis.ttl(key);
        
        logger.warn(`Rate limit exceeded for IP ${ip}`, undefined, undefined, {
          ip,
          count,
          maxRequests,
          endpoint: req.path,
        });

        return res.status(429).json({
          success: false,
          error: "Too many requests",
          code: "RATE_LIMIT_EXCEEDED",
          retryAfter: ttl,
        });
      }

      next();
    } catch (err) {
      console.error("Redis rate limit error:", err);
      // Fallback: allow request if Redis fails to avoid blocking users
      next();
    }
  };
}



/**
 * Add security headers to all responses
 */
export function securityHeaders(_req: Request, res: Response, next: NextFunction) {
  const isCanvasPreviewRequest =
    _req.path === "/" &&
    typeof _req.query.canvasPreviewTemplateId === "string" &&
    _req.query.canvasPreviewTemplateId.length > 0;

  // Strict Transport Security - enforce HTTPS
  res.set("Strict-Transport-Security", "max-age=31536000; includeSubDomains");

  // Prevent clickjacking
  res.set("X-Frame-Options", isCanvasPreviewRequest ? "SAMEORIGIN" : "DENY");

  // Prevent MIME type sniffing
  res.set("X-Content-Type-Options", "nosniff");

  // Enable XSS filter in older browsers
  res.set("X-XSS-Protection", "1; mode=block");

  // Referrer Policy
  res.set("Referrer-Policy", "strict-origin-when-cross-origin");

  // Content Security Policy
  const frameAncestors = isCanvasPreviewRequest ? "'self'" : "'none'";
  if (process.env.NODE_ENV === "production") {
    res.set(
      "Content-Security-Policy",
      `default-src 'self'; script-src 'self' 'unsafe-inline' https://www.instagram.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; img-src 'self' data: blob: https:; font-src 'self' data: https://fonts.googleapis.com https://fonts.gstatic.com; connect-src 'self' https:; frame-src 'self' https://www.google.com https://player.cloudinary.com https://www.instagram.com; frame-ancestors ${frameAncestors}; object-src 'none'; base-uri 'self';`
    );
  } else {
    res.set(
      "Content-Security-Policy",
      `default-src 'self'; script-src 'self' 'unsafe-inline' https://www.instagram.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; img-src 'self' data: blob: https:; font-src 'self' data: https://fonts.googleapis.com https://fonts.gstatic.com; connect-src 'self' https: ws: wss:; frame-src 'self' https://www.google.com https://player.cloudinary.com https://www.instagram.com; frame-ancestors ${frameAncestors}; object-src 'none'; base-uri 'self';`
    );
  }

  // Permissions Policy (formerly Feature Policy)
  res.set(
    "Permissions-Policy",
    "geolocation=(), microphone=(), camera=(), payment=()"
  );

  next();
}

/**
 * CORS configuration
 */
export function corsHeaders(req: Request, res: Response, next: NextFunction) {
  const origin = req.get("origin");
  
  if (process.env.NODE_ENV === "production") {
    const allowedOrigins = (process.env.ALLOWED_ORIGINS || "").split(",").filter(Boolean);
    if (origin && allowedOrigins.includes(origin)) {
      res.set("Access-Control-Allow-Origin", origin);
      res.set("Access-Control-Allow-Credentials", "true");
    }
  } else {
    // In development, allow any origin but don't set credentials with wildcard
    if (origin) {
      res.set("Access-Control-Allow-Origin", origin);
      res.set("Access-Control-Allow-Credentials", "true");
    } else {
      res.set("Access-Control-Allow-Origin", "*");
      // Note: Cannot use credentials with wildcard origin
    }
  }

  res.set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, PATCH, OPTIONS");
  res.set("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") {
    return res.sendStatus(200);
  }

  next();
}
