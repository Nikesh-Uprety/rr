import { sql } from "drizzle-orm";
import {
  boolean,
  index,
  integer,
  jsonb,
  numeric,
  pgTable,
  serial,
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
  // Team roles for internal users (admin panel users) or customers
  role: text("role").notNull().default("staff"),
  displayName: text("display_name"),
  profileImageUrl: text("profile_image_url"),
  phoneNumber: text("phone_number"),
  requires2FASetup: boolean("requires_2fa_setup").notNull().default(false),
  emailNotifications: boolean("email_notifications").notNull().default(true),
  twoFactorEnabled: integer("two_factor_enabled").notNull().default(0),
  lastLoginAt: timestamp("last_login_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  status: text("status").notNull().default("active"),
});

export const adminProfileSettings = pgTable("admin_profile_settings", {
  userId: varchar("user_id")
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  firstName: text("first_name"),
  lastName: text("last_name"),
  language: text("language").notNull().default("en"),
  timezone: text("timezone").notNull().default("Asia/Kathmandu"),
  department: text("department"),
  compactSidebar: boolean("compact_sidebar").notNull().default(false),
  showNprCurrency: boolean("show_npr_currency").notNull().default(true),
  orderAlertSound: boolean("order_alert_sound").notNull().default(true),
  loginAlerts: boolean("login_alerts").notNull().default(true),
  notificationPrefs: jsonb("notification_prefs")
    .$type<{
      newOrders?: boolean;
      lowStock?: boolean;
      customerReviews?: boolean;
      dailySummary?: boolean;
      paymentFailures?: boolean;
      marketingReports?: boolean;
    }>()
    .notNull()
    .default(sql`'{}'::jsonb`),
  pageAccessOverrides: jsonb("page_access_overrides")
    .$type<string[]>()
    .notNull()
    .default(sql`'[]'::jsonb`),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
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
  phoneNumber: text("phone_number"),
  avatarColor: text("avatar_color"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const insertCustomerSchema = createInsertSchema(customers).pick({
  firstName: true,
  lastName: true,
  email: true,
  phoneNumber: true,
});

export const products = pgTable("products", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull().unique(),
  shortDetails: text("short_details"),
  description: text("description"),
  price: numeric("price", { precision: 10, scale: 2 }).notNull(),
  costPrice: integer("cost_price").default(0),
  sku: varchar("sku", { length: 100 }).default(""),
  imageUrl: text("image_url"),
  galleryUrls: text("gallery_urls"), // JSON array of image URLs
  category: text("category"),
  stock: integer("stock").notNull().default(0),
  colorOptions: text("color_options"), // JSON array of color names
  sizeOptions: text("size_options"), // JSON array of size codes
  ranking: integer("ranking").default(999), // 1 = best seller
  originalPrice: numeric("original_price", { precision: 10, scale: 2 }),
  salePercentage: integer("sale_percentage").default(0),
  saleActive: boolean("sale_active").default(false),
  homeFeatured: boolean("home_featured").notNull().default(false),
  homeFeaturedImageIndex: integer("home_featured_image_index").notNull().default(2),
  isNewArrival: boolean("is_new_arrival").notNull().default(false),
  isNewCollection: boolean("is_new_collection").notNull().default(false),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
}, (table) => ({
  productsByCategory: index("products_category_idx").on(table.category),
}));

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
  promoCode: text("promo_code"),
  promoDiscountAmount: integer("promo_discount_amount").default(0),
  source: text("source").notNull().default("website"),
    // "website" | "pos" | "instagram" | "tiktok"
  deliveryRequired: boolean("delivery_required").notNull().default(true),
  deliveryProvider: text("delivery_provider"),
    // "pathao" | "nepal_can_move" | "yango" | "other" | null
  // Selected delivery location name from the Nepal locations list.
  deliveryLocation: varchar("delivery_location"),
  deliveryAddress: text("delivery_address"),
  stripePaymentIntentId: text("stripe_payment_intent_id"),
  stripeCheckoutSessionId: text("stripe_checkout_session_id"),
  stripePaymentStatus: text("stripe_payment_status"),
    // "pending" | "succeeded" | "failed" | "refunded"
  stripeAmountUsdCents: integer("stripe_amount_usd_cents"),
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
  variantId: integer("variant_id").references(() => productVariants.id),
  size: varchar("size", { length: 10 }).default(""),
  quantity: integer("quantity").notNull(),
  unitPrice: numeric("unit_price", { precision: 10, scale: 2 }).notNull(),
}, (table) => ({
  orderItemsByProduct: index("order_items_product_id_idx").on(table.productId),
}));

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
  source: text("source").notNull().default("pos"), // pos|website|instagram|tiktok
  items: jsonb("items").notNull(), // BillItem[]
  subtotal: numeric("subtotal").notNull(),
  taxRate: numeric("tax_rate").default("13"), // Nepal VAT 13%
  taxAmount: numeric("tax_amount").notNull(),
  discountAmount: numeric("discount_amount").default("0"),
  totalAmount: numeric("total_amount").notNull(),
  paymentMethod: text("payment_method").notNull(), // cash|esewa|card|khalti
  isPaid: boolean("is_paid").notNull().default(true),
  deliveryRequired: boolean("delivery_required").notNull().default(false),
  deliveryProvider: text("delivery_provider"),
  deliveryAddress: text("delivery_address"),
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

// ── Platforms (order sources) ────────────────────────────
export const platforms = pgTable("platforms", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  key: text("key").notNull().unique(), // website|pos|instagram|tiktok|...
  label: text("label").notNull(),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export type Platform = typeof platforms.$inferSelect;
export type NewPlatform = typeof platforms.$inferInsert;

// ── Media Assets (image library) ─────────────────────────
export const mediaAssets = pgTable("media_assets", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  url: text("url").notNull(),
  provider: text("provider").notNull(), // cloudinary | local
  category: text("category").notNull(), // product | model | website | landing_page | collection_page
  publicId: text("public_id"), // for cloudinary deletes
  filename: text("filename"),
  bytes: integer("bytes"),
  width: integer("width"),
  height: integer("height"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export type MediaAsset = typeof mediaAssets.$inferSelect;
export type NewMediaAsset = typeof mediaAssets.$inferInsert;

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
  status: text("status").notNull().default("active"), // 'active' | 'unsubscribed'
  unsubscribedAt: timestamp("unsubscribed_at", { withTimezone: true }),
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

// ── Promo Codes ─────────────────────────────────────
export const promoCodes = pgTable("promo_codes", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  code: varchar("code", { length: 50 }).notNull().unique(),
  discountPct: integer("discount_pct").notNull(),
  maxUses: integer("max_uses").notNull().default(100),
  usedCount: integer("used_count").notNull().default(0),
  active: boolean("active").notNull().default(true),
  expiresAt: timestamp("expires_at", { withTimezone: true }),
  // Null means applies to all products
  applicableProductIds: integer("applicable_product_ids").array(),
  // e.g. '1day' | '1week' | 'custom'
  durationPreset: varchar("duration_preset"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const insertPromoCodeSchema = createInsertSchema(promoCodes).omit({
  id: true,
  usedCount: true,
  createdAt: true,
});

export type PromoCode = typeof promoCodes.$inferSelect;
export type InsertPromoCode = z.infer<typeof insertPromoCodeSchema>;

// ── Site Assets (Landing Page Images) ──────────────────
export const siteAssets = pgTable("site_assets", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  section: text("section").notNull(),
  // hero | featured_collection | new_collection
  imageUrl: text("image_url").notNull(),
  // Cloudinary delivery URL (permanent, survives deploys)
  cloudinaryPublicId: text("cloudinary_public_id"),
  // needed for deletion via Cloudinary API
  altText: text("alt_text").default(""),
  deviceTarget: text("device_target").notNull().default("all"),
  // all | desktop | mobile
  assetType: text("asset_type").notNull().default("image"),
  // image | video
  videoUrl: text("video_url"),
  // Cloudinary embed URL for videos
  sortOrder: integer("sort_order").notNull().default(0),
  active: boolean("active").notNull().default(true),
  uploadedBy: varchar("uploaded_by")
    .references(() => users.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
}, (table) => ({
  siteAssetsSectionActiveIdx: index("site_assets_section_active_idx").on(table.section, table.active),
}));

export type SiteAsset = typeof siteAssets.$inferSelect;
export type InsertSiteAsset = typeof siteAssets.$inferInsert;

export const productVariants = pgTable("product_variants", {
  id: serial("id").primaryKey(),
  productId: varchar("product_id")
    .notNull()
    .references(() => products.id, { onDelete: "cascade" }),
  size: varchar("size", { length: 10 }).notNull(),
  color: varchar("color", { length: 50 }).default(""),
  sku: varchar("sku", { length: 100 }).default(""),
  stock: integer("stock").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  productVariantsByProductAndSize: index(
    "product_variants_product_id_size_idx",
  ).on(table.productId, table.size),
}));

export type ProductVariant = typeof productVariants.$inferSelect;
export type InsertProductVariant = typeof productVariants.$inferInsert;

export const inventoryMovements = pgTable("inventory_movements", {
  id: serial("id").primaryKey(),
  productId: varchar("product_id")
    .notNull()
    .references(() => products.id, { onDelete: "cascade" }),
  variantId: integer("variant_id").references(() => productVariants.id, {
    onDelete: "set null",
  }),
  movementType: text("movement_type").notNull(), // stock_in | stock_out | transfer
  quantity: integer("quantity").notNull(),
  unitCost: numeric("unit_cost", { precision: 10, scale: 2 }).notNull().default("0"),
  totalValue: numeric("total_value", { precision: 12, scale: 2 }).notNull().default("0"),
  outlet: text("outlet").notNull().default("Main Outlet"),
  channel: text("channel").notNull().default("Website"),
  batch: integer("batch").notNull().default(1),
  reference: text("reference"),
  notes: text("notes"),
  createdById: varchar("created_by_id").references(() => users.id, {
    onDelete: "set null",
  }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
}, (table) => ({
  inventoryMovementsByCreatedAt: index("inventory_movements_created_at_idx").on(table.createdAt),
  inventoryMovementsByProduct: index("inventory_movements_product_id_idx").on(table.productId),
}));

export type InventoryMovement = typeof inventoryMovements.$inferSelect;
export type InsertInventoryMovement = typeof inventoryMovements.$inferInsert;

export const pageTemplates = pgTable('page_templates', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 100 }).notNull(),
  slug: varchar('slug', { length: 100 }).notNull().unique(),
  description: text('description'),
  thumbnailUrl: text('thumbnail_url'),
  tier: varchar('tier', { length: 20 })
    .notNull()
    .default('free'),
  priceNpr: integer('price_npr')
    .notNull()
    .default(0),
  isPurchased: boolean('is_purchased')
    .notNull()
    .default(true),
  isActive: boolean('is_active')
    .notNull()
    .default(true),
  isCustom: boolean('is_custom')
    .notNull()
    .default(false),
  createdBy: varchar('created_by')
    .references(() => users.id),
  thumbnailConfig: jsonb('thumbnail_config'),
  createdAt: timestamp('created_at').defaultNow(),
})

export type PageTemplate =
  typeof pageTemplates.$inferSelect
export type InsertPageTemplate =
  typeof pageTemplates.$inferInsert

export const pageSections = pgTable('page_sections', {
  id: serial('id').primaryKey(),
  templateId: integer('template_id')
    .references(() => pageTemplates.id,
      { onDelete: 'cascade' }),
  pageId: integer('page_id')
    .references(() => pages.id,
      { onDelete: 'cascade' }),
  sectionType: varchar('section_type', { length: 50 })
    .notNull(),
  label: varchar('label', { length: 100 }),
  orderIndex: integer('order_index')
    .notNull()
    .default(0),
  isVisible: boolean('is_visible')
    .notNull()
    .default(true),
  config: jsonb('config').default('{}'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
})

export type PageSection =
  typeof pageSections.$inferSelect
export type InsertPageSection =
  typeof pageSections.$inferInsert

export const siteSettings = pgTable('site_settings', {
  id: serial('id').primaryKey(),
  activeTemplateId: integer('active_template_id')
    .references(() => pageTemplates.id),
  fontPreset: varchar('font_preset', { length: 50 }).default('inter'),
  publishedAt: timestamp('published_at'),
  publishedBy: varchar('published_by')
    .references(() => users.id),
  updatedAt: timestamp('updated_at').defaultNow(),
})

export type SiteSettings =
  typeof siteSettings.$inferSelect
export type InsertSiteSettings =
  typeof siteSettings.$inferInsert

export const pages = pgTable("pages", {
  id: serial("id").primaryKey(),
  slug: varchar("slug", { length: 100 }).notNull().unique(),
  title: varchar("title", { length: 200 }).notNull(),
  description: text("description"),
  status: varchar("status", { length: 20 }).notNull().default("draft"),
  isHomepage: boolean("is_homepage").notNull().default(false),
  showInNav: boolean("show_in_nav").notNull().default(true),
  sortOrder: integer("sort_order").notNull().default(0),
  seoTitle: varchar("seo_title", { length: 200 }),
  seoDescription: text("seo_description"),
  seoImage: text("seo_image"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
})

export type Page = typeof pages.$inferSelect
export type InsertPage = typeof pages.$inferInsert

export const siteBranding = pgTable("site_branding", {
  id: serial("id").primaryKey(),
  logoUrl: text("logo_url"),
  logoDarkUrl: text("logo_dark_url"),
  logoHeight: integer("logo_height").notNull().default(40),
  faviconUrl: text("favicon_url"),
  ogImageUrl: text("og_image_url"),
  footerLogoUrl: text("footer_logo_url"),
  footerText: text("footer_text"),
  updatedAt: timestamp("updated_at").defaultNow(),
})

export type SiteBranding = typeof siteBranding.$inferSelect
export type InsertSiteBranding = typeof siteBranding.$inferInsert

export const siteColors = pgTable("site_colors", {
  id: serial("id").primaryKey(),
  presetName: varchar("preset_name", { length: 50 }).notNull().default("default"),
  bgPrimary: varchar("bg_primary", { length: 20 }),
  bgSecondary: varchar("bg_secondary", { length: 20 }),
  textPrimary: varchar("text_primary", { length: 20 }),
  textSecondary: varchar("text_secondary", { length: 20 }),
  accentColor: varchar("accent_color", { length: 20 }),
  borderColor: varchar("border_color", { length: 20 }),
  isActive: boolean("is_active").notNull().default(false),
  createdAt: timestamp("created_at").defaultNow(),
})

export type SiteColor = typeof siteColors.$inferSelect
export type InsertSiteColor = typeof siteColors.$inferInsert

export const slugRedirects = pgTable("slug_redirects", {
  id: serial("id").primaryKey(),
  oldSlug: varchar("old_slug", { length: 100 }).notNull(),
  newSlug: varchar("new_slug", { length: 100 }).notNull(),
  createdAt: timestamp("created_at").defaultNow(),
})

export type SlugRedirect = typeof slugRedirects.$inferSelect
export type InsertSlugRedirect = typeof slugRedirects.$inferInsert
