import { NextFunction, Request, Response } from "express";
import { logger } from "../logger";

interface RateLimitStore {
  [key: string]: { count: number; resetTime: number };
}

const rateLimitStore: RateLimitStore = {};
const RATE_LIMIT_WINDOW = 60 * 1000; // 1 minute
const RATE_LIMIT_MAX_REQUESTS = 10; // 10 requests per minute

/**
 * Simple rate limiting middleware for auth endpoints
 * Tracks requests by IP address
 */
export function rateLimit(options?: { windowMs?: number; maxRequests?: number }) {
  const windowMs = options?.windowMs || RATE_LIMIT_WINDOW;
  const maxRequests = options?.maxRequests || RATE_LIMIT_MAX_REQUESTS;

  return (req: Request, res: Response, next: NextFunction) => {
    const ip = req.ip || req.socket.remoteAddress || "unknown";
    const now = Date.now();

    if (!rateLimitStore[ip]) {
      rateLimitStore[ip] = { count: 1, resetTime: now + windowMs };
      return next();
    }

    const record = rateLimitStore[ip];

    if (now > record.resetTime) {
      record.count = 1;
      record.resetTime = now + windowMs;
      return next();
    }

    record.count++;

    if (record.count > maxRequests) {
      logger.warn(`Rate limit exceeded for IP ${ip}`, undefined, undefined, {
        ip,
        count: record.count,
        maxRequests,
        endpoint: req.path,
      });

      return res.status(429).json({
        success: false,
        error: "Too many requests",
        code: "RATE_LIMIT_EXCEEDED",
        retryAfter: Math.ceil((record.resetTime - now) / 1000),
      });
    }

    next();
  };
}

// Cleanup expired rate limit entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const ip in rateLimitStore) {
    if (rateLimitStore[ip].resetTime < now) {
      delete rateLimitStore[ip];
    }
  }
}, 5 * 60 * 1000);

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
