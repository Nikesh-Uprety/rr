import { sql } from "drizzle-orm";
import {
  integer,
  jsonb,
  numeric,
  pgTable,
  text,
  timestamp,
  varchar,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  role: text("role").notNull().default("user"),
  displayName: text("display_name"),
  profileImageUrl: text("profile_image_url"),
  twoFactorEnabled: integer("two_factor_enabled").notNull().default(0),
  lastLoginAt: timestamp("last_login_at", { withTimezone: true }),
  status: text("status").notNull().default("active"),
});

export const sessions = pgTable("session", {
  sid: varchar("sid").primaryKey(),
  sess: jsonb("sess").notNull(),
  expire: timestamp("expire", { precision: 6 }).notNull(),
});

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

export const customers = pgTable("customers", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  firstName: text("first_name").notNull(),
  lastName: text("last_name").notNull(),
  email: text("email").notNull().unique(),
  totalSpent: numeric("total_spent", { precision: 10, scale: 2 })
    .notNull()
    .default("0"),
  orderCount: integer("order_count").notNull().default(0),
  avatarColor: text("avatar_color"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const insertCustomerSchema = createInsertSchema(customers).pick({
  firstName: true,
  lastName: true,
  email: true,
});

export const products = pgTable("products", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  shortDetails: text("short_details"),
  description: text("description"),
  price: numeric("price", { precision: 10, scale: 2 }).notNull(),
  imageUrl: text("image_url"),
  galleryUrls: text("gallery_urls"), // JSON array of image URLs
  category: text("category"),
  stock: integer("stock").notNull().default(0),
  colorOptions: text("color_options"), // JSON array of color names
  sizeOptions: text("size_options"), // JSON array of size codes
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const insertProductSchema = createInsertSchema(products).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type Product = typeof products.$inferSelect;
export type Customer = typeof customers.$inferSelect;

export const categories = pgTable("categories", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export type Category = typeof categories.$inferSelect;

export const orders = pgTable("orders", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id),
  email: text("email").notNull(),
  fullName: text("full_name").notNull(),
  addressLine1: text("address_line1").notNull(),
  addressLine2: text("address_line2"),
  city: text("city").notNull(),
  region: text("region").notNull(),
  postalCode: text("postal_code").notNull(),
  country: text("country").notNull(),
  total: numeric("total", { precision: 10, scale: 2 }).notNull(),
  status: text("status").notNull().default("pending"),
  paymentMethod: text("payment_method").notNull().default("cash_on_delivery"),
  paymentProofUrl: text("payment_proof_url"),
  paymentVerified: text("payment_verified"), // null = pending, "verified" | "rejected"
  locationCoordinates: text("location_coordinates"), // stringified JSON format {lat, lng}
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const insertOrderSchema = createInsertSchema(orders).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const orderItems = pgTable("order_items", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  orderId: varchar("order_id")
    .notNull()
    .references(() => orders.id),
  productId: varchar("product_id")
    .notNull()
    .references(() => products.id),
  quantity: integer("quantity").notNull(),
  unitPrice: numeric("unit_price", { precision: 10, scale: 2 }).notNull(),
});

export type Order = typeof orders.$inferSelect;
export type OrderItem = typeof orderItems.$inferSelect;

export const otpTokens = pgTable("otp_tokens", {
  id: varchar("id").primaryKey(),
  userId: varchar("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  token: text("token").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  used: integer("used").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export type OtpToken = typeof otpTokens.$inferSelect;

export const contactMessages = pgTable("contact_messages", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  email: text("email").notNull(),
  phone: text("phone"),
  subject: text("subject").notNull(),
  message: text("message").notNull(),
  status: text("status").notNull().default("unread"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export type ContactMessage = typeof contactMessages.$inferSelect;

// ── Bills ──────────────────────────────────────────────
export const bills = pgTable("bills", {
  id: text("id").primaryKey(),
  billNumber: text("bill_number").unique().notNull(), // RARE-INV-000123
  orderId: text("order_id"),
  customerId: text("customer_id"),
  customerName: text("customer_name").notNull(),
  customerEmail: text("customer_email"),
  customerPhone: text("customer_phone"),
  items: jsonb("items").notNull(), // BillItem[]
  subtotal: numeric("subtotal").notNull(),
  taxRate: numeric("tax_rate").default("13"), // Nepal VAT 13%
  taxAmount: numeric("tax_amount").notNull(),
  discountAmount: numeric("discount_amount").default("0"),
  totalAmount: numeric("total_amount").notNull(),
  paymentMethod: text("payment_method").notNull(), // cash|esewa|card|khalti
  cashReceived: numeric("cash_received"),
  changeGiven: numeric("change_given"),
  processedBy: text("processed_by").notNull(),
  processedById: text("processed_by_id"),
  notes: text("notes"),
  billType: text("bill_type").default("sale"), // sale | refund | pos
  status: text("status").default("issued"), // issued | void
  createdAt: timestamp("created_at").defaultNow(),
});

export type Bill = typeof bills.$inferSelect;
export type NewBill = typeof bills.$inferInsert;

// BillItem shape (stored in items JSONB):
// {
//   productId: string
//   productName: string
//   variantColor: string
//   size: string
//   sku: string
//   quantity: number
//   unitPrice: number
//   lineTotal: number
// }

// ── POS Sessions ───────────────────────────────────────
export const posSessions = pgTable("pos_sessions", {
  id: text("id").primaryKey(),
  openedBy: text("opened_by").notNull(),
  openedAt: timestamp("opened_at").defaultNow(),
  closedAt: timestamp("closed_at"),
  openingCash: numeric("opening_cash").default("0"),
  closingCash: numeric("closing_cash"),
  totalSales: numeric("total_sales").default("0"),
  totalOrders: integer("total_orders").default(0),
  totalCashSales: numeric("total_cash_sales").default("0"),
  totalDigitalSales: numeric("total_digital_sales").default("0"),
  status: text("status").default("open"), // open | closed
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
});

export type PosSession = typeof posSessions.$inferSelect;

// ── Product Attributes ──────────────────────────────────
export const productAttributes = pgTable("product_attributes", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  type: text("type").notNull(), // "color" | "size"
  value: text("value").notNull(), // e.g., "Stone Grey", "XXL"
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const insertProductAttributeSchema = createInsertSchema(productAttributes).pick({
  type: true,
  value: true,
});

export type ProductAttribute = typeof productAttributes.$inferSelect;
export type InsertProductAttribute = z.infer<typeof insertProductAttributeSchema>;

export const newsletterSubscribers = pgTable("newsletter_subscribers", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  email: text("email").notNull().unique(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const insertNewsletterSubscriberSchema = createInsertSchema(newsletterSubscribers).pick({
  email: true,
});

// ── Email Templates (Custom/Uploaded) ─────────────────────────────────
export const emailTemplates = pgTable("email_templates", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  subject: text("subject").notNull(),
  html: text("html").notNull(),
  createdBy: varchar("created_by").notNull(), // user ID
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const insertEmailTemplateSchema = createInsertSchema(emailTemplates).pick({
  name: true,
  subject: true,
  html: true,
});

export type EmailTemplate = typeof emailTemplates.$inferSelect;
export type InsertEmailTemplate = z.infer<typeof insertEmailTemplateSchema>;

// ── Admin Notifications ─────────────────────────────────
export const adminNotifications = pgTable("admin_notifications", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  title: text("title").notNull(),
  message: text("message").notNull(),
  type: text("type").notNull(), // 'order', 'product', 'system', etc.
  isRead: integer("is_read").notNull().default(0), // 0 for false, 1 for true
  link: text("link"), // Optional URL to navigate to when clicked
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const insertAdminNotificationSchema = createInsertSchema(adminNotifications).pick({
  title: true,
  message: true,
  type: true,
  link: true,
});

export type AdminNotification = typeof adminNotifications.$inferSelect;
export type InsertAdminNotification = z.infer<typeof insertAdminNotificationSchema>;
export const securityLogs = pgTable("security_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id"),
  userRole: text("user_role"), // admin, staff, customer, unauth
  method: text("method").notNull(),
  url: text("url").notNull(),
  status: integer("status").notNull(),
  durationMs: integer("duration_ms").notNull(),
  ip: text("ip"),
  userAgent: text("user_agent"),
  threat: text("threat"), // e.g., "BRUTE_FORCE", "SQL_INJECTION", null
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const insertSecurityLogSchema = createInsertSchema(securityLogs).omit({
  id: true,
  createdAt: true,
});

export type SecurityLog = typeof securityLogs.$inferSelect;
export type InsertSecurityLog = z.infer<typeof insertSecurityLogSchema>;
