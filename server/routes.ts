import express from "express";

import type { Express, NextFunction, Request, Response } from "express";
import fs from "fs";
import { type Server } from "http";
import path from "path";
import sharp from "sharp";
import multer from "multer";
import { z } from "zod";
import { canAccessAdminPanel, requiresTwoFactorChallenge } from "@shared/auth-policy";
import { storage } from "./storage";
import passport from "passport";
import { processAndStoreImage, deleteLocalImage } from "./lib/imageService";
import bcrypt from "bcryptjs";
import { resolveUploadsDir } from "./uploads";
import {
  createLoginHandler,
  createStoreUserHandler,
  createVerify2FAHandler,
} from "./authHandlers";



import { and, desc, eq, gte, sql, inArray } from "drizzle-orm";

import {
    bills,
    customers,
    emailTemplates,
    insertNewsletterSubscriberSchema,
    insertProductAttributeSchema,
    mediaAssets,
    newsletterSubscribers,
    orders,
    posSessions,
    platforms,
    Product,
    products,
    promoCodes,
    siteAssets
} from "../shared/schema";
import { db } from "./db";
import {
    sendContactReplyEmail,
    sendInviteEmail,
    sendMarketingBroadcastEmail,
    sendNewsletterWelcomeEmail,
    sendOrderConfirmationEmail,
    sendOrderStatusUpdateEmail,
    sendOTPEmail,
    sendStoreUserWelcomeEmail,
} from "./email";
import { getQueryParam, handleApiError, sendError } from "./errorHandler";
import { requireAdmin, requireAdminPageAccess } from "./middleware/requireAdmin";
import { requireAuth } from "./middleware/requireAuth";
import { rateLimit } from "./middleware/security";
import { generateBillFromOrder, generateBillNumber } from "./services/billService";
import { uploadToCloudinary, deleteFromCloudinary } from "./lib/cloudinary";
import { uploadMediaToCloudinary } from "./lib/cloudinary";

const UPLOADS_DIR = resolveUploadsDir();
const PAYMENT_PROOFS_DIR = path.join(UPLOADS_DIR, "payment-proofs");
const PRODUCTS_UPLOADS_DIR = path.join(UPLOADS_DIR, "products");
const MEDIA_UPLOADS_DIR = path.join(UPLOADS_DIR, "media");

const memoryUpload = multer({
  storage: multer.memoryStorage(),
  // Max 5MB per image as required
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (
    _req: Request,
    file: Express.Multer.File,
    cb: multer.FileFilterCallback,
  ) => {
    const allowed = ["image/jpeg", "image/png", "image/webp"];
    cb(null, allowed.includes(file.mimetype));
  },
});

function listImagesInUploadsDir(options: { maxDepth?: number; maxFiles?: number } = {}) {
  const maxDepth = options.maxDepth ?? 3;
  const maxFiles = options.maxFiles ?? 200;
  const allowedExt = new Set([".webp", ".png", ".jpg", ".jpeg"]);

  const results: Array<{ filename: string; url: string; relPath: string }> = [];

  function walk(currentAbs: string, currentRel: string, depth: number) {
    if (results.length >= maxFiles) return;
    if (depth > maxDepth) return;

    if (!fs.existsSync(currentAbs)) return;

    const entries = fs.readdirSync(currentAbs, { withFileTypes: true });
    for (const entry of entries) {
      if (results.length >= maxFiles) return;
      if (entry.name.startsWith(".")) continue;

      const abs = path.join(currentAbs, entry.name);
      const rel = currentRel ? path.posix.join(currentRel, entry.name) : entry.name;

      if (entry.isDirectory()) {
        walk(abs, rel, depth + 1);
        continue;
      }

      if (!entry.isFile()) continue;

      const ext = path.extname(entry.name).toLowerCase();
      if (!allowedExt.has(ext)) continue;

      results.push({
        filename: entry.name,
        relPath: rel,
        url: `/uploads/${rel}`,
      });
    }
  }

  walk(UPLOADS_DIR, "", 0);
  return results;
}

function ensureUploadsDir() {
  if (!fs.existsSync(UPLOADS_DIR)) {
    fs.mkdirSync(UPLOADS_DIR, { recursive: true });
  }
}
function ensurePaymentProofUploadsDir() {
  if (!fs.existsSync(PAYMENT_PROOFS_DIR)) {
    fs.mkdirSync(PAYMENT_PROOFS_DIR, { recursive: true });
  }
}
function ensureProductUploadsDir() {
  if (!fs.existsSync(PRODUCTS_UPLOADS_DIR)) {
    fs.mkdirSync(PRODUCTS_UPLOADS_DIR, { recursive: true });
  }
}
function ensureMediaUploadsDir() {
  if (!fs.existsSync(MEDIA_UPLOADS_DIR)) {
    fs.mkdirSync(MEDIA_UPLOADS_DIR, { recursive: true });
  }
}

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  // Security Logging Middleware
  app.use(async (req, res, next) => {
    const start = Date.now();
    const url = req.originalUrl || req.url;
    
    // Skip static files and health checks to keep logs clean/performant
    if (url.startsWith("/uploads") || url.startsWith("/assets") || url === "/api/health") {
      return next();
    }

    res.on("finish", async () => {
      const duration = Date.now() - start;
      const user = req.user as Express.User | undefined;
      
      // Basic threat detection logic
      let threat: string | null = null;
      if (res.statusCode >= 400) {
        if (url.includes(".php") || url.includes(".env") || url.includes("/wp-admin")) {
          threat = "Suspicious Path Probe";
        } else if (res.statusCode === 401 || res.statusCode === 403) {
          threat = "Access Denied";
        } else if (res.statusCode === 429) {
          threat = "Rate Limit Exceeded";
        }
      }

      try {
        await storage.insertSecurityLog({
          userId: user?.id || null,
          userRole: user?.role || "guest",
          method: req.method,
          url: url,
          status: res.statusCode,
          durationMs: duration,
          ip: req.ip || req.headers["x-forwarded-for"]?.toString() || null,
          userAgent: req.headers["user-agent"] || null,
          threat: threat,
        });
      } catch (err) {
        console.error("Failed to insert security log:", err);
      }
    });

    next();
  });

  // Auth routes
  const registerSchema = z.object({
    name: z.string().min(1),
    email: z.string().email(),
    password: z.string().min(6),
  });

  // Apply rate limiting to auth endpoints
  app.post("/api/auth/register", rateLimit(), async (req: Request, res: Response) => {
    try {
      const parsed = registerSchema.safeParse(req.body);
      if (!parsed.success) {
        return handleApiError(
          res,
          parsed.error,
          "auth/register",
          400,
        );
      }

      const { email, password, name } = parsed.data;

      const existing = await storage.getUserByEmail(email);
      if (existing) {
        return sendError(res, "Email already in use", undefined, 400, "EMAIL_IN_USE");
      }

      const bcrypt = await import("bcryptjs");
      const hashed = await bcrypt.default.hash(password, 10);

      const user = await storage.createUser({
        username: email,
        password: hashed,
        role: "customer",
        status: "active",
        twoFactorEnabled: 0,
        lastLoginAt: null,
      });

      const expressUser: Express.User = {
        id: user.id,
        email: email,
        role: user.role,
        name,
      };

      req.login(expressUser, (err) => {
        if (err) {
          handleApiError(res, err, "auth/register-login", 500);
          return;
        }
        return res.status(201).json({
          success: true,
          data: { id: user.id, email, name, role: user.role },
        });
      });
    } catch (err) {
      handleApiError(res, err, "auth/register", 500);
    }
  });

  // Feature-level RBAC for admin APIs.
  app.use("/api/admin/categories", requireAdminPageAccess("products"));
  app.use("/api/admin/upload-product-image", requireAdminPageAccess("products"));
  app.use("/api/admin/products", requireAdminPageAccess("products"));
  app.use("/api/admin/attributes", requireAdminPageAccess("products"));
  app.use("/api/admin/site-assets", requireAdminPageAccess("landing-page"));
  app.use("/api/admin/orders", requireAdminPageAccess("orders"));
  app.use("/api/admin/analytics", requireAdminPageAccess("analytics"));
  app.use("/api/admin/customers", requireAdminPageAccess("customers"));
  app.use("/api/admin/users", requireAdminPageAccess("store-users"));
  app.use("/api/admin/store-users", requireAdminPageAccess("store-users"));
  app.use("/api/admin/notifications", requireAdminPageAccess("notifications"));
  app.use("/api/admin/messages", requireAdminPageAccess("profile"));
  app.use("/api/admin/marketing", requireAdminPageAccess("marketing"));
  app.use("/api/admin/newsletter", requireAdminPageAccess("marketing"));
  app.use("/api/admin/templates", requireAdminPageAccess("marketing"));
  app.use("/api/admin/test-email", requireAdminPageAccess("marketing"));
  app.use("/api/admin/bills", requireAdminPageAccess("bills"));
  app.use("/api/admin/pos/session", requireAdminPageAccess("pos"));
  app.use("/api/admin/logs", requireAdminPageAccess("logs"));
  app.use("/api/admin/promo-codes", requireAdminPageAccess("promo-codes"));
  app.use("/api/admin/images", requireAdminPageAccess("images"));
  app.use("/api/admin/media", requireAdminPageAccess("images"));
  app.use("/api/admin/storefront-image-library", requireAdminPageAccess("storefront-images"));

  app.post(
    "/api/auth/login",
    rateLimit(),
    createLoginHandler({ storage, passport, sendOTPEmail }),
  );

  app.post(
    "/api/auth/logout",
    requireAuth,
    (req: Request, res: Response, next: NextFunction) => {
      req.logout((err) => {
        if (err) return next(err);
        req.session.destroy(() => {
          res.status(200).json({ success: true });
        });
      });
    },
  );

  app.get("/api/auth/me", (req: Request, res: Response) => {
    const user = req.user as Express.User | undefined;
    if (!user) {
      return res.status(200).json({ success: true, data: null });
    }
    return res.status(200).json({
      success: true,
      data: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        profileImageUrl: user.profileImageUrl || null,
        twoFactorEnabled: !!user.twoFactorEnabled,
      },
    });
  });

  app.post(
    "/api/auth/verify-2fa",
    rateLimit(),
    createVerify2FAHandler({ storage }),
  );

  const resendOtpSchema = z.object({
    tempToken: z.string().min(1),
  });

  app.post(
    "/api/auth/resend-otp",
    rateLimit(),
    async (req: Request, res: Response) => {
      const parsed = resendOtpSchema.safeParse(req.body);
      if (!parsed.success) {
        return res
          .status(400)
          .json({ success: false, error: "Invalid request body" });
      }

      const { tempToken } = parsed.data;
      const refreshed = await storage.refreshOtpToken(tempToken);
      if (!refreshed) {
        return res
          .status(400)
          .json({ success: false, error: "Invalid or expired session" });
      }

      await sendOTPEmail(
        refreshed.email,
        refreshed.code,
        refreshed.name ?? refreshed.email,
      );

      return res.json({ success: true });
    },
  );

  // Storefront product routes
  // Public Contact API
  app.post("/api/contact", rateLimit(), async (req: Request, res: Response) => {
    try {
      const { name, email, subject, message } = req.body;
      if (!name || !email || !subject || !message) {
        return res.status(400).json({ success: false, error: "Missing required fields" });
      }

      const created = await storage.createContactMessage({
        name,
        email,
        phone: null,
        subject,
        message,
      });

      // Create admin notification and broadcast via WebSocket
      const notification = await storage.createAdminNotification({
        title: "New Contact Message",
        message: `From: ${name} (${subject})`,
        type: "contact",
        link: "/admin/profile?tab=messages",
      });

      return res.status(201).json({ success: true, data: created });
    } catch (err) {
      console.error("Error in POST /api/contact", err);
      return res.status(500).json({ success: false, error: "Failed to send message" });
    }
  });

  // ── User activity (cart) -> Admin live notifications ─────────────────────────
  app.post(
    "/api/user-activity/cart",
    rateLimit({ windowMs: 60 * 1000, maxRequests: 20 }),
    async (req: Request, res: Response) => {
      try {
        const schema = z.object({
          action: z.enum(["add", "update", "remove"]),
          productName: z.string().min(1),
          size: z.string().optional(),
          color: z.string().optional(),
          quantity: z.number().int().min(1).optional(),
        });

        const parsed = schema.safeParse(req.body);
        if (!parsed.success) {
          return res.status(400).json({ success: false, error: "Invalid payload" });
        }

        const { action, productName, size, color, quantity } = parsed.data;

        const variantParts = [size ? `Size: ${size}` : null, color ? `Color: ${color}` : null].filter(
          Boolean,
        ) as string[];
        const variant = variantParts.length ? variantParts.join(", ") : "";

        const messageParts = [`${action.toUpperCase()}: ${productName}`];
        if (variant) messageParts.push(`(${variant})`);
        if (quantity) messageParts.push(`x${quantity}`);

        await storage.createAdminNotification({
          title: "Cart Activity",
          message: messageParts.join(" "),
          type: "system",
          link: "/admin",
        });
        return res.json({ success: true });
      } catch (err) {
        console.error("Error in POST /api/user-activity/cart", err);
        return res.status(500).json({ success: false, error: "Failed to broadcast cart activity" });
      }
    },
  );


  // Dedicated arrivals endpoint for homepage "New Arrivals" section
  app.get("/api/products/arrivals", async (req: Request, res: Response) => {
    try {
      const products = await storage.getProducts({
        category: "arrivals",
        limit: 4,
        includeInactive: false,
      });
      return res.json({ success: true, data: products });
    } catch (err) {
      console.error("Error in GET /api/products/arrivals", err);
      return res.status(500).json({ success: false, error: "Failed to load arrivals" });
    }
  });

  app.get("/api/products/home-featured", async (_req: Request, res: Response) => {
    try {
      const featured = await db
        .select()
        .from(products)
        .where(eq(products.homeFeatured, true))
        .orderBy(desc(products.updatedAt))
        .limit(8);
      return res.json({ success: true, data: featured });
    } catch (err) {
      console.error("Error in GET /api/products/home-featured", err);
      return res.status(500).json({ success: false, error: "Failed to load featured products" });
    }
  });

  app.get("/api/products", async (req: Request, res: Response) => {
    try {
      const { category, search, page, limit } = req.query;
      const products = await storage.getProducts({
        category: typeof category === "string" ? category : undefined,
        search: typeof search === "string" ? search : undefined,
        page: typeof page === "string" ? Number(page) || 1 : undefined,
        limit: typeof limit === "string" ? Number(limit) || 24 : undefined,
        includeInactive: false,
      });

      return res.json({ success: true, data: products });
    } catch (err) {
      console.error("Error in GET /api/products", err);
      return res
        .status(500)
        .json({ success: false, error: "Failed to load products" });
    }
  });

  app.get("/api/products/:id", async (req: Request, res: Response) => {
    try {
      const product = await storage.getProductById(req.params.id as string);
      if (!product) {
        return res
          .status(404)
          .json({ success: false, error: "Product not found" });
      }

      return res.json({ success: true, data: product });
    } catch (err) {
      console.error("Error in GET /api/products/:id", err);
      return res
        .status(500)
        .json({ success: false, error: "Failed to load product" });
    }
  });

  // Newsletter
  app.post("/api/newsletter/subscribe", rateLimit(), async (req: Request, res: Response) => {
    try {
      const parsed = insertNewsletterSubscriberSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ success: false, error: "Invalid email" });
      }
      await storage.subscribeToNewsletter(parsed.data.email);
      
      // Async send welcome email
      sendNewsletterWelcomeEmail(parsed.data.email).catch(e => 
        console.error("Failed to send welcome email:", e)
      );

      return res.json({ success: true, message: "Subscribed successfully" });
    } catch (err) {
      console.error("Error in POST /api/newsletter/subscribe", err);
      return res.status(500).json({ success: false, error: "Failed to subscribe" });
    }
  });

  // Orders (checkout)
  const orderItemSchema = z.object({
    productId: z.string(),
    variantId: z.string().optional(),
    quantity: z.number().int().positive(),
    priceAtTime: z.number().nonnegative(),
  });

  const shippingSchema = z.object({
    firstName: z.string().min(1),
    lastName: z.string().min(1),
    email: z.string().email(),
    phone: z.string().optional(),
    address: z.string().min(1),
    city: z.string().min(1),
    zip: z.string().min(1),
    country: z.string().min(1),
    deliveryLocation: z.string().min(1),
    locationCoordinates: z.string().optional(),
  });

  const createOrderSchema = z.object({
    items: z.array(orderItemSchema).min(1),
    shipping: shippingSchema,
    paymentMethod: z.string().min(1),
    source: z.string().optional(),
    deliveryRequired: z.boolean().optional(),
    deliveryProvider: z.string().optional().nullable(),
    deliveryAddress: z.string().optional().nullable(),
    promoCodeId: z.string().optional(),
  });

  app.post("/api/orders", async (req: Request, res: Response) => {
    try {
      const parsed = createOrderSchema.safeParse(req.body);
      if (!parsed.success) {
        return handleApiError(res, parsed.error, "orders/create", 400);
      }

      const {
        items,
        shipping,
        paymentMethod,
        promoCodeId,
        source,
        deliveryRequired,
        deliveryProvider,
        deliveryAddress,
      } = parsed.data;

      const orderSubtotal = items.reduce(
        (acc, item) => acc + item.priceAtTime * item.quantity,
        0,
      );

      const shippingFee = 100;

      let promoCode: string | undefined;
      let promoDiscountAmount = 0;

      if (promoCodeId) {
        const [promo] = await db
          .select()
          .from(promoCodes)
          .where(eq(promoCodes.id, promoCodeId))
          .limit(1);

        const now = new Date();
        const cartProductIds = new Set(
          items
            .map((it) => Number(it.productId))
            .filter((n) => Number.isFinite(n)),
        );

        const matchesApplicableProducts =
          promo?.applicableProductIds == null
            ? true
          : promo.applicableProductIds.some((pid: number) =>
                cartProductIds.has(pid),
              );
        if (
          promo &&
          promo.active &&
          (!promo.expiresAt || new Date(promo.expiresAt) >= now) &&
          promo.usedCount < promo.maxUses &&
          matchesApplicableProducts
        ) {
          promoCode = promo.code;
          promoDiscountAmount = Math.round(
            orderSubtotal * (promo.discountPct / 100),
          );

          await db
            .update(promoCodes)
            .set({ usedCount: promo.usedCount + 1 })
            .where(eq(promoCodes.id, promo.id));
        }
      }

      const orderTotal = Math.max(
        0,
        orderSubtotal + shippingFee - promoDiscountAmount,
      );

      const now = new Date();
      const year = now.getFullYear();
      const sequence = Math.floor(now.getTime() / 1000) % 10000;
      const orderNumber = `UX-${year}-${sequence.toString().padStart(4, "0")}`;

      await storage.upsertCustomerFromOrder(
        shipping.email,
        shipping.firstName,
        shipping.lastName,
        shipping.phone ?? null,
      );

      const order = await storage.createOrder({
        userId: (req.user as Express.User | undefined)?.id ?? null,
        email: shipping.email,
        fullName: `${shipping.firstName} ${shipping.lastName}`,
        addressLine1: shipping.address,
        addressLine2: undefined,
        city: shipping.city,
        region: "", // state removed
        locationCoordinates: (shipping.locationCoordinates ?? shipping.deliveryLocation) as string,
        deliveryLocation: shipping.deliveryLocation,
        postalCode: shipping.zip,
        country: shipping.country,
        total: orderTotal,
        paymentMethod,
        source: source || "website",
        deliveryRequired: deliveryRequired ?? true,
        deliveryProvider: deliveryProvider ?? null,
        deliveryAddress: deliveryAddress ?? null,
        promoCode,
        promoDiscountAmount,
        items: items.map((item) => ({
          productId: item.productId,
          quantity: item.quantity,
          unitPrice: item.priceAtTime,
        })),
      });

      const fullOrder = await storage.getOrderById(order.id);

      // Fire-and-forget order confirmation email
      try {
        sendOrderConfirmationEmail({
          orderId: order.id,
          fullName: fullOrder.fullName ?? "Customer",
          email: fullOrder.email ?? "",
          items: (fullOrder.items ?? []).map((it: any) => ({
            productName: it.product?.name ?? "Product",
            quantity: it.quantity,
            unitPrice: it.unitPrice,
          })),
          subtotal: orderSubtotal,
          shippingFee: shippingFee,
          promoCode: promoCode ?? undefined,
          promoDiscountAmount: promoDiscountAmount ?? undefined,
          total: orderTotal,
          paymentMethod: paymentMethod ?? "cash_on_delivery",
        });
      } catch (emailErr) {
        console.error("Order confirmation email failed (non-critical):", emailErr);
      }

      return res.status(201).json({
        success: true,
        data: {
          orderNumber,
          subtotal: orderSubtotal,
          tax: 0,
          total: orderTotal,
          order: fullOrder,
        },
      });
    } catch (err) {
      handleApiError(res, err, "orders/create", 500);
    }
  });

  app.get("/api/orders/:id", async (req: Request, res: Response) => {
    try {
      const id = getQueryParam(req.params.id);
      if (!id) {
        return res.status(400).json({ success: false, error: "Order ID is required" });
      }
      const order = await storage.getOrderById(id);
      const user = req.user as Express.User | undefined;
      const isAdminOrStaff = canAccessAdminPanel(user?.role);
      const userEmail = user?.email?.toLowerCase();
      const orderEmail = order?.email?.toLowerCase();
      const isOwner =
        !!user &&
        (order.userId === user.id || (!!userEmail && !!orderEmail && userEmail === orderEmail));

      if (!user) {
        return res.status(401).json({ success: false, error: "Authentication required" });
      }

      if (!isAdminOrStaff && !isOwner) {
        return res.status(403).json({ success: false, error: "Forbidden" });
      }

      return res.json({ success: true, data: order });
    } catch (err) {
      console.error("Error in GET /api/orders/:id", err);
      return res
        .status(404)
        .json({ success: false, error: "Order not found" });
    }
  });

  const paymentProofSchema = z.object({
    imageBase64: z.string().min(1),
  });

  app.post(
    "/api/orders/:id/payment-proof",
    async (req: Request, res: Response) => {
      try {
        const parsed = paymentProofSchema.safeParse(req.body);
        if (!parsed.success) {
          return res
            .status(400)
            .json({ success: false, error: "Invalid payload" });
        }
        const orderId = req.params.id as string;
        await storage.getOrderById(orderId);
        const base64 = parsed.data.imageBase64;
        const match = base64.match(/^data:image\/(\w+);base64,(.+)$/);
        const mimeSubtype = (match?.[1] ?? "png").toLowerCase();
        const normalizedExt =
          mimeSubtype === "jpeg"
            ? "jpg"
            : mimeSubtype === "png" || mimeSubtype === "jpg" || mimeSubtype === "webp"
              ? mimeSubtype
              : "png";
        const buffer = Buffer.from(
          match ? match[2] : base64,
          "base64",
        );
        ensurePaymentProofUploadsDir();
        const filename = `${orderId}.${normalizedExt}`;
        const filePath = path.join(PAYMENT_PROOFS_DIR, filename);

        fs.writeFileSync(filePath, buffer);

        const proofUrl = `/api/uploads/payment-proofs/${filename}`;

        await storage.updateOrderPaymentProof(orderId, proofUrl);
        return res.json({ success: true });
      } catch (err) {
        console.error("Error in POST /api/orders/:id/payment-proof", err);
        return res
          .status(500)
          .json({ success: false, error: "Failed to upload payment proof" });
      }
    },
  );

  app.get("/api/uploads/payment-proofs/:filename", (req: Request, res: Response) => {
    const filename = req.params.filename as string;
    if (!/^[a-zA-Z0-9._-]+\.(png|jpg|jpeg|webp)$/.test(filename)) {
      return res.status(400).send("Invalid filename");
    }
    const filePath = path.join(PAYMENT_PROOFS_DIR, filename);
    if (!fs.existsSync(filePath)) {
      return res.status(404).send("Not found");
    }
    res.sendFile(filePath, (err) => {
      if (err) res.status(500).send("Error sending file");
    });
  });

  // Categories (public read, admin create)
  const DEFAULT_CATEGORIES = [
    { name: "Hoodies", slug: "HOODIE" },
    { name: "Trousers", slug: "TROUSER" },
    { name: "T-Shirts", slug: "TSHIRTS" },
    { name: "Winter '25", slug: "WINTER_25" },
    { name: "Arrivals", slug: "arrivals" },
  ];
  app.get("/api/categories", async (req: Request, res: Response) => {
    try {
      let categories = await storage.getCategories();
      if (categories.length === 0) {
        for (const cat of DEFAULT_CATEGORIES) {
          try {
            await storage.createCategory(cat);
          } catch {
            // ignore duplicate or table not ready
          }
        }
        categories = await storage.getCategories();
      }
      return res.json({ success: true, data: categories });
    } catch (err) {
      console.error("Error in GET /api/categories", err);
      return res.status(500).json({ success: false, error: "Failed to load categories" });
    }
  });

  app.post(
    "/api/admin/categories",
    requireAdmin,
    async (req: Request, res: Response) => {
      try {
        const parsed = z.object({ name: z.string().min(1), slug: z.string().min(1) }).safeParse(req.body);
        if (!parsed.success) {
          return res.status(400).json({ success: false, error: "Invalid payload" });
        }
        const category = await storage.createCategory(parsed.data);
        return res.status(201).json({ success: true, data: category });
      } catch (err) {
        console.error("Error in POST /api/admin/categories", err);
        return res.status(500).json({ success: false, error: "Failed to create category" });
      }
    },
  );

  app.put(
    "/api/admin/categories/:id",
    requireAdmin,
    async (req: Request, res: Response) => {
      try {
        const id = getQueryParam(req.params.id);
        if (!id) {
          return res.status(400).json({ success: false, error: "Invalid category ID" });
        }
        const parsed = z.object({ name: z.string().min(1), slug: z.string().min(1) }).safeParse(req.body);
        if (!parsed.success) {
          return res.status(400).json({ success: false, error: "Invalid payload" });
        }
        const updated = await storage.updateCategory(id, parsed.data);
        return res.json({ success: true, data: updated });
      } catch (err: any) {
        console.error("Error in PUT /api/admin/categories/:id", err);
        return res.status(err.status || 500).json({ success: false, error: err.message || "Failed to update category" });
      }
    },
  );

  app.delete(
    "/api/admin/categories/:id",
    requireAdmin,
    async (req: Request, res: Response) => {
      try {
        const id = getQueryParam(req.params.id);
        if (!id) {
          return sendError(res, "Invalid category ID", undefined, 400, "INVALID_ID");
        }
        await storage.deleteCategory(id);
        return res.json({ success: true });
      } catch (err: any) {
        return handleApiError(res, err, "DELETE /api/admin/categories/:id");
      }
    },
  );

  // Product image upload (admin only)
  const productImageSchema = z.object({ imageBase64: z.string().min(1) });
  app.post(
    "/api/admin/upload-product-image",
    requireAdmin,
    async (req: Request, res: Response) => {
      try {
        const parsed = productImageSchema.safeParse(req.body);
        if (!parsed.success) {
          return res.status(400).json({ success: false, error: "Invalid payload" });
        }
        const base64 = parsed.data.imageBase64;
        const match = base64.match(/^data:image\/(\w+);base64,(.+)$/);
        const buffer = Buffer.from(match ? match[2] : base64, "base64");
        
        // Use unified local WebP service for products
        const asset = await processAndStoreImage(
          buffer,
          "product",
          `product_${Date.now()}.png` // fallback name
        );

        return res.json({ success: true, url: asset.url });
      } catch (err) {
        console.error("Error in product image upload", err);
        return res.status(500).json({ success: false, error: "Upload failed" });
      }
    },
  );

  // General Media Management (Centralized Library)
  app.get("/api/admin/media", requireAdmin, async (req: Request, res: Response) => {
    try {
      const provider = req.query.provider as string | undefined;
      const category = req.query.category as string | undefined;
      
      const rows = await storage.getMediaAssets({
        provider,
        category,
        limit: 100
      });
      
      return res.json({ success: true, data: rows });
    } catch (err) {
      handleApiError(res, err, "GET /api/admin/media");
    }
  });

  app.post("/api/admin/media/upload", requireAdmin, memoryUpload.single("file"), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ success: false, error: "No file uploaded" });
      }

      ensureMediaUploadsDir();
      const filename = `${path.parse(req.file.originalname).name}-${Date.now()}.webp`;
      const filePath = path.join(MEDIA_UPLOADS_DIR, filename);

      await sharp(req.file.buffer)
        .webp({ quality: 85 })
        .toFile(filePath);

      res.status(201).json({ 
        success: true, 
        data: {
          name: filename,
          url: `/api/uploads/media/${filename}`
        } 
      });
    } catch (err) {
      handleApiError(res, err, "POST /api/admin/media/upload");
    }
  });

  app.delete("/api/admin/media/:filename", requireAdmin, async (req, res) => {
    try {
      const filename = req.params.filename as string;
      const filePath = path.join(MEDIA_UPLOADS_DIR, filename);
      if (fs.existsSync(filePath)) {
        await fs.promises.unlink(filePath);
      }
      res.json({ success: true });
    } catch (err) {
      handleApiError(res, err, "DELETE /api/admin/media/:filename");
    }
  });

  // Serve all uploads (including nested categories)
  app.use("/uploads", express.static(UPLOADS_DIR));
  
  // Backwards compatibility for /api/uploads/
  app.use("/api/uploads", express.static(UPLOADS_DIR));

  // ── Site Assets (Landing Page Images) ──────────────────────────────
  const validSiteAssetSections = [
    "hero",
    "featured_collection",
    "new_collection",
    "collection_page",
  ] as const;

  type SiteAssetSection = (typeof validSiteAssetSections)[number];

  // Upload site asset image (Cloudinary, admin only)
  app.post(
    "/api/admin/site-assets/upload",
    requireAdmin,
    memoryUpload.single("image"),
    async (req: Request, res: Response) => {
      try {
        const { section, altText = "", deviceTarget = "all" } = req.body as {
          section?: string;
          altText?: string;
          deviceTarget?: string;
        };

        if (!section || !validSiteAssetSections.includes(section as SiteAssetSection)) {
          return res.status(400).json({
            success: false,
            error: "Invalid section",
          });
        }

        if (!req.file || !req.file.buffer) {
          return res.status(400).json({
            success: false,
            error: "Invalid or missing image file",
          });
        }

        // Use unified local WebP service
        const asset = await processAndStoreImage(
          req.file.buffer,
          section,
          req.file.originalname || "image.jpg"
        );

        const [{ max }] = await db
          .select({ max: sql<number>`COALESCE(MAX(${siteAssets.sortOrder}), -1)` })
          .from(siteAssets)
          .where(eq(siteAssets.section, section));

        const [created] = await db
          .insert(siteAssets)
          .values({
            section,
            imageUrl: asset.url,
            cloudinaryPublicId: null, // No longer using Cloudinary for new uploads
            altText,
            deviceTarget,
            assetType: "image",
            sortOrder: (max ?? -1) + 1,
            active: true,
            uploadedBy: req.user?.id ?? null,
          })
          .returning();

        return res.json({ success: true, data: created });
      } catch (err) {
        console.error("Error in POST /api/admin/site-assets/upload", err);
        return res.status(500).json({
          success: false,
          error: "Failed to upload image",
        });
      }
    },
  );

  // Add site asset video (Admin only)
  app.post(
    "/api/admin/site-assets/video",
    requireAdmin,
    async (req: Request, res: Response) => {
      try {
        const { section, altText = "", deviceTarget = "mobile", videoUrl, imageUrl = "" } = req.body;

        if (!section || !validSiteAssetSections.includes(section as SiteAssetSection)) {
          return res.status(400).json({ success: false, error: "Invalid section" });
        }

        if (!videoUrl) {
          return res.status(400).json({ success: false, error: "Missing video URL" });
        }

        const [{ max }] = await db
          .select({ max: sql<number>`COALESCE(MAX(${siteAssets.sortOrder}), -1)` })
          .from(siteAssets)
          .where(eq(siteAssets.section, section));

        const [created] = await db
          .insert(siteAssets)
          .values({
            section,
            imageUrl, // Poster image or thumbnail
            cloudinaryPublicId: "video_asset", // Not needed for embedded videos
            altText,
            deviceTarget,
            assetType: "video",
            videoUrl,
            sortOrder: (max ?? -1) + 1,
            active: true,
            uploadedBy: req.user?.id ?? null,
          })
          .returning();

        return res.json({ success: true, data: created });
      } catch (err) {
        console.error("Error in POST /api/admin/site-assets/video", err);
        return res.status(500).json({ success: false, error: "Failed to add video asset" });
      }
    },
  );

  // Public: get active assets for a section
  app.get(
    "/api/site-assets/:section",
    async (req: Request, res: Response) => {
      try {
        const section = req.params.section as string;
        if (!validSiteAssetSections.includes(section as SiteAssetSection)) {
          return res.status(400).json({
            success: false,
            error: "Invalid section",
          });
        }

        const assets = await db
          .select()
          .from(siteAssets)
          .where(
            and(
              eq(siteAssets.section, section),
              eq(siteAssets.active, true),
            ),
          )
          .orderBy(siteAssets.sortOrder);

        res.setHeader("Cache-Control", "public, max-age=300");
        return res.json({ success: true, data: assets });
      } catch (err) {
        console.error("Error in GET /api/site-assets/:section", err);
        return res.status(500).json({
          success: false,
          error: "Failed to load site assets",
        });
      }
    },
  );

  // Admin: get all assets (optionally filtered by section)
  app.get(
    "/api/admin/site-assets",
    requireAdmin,
    async (req: Request, res: Response) => {
      try {
        const section = getQueryParam(req.query.section);
        const assets = section
          ? await db
              .select()
              .from(siteAssets)
              .where(eq(siteAssets.section, section))
              .orderBy(siteAssets.sortOrder)
          : await db
              .select()
              .from(siteAssets)
              .orderBy(siteAssets.sortOrder);

        return res.json({ success: true, data: assets });
      } catch (err) {
        console.error("Error in GET /api/admin/site-assets", err);
        return res.status(500).json({
          success: false,
          error: "Failed to load site assets",
        });
      }
    },
  );

  // Admin: reorder assets (must be before :id route)
  app.patch(
    "/api/admin/site-assets/reorder",
    requireAdmin,
    async (req: Request, res: Response) => {
      const schema = z.object({
        section: z.string().min(1),
        orderedIds: z.array(z.string().min(1)).min(1),
      });

      const parsed = schema.safeParse(req.body);
      if (!parsed.success) {
        return res
          .status(400)
          .json({ success: false, error: "Invalid payload" });
      }

      const { section, orderedIds } = parsed.data;

      if (!validSiteAssetSections.includes(section as SiteAssetSection)) {
        return res.status(400).json({
          success: false,
          error: "Invalid section",
        });
      }

      try {
        await db.transaction(async (tx) => {
          await Promise.all(
            orderedIds.map((id, index) =>
              tx
                .update(siteAssets)
                .set({ sortOrder: index })
                .where(
                  and(
                    eq(siteAssets.id, id),
                    eq(siteAssets.section, section),
                  ),
                ),
            ),
          );
        });

        return res.json({ success: true });
      } catch (err) {
        console.error("Error in PATCH /api/admin/site-assets/reorder", err);
        return res.status(500).json({
          success: false,
          error: "Failed to reorder site assets",
        });
      }
    },
  );

  // Admin: update a single asset (altText / active)
  app.patch(
    "/api/admin/site-assets/:id",
    requireAdmin,
    async (req: Request, res: Response) => {
      const schema = z.object({
        altText: z.string().optional(),
        active: z.boolean().optional(),
        deviceTarget: z.string().optional(),
        assetType: z.string().optional(),
        videoUrl: z.string().optional(),
        imageUrl: z.string().optional(),
      });

      const parsed = schema.safeParse(req.body);
      if (!parsed.success) {
        return res
          .status(400)
          .json({ success: false, error: "Invalid payload" });
      }

      const { id } = req.params;
      if (typeof id !== "string") {
        return res
          .status(400)
          .json({ success: false, error: "Invalid ID" });
      }

      const update: any = {};
      
      if (parsed.data.altText !== undefined) update.altText = parsed.data.altText;
      if (parsed.data.active !== undefined) update.active = parsed.data.active;
      if (parsed.data.deviceTarget !== undefined) update.deviceTarget = parsed.data.deviceTarget;
      if (parsed.data.assetType !== undefined) update.assetType = parsed.data.assetType;
      if (parsed.data.videoUrl !== undefined) update.videoUrl = parsed.data.videoUrl;
      if (parsed.data.imageUrl !== undefined) update.imageUrl = parsed.data.imageUrl;

      try {
        const [updated] = await db
          .update(siteAssets)
          .set(update)
          .where(eq(siteAssets.id, id))
          .returning();

        if (!updated) {
          return res
            .status(404)
            .json({ success: false, error: "Site asset not found" });
        }

        return res.json({ success: true, data: updated });
      } catch (err) {
        console.error("Error in PATCH /api/admin/site-assets/:id", err);
        return res.status(500).json({
          success: false,
          error: "Failed to update site asset",
        });
      }
    },
  );

  // Admin: delete asset (DB + Cloudinary)
  app.delete(
    "/api/admin/site-assets/:id",
    requireAdmin,
    async (req: Request, res: Response) => {
      const { id } = req.params;
      if (typeof id !== "string") {
        return res
          .status(400)
          .json({ success: false, error: "Invalid ID" });
      }

      try {
        const [existing] = await db
          .select()
          .from(siteAssets)
          .where(eq(siteAssets.id, id))
          .limit(1);

        if (!existing) {
          return res
            .status(404)
            .json({ success: false, error: "Site asset not found" });
        }

        if (existing.cloudinaryPublicId) {
          try {
            await deleteFromCloudinary(existing.cloudinaryPublicId);
          } catch (err) {
            console.error(
              "Failed to delete from Cloudinary for site asset",
              err,
            );
            return res.status(500).json({
              success: false,
              error: "Failed to delete image from Cloudinary",
            });
          }
        }

        await db
          .delete(siteAssets)
          .where(eq(siteAssets.id, id));

        return res.json({ success: true });
      } catch (err) {
        console.error("Error in DELETE /api/admin/site-assets/:id", err);
        return res.status(500).json({
          success: false,
          error: "Failed to delete site asset",
        });
      }
    },
  );

  app.get("/api/uploads/products/:filename", (req: Request, res: Response) => {
    const filename = req.params.filename as string;
    if (!/^[a-zA-Z0-9._-]+\.(png|jpg|jpeg|webp)$/.test(filename)) {
      return res.status(400).send("Invalid filename");
    }
    const filePath = path.join(PRODUCTS_UPLOADS_DIR, filename);
    if (!fs.existsSync(filePath)) {
      return res.status(404).send("Not found");
    }
    res.sendFile(filePath, (err) => {
      if (err) res.status(500).send("Error sending file");
    });
  });

  // Admin product routes (protected)
  const adminProductSchema = z.object({
    name: z.string().min(1),
    shortDetails: z.string().optional().nullable(),
    description: z.string().optional().nullable(),
    price: z.number().positive(),
    imageUrl: z.string().optional().nullable(),
    galleryUrls: z.string().optional().nullable(),
    category: z.string().optional().nullable(),
    stock: z.number().int().nonnegative(),
    colorOptions: z.string().optional().nullable(),
    sizeOptions: z.string().optional().nullable(),
    salePercentage: z.number().int().min(0).max(100).optional().default(0),
    saleActive: z.boolean().optional().default(false),
    originalPrice: z.number().positive().optional().nullable(),
    homeFeatured: z.boolean().optional().default(false),
    homeFeaturedImageIndex: z.number().int().min(0).max(3).optional().default(2),
  });

  app.get(
    "/api/admin/products",
    requireAdmin,
    async (req: Request, res: Response) => {
      try {
        const category = getQueryParam(req.query.category);
        const search = getQueryParam(req.query.search);
        const page = getQueryParam(req.query.page);
        const limit = getQueryParam(req.query.limit);

        const products = await storage.getProducts({
          category,
          search,
          page: page ? Number(page) || 1 : undefined,
          limit: limit ? Number(limit) || 24 : undefined,
          includeInactive: true,
        });
        return res.json({ success: true, data: products });
      } catch (err) {
        console.error("Error in GET /api/admin/products", err);
        return res
          .status(500)
          .json({ success: false, error: "Failed to load products" });
      }
    },
  );

  // Bulk categorize products
  app.patch(
    "/api/admin/products/bulk-categorize",
    requireAdmin,
    async (req: Request, res: Response) => {
      try {
        const schema = z.object({
          productIds: z.array(z.string().min(1)).min(1),
          categorySlug: z.string().min(1),
        });
        const parsed = schema.safeParse(req.body);
        if (!parsed.success) {
          return res
            .status(400)
            .json({ success: false, error: "Invalid payload" });
        }

        const { productIds, categorySlug } = parsed.data;

        const result = await db
          .update(products)
          .set({ category: categorySlug })
          .where(inArray(products.id, productIds));

        return res.json({
          success: true,
          updated: result.rowCount ?? productIds.length,
        });
      } catch (err) {
        console.error("Error in PATCH /api/admin/products/bulk-categorize", err);
        return res
          .status(500)
          .json({ success: false, error: "Failed to move products" });
      }
    },
  );

  app.post(
    "/api/admin/products",
    requireAdmin,
    async (req: Request, res: Response) => {
      try {
        const parsed = adminProductSchema.safeParse(req.body);
        if (!parsed.success) {
          return res
            .status(400)
            .json({ success: false, error: "Invalid product payload" });
        }

        const data = {
          name: parsed.data.name,
          shortDetails: parsed.data.shortDetails || null,
          description: parsed.data.description || null,
          price: parsed.data.price.toString(),
          imageUrl: parsed.data.imageUrl || null,
          galleryUrls: parsed.data.galleryUrls || null,
          category: parsed.data.category || null,
          stock: parsed.data.stock,
          colorOptions: parsed.data.colorOptions || null,
          sizeOptions: parsed.data.sizeOptions || null,
          ranking: 999,
          salePercentage: parsed.data.salePercentage || 0,
          saleActive: parsed.data.saleActive || false,
          originalPrice: parsed.data.originalPrice ? parsed.data.originalPrice.toString() : null,
          homeFeatured: parsed.data.homeFeatured || false,
          homeFeaturedImageIndex: parsed.data.homeFeaturedImageIndex ?? 2,
        };
        const product = await storage.createProduct(data);
        return res.status(201).json({ success: true, data: product });
      } catch (err) {
        console.error("Error in POST /api/admin/products", err);
        return res
          .status(500)
          .json({ success: false, error: "Failed to create product" });
      }
    },
  );

  app.put(
    "/api/admin/products/:id",
    requireAdmin,
    async (req: Request, res: Response) => {
      try {
        const parsed = adminProductSchema.partial().safeParse(req.body);
        if (!parsed.success) {
          return res
            .status(400)
            .json({ success: false, error: "Invalid product payload" });
        }

        const data: Partial<Omit<Product, "id">> = {
          name: parsed.data.name,
          shortDetails: parsed.data.shortDetails === undefined ? undefined : (parsed.data.shortDetails || null),
          description: parsed.data.description === undefined ? undefined : (parsed.data.description || null),
          price: parsed.data.price?.toString(),
          imageUrl: parsed.data.imageUrl === undefined ? undefined : (parsed.data.imageUrl || null),
          galleryUrls: parsed.data.galleryUrls === undefined ? undefined : (parsed.data.galleryUrls || null),
          category: parsed.data.category === undefined ? undefined : (parsed.data.category || null),
          stock: parsed.data.stock,
          colorOptions: parsed.data.colorOptions === undefined ? undefined : (parsed.data.colorOptions || null),
          sizeOptions: parsed.data.sizeOptions === undefined ? undefined : (parsed.data.sizeOptions || null),
          salePercentage: parsed.data.salePercentage,
          saleActive: parsed.data.saleActive,
          originalPrice: parsed.data.originalPrice === undefined ? undefined : (parsed.data.originalPrice ? parsed.data.originalPrice.toString() : null),
          homeFeatured: parsed.data.homeFeatured,
          homeFeaturedImageIndex: parsed.data.homeFeaturedImageIndex,
        };
        const updated = await storage.updateProduct(
          req.params.id as string,
          data,
        );
        return res.json({ success: true, data: updated });
      } catch (err) {
        console.error("Error in PUT /api/admin/products/:id", err);
        return res
          .status(500)
          .json({ success: false, error: "Failed to update product" });
      }
    },
  );

  app.delete(
    "/api/admin/products/:id",
    requireAdmin,
    async (req: Request, res: Response) => {
      try {
        await storage.deleteProduct(req.params.id as string);
        return res.json({ success: true });
      } catch (err) {
        console.error("Error in DELETE /api/admin/products/:id", err);
        return res
          .status(500)
          .json({ success: false, error: "Failed to delete product" });
      }
    },
  );

  app.patch(
    "/api/admin/products/:id/home-featured",
    requireAdmin,
    async (req: Request, res: Response) => {
      try {
        const bodySchema = z.object({
          homeFeatured: z.boolean(),
          homeFeaturedImageIndex: z.number().int().min(0).max(3).optional(),
        });
        const parsed = bodySchema.safeParse(req.body);
        if (!parsed.success) {
          return res.status(400).json({ success: false, error: "Invalid payload" });
        }

        const productId = req.params.id as string;
        const existing = await storage.getProductById(productId);
        if (!existing) {
          return res.status(404).json({ success: false, error: "Product not found" });
        }

        const wantsFeatured = parsed.data.homeFeatured;
        if (wantsFeatured && !existing.homeFeatured) {
          const [{ count }] = await db
            .select({ count: sql<number>`count(*)::int` })
            .from(products)
            .where(eq(products.homeFeatured, true));
          if (count >= 8) {
            return res.status(400).json({
              success: false,
              error: "Max 8 products allowed in New Arrivals.",
            });
          }
        }

        const updated = await storage.updateProduct(productId, {
          homeFeatured: wantsFeatured,
          homeFeaturedImageIndex: parsed.data.homeFeaturedImageIndex ?? existing.homeFeaturedImageIndex ?? 2,
        });

        return res.json({ success: true, data: updated });
      } catch (err) {
        console.error("Error in PATCH /api/admin/products/:id/home-featured", err);
        return res.status(500).json({ success: false, error: "Failed to update home featured flag" });
      }
    },
  );

  // Admin Attributes
  app.get(
    "/api/admin/attributes",
    requireAdmin,
    async (req: Request, res: Response) => {
      try {
        const type = getQueryParam(req.query.type);
        const attributes = await storage.getProductAttributes(
          type,
        );
        return res.json({ success: true, data: attributes });
      } catch (err) {
        console.error("Error in GET /api/admin/attributes", err);
        return res
          .status(500)
          .json({ success: false, error: "Failed to load attributes" });
      }
    },
  );

  app.post(
    "/api/admin/attributes",
    requireAdmin,
    async (req: Request, res: Response) => {
      try {
        const parsed = insertProductAttributeSchema.safeParse(req.body);
        if (!parsed.success) {
          return res.status(400).json({ success: false, error: "Invalid attribute data" });
        }
        const attribute = await storage.createProductAttribute(parsed.data);
        return res.status(201).json({ success: true, data: attribute });
      } catch (err) {
        console.error("Error in POST /api/admin/attributes", err);
        return res
          .status(500)
          .json({ success: false, error: "Failed to create attribute" });
      }
    },
  );

  app.delete(
    "/api/admin/attributes/:id",
    requireAdmin,
    async (req: Request, res: Response) => {
      try {
        await storage.deleteProductAttribute(req.params.id as string);
        return res.json({ success: true });
      } catch (err) {
        console.error("Error in DELETE /api/admin/attributes/:id", err);
        return res
          .status(500)
          .json({ success: false, error: "Failed to delete attribute" });
      }
    },
  );

  // Admin orders
  app.get(
    "/api/admin/orders",
    requireAdmin,
    async (req: Request, res: Response) => {
      try {
        const status = getQueryParam(req.query.status);
        const search = getQueryParam(req.query.search);
        const page = getQueryParam(req.query.page);
        const orders = await storage.getOrders({
          status: status as any,
          search,
          page: page ? parseInt(page) : undefined,
        });
        return res.json({ success: true, data: orders });
      } catch (err) {
        console.error("Error in GET /api/admin/orders", err);
        return res
          .status(500)
          .json({ success: false, error: "Failed to load orders" });
      }
    },
  );

  const statusSchema = z.object({
    status: z.enum(["pending", "processing", "completed", "cancelled", "pos"]),
  });

  app.put(
    "/api/admin/orders/:id",
    requireAdmin,
    async (req: Request, res: Response) => {
      try {
        const parsed = statusSchema.safeParse(req.body);
        if (!parsed.success) {
          return res
            .status(400)
            .json({ success: false, error: "Invalid status" });
        }

        const { id } = req.params;
        if (typeof id !== "string") return res.status(400).json({ success: false, error: "Invalid ID" });
        const updated = await storage.updateOrderStatus(
          id,
          parsed.data.status,
        );

        // Auto-generate bill when order is marked completed
        if (parsed.data.status === "completed") {
          try {
            const user = req.user as any;
            await generateBillFromOrder(
              id,
              user?.id ?? "system",
              user?.name ?? user?.email ?? "Admin"
            );
            console.log(`✅ Bill auto-generated for order ${id}`);
          } catch (billErr) {
            console.error("Bill generation failed (non-critical):", billErr);
          }
        }

        // Fire-and-forget order status update email
        try {
          const orderDetails = await storage.getOrderById(id);
          const customerEmail = orderDetails.email ?? "";
          const customerName = orderDetails.fullName ?? "Customer";
          if (customerEmail) {
            sendOrderStatusUpdateEmail(
              customerEmail,
              customerName,
              id,
              parsed.data.status,
            );
          }
        } catch (emailErr) {
          console.error("Order status email failed (non-critical):", emailErr);
        }

        return res.json({ success: true, data: updated });
      } catch (err) {
        console.error("Error in PUT /api/admin/orders/:id", err);
        return res
          .status(500)
          .json({ success: false, error: "Failed to update order status" });
      }
    },
  );

  const verifyPaymentSchema = z.object({
    paymentVerified: z.enum(["verified", "rejected"]),
  });

  app.put(
    "/api/admin/orders/:id/verify-payment",
    requireAdmin,
    async (req: Request, res: Response) => {
      try {
        const parsed = verifyPaymentSchema.safeParse(req.body);
        if (!parsed.success) {
          return res
            .status(400)
            .json({ success: false, error: "Invalid payload" });
        }
        const { id } = req.params;
        if (typeof id !== "string") return res.status(400).json({ success: false, error: "Invalid ID" });
        const updated = await storage.updateOrderPaymentVerified(
          id,
          parsed.data.paymentVerified,
        );
        return res.json({ success: true, data: updated });
      } catch (err) {
        console.error("Error in PUT /api/admin/orders/:id/verify-payment", err);
        return res
          .status(500)
          .json({ success: false, error: "Failed to update payment verification" });
      }
    },
  );

  app.get(
    "/api/admin/orders/export",
    requireAdmin,
    async (_req: Request, res: Response) => {
      try {
        const orders = await storage.getOrders();
        const customers = await storage.getCustomers();

        const customerByEmail = new Map(
          customers.map((c) => [c.email, `${c.firstName} ${c.lastName}`]),
        );

        const rows: string[] = [];
        rows.push("Order,Customer,Email,Date,Items,Status,Amount");

        for (const order of orders) {
          let itemsCount = 0;
          try {
            const fullOrder = await storage.getOrderById(order.id);
            itemsCount = fullOrder.items.length;
          } catch {
            itemsCount = 0;
          }

          const customerName =
            customerByEmail.get(order.email) ?? order.fullName;

          const date = order.createdAt
            ? new Date(order.createdAt).toISOString()
            : "";

          rows.push(
            [
              order.id,
              `"${customerName}"`,
              order.email,
              date,
              itemsCount.toString(),
              order.status,
              order.total.toString(),
            ].join(","),
          );
        }

        const csv = rows.join("\n");
        res.setHeader("Content-Type", "text/csv");
        res.setHeader(
          "Content-Disposition",
          'attachment; filename="orders.csv"',
        );
        return res.send(csv);
      } catch (err) {
        console.error("Error in GET /api/admin/orders/export", err);
        return res
          .status(500)
          .json({ success: false, error: "Failed to export orders" });
      }
    },
  );

  // Analytics CSV export
  app.get(
    "/api/admin/analytics/export",
    requireAdmin,
    async (req: Request, res: Response) => {
      try {
        const range = getQueryParam(req.query.range) || "30d";
        const orders = await storage.getOrders();
        
        const now = new Date();
        let startDate: Date;
        switch (range) {
          case "7d": startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000); break;
          case "90d": startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000); break;
          case "1y": startDate = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000); break;
          default: startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000); break;
        }

        const filteredOrders = orders.filter(o => {
          if (!o.createdAt) return false;
          return new Date(o.createdAt) >= startDate;
        });

        const rows: string[] = [];
        rows.push("Date,Order ID,Customer,Email,Status,Payment Method,Amount");

        for (const order of filteredOrders) {
          const date = order.createdAt ? new Date(order.createdAt).toISOString().split("T")[0] : "";
          rows.push(
            [
              date,
              order.id,
              `"${order.fullName}"`,
              order.email,
              order.status,
              order.paymentMethod || "N/A",
              order.total.toString(),
            ].join(",")
          );
        }

        const csv = rows.join("\n");
        res.setHeader("Content-Type", "text/csv");
        res.setHeader("Content-Disposition", `attachment; filename="analytics-${range}.csv"`);
        return res.send(csv);
      } catch (err) {
        console.error("Error in GET /api/admin/analytics/export", err);
        return res.status(500).json({ success: false, error: "Failed to export analytics" });
      }
    },
  );

  // Customers CSV export
  app.get(
    "/api/admin/customers/export",
    requireAdmin,
    async (_req: Request, res: Response) => {
      try {
        const customers = await storage.getCustomers();

        const rows: string[] = [];
        rows.push("Name,Email,Phone,Orders,Total Spent,Status,Created");

        for (const customer of customers) {
          const created = customer.createdAt ? new Date(customer.createdAt).toISOString().split("T")[0] : "";
          const status = customer.orderCount > 0 ? "Active" : "Inactive";
          rows.push(
            [
              `"${customer.firstName} ${customer.lastName}"`,
              customer.email,
              customer.phoneNumber || "N/A",
              customer.orderCount.toString(),
              customer.totalSpent.toString(),
              status,
              created,
            ].join(",")
          );
        }

        const csv = rows.join("\n");
        res.setHeader("Content-Type", "text/csv");
        res.setHeader("Content-Disposition", 'attachment; filename="customers.csv"');
        return res.send(csv);
      } catch (err) {
        console.error("Error in GET /api/admin/customers/export", err);
        return res.status(500).json({ success: false, error: "Failed to export customers" });
      }
    },
  );

  // Admin customers
  app.get(
    "/api/admin/customers",
    requireAdmin,
    async (req: Request, res: Response) => {
      try {
        const search = getQueryParam(req.query.search);
        const customers = await storage.getCustomers(
          search,
        );
        return res.json({ success: true, data: customers });
      } catch (err) {
        console.error("Error in GET /api/admin/customers", err);
        return res
          .status(500)
          .json({ success: false, error: "Failed to load customers" });
      }
    },
  );

  // Lightweight customer emails for Marketing page (avoids expensive customer stats computation).
  app.get(
    "/api/admin/customers/emails",
    requireAdminPageAccess("marketing"),
    async (_req: Request, res: Response) => {
      try {
        const rows = await db
          .select({
            email: customers.email,
          })
          .from(customers)
          .where(sql`${customers.email} is not null and ${customers.email} != ''`)
          .orderBy(desc(customers.createdAt));

        return res.json({ success: true, data: rows });
      } catch (err) {
        console.error("Error in GET /api/admin/customers/emails", err);
        return res
          .status(500)
          .json({ success: false, error: "Failed to load customer emails" });
      }
    },
  );

  app.post(
    "/api/admin/customers",
    requireAdmin,
    async (req: Request, res: Response) => {
      try {
        const { firstName, lastName, email, phoneNumber } = req.body;
        if (!firstName || !lastName) {
          return res.status(400).json({ success: false, error: "First and last name are required" });
        }
        
        const customer = await storage.createCustomer({
          firstName,
          lastName,
          email: email || `${Date.now()}@walkin.local`,
          phoneNumber: phoneNumber || null,
          totalSpent: "0",
          orderCount: 0,
          avatarColor: "#2D4A35",
        });
        
        return res.json({ success: true, data: customer });
      } catch (err: any) {
        console.error("Error in POST /api/admin/customers", err);
        return res
          .status(500)
          .json({ success: false, error: err.message || "Failed to create customer" });
      }
    },
  );

  app.put(
    "/api/admin/customers/:id",
    requireAdmin,
    async (req: Request, res: Response) => {
      const { id } = req.params;
      if (typeof id !== "string") return res.status(400).json({ success: false, error: "Invalid ID" });
      try {
        // Assume updateCustomer is added to storage
        const customer = await storage.updateCustomer(id, req.body);
        return res.json({ success: true, data: customer });
      } catch (err: any) {
        console.error("Error in PUT /api/admin/customers/:id", err);
        return res
          .status(500)
          .json({ success: false, error: err.message || "Failed to update customer" });
      }
    },
  );

  app.delete(
    "/api/admin/customers/:id",
    requireAdmin,
    async (req: Request, res: Response) => {
      const { id } = req.params;
      if (typeof id !== "string") return res.status(400).json({ success: false, error: "Invalid ID" });
      try {
        // Assume deleteCustomer is added to storage
        await storage.deleteCustomer(id);
        return res.json({ success: true });
      } catch (err: any) {
        console.error("Error in DELETE /api/admin/customers/:id", err);
        return res
          .status(500)
          .json({ success: false, error: err.message || "Failed to delete customer" });
      }
    },
  );

  // Admin users & profile
  app.get(
    "/api/admin/users",
    requireAdmin,
    async (_req: Request, res: Response) => {
      try {
        const users = await storage.getAdminUsers();
        return res.json({ success: true, data: users });
      } catch (err) {
        console.error("Error in GET /api/admin/users", err);
        return res
          .status(500)
          .json({ success: false, error: "Failed to load users" });
      }
    },
  );

  // ── Store Users (team members) ─────────────────────────────
  app.get(
    "/api/admin/store-users",
    requireAdmin,
    async (_req: Request, res: Response) => {
      try {
        const users = await storage.getStoreUsers();
        return res.json({ success: true, data: users });
      } catch (err) {
        console.error("Error in GET /api/admin/store-users", err);
        return res
          .status(500)
          .json({ success: false, error: "Failed to load store users" });
      }
    },
  );

  app.post(
    "/api/admin/store-users",
    requireAdmin,
    createStoreUserHandler({ storage, sendStoreUserWelcomeEmail }),
  );

  const updateStoreUserRoleEnum = z.enum(["owner", "manager", "csr", "admin", "staff"]);

  const updateStoreUserSchema = z
    .object({
      role: updateStoreUserRoleEnum.optional(),
      email_notifications: z.boolean().optional(),
    })
    .refine((v) => v.role !== undefined || v.email_notifications !== undefined, {
      message: "No update fields provided",
    });

  app.patch(
    "/api/admin/store-users/:id",
    requireAdmin,
    async (req: Request, res: Response) => {
      const { id } = req.params;
      if (typeof id !== "string") {
        return res.status(400).json({ success: false, error: "Invalid ID" });
      }

      const parsed = updateStoreUserSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ success: false, error: "Invalid request body" });
      }

      try {
        const { role, email_notifications } = parsed.data;
        const updated = await storage.updateStoreUser(id, {
          role,
          emailNotifications: email_notifications,
        });

        return res.json({ success: true, data: updated });
      } catch (err) {
        console.error("Error in PATCH /api/admin/store-users/:id", err);
        return res.status(500).json({ success: false, error: "Failed to update store user" });
      }
    },
  );

  app.delete(
    "/api/admin/store-users/:id",
    requireAdmin,
    async (req: Request, res: Response) => {
      const { id } = req.params;
      if (typeof id !== "string") {
        return res.status(400).json({ success: false, error: "Invalid ID" });
      }

      const actor = req.user as Express.User | undefined;
      if (actor && actor.id === id) {
        return res.status(400).json({ success: false, error: "Cannot delete yourself" });
      }

      try {
        await storage.deleteUser(id);
        return res.json({ success: true });
      } catch (err) {
        console.error("Error in DELETE /api/admin/store-users/:id", err);
        return res.status(500).json({ success: false, error: "Failed to delete store user" });
      }
    },
  );

  const updatePasswordSchema = z.object({
    current: z.string().min(1),
    newPassword: z.string().min(8),
    confirm: z.string().min(8),
  });

  app.put(
    "/api/admin/profile/password",
    requireAuth,
    async (req: Request, res: Response) => {
      const parsed = updatePasswordSchema.safeParse(req.body);
      if (!parsed.success) {
        return res
          .status(400)
          .json({ success: false, error: "Invalid request body" });
      }

      const { current, newPassword, confirm } = parsed.data;
      if (newPassword !== confirm) {
        return res.status(400).json({
          success: false,
          error: "New passwords do not match",
        });
      }

      const user = req.user as Express.User | undefined;
      if (!user) {
        return res
          .status(401)
          .json({ success: false, error: "Not authenticated" });
      }

      const fullUser = await storage.getUserById(user.id);
      if (!fullUser) {
        return res
          .status(404)
          .json({ success: false, error: "User not found" });
      }

      const bcrypt = await import("bcryptjs");
      const matches = await bcrypt.default.compare(
        current,
        fullUser.password,
      );
      if (!matches) {
        return res.status(400).json({
          success: false,
          error: "Current password is incorrect",
        });
      }

      const hashed = await bcrypt.default.hash(newPassword, 10);
      await storage.updateUserPassword(fullUser.id, hashed);

      return res.json({ success: true });
    },
  );

  // Update profile (display name & profile image)
  const updateProfileSchema = z.object({
    displayName: z.string().min(1).max(100).optional(),
    profileImageUrl: z.string().optional(),
  });

  app.put(
    "/api/admin/profile/update",
    requireAuth,
    async (req: Request, res: Response) => {
      const parsed = updateProfileSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ success: false, error: "Invalid request body" });
      }

      const user = req.user as Express.User | undefined;
      if (!user) {
        return res.status(401).json({ success: false, error: "Not authenticated" });
      }

      try {
        await storage.updateUserProfile(user.id, parsed.data);
        return res.json({ success: true });
      } catch (err) {
        console.error("Error in PUT /api/admin/profile/update", err);
        return res.status(500).json({ success: false, error: "Failed to update profile" });
      }
    },
  );

  // Upload avatar image
  app.post(
    "/api/admin/profile/upload-avatar",
    requireAuth,
    async (req: Request, res: Response) => {
      try {
        const { imageBase64 } = req.body;
        if (!imageBase64 || typeof imageBase64 !== "string") {
          return res.status(400).json({ success: false, error: "Missing imageBase64" });
        }

        const user = req.user as Express.User | undefined;
        if (!user) {
          return res.status(401).json({ success: false, error: "Not authenticated" });
        }

        // Decode base64 and save
        const matches = imageBase64.match(/^data:image\/(\w+);base64,(.+)$/);
        if (!matches) {
          return res.status(400).json({ success: false, error: "Invalid image format" });
        }

        const buffer = Buffer.from(matches[2], "base64");

        // Preserve the original orientation and aspect ratio while keeping the result crisp enough
        // for profile cards, popovers, and larger admin surfaces.
        let finalBuffer = buffer;
        let fileExtension = "webp";
        try {
          const sharp = (await import("sharp")).default;
          finalBuffer = await sharp(buffer)
            .rotate()
            .resize(1440, 1800, { fit: "inside", withoutEnlargement: true })
            .webp({ quality: 96, effort: 6, smartSubsample: true })
            .toBuffer();
        } catch (error) {
          console.warn("Avatar resize failed (using original):", error);
          fileExtension = matches[1] === "jpeg" ? "jpg" : matches[1];
        }

        const fs = await import("fs");
        const path = await import("path");
        const avatarDir = path.join(UPLOADS_DIR, "avatars");
        fs.mkdirSync(avatarDir, { recursive: true });

        const filename = `avatar-${user.id}-${Date.now()}.${fileExtension}`;
        const filepath = path.join(avatarDir, filename);
        fs.writeFileSync(filepath, finalBuffer);

        const url = `/uploads/avatars/${filename}`;
        await storage.updateUserProfile(user.id, { profileImageUrl: url });

        return res.json({ success: true, url });
      } catch (err) {
        console.error("Error in POST /api/admin/profile/upload-avatar", err);
        return res.status(500).json({ success: false, error: "Failed to upload avatar" });
      }
    },
  );

  app.get(
    "/api/admin/profile/avatar-history",
    requireAuth,
    async (req: Request, res: Response) => {
      try {
        const user = req.user as Express.User | undefined;
        if (!user) {
          return res.status(401).json({ success: false, error: "Not authenticated" });
        }

        const fs = await import("fs");
        const path = await import("path");
        const avatarDir = path.join(UPLOADS_DIR, "avatars");

        if (!fs.existsSync(avatarDir)) {
          return res.json({ success: true, data: [] });
        }

        const data = fs
          .readdirSync(avatarDir)
          .filter((file) => file.startsWith(`avatar-${user.id}-`))
          .map((file) => {
            const filepath = path.join(avatarDir, file);
            const stats = fs.statSync(filepath);
            return {
              filename: file,
              url: `/uploads/avatars/${file}`,
              uploadedAt: stats.mtime.toISOString(),
              size: stats.size,
            };
          })
          .sort((a, b) => new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime())
          .slice(0, 12);

        return res.json({ success: true, data });
      } catch (err) {
        console.error("Error in GET /api/admin/profile/avatar-history", err);
        return res.status(500).json({ success: false, error: "Failed to load avatar history" });
      }
    },
  );

  app.delete(
    "/api/admin/profile/avatar",
    requireAuth,
    async (req: Request, res: Response) => {
      try {
        const user = req.user as Express.User | undefined;
        if (!user) {
          return res.status(401).json({ success: false, error: "Not authenticated" });
        }

        const avatarUrl = typeof req.body?.url === "string" ? req.body.url : "";
        if (!avatarUrl.startsWith("/uploads/avatars/")) {
          return res.status(400).json({ success: false, error: "Invalid avatar path" });
        }

        const path = await import("path");
        const fs = await import("fs");
        const filename = path.basename(avatarUrl);
        const allowedPrefix = `avatar-${user.id}-`;

        if (!filename.startsWith(allowedPrefix)) {
          return res.status(403).json({ success: false, error: "You can only delete your own uploaded images" });
        }

        const avatarDir = path.join(UPLOADS_DIR, "avatars");
        const filepath = path.join(avatarDir, filename);
        const normalizedDir = path.resolve(avatarDir);
        const normalizedFile = path.resolve(filepath);

        if (!normalizedFile.startsWith(normalizedDir)) {
          return res.status(400).json({ success: false, error: "Invalid avatar path" });
        }

        if (!fs.existsSync(normalizedFile)) {
          return res.status(404).json({ success: false, error: "Image not found" });
        }

        const currentProfileImageUrl = user.profileImageUrl || null;
        fs.unlinkSync(normalizedFile);

        if (currentProfileImageUrl === avatarUrl) {
          await storage.updateUserProfile(user.id, { profileImageUrl: "" });
        }

        return res.json({
          success: true,
          removedCurrentImage: currentProfileImageUrl === avatarUrl,
        });
      } catch (err) {
        console.error("Error in DELETE /api/admin/profile/avatar", err);
        return res.status(500).json({ success: false, error: "Failed to delete avatar" });
      }
    },
  );

  // Initiate email change — sends OTP to the new email
  const updateEmailSchema = z.object({
    newEmail: z.string().email(),
  });

  app.post(
    "/api/admin/profile/update-email",
    requireAuth,
    async (req: Request, res: Response) => {
      const parsed = updateEmailSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ success: false, error: "Invalid email" });
      }

      const user = req.user as Express.User | undefined;
      if (!user) {
        return res.status(401).json({ success: false, error: "Not authenticated" });
      }

      try {
        const { newEmail } = parsed.data;

        // Check if email already taken
        const existing = await storage.getUserByEmail(newEmail);
        if (existing && existing.id !== user.id) {
          return res.status(400).json({ success: false, error: "Email already in use" });
        }

        // Generate OTP
        const code = Math.floor(100000 + Math.random() * 900000).toString().slice(0, 6);
        const expiresAt = new Date(Date.now() + Number(process.env.OTP_EXPIRY_MINUTES ?? "10") * 60 * 1000);
        const tokenId = `email-change-${user.id}-${Date.now()}`;

        await storage.createOtpToken({
          id: tokenId,
          userId: user.id,
          token: code,
          expiresAt,
        });

        // Send OTP to new email
        const { sendOTPEmail } = await import("./email");
        await sendOTPEmail(newEmail, code, user.name || user.email);

        // Also log it for dev fallback (in case SMTP fails)
        console.log(`[EMAIL-CHANGE] OTP for ${user.email} -> ${newEmail}: ${code}`);

        return res.json({ success: true, tempToken: tokenId, code });
      } catch (err) {
        console.error("Error in POST /api/admin/profile/update-email", err);
        return res.status(500).json({ success: false, error: "Failed to initiate email change" });
      }
    },
  );

  // Verify email change OTP
  const verifyEmailChangeSchema = z.object({
    tempToken: z.string().min(1),
    code: z.string().min(4).max(6),
    newEmail: z.string().email(),
  });

  app.post(
    "/api/admin/profile/verify-email",
    requireAuth,
    async (req: Request, res: Response) => {
      const parsed = verifyEmailChangeSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ success: false, error: "Invalid request" });
      }

      const user = req.user as Express.User | undefined;
      if (!user) {
        return res.status(401).json({ success: false, error: "Not authenticated" });
      }

      try {
        const { tempToken, code, newEmail } = parsed.data;

        const otpResult = await storage.consumeOtpToken(tempToken, code);
        if (!otpResult) {
          return res.status(400).json({ success: false, error: "Invalid or expired verification code" });
        }

        // Update the email (username)
        await storage.updateUserEmail(user.id, newEmail);

        return res.json({ success: true });
      } catch (err) {
        console.error("Error in POST /api/admin/profile/verify-email", err);
        return res.status(500).json({ success: false, error: "Failed to verify email" });
      }
    },
  );

  const twoFASchema = z.object({
    enabled: z.boolean(),
  });

  app.put(
    "/api/admin/users/:id/2fa",
    requireAdmin,
    async (req: Request, res: Response) => {
      const parsed = twoFASchema.safeParse(req.body);
      if (!parsed.success) {
        return res
          .status(400)
          .json({ success: false, error: "Invalid request body" });
      }

      const { id } = req.params;
      if (typeof id !== "string") return res.status(400).json({ success: false, error: "Invalid ID" });
      try {
        await storage.updateUserTwoFactor(id, parsed.data.enabled);
        return res.json({ success: true });
      } catch (err) {
        console.error("Error in PUT /api/admin/users/:id/2fa", err);
        return res
          .status(500)
          .json({ success: false, error: "Failed to update 2FA" });
      }
    },
  );

  app.delete(
    "/api/admin/users/:id",
    requireAdmin,
    async (req: Request, res: Response) => {
      const { id } = req.params;
      if (typeof id !== "string") return res.status(400).json({ success: false, error: "Invalid ID" });
      try {
        await storage.deleteUser(id);
        return res.json({ success: true });
      } catch (err) {
        console.error("Error in DELETE /api/admin/users/:id", err);
        return res
          .status(500)
          .json({ success: false, error: "Failed to delete user" });
      }
    },
  );

  const inviteUserSchema = z.object({
    name: z.string().min(1),
    email: z.string().email(),
    role: z.enum(["owner", "manager", "csr", "admin", "staff"]),
  });

  app.post(
    "/api/admin/users/invite",
    requireAdmin,
    async (req: Request, res: Response) => {
      const parsed = inviteUserSchema.safeParse(req.body);
      if (!parsed.success) {
        return res
          .status(400)
          .json({ success: false, error: "Invalid request body" });
      }

      try {
        const { name, email, role } = parsed.data;
        const code = Math.floor(100000 + Math.random() * 900000)
          .toString()
          .slice(0, 6);

        const bcrypt = await import("bcryptjs");
        const hashed = await bcrypt.default.hash(code, 10);

        const created = await storage.inviteAdminUser({
          name,
          email,
          role,
          passwordHash: hashed,
        });

        const inviter = req.user as Express.User | undefined;

        await sendInviteEmail(
          email,
          name,
          code,
          inviter?.name || inviter?.email || "Admin",
        );

        return res.status(201).json({
          success: true,
          data: { id: created.id },
        });
      } catch (err) {
        console.error("Error in POST /api/admin/users/invite", err);
        return res
          .status(500)
          .json({ success: false, error: "Failed to invite user" });
      }
    },
  );

  app.get(
    "/api/admin/customers/:id",
    requireAdmin,
    async (req: Request, res: Response) => {
      const { id } = req.params;
      if (typeof id !== "string") return res.status(400).json({ success: false, error: "Invalid ID" });
      try {
        const customerWithOrders = await storage.getCustomerById(id);
        const last10Orders = customerWithOrders.orders.slice(0, 10);
        return res.json({
          success: true,
          data: { ...customerWithOrders, orders: last10Orders },
        });
      } catch (err) {
        console.error("Error in GET /api/admin/customers/:id", err);
        return res
          .status(404)
          .json({ success: false, error: "Customer not found" });
      }
    },
  );

  // Unified order history for a customer (online orders + POS bills)
  app.get(
    "/api/admin/customers/:id/orders",
    requireAdmin,
    async (req: Request, res: Response) => {
      const { id } = req.params;
      if (typeof id !== "string") {
        return res.status(400).json({ success: false, error: "Invalid ID" });
      }

      try {
        const orders = await storage.getCustomerOrders(id);
        return res.json({ success: true, data: orders });
      } catch (err) {
        console.error("Error in GET /api/admin/customers/:id/orders", err);
        return res.status(404).json({ success: false, error: "Customer not found" });
      }
    },
  );

  // Admin analytics
  app.get(
    "/api/admin/analytics",
    requireAdmin,
    async (req: Request, res: Response) => {
      try {
        const range = getQueryParam(req.query.range);
        const analyticsRange =
          range === "7d" || range === "30d" || range === "90d" || range === "1y"
            ? range
            : "30d";

        const data = await storage.getAnalytics(analyticsRange);
        return res.json({ success: true, data });
      } catch (err) {
        console.error("Error in GET /api/admin/analytics", err);
        return res
          .status(500)
          .json({ success: false, error: "Failed to load analytics" });
      }
    },
  );

  app.get(
    "/api/admin/analytics/calendar",
    requireAdmin,
    async (req: Request, res: Response) => {
      try {
        const { year } = req.query;
        const analyticsYear =
          typeof year === "string" && /^\d{4}$/.test(year)
            ? Number(year)
            : 2025;

        const data = await storage.getAnalyticsCalendar(analyticsYear);
        return res.json({ success: true, data });
      } catch (err) {
        console.error("Error in GET /api/admin/analytics/calendar", err);
        return res.status(500).json({
          success: false,
          error: "Failed to load analytics calendar",
        });
      }
    },
  );

  // Admin platforms (dynamic order sources)
  app.get(
    "/api/admin/platforms",
    requireAdminPageAccess(["analytics", "pos"]),
    async (_req: Request, res: Response) => {
    try {
      const rows = await db
        .select()
        .from(platforms)
        .orderBy(desc(platforms.createdAt));
      return res.json({ success: true, data: rows });
    } catch (err) {
      console.error("Error in GET /api/admin/platforms", err);
      return res.status(500).json({ success: false, error: "Failed to load platforms" });
    }
    },
  );

  app.post(
    "/api/admin/platforms",
    requireAdminPageAccess("analytics"),
    async (req: Request, res: Response) => {
    const schema = z.object({
      key: z
        .string()
        .min(1)
        .regex(/^[a-z0-9_]+$/),
      label: z.string().min(1),
      isActive: z.boolean().optional(),
    });

    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ success: false, error: "Invalid payload" });
    }

    try {
      const [row] = await db
        .insert(platforms)
        .values({
          key: parsed.data.key,
          label: parsed.data.label,
          isActive: parsed.data.isActive ?? true,
        })
        .onConflictDoUpdate({
          target: platforms.key,
          set: { label: parsed.data.label, isActive: parsed.data.isActive ?? true },
        })
        .returning();
      return res.json({ success: true, data: row });
    } catch (err) {
      console.error("Error in POST /api/admin/platforms", err);
      return res.status(500).json({ success: false, error: "Failed to save platform" });
    }
    },
  );

  app.delete(
    "/api/admin/platforms/:key",
    requireAdminPageAccess("analytics"),
    async (req: Request, res: Response) => {
    try {
      const key = req.params.key as string;
      if (!key) return res.status(400).json({ success: false, error: "Invalid key" });
      await db.delete(platforms).where(eq(platforms.key, key));
      return res.json({ success: true });
    } catch (err) {
      console.error("Error in DELETE /api/admin/platforms/:key", err);
      return res.status(500).json({ success: false, error: "Failed to delete platform" });
    }
    },
  );

  // Admin notifications
  app.get(
    "/api/admin/notifications",
    requireAdmin,
    async (_req: Request, res: Response) => {
      try {
        const notifications = await storage.getAdminNotifications();
        return res.json({ success: true, data: notifications });
      } catch (err) {
        console.error("Error in GET /api/admin/notifications", err);
        return res
          .status(500)
          .json({ success: false, error: "Failed to load notifications" });
      }
    },
  );

  app.patch(
    "/api/admin/notifications/read-all",
    requireAdmin,
    async (_req: Request, res: Response) => {
      try {
        await storage.markAdminNotificationsRead();
        return res.json({ success: true });
      } catch (err) {
        console.error("Error in PATCH /api/admin/notifications/read-all", err);
        return res
          .status(500)
          .json({ success: false, error: "Failed to mark notifications as read" });
      }
    },
  );

  app.patch(
    "/api/admin/notifications/read-type/:type",
    requireAdmin,
    async (req: Request, res: Response) => {
      try {
        const typeParam = (req.params as { type?: string | string[] }).type;
        const type = Array.isArray(typeParam) ? typeParam[0] : typeParam;
        if (!type) {
          return res
            .status(400)
            .json({ success: false, error: "Invalid type" });
        }
        await storage.markAdminNotificationsByTypeRead(type);
        return res.json({ success: true });
      } catch (err) {
        console.error("Error in PATCH /api/admin/notifications/read-type/:type", err);
        return res
          .status(500)
          .json({ success: false, error: "Failed to mark notifications as read" });
      }
    },
  );

  app.patch(
    "/api/admin/notifications/:id/read",
    requireAdmin,
    async (req: Request, res: Response) => {
      const { id } = req.params;
      if (typeof id !== "string") return res.status(400).json({ success: false, error: "Invalid ID" });
      try {
        await storage.markAdminNotificationRead(id);
        return res.json({ success: true });
      } catch (err) {
        console.error("Error in PATCH /api/admin/notifications/:id/read", err);
        return res
          .status(500)
          .json({ success: false, error: "Failed to mark notification as read" });
      }
    },
  );

  // ── Contact Messages ─────────────────────────────────────
  app.get(
    "/api/admin/messages",
    requireAdmin,
    async (_req: Request, res: Response) => {
      try {
        const messages = await storage.getContactMessages();
        return res.json({ success: true, data: messages });
      } catch (err) {
        console.error("Error in GET /api/admin/messages", err);
        return res
          .status(500)
          .json({ success: false, error: "Failed to load messages" });
      }
    },
  );

  app.post(
    "/api/admin/messages/:id/reply",
    requireAdmin,
    async (req: Request, res: Response) => {
      try {
        const id = getQueryParam(req.params.id);
        if (!id) {
          return res.status(400).json({ success: false, error: "Message ID is required" });
        }
        const { html, to, subject } = req.body;
        if (!html || !to || !subject) {
          return res.status(400).json({ success: false, error: "Missing fields" });
        }

        await sendContactReplyEmail(to, subject, html);
        const updated = await storage.updateContactMessageStatus(id, "replied");

        // Optimistically delete the notification if it exists (for simpler UX)
        // This is handled via UI state effectively, but if needed we could also look it up and mark read.

        return res.json({ success: true, data: updated });
      } catch (err) {
        console.error("Error in POST /api/admin/messages/:id/reply", err);
        return res
          .status(500)
          .json({ success: false, error: "Failed to send reply" });
      }
    },
  );

  // ── Marketing Broadcast ──────────────────────────────────
  app.post(
    "/api/admin/marketing/broadcast",
    requireAdmin,
    async (req: Request, res: Response) => {
      try {
        const { subject, html, selectedEmails, sendToAll } = req.body as {
          subject?: string;
          html?: string;
          selectedEmails?: string[];
          sendToAll?: boolean;
        };

        if (!subject || !html) {
          return res
            .status(400)
            .json({ success: false, error: "Missing subject or html" });
        }

        let targetEmails: string[] = [];

        if (sendToAll) {
          const subscribers = await db.select().from(newsletterSubscribers);
          if (!subscribers.length) {
            return res
              .status(400)
              .json({ success: false, error: "No subscribers found" });
          }
          targetEmails = subscribers.map((s) => s.email);
        } else if (Array.isArray(selectedEmails)) {
          if (selectedEmails.length === 0) {
            return res.status(400).json({
              success: false,
              error: "No recipients selected",
            });
          }
          // Only send to the explicit selection
          targetEmails = selectedEmails;
        } else {
          // No explicit selection and no sendToAll flag: treat as invalid
          return res.status(400).json({
            success: false,
            error:
              "Invalid broadcast request. Provide selectedEmails or set sendToAll: true.",
          });
        }

        const result = await sendMarketingBroadcastEmail(
          targetEmails,
          subject,
          html,
        );

        if (result.failed > 0) {
          return res.status(502).json({
            success: false,
            error: "SMTP delivery failed for one or more batches",
            sent: result.sent,
            failed: result.failed,
            errors: result.errors,
          });
        }

        return res.json({
          success: true,
          sent: result.sent,
          failed: result.failed ?? 0,
        });
      } catch (err) {
        console.error("Error in POST /api/admin/marketing/broadcast", err);
        return res
          .status(500)
          .json({ success: false, error: "Failed to send broadcast" });
      }
    },
  );

  app.get(
    "/api/admin/newsletter/subscribers",
    requireAdmin,
    async (req: Request, res: Response) => {
      try {
        const subscribers = await storage.getNewsletterSubscribers();
        return res.json({ success: true, data: subscribers });
      } catch (err) {
        console.error("Error in GET /api/admin/newsletter/subscribers", err);
        return res
          .status(500)
          .json({ success: false, error: "Failed to load subscribers" });
      }
    },
  );

  app.get(
    "/api/admin/newsletter/export",
    requireAdmin,
    async (req: Request, res: Response) => {
      try {
        const subscribers = await storage.getNewsletterSubscribers();
        const csv = [
          "Email,Joined At",
          ...subscribers.map(s => `${s.email},${s.createdAt ? s.createdAt.toISOString() : ""}`)
        ].join("\n");

        res.setHeader("Content-Type", "text/csv");
        res.setHeader("Content-Disposition", "attachment; filename=subscribers.csv");
        return res.send(csv);
      } catch (err) {
        console.error("Error in GET /api/admin/newsletter/export", err);
        return res
          .status(500)
          .json({ success: false, error: "Failed to export subscribers" });
      }
    },
  );

  // ── Email Templates Management ──────────────────────────────────

  app.post(
    "/api/admin/templates/upload",
    requireAdmin,
    async (req: Request, res: Response) => {
      try {
        const { name, subject, html } = req.body;
        if (!name || !subject || !html) {
          return sendError(res, "Missing name, subject, or html", undefined, 400);
        }

        const template = await db.insert(emailTemplates).values({
          name: name.trim(),
          subject: subject.trim(),
          html: html.trim(),
          createdBy: req.user?.id || "unknown",
        }).returning();

        return res.json({ 
          success: true, 
          data: template[0],
          message: "Template uploaded successfully" 
        });
      } catch (err: any) {
        return handleApiError(res, err, "POST /api/admin/templates/upload");
      }
    },
  );

  app.get(
    "/api/admin/templates",
    requireAdmin,
    async (req: Request, res: Response) => {
      try {
        const templates = await db.select().from(emailTemplates).orderBy(emailTemplates.createdAt);
        return res.json({ 
          success: true, 
          data: templates 
        });
      } catch (err: any) {
        return handleApiError(res, err, "GET /api/admin/templates");
      }
    },
  );

  app.delete(
    "/api/admin/templates/:id",
    requireAdmin,
    async (req: Request, res: Response) => {
      try {
        const id = getQueryParam(req.params.id);
        if (!id) return sendError(res, "Invalid template ID", undefined, 400);

        await db.delete(emailTemplates).where(eq(emailTemplates.id, id));
        return res.json({ success: true, message: "Template deleted" });
      } catch (err: any) {
        return handleApiError(res, err, "DELETE /api/admin/templates/:id");
      }
    },
  );

  // ── Add Single Email ────────────────────────────────────
  app.post(
    "/api/admin/newsletter/add",
    requireAdmin,
    async (req: Request, res: Response) => {
      try {
        const { email } = req.body;
        if (!email || typeof email !== "string") {
          return sendError(res, "Invalid email", undefined, 400);
        }

        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email.trim())) {
          return sendError(res, "Invalid email format", undefined, 400);
        }

        await storage.subscribeToNewsletter(email.trim());
        return res.json({ success: true, message: "Email added successfully" });
      } catch (err: any) {
        return handleApiError(res, err, "POST /api/admin/newsletter/add");
      }
    },
  );

  // ── Import CSV Emails ───────────────────────────────────
  app.post(
    "/api/admin/newsletter/import",
    requireAdmin,
    async (req: Request, res: Response) => {
      try {
        const { emails } = req.body;
        if (!Array.isArray(emails)) {
          return sendError(res, "Invalid emails array", undefined, 400);
        }

        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        const validEmails = emails
          .filter((e): e is string => typeof e === "string")
          .map((e) => e.trim())
          .filter((e) => emailRegex.test(e));

        if (validEmails.length === 0) {
          return sendError(res, "No valid emails found", undefined, 400);
        }

        let addedCount = 0;
        for (const email of validEmails) {
          try {
            await storage.subscribeToNewsletter(email);
            addedCount++;
          } catch {
            // Skip duplicates
          }
        }

        return res.json({
          success: true,
          message: `Added ${addedCount} new emails`,
          added: addedCount,
          total: validEmails.length,
        });
      } catch (err: any) {
        return handleApiError(res, err, "POST /api/admin/newsletter/import");
      }
    },
  );

  // ── Delete Single Email ─────────────────────────────────
  app.delete(
    "/api/admin/newsletter/:email",
    requireAdmin,
    async (req: Request, res: Response) => {
      try {
        const email = getQueryParam(req.params.email);
        if (!email) {
          return sendError(res, "Invalid email", undefined, 400);
        }

        await storage.unsubscribeFromNewsletter(email);
        return res.json({ success: true, message: "Email removed successfully" });
      } catch (err: any) {
        return handleApiError(res, err, "DELETE /api/admin/newsletter/:email");
      }
    },
  );

  // ── Bulk Delete Emails ──────────────────────────────────
  app.post(
    "/api/admin/newsletter/bulk-delete",
    requireAdmin,
    async (req: Request, res: Response) => {
      try {
        const schema = z.object({ emails: z.array(z.string().email()).min(1) });
        const parsed = schema.safeParse(req.body);
        if (!parsed.success) {
          return sendError(res, "Invalid emails payload", undefined, 400);
        }

        const emails = Array.from(new Set(parsed.data.emails.map((e) => e.toLowerCase())));
        await db
          .delete(newsletterSubscribers)
          .where(inArray(newsletterSubscribers.email, emails));

        return res.json({ success: true, deleted: emails.length });
      } catch (err: any) {
        return handleApiError(res, err, "POST /api/admin/newsletter/bulk-delete");
      }
    },
  );

  // ── Delete All Emails ───────────────────────────────────
  app.delete(
    "/api/admin/newsletter/clear-all",
    requireAdmin,
    async (req: Request, res: Response) => {
      try {
        await storage.unsubscribeAllFromNewsletter();
        return res.json({ success: true, message: "All subscribers cleared" });
      } catch (err: any) {
        return handleApiError(res, err, "DELETE /api/admin/newsletter/clear-all");
      }
    },
  );

  // ── SMTP Test ──────────────────────────────────────────
  app.post(
    "/api/admin/test-email",
    requireAdmin,
    async (req: Request, res: Response) => {
      try {
        const { email } = req.body;
        const target = email || "upretynikesh021@gmail.com";
        
        const { sendInviteEmail } = await import("./email");
        await sendInviteEmail(target, "Test User", "123456", "System Admin (SMTP Test)");

        return res.json({ success: true, message: `Test email sent to ${target}` });
      } catch (err) {
        console.error("Error in POST /api/admin/test-email", err);
        return res
          .status(500)
          .json({ success: false, error: "Failed to send test email. Check SMTP logs." });
      }
    },
  );

  app.post(
    "/api/admin/marketing/test-broadcast",
    requireAdmin,
    async (req: Request, res: Response) => {
      try {
        const { subject, html } = req.body;
        const user = req.user as any;
        const target = user?.email || "upretynikesh021@gmail.com";

        if (!subject || !html) {
          return sendError(res, "Subject and HTML are required", undefined, 400);
        }

        const { sendContactReplyEmail } = await import("./email");
        await sendContactReplyEmail(target, `[TEST] ${subject}`, html);

        return res.json({ success: true, message: `Test broadcast sent to ${target}` });
      } catch (err) {
        console.error("Error in POST /api/admin/marketing/test-broadcast", err);
        return res.status(500).json({ success: false, error: "Failed to send test broadcast" });
      }
    }
  );

  // ── Bill Routes ─────────────────────────────────────────

  // GET /api/admin/bills — list all bills
  app.get("/api/admin/bills", requireAdmin, async (_req: Request, res: Response) => {
    try {
      const allBills = await db
        .select()
        .from(bills)
        .orderBy(desc(bills.createdAt));
      res.json({ success: true, data: allBills });
    } catch (err) {
      console.error("Error in GET /api/admin/bills", err);
      res.status(500).json({ success: false, error: "Failed to load bills" });
    }
  });

  // GET /api/admin/bills/export — export bills to CSV
  app.get(
    "/api/admin/bills/export",
    requireAdmin,
    async (_req: Request, res: Response) => {
      try {
        const bills = await storage.getBills();
        const rows: string[] = [];
        
        rows.push("Bill Number,Date,Customer Name,Phone,Subtotal,Discount,Total,Payment Method,Processed By,Status,Type");
        
        for (const bill of bills) {
          const date = bill.createdAt ? new Date(bill.createdAt).toISOString().split("T")[0] : "";
          
          rows.push([
            bill.billNumber,
            date,
            `"${bill.customerName}"`,
            bill.customerPhone || "N/A",
            bill.subtotal.toString(),
            (bill.discountAmount ?? 0).toString(),
            bill.totalAmount.toString(),
            bill.paymentMethod,
            `"${bill.processedBy}"`,
            bill.status,
            bill.billType
          ].join(","));
        }
        
        const csv = rows.join("\n");
        res.setHeader("Content-Type", "text/csv");
        res.setHeader("Content-Disposition", 'attachment; filename="pos-bills.csv"');
        return res.send(csv);
      } catch (err) {
        console.error("Error in GET /api/admin/bills/export", err);
        return res.status(500).json({ success: false, error: "Failed to export bills" });
      }
    }
  );

  // GET /api/admin/bills/:id — single bill
  app.get("/api/admin/bills/:id", requireAdmin, async (req: Request, res: Response) => {
    try {
      const [bill] = await db
        .select()
        .from(bills)
        .where(eq(bills.id, req.params.id as string))
        .limit(1);
      if (!bill) return res.status(404).json({ success: false, error: "Bill not found" });
      res.json({ success: true, data: bill });
    } catch (err) {
      console.error("Error in GET /api/admin/bills/:id", err);
      res.status(500).json({ success: false, error: "Failed to load bill" });
    }
  });

  // GET /api/admin/bills/by-order/:orderId — get bill for a specific order
  app.get("/api/admin/bills/by-order/:orderId", requireAdmin, async (req: Request, res: Response) => {
    try {
      const [bill] = await db
        .select()
        .from(bills)
        .where(eq(bills.orderId, req.params.orderId as string))
        .limit(1);
      res.json({ success: true, data: bill ?? null });
    } catch (err) {
      console.error("Error in GET /api/admin/bills/by-order/:orderId", err);
      res.status(500).json({ success: false, error: "Failed to load bill" });
    }
  });

  // POST /api/admin/bills/pos — create bill directly from POS (no order record)
  app.post("/api/admin/bills/pos", requireAdmin, async (req: Request, res: Response) => {
    try {
      const schema = z.object({
        customerName: z.string().optional(),
        customerEmail: z.string().email().optional().nullable(),
        customerPhone: z.string().optional().nullable(),
        items: z.array(z.any()).min(1),
        source: z.string().optional(),
        paymentMethod: z.string().min(1),
        isPaid: z.boolean().optional(),
        deliveryRequired: z.boolean().optional(),
        deliveryProvider: z.string().optional().nullable(),
        deliveryLocation: z.string().optional().nullable(),
        deliveryAddress: z.string().optional().nullable(),
        cashReceived: z.number().optional().nullable(),
        discountAmount: z.number().optional(),
        notes: z.string().optional(),
      });

      const parsed = schema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ success: false, error: "Invalid payload" });
      }

      const {
        customerName,
        customerEmail,
        customerPhone,
        items,
        source,
        paymentMethod,
        isPaid,
        deliveryRequired,
        deliveryProvider,
        deliveryLocation,
        deliveryAddress,
        cashReceived,
        discountAmount,
        notes,
      } = parsed.data;

      const normalizedSource = (source || "pos").toLowerCase();
      const isSocialSource = !["pos", "website", "store"].includes(normalizedSource);

      if (isSocialSource) {
        if (!customerName?.trim() || !customerPhone?.trim() || !deliveryProvider?.trim() || !deliveryLocation?.trim()) {
          return res.status(400).json({
            success: false,
            error: "Customer name, phone, delivery partner and delivery location are required for social orders.",
          });
        }
      }

      const subtotal = items.reduce((s: number, i: any) => s + i.lineTotal, 0);
      const taxAmount = Math.round(subtotal * 0.13);
      const discount = discountAmount ?? 0;
      const total = subtotal + taxAmount - discount;
      const change = paymentMethod === "cash" ? ((cashReceived ?? 0) - total) : 0;

      const billNumber = await generateBillNumber();
      const user = req.user as any;
      const effectiveCustomerName = customerName || "Walk-in Customer";
      const effectiveCustomerEmail =
        customerEmail?.trim().toLowerCase() ||
        `pos-${Date.now()}-${Math.round(Math.random() * 1_000_000)}@local.rare`;

      await storage.upsertCustomerFromOrder(
        effectiveCustomerEmail,
        effectiveCustomerName.split(" ").slice(0, 1).join(" ") || "Walk-in",
        effectiveCustomerName.split(" ").slice(1).join(" ") || "Customer",
        customerPhone || null,
      );

      const createdOrder = await storage.createOrder({
        email: effectiveCustomerEmail,
        fullName: effectiveCustomerName,
        addressLine1: deliveryAddress || deliveryLocation || "POS Counter",
        addressLine2: null,
        city: deliveryLocation || "POS",
        region: deliveryLocation || "POS",
        postalCode: "00000",
        country: "Nepal",
        total,
        paymentMethod,
        source: normalizedSource,
        deliveryRequired: isSocialSource ? true : (deliveryRequired ?? false),
        deliveryProvider: deliveryProvider ?? null,
        deliveryLocation: deliveryLocation ?? null,
        deliveryAddress: deliveryAddress ?? null,
        items: items.map((item: any) => ({
          productId: String(item.productId),
          quantity: Number(item.quantity ?? 0),
          unitPrice: Number(item.unitPrice ?? 0),
        })),
      });

      // Keep POS-created orders visually distinguishable in Orders page.
      await db
        .update(orders)
        .set({ status: "pos" })
        .where(eq(orders.id, createdOrder.id));

      const [bill] = await db.insert(bills).values({
        id: crypto.randomUUID(),
        billNumber,
        orderId: createdOrder.id,
        customerName: effectiveCustomerName,
        customerEmail: customerEmail || null,
        customerPhone: customerPhone || null,
        items,
        subtotal: String(subtotal),
        taxRate: "13",
        taxAmount: String(taxAmount),
        discountAmount: String(discount),
        totalAmount: String(total),
        paymentMethod,
        source: normalizedSource,
        isPaid: isPaid ?? true,
        deliveryRequired: isSocialSource ? true : (deliveryRequired ?? false),
        deliveryProvider: deliveryProvider ?? null,
        deliveryAddress: deliveryLocation
          ? [deliveryLocation, deliveryAddress].filter(Boolean).join(" — ")
          : (deliveryAddress ?? null),
        cashReceived: cashReceived ? String(cashReceived) : null,
        changeGiven: change > 0 ? String(change) : null,
        processedBy: user?.name ?? user?.email ?? "Admin",
        processedById: user?.id ?? null,
        notes: notes ?? null,
        billType: "pos",
        status: "issued",
      }).returning();

      // Deduct inventory
      for (const item of items) {
        if (item.productId) {
          await db
            .update(products)
            .set({ stock: sql`${products.stock} - ${item.quantity}` })
            .where(eq(products.id, item.productId));
        }
      }

      res.json({ success: true, data: bill });
    } catch (err) {
      console.error("Error in POST /api/admin/bills/pos", err);
      res.status(500).json({ success: false, error: "Failed to create POS bill" });
    }
  });

  // PUT /api/admin/bills/:id/void — void a bill
  app.put("/api/admin/bills/:id/void", requireAdmin, async (req: Request, res: Response) => {
    try {
      const [updated] = await db
        .update(bills)
        .set({ status: "void" })
        .where(eq(bills.id, req.params.id as string))
        .returning();
      if (!updated) return res.status(404).json({ success: false, error: "Bill not found" });
      res.json({ success: true, data: updated });
    } catch (err) {
      console.error("Error in PUT /api/admin/bills/:id/void", err);
      res.status(500).json({ success: false, error: "Failed to void bill" });
    }
  });

  // ── POS Session Routes ─────────────────────────────────

  app.post("/api/admin/pos/session/open", requireAdmin, async (req: Request, res: Response) => {
    try {
      const { openingCash } = req.body;
      const user = req.user as any;
      const [session] = await db.insert(posSessions).values({
        id: crypto.randomUUID(),
        openedBy: user?.name ?? user?.email ?? "Admin",
        openingCash: String(openingCash ?? 0),
        status: "open",
      }).returning();
      res.json({ success: true, data: session });
    } catch (err) {
      console.error("Error opening POS session", err);
      res.status(500).json({ success: false, error: "Failed to open session" });
    }
  });

  app.put("/api/admin/pos/session/:id/close", requireAdmin, async (req: Request, res: Response) => {
    try {
      const { closingCash, notes, openedAt } = req.body;

      // Calculate totals from POS bills created during this session
      const sessionStart = new Date(openedAt);
      const sessionBills = await db
        .select()
        .from(bills)
        .where(
          and(
            eq(bills.billType, "pos"),
            eq(bills.status, "issued"),
            gte(bills.createdAt, sessionStart)
          )
        );

      const totalSales = sessionBills.reduce((s, b) => s + Number(b.totalAmount), 0);
      const cashSales = sessionBills
        .filter(b => b.paymentMethod === "cash")
        .reduce((s, b) => s + Number(b.totalAmount), 0);
      const digitalSales = totalSales - cashSales;

      const [session] = await db
        .update(posSessions)
        .set({
          closedAt: new Date(),
          closingCash: String(closingCash),
          totalSales: String(totalSales),
          totalOrders: sessionBills.length,
          totalCashSales: String(cashSales),
          totalDigitalSales: String(digitalSales),
          notes,
          status: "closed",
        })
        .where(eq(posSessions.id, req.params.id as string))
        .returning();
      res.json({ success: true, data: session });
    } catch (err) {
      console.error("Error closing POS session", err);
      res.status(500).json({ success: false, error: "Failed to close session" });
    }
  });

  app.get("/api/admin/pos/session/today", requireAdmin, async (_req: Request, res: Response) => {
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const [session] = await db
        .select()
        .from(posSessions)
        .where(
          and(
            eq(posSessions.status, "open"),
            gte(posSessions.createdAt, today)
          )
        )
        .limit(1);
      res.json({ success: true, data: session ?? null });
    } catch (err) {
      console.error("Error fetching today's POS session", err);
      res.status(500).json({ success: false, error: "Failed to fetch session" });
    }
  });

  // Security Logs
  app.get(
    "/api/admin/logs/recent",
    requireAdmin,
    async (_req: Request, res: Response) => {
      try {
        const logs = await storage.getSecurityLogs(50);
        return res.json({ success: true, data: logs });
      } catch (err) {
        console.error("Error in GET /api/admin/logs/recent", err);
        return res.status(500).json({ success: false, error: "Failed to load logs" });
      }
    },
  );

  // ── Promo Code Routes ───────────────────────────────────
  app.get("/api/admin/promo-codes", requireAdmin, async (_req: Request, res: Response) => {
    try {
      const items = await storage.getPromoCodes();
      res.json({ success: true, data: items });
    } catch (err) {
      handleApiError(res, err, "GET /api/admin/promo-codes");
    }
  });

  const adminPromoCodeUpsertSchema = z.object({
    code: z.string().min(3).max(50),
    // Backwards compatible inputs
    discountPct: z.coerce.number().int().min(1).max(100).optional(),
    discount: z.coerce.number().int().min(1).max(100).optional(),
    type: z.string().optional(),
    maxUses: z.coerce.number().int().min(1).optional(),
    active: z.boolean().optional(),
    applicableProductIds: z.array(z.coerce.number().int()).optional().nullable(),
    expiresAt: z.string().optional().nullable(),
    durationPreset: z.string().optional().nullable(), // 'none' | '1day' | '1week' | 'custom'
  });

  function computePromoExpiry(input: { expiresAt?: string | null; durationPreset?: string | null }) {
    const now = new Date();

    const preset = input.durationPreset ?? null;
    if (!preset || preset === "none") return { expiresAt: null as Date | null, durationPreset: null as string | null };

    if (preset === "1day") {
      return {
        expiresAt: new Date(now.getTime() + 24 * 60 * 60 * 1000),
        durationPreset: preset,
      };
    }

    if (preset === "1week") {
      return {
        expiresAt: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000),
        durationPreset: preset,
      };
    }

    if (preset === "custom") {
      if (!input.expiresAt) throw new Error("Custom expiry requires expiresAt");
      return {
        expiresAt: new Date(input.expiresAt),
        durationPreset: preset,
      };
    }

    // Unknown preset: fall back to explicit expiresAt if provided
    if (input.expiresAt) {
      return {
        expiresAt: new Date(input.expiresAt),
        durationPreset: "custom",
      };
    }

    return { expiresAt: null as Date | null, durationPreset: null as string | null };
  }

  app.post("/api/admin/promo-codes", requireAdmin, async (req: Request, res: Response) => {
    try {
      const parsed = adminPromoCodeUpsertSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ success: false, error: "Invalid promo code payload" });
      }

      const {
        code,
        discountPct,
        discount,
        maxUses,
        active,
        applicableProductIds,
        expiresAt,
        durationPreset,
      } = parsed.data;

      const resolvedDiscountPct = discountPct ?? discount;
      if (!resolvedDiscountPct || resolvedDiscountPct < 1) {
        return res.status(400).json({ success: false, error: "Discount is required" });
      }

      const { expiresAt: resolvedExpiresAt, durationPreset: resolvedDurationPreset } = computePromoExpiry({
        expiresAt,
        durationPreset,
      });

      const resolvedApplicableProductIds =
        applicableProductIds && applicableProductIds.length > 0 ? applicableProductIds : null;

      const item = await storage.createPromoCode({
        code: code.toUpperCase(),
        discountPct: resolvedDiscountPct,
        ...(typeof maxUses === "number" ? { maxUses } : {}),
        ...(typeof active === "boolean" ? { active } : {}),
        expiresAt: resolvedExpiresAt,
        applicableProductIds: resolvedApplicableProductIds,
        durationPreset: resolvedDurationPreset,
      });

      res.status(201).json({ success: true, data: item });
    } catch (err) {
      handleApiError(res, err, "POST /api/admin/promo-codes");
    }
  });

  async function updatePromoCodeById(id: string, payload: unknown, res: Response) {
    const parsed = adminPromoCodeUpsertSchema.safeParse(payload);
    if (!parsed.success) {
      return res.status(400).json({ success: false, error: "Invalid promo code payload" });
    }

    const {
      code,
      discountPct,
      discount,
      maxUses,
      active,
      applicableProductIds,
      expiresAt,
      durationPreset,
    } = parsed.data;

    const resolvedDiscountPct = discountPct ?? discount;
    if (!resolvedDiscountPct || resolvedDiscountPct < 1) {
      return res.status(400).json({ success: false, error: "Discount is required" });
    }

    const { expiresAt: resolvedExpiresAt, durationPreset: resolvedDurationPreset } = computePromoExpiry({
      expiresAt,
      durationPreset,
    });

    const resolvedApplicableProductIds =
      applicableProductIds && applicableProductIds.length > 0 ? applicableProductIds : null;

    const updated = await storage.updatePromoCode(id, {
      code: code.toUpperCase(),
      discountPct: resolvedDiscountPct,
      ...(typeof maxUses === "number" ? { maxUses } : {}),
      ...(typeof active === "boolean" ? { active } : {}),
      expiresAt: resolvedExpiresAt,
      applicableProductIds: resolvedApplicableProductIds,
      durationPreset: resolvedDurationPreset,
    });

    return res.json({ success: true, data: updated });
  }

  app.put("/api/admin/promo-codes/:id", requireAdmin, async (req: Request, res: Response) => {
    try {
      const id = getQueryParam(req.params.id);
      if (!id) return sendError(res, "Invalid ID", undefined, 400);
      return updatePromoCodeById(id, req.body, res);
    } catch (err) {
      handleApiError(res, err, "PUT /api/admin/promo-codes/:id");
    }
  });

  // Alias for spec compatibility
  app.patch("/api/admin/promo-codes/:id", requireAdmin, async (req: Request, res: Response) => {
    try {
      const id = getQueryParam(req.params.id);
      if (!id) return sendError(res, "Invalid ID", undefined, 400);
      return updatePromoCodeById(id, req.body, res);
    } catch (err) {
      handleApiError(res, err, "PATCH /api/admin/promo-codes/:id");
    }
  });

  app.delete("/api/admin/promo-codes/:id", requireAdmin, async (req: Request, res: Response) => {
    try {
      const id = getQueryParam(req.params.id);
      if (!id) return sendError(res, "Invalid ID", undefined, 400);
      await storage.deletePromoCode(id);
      res.json({ success: true });
    } catch (err) {
      handleApiError(res, err, "DELETE /api/admin/promo-codes/:id");
    }
  });

  app.get("/api/promo-codes/validate/:code", async (req: Request, res: Response) => {
    try {
      const code = getQueryParam(req.params.code);
      if (!code) return sendError(res, "Invalid code", undefined, 400);
      const promo = await storage.getPromoCodeByCode(code);
      if (!promo || !promo.active) {
        return res.status(404).json({ success: false, error: "Invalid promo code" });
      }
      if (promo.expiresAt && new Date(promo.expiresAt) < new Date()) {
        return res.status(400).json({ success: false, error: "Promo code expired" });
      }
      if (promo.usedCount >= promo.maxUses) {
        return res.status(400).json({ success: false, error: "Promo code usage limit reached" });
      }
      res.json({ success: true, data: promo });
    } catch (err) {
      handleApiError(res, err, "GET /api/promo-codes/validate");
    }
  });

  // Checkout validation (used for product-restricted promo codes)
  app.post("/api/promo/validate", async (req: Request, res: Response) => {
    try {
      const schema = z.object({
        code: z.string().min(3).max(50),
        items: z
          .array(
            z.object({
              productId: z.union([z.coerce.number().int(), z.string().min(1)]),
            }),
          )
          .min(1),
      });

      const parsed = schema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ valid: false, reason: "Invalid payload" });
      }

      const now = new Date();
      const promo = await storage.getPromoCodeByCode(parsed.data.code);

      if (!promo || !promo.active) {
        return res.status(200).json({ valid: false, reason: "Invalid promo code" });
      }

      if (promo.expiresAt && new Date(promo.expiresAt) < now) {
        return res.status(200).json({ valid: false, reason: "Promo code has expired" });
      }

      if (promo.usedCount >= promo.maxUses) {
        return res.status(200).json({ valid: false, reason: "Promo code usage limit reached" });
      }

      if (promo.applicableProductIds) {
        const cartProductIds = new Set(
          parsed.data.items
            .map((it) => Number(it.productId))
            .filter((n) => Number.isFinite(n)),
        );

        const matches = promo.applicableProductIds.some((pid: number) =>
          cartProductIds.has(pid),
        );

        if (!matches) {
          return res
            .status(200)
            .json({
              valid: false,
              reason: "This promo code is not valid for items in your cart",
            });
        }
      }

      return res.status(200).json({
        valid: true,
        data: {
          id: promo.id,
          code: promo.code,
          discountPct: promo.discountPct,
        },
      });
    } catch (err) {
      handleApiError(res, err, "POST /api/promo/validate");
    }
  });

  // ── Media Discovery (Admin Only) ──────────────────────────────────
  app.get("/api/admin/images", requireAdmin, async (req: Request, res: Response) => {
    try {
      const category = getQueryParam(req.query.category);
      const provider = getQueryParam(req.query.provider);
      const limit = Math.min(200, Math.max(1, Number(getQueryParam(req.query.limit) ?? "60") || 60));
      const offset = Math.max(0, Number(getQueryParam(req.query.offset) ?? "0") || 0);

      const where = and(
        category ? eq(mediaAssets.category, category) : sql`true`,
        provider ? eq(mediaAssets.provider, provider) : sql`true`,
      );

      const rows = await db
        .select()
        .from(mediaAssets)
        .where(where)
        .orderBy(desc(mediaAssets.createdAt))
        .limit(limit)
        .offset(offset);

      return res.json({ success: true, data: rows });
    } catch (err) {
      handleApiError(res, err, "GET /api/admin/images");
    }
  });

  // ── Dev / local image library (no upload) ─────────────────────────────
  // Lists images currently present in the server's local uploads directory.
  // Useful when uploads are not persistent on Railway free plans.
  app.get("/api/admin/storefront-image-library", requireAdmin, async (_req: Request, res: Response) => {
    try {
      const images = listImagesInUploadsDir({ maxDepth: 5, maxFiles: 800 });
      // Return only a clean subset for thumbnails
      return res.json({
        success: true,
        data: images.map((img) => ({
          filename: img.filename,
          url: img.url,
          relPath: img.relPath,
        })),
      });
    } catch (err) {
      handleApiError(res, err, "GET /api/admin/storefront-image-library");
    }
  });

  app.delete("/api/admin/storefront-image-library", requireAdmin, async (req: Request, res: Response) => {
    try {
      const relPath = typeof req.body?.relPath === "string" ? req.body.relPath : "";
      if (!relPath) {
        return sendError(res, "Missing relPath", undefined, 400);
      }

      const normalizedRelPath = relPath.replace(/^\/+/, "");
      const path = await import("path");
      const fs = await import("fs");
      const resolvedUploadsDir = path.resolve(UPLOADS_DIR);
      const targetPath = path.resolve(UPLOADS_DIR, normalizedRelPath);

      if (!targetPath.startsWith(resolvedUploadsDir)) {
        return sendError(res, "Invalid image path", undefined, 400);
      }

      if (!fs.existsSync(targetPath)) {
        return res.status(404).json({ success: false, error: "Image not found" });
      }

      fs.unlinkSync(targetPath);
      return res.json({ success: true });
    } catch (err) {
      handleApiError(res, err, "DELETE /api/admin/storefront-image-library");
    }
  });

  app.post(
    "/api/admin/images/upload",
    requireAdmin,
    memoryUpload.array("images", 10),
    async (req: Request, res: Response) => {
      try {
        const category = String((req.body as any)?.category || "product");
        const provider = String((req.body as any)?.provider || "local");

        const files = (req as any).files as Express.Multer.File[] | undefined;
        if (!files || files.length === 0) {
          return sendError(res, "Missing images", undefined, 400);
        }

        const results = [];

        for (const file of files) {
          if (provider === "local") {
            const asset = await processAndStoreImage(
              file.buffer,
              category,
              file.originalname || "image.jpg"
            );
            results.push(asset);
          } else {
            const uploaded = await uploadMediaToCloudinary(file.buffer, category);
            const [row] = await db
              .insert(mediaAssets)
              .values({
                url: uploaded.url,
                provider: "cloudinary",
                category,
                publicId: uploaded.publicId,
                filename: file.originalname ?? null,
                bytes: file.size ?? null,
              })
              .returning();
            results.push(row);
          }
        }

        return res.json({ success: true, data: results });
      } catch (err) {
        handleApiError(res, err, "POST /api/admin/images/upload");
      }
    },
  );

  app.delete("/api/admin/images/:id", requireAdmin, async (req: Request, res: Response) => {
    try {
      const id = getQueryParam(req.params.id);
      if (!id) return sendError(res, "Invalid id", undefined, 400);

      const [asset] = await db.select().from(mediaAssets).where(eq(mediaAssets.id, id)).limit(1);
      if (!asset) return res.status(404).json({ success: false, error: "Not found" });

      if (asset.provider === "cloudinary" && asset.publicId) {
        await deleteFromCloudinary(asset.publicId);
      } else if (asset.provider === "local") {
        await deleteLocalImage(asset.url);
      }

      await db.delete(mediaAssets).where(eq(mediaAssets.id, id));
      return res.json({ success: true });
    } catch (err) {
      handleApiError(res, err, "DELETE /api/admin/images/:id");
    }
  });

  app.get("/api/admin/media", requireAdmin, async (_req, res) => {
    try {
      const allSiteAssets = await db.select({ imageUrl: siteAssets.imageUrl }).from(siteAssets);
      const allProducts = await db.select({ 
        imageUrl: products.imageUrl,
        galleryUrls: products.galleryUrls 
      }).from(products);

      const urls = new Set<string>();

      allSiteAssets.forEach(a => {
        if (a.imageUrl) urls.add(a.imageUrl);
      });

      allProducts.forEach(p => {
        if (p.imageUrl) urls.add(p.imageUrl);
        if (p.galleryUrls) {
          try {
            const gallery = JSON.parse(p.galleryUrls);
            if (Array.isArray(gallery)) {
              gallery.forEach((u: any) => {
                if (typeof u === "string") urls.add(u);
              });
            }
          } catch (e) {
            // Skip invalid JSON
          }
        }
      });

      // Also include some known static defaults if needed
      const staticPresets = [
        "/images/hero_premium_1.webp",
        "/images/hero_premium_2.webp",
        "/images/feature_premium_1.webp",
        "/images/landingpage4.webp",
        "/images/newcollection.jpeg",
        "/images/landingpage3.webp",
      ];
      staticPresets.forEach(u => urls.add(u));

      res.json({ success: true, data: Array.from(urls) });
    } catch (err) {
      handleApiError(res, err, "GET /api/admin/media");
    }
  });

  // ── Seed preset landing-page images (one-time) ─────────────────────
  async function seedSiteAssetsIfEmpty() {
    try {
      const existing = await db
        .select({ id: siteAssets.id })
        .from(siteAssets)
        .limit(1);

      if (existing.length > 0) return; // Already seeded

      const presets: {
        section: string;
        imageUrl: string;
        altText: string;
        sortOrder: number;
      }[] = [
        // Hero banners
        { section: "hero", imageUrl: "/images/hero_premium_1.webp", altText: "Rare Atelier hero banner 1", sortOrder: 0 },
        { section: "hero", imageUrl: "/images/hero_premium_2.webp", altText: "Rare Atelier hero banner 2", sortOrder: 1 },
        // Featured collection
        { section: "featured_collection", imageUrl: "/images/feature_premium_1.webp", altText: "Featured collection lifestyle", sortOrder: 0 },
        { section: "featured_collection", imageUrl: "/images/landingpage4.webp", altText: "Featured collection campaign", sortOrder: 1 },
        // New collection / campaign banner
        { section: "new_collection", imageUrl: "/images/newcollection.jpeg", altText: "New collection showcase", sortOrder: 0 },
        { section: "new_collection", imageUrl: "/images/landingpage3.webp", altText: "Campaign story banner", sortOrder: 1 },
      ];

      await db.insert(siteAssets).values(
        presets.map((p) => ({
          section: p.section,
          imageUrl: p.imageUrl,
          cloudinaryPublicId: "", // Local static file, no Cloudinary ID
          altText: p.altText,
          sortOrder: p.sortOrder,
          active: true,
        })),
      );

      console.log(`[Seed] Inserted ${presets.length} preset landing-page images`);
    } catch (err) {
      console.error("[Seed] Failed to seed site assets:", err);
    }
  }

  await seedSiteAssetsIfEmpty();

  return httpServer;
}
