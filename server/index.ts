import dns from "node:dns";
dns.setDefaultResultOrder("ipv4first");
import connectPgSimple from "connect-pg-simple";
import "dotenv/config";
import express, { NextFunction, type Request, Response } from "express";
import session from "express-session";
import { createServer } from "http";
import { configurePassport, passport } from "./auth";
import { pool } from "./db";
import { logger } from "./logger";
import { corsHeaders, securityHeaders } from "./middleware/security";
import { registerRoutes } from "./routes";
import { serveStatic } from "./static";
import { initWebSocketServer } from "./websocket";
import os from "node:os";


const app = express();

// UPLOADS PERSISTENCE NOTE:
// Uploaded images are written to `UPLOADS_DIR`. On Railway, mount a persistent volume
// to the container path you set in `UPLOADS_DIR` (recommended: `/uploads`).
// Without a persistent mount, files may disappear on container redeploy/restart.
import fs from "fs";
import path from "path";

const UPLOADS_DIR =
  process.env.UPLOADS_DIR || path.join(process.cwd(), "uploads");

const UPLOAD_SUBDIRS = [
  "products",
  path.join("site-assets", "hero"),
  path.join("site-assets", "featured_collection"),
  path.join("site-assets", "new_collection"),
  path.join("site-assets", "collection_page"),
];

UPLOAD_SUBDIRS.forEach((sub) => {
  fs.mkdirSync(path.join(UPLOADS_DIR, sub), { recursive: true });
});

// Quick visibility if a persistent mount is misconfigured.
try {
  fs.accessSync(UPLOADS_DIR, fs.constants.W_OK);
  console.log(`[UPLOADS] Writable: ${UPLOADS_DIR}`);
} catch (err) {
  console.warn(`[UPLOADS] WARNING: uploads dir not writable: ${UPLOADS_DIR}`, err);
}

// Behind Render's proxy, trust X-Forwarded-* so secure cookies work
app.set("trust proxy", 1);
const httpServer = createServer(app);

declare module "http" {
  interface IncomingMessage {
    rawBody: unknown;
  }
}

// Apply security headers to all responses
app.use(securityHeaders);

// Apply CORS headers
app.use(corsHeaders);

// 20 MB in bytes – profile picture uploads (base64 ~33% larger than binary)
const JSON_BODY_LIMIT = 20 * 1024 * 1024;

app.use(
  express.json({
    limit: JSON_BODY_LIMIT,
    verify: (req, _res, buf) => {
      req.rawBody = buf;
    },
  }),
);

app.use(express.urlencoded({ extended: false, limit: '1mb' }));

const PgSession = connectPgSimple(session);

if (!process.env.SESSION_SECRET) {
  throw new Error("SESSION_SECRET must be set");
}

const sessionMiddleware = session({
  store: new PgSession({
    pool,
    createTableIfMissing: true,
  }),
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === "production",
    httpOnly: true,
    maxAge: 1000 * 60 * 60 * 24 * 7,
  },
});

app.use(sessionMiddleware);
configurePassport();
app.use(passport.initialize());
app.use(passport.session());

export function log(message: string, source = "express") {
  const formattedTime = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });

  console.log(`${formattedTime} [${source}] ${message}`);
}

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  const method = req.method;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      // Extract user info if authenticated
      const user = (req as any).user;
      const userId = user?.id || "anonymous";
      
      const logData = {
        timestamp: new Date().toISOString(),
        method,
        path,
        status: res.statusCode,
        duration: `${duration}ms`,
        userId,
        success: res.statusCode >= 200 && res.statusCode < 400,
      };

      if (res.statusCode >= 400) {
        logger.error(`${method} ${path} ${res.statusCode}`, logData, 
          capturedJsonResponse?.error || "Unknown error");
      } else {
        logger.info(`${method} ${path} ${res.statusCode}`, logData);
      }

      log(`${method} ${path} ${res.statusCode} in ${duration}ms [${userId}]`);
    }
  });

  next();
});

(async () => {
  // Serve uploaded files - MUST be before registerRoutes and vite
  const path = await import("path");
  const uploadsPath = path.resolve(UPLOADS_DIR);
  app.use("/uploads", express.static(uploadsPath));

  await registerRoutes(httpServer, app);

  // Initialize WebSocket server for real-time admin notifications
  initWebSocketServer(httpServer);


  app.use((err: any, _req: Request, res: Response, next: NextFunction) => {
    if (res.headersSent) {
      return next(err);
    }

    // PayloadTooLargeError from body-parser when request body exceeds limit
    if (err.type === "entity.too.large" || err.status === 413 || err.statusCode === 413) {
      return res.status(413).json({
        message: "File too large. Maximum file size is 20 MB. Please use a smaller image.",
      });
    }

    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";
    console.error("Internal Server Error:", err);
    return res.status(status).json({ message });
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (process.env.NODE_ENV === "production") {
    serveStatic(app);
  } else {
    const { setupVite } = await import("./vite");
    await setupVite(httpServer, app);
  }

  // ALWAYS serve the app on the port specified in the environment variable PORT
  // Other ports are firewalled. Default to 5000 if not specified.
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const preferredPort = parseInt(process.env.PORT || "5000", 10);
  const host = "0.0.0.0";

  const listenWithFallback = (startPort: number) => {
    let port = startPort;
    const maxAttempts = process.env.NODE_ENV === "production" ? 1 : 20;

    const tryListen = () => {
      httpServer.once("error", (err: any) => {
        if (err?.code === "EADDRINUSE" && maxAttempts > 1) {
          port += 1;
          const attemptsUsed = port - startPort + 1;
          if (attemptsUsed <= maxAttempts) {
            log(`port ${port - 1} in use, trying ${port}...`);
            return tryListen();
          }
        }
        throw err;
      });

      httpServer.listen({ port, host }, () => {
        log(`serving on port ${port}`);
        if (port !== preferredPort) {
          log(`note: preferred port ${preferredPort} was busy`, "express");
        }

        if (process.env.NODE_ENV !== "production") {
          const nets = os.networkInterfaces();
          const ips = Object.values(nets)
            .flat()
            .filter((n): n is os.NetworkInterfaceInfo => !!n)
            .filter((n) => n.family === "IPv4" && !n.internal)
            .map((n) => n.address);
          const primaryIp = ips[0];
          if (primaryIp) {
            log(`open from Windows: http://${primaryIp}:${port}`, "express");
          }
        }
      });
    };

    tryListen();
  };

  listenWithFallback(preferredPort);
})();
