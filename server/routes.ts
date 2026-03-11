import type { Express, Request, Response, NextFunction } from "express";
import { type Server } from "http";
import path from "path";
import fs from "fs";
import { storage } from "./storage";
import { passport } from "./auth";
import sharp from "sharp";
import { z } from "zod";

import { requireAdmin } from "./middleware/requireAdmin";
import { requireAuth } from "./middleware/requireAuth";
import { validateRequest } from "./middleware/validateRequest";
import { rateLimit } from "./middleware/security";
import { sendOTPEmail,  sendInviteEmail,
  sendContactReplyEmail,
  sendMarketingBroadcastEmail,
  sendNewsletterWelcomeEmail,
} from "./email";
import { handleApiError, sendError, getQueryParam } from "./errorHandler";
import { generateBillFromOrder, generateBillNumber } from "./services/billService";
import {
  users,
  customers,
  orders,
  insertCustomerSchema,
  insertOrderSchema,
  insertProductSchema,
  products,
  insertNewsletterSubscriberSchema,
  newsletterSubscribers,
  bills,
  posSessions,
  insertProductAttributeSchema,
  Product,
  adminNotifications,
  insertAdminNotificationSchema,
} from "../shared/schema";
import { eq, desc, sum, sql, and, gte, lte } from "drizzle-orm";
import { db } from "./db";

const UPLOADS_DIR = path.join(process.cwd(), "uploads");
const PAYMENT_PROOFS_DIR = path.join(UPLOADS_DIR, "payment-proofs");
const PRODUCTS_UPLOADS_DIR = path.join(process.cwd(), "uploads", "products");

function ensureUploadsDir() {
  if (!fs.existsSync(UPLOADS_DIR)) {
    fs.mkdirSync(UPLOADS_DIR, { recursive: true });
  }
}
function ensureProductUploadsDir() {
  if (!fs.existsSync(PRODUCTS_UPLOADS_DIR)) {
    fs.mkdirSync(PRODUCTS_UPLOADS_DIR, { recursive: true });
  }
}

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
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

  const loginSchema = z.object({
    email: z.string().email(),
    password: z.string().min(1),
  });

  app.post(
    "/api/auth/login",
    rateLimit(),
    (req: Request, res: Response, next: NextFunction) => {
      const parsed = loginSchema.safeParse(req.body);
      if (!parsed.success) {
        return res
          .status(400)
          .json({ success: false, error: "Invalid request body" });
      }
      passport.authenticate("local", (err: any, user: Express.User | false) => {
        if (err) {
          return next(err);
        }
        if (!user) {
          return res.status(401).json({
            success: false,
            error: "Invalid email or password",
          });
        }
        (async () => {
          const fullUser = await storage.getUserById(user.id);
          if (!fullUser || fullUser.status === "suspended") {
            return res.status(403).json({
              success: false,
              error: "Account is not active",
            });
          }

          const twoFactorEnabled = !!fullUser.twoFactorEnabled;

          if (twoFactorEnabled) {
            // Create OTP entry and send email, but do not create a session yet.
            const code = Math.floor(100000 + Math.random() * 900000)
              .toString()
              .slice(0, 6);
            const tempToken = crypto.randomUUID();
            const expiresMinutes = Number(
              process.env.OTP_EXPIRY_MINUTES ?? "10",
            );
            const expiresAt = new Date(
              Date.now() + expiresMinutes * 60 * 1000,
            );

            await storage.createOtpToken({
              id: tempToken,
              userId: fullUser.id,
              token: code,
              expiresAt,
            });

            await sendOTPEmail(fullUser.username, code, fullUser.username);

            return res.status(200).json({
              success: true,
              requires2FA: true,
              tempToken,
              code, // Temporary: expose code since SMTP is down
            });
          }

          // No 2FA: create session as usual
          req.logIn(
            {
              ...user,
              twoFactorEnabled: false,
            },
            async (loginErr) => {
              if (loginErr) {
                return next(loginErr);
              }

              await storage.updateLastLoginAt(fullUser.id);

              return res.status(200).json({
                success: true,
                data: {
                  id: user.id,
                  email: user.email,
                  name: user.name,
                  role: user.role,
                  twoFactorEnabled: false,
                },
              });
            },
          );
        })().catch((error) => next(error));
      })(req, res, next);
    },
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
      return res
        .status(401)
        .json({ success: false, error: "Not authenticated" });
    }
    return res.status(200).json({
      success: true,
      data: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        twoFactorEnabled: !!user.twoFactorEnabled,
      },
    });
  });

  const verify2FASchema = z.object({
    tempToken: z.string().min(1),
    code: z.string().min(4).max(6),
  });

  app.post(
    "/api/auth/verify-2fa",
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const parsed = verify2FASchema.safeParse(req.body);
        if (!parsed.success) {
          return res
            .status(400)
            .json({ success: false, error: "Invalid request body" });
        }

        const { tempToken, code } = parsed.data;
        const otp = await storage.consumeOtpToken(tempToken, code);
        if (!otp) {
          return res
            .status(400)
            .json({ success: false, error: "Invalid or expired code" });
        }

        const fullUser = await storage.getUserById(otp.userId);
        if (!fullUser || fullUser.status === "suspended") {
          return res
            .status(403)
            .json({ success: false, error: "Account is not active" });
        }

        const expressUser: Express.User = {
          id: fullUser.id,
          email: fullUser.username,
          role: fullUser.role,
          name: fullUser.username,
          twoFactorEnabled: !!fullUser.twoFactorEnabled,
          status: fullUser.status,
        };

        req.logIn(expressUser, async (loginErr) => {
          if (loginErr) {
            return next(loginErr);
          }

          await storage.updateLastLoginAt(fullUser.id);

          return res.status(200).json({
            success: true,
            data: {
              id: expressUser.id,
              email: expressUser.email,
              name: expressUser.name,
              role: expressUser.role,
              twoFactorEnabled: !!expressUser.twoFactorEnabled,
            },
          });
        });
      } catch (err) {
        return next(err);
      }
    },
  );

  const resendOtpSchema = z.object({
    tempToken: z.string().min(1),
  });

  app.post(
    "/api/auth/resend-otp",
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
  app.post("/api/contact", async (req: Request, res: Response) => {
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

      // Create admin notification
      await storage.createAdminNotification({
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
  app.post("/api/newsletter/subscribe", async (req: Request, res: Response) => {
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
    locationCoordinates: z.string().optional(),
  });

  const createOrderSchema = z.object({
    items: z.array(orderItemSchema).min(1),
    shipping: shippingSchema,
    paymentMethod: z.string().min(1),
  });

  app.post("/api/orders", async (req: Request, res: Response) => {
    try {
      const parsed = createOrderSchema.safeParse(req.body);
      if (!parsed.success) {
        return handleApiError(res, parsed.error, "orders/create", 400);
      }

      const { items, shipping } = parsed.data;

      const orderSubtotal = items.reduce(
        (acc, item) => acc + item.priceAtTime * item.quantity,
        0,
      );
      const orderTax = Number((orderSubtotal * 0.15).toFixed(2));
      const orderTotal = Number((orderSubtotal + orderTax).toFixed(2));

      const now = new Date();
      const year = now.getFullYear();
      const sequence = Math.floor(now.getTime() / 1000) % 10000;
      const orderNumber = `UX-${year}-${sequence.toString().padStart(4, "0")}`;

      await storage.upsertCustomerFromOrder(
        shipping.email,
        shipping.firstName,
        shipping.lastName,
      );

      const order = await storage.createOrder({
        email: shipping.email,
        fullName: `${shipping.firstName} ${shipping.lastName}`,
        addressLine1: shipping.address,
        addressLine2: undefined,
        city: shipping.city,
        region: "", // state removed
        locationCoordinates: (shipping.locationCoordinates as string) || undefined,
        postalCode: shipping.zip,
        country: shipping.country,
        total: orderTotal,
        paymentMethod: parsed.data.paymentMethod,
        items: items.map((item) => ({
          productId: item.productId,
          quantity: item.quantity,
          unitPrice: item.priceAtTime,
        })),
      });

      const fullOrder = await storage.getOrderById(order.id);

      return res.status(201).json({
        success: true,
        data: {
          orderNumber,
          subtotal: orderSubtotal,
          tax: orderTax,
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
        const buffer = Buffer.from(
          match ? match[2] : base64,
          "base64",
        );
        ensureUploadsDir();
        const filename = `${orderId}.webp`;
        const filePath = path.join(UPLOADS_DIR, filename);
        
        await sharp(buffer)
          .webp({ quality: 80 })
          .toFile(filePath);

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
    const filePath = path.join(UPLOADS_DIR, filename);
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
        ensureProductUploadsDir();
        const filename = `${Date.now()}-${Math.random().toString(36).slice(2)}.webp`;
        const filePath = path.join(PRODUCTS_UPLOADS_DIR, filename);
        
        await sharp(buffer)
          .webp({ quality: 80 })
          .toFile(filePath);

        const url = `/api/uploads/products/${filename}`;

        return res.json({ success: true, url });
      } catch (err) {
        console.error("Error in POST /api/admin/upload-product-image", err);
        return res.status(500).json({ success: false, error: "Failed to upload image" });
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
    status: z.enum(["pending", "completed", "cancelled"]),
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
        await storage.revokeUser(id);
        return res.json({ success: true });
      } catch (err) {
        console.error("Error in DELETE /api/admin/users/:id", err);
        return res
          .status(500)
          .json({ success: false, error: "Failed to revoke access" });
      }
    },
  );

  const inviteUserSchema = z.object({
    name: z.string().min(1),
    email: z.string().email(),
    role: z.enum(["admin", "staff"]),
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
        const { subject, html } = req.body;
        if (!subject || !html) {
          return res.status(400).json({ success: false, error: "Missing subject or html" });
        }

        const subscribers = await db.select().from(newsletterSubscribers);
        if (!subscribers.length) {
          return res.status(400).json({ success: false, error: "No subscribers found" });
        }

        const bccList = subscribers.map((s) => s.email);
        await sendMarketingBroadcastEmail(bccList, subject, html);

        return res.json({ success: true, count: bccList.length });
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

  // ── SMTP Test ──────────────────────────────────────────
  app.post(
    "/api/admin/test-email",
    requireAdmin,
    async (req: Request, res: Response) => {
      try {
        const { email } = req.body;
        const target = email || "upretynikesh021@gmail.com";
        
        // Use a generic send function or one of the existing ones
        // Since we want to test SMTP, let's use the invite one as a template or add a generic one
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
      const { customerName, customerPhone, items, paymentMethod,
              cashReceived, discountAmount, notes } = req.body;

      const subtotal = items.reduce((s: number, i: any) => s + i.lineTotal, 0);
      const taxAmount = Math.round(subtotal * 0.13);
      const discount = discountAmount ?? 0;
      const total = subtotal + taxAmount - discount;
      const change = paymentMethod === "cash" ? ((cashReceived ?? 0) - total) : 0;

      const billNumber = await generateBillNumber();
      const user = req.user as any;

      const [bill] = await db.insert(bills).values({
        id: crypto.randomUUID(),
        billNumber,
        orderId: null,
        customerName: customerName || "Walk-in Customer",
        customerPhone: customerPhone || null,
        items,
        subtotal: String(subtotal),
        taxRate: "13",
        taxAmount: String(taxAmount),
        discountAmount: String(discount),
        totalAmount: String(total),
        paymentMethod,
        cashReceived: cashReceived ? String(cashReceived) : null,
        changeGiven: change > 0 ? String(change) : null,
        processedBy: user?.name ?? user?.email ?? "Admin",
        processedById: user?.id ?? null,
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

  return httpServer;
}
