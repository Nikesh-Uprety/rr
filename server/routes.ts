import type { Express, Request, Response, NextFunction } from "express";
import { type Server } from "http";
import path from "path";
import fs from "fs";
import { storage } from "./storage";
import { passport } from "./auth";
import { z } from "zod";
import { requireAdmin } from "./middleware/requireAdmin";
import { requireAuth } from "./middleware/requireAuth";
import { sendOTPEmail, sendInviteEmail } from "./email";

const UPLOADS_DIR = path.join(process.cwd(), "uploads", "payment-proofs");
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

  app.post("/api/auth/register", async (req: Request, res: Response) => {
    try {
      const parsed = registerSchema.safeParse(req.body);
      if (!parsed.success) {
        return res
          .status(400)
          .json({ success: false, error: "Invalid request body" });
      }

      const { email, password, name } = parsed.data;

      const existing = await storage.getUserByEmail(email);
      if (existing) {
        return res
          .status(400)
          .json({ success: false, error: "Email already in use" });
      }

      const bcrypt = await import("bcryptjs");
      const hashed = await bcrypt.default.hash(password, 10);

      const user = await storage.createUser({
        username: email,
        password: hashed,
        role: "customer",
      });

      const expressUser: Express.User = {
        id: user.id,
        email: email,
        role: user.role,
        name,
      };

      req.login(expressUser, (err) => {
        if (err) {
          throw err;
        }
        return res.status(201).json({
          success: true,
          data: { id: user.id, email, name, role: user.role },
        });
      });
    } catch (err) {
      console.error("Error in /api/auth/register", err);
      return res
        .status(500)
        .json({ success: false, error: "Internal server error" });
    }
  });

  const loginSchema = z.object({
    email: z.string().email(),
    password: z.string().min(1),
  });

  app.post(
    "/api/auth/login",
    (req: Request, res: Response, next: NextFunction) => {
      const parsed = loginSchema.safeParse(req.body);
      if (!parsed.success) {
        return res
          .status(400)
          .json({ success: false, error: "Invalid request body" });
      }
      passport.authenticate("local", (err, user: Express.User | false) => {
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
      const product = await storage.getProductById(req.params.id);
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
        return res
          .status(400)
          .json({ success: false, error: "Invalid order payload" });
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
        addressLine2: null,
        city: shipping.city,
        region: "", // state removed
        locationCoordinates: shipping.locationCoordinates ?? null,
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
      console.error("CRITICAL ERROR in POST /api/orders:", err);
      const errorMessage = err instanceof Error ? err.message : "Unknown error";
      return res
        .status(500)
        .json({ success: false, error: "Failed to create order", details: errorMessage });
    }
  });

  app.get("/api/orders/:id", async (req: Request, res: Response) => {
    try {
      const order = await storage.getOrderById(req.params.id);
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
        const orderId = req.params.id;
        await storage.getOrderById(orderId);
        const base64 = parsed.data.imageBase64;
        const match = base64.match(/^data:image\/(\w+);base64,(.+)$/);
        const buffer = Buffer.from(
          match ? match[2] : base64,
          "base64",
        );
        ensureUploadsDir();
        const ext = match ? match[1] : "png";
        const filename = `${orderId}.${ext}`;
        const filePath = path.join(UPLOADS_DIR, filename);
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
    const filename = req.params.filename;
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
        const ext = (match ? match[1] : "png").replace("jpeg", "jpg");
        const filename = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
        const filePath = path.join(PRODUCTS_UPLOADS_DIR, filename);
        fs.writeFileSync(filePath, buffer);
        const url = `/api/uploads/products/${filename}`;
        return res.json({ success: true, url });
      } catch (err) {
        console.error("Error in POST /api/admin/upload-product-image", err);
        return res.status(500).json({ success: false, error: "Failed to upload image" });
      }
    },
  );

  app.get("/api/uploads/products/:filename", (req: Request, res: Response) => {
    const filename = req.params.filename;
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
    shortDetails: z.string().optional(),
    description: z.string().optional(),
    price: z.number().positive(),
    imageUrl: z.string().optional().or(z.literal("")),
    galleryUrls: z.string().optional(),
    category: z.string().optional(),
    stock: z.number().int().nonnegative(),
    colorOptions: z.string().optional(),
    sizeOptions: z.string().optional(),
  });

  app.get(
    "/api/admin/products",
    requireAdmin,
    async (req: Request, res: Response) => {
      try {
        const { category, search, page, limit } = req.query;
        const products = await storage.getProducts({
          category: typeof category === "string" ? category : undefined,
          search: typeof search === "string" ? search : undefined,
          page: typeof page === "string" ? Number(page) || 1 : undefined,
          limit: typeof limit === "string" ? Number(limit) || 24 : undefined,
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
          ...parsed.data,
          imageUrl: parsed.data.imageUrl?.trim() || undefined,
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

        const data = {
          ...parsed.data,
          imageUrl: parsed.data.imageUrl !== undefined ? (parsed.data.imageUrl?.trim() || undefined) : undefined,
        };
        const updated = await storage.updateProduct(
          req.params.id,
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
        await storage.deleteProduct(req.params.id);
        return res.json({ success: true });
      } catch (err) {
        console.error("Error in DELETE /api/admin/products/:id", err);
        return res
          .status(500)
          .json({ success: false, error: "Failed to delete product" });
      }
    },
  );

  // Admin orders
  app.get(
    "/api/admin/orders",
    requireAdmin,
    async (req: Request, res: Response) => {
      try {
        const { status, search, page } = req.query;
        const orders = await storage.getOrders({
          status: typeof status === "string" ? status : undefined,
          search: typeof search === "string" ? search : undefined,
          page: typeof page === "string" ? Number(page) || 1 : undefined,
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

        const updated = await storage.updateOrderStatus(
          req.params.id,
          parsed.data.status,
        );
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
        const updated = await storage.updateOrderPaymentVerified(
          req.params.id,
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
        const { search } = req.query;
        const customers = await storage.getCustomers(
          typeof search === "string" ? search : undefined,
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

      try {
        await storage.updateUserTwoFactor(req.params.id, parsed.data.enabled);
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
      try {
        await storage.revokeUser(req.params.id);
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
      try {
        const customerWithOrders = await storage.getCustomerById(
          req.params.id,
        );
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
        const rangeParam = req.query.range;
        const range =
          rangeParam === "7d" ||
          rangeParam === "30d" ||
          rangeParam === "90d" ||
          rangeParam === "1y"
            ? rangeParam
            : "30d";

        const data = await storage.getAnalytics(range);
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
        const yearParam = req.query.year;
        const year =
          typeof yearParam === "string" && /^\d{4}$/.test(yearParam)
            ? Number(yearParam)
            : 2025;

        const data = await storage.getAnalyticsCalendar(year);
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

  return httpServer;
}
