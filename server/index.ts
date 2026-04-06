import "dotenv/config";
import * as Sentry from "@sentry/node";
import { nodeProfilingIntegration } from "@sentry/profiling-node";

if (process.env.SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.NODE_ENV || "development",
    integrations: [
      // Enable HTTP tracing for metrics
      nodeProfilingIntegration(),
    ],
    // Enable metrics
    _experiments: {
      // Enable metrics (experimental flag)
      metricsAggregator: true,
    },
  });
}

import dns from "node:dns";
dns.setDefaultResultOrder("ipv4first");
import { RedisStore } from "connect-redis";
import { sessionRedis } from "./redis";

import express, { NextFunction, type Request, Response } from "express";
import session from "express-session";
import { createServer } from "http";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { products, users, pages, pageSections, pageTemplates, siteSettings } from "@shared/schema";
import { configurePassport, passport } from "./auth";
import { db, pool } from "./db";
import { logger } from "./logger";
import { corsHeaders, securityHeaders } from "./middleware/security";
import { ensureDefaultProductAttributes } from "./productAttributeDefaults";
import { registerRoutes } from "./routes";
import { registerSentryTestRoutes } from "./sentry-test";
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
import { resolveUploadsDir } from "./uploads";

const UPLOADS_DIR = resolveUploadsDir();

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

// const PgSession = connectPgSimple(session);
const SESSION_MAX_AGE_MS = 1000 * 60 * 60 * 24 * 7;
const SESSION_TTL_SECONDS = Math.ceil(SESSION_MAX_AGE_MS / 1000);

const store = new RedisStore({
  client: sessionRedis,
  prefix: "rarenp:sess:",
  ttl: SESSION_TTL_SECONDS,
});

if (!process.env.SESSION_SECRET) {
  throw new Error("SESSION_SECRET must be set");
}

const sessionMiddleware = session({
  store,
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === "production",
    httpOnly: true,
    maxAge: SESSION_MAX_AGE_MS,
  },
});

const isAppDocumentRequest = (req: Request) =>
  !req.path.startsWith("/api") && (req.method === "GET" || req.method === "HEAD");

const isAuthStatusRequest = (req: Request) =>
  req.method === "GET" && req.path === "/api/auth/me";

app.use((req, res, next) => {
  sessionMiddleware(req, res, (err) => {
    if (!err) return next();

    logger.error(
      "Session store unavailable",
      {
        timestamp: new Date().toISOString(),
      },
      err,
      {
        method: req.method,
        path: req.path,
      },
    );

    if (isAppDocumentRequest(req) || isAuthStatusRequest(req)) {
      return next();
    }

    return next(err);
  });
});
configurePassport();
app.use(passport.initialize());
const passportSessionMiddleware = passport.session();
app.use((req, res, next) => {
  // Only deserialize users for API requests.
  // Static assets / Vite HMR requests don't need Passport session work.
  if (!req.path.startsWith("/api")) {
    return next();
  }

  if (isAppDocumentRequest(req) && !(req as Request & { session?: unknown }).session) {
    return next();
  }

  passportSessionMiddleware(req, res, (err?: any) => {
    if (!err) return next();

    logger.error(
      "Passport session unavailable",
      {
        timestamp: new Date().toISOString(),
      },
      err,
      {
        method: req.method,
        path: req.path,
      },
    );

    if (isAppDocumentRequest(req) || isAuthStatusRequest(req)) {
      return next();
    }

    return next(err);
  });
});

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

async function ensureE2ETestState() {
  const adminPasswordHash = await bcrypt.hash("admin123", 10);
  const staffPasswordHash = await bcrypt.hash("staff123", 10);

  const existingAdmin = await db.query.users.findFirst({
    where: eq(users.username, "admin@rare.np"),
  });

  if (existingAdmin) {
    await db
      .update(users)
      .set({
        password: adminPasswordHash,
        role: "admin",
        displayName: "Admin User",
        profileImageUrl: null,
        requires2FASetup: false,
        twoFactorEnabled: 0,
        status: "active",
        emailNotifications: true,
      })
      .where(eq(users.id, existingAdmin.id));
  } else {
    await db.insert(users).values({
      username: "admin@rare.np",
      password: adminPasswordHash,
      role: "admin",
      displayName: "Admin User",
      profileImageUrl: null,
      requires2FASetup: false,
      twoFactorEnabled: 0,
      status: "active",
      emailNotifications: true,
    });
  }

  const existingStaff = await db.query.users.findFirst({
    where: eq(users.username, "staff@rare.np"),
  });

  if (!existingStaff) {
    await db.insert(users).values({
      username: "staff@rare.np",
      password: staffPasswordHash,
      role: "staff",
      displayName: "Store Staff",
      profileImageUrl: null,
      requires2FASetup: false,
      twoFactorEnabled: 0,
      status: "active",
      emailNotifications: true,
    });
  }

  const existingProduct = await db.query.products.findFirst();
  if (!existingProduct) {
    await db.insert(products).values({
      name: "E2E Essential Hoodie",
      shortDetails: "Default product for end-to-end checks",
      description: "Bootstrap product to keep e2e storefront flows deterministic.",
      price: "2500",
      category: "Arrivals",
      stock: 12,
      imageUrl: "/images/feature1.webp",
      galleryUrls: JSON.stringify(["/images/feature1.webp"]),
      colorOptions: JSON.stringify(["Black"]),
      sizeOptions: JSON.stringify(["M", "L"]),
      homeFeatured: true,
      homeFeaturedImageIndex: 0,
    });
  }
}

async function ensureRootSuperAdminState() {
  const rootEmail = "superadmin@rare.np";
  const rootPasswordHash = await bcrypt.hash("superadmin123", 10);

  const existing = await db.query.users.findFirst({
    where: eq(users.username, rootEmail),
  });

  if (existing) {
    await db
      .update(users)
      .set({
        password: rootPasswordHash,
        role: "superadmin",
        displayName: "Super Admin",
        status: "active",
        requires2FASetup: false,
        twoFactorEnabled: 0,
        emailNotifications: true,
      })
      .where(eq(users.id, existing.id));
    return;
  }

  await db.insert(users).values({
    username: rootEmail,
    password: rootPasswordHash,
    role: "superadmin",
    displayName: "Super Admin",
    profileImageUrl: null,
    requires2FASetup: false,
    twoFactorEnabled: 0,
    status: "active",
    emailNotifications: true,
  });
}

(async () => {
  try {
    await ensureRootSuperAdminState();
    log("Root superadmin state ensured", "express");
  } catch (error) {
    logger.warn(
      "Root superadmin bootstrap skipped",
      {
        timestamp: new Date().toISOString(),
        source: "APP",
      },
      error,
    );
  }

  if (process.env.E2E_TEST_MODE === "1") {
    try {
      await ensureE2ETestState();
      log("E2E bootstrap state ensured", "express");
    } catch (error) {
      logger.warn(
        "E2E bootstrap skipped",
        {
          timestamp: new Date().toISOString(),
          source: "APP",
        },
        error,
      );
    }
  }

  try {
    await ensureDefaultProductAttributes();
  } catch (error) {
    logger.warn(
      "Default product attributes bootstrap skipped",
      {
        timestamp: new Date().toISOString(),
        source: "APP",
      },
      error,
      {
        reason: "database_unavailable_during_startup",
      },
    );
  }

  // Ensure default pages exist for Canvas multi-page builder
  try {
    const { sql } = await import("drizzle-orm");
    const existingPages = await db.select().from(pages).orderBy(pages.sortOrder);
    const hasHome = existingPages.some((p) => p.isHomepage);
    const hasShop = existingPages.some((p) => p.slug === "/shop");
    const hasCollection = existingPages.some((p) => p.slug === "/new-collection");
    const hasAtelier = existingPages.some((p) => p.slug === "/atelier");

    if (!hasHome) {
      const settings = await db.select().from(siteSettings).limit(1);
      const activeTemplateId = settings[0]?.activeTemplateId;
      const [newHomePage] = await db.insert(pages).values({
        slug: "/",
        title: "Home",
        status: "published",
        isHomepage: true,
        showInNav: true,
        sortOrder: 0,
      }).returning();

      if (activeTemplateId) {
        const templateSections = await db.select().from(pageSections).where(sql`${pageSections.templateId} = ${activeTemplateId} AND ${pageSections.pageId} IS NULL`).orderBy(pageSections.orderIndex);
        if (templateSections.length > 0) {
          await db.insert(pageSections).values(
            templateSections.map((s) => ({
              pageId: newHomePage.id,
              sectionType: s.sectionType,
              label: s.label,
              orderIndex: s.orderIndex,
              isVisible: s.isVisible,
              config: s.config,
            }))
          );
        }
      }
    }

    if (!hasShop) {
      await db.insert(pages).values({
        slug: "/shop",
        title: "Shop",
        description: "Browse all products",
        status: "published",
        isHomepage: false,
        showInNav: true,
        sortOrder: 1,
      });
    }

    if (!hasCollection) {
      await db.insert(pages).values({
        slug: "/new-collection",
        title: "Collection",
        description: "New collection",
        status: "published",
        isHomepage: false,
        showInNav: true,
        sortOrder: 2,
      });
    }

    if (!hasAtelier) {
      await db.insert(pages).values({
        slug: "/atelier",
        title: "Atelier",
        description: "About Rare Atelier",
        status: "published",
        isHomepage: false,
        showInNav: true,
        sortOrder: 3,
      });
    }
  } catch (error) {
    logger.warn(
      "Default pages migration skipped",
      {
        timestamp: new Date().toISOString(),
        source: "APP",
      },
      error,
      {
        reason: "database_unavailable_during_startup",
      },
    );
  }

  // Serve uploaded files - MUST be before registerRoutes and vite
  const path = await import("path");
  const uploadsPath = path.resolve(UPLOADS_DIR);
  app.use(
    "/uploads",
    express.static(uploadsPath, {
      etag: true,
      maxAge: 1000 * 60 * 60, // 1 hour
      setHeaders: (res) => {
        // Uploads can change (same URL might be replaced), so avoid immutable caching.
        res.setHeader("Cache-Control", "public, max-age=3600");
      },
    }),
  );

  // Health check endpoint for deployment probes (Railway, Render, etc.)
  app.get("/health", async (_req, res) => {
    const health: Record<string, string> = {
      status: "ok",
      uptime: `${Math.round(process.uptime())}s`,
      timestamp: new Date().toISOString(),
    };
    let dbOk = false;
    let redisOk = false;
    try {
      await db.query.users.findFirst();
      dbOk = true;
      health.database = "connected";
    } catch {
      health.database = "unavailable";
    }
    try {
      if (sessionRedis) {
        await sessionRedis.ping();
        redisOk = true;
        health.redis = "connected";
      } else {
        health.redis = "not configured";
      }
    } catch {
      health.redis = "unavailable";
    }
    const allHealthy = dbOk && redisOk;
    res.status(allHealthy ? 200 : 503).json(health);
  });

  await registerRoutes(httpServer, app);
  registerSentryTestRoutes(app);

  // Sentry error handler must be after all controllers but before other error handlers
  if (process.env.SENTRY_DSN) {
    Sentry.setupExpressErrorHandler(app);
  }

  // Initialize WebSocket server for real-time admin notifications
  initWebSocketServer(httpServer);


  app.use((err: any, _req: Request, res: Response, next: NextFunction) => {
    if (res.headersSent) {
      return next(err);
    }

    // PayloadTooLargeError from body-parser when request body exceeds limit
    if (err.code === "LIMIT_FILE_SIZE" || err.type === "entity.too.large" || err.status === 413 || err.statusCode === 413) {
      return res.status(413).json({
        message: "File too large. Maximum file size is 30 MB. Please reduce the image size or upload a smaller file.",
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
