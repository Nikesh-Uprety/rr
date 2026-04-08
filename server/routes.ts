import express from "express";

import type { Express, NextFunction, Request, Response } from "express";
import crypto from "node:crypto";
import fs from "fs";
import { type Server } from "http";
import path from "path";
import sharp from "sharp";
import multer from "multer";
import { z } from "zod";
import { ADMIN_PAGE_KEYS, canAccessAdminPage, canAccessAdminPanel, getAdminAllowedPages, normalizeAdminPageList, requiresTwoFactorChallenge } from "@shared/auth-policy";
import { MAISON_NOCTURNE_DEFAULT_HERO_SLIDES } from "@shared/canvasDefaults";
import { storage } from "./storage";
import { logger } from "./logger";
import passport from "passport";
import { processAndStoreImage, deleteLocalImage } from "./lib/imageService";
import { resolveUploadsDir } from "./uploads";
import { storageService } from "./storage-service";
import {
  createLoginHandler,
  createStoreUserHandler,
  createVerify2FAHandler,
} from "./authHandlers";



import { and, asc, desc, eq, gte, ilike, inArray, isNotNull, isNull, or, sql } from "drizzle-orm";

import {
    bills,
    customers,
    emailTemplates,
    inventoryMovements,
    insertNewsletterSubscriberSchema,
    insertProductAttributeSchema,
    mediaAssets,
    newsletterSubscribers,
    orders,
    orderItems,
    pageSections,
    pageTemplates,
    pages,
    posSessions,
    platforms,
    Product,
    productVariants,
    products,
    promoCodes,
    securityLogs,
    siteAssets,
    siteSettings,
    siteBranding,
    siteColors,
    slugRedirects,
    users,
    adminProfileSettings,
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
import { getSmsChannelStatus, sendMarketingSMS } from "./sms";
import { getQueryParam, handleApiError, sendError } from "./errorHandler";
import { requireAdmin, requireAdminPageAccess } from "./middleware/requireAdmin";
import { requireAuth } from "./middleware/requireAuth";
import { rateLimit } from "./middleware/security";
import { validateRequest } from "./middleware/validation";
import { 
  loginSchema, 
  verify2FASchema 
} from "./authHandlers";
import { generateBillFromOrder, generateBillNumber } from "./services/billService";
import { getUsdToNprRate, convertNprToUsdCents } from "./lib/exchangeRate";
import { stripe, createCheckoutSession, constructWebhookEvent } from "./lib/stripe";
import type Stripe from "stripe";
import { cartService } from "./services/cartService";
import { ensureAdminProfileAccessStorage, getAdminPageAccessOverrides, getEffectiveAdminPageAccess } from "./adminPageAccess";
import {
  uploadToCloudinary,
  deleteFromCloudinary,
  uploadMediaToCloudinary,
  uploadPaymentProofToCloudinary,
} from "./lib/cloudinary";

const UPLOADS_DIR = resolveUploadsDir();
const PAYMENT_PROOFS_DIR = path.join(UPLOADS_DIR, "payment-proofs");
const PRODUCTS_UPLOADS_DIR = path.join(UPLOADS_DIR, "products");
const MEDIA_UPLOADS_DIR = path.join(UPLOADS_DIR, "media");
const MAX_ADMIN_IMAGE_UPLOAD_BYTES = 30 * 1024 * 1024;
const MAX_ADMIN_IMAGE_UPLOAD_LABEL = "30 MB";
const PAYMENT_QR_CATEGORIES = {
  all: "payment_qr",
  esewa: "payment_qr_esewa",
  khalti: "payment_qr_khalti",
  fonepay: "payment_qr_fonepay",
} as const;

const DEFAULT_PAYMENT_QR_URLS = {
  esewaQrUrl: "/images/esewa-qr.webp",
  khaltiQrUrl:
    "https://blog.khalti.com/wp-content/uploads/2023/03/MPQRCode-HYLEbgp9z64hDoqP9L8ZyQ-pdf.jpg",
  fonepayQrUrl:
    "https://cdn11.bigcommerce.com/s-tgrcca6nho/images/stencil/original/products/65305/136311/Quick-Scan-Pay-Stand-Scan1_136310__37301.1758003923.jpg",
} as const;

const PAYMENT_PROOF_STORAGE = (process.env.PAYMENT_PROOF_STORAGE || "cloudinary").toLowerCase();

// Abuse prevention: tracks IPs/emails that repeatedly exceed new customer limits
const abuseAttempts = new Map<string, { count: number; blockedAt: number }>();

// Draft preview: short-lived tokens for previewing unpublished pages
const previewTokens = new Map<string, { pageId: number; expiresAt: number }>();
const PREVIEW_TOKEN_TTL_MS = 15 * 60 * 1000; // 15 minutes

const memoryUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_ADMIN_IMAGE_UPLOAD_BYTES },
  fileFilter: (
    _req: Request,
    file: Express.Multer.File,
    cb: multer.FileFilterCallback,
  ) => {
    const allowed = ["image/jpeg", "image/png", "image/webp"];
    cb(null, allowed.includes(file.mimetype));
  },
});

type SiteSettingsCompatRow = {
  id: number;
  activeTemplateId: number | null;
  fontPreset: string | null;
  publishedAt: Date | null;
  publishedBy: string | null;
  updatedAt: Date | null;
};

const CANVAS_TEMPLATE_OVERRIDES = {
  "maison-nocturne": {
    name: "Rare Atelier Official",
    description: "A cinematic luxury editorial homepage for Rare Atelier.",
  },
  "editorial-grid": {
    name: "Rare Atelier Draft",
    description: "Magazine-style draft layout with bold typography.",
  },
} as const;

let siteSettingsHasFontPresetColumnCache: boolean | null = null;

async function siteSettingsHasFontPresetColumn() {
  if (siteSettingsHasFontPresetColumnCache !== null) {
    return siteSettingsHasFontPresetColumnCache;
  }

  const result = await db.execute(sql`
    select exists (
      select 1
      from information_schema.columns
      where table_schema = current_schema()
        and table_name = 'site_settings'
        and column_name = 'font_preset'
    ) as has_column
  `);

  const row = result.rows[0] as { has_column?: boolean | string | number } | undefined;
  siteSettingsHasFontPresetColumnCache =
    row?.has_column === true ||
    row?.has_column === "t" ||
    row?.has_column === "true" ||
    row?.has_column === 1;

  if (!siteSettingsHasFontPresetColumnCache) {
    try {
      await db.execute(sql`
        alter table site_settings
        add column if not exists font_preset varchar(50) default 'inter'
      `);
      await db.execute(sql`
        update site_settings
        set font_preset = 'inter'
        where font_preset is null
      `);
      siteSettingsHasFontPresetColumnCache = true;
    } catch (error) {
      console.warn("Unable to auto-apply site_settings.font_preset migration", error);
    }
  }

  return siteSettingsHasFontPresetColumnCache;
}

async function getSiteSettingsCompat(): Promise<SiteSettingsCompatRow[]> {
  const hasFontPresetColumn = await siteSettingsHasFontPresetColumn();

  if (hasFontPresetColumn) {
    return db.select().from(siteSettings).limit(1);
  }

  return db
    .select({
      id: siteSettings.id,
      activeTemplateId: siteSettings.activeTemplateId,
      fontPreset: sql<string>`'inter'`,
      publishedAt: siteSettings.publishedAt,
      publishedBy: siteSettings.publishedBy,
      updatedAt: siteSettings.updatedAt,
    })
    .from(siteSettings)
    .limit(1);
}

let adminProfileSettingsReady = false;

const DEFAULT_NOTIFICATION_PREFS = {
  newOrders: true,
  lowStock: true,
  customerReviews: true,
  dailySummary: true,
  paymentFailures: true,
  marketingReports: false,
} as const;

async function ensureAdminProfileSettingsTable() {
  if (adminProfileSettingsReady) return;
  await ensureAdminProfileAccessStorage();
  adminProfileSettingsReady = true;
}

function parseName(displayName: string | null | undefined, email: string) {
  const fallback = (email.split("@")[0] || "").trim();
  const source = (displayName || fallback || "").trim();
  if (!source) return { firstName: "", lastName: "" };
  const parts = source.split(/\s+/).filter(Boolean);
  const firstName = parts[0] || "";
  const lastName = parts.length > 1 ? parts.slice(1).join(" ") : "";
  return { firstName, lastName };
}

function buildDisplayName(firstName: string, lastName: string, existing?: string | null) {
  const merged = `${firstName} ${lastName}`.trim();
  return merged || existing || "";
}

function mergeNotificationPrefs(raw: Record<string, unknown> | null | undefined) {
  return {
    ...DEFAULT_NOTIFICATION_PREFS,
    ...(raw || {}),
  };
}

async function getAdminOperationalInsights(userId: string, role: string | null | undefined) {
  await ensureAdminProfileAccessStorage();

  const [salesStats] = await db
    .select({
      totalSales: sql<string>`coalesce(sum(${bills.totalAmount}), '0')`,
      salesCount: sql<number>`count(*)::int`,
      posSalesCount: sql<number>`sum(case when ${bills.source} = 'pos' then 1 else 0 end)::int`,
      onlineSalesCount: sql<number>`sum(case when ${bills.source} = 'pos' then 0 else 1 end)::int`,
      ordersCompleted: sql<number>`sum(case when ${bills.orderId} is not null then 1 else 0 end)::int`,
    })
    .from(bills)
    .where(
      and(
        eq(bills.processedById, userId),
        sql`coalesce(${bills.status}, 'issued') != 'void'`,
        sql`coalesce(${bills.billType}, 'sale') != 'refund'`,
      ),
    );

  const [inventoryStats] = await db
    .select({
      stockEntries: sql<number>`count(*)::int`,
      stockAddedUnits: sql<number>`coalesce(sum(${inventoryMovements.quantity}), 0)::int`,
      productsManaged: sql<number>`count(distinct ${inventoryMovements.productId})::int`,
    })
    .from(inventoryMovements)
    .where(
      and(
        eq(inventoryMovements.createdById, userId),
        eq(inventoryMovements.movementType, "stock_in"),
      ),
    );

  const [activityStats] = await db
    .select({
      ordersProcessed: sql<number>`sum(case when ${securityLogs.url} like '/api/admin/orders/%' and ${securityLogs.url} not like '/api/admin/orders/%/verify-payment' and ${securityLogs.method} in ('PUT', 'PATCH') and ${securityLogs.status} between 200 and 299 then 1 else 0 end)::int`,
      paymentVerifications: sql<number>`sum(case when ${securityLogs.url} like '/api/admin/orders/%/verify-payment' and ${securityLogs.method} in ('PUT', 'PATCH') and ${securityLogs.status} between 200 and 299 then 1 else 0 end)::int`,
      adminActions30d: sql<number>`sum(case when ${securityLogs.createdAt} >= now() - interval '30 days' then 1 else 0 end)::int`,
    })
    .from(securityLogs)
    .where(eq(securityLogs.userId, userId));

  const recentActivity = await db
    .select({
      id: securityLogs.id,
      method: securityLogs.method,
      url: securityLogs.url,
      status: securityLogs.status,
      createdAt: securityLogs.createdAt,
    })
    .from(securityLogs)
    .where(eq(securityLogs.userId, userId))
    .orderBy(desc(securityLogs.createdAt))
    .limit(12);

  const recentOrders = await db.execute(sql`
    select
      b.id,
      b.bill_number,
      b.order_id,
      b.customer_name,
      b.customer_email,
      b.customer_phone,
      b.items,
      b.total_amount,
      b.payment_method,
      b.delivery_required,
      b.delivery_provider,
      b.delivery_address,
      b.source,
      b.created_at as processed_at,
      o.id as linked_order_id,
      o.status as order_status,
      o.created_at as order_created_at,
      o.updated_at as order_updated_at,
      o.email as order_email,
      o.full_name as order_full_name,
      o.delivery_location,
      o.payment_verified
    from bills b
    left join orders o on o.id = b.order_id
    where b.processed_by_id = ${userId}
      and coalesce(b.status, 'issued') != 'void'
      and coalesce(b.bill_type, 'sale') != 'refund'
    order by b.created_at desc
    limit 20
  `);

  const sessionsResult = await db.execute(sql`
    select
      sid,
      expire,
      coalesce(sess->>'ip', '') as ip,
      coalesce(sess->>'userAgent', '') as user_agent,
      coalesce(sess->>'createdAt', '') as created_at,
      coalesce(sess->>'lastAccessedAt', '') as last_accessed_at
    from session
    where (sess->'passport'->>'user') = ${userId}
    order by expire desc
  `);

  const accessOverrides = await getAdminPageAccessOverrides(userId);
  const effectiveAccess = await getEffectiveAdminPageAccess(userId, role);

  const sessions = sessionsResult.rows.map((row: any) => ({
    sid: String(row.sid),
    expiresAt: row.expire ? new Date(row.expire as string).toISOString() : null,
    createdAt: row.created_at ? String(row.created_at) : null,
    lastAccessedAt: row.last_accessed_at ? String(row.last_accessed_at) : null,
    ip: row.ip ? String(row.ip) : null,
    userAgent: row.user_agent ? String(row.user_agent) : null,
  }));

  return {
    stats: {
      totalSales: String(salesStats?.totalSales ?? "0"),
      salesCount: Number(salesStats?.salesCount ?? 0),
      posSalesCount: Number(salesStats?.posSalesCount ?? 0),
      onlineSalesCount: Number(salesStats?.onlineSalesCount ?? 0),
      ordersProcessed: Number(activityStats?.ordersProcessed ?? 0),
      ordersCompleted: Number(salesStats?.ordersCompleted ?? 0),
      paymentVerifications: Number(activityStats?.paymentVerifications ?? 0),
      stockEntries: Number(inventoryStats?.stockEntries ?? 0),
      stockAddedUnits: Number(inventoryStats?.stockAddedUnits ?? 0),
      productsManaged: Number(inventoryStats?.productsManaged ?? 0),
      adminActions30d: Number(activityStats?.adminActions30d ?? 0),
      activeSessionsCount: sessions.length,
    },
    accessScope: effectiveAccess,
    permissions: effectiveAccess,
    accessOverrides,
    recentActivity: recentActivity.map((entry) => ({
      id: entry.id,
      action: `${entry.method} ${entry.url}`,
      target: entry.url,
      status: entry.status,
      timestamp: entry.createdAt,
    })),
    orderActivity: recentOrders.rows.map((row: any) => ({
      id: String(row.id),
      billNumber: String(row.bill_number),
      orderId: row.order_id ? String(row.order_id) : null,
      source: row.source ? String(row.source) : null,
      customer: {
        name: row.customer_name ? String(row.customer_name) : null,
        email: row.customer_email ? String(row.customer_email) : null,
        phone: row.customer_phone ? String(row.customer_phone) : null,
      },
      items: Array.isArray(row.items) ? row.items : [],
      totalAmount: String(row.total_amount ?? "0"),
      paymentMethod: row.payment_method ? String(row.payment_method) : null,
      paymentVerified: row.payment_verified ? String(row.payment_verified) : null,
      orderStatus: row.order_status ? String(row.order_status) : null,
      orderCreatedAt: row.order_created_at ? new Date(row.order_created_at as string).toISOString() : null,
      orderUpdatedAt: row.order_updated_at ? new Date(row.order_updated_at as string).toISOString() : null,
      processedAt: row.processed_at ? new Date(row.processed_at as string).toISOString() : null,
      deliveryRequired: Boolean(row.delivery_required),
      deliveryProvider: row.delivery_provider ? String(row.delivery_provider) : null,
      deliveryAddress: row.delivery_address ? String(row.delivery_address) : null,
      deliveryLocation: row.delivery_location ? String(row.delivery_location) : null,
      linkedOrderEmail: row.order_email ? String(row.order_email) : null,
      linkedOrderFullName: row.order_full_name ? String(row.order_full_name) : null,
    })),
    sessions,
  };
}

function normalizeCanvasTemplate<T extends { slug?: string | null; name?: string | null; description?: string | null }>(
  template: T | null | undefined,
): T | null | undefined {
  if (!template?.slug) return template;
  const override =
    CANVAS_TEMPLATE_OVERRIDES[template.slug as keyof typeof CANVAS_TEMPLATE_OVERRIDES];
  if (!override) return template;
  return {
    ...template,
    name: override.name,
    description: override.description,
  };
}

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

function sanitizeUploadFilename(name: string) {
  const base = name.split("/").pop() || name;
  const trimmed = base.replace(/\?.*$/, "").replace(/#[^]*$/, "").trim();
  const extMatch = trimmed.match(/\.[a-z0-9]+$/i);
  const ext = extMatch ? extMatch[0].toLowerCase() : "";
  const body = (ext ? trimmed.slice(0, -ext.length) : trimmed)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  const safeBody = body || "image";
  return `${safeBody}${ext || ".jpg"}`;
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
  app.get("/sitemap.xml", async (req: Request, res: Response) => {
    try {
      const forwardedProtoHeader = req.headers["x-forwarded-proto"];
      const forwardedProto = Array.isArray(forwardedProtoHeader)
        ? forwardedProtoHeader[0]
        : forwardedProtoHeader?.split(",")[0];
      const protocol = forwardedProto?.trim() || req.protocol || "https";
      const host = req.get("host");

      if (!host) {
        return res.status(400).send("Missing host");
      }

      const baseUrl = `${protocol}://${host}`;
      const staticEntries = [
        { path: "/", lastmod: null as Date | string | null },
        { path: "/products", lastmod: null as Date | string | null },
        { path: "/new-collection", lastmod: null as Date | string | null },
        { path: "/atelier", lastmod: null as Date | string | null },
        { path: "/shipping", lastmod: null as Date | string | null },
        { path: "/refund", lastmod: null as Date | string | null },
        { path: "/privacy", lastmod: null as Date | string | null },
        { path: "/terms", lastmod: null as Date | string | null },
      ];

      const publishedPages = await db
        .select({
          slug: pages.slug,
          updatedAt: pages.updatedAt,
        })
        .from(pages)
        .where(eq(pages.status, "published"));

      const publishedProducts = await db
        .select({
          id: products.id,
          updatedAt: products.updatedAt,
        })
        .from(products);

      const uniqueEntries = new Map<string, { lastmod: Date | string | null }>();

      const addEntry = (pathValue: string, lastmod: Date | string | null) => {
        if (!pathValue.startsWith("/") || pathValue.startsWith("/admin")) return;
        const existing = uniqueEntries.get(pathValue);
        if (!existing || (lastmod && !existing.lastmod)) {
          uniqueEntries.set(pathValue, { lastmod });
        }
      };

      staticEntries.forEach((entry) => addEntry(entry.path, entry.lastmod));
      publishedPages.forEach((page) => addEntry(page.slug, page.updatedAt ?? null));
      publishedProducts.forEach((product) => addEntry(`/product/${product.id}`, product.updatedAt ?? null));

      const escapeXml = (value: string) =>
        value
          .replace(/&/g, "&amp;")
          .replace(/</g, "&lt;")
          .replace(/>/g, "&gt;")
          .replace(/"/g, "&quot;")
          .replace(/'/g, "&apos;");

      const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${Array.from(uniqueEntries.entries())
  .map(([pathValue, entry]) => {
    const loc = escapeXml(new URL(pathValue, baseUrl).toString());
    const lastmod =
      entry.lastmod instanceof Date
        ? entry.lastmod.toISOString()
        : typeof entry.lastmod === "string" && entry.lastmod
          ? new Date(entry.lastmod).toISOString()
          : null;

    return `  <url>
    <loc>${loc}</loc>${lastmod ? `
    <lastmod>${escapeXml(lastmod)}</lastmod>` : ""}
  </url>`;
  })
  .join("\n")}
</urlset>`;

      res.type("application/xml").send(xml);
    } catch (error) {
      handleApiError(res, error, "GET /sitemap.xml");
    }
  });

  const sectionVariant = (section: { config?: unknown }) => {
    if (!section?.config || typeof section.config !== "object") return null;
    const variant = (section.config as Record<string, unknown>).variant;
    return typeof variant === "string" ? variant : null;
  };

  const ensureTemplateSections = <
    T extends {
      sectionType: string;
      orderIndex: number;
      isVisible?: boolean;
      label?: string | null;
      config?: unknown;
      templateId?: number;
      id?: number;
    },
  >(
    template: { id?: number; slug?: string | null } | null | undefined,
    sections: T[],
  ): T[] => {
    if (template?.slug === "rare-dark-luxury") {
      if (sections.some((section) => section.sectionType === "hero")) return sections;

      const fallbackHero = {
        templateId: template.id ?? 0,
        id: -1,
        sectionType: "hero",
        label: "Hero",
        orderIndex: 1,
        isVisible: true,
        config: { variant: "dark-cinematic" },
      } as T;

      return [fallbackHero, ...sections.map((section) => ({
        ...section,
        orderIndex: Math.max(2, section.orderIndex + 1),
      }))];
    }

    type CuratedSectionBlueprint = {
      sectionType: string;
      variant?: string;
    };

    const curatedTemplates = {
      "maison-nocturne": [
        { sectionType: "hero", variant: "maison-nocturne" },
        { sectionType: "ticker" },
        { sectionType: "featured", variant: "maison-nocturne" },
        { sectionType: "campaign", variant: "maison-nocturne-lookbook" },
        { sectionType: "quote", variant: "maison-nocturne-statement" },
      ] satisfies CuratedSectionBlueprint[],
      nikeshdesign: [
        { sectionType: "hero", variant: "nikeshdesign" },
        { sectionType: "ticker" },
        { sectionType: "featured", variant: "nikeshdesign-featured" },
        { sectionType: "campaign", variant: "nikeshdesign-lookbook" },
        { sectionType: "quote", variant: "nikeshdesign-statement" },
      ] satisfies CuratedSectionBlueprint[],
    } as const;

    const sectionBlueprints =
      template?.slug
        ? curatedTemplates[template.slug as keyof typeof curatedTemplates]
        : undefined;

    if (!sectionBlueprints) return sections;

    const usedSectionIds = new Set<number>();
    const normalizedSections: T[] = [];

    for (let index = 0; index < sectionBlueprints.length; index += 1) {
      const blueprint = sectionBlueprints[index];
      const sameTypeSections = sections.filter((section) => section.sectionType === blueprint.sectionType);
      if (!sameTypeSections.length) continue;

      const preferred =
        (blueprint.variant
          ? sameTypeSections.find((section) => sectionVariant(section) === blueprint.variant)
          : undefined) ??
        sameTypeSections[0];

      const visibleFallback = sameTypeSections.find((section) => section.isVisible);

      const mergedSection = {
        ...preferred,
        orderIndex: preferred.orderIndex ?? index + 1,
        isVisible: preferred.isVisible ?? true,
      } as T;

      if (blueprint.variant) {
        mergedSection.config = {
          ...(visibleFallback?.config && typeof visibleFallback.config === "object"
            ? visibleFallback.config as Record<string, unknown>
            : {}),
          ...(preferred.config && typeof preferred.config === "object"
            ? preferred.config as Record<string, unknown>
            : {}),
          variant: blueprint.variant,
        } as T["config"];
      }

      if (!mergedSection.isVisible && visibleFallback) {
        mergedSection.isVisible = true;
      }

      if (typeof preferred.id === "number") {
        usedSectionIds.add(preferred.id);
      }
      if (visibleFallback && typeof visibleFallback.id === "number") {
        usedSectionIds.add(visibleFallback.id);
      }

      normalizedSections.push(mergedSection);
    }

    const extraSections = sections.filter((section) => {
      if (typeof section.id === "number" && usedSectionIds.has(section.id)) {
        return false;
      }
      return !sectionBlueprints.some((blueprint) => blueprint.sectionType === section.sectionType);
    });

    return [...normalizedSections, ...extraSections].sort((a, b) => a.orderIndex - b.orderIndex);
  };

  const ensureFaqSectionForTemplate = async <
    T extends {
      id?: number;
      templateId: number | null;
      pageId: number | null;
      sectionType: string;
      orderIndex: number;
      isVisible?: boolean;
      label?: string | null;
      config?: unknown;
    },
  >(
    templateId: number,
    sections: T[],
  ): Promise<T[]> => {
    if (sections.some((section) => section.sectionType === "faq")) return sections;

    const nextOrderIndex =
      sections.reduce((max, section) => Math.max(max, section.orderIndex ?? 0), 0) + 1;

    const defaultFaqConfig = {
      title: "Frequently Asked Questions",
      text: "Everything you need to know before placing your order.",
      items: [
        {
          title: "How do I place an order?",
          content:
            "Browse products, add them to your cart, and complete checkout with shipping and payment details.",
        },
        {
          title: "Can I modify or cancel my order?",
          content:
            "Yes, before shipping. Once an order is processed and dispatched, edits and cancellations are no longer available.",
        },
        {
          title: "What payment methods do you accept?",
          content:
            "We currently support online payment options shown at checkout, plus verified payment channels configured by Rare Atelier.",
        },
      ],
    } as const;

    const [created] = await db
      .insert(pageSections)
      .values({
        templateId,
        sectionType: "faq",
        label: "FAQ",
        orderIndex: nextOrderIndex,
        isVisible: true,
        config: defaultFaqConfig,
      })
      .returning();

    return [...sections, created as unknown as T].sort((a, b) => a.orderIndex - b.orderIndex);
  };

  const ensureBackToTopSectionForTemplate = async <
    T extends {
      id?: number;
      templateId: number | null;
      pageId: number | null;
      sectionType: string;
      orderIndex: number;
      isVisible?: boolean;
      label?: string | null;
      config?: unknown;
    },
  >(
    templateId: number,
    sections: T[],
  ): Promise<T[]> => {
    if (sections.some((section) => section.sectionType === "back-to-top")) return sections;

    const nextOrderIndex =
      sections.reduce((max, section) => Math.max(max, section.orderIndex ?? 0), 0) + 1;

    const [created] = await db
      .insert(pageSections)
      .values({
        templateId,
        sectionType: "back-to-top",
        label: "Back To Top",
        orderIndex: nextOrderIndex,
        isVisible: true,
        config: {
          title: "Back to Top",
          text: "Image section above contact with smooth return-to-top action.",
          image: "/images/home-campaign-editorial.webp",
        },
      })
      .returning();

    return [...sections, created as unknown as T].sort((a, b) => a.orderIndex - b.orderIndex);
  };

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
        // Don't await security log insertion - it should be non-blocking
        // If database is slow, we shouldn't block the user's request
        storage.insertSecurityLog({
          userId: user?.id || null,
          userRole: user?.role || "guest",
          method: req.method,
          url: url,
          status: res.statusCode,
          durationMs: duration,
          ip: req.ip || req.headers["x-forwarded-for"]?.toString() || null,
          userAgent: req.headers["user-agent"] || null,
          threat: threat,
        }).catch((err) => {
          // Log but don't crash if security log insertion fails
          logger.warn(
            "Failed to insert security log",
            {
              timestamp: new Date().toISOString(),
            },
            {
              error: err.message,
            }
          );
        });
      } catch (err) {
        // Synchronous errors (shouldn't happen, but just in case)
        console.error("Failed to queue security log:", err);
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
  app.post(
    "/api/auth/register", 
    rateLimit(), 
    validateRequest(registerSchema),
    async (req: Request, res: Response) => {
      try {
        const { email, password, name } = req.body;
  
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
          requires2FASetup: false,
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
    }
  );

  // Feature-level RBAC for admin APIs.
  app.use("/api/admin/categories", requireAdminPageAccess("products"));
  app.use("/api/admin/upload-product-image", requireAdminPageAccess("products"));
  app.use("/api/admin/products", requireAdminPageAccess("products"));
  app.use("/api/admin/inventory", requireAdminPageAccess("products"));
  app.use("/api/admin/attributes", requireAdminPageAccess("products"));
  app.use("/api/admin/site-assets", requireAdminPageAccess("landing-page"));
  app.use("/api/admin/orders", requireAdminPageAccess("orders"));
  app.use("/api/admin/analytics", requireAdminPageAccess("analytics"));
  app.use("/api/admin/customers", requireAdminPageAccess("customers"));
  app.use("/api/admin/users", requireAdminPageAccess("store-users"));
  app.use("/api/admin/store-users", requireAdminPageAccess("store-users"));
  app.use("/api/admin/profile", requireAdminPageAccess("profile"));
  app.use("/api/admin/change-password", requireAdminPageAccess("profile"));
  app.use("/api/admin/notifications", requireAdminPageAccess("notifications"));
  app.use("/api/admin/messages", requireAdminPageAccess("messages"));
  app.use("/api/admin/marketing", requireAdminPageAccess("marketing"));
  app.use("/api/admin/newsletter", requireAdminPageAccess("marketing"));
  app.use("/api/admin/templates", requireAdminPageAccess("marketing"));
  app.use("/api/admin/test-email", requireAdminPageAccess("marketing"));
  app.use("/api/admin/bills", requireAdminPageAccess("bills"));
  app.use("/api/admin/pos/session", requireAdminPageAccess("pos"));
  app.use("/api/admin/logs", requireAdminPageAccess("logs"));
  app.use("/api/admin/promo-codes", requireAdminPageAccess("promo-codes"));
  app.use("/api/admin/images", requireAdminPageAccess(["images", "buckets"]));
  app.use("/api/admin/media", requireAdminPageAccess(["images", "buckets"]));
  app.use("/api/admin/folders", requireAdminPageAccess("buckets"));
  app.use("/api/admin/storefront-image-library", requireAdminPageAccess("storefront-images"));

  // GET /api/public/bills/:billNumber — public bill view (no auth required)
  app.get("/api/public/bills/:billNumber", async (req: Request, res: Response) => {
    try {
      const [bill] = await db
        .select()
        .from(bills)
        .where(eq(bills.billNumber, req.params.billNumber as string))
        .limit(1);

      if (!bill) {
        return res.status(404).json({ success: false, error: "Bill not found" });
      }

      res.json({ success: true, data: bill });
    } catch (err) {
      console.error("Error in GET /api/public/bills/:billNumber", err);
      res.status(500).json({ success: false, error: "Failed to load bill" });
    }
  });

  app.get("/api/public/page-config", async (req: Request, res: Response) => {
    try {
      const previewTemplateIdRaw =
        typeof req.query.templateId === "string" ? req.query.templateId : undefined;
      const previewTemplateId =
        previewTemplateIdRaw && /^\d+$/.test(previewTemplateIdRaw)
          ? parseInt(previewTemplateIdRaw, 10)
          : null;
      const applyPageConfigCacheHeaders = () => {
        res.set("Cache-Control", "private, no-store, max-age=0, must-revalidate");
        if (previewTemplateId !== null) {
          res.set("Vary", "Cookie");
        }
      };

      if (
        previewTemplateId !== null &&
        !canAccessAdminPage((req.user as Express.User | undefined)?.role, "landing-page")
      ) {
        return res.status(403).json({ success: false, error: "Forbidden" });
      }

      const settings = await getSiteSettingsCompat();

      if (!settings.length && previewTemplateId === null) {
        applyPageConfigCacheHeaders();
        return res.json({ template: null, sections: [] });
      }

      const activeId = previewTemplateId ?? settings[0]?.activeTemplateId ?? null;
      if (!activeId) {
        applyPageConfigCacheHeaders();
        return res.json({ template: null, sections: [] });
      }

      const template = await db
        .select()
        .from(pageTemplates)
        .where(eq(pageTemplates.id, activeId))
        .limit(1);

      const sections = await db
        .select()
        .from(pageSections)
        .where(and(eq(pageSections.templateId, activeId), sql`${pageSections.pageId} IS NULL`))
        .orderBy(pageSections.orderIndex);

      const sectionsWithBackToTop = await ensureBackToTopSectionForTemplate(activeId, sections as any);
      const sectionsWithFaq = await ensureFaqSectionForTemplate(activeId, sectionsWithBackToTop as any);
      const normalizedSections = ensureTemplateSections(template[0] ?? null, sectionsWithFaq as any);

      applyPageConfigCacheHeaders();
      return res.json({
        fontPreset: settings[0]?.fontPreset ?? "inter",
        template: normalizeCanvasTemplate(template[0] ?? null) ?? null,
        sections: normalizedSections.filter((s) => s.isVisible),
      });
    } catch (err) {
      console.error("Error in GET /api/public/page-config", err);
      return res.status(500).json({ error: "Failed to load page config" });
    }
  });

  app.post("/api/admin/canvas/seed", requireAdminPageAccess("landing-page"), async (_req: Request, res: Response) => {
    try {
      const existingTemplates = await db.select().from(pageTemplates);
      const maisonTemplateValues = {
        name: "Rare Atelier Official",
        slug: "maison-nocturne",
        tier: "premium",
        priceNpr: 0,
        isPurchased: true,
        description: "A cinematic luxury editorial homepage for Rare Atelier.",
      } as const;
      const nikeshTemplateValues = {
        name: "Nikesh Design",
        slug: "nikeshdesign",
        tier: "premium",
        priceNpr: 0,
        isPurchased: true,
        thumbnailUrl: "/images/landingpage3.webp",
        description: "A full editorial homepage based on the Rare Atelier luxury sample layout.",
      } as const;
      const maisonSections = [
        {
          sectionType: "hero",
          label: "Hero Story",
          orderIndex: 1,
          isVisible: true,
          config: {
            variant: "maison-nocturne",
            slides: MAISON_NOCTURNE_DEFAULT_HERO_SLIDES,
          },
        },
        {
          sectionType: "ticker",
          label: "Gold Ticker",
          orderIndex: 2,
          isVisible: true,
          config: {
            items: [
              "New Arrivals — SS 2025",
              "Free Shipping NPR 5,000+",
              "Dragon Hoodie — Back in Stock",
              "New Footwear Drop",
              "Basics Collar Jacket · Limited",
              "Authenticity in Motion",
            ],
          },
        },
        {
          sectionType: "featured",
          label: "Featured Products",
          orderIndex: 3,
          isVisible: true,
          config: {
            variant: "maison-nocturne",
            label: "Featured Products",
            title: "Curated silhouettes for the new season.",
            hint: "Drag to explore",
          },
        },
        {
          sectionType: "campaign",
          label: "Editorial Lookbook",
          orderIndex: 4,
          isVisible: true,
          config: {
            variant: "maison-nocturne-lookbook",
          },
        },
        {
          sectionType: "quote",
          label: "Brand Statement",
          orderIndex: 5,
          isVisible: true,
          config: {
            variant: "maison-nocturne-statement",
            text: "Craft without compromise. Style without explanation.",
            attribution: "Rare Atelier — Authenticity in Motion",
          },
        },
      ] as const;
      const nikeshSections = [
        {
          sectionType: "hero",
          label: "Story Hero",
          orderIndex: 1,
          isVisible: true,
          config: {
            variant: "nikeshdesign",
            slides: [
              {
                tag: "W'25 / Archive",
                headline: "Beyond Trends.",
                body: "Authenticity in Motion",
                ctaLabel: "Explore Shop",
                ctaHref: "/products",
              },
              {
                tag: "New Arrival · SS25",
                headline: "Basics Collar Jacket",
                body: "Unisex · Limited Edition",
                ctaLabel: "Shop Now",
                ctaHref: "/products",
              },
              {
                tag: "Lookbook",
                headline: "Street Atelier",
                body: "Where craft meets the city",
                ctaLabel: "View Collection",
                ctaHref: "/new-collection",
              },
              {
                tag: "Footwear",
                headline: "Ground Work.",
                body: "Every step — considered",
                ctaLabel: "Shop Footwear",
                ctaHref: "/products?category=footwear",
              },
            ],
          },
        },
        {
          sectionType: "ticker",
          label: "Ticker Marquee",
          orderIndex: 2,
          isVisible: true,
          config: {
            items: [
              "New Arrivals — SS 2025",
              "Free Shipping NPR 5,000+",
              "Dragon Hoodie — Back in Stock",
              "New Footwear Drop",
              "Basics Collar Jacket · Limited",
              "Authenticity in Motion",
            ],
          },
        },
        {
          sectionType: "featured",
          label: "Featured Products",
          orderIndex: 3,
          isVisible: true,
          config: {
            variant: "nikeshdesign-featured",
            label: "Featured Products",
            title: "Luxury essentials selected from the current Rare collection.",
            hint: "Drag to explore →",
          },
        },
        {
          sectionType: "campaign",
          label: "Editorial Grid",
          orderIndex: 4,
          isVisible: true,
          config: {
            variant: "nikeshdesign-lookbook",
          },
        },
        {
          sectionType: "quote",
          label: "Brand Statement",
          orderIndex: 5,
          isVisible: true,
          config: {
            variant: "nikeshdesign-statement",
            text: "Craft without compromise. Style without explanation.",
            attribution: "Rare Atelier — Authenticity in Motion",
          },
        },
      ] as const;

      if (existingTemplates.length > 0) {
        let totalTemplates = existingTemplates.length;
        const existingMaison = existingTemplates.find((template) => template.slug === "maison-nocturne");
        const existingNikesh = existingTemplates.find((template) => template.slug === "nikeshdesign");

        if (!existingMaison) {
          const [maisonNocturne] = await db
            .insert(pageTemplates)
            .values(maisonTemplateValues)
            .returning();

          await db.insert(pageSections).values(
            maisonSections.map((section) => ({
              templateId: maisonNocturne.id,
              ...section,
            })),
          );

          totalTemplates += 1;
        }

        if (!existingNikesh) {
          const [nikeshDesign] = await db
            .insert(pageTemplates)
            .values(nikeshTemplateValues)
            .returning();

          await db.insert(pageSections).values(
            nikeshSections.map((section) => ({
              templateId: nikeshDesign.id,
              ...section,
            })),
          );

          totalTemplates += 1;
        }

        return res.json({ seeded: true, templates: totalTemplates, existing: true });
      }

      const [rareDarkLuxury] = await db
        .insert(pageTemplates)
        .values({
          name: "RARE Dark Luxury",
          slug: "rare-dark-luxury",
          tier: "premium",
          priceNpr: 0,
          isPurchased: true,
          description: "The original RARE.NP dark editorial homepage",
        })
        .returning();

      const [cleanMinimal] = await db
        .insert(pageTemplates)
        .values({
          name: "Clean Minimal",
          slug: "clean-minimal",
          tier: "free",
          priceNpr: 0,
          isPurchased: true,
          description: "Simple, clean white layout. Fast and lightweight.",
        })
        .returning();

      const [editorialGrid] = await db
        .insert(pageTemplates)
        .values({
          name: "Rare Atelier Draft",
          slug: "editorial-grid",
          tier: "free",
          priceNpr: 0,
          isPurchased: true,
          description: "Magazine-style draft layout with bold typography.",
        })
        .returning();

      const [maisonNocturne] = await db
        .insert(pageTemplates)
        .values(maisonTemplateValues)
        .returning();
      const [nikeshDesign] = await db
        .insert(pageTemplates)
        .values(nikeshTemplateValues)
        .returning();

      await db.insert(pageSections).values([
        { templateId: rareDarkLuxury.id, sectionType: "hero", label: "Hero", orderIndex: 1, isVisible: true, config: { variant: "dark-cinematic" } },
        { templateId: rareDarkLuxury.id, sectionType: "quote", label: "Quote Section", orderIndex: 2, isVisible: true, config: { text: "Wear the rare ones." } },
        { templateId: rareDarkLuxury.id, sectionType: "featured", label: "Featured Collection", orderIndex: 3, isVisible: true, config: {} },
        { templateId: rareDarkLuxury.id, sectionType: "campaign", label: "Campaign Banner", orderIndex: 4, isVisible: true, config: {} },
        { templateId: rareDarkLuxury.id, sectionType: "arrivals", label: "New Arrivals", orderIndex: 5, isVisible: true, config: {} },
        { templateId: rareDarkLuxury.id, sectionType: "services", label: "Our Services", orderIndex: 6, isVisible: true, config: {} },

        { templateId: cleanMinimal.id, sectionType: "hero", label: "Simple Hero", orderIndex: 1, isVisible: true, config: { variant: "light-centered" } },
        { templateId: cleanMinimal.id, sectionType: "featured", label: "Featured Products", orderIndex: 2, isVisible: true, config: {} },
        { templateId: cleanMinimal.id, sectionType: "services", label: "Services", orderIndex: 3, isVisible: true, config: {} },
        { templateId: cleanMinimal.id, sectionType: "arrivals", label: "New Arrivals", orderIndex: 4, isVisible: true, config: {} },

        { templateId: editorialGrid.id, sectionType: "hero", label: "Editorial Hero", orderIndex: 1, isVisible: true, config: { variant: "editorial" } },
        { templateId: editorialGrid.id, sectionType: "arrivals", label: "New Arrivals Grid", orderIndex: 2, isVisible: true, config: {} },
        { templateId: editorialGrid.id, sectionType: "quote", label: "Pull Quote", orderIndex: 3, isVisible: true, config: {} },
        { templateId: editorialGrid.id, sectionType: "featured", label: "Featured Collection", orderIndex: 4, isVisible: true, config: {} },

        ...maisonSections.map((section) => ({
          templateId: maisonNocturne.id,
          ...section,
        })),
        ...nikeshSections.map((section) => ({
          templateId: nikeshDesign.id,
          ...section,
        })),
      ]);

      await db.insert(siteSettings).values({
        activeTemplateId: rareDarkLuxury.id,
        publishedAt: new Date(),
      });

      return res.json({ seeded: true, templates: 5 });
    } catch (err) {
      console.error("Error in POST /api/admin/canvas/seed", err);
      return res.status(500).json({ error: "Failed to seed canvas templates" });
    }
  });

  app.get("/api/admin/canvas/templates", requireAdminPageAccess("landing-page"), async (_req: Request, res: Response) => {
    try {
      const templates = await db
        .select()
        .from(pageTemplates)
        .orderBy(pageTemplates.tier, pageTemplates.name);
      return res.json(templates.map((template) => normalizeCanvasTemplate(template)));
    } catch (err) {
      console.error("Error in GET /api/admin/canvas/templates", err);
      return res.status(500).json({ error: "Failed to load templates" });
    }
  });

  app.get("/api/admin/canvas/templates/:id/sections", requireAdminPageAccess("landing-page"), async (req: Request, res: Response) => {
    try {
      const rawId = req.params.id;
      const id = Array.isArray(rawId) ? rawId[0] : rawId;
      const [template] = await db
        .select()
        .from(pageTemplates)
        .where(eq(pageTemplates.id, parseInt(id)))
        .limit(1);
      const sections = await db
        .select()
        .from(pageSections)
        .where(and(eq(pageSections.templateId, parseInt(id)), sql`${pageSections.pageId} IS NULL`))
        .orderBy(pageSections.orderIndex);
      const parsedId = parseInt(id);
      const sectionsWithBackToTop = await ensureBackToTopSectionForTemplate(parsedId, sections as any);
      const sectionsWithFaq = await ensureFaqSectionForTemplate(parsedId, sectionsWithBackToTop);
      return res.json(ensureTemplateSections(template ?? null, sectionsWithFaq as any));
    } catch (err) {
      console.error("Error in GET /api/admin/canvas/templates/:id/sections", err);
      return res.status(500).json({ error: "Failed to load sections" });
    }
  });

  app.patch("/api/admin/canvas/templates/:id/activate", requireAdminPageAccess("landing-page"), async (req: Request, res: Response) => {
    try {
      const rawId = req.params.id;
      const id = Array.isArray(rawId) ? rawId[0] : rawId;
      const publishedBy = (req.user as Express.User | undefined)?.id ?? null;
      const existing = await getSiteSettingsCompat();

      if (existing.length > 0) {
        await db
          .update(siteSettings)
          .set({
            activeTemplateId: parseInt(id),
            publishedAt: new Date(),
            publishedBy,
            updatedAt: new Date(),
          })
          .where(eq(siteSettings.id, existing[0].id));
      } else {
        await db.insert(siteSettings).values({
          activeTemplateId: parseInt(id),
          publishedAt: new Date(),
        });
      }

      return res.json({ success: true });
    } catch (err) {
      console.error("Error in PATCH /api/admin/canvas/templates/:id/activate", err);
      return res.status(500).json({ error: "Failed to activate template" });
    }
  });

  app.patch("/api/admin/canvas/sections/:id", requireAdminPageAccess("landing-page"), async (req: Request, res: Response) => {
    try {
      const rawId = req.params.id;
      const id = Array.isArray(rawId) ? rawId[0] : rawId;
      const { isVisible, config, orderIndex, label } = req.body;
      const updateData: any = { updatedAt: new Date() };
      if (isVisible !== undefined) updateData.isVisible = isVisible;
      if (config !== undefined) updateData.config = config;
      if (orderIndex !== undefined) updateData.orderIndex = orderIndex;
      if (label !== undefined) updateData.label = label;

      const [updated] = await db
        .update(pageSections)
        .set(updateData)
        .where(eq(pageSections.id, parseInt(id)))
        .returning();

      return res.json(updated);
    } catch (err) {
      console.error("Error in PATCH /api/admin/canvas/sections/:id", err);
      return res.status(500).json({ error: "Failed to update section" });
    }
  });

  app.patch(
    "/api/admin/canvas/sections/reorder",
    requireAdminPageAccess("landing-page"),
    validateRequest(z.object({ orderedIds: z.array(z.number()).min(1) })),
    async (req: Request, res: Response) => {
      try {
        const { orderedIds } = req.body as { orderedIds: number[] };
        await db.transaction(async (tx) => {
          await Promise.all(
            orderedIds.map((id, index) =>
              tx
                .update(pageSections)
                .set({ orderIndex: index + 1, updatedAt: new Date() })
                .where(eq(pageSections.id, id)),
            ),
          );
        });
        return res.json({ success: true });
      } catch (err) {
        console.error("Error in PATCH /api/admin/canvas/sections/reorder", err);
        return res.status(500).json({ error: "Failed to reorder sections" });
      }
    },
  );

  app.post("/api/admin/canvas/templates/:id/sections", requireAdminPageAccess("landing-page"), async (req: Request, res: Response) => {
    try {
      const rawId = req.params.id;
      const id = Array.isArray(rawId) ? rawId[0] : rawId;
      const { sectionType, label, orderIndex, config } = req.body;

      const [newSection] = await db
        .insert(pageSections)
        .values({
          templateId: parseInt(id),
          sectionType,
          label: label ?? sectionType,
          orderIndex: orderIndex ?? 99,
          isVisible: true,
          config: config ?? {},
        })
        .returning();

      return res.json(newSection);
    } catch (err) {
      console.error("Error in POST /api/admin/canvas/templates/:id/sections", err);
      return res.status(500).json({ error: "Failed to create section" });
    }
  });

  app.post("/api/admin/canvas/sections/:id/duplicate", requireAdminPageAccess("landing-page"), async (req: Request, res: Response) => {
    try {
      const rawId = req.params.id;
      const id = Array.isArray(rawId) ? rawId[0] : rawId;
      const [existing] = await db
        .select()
        .from(pageSections)
        .where(eq(pageSections.id, parseInt(id)))
        .limit(1);

      if (!existing) {
        return res.status(404).json({ error: "Section not found" });
      }

      const siblingSections = await db
        .select()
        .from(pageSections)
        .where(
          existing.templateId
            ? and(eq(pageSections.templateId, existing.templateId), sql`${pageSections.pageId} IS NULL`)
            : and(eq(pageSections.pageId, Number(existing.pageId)), sql`${pageSections.templateId} IS NULL`)
        )
        .orderBy(pageSections.orderIndex);

      const nextOrderIndex =
        siblingSections.reduce((max, section) => Math.max(max, section.orderIndex ?? 0), 0) + 1;

      const [duplicate] = await db
        .insert(pageSections)
        .values({
          templateId: existing.templateId,
          pageId: existing.pageId,
          sectionType: existing.sectionType,
          label: existing.label ? `${existing.label} Copy` : `${existing.sectionType} Copy`,
          orderIndex: nextOrderIndex,
          isVisible: existing.isVisible,
          config: existing.config ?? {},
        })
        .returning();

      return res.json(duplicate);
    } catch (err) {
      console.error("Error in POST /api/admin/canvas/sections/:id/duplicate", err);
      return res.status(500).json({ error: "Failed to duplicate section" });
    }
  });

  app.patch("/api/admin/canvas/sections/:id/move-template", requireAdminPageAccess("landing-page"), async (req: Request, res: Response) => {
    try {
      const rawId = req.params.id;
      const id = Array.isArray(rawId) ? rawId[0] : rawId;
      const targetTemplateId = Number(req.body?.templateId);

      if (!Number.isFinite(targetTemplateId)) {
        return res.status(400).json({ error: "templateId is required" });
      }

      const [existing] = await db
        .select()
        .from(pageSections)
        .where(eq(pageSections.id, parseInt(id)))
        .limit(1);

      if (!existing) {
        return res.status(404).json({ error: "Section not found" });
      }

      const targetSections = await db
        .select()
        .from(pageSections)
        .where(eq(pageSections.templateId, targetTemplateId))
        .orderBy(pageSections.orderIndex);

      const nextOrderIndex =
        targetSections.reduce((max, section) => Math.max(max, section.orderIndex ?? 0), 0) + 1;

      const [moved] = await db
        .update(pageSections)
        .set({
          templateId: targetTemplateId,
          orderIndex: nextOrderIndex,
          updatedAt: new Date(),
        })
        .where(eq(pageSections.id, parseInt(id)))
        .returning();

      return res.json(moved);
    } catch (err) {
      console.error("Error in PATCH /api/admin/canvas/sections/:id/move-template", err);
      return res.status(500).json({ error: "Failed to move section to another template" });
    }
  });

  app.delete("/api/admin/canvas/sections/:id", requireAdminPageAccess("landing-page"), async (req: Request, res: Response) => {
    try {
      const rawId = req.params.id;
      const id = Array.isArray(rawId) ? rawId[0] : rawId;
      await db
        .delete(pageSections)
        .where(eq(pageSections.id, parseInt(id)));
      return res.json({ success: true });
    } catch (err) {
      console.error("Error in DELETE /api/admin/canvas/sections/:id", err);
      return res.status(500).json({ error: "Failed to delete section" });
    }
  });

  app.get("/api/admin/canvas/settings", requireAdminPageAccess("landing-page"), async (_req: Request, res: Response) => {
    try {
      const settings = await getSiteSettingsCompat();

      const activeTemplate = settings[0]?.activeTemplateId
        ? await db
            .select()
            .from(pageTemplates)
            .where(eq(pageTemplates.id, settings[0].activeTemplateId))
            .limit(1)
        : [];

      return res.json({
        ...settings[0],
        activeTemplate: normalizeCanvasTemplate(activeTemplate[0] ?? null) ?? null,
      });
    } catch (err) {
      console.error("Error in GET /api/admin/canvas/settings", err);
      return res.status(500).json({ error: "Failed to load canvas settings" });
    }
  });

  app.patch("/api/admin/canvas/settings", requireAdminPageAccess("landing-page"), async (req: Request, res: Response) => {
    try {
      const fontPreset =
        typeof req.body?.fontPreset === "string" && req.body.fontPreset.trim()
          ? req.body.fontPreset.trim()
          : "inter";
      const updatedAt = new Date();
      const existing = await getSiteSettingsCompat();
      const hasFontPresetColumn = await siteSettingsHasFontPresetColumn();

      if (existing.length > 0) {
        await db
          .update(siteSettings)
          .set({
            updatedAt,
            ...(hasFontPresetColumn ? { fontPreset } : {}),
          })
          .where(eq(siteSettings.id, existing[0].id))
          .returning({ id: siteSettings.id });

        const [updated] = await getSiteSettingsCompat();
        return res.json({
          ...updated,
          fontPreset: hasFontPresetColumn ? updated?.fontPreset ?? "inter" : fontPreset,
        });
      }

      await db
        .insert(siteSettings)
        .values({
          updatedAt,
          ...(hasFontPresetColumn ? { fontPreset } : {}),
        })
        .returning({ id: siteSettings.id });

      const [created] = await getSiteSettingsCompat();
      return res.json({
        ...created,
        fontPreset: hasFontPresetColumn ? created?.fontPreset ?? "inter" : fontPreset,
      });
    } catch (err) {
      console.error("Error in PATCH /api/admin/canvas/settings", err);
      return res.status(500).json({ error: "Failed to update canvas settings" });
    }
  });

  // ─── Pages CRUD ──────────────────────────────────────────────

  app.get("/api/admin/canvas/pages", requireAdminPageAccess("landing-page"), async (_req: Request, res: Response) => {
    try {
      const allPages = await db.select().from(pages).orderBy(pages.sortOrder, pages.title);
      return res.json(allPages);
    } catch (err) {
      console.error("Error in GET /api/admin/canvas/pages", err);
      return res.status(500).json({ error: "Failed to load pages" });
    }
  });

  app.post("/api/admin/canvas/pages", requireAdminPageAccess("landing-page"), async (req: Request, res: Response) => {
    try {
      const { title, slug, fromTemplateId } = req.body as { title: string; slug: string; fromTemplateId?: number };
      const normalizedSlug = slug.startsWith("/") ? slug : `/${slug}`;

      const [newPage] = await db
        .insert(pages)
        .values({
          title,
          slug: normalizedSlug,
          status: "draft",
          isHomepage: normalizedSlug === "/",
          showInNav: true,
          sortOrder: 0,
        })
        .returning();

      if (fromTemplateId) {
        const templateSections = await db
          .select()
          .from(pageSections)
          .where(and(eq(pageSections.templateId, fromTemplateId), sql`${pageSections.pageId} IS NULL`))
          .orderBy(pageSections.orderIndex);

        if (templateSections.length > 0) {
          await db.insert(pageSections).values(
            templateSections.map((s) => ({
              pageId: newPage.id,
              sectionType: s.sectionType,
              label: s.label,
              orderIndex: s.orderIndex,
              isVisible: s.isVisible,
              config: s.config,
            }))
          );
        }
      }

      return res.json(newPage);
    } catch (err) {
      console.error("Error in POST /api/admin/canvas/pages", err);
      return res.status(500).json({ error: "Failed to create page" });
    }
  });

  app.get("/api/admin/canvas/pages/:id", requireAdminPageAccess("landing-page"), async (req: Request, res: Response) => {
    try {
      const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id);
      const [page] = await db.select().from(pages).where(eq(pages.id, id)).limit(1);
      if (!page) return res.status(404).json({ error: "Page not found" });

      const pageSectionsList = await db
        .select()
        .from(pageSections)
        .where(and(eq(pageSections.pageId, id), sql`${pageSections.templateId} IS NULL`))
        .orderBy(pageSections.orderIndex);

      return res.json({ ...page, sections: pageSectionsList });
    } catch (err) {
      console.error("Error in GET /api/admin/canvas/pages/:id", err);
      return res.status(500).json({ error: "Failed to load page" });
    }
  });

  app.patch("/api/admin/canvas/pages/:id", requireAdminPageAccess("landing-page"), async (req: Request, res: Response) => {
    try {
      const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id);
      const { title, slug, description, status, showInNav, sortOrder, seoTitle, seoDescription, seoImage } = req.body as any;
      const updateData: any = { updatedAt: new Date() };
      if (title !== undefined) updateData.title = title;
      if (slug !== undefined) updateData.slug = slug.startsWith("/") ? slug : `/${slug}`;
      if (description !== undefined) updateData.description = description;
      if (status !== undefined) updateData.status = status;
      if (showInNav !== undefined) updateData.showInNav = showInNav;
      if (sortOrder !== undefined) updateData.sortOrder = sortOrder;
      if (seoTitle !== undefined) updateData.seoTitle = seoTitle;
      if (seoDescription !== undefined) updateData.seoDescription = seoDescription;
      if (seoImage !== undefined) updateData.seoImage = seoImage;

      const [updated] = await db.update(pages).set(updateData).where(eq(pages.id, id)).returning();
      return res.json(updated);
    } catch (err) {
      console.error("Error in PATCH /api/admin/canvas/pages/:id", err);
      return res.status(500).json({ error: "Failed to update page" });
    }
  });

  app.delete("/api/admin/canvas/pages/:id", requireAdminPageAccess("landing-page"), async (req: Request, res: Response) => {
    try {
      const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id);
      const [page] = await db.select().from(pages).where(eq(pages.id, id)).limit(1);
      if (!page) return res.status(404).json({ error: "Page not found" });
      if (page.isHomepage) return res.status(400).json({ error: "Cannot delete the home page" });

      await db.delete(pages).where(eq(pages.id, id));
      return res.json({ success: true });
    } catch (err) {
      console.error("Error in DELETE /api/admin/canvas/pages/:id", err);
      return res.status(500).json({ error: "Failed to delete page" });
    }
  });

  app.post("/api/admin/canvas/pages/:id/duplicate", requireAdminPageAccess("landing-page"), async (req: Request, res: Response) => {
    try {
      const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id);
      const [original] = await db.select().from(pages).where(eq(pages.id, id)).limit(1);
      if (!original) return res.status(404).json({ error: "Page not found" });

      const [dup] = await db
        .insert(pages)
        .values({
          title: `${original.title} (Copy)`,
          slug: `${original.slug === "/" ? "/copy" : original.slug + "-copy"}-${Date.now()}`,
          description: original.description,
          status: "draft",
          isHomepage: false,
          showInNav: original.showInNav,
          sortOrder: original.sortOrder + 1,
          seoTitle: original.seoTitle,
          seoDescription: original.seoDescription,
          seoImage: original.seoImage,
        })
        .returning();

      const origSections = await db.select().from(pageSections).where(and(eq(pageSections.pageId, id), sql`${pageSections.templateId} IS NULL`)).orderBy(pageSections.orderIndex);
      if (origSections.length > 0) {
        await db.insert(pageSections).values(origSections.map((s) => ({ pageId: dup.id, sectionType: s.sectionType, label: s.label, orderIndex: s.orderIndex, isVisible: s.isVisible, config: s.config })));
      }

      return res.json(dup);
    } catch (err) {
      console.error("Error in POST /api/admin/canvas/pages/:id/duplicate", err);
      return res.status(500).json({ error: "Failed to duplicate page" });
    }
  });

  app.patch("/api/admin/canvas/pages/reorder", requireAdminPageAccess("landing-page"), validateRequest(z.object({ orderedIds: z.array(z.number()).min(1) })), async (req: Request, res: Response) => {
    try {
      const { orderedIds } = req.body as { orderedIds: number[] };
      await db.transaction(async (tx) => {
        await Promise.all(orderedIds.map((id, index) => tx.update(pages).set({ sortOrder: index + 1 }).where(eq(pages.id, id))));
      });
      return res.json({ success: true });
    } catch (err) {
      console.error("Error in PATCH /api/admin/canvas/pages/reorder", err);
      return res.status(500).json({ error: "Failed to reorder pages" });
    }
  });

  app.patch("/api/admin/canvas/pages/:id/publish", requireAdminPageAccess("landing-page"), async (req: Request, res: Response) => {
    try {
      const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id);
      const [page] = await db.select().from(pages).where(eq(pages.id, id)).limit(1);
      if (!page) return res.status(404).json({ error: "Page not found" });

      const newStatus = page.status === "published" ? "draft" : "published";
      const [updated] = await db.update(pages).set({ status: newStatus, updatedAt: new Date() }).where(eq(pages.id, id)).returning();
      return res.json(updated);
    } catch (err) {
      console.error("Error in PATCH /api/admin/canvas/pages/:id/publish", err);
      return res.status(500).json({ error: "Failed to toggle publish status" });
    }
  });

  app.post("/api/admin/canvas/pages/:id/preview-token", requireAdminPageAccess("landing-page"), async (req: Request, res: Response) => {
    try {
      const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id);
      const [page] = await db.select().from(pages).where(eq(pages.id, id)).limit(1);
      if (!page) return res.status(404).json({ error: "Page not found" });

      const token = crypto.randomBytes(32).toString("hex");
      const expiresAt = Date.now() + PREVIEW_TOKEN_TTL_MS;
      previewTokens.set(token, { pageId: id, expiresAt });

      return res.json({ token });
    } catch (err) {
      console.error("Error in POST /api/admin/canvas/pages/:id/preview-token", err);
      return res.status(500).json({ error: "Failed to generate preview token" });
    }
  });

  // ─── Page Sections ───────────────────────────────────────────

  app.get("/api/admin/canvas/pages/:id/sections", requireAdminPageAccess("landing-page"), async (req: Request, res: Response) => {
    try {
      const pageId = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id);
      const sections = await db
        .select()
        .from(pageSections)
        .where(and(eq(pageSections.pageId, pageId), sql`${pageSections.templateId} IS NULL`))
        .orderBy(pageSections.orderIndex);
      return res.json(sections);
    } catch (err) {
      console.error("Error in GET /api/admin/canvas/pages/:id/sections", err);
      return res.status(500).json({ error: "Failed to load sections" });
    }
  });

  app.post("/api/admin/canvas/pages/:id/sections", requireAdminPageAccess("landing-page"), async (req: Request, res: Response) => {
    try {
      const pageId = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id);
      const { sectionType, label, config } = req.body as { sectionType: string; label?: string; config?: Record<string, unknown> };

      const maxOrder = await db.select({ max: sql<number>`MAX(${pageSections.orderIndex})` }).from(pageSections).where(eq(pageSections.pageId, pageId));
      const nextOrderIndex = (maxOrder[0]?.max ?? 0) + 1;

      const [newSection] = await db
        .insert(pageSections)
        .values({ pageId, sectionType, label: label || sectionType, orderIndex: nextOrderIndex, isVisible: true, config: config ?? {} })
        .returning();
      return res.json(newSection);
    } catch (err) {
      console.error("Error in POST /api/admin/canvas/pages/:id/sections", err);
      return res.status(500).json({ error: "Failed to add section" });
    }
  });

  app.patch("/api/admin/canvas/pages/:id/sections/reorder", requireAdminPageAccess("landing-page"), validateRequest(z.object({ orderedIds: z.array(z.number()).min(1) })), async (req: Request, res: Response) => {
    try {
      const { orderedIds } = req.body as { orderedIds: number[] };
      await db.transaction(async (tx) => {
        await Promise.all(orderedIds.map((id, index) => tx.update(pageSections).set({ orderIndex: index + 1, updatedAt: new Date() }).where(eq(pageSections.id, id))));
      });
      return res.json({ success: true });
    } catch (err) {
      console.error("Error in PATCH /api/admin/canvas/pages/:id/sections/reorder", err);
      return res.status(500).json({ error: "Failed to reorder sections" });
    }
  });

  app.patch("/api/admin/canvas/pages/:pageId/sections/:sid", requireAdminPageAccess("landing-page"), async (req: Request, res: Response) => {
    try {
      const sid = parseInt(Array.isArray(req.params.sid) ? req.params.sid[0] : req.params.sid);
      const { isVisible, config, orderIndex, label } = req.body as any;
      const updateData: any = { updatedAt: new Date() };
      if (isVisible !== undefined) updateData.isVisible = isVisible;
      if (config !== undefined) updateData.config = config;
      if (orderIndex !== undefined) updateData.orderIndex = orderIndex;
      if (label !== undefined) updateData.label = label;

      const [updated] = await db.update(pageSections).set(updateData).where(eq(pageSections.id, sid)).returning();
      return res.json(updated);
    } catch (err) {
      console.error("Error in PATCH /api/admin/canvas/pages/:pageId/sections/:sid", err);
      return res.status(500).json({ error: "Failed to update section" });
    }
  });

  app.delete("/api/admin/canvas/pages/:pageId/sections/:sid", requireAdminPageAccess("landing-page"), async (req: Request, res: Response) => {
    try {
      const sid = parseInt(Array.isArray(req.params.sid) ? req.params.sid[0] : req.params.sid);
      await db.delete(pageSections).where(eq(pageSections.id, sid));
      return res.json({ success: true });
    } catch (err) {
      console.error("Error in DELETE /api/admin/canvas/pages/:pageId/sections/:sid", err);
      return res.status(500).json({ error: "Failed to delete section" });
    }
  });

  // ─── Enhanced Templates ──────────────────────────────────────

  app.post("/api/admin/canvas/templates", requireAdminPageAccess("landing-page"), async (req: Request, res: Response) => {
    try {
      const { name, slug, description, tier, fromPageId } = req.body as { name: string; slug: string; description?: string; tier?: string; fromPageId?: number };
      const userId = (req.user as Express.User | undefined)?.id ?? null;

      const [newTemplate] = await db
        .insert(pageTemplates)
        .values({ name, slug, description, tier: tier || "free", isCustom: true, createdBy: userId })
        .returning();

      if (fromPageId) {
        const pageSectionsList = await db
          .select()
          .from(pageSections)
          .where(and(eq(pageSections.pageId, fromPageId), sql`${pageSections.templateId} IS NULL`))
          .orderBy(pageSections.orderIndex);

        if (pageSectionsList.length > 0) {
          await db.insert(pageSections).values(
            pageSectionsList.map((s) => ({
              templateId: newTemplate.id,
              sectionType: s.sectionType,
              label: s.label,
              orderIndex: s.orderIndex,
              isVisible: s.isVisible,
              config: s.config,
            }))
          );
        }
      }

      return res.json(newTemplate);
    } catch (err) {
      console.error("Error in POST /api/admin/canvas/templates", err);
      return res.status(500).json({ error: "Failed to create template" });
    }
  });

  app.patch("/api/admin/canvas/templates/:id", requireAdminPageAccess("landing-page"), async (req: Request, res: Response) => {
    try {
      const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id);
      const { name, description, tier, thumbnailUrl } = req.body as any;
      const updateData: any = {};
      if (name !== undefined) updateData.name = name;
      if (description !== undefined) updateData.description = description;
      if (tier !== undefined) updateData.tier = tier;
      if (thumbnailUrl !== undefined) updateData.thumbnailUrl = thumbnailUrl;

      const [updated] = await db.update(pageTemplates).set(updateData).where(eq(pageTemplates.id, id)).returning();
      return res.json(updated);
    } catch (err) {
      console.error("Error in PATCH /api/admin/canvas/templates/:id", err);
      return res.status(500).json({ error: "Failed to update template" });
    }
  });

  app.delete("/api/admin/canvas/templates/:id", requireAdminPageAccess("landing-page"), async (req: Request, res: Response) => {
    try {
      const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id);
      const [template] = await db.select().from(pageTemplates).where(eq(pageTemplates.id, id)).limit(1);
      if (!template) return res.status(404).json({ error: "Template not found" });
      if (!template.isCustom) return res.status(403).json({ error: "Cannot delete seeded templates" });

      await db.delete(pageTemplates).where(eq(pageTemplates.id, id));
      return res.json({ success: true });
    } catch (err) {
      console.error("Error in DELETE /api/admin/canvas/templates/:id", err);
      return res.status(500).json({ error: "Failed to delete template" });
    }
  });

  app.post("/api/admin/canvas/templates/:id/duplicate", requireAdminPageAccess("landing-page"), async (req: Request, res: Response) => {
    try {
      const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id);
      const [original] = await db.select().from(pageTemplates).where(eq(pageTemplates.id, id)).limit(1);
      if (!original) return res.status(404).json({ error: "Template not found" });

      const [dup] = await db
        .insert(pageTemplates)
        .values({
          name: `${original.name} (Copy)`,
          slug: `${original.slug}-copy-${Date.now()}`,
          description: original.description,
          thumbnailUrl: original.thumbnailUrl,
          tier: original.tier,
          priceNpr: original.priceNpr,
          isCustom: true,
        })
        .returning();

      const origSections = await db.select().from(pageSections).where(and(eq(pageSections.templateId, id), sql`${pageSections.pageId} IS NULL`)).orderBy(pageSections.orderIndex);
      if (origSections.length > 0) {
        await db.insert(pageSections).values(origSections.map((s) => ({ templateId: dup.id, sectionType: s.sectionType, label: s.label, orderIndex: s.orderIndex, isVisible: s.isVisible, config: s.config })));
      }

      return res.json(dup);
    } catch (err) {
      console.error("Error in POST /api/admin/canvas/templates/:id/duplicate", err);
      return res.status(500).json({ error: "Failed to duplicate template" });
    }
  });

  app.post("/api/admin/canvas/pages/:id/save-as-template", requireAdminPageAccess("landing-page"), async (req: Request, res: Response) => {
    try {
      const pageId = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id);
      const { name, slug, tier } = req.body as { name: string; slug: string; tier?: string };
      const userId = (req.user as Express.User | undefined)?.id ?? null;

      const [page] = await db.select().from(pages).where(eq(pages.id, pageId)).limit(1);
      if (!page) return res.status(404).json({ error: "Page not found" });

      const [newTemplate] = await db
        .insert(pageTemplates)
        .values({ name, slug, description: page.description, tier: tier || "free", isCustom: true, createdBy: userId })
        .returning();

      const pageSectionsList = await db.select().from(pageSections).where(and(eq(pageSections.pageId, pageId), sql`${pageSections.templateId} IS NULL`)).orderBy(pageSections.orderIndex);
      if (pageSectionsList.length > 0) {
        await db.insert(pageSections).values(pageSectionsList.map((s) => ({ templateId: newTemplate.id, sectionType: s.sectionType, label: s.label, orderIndex: s.orderIndex, isVisible: s.isVisible, config: s.config })));
      }

      return res.json(newTemplate);
    } catch (err) {
      console.error("Error in POST /api/admin/canvas/pages/:id/save-as-template", err);
      return res.status(500).json({ error: "Failed to save as template" });
    }
  });

  // ─── Branding ────────────────────────────────────────────────

  app.get("/api/admin/canvas/branding", requireAdminPageAccess("landing-page"), async (_req: Request, res: Response) => {
    try {
      const branding = await db.select().from(siteBranding).limit(1);
      return res.json(branding[0] ?? null);
    } catch (err) {
      console.error("Error in GET /api/admin/canvas/branding", err);
      return res.status(500).json({ error: "Failed to load branding" });
    }
  });

  app.patch("/api/admin/canvas/branding", requireAdminPageAccess("landing-page"), async (req: Request, res: Response) => {
    try {
      const data = req.body as any;
      const existing = await db.select().from(siteBranding).limit(1);

      let result;
      if (existing.length > 0) {
        [result] = await db.update(siteBranding).set({ ...data, updatedAt: new Date() }).where(eq(siteBranding.id, existing[0].id)).returning();
      } else {
        [result] = await db.insert(siteBranding).values(data).returning();
      }
      return res.json(result);
    } catch (err) {
      console.error("Error in PATCH /api/admin/canvas/branding", err);
      return res.status(500).json({ error: "Failed to update branding" });
    }
  });

  // ─── Colors ──────────────────────────────────────────────────

  app.get("/api/admin/canvas/colors", requireAdminPageAccess("landing-page"), async (_req: Request, res: Response) => {
    try {
      const colors = await db.select().from(siteColors).orderBy(siteColors.presetName);
      return res.json(colors);
    } catch (err) {
      console.error("Error in GET /api/admin/canvas/colors", err);
      return res.status(500).json({ error: "Failed to load colors" });
    }
  });

  app.post("/api/admin/canvas/colors", requireAdminPageAccess("landing-page"), async (req: Request, res: Response) => {
    try {
      const data = req.body as any;
      if (data.isActive) {
        await db.update(siteColors).set({ isActive: false }).where(sql`1=1`);
      }
      const [created] = await db.insert(siteColors).values(data).returning();
      return res.json(created);
    } catch (err) {
      console.error("Error in POST /api/admin/canvas/colors", err);
      return res.status(500).json({ error: "Failed to create color preset" });
    }
  });

  app.patch("/api/admin/canvas/colors/:id", requireAdminPageAccess("landing-page"), async (req: Request, res: Response) => {
    try {
      const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id);
      const data = req.body as any;
      const [updated] = await db.update(siteColors).set(data).where(eq(siteColors.id, id)).returning();
      return res.json(updated);
    } catch (err) {
      console.error("Error in PATCH /api/admin/canvas/colors/:id", err);
      return res.status(500).json({ error: "Failed to update color preset" });
    }
  });

  app.patch("/api/admin/canvas/colors/:id/activate", requireAdminPageAccess("landing-page"), async (req: Request, res: Response) => {
    try {
      const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id);
      await db.update(siteColors).set({ isActive: false }).where(sql`1=1`);
      const [updated] = await db.update(siteColors).set({ isActive: true }).where(eq(siteColors.id, id)).returning();
      return res.json(updated);
    } catch (err) {
      console.error("Error in PATCH /api/admin/canvas/colors/:id/activate", err);
      return res.status(500).json({ error: "Failed to activate color preset" });
    }
  });

  app.delete("/api/admin/canvas/colors/:id", requireAdminPageAccess("landing-page"), async (req: Request, res: Response) => {
    try {
      const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id);
      const [color] = await db.select().from(siteColors).where(eq(siteColors.id, id)).limit(1);
      if (!color) return res.status(404).json({ error: "Color preset not found" });
      if (color.isActive) return res.status(400).json({ error: "Cannot delete active color preset" });

      await db.delete(siteColors).where(eq(siteColors.id, id));
      return res.json({ success: true });
    } catch (err) {
      console.error("Error in DELETE /api/admin/canvas/colors/:id", err);
      return res.status(500).json({ error: "Failed to delete color preset" });
    }
  });

  // ─── Public Routes ───────────────────────────────────────────

  app.get("/api/public/pages", async (_req: Request, res: Response) => {
    try {
      const publishedPages = await db
        .select()
        .from(pages)
        .where(and(eq(pages.status, "published"), eq(pages.showInNav, true)))
        .orderBy(pages.sortOrder);
      return res.json(publishedPages);
    } catch (err) {
      console.error("Error in GET /api/public/pages", err);
      return res.status(500).json({ error: "Failed to load pages" });
    }
  });

  app.get("/api/public/page-config", async (req: Request, res: Response) => {
    try {
      const slugParam = (req.query.slug as string) ?? "/";
      const templateIdParam = req.query.templateId ? parseInt(req.query.templateId as string) : null;
      const previewToken = (req.query.token as string) ?? null;

      let previewPageId: number | null = null;
      if (previewToken) {
        const tokenData = previewTokens.get(previewToken);
        if (tokenData && tokenData.expiresAt > Date.now()) {
          previewPageId = tokenData.pageId;
        }
      }

      if (templateIdParam) {
        const [template] = await db.select().from(pageTemplates).where(eq(pageTemplates.id, templateIdParam)).limit(1);
        const sections = await db.select().from(pageSections).where(and(eq(pageSections.templateId, templateIdParam), sql`${pageSections.pageId} IS NULL`)).orderBy(pageSections.orderIndex);
        const settings = await db.select().from(siteSettings).limit(1);
        return res.json({
          fontPreset: settings[0]?.fontPreset ?? "inter",
          template,
          sections: sections.filter((s) => s.isVisible),
        });
      }

      const [page] = await db.select().from(pages).where(eq(pages.slug, slugParam)).limit(1);
      if (!page) {
        if (slugParam === "/") {
          const settings = await db.select().from(siteSettings).limit(1);
          const activeId = settings[0]?.activeTemplateId;
          if (activeId) {
            const [template] = await db.select().from(pageTemplates).where(eq(pageTemplates.id, activeId)).limit(1);
            const sections = await db.select().from(pageSections).where(and(eq(pageSections.templateId, activeId), sql`${pageSections.pageId} IS NULL`)).orderBy(pageSections.orderIndex);
            return res.json({ fontPreset: settings[0]?.fontPreset ?? "inter", template, sections: sections.filter((s) => s.isVisible) });
          }
        }
        return res.status(404).json({ error: "Page not found" });
      }

      const isPreviewAuthorized = previewPageId !== null && previewPageId === page.id;

      if (page.status !== "published" && page.slug !== "/" && !isPreviewAuthorized) {
        return res.status(404).json({ error: "Page not found" });
      }

      const pageSectionsList = await db
        .select()
        .from(pageSections)
        .where(and(eq(pageSections.pageId, page.id), sql`${pageSections.templateId} IS NULL`))
        .orderBy(pageSections.orderIndex);

      const settings = await db.select().from(siteSettings).limit(1);

      return res.json({
        page,
        fontPreset: settings[0]?.fontPreset ?? "inter",
        sections: pageSectionsList.filter((s) => s.isVisible),
      });
    } catch (err) {
      console.error("Error in GET /api/public/page-config", err);
      return res.status(500).json({ error: "Failed to load page config" });
    }
  });

  app.get("/api/public/branding", async (_req: Request, res: Response) => {
    try {
      const branding = await db.select().from(siteBranding).limit(1);
      const colors = await db.select().from(siteColors).where(eq(siteColors.isActive, true)).limit(1);
      return res.json({ branding: branding[0] ?? null, colors: colors[0] ?? null });
    } catch (err) {
      console.error("Error in GET /api/public/branding", err);
      return res.status(500).json({ error: "Failed to load branding" });
    }
  });

  app.get("/api/public/media", async (req: Request, res: Response) => {
    try {
      const category = typeof req.query.category === "string" ? req.query.category : "";
      if (!category) {
        return res.status(400).json({ success: false, error: "Missing category" });
      }
      const provider = typeof req.query.provider === "string" ? req.query.provider : null;
      const limitParam = typeof req.query.limit === "string" ? parseInt(req.query.limit, 10) : 0;
      const limit = Number.isFinite(limitParam) && limitParam > 0 ? Math.min(limitParam, 12) : 6;
      const now = new Date();

      const filters = [
        eq(mediaAssets.category, category),
        eq(mediaAssets.assetType, "file"),
        or(isNull(mediaAssets.expiresAt), gte(mediaAssets.expiresAt, now)),
        sql`${mediaAssets.url} is not null`,
      ];
      if (provider) {
        filters.push(eq(mediaAssets.provider, provider));
      }

      const assets = await db
        .select({
          id: mediaAssets.id,
          url: mediaAssets.url,
          filename: mediaAssets.filename,
          createdAt: mediaAssets.createdAt,
        })
        .from(mediaAssets)
        .where(and(...filters))
        .orderBy(desc(mediaAssets.createdAt))
        .limit(limit);

      return res.json({ success: true, data: assets });
    } catch (err) {
      console.error("Error in GET /api/public/media", err);
      return res.status(500).json({ success: false, error: "Failed to load media" });
    }
  });

  app.get("/api/public/sitemap.xml", async (_req: Request, res: Response) => {
    try {
      const baseUrl = process.env.SITE_URL || "https://rare-np-production.up.railway.app";
      const publishedPages = await db.select().from(pages).where(and(eq(pages.status, "published"), eq(pages.showInNav, true))).orderBy(pages.sortOrder);

      let xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n`;
      xml += `  <url><loc>${baseUrl}/</loc></url>\n`;
      for (const p of publishedPages) {
        if (p.slug === "/") continue;
        xml += `  <url><loc>${baseUrl}${p.slug}</loc></url>\n`;
      }
      xml += `</urlset>`;

      res.setHeader("Content-Type", "application/xml");
      return res.send(xml);
    } catch (err) {
      console.error("Error in GET /api/public/sitemap.xml", err);
      return res.status(500).json({ error: "Failed to generate sitemap" });
    }
  });

  app.post(
    "/api/auth/login",
    rateLimit(),
    validateRequest(loginSchema),
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
        adminPageAccess: user.adminPageAccess ?? [],
        profileImageUrl: user.profileImageUrl || null,
        twoFactorEnabled: !!user.twoFactorEnabled,
      },
    });
  });

  app.post(
    "/api/auth/verify-2fa",
    rateLimit(),
    validateRequest(verify2FASchema),
    createVerify2FAHandler({ storage }),
  );

  const resendOtpSchema = z.object({
    tempToken: z.string().min(1),
  });

  app.post(
    "/api/auth/resend-otp",
    rateLimit(),
    validateRequest(resendOtpSchema),
    async (req: Request, res: Response) => {
      const { tempToken } = req.body;
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
  const contactSchema = z.object({
    name: z.string().min(1),
    email: z.string().email(),
    subject: z.string().min(1),
    message: z.string().min(1),
  });

  app.post(
    "/api/contact", 
    rateLimit(), 
    validateRequest(contactSchema),
    async (req: Request, res: Response) => {
      try {
        const { name, email, subject, message } = req.body;

      const created = await storage.createContactMessage({
        name,
        email,
        phone: null,
        subject,
        message,
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
    rateLimit({ windowSec: 60, maxRequests: 20 }),
    validateRequest(z.object({
      action: z.enum(["add", "update", "remove"]),
      productName: z.string().min(1),
      size: z.string().optional(),
      color: z.string().optional(),
      quantity: z.number().int().min(1).optional(),
    })),
    async (req: Request, res: Response) => {
      try {
        const { action, productName, size, color, quantity } = req.body;

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

  app.post(
    "/api/cart/guest/sync",
    rateLimit({ windowSec: 60, maxRequests: 120 }),
    validateRequest(
      z.object({
        guestId: z.string().uuid(),
        // Guest cart payloads are normalized on the client before use.
        // The server only needs a durable snapshot, so keep this permissive.
        items: z.array(z.unknown()),
      }),
    ),
    async (req: Request, res: Response) => {
      try {
        res.set("Cache-Control", "no-store");
        await cartService.saveGuestCart(req.body.guestId, req.body.items);
        res.cookie("ra_guest_id", req.body.guestId, {
          httpOnly: false,
          sameSite: "lax",
          maxAge: 1000 * 60 * 60 * 24 * 7,
          secure: process.env.NODE_ENV === "production",
          path: "/",
        });
        return res.json({ success: true });
      } catch (err) {
        console.error("Error in POST /api/cart/guest/sync", err);
        return res.status(500).json({ success: false, error: "Failed to sync guest cart" });
      }
    },
  );

  app.get(
    "/api/cart/guest/:guestId",
    rateLimit({ windowSec: 60, maxRequests: 120 }),
    async (req: Request, res: Response) => {
      try {
        res.set("Cache-Control", "no-store");
        const guestIdParse = z.string().uuid().safeParse(req.params.guestId);
        if (!guestIdParse.success) {
          return res.status(400).json({ success: false, error: "Invalid guest id" });
        }

        const cart = await cartService.getGuestCart(guestIdParse.data);
        if (!cart) {
          return res.json({ success: true, found: false, items: [] });
        }

        return res.json({ success: true, found: true, items: cart.items });
      } catch (err) {
        console.error("Error in GET /api/cart/guest/:guestId", err);
        return res.status(500).json({ success: false, error: "Failed to load guest cart" });
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
        .where(
          and(
            eq(products.homeFeatured, true),
            eq(products.isActive, true),
            gte(products.stock, 1),
          ),
        )
        .orderBy(desc(products.updatedAt))
        .limit(4);
      res.set("Cache-Control", "public, max-age=300");
      return res.json({ success: true, data: featured });
    } catch (err) {
      console.error("Error in GET /api/products/home-featured", err);
      return res.status(500).json({ success: false, error: "Failed to load featured products" });
    }
  });

  app.get("/api/products", async (req: Request, res: Response) => {
    try {
      const { category, search, page, limit, newArrival, newCollection } = req.query;
      const products = await storage.getProducts({
        category: typeof category === "string" ? category : undefined,
        search: typeof search === "string" ? search : undefined,
        page: typeof page === "string" ? Number(page) || 1 : undefined,
        limit: typeof limit === "string" ? Number(limit) || 24 : undefined,
        includeInactive: false,
        isNewArrival: newArrival === "true" ? true : undefined,
        isNewCollection: newCollection === "true" ? true : undefined,
      });

      const total = await storage.getProductsCount({
        category: typeof category === "string" ? category : undefined,
        search: typeof search === "string" ? search : undefined,
        includeInactive: false,
        isNewArrival: newArrival === "true" ? true : undefined,
        isNewCollection: newCollection === "true" ? true : undefined,
      });

      res.set("Cache-Control", "public, max-age=60");
      return res.json({ success: true, data: products, total });
    } catch (err) {
      console.error("Error in GET /api/products", err);
      return res
        .status(500)
        .json({ success: false, error: "Failed to load products" });
    }
  });

  app.get("/api/products/new-arrivals", async (req: Request, res: Response) => {
    try {
      const products = await storage.getProducts({
        isNewArrival: true,
        includeInactive: false,
        limit: 24,
      });
      return res.json({ success: true, data: products });
    } catch (err) {
      console.error("Error in GET /api/products/new-arrivals", err);
      return res.status(500).json({ success: false, error: "Failed to load new arrivals" });
    }
  });

  app.get("/api/products/new-collection", async (req: Request, res: Response) => {
    try {
      const products = await storage.getProducts({
        isNewCollection: true,
        includeInactive: false,
        limit: 24,
      });
      return res.json({ success: true, data: products });
    } catch (err) {
      console.error("Error in GET /api/products/new-collection", err);
      return res.status(500).json({ success: false, error: "Failed to load new collection" });
    }
  });

  app.get("/api/products/:id", async (req: Request, res: Response) => {
    try {
      const id = req.params.id as string;
      const product = await storage.getProductById(id);
      if (!product) {
        return res
          .status(404)
          .json({ success: false, error: "Product not found" });
      }

      const variants = await db
        .select({
          id: productVariants.id,
          size: productVariants.size,
          color: productVariants.color,
          stock: productVariants.stock,
          sku: productVariants.sku,
        })
        .from(productVariants)
        .where(eq(productVariants.productId, id))
        .orderBy(productVariants.size);

      const stockBySize = variants.reduce<Record<string, number>>((acc, variant) => {
        const sizeKey = variant.size?.trim();
        if (!sizeKey) return acc;
        acc[sizeKey] = variant.stock ?? 0;
        return acc;
      }, {});
      const totalStock = Object.values(stockBySize).reduce((sum, value) => sum + value, 0);

      res.set("Cache-Control", "public, max-age=30");
      return res.json({
        success: true,
        data: {
          ...product,
          stock: Object.keys(stockBySize).length > 0 ? totalStock : product.stock,
          variants,
          stockBySize,
        },
      });
    } catch (err) {
      console.error("Error in GET /api/products/:id", err);
      return res
        .status(500)
        .json({ success: false, error: "Failed to load product" });
    }
  });

  // Newsletter
  app.post(
    "/api/newsletter/subscribe", 
    rateLimit(), 
    validateRequest(insertNewsletterSubscriberSchema),
    async (req: Request, res: Response) => {
      try {
        await storage.subscribeToNewsletter(req.body.email);
      
      // Async send welcome email
      sendNewsletterWelcomeEmail(req.body.email).catch(e => 
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
    variantId: z.union([z.string(), z.number()]).optional(),
    size: z.string().optional(),
    color: z.string().optional(),
    selectedSize: z.string().optional(),
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

  app.post(
    "/api/orders", 
    validateRequest(createOrderSchema),
    async (req: Request, res: Response) => {
      try {
        const {
          items,
          shipping,
          paymentMethod,
          promoCodeId,
          source,
          deliveryRequired,
          deliveryProvider,
          deliveryAddress,
        } = req.body;

      // --- New Customer Order Limit & Abuse Prevention ---
      const MAX_ITEMS_NEW_CUSTOMER = 5;
      const MIN_ORDERS_FOR_UNLIMITED = 5;
      const MAX_FAILED_ORDER_ATTEMPTS = 30;
      const ABUSE_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes

      const totalQuantity = items.reduce((acc: number, item: any) => acc + Number(item.quantity), 0);
      const customerEmail = shipping.email.toLowerCase().trim();
      const clientIp = req.ip || req.get("x-forwarded-for") || "unknown";
      const abuseKey = `${clientIp}:${customerEmail}`;

      // Check if customer has enough order history to bypass limit
      const orderCount = await storage.getOrderCountByEmail(customerEmail);
      const isTrustedCustomer = orderCount >= MIN_ORDERS_FOR_UNLIMITED;
      const abuseEntry = abuseAttempts.get(abuseKey);

      // If abuse block is active, fail fast before any further processing.
      if (abuseEntry && abuseEntry.blockedAt > 0 && Date.now() - abuseEntry.blockedAt < ABUSE_TIMEOUT_MS) {
        const remaining = Math.ceil((ABUSE_TIMEOUT_MS - (Date.now() - abuseEntry.blockedAt)) / 1000 / 60);
        return res.status(429).json({
          success: false,
          error: `Too many failed attempts. Please try again in ${remaining} minute${remaining > 1 ? "s" : ""}.`,
          code: "ABUSE_TIMEOUT",
          retryAfter: remaining,
        });
      }

      // Reset stale abuse records once timeout expires.
      if (abuseEntry && abuseEntry.blockedAt > 0 && Date.now() - abuseEntry.blockedAt >= ABUSE_TIMEOUT_MS) {
        abuseAttempts.delete(abuseKey);
      }

      if (!isTrustedCustomer && totalQuantity > MAX_ITEMS_NEW_CUSTOMER) {
        // Track abuse attempts
        const existing = abuseAttempts.get(abuseKey) || { count: 0, blockedAt: 0 };
        const newCount = existing.count + 1;
        if (newCount >= MAX_FAILED_ORDER_ATTEMPTS) {
          abuseAttempts.set(abuseKey, { count: newCount, blockedAt: Date.now() });
        } else {
          abuseAttempts.set(abuseKey, { count: newCount, blockedAt: existing.blockedAt });
        }

        logger.warn(`Order limit exceeded: ${customerEmail} tried to order ${totalQuantity} items (limit: ${MAX_ITEMS_NEW_CUSTOMER}, orders: ${orderCount}, attempts: ${newCount})`);
        if (newCount >= MAX_FAILED_ORDER_ATTEMPTS) {
          return res.status(429).json({
            success: false,
            error: "Too many failed attempts. Please try again in 5 minutes.",
            code: "ABUSE_TIMEOUT",
            retryAfter: 5,
          });
        }

        return res.status(400).json({
          success: false,
          error: `New customers can order up to ${MAX_ITEMS_NEW_CUSTOMER} items at a time. You currently have ${totalQuantity} items in your cart. Please reduce your quantity or contact us for large orders.`,
          code: "NEW_CUSTOMER_LIMIT_EXCEEDED",
          limit: MAX_ITEMS_NEW_CUSTOMER,
          orderCount,
          attemptsRemaining: Math.max(0, MAX_FAILED_ORDER_ATTEMPTS - newCount),
        });
      }

      const orderSubtotal = items.reduce(
        (acc: number, item: any) => acc + item.priceAtTime * item.quantity,
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
            .map((it: any) => String(it.productId))
            .filter((id: string) => id.length > 0),
        );

        const matchesApplicableProducts =
          promo?.applicableProductIds == null
            ? true
          : promo.applicableProductIds.some((pid: string) =>
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

      const resolvedItems = await Promise.all(
        items.map(async (item: any) => {
          const normalizedSize = (item.size || item.selectedSize || "").trim();
          const normalizedColor = item.color?.trim() || null;
          const requestedVariantId = item.variantId === undefined ? NaN : Number(item.variantId);
          let resolvedVariantId = Number.isFinite(requestedVariantId) ? requestedVariantId : null;

          if (!resolvedVariantId && normalizedSize) {
            let variant:
              | {
                  id: number;
                }
              | undefined;

            if (normalizedColor) {
              [variant] = await db
                .select({ id: productVariants.id })
                .from(productVariants)
                .where(
                  and(
                    eq(productVariants.productId, item.productId),
                    eq(productVariants.size, normalizedSize),
                    eq(productVariants.color, normalizedColor),
                  ),
                )
                .limit(1);
            }

            if (!variant) {
              [variant] = await db
                .select({ id: productVariants.id })
                .from(productVariants)
                .where(
                  and(
                    eq(productVariants.productId, item.productId),
                    eq(productVariants.size, normalizedSize),
                  ),
                )
                .limit(1);
            }

            resolvedVariantId = variant?.id ?? null;
          }

          return {
            ...item,
            normalizedSize,
            normalizedColor,
            resolvedVariantId,
          };
        }),
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
        items: resolvedItems.map((item) => ({
          productId: item.productId,
          variantId: item.resolvedVariantId,
          size: item.normalizedSize,
          quantity: item.quantity,
          unitPrice: item.priceAtTime,
        })),
      });

      // Successful order clears any previous abuse tracking for this key.
      abuseAttempts.delete(abuseKey);

      for (const item of resolvedItems) {
        const productId = item.productId;
        const size = item.normalizedSize || null;

        let variantToUpdate:
          | {
              id: number;
              stock: number;
            }
          | undefined;

        if (item.resolvedVariantId) {
          [variantToUpdate] = await db
            .select({ id: productVariants.id, stock: productVariants.stock })
            .from(productVariants)
            .where(eq(productVariants.id, item.resolvedVariantId))
            .limit(1);
        } else if (size) {
          if (item.normalizedColor) {
            [variantToUpdate] = await db
              .select({ id: productVariants.id, stock: productVariants.stock })
              .from(productVariants)
              .where(
                and(
                  eq(productVariants.productId, productId),
                  eq(productVariants.size, size),
                  eq(productVariants.color, item.normalizedColor),
                ),
              )
              .limit(1);
          }

          if (!variantToUpdate) {
            [variantToUpdate] = await db
              .select({ id: productVariants.id, stock: productVariants.stock })
              .from(productVariants)
              .where(
                and(
                  eq(productVariants.productId, productId),
                  eq(productVariants.size, size),
                ),
              )
              .limit(1);
          }
        }

        if (variantToUpdate) {
          const newStock = Math.max(0, (variantToUpdate.stock ?? 0) - item.quantity);
          await db
            .update(productVariants)
            .set({ stock: newStock, updatedAt: new Date() })
            .where(eq(productVariants.id, variantToUpdate.id));
        }

        const allVariants = await db
          .select()
          .from(productVariants)
          .where(eq(productVariants.productId, productId));

        if (allVariants.length > 0) {
          const totalStock = allVariants.reduce((sum, variant) => sum + (variant.stock ?? 0), 0);

          await db
            .update(products)
            .set({
              stock: totalStock,
              isActive: totalStock > 0 ? sql`${products.isActive}` : false,
              updatedAt: new Date(),
            })
            .where(eq(products.id, productId));
        } else {
          const existingProduct = await db
            .select({ stock: products.stock })
            .from(products)
            .where(eq(products.id, productId))
            .limit(1);

          if (existingProduct.length > 0) {
            const newStock = Math.max(0, (existingProduct[0].stock ?? 0) - item.quantity);
            await db
              .update(products)
              .set({
                stock: newStock,
                isActive: newStock > 0 ? sql`${products.isActive}` : false,
                updatedAt: new Date(),
              })
              .where(eq(products.id, productId));
          }
        }
      }

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
      if (!order) {
        return res.status(404).json({ success: false, error: "Order not found" });
      }

      const user = req.user as Express.User | undefined;
      if (user) {
        const isAdminOrStaff = canAccessAdminPanel(user?.role);
        const userEmail = user?.email?.toLowerCase();
        const orderEmail = order?.email?.toLowerCase();
        const isOwner =
          order.userId === user.id || (!!userEmail && !!orderEmail && userEmail === orderEmail);

        if (!isAdminOrStaff && !isOwner) {
          return res.status(403).json({ success: false, error: "Forbidden" });
        }
      }

      return res.json({ success: true, data: order });
    } catch (err) {
      console.error("Error in GET /api/orders/:id", err);
      return res
        .status(404)
        .json({ success: false, error: "Order not found" });
    }
  });

  app.patch("/api/orders/:id/cancel", async (req: Request, res: Response) => {
    try {
      const id = getQueryParam(req.params.id);
      if (!id) {
        return res.status(400).json({ success: false, error: "Order ID is required" });
      }

      const order = await storage.getOrderById(id);
      if (!order) {
        return res.status(404).json({ success: false, error: "Order not found" });
      }

      if (order.status === "cancelled") {
        return res.json({ success: true, data: order });
      }

      if (order.status === "completed") {
        return res.status(400).json({ success: false, error: "Completed orders cannot be cancelled" });
      }

      const updated = await storage.updateOrderStatus(id, "cancelled");
      const fullOrder = await storage.getOrderById(id);
      return res.json({ success: true, data: fullOrder ?? updated });
    } catch (err) {
      console.error("Error in PATCH /api/orders/:id/cancel", err);
      return res.status(500).json({ success: false, error: "Failed to cancel order" });
    }
  });

  const paymentProofSchema = z.object({
    imageBase64: z.string().min(1),
  });

  const updatePaymentMethodSchema = z.object({
    paymentMethod: z.enum([
      "esewa",
      "khalti",
      "fonepay",
      "stripe",
      "bank",
      "bank_transfer",
      "cash_on_delivery",
    ]),
  });

  app.post(
    "/api/orders/:id/payment-proof",
    validateRequest(paymentProofSchema),
    async (req: Request, res: Response) => {
      try {
        const orderId = req.params.id as string;
        await storage.getOrderById(orderId);
        const base64 = req.body.imageBase64;
        const match = base64.match(/^data:image\/(\w+);base64,(.+)$/);
        const buffer = Buffer.from(
          match ? match[2] : base64,
          "base64",
        );
        let proofUrl = "";
        if (PAYMENT_PROOF_STORAGE === "tigris" || PAYMENT_PROOF_STORAGE === "s3") {
          const fileName = `payment-proofs/order-${orderId}-${Date.now()}.png`;
          proofUrl = await storageService.uploadFile(buffer, fileName, "image/png");
        } else if (PAYMENT_PROOF_STORAGE === "local") {
          const fileName = `payment-proofs/order-${orderId}-${Date.now()}.png`;
          proofUrl = await storageService.uploadFile(buffer, fileName, "image/png");
        } else {
          const uploaded = await uploadPaymentProofToCloudinary(
            buffer,
            orderId,
          );
          proofUrl = uploaded.url;
        }

        await storage.updateOrderPaymentProof(orderId, proofUrl);
        return res.json({ success: true, data: { paymentProofUrl: proofUrl } });
      } catch (err) {
        console.error("Error in POST /api/orders/:id/payment-proof", err);
        return res
          .status(500)
          .json({ success: false, error: "Failed to upload payment proof" });
      }
    },
  );

  app.patch(
    "/api/orders/:id/payment-method",
    validateRequest(updatePaymentMethodSchema),
    async (req: Request, res: Response) => {
      try {
        const orderId = req.params.id as string;
        const { paymentMethod } = req.body;
        const order = await storage.getOrderById(orderId);

        if (!order) {
          return res.status(404).json({ success: false, error: "Order not found" });
        }

        if (order.status === "completed" || order.status === "cancelled") {
          return res.status(400).json({
            success: false,
            error: "Cannot change payment method for completed or cancelled orders",
          });
        }

        if (order.paymentVerified === "verified") {
          return res.status(400).json({
            success: false,
            error: "Cannot change payment method after payment is verified",
          });
        }

        const updated = await storage.updateOrderPaymentMethod(orderId, paymentMethod);
        return res.json({ success: true, data: updated });
      } catch (err) {
        console.error("Error in PATCH /api/orders/:id/payment-method", err);
        return res
          .status(500)
          .json({ success: false, error: "Failed to update payment method" });
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

  // Stripe: Create checkout session
  app.post("/api/payments/create-checkout-session", async (req: Request, res: Response) => {
    try {
      const { orderId } = z.object({ orderId: z.string().min(1) }).parse(req.body);

      const order = await storage.getOrderById(orderId);
      if (!order) {
        return res.status(404).json({ success: false, error: "Order not found" });
      }

      if (order.paymentMethod !== "stripe") {
        return res.status(400).json({ success: false, error: "Order is not a Stripe payment" });
      }

      const rate = await getUsdToNprRate();
      const totalNpr = Number(order.total);
      const amountCents = convertNprToUsdCents(totalNpr, rate);

      if (amountCents <= 0) {
        return res.status(400).json({ success: false, error: "Invalid order total" });
      }

      const protocol = process.env.NODE_ENV === "production" ? "https" : "http";
      const host = process.env.NODE_ENV === "production"
        ? process.env.APP_URL || "https://rare-np-production.up.railway.app"
        : `http://localhost:${process.env.PORT || 5000}`;

      const { sessionId, checkoutUrl } = await createCheckoutSession({
        orderId,
        amountCents,
        currency: "usd",
        customerEmail: order.email,
        successUrl: `${host}/order-confirmation/${orderId}?stripe_status=success`,
        cancelUrl: `${host}/order-confirmation/${orderId}?stripe_status=cancelled`,
      });

      await storage.updateOrderStripeCheckoutSession(orderId, sessionId);
      await storage.updateOrderStripePaymentIntent(orderId, sessionId);

      return res.json({ success: true, data: { sessionId, checkoutUrl, amountCents, rate } });
    } catch (err) {
      console.error("Error in POST /api/payments/create-checkout-session", err);
      return res.status(500).json({ success: false, error: "Failed to create checkout session" });
    }
  });

  // Stripe: Webhook handler (uses req.rawBody captured by global json middleware)
  app.post("/api/payments/webhook", async (req: Request, res: Response) => {
    const sig = req.headers["stripe-signature"] as string;
    const rawBody = (req as any).rawBody;

    if (!rawBody) {
      console.error("Stripe webhook: rawBody not available");
      return res.status(400).send("Webhook raw body not available");
    }

    let event: Stripe.Event;

    try {
      event = constructWebhookEvent(rawBody, sig);
    } catch (err) {
      console.error("Webhook signature verification failed:", err);
      return res.status(400).send(`Webhook Error: ${err instanceof Error ? err.message : "Unknown error"}`);
    }

    try {
      switch (event.type) {
        case "checkout.session.completed": {
          const session = event.data.object as Stripe.Checkout.Session;
          const orderId = session.metadata?.orderId;

          if (!orderId) {
            console.error("Stripe webhook: missing orderId in session metadata");
            break;
          }

          const order = await storage.getOrderById(orderId);
          if (!order) {
            console.error(`Stripe webhook: order ${orderId} not found`);
            break;
          }

          if (order.stripePaymentStatus === "succeeded") {
            console.log(`Stripe webhook: order ${orderId} already verified, skipping`);
            break;
          }

          await storage.updateOrderStripePaymentStatus(orderId, "succeeded");
          await storage.updateOrderPaymentVerified(orderId, "verified");

          if (order.status === "pending") {
            await storage.updateOrderStatus(orderId, "processing");
          }

          logger.info(`Stripe payment verified for order ${orderId}`);
          break;
        }

        case "checkout.session.expired": {
          const session = event.data.object as Stripe.Checkout.Session;
          const orderId = session.metadata?.orderId;
          if (orderId) {
            await storage.updateOrderStripePaymentStatus(orderId, "failed");
            logger.info(`Stripe checkout session expired for order ${orderId}`);
          }
          break;
        }

        case "payment_intent.payment_failed": {
          const paymentIntent = event.data.object as Stripe.PaymentIntent;
          const orderId = paymentIntent.metadata?.orderId;
          if (orderId) {
            await storage.updateOrderStripePaymentStatus(orderId, "failed");
            logger.error(`Stripe payment failed for order ${orderId}`);
          }
          break;
        }

        default:
          console.log(`Unhandled Stripe event type: ${event.type}`);
      }

      res.json({ received: true });
    } catch (err) {
      console.error("Error processing Stripe webhook:", err);
      res.status(500).json({ error: "Webhook handler failed" });
    }
  });

  // Dev-only: Simulate Stripe payment success (local testing without Stripe CLI)
  if (process.env.NODE_ENV !== "production") {
    app.post("/api/payments/dev-simulate-success", async (req: Request, res: Response) => {
      try {
        const { orderId } = z.object({ orderId: z.string().min(1) }).parse(req.body);

        const order = await storage.getOrderById(orderId);
        if (!order) {
          return res.status(404).json({ success: false, error: "Order not found" });
        }

        if (order.paymentMethod !== "stripe") {
          return res.status(400).json({ success: false, error: "Order is not a Stripe payment" });
        }

        await storage.updateOrderStripePaymentStatus(orderId, "succeeded");
        await storage.updateOrderStripePaymentIntent(orderId, `dev_pi_${orderId}`);
        await storage.updateOrderStripeCheckoutSession(orderId, `dev_cs_${orderId}`);
        await storage.updateOrderPaymentVerified(orderId, "verified");

        if (order.status === "pending") {
          await storage.updateOrderStatus(orderId, "processing");
        }

        logger.info(`[DEV] Simulated Stripe payment success for order ${orderId}`);
        return res.json({ success: true, message: "Payment simulated successfully" });
      } catch (err) {
        console.error("Error in dev simulate success:", err);
        return res.status(500).json({ success: false, error: "Simulation failed" });
      }
    });
  }

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
    validateRequest(z.object({ name: z.string().min(1), slug: z.string().min(1) })),
    async (req: Request, res: Response) => {
      try {
        const category = await storage.createCategory(req.body);
        return res.status(201).json({ success: true, data: category });
      } catch (err) {
        console.error("Error in POST /api/admin/categories", err);
        if (isDuplicateCategoryError(err)) {
          return res.status(409).json({
            success: false,
            error: `A category with this name already exists.`,
          });
        }
        return res.status(500).json({ success: false, error: "Failed to create category" });
      }
    },
  );

  app.put(
    "/api/admin/categories/:id",
    requireAdmin,
    validateRequest(z.object({ name: z.string().min(1), slug: z.string().min(1) })),
    async (req: Request, res: Response) => {
      try {
        const id = getQueryParam(req.params.id);
        if (!id) {
          return res.status(400).json({ success: false, error: "Invalid category ID" });
        }
        const updated = await storage.updateCategory(id, req.body);
        return res.json({ success: true, data: updated });
      } catch (err: any) {
        console.error("Error in PUT /api/admin/categories/:id", err);
        if (isDuplicateCategoryError(err)) {
          return res.status(409).json({
            success: false,
            error: `A category with this name already exists.`,
          });
        }
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
    "/api/admin/upload-product-image-file",
    requireAdmin,
    memoryUpload.single("image"),
    async (req: Request, res: Response) => {
      try {
        const file = req.file;
        if (!file) {
          return res.status(400).json({ success: false, error: "No file uploaded" });
        }

        const fileName = `product_${Date.now()}_${file.originalname.replace(/\s+/g, "-")}`;
        const asset = await storageService.uploadFile(
          file.buffer,
          fileName,
          file.mimetype || "image/jpeg",
        );

        return res.json({ success: true, url: asset });
      } catch (err) {
        console.error("Error in product image upload (file)", err);
        return res.status(500).json({ success: false, error: "Upload failed" });
      }
    },
  );

  app.post(
    "/api/admin/upload-product-image",
    requireAdmin,
    validateRequest(productImageSchema),
    async (req: Request, res: Response) => {
      try {
        const base64 = req.body.imageBase64;
        const match = base64.match(/^data:image\/(\w+);base64,(.+)$/);
        const buffer = Buffer.from(match ? match[2] : base64, "base64");
        
        // Use S3 storage for product images
        const fileName = `product_${Date.now()}.png`;
        const asset = await storageService.uploadFile(
          buffer,
          fileName,
          'image/png'
        );

        return res.json({ success: true, url: asset });
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

      // Use S3 storage for media files
      const filename = `${path.parse(req.file.originalname).name}-${Date.now()}.webp`;
      const webpBuffer = await sharp(req.file.buffer)
        .webp({ quality: 85 })
        .toBuffer();

      const asset = await storageService.uploadFile(
        webpBuffer,
        filename,
        'image/webp'
      );

      res.status(201).json({ 
        success: true, 
        data: {
          name: filename,
          url: asset
        } 
      });
    } catch (err) {
      handleApiError(res, err, "POST /api/admin/media/upload");
    }
  });

  app.delete("/api/admin/media/:filename", requireAdmin, async (req, res) => {
    try {
      const filename = req.params.filename as string;
      
      // Use S3 storage for deletion
      await storageService.deleteFile(filename);
      
      res.json({ success: true });
    } catch (err) {
      handleApiError(res, err, "DELETE /api/admin/media/:filename");
    }
  });

  // Backwards compatibility for /api/uploads/
  app.use(
    "/api/uploads",
    express.static(UPLOADS_DIR, {
      etag: true,
      maxAge: 1000 * 60 * 60, // 1 hour
      setHeaders: (res) => {
        res.setHeader("Cache-Control", "public, max-age=3600");
      },
    }),
  );

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

        if (!asset.url) {
          return res.status(500).json({
            success: false,
            error: "Failed to resolve uploaded image URL",
          });
        }

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
    validateRequest(z.object({
      section: z.string().min(1),
      orderedIds: z.array(z.string().min(1)).min(1),
    })),
    async (req: Request, res: Response) => {
      const { section, orderedIds } = req.body;

      if (!validSiteAssetSections.includes(section as SiteAssetSection)) {
        return res.status(400).json({
          success: false,
          error: "Invalid section",
        });
      }

      try {
        await db.transaction(async (tx) => {
          await Promise.all(
            (orderedIds as string[]).map((id: string, index: number) =>
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
    validateRequest(z.object({
      altText: z.string().optional(),
      active: z.boolean().optional(),
      deviceTarget: z.string().optional(),
      assetType: z.string().optional(),
      videoUrl: z.string().optional(),
      imageUrl: z.string().optional(),
    })),
    async (req: Request, res: Response) => {
      const { id } = req.params;
      if (typeof id !== "string") {
        return res
          .status(400)
          .json({ success: false, error: "Invalid ID" });
      }

      const update: any = {};
      
      if (req.body.altText !== undefined) update.altText = req.body.altText;
      if (req.body.active !== undefined) update.active = req.body.active;
      if (req.body.deviceTarget !== undefined) update.deviceTarget = req.body.deviceTarget;
      if (req.body.assetType !== undefined) update.assetType = req.body.assetType;
      if (req.body.videoUrl !== undefined) update.videoUrl = req.body.videoUrl;
      if (req.body.imageUrl !== undefined) update.imageUrl = req.body.imageUrl;

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
    stockBySize: z.record(z.string(), z.number().int().nonnegative()).optional(),
    colorOptions: z.string().optional().nullable(),
    sizeOptions: z.string().optional().nullable(),
    salePercentage: z.number().int().min(0).max(100).optional().default(0),
    saleActive: z.boolean().optional().default(false),
    originalPrice: z.number().positive().optional().nullable(),
    homeFeatured: z.boolean().optional().default(false),
    homeFeaturedImageIndex: z.number().int().min(0).max(3).optional().default(2),
    isNewArrival: z.boolean().optional().default(false),
    isNewCollection: z.boolean().optional().default(false),
  });

  const parseSizeOptions = (value: unknown): string[] => {
    if (typeof value !== "string" || !value.trim()) return [];

    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed)
        ? Array.from(
            new Set(
              parsed.filter(
                (item): item is string => typeof item === "string" && item.trim().length > 0,
              ),
            ),
          )
        : [];
    } catch {
      return [];
    }
  };

  const sanitizeStockBySize = (
    stockBySize: Record<string, number> | undefined,
    activeSizes: string[],
  ): Record<string, number> => {
    return activeSizes.reduce<Record<string, number>>((draft, size) => {
      const rawValue = stockBySize?.[size] ?? 0;
      draft[size] = Number.isFinite(rawValue) ? Math.max(0, Math.trunc(rawValue)) : 0;
      return draft;
    }, {});
  };

  const isDuplicateProductNameError = (error: unknown): boolean => {
    if (!error || typeof error !== "object") return false;

    const candidate = error as { code?: string; constraint?: string };
    return (
      candidate.code === "23505" &&
      candidate.constraint === "products_name_unique"
    );
  };

  const isDuplicateCategoryError = (error: unknown): boolean => {
    if (!error || typeof error !== "object") return false;

    const candidate = error as { code?: string; constraint?: string };
    return (
      candidate.code === "23505" &&
      candidate.constraint === "categories_slug_unique"
    );
  };

  const syncProductVariantStocks = async (input: {
    productId: string;
    sizeStocks: Record<string, number>;
    sizesToSync: string[];
  }) => {
    for (const size of input.sizesToSync) {
      if (!size.trim()) continue;

      const newStock = input.sizeStocks[size] ?? 0;
      const existing = await db
        .select()
        .from(productVariants)
        .where(and(eq(productVariants.productId, input.productId), eq(productVariants.size, size)))
        .limit(1);

      if (existing.length > 0) {
        await db
          .update(productVariants)
          .set({ stock: newStock, updatedAt: new Date() })
          .where(eq(productVariants.id, existing[0].id));
      } else {
        await db.insert(productVariants).values({
          productId: input.productId,
          size,
          stock: newStock,
          sku: `RR-${input.productId}-${size}`,
        });
      }
    }

    const allVariants = await db
      .select()
      .from(productVariants)
      .where(eq(productVariants.productId, input.productId));

    const totalStock = allVariants.reduce((sum, variant) => sum + (variant.stock ?? 0), 0);

    await db
      .update(products)
      .set({
        stock: totalStock,
        isActive: totalStock > 0 ? sql`${products.isActive}` : false,
        updatedAt: new Date(),
      })
      .where(eq(products.id, input.productId));
  };

  app.get(
    "/api/admin/products",
    requireAdmin,
    async (req: Request, res: Response) => {
      try {
        const category = getQueryParam(req.query.category);
        const search = getQueryParam(req.query.search);
        const page = getQueryParam(req.query.page);
        const limit = getQueryParam(req.query.limit);
        const status = getQueryParam(req.query.status);
        const normalizedStatus =
          status === "active" || status === "draft" || status === "archived"
            ? status
            : undefined;

        const productRows = await storage.getProducts({
          category,
          search,
          page: page ? Number(page) || 1 : undefined,
          limit: limit ? Number(limit) || 24 : undefined,
          includeInactive: true,
          status: normalizedStatus,
        });
        const variants = await db
          .select({
            productId: productVariants.productId,
            size: productVariants.size,
            stock: productVariants.stock,
          })
          .from(productVariants);

        const stockByProduct = variants.reduce<Record<string, Record<string, number>>>(
          (acc, variant) => {
            const productId = variant.productId;
            const sizeKey = variant.size?.trim();
            if (!productId || !sizeKey) return acc;
            if (!acc[productId]) acc[productId] = {};
            acc[productId][sizeKey] = variant.stock ?? 0;
            return acc;
          },
          {},
        );

        const products = productRows.map((product) => {
          const stockBySize = stockByProduct[product.id] ?? {};
          const totalStock = Object.values(stockBySize).reduce((sum, value) => sum + value, 0);
          const effectiveStock = Object.keys(stockBySize).length > 0 ? totalStock : (product.stock ?? 0);
          return {
            ...product,
            stock: effectiveStock,
            isActive: effectiveStock > 0 ? product.isActive : false,
            stockBySize,
          };
        });

        const total = await storage.getProductsCount({
          category: category || undefined,
          search: search || undefined,
          includeInactive: true,
          status: normalizedStatus,
        });

        return res.json({ success: true, data: products, total });
      } catch (err) {
        console.error("Error in GET /api/admin/products", err);
        return res
          .status(500)
          .json({ success: false, error: "Failed to load products" });
      }
    },
  );

  app.get(
    "/api/admin/products/stats",
    requireAdmin,
    async (_req: Request, res: Response) => {
      try {
        const stats = await storage.getProductStats();
        return res.json({ success: true, data: stats });
      } catch (err) {
        console.error("Error in GET /api/admin/products/stats", err);
        return res.status(500).json({ success: false, error: "Failed to load product stats" });
      }
    },
  );

  // Bulk categorize products
  app.patch(
    "/api/admin/products/bulk-categorize",
    requireAdmin,
    validateRequest(z.object({
      productIds: z.array(z.string().min(1)).min(1),
      categorySlug: z.string().min(1),
    })),
    async (req: Request, res: Response) => {
      try {
        const { productIds, categorySlug } = req.body;

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
    validateRequest(adminProductSchema),
    async (req: Request, res: Response) => {
      try {
        const data = {
          name: req.body.name,
          shortDetails: req.body.shortDetails || null,
          description: req.body.description || null,
          price: req.body.price.toString(),
          costPrice: 0,
          sku: "",
          imageUrl: req.body.imageUrl || null,
          galleryUrls: req.body.galleryUrls || null,
          category: req.body.category || null,
          stock: req.body.stock,
          colorOptions: req.body.colorOptions || null,
          sizeOptions: req.body.sizeOptions || null,
          ranking: 999,
          salePercentage: req.body.salePercentage || 0,
          saleActive: req.body.saleActive || false,
          originalPrice: req.body.originalPrice ? req.body.originalPrice.toString() : null,
          homeFeatured: req.body.homeFeatured || false,
          homeFeaturedImageIndex: req.body.homeFeaturedImageIndex ?? 2,
          isNewArrival: req.body.isNewArrival || false,
          isNewCollection: req.body.isNewCollection || false,
          isActive: Number(req.body.stock ?? 0) > 0,
        };
        const product = await storage.createProduct(data);
        const sizeOptions = parseSizeOptions(req.body.sizeOptions);
        const sizeStocks = sanitizeStockBySize(req.body.stockBySize, sizeOptions);

        if (sizeOptions.length > 0 || Object.keys(sizeStocks).length > 0) {
          await syncProductVariantStocks({
            productId: product.id,
            sizeStocks,
            sizesToSync: Array.from(new Set([...sizeOptions, ...Object.keys(sizeStocks)])),
          });
        }

        return res.status(201).json({ success: true, data: product });
      } catch (err) {
        console.error("Error in POST /api/admin/products", err);
        if (isDuplicateProductNameError(err)) {
          return res.status(409).json({
            success: false,
            error: `A product named "${req.body.name}" already exists.`,
          });
        }
        return res
          .status(500)
          .json({ success: false, error: "Failed to create product" });
      }
    },
  );

  app.put(
    "/api/admin/products/:id",
    requireAdmin,
    validateRequest(adminProductSchema.partial()),
    async (req: Request, res: Response) => {
      try {
        const productId = req.params.id as string;
        const exists = await storage.getProductById(productId);
        if (!exists) {
          return res.status(404).json({ success: false, error: "Product not found" });
        }

        const data = {
          name: req.body.name,
          shortDetails: req.body.shortDetails === undefined ? undefined : (req.body.shortDetails || null),
          description: req.body.description === undefined ? undefined : (req.body.description || null),
          price: req.body.price?.toString(),
          imageUrl: req.body.imageUrl === undefined ? undefined : (req.body.imageUrl || null),
          galleryUrls: req.body.galleryUrls === undefined ? undefined : (req.body.galleryUrls || null),
          category: req.body.category === undefined ? undefined : (req.body.category || null),
          stock: req.body.stock,
          colorOptions: req.body.colorOptions === undefined ? undefined : (req.body.colorOptions || null),
          sizeOptions: req.body.sizeOptions === undefined ? undefined : (req.body.sizeOptions || null),
          salePercentage: req.body.salePercentage,
          saleActive: req.body.saleActive,
          originalPrice: req.body.originalPrice === undefined ? undefined : (req.body.originalPrice ? req.body.originalPrice.toString() : null),
          homeFeatured: req.body.homeFeatured,
          homeFeaturedImageIndex: req.body.homeFeaturedImageIndex,
          isActive:
            req.body.stock === undefined
              ? undefined
              : Number(req.body.stock) <= 0
                ? false
                : undefined,
        };

        const updated = await storage.updateProduct(productId, data);
        const previousSizes = parseSizeOptions(exists.sizeOptions);
        const previousVariants = await db
          .select({
            size: productVariants.size,
            stock: productVariants.stock,
          })
          .from(productVariants)
          .where(eq(productVariants.productId, productId));
        const previousStockBySize = previousVariants.reduce<Record<string, number>>((draft, variant) => {
          draft[variant.size] = variant.stock ?? 0;
          return draft;
        }, {});
        const nextSizes =
          req.body.sizeOptions === undefined ? previousSizes : parseSizeOptions(req.body.sizeOptions);
        const nextStockBySize =
          req.body.stockBySize === undefined
            ? sanitizeStockBySize(previousStockBySize, nextSizes)
            : sanitizeStockBySize(req.body.stockBySize, nextSizes);

        if (
          req.body.sizeOptions !== undefined ||
          req.body.stockBySize !== undefined ||
          req.body.stock !== undefined
        ) {
          await syncProductVariantStocks({
            productId,
            sizeStocks: nextStockBySize,
            sizesToSync: Array.from(
              new Set([
                ...previousSizes,
                ...nextSizes,
                ...Object.keys(previousStockBySize),
                ...Object.keys(req.body.stockBySize ?? {}),
              ]),
            ),
          });
        }

        return res.json({ success: true, data: updated });
      } catch (err) {
        console.error("Error in PUT /api/admin/products/:id", err);
        if (isDuplicateProductNameError(err)) {
          return res.status(409).json({
            success: false,
            error: `A product named "${req.body.name}" already exists.`,
          });
        }
        return res.status(500).json({ success: false, error: "Failed to update product" });
      }
    },
  );

  app.delete(
    "/api/admin/products/:id",
    requireAdmin,
    async (req: Request, res: Response) => {
      try {
        const permanent = getQueryParam(req.query.permanent) === "true";
        await storage.deleteProduct(req.params.id as string, { permanent });
        return res.json({
          success: true,
          action: permanent ? "deleted" : "archived",
        });
      } catch (err) {
        console.error("Error in DELETE /api/admin/products/:id", err);
        return res
          .status(500)
          .json({
            success: false,
            error: getQueryParam(req.query.permanent) === "true"
              ? "Failed to permanently delete product"
              : "Failed to archive product",
          });
      }
    },
  );

  // Toggle product active/inactive
  app.put(
    "/api/admin/products/:id/toggle-active",
    requireAdmin,
    async (req: Request, res: Response) => {
      try {
        const { id } = req.params;
        if (typeof id !== "string") return res.status(400).json({ success: false, error: "Invalid ID" });

        const [product] = await db.select().from(products).where(eq(products.id, id)).limit(1);
        if (!product) return res.status(404).json({ success: false, error: "Product not found" });

        const archivedPrefix = "__archived__::";
        const isArchived =
          product.category === "__archived__" ||
          (typeof product.category === "string" && product.category.startsWith(archivedPrefix));

        if (!product.isActive && Number(product.stock ?? 0) <= 0) {
          return res.status(400).json({
            success: false,
            error: "Cannot activate a product with zero stock",
          });
        }

        if (isArchived) {
          const restoredCategory =
            typeof product.category === "string" && product.category.startsWith(archivedPrefix)
              ? product.category.slice(archivedPrefix.length).trim() || null
              : null;

          const [updated] = await db
            .update(products)
            .set({
              category: restoredCategory,
              isActive: true,
              updatedAt: new Date(),
            })
            .where(eq(products.id, id))
            .returning();

          return res.json({ success: true, data: updated });
        }

        const [updated] = await db
          .update(products)
          .set({ isActive: !product.isActive, updatedAt: new Date() })
          .where(eq(products.id, id))
          .returning();

        return res.json({ success: true, data: updated });
      } catch (err) {
        console.error("Error in PUT /api/admin/products/:id/toggle-active", err);
        return res.status(500).json({ success: false, error: "Failed to toggle product status" });
      }
    },
  );

  app.patch(
    "/api/admin/products/:id/home-featured",
    requireAdmin,
    validateRequest(z.object({
      homeFeatured: z.boolean(),
      homeFeaturedImageIndex: z.number().int().min(0).max(3).optional(),
    })),
    async (req: Request, res: Response) => {
      try {
        const productId = req.params.id as string;
        const existing = await storage.getProductById(productId);
        if (!existing) {
          return res.status(404).json({ success: false, error: "Product not found" });
        }

        const wantsFeatured = req.body.homeFeatured;
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
          homeFeaturedImageIndex: req.body.homeFeaturedImageIndex ?? existing.homeFeaturedImageIndex ?? 2,
        });

        return res.json({ success: true, data: updated });
      } catch (err) {
        console.error("Error in PATCH /api/admin/products/:id/home-featured", err);
        return res.status(500).json({ success: false, error: "Failed to update home featured flag" });
      }
    },
  );

  const parseNumericValue = (value: unknown): number => {
    if (typeof value === "number") return Number.isFinite(value) ? value : 0;
    if (typeof value === "string") {
      const parsed = Number(value);
      return Number.isFinite(parsed) ? parsed : 0;
    }
    return 0;
  };

  type InventoryStatus = "in_stock" | "low_stock" | "out_of_stock";
  type InventorySummaryResponse = {
    totalProducts: number;
    totalSkus: number;
    totalQuantity: number;
    totalInventoryValue: number;
    totalInventoryCost: number;
    lowStockCount: number;
    criticalStockCount: number;
    inStockCount: number;
    outletCount: number;
  };
  type InventoryListItemResponse = {
    id: string;
    productId: string;
    variantId: number | null;
    name: string;
    thumbnail: string | null;
    batch: number;
    outlet: string;
    channel: string;
    status: InventoryStatus;
    units: number;
    avgCost: number;
    totalValue: number;
    variant: string;
    sku: string;
    category: string;
    currentQty: number;
    size: string;
  };

  const INVENTORY_DEFAULT_OUTLET = "Main Outlet";
  const CACHE_TTL = 30_000;
  let summaryCache: { data: InventorySummaryResponse; ts: number } | null = null;

  const resolveInventoryStatus = (units: number): InventoryStatus => {
    if (units <= 0) return "out_of_stock";
    if (units <= 10) return "low_stock";
    return "in_stock";
  };

  const formatInventoryChannel = (source: string | null | undefined): string => {
    if (!source) return "Website";
    const normalized = source.trim().toLowerCase();
    if (normalized === "pos") return "POS";
    if (normalized === "website") return "Website";
    return normalized
      .split(/[_\s-]+/)
      .filter(Boolean)
      .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
      .join(" ");
  };

  const formatInventoryOutlet = (source: string | null | undefined): string => {
    const normalized = source?.trim().toLowerCase();
    if (normalized === "pos") return "POS Counter";
    return INVENTORY_DEFAULT_OUTLET;
  };

  const syncProductStock = async (productId: string) => {
    const allVariants = await db
      .select()
      .from(productVariants)
      .where(eq(productVariants.productId, productId));

    const totalStock = allVariants.reduce(
      (sum, variant) => sum + (variant.stock ?? 0),
      0,
    );

    await db
      .update(products)
      .set({
        stock: totalStock,
        isActive: totalStock > 0 ? sql`${products.isActive}` : false,
        updatedAt: new Date(),
      })
      .where(eq(products.id, productId));
  };

  const recordInventoryMovement = async ({
    productId,
    variantId,
    movementType,
    quantity,
    unitCost,
    totalValue,
    outlet,
    channel,
    batch,
    reference,
    notes,
    createdById,
  }: {
    productId: string;
    variantId?: number | null;
    movementType: "stock_in" | "stock_out" | "transfer";
    quantity: number;
    unitCost: number;
    totalValue: number;
    outlet?: string;
    channel?: string;
    batch?: number;
    reference?: string | null;
    notes?: string | null;
    createdById?: string | null;
  }) => {
    if (quantity <= 0) return;

    await db.insert(inventoryMovements).values({
      productId,
      variantId: variantId ?? null,
      movementType,
      quantity,
      unitCost: unitCost.toFixed(2),
      totalValue: totalValue.toFixed(2),
      outlet: outlet || INVENTORY_DEFAULT_OUTLET,
      channel: channel || "Admin",
      batch: batch ?? 1,
      reference: reference ?? null,
      notes: notes ?? null,
      createdById: createdById ?? null,
    });
  };

  app.get(
    "/api/admin/inventory/summary",
    requireAdmin,
    async (_req: Request, res: Response) => {
      try {
        if (summaryCache && Date.now() - summaryCache.ts < CACHE_TTL) {
          return res.json(summaryCache.data);
        }

        const variants = await db.select().from(productVariants);
        const productRows = await db.select().from(products);

        const totalQuantity = variants.reduce(
          (sum, variant) => sum + (variant.stock ?? 0),
          0,
        );

        const [inventoryValueRow] = await db
          .select({
            value: sql<string>`coalesce(sum(${productVariants.stock} * ${products.price}), 0)::text`,
          })
          .from(productVariants)
          .leftJoin(products, eq(productVariants.productId, products.id));

        const productTotals = productRows.map((product) => {
          const productVariantRows = variants.filter((variant) => variant.productId === product.id);
          const totalStock = productVariantRows.reduce((sum, variant) => sum + (variant.stock ?? 0), 0);
          return { ...product, totalStock };
        });

        const lowStockCount = productTotals.filter(
          (product) => product.totalStock > 0 && product.totalStock <= 10,
        ).length;
        const criticalStockCount = productTotals.filter(
          (product) => product.totalStock <= 0,
        ).length;
        const inStockCount = productTotals.filter((product) => product.totalStock > 10).length;
        const totalInventoryValue = parseNumericValue(inventoryValueRow?.value);

        const result: InventorySummaryResponse = {
          totalProducts: productRows.length,
          totalSkus: variants.length,
          totalQuantity,
          totalInventoryValue,
          totalInventoryCost: productTotals.reduce((sum, product) => {
            const costPrice = product.costPrice || Math.floor(parseNumericValue(product.price) * 0.5);
            return sum + product.totalStock * costPrice;
          }, 0),
          lowStockCount,
          criticalStockCount,
          inStockCount,
          outletCount: 1,
        };

        summaryCache = { data: result, ts: Date.now() };
        return res.json(result);
      } catch (err) {
        console.error("Error in GET /api/admin/inventory/summary", err);
        return res.status(500).json({ error: "Failed to load inventory summary" });
      }
    },
  );

  app.get(
    "/api/admin/inventory/products",
    requireAdmin,
    async (req: Request, res: Response) => {
      try {
        const status = getQueryParam(req.query.status) ?? "all";
        const category = (getQueryParam(req.query.category) ?? "").trim();
        const search = (getQueryParam(req.query.search) ?? "").trim().toLowerCase();
        const outlet = (getQueryParam(req.query.outlet) ?? "").trim().toLowerCase();

        const productRows = await db.select().from(products).orderBy(products.name);
        const variantRows = await db
          .select()
          .from(productVariants)
          .orderBy(productVariants.productId, productVariants.id);
        const productChannelRows = await db
          .select({
            productId: orderItems.productId,
            source: orders.source,
            createdAt: orders.createdAt,
          })
          .from(orderItems)
          .innerJoin(orders, eq(orderItems.orderId, orders.id))
          .orderBy(desc(orders.createdAt));

        const latestChannelByProduct = new Map<string, string>();
        for (const row of productChannelRows) {
          if (!latestChannelByProduct.has(row.productId)) {
            latestChannelByProduct.set(row.productId, formatInventoryChannel(row.source));
          }
        }

        const variantsByProduct = new Map<string, typeof variantRows>();
        for (const variant of variantRows) {
          const bucket = variantsByProduct.get(variant.productId) ?? [];
          bucket.push(variant);
          variantsByProduct.set(variant.productId, bucket);
        }

        const items: InventoryListItemResponse[] = [];
        for (const product of productRows) {
          const channel = latestChannelByProduct.get(product.id) || "Website";
          const productOutlet = formatInventoryOutlet(channel);
          const productCost = product.costPrice || Math.floor(parseNumericValue(product.price) * 0.5);
          const productVariantsRows = variantsByProduct.get(product.id) ?? [];

          if (productVariantsRows.length === 0) {
            const units = product.stock ?? 0;
            items.push({
              id: `${product.id}:fallback`,
              productId: product.id,
              variantId: null,
              name: product.name,
              thumbnail: product.imageUrl || null,
              batch: 1,
              outlet: productOutlet,
              channel,
              status: resolveInventoryStatus(units),
              units,
              avgCost: productCost,
              totalValue: units * productCost,
              variant: "Standard",
              sku: product.sku || `RR-${product.id}`,
              category: product.category || "Uncategorized",
              currentQty: units,
              size: "ONE",
            });
            continue;
          }

          for (let index = 0; index < productVariantsRows.length; index += 1) {
            const variant = productVariantsRows[index];
            const units = variant.stock ?? 0;
            const variantLabel = [variant.color?.trim(), variant.size?.trim()]
              .filter(Boolean)
              .join(" / ") || variant.size || "Standard";

            items.push({
              id: `${product.id}:${variant.id}`,
              productId: product.id,
              variantId: variant.id,
              name: product.name,
              thumbnail: product.imageUrl || null,
              batch: index + 1,
              outlet: productOutlet,
              channel,
              status: resolveInventoryStatus(units),
              units,
              avgCost: productCost,
              totalValue: units * productCost,
              variant: variantLabel,
              sku: variant.sku || product.sku || `RR-${product.id}-${variant.size}`,
              category: product.category || "Uncategorized",
              currentQty: units,
              size: variant.size || "ONE",
            });
          }
        }

        let filtered = items;
        if (status && status !== "all") {
          filtered = filtered.filter((item) => item.status === status);
        }
        if (category) {
          filtered = filtered.filter(
            (item) => item.category.toLowerCase() === category.toLowerCase(),
          );
        }
        if (outlet) {
          filtered = filtered.filter((item) => item.outlet.toLowerCase() === outlet);
        }
        if (search) {
          filtered = filtered.filter((item) =>
            [
              item.name,
              item.variant,
              item.sku,
              item.channel,
              item.outlet,
            ].some((value) => value.toLowerCase().includes(search)),
          );
        }

        const statusWeight: Record<InventoryStatus, number> = {
          out_of_stock: 0,
          low_stock: 1,
          in_stock: 2,
        };

        filtered.sort((a, b) => {
          const statusDelta = statusWeight[a.status] - statusWeight[b.status];
          if (statusDelta !== 0) return statusDelta;
          if (a.name !== b.name) return a.name.localeCompare(b.name);
          return a.variant.localeCompare(b.variant);
        });

        return res.json(filtered);
      } catch (err) {
        console.error("Error in GET /api/admin/inventory/products", err);
        return res.status(500).json({ error: "Failed to load inventory products" });
      }
    },
  );

  app.get(
    "/api/admin/inventory/movements",
    requireAdmin,
    async (req: Request, res: Response) => {
      try {
        const type = (getQueryParam(req.query.type) ?? "all").trim().toLowerCase();
        const search = (getQueryParam(req.query.search) ?? "").trim().toLowerCase();
        const outlet = (getQueryParam(req.query.outlet) ?? "").trim().toLowerCase();

        const manualMovementRows = await db
          .select()
          .from(inventoryMovements)
          .orderBy(desc(inventoryMovements.createdAt));

        const orderMovementRows = await db
          .select({
            orderId: orders.id,
            createdAt: orders.createdAt,
            source: orders.source,
            productId: orderItems.productId,
            quantity: orderItems.quantity,
            unitPrice: orderItems.unitPrice,
          })
          .from(orderItems)
          .innerJoin(orders, eq(orderItems.orderId, orders.id))
          .orderBy(desc(orders.createdAt));

        const orderGroups = new Map<string, {
          id: string;
          occurredAt: Date;
          outlet: string;
          ref: string;
          type: "stock_out";
          quantity: number;
          value: number;
          skuIds: Set<string>;
          channel: string;
        }>();

        for (const row of orderMovementRows) {
          const existing = orderGroups.get(row.orderId) ?? {
            id: `order-${row.orderId}`,
            occurredAt: row.createdAt ?? new Date(),
            outlet: formatInventoryOutlet(row.source),
            ref: `ORD-${row.orderId.slice(0, 8)}`,
            type: "stock_out" as const,
            quantity: 0,
            value: 0,
            skuIds: new Set<string>(),
            channel: formatInventoryChannel(row.source),
          };
          existing.quantity += row.quantity;
          existing.value += parseNumericValue(row.unitPrice) * row.quantity;
          existing.skuIds.add(row.productId);
          orderGroups.set(row.orderId, existing);
        }

        const movements = [
          ...manualMovementRows.map((movement) => ({
            id: `manual-${movement.id}`,
            occurredAt: movement.createdAt,
            outlet: movement.outlet,
            ref: movement.reference || `MOV-${movement.id}`,
            type: movement.movementType as "stock_in" | "stock_out" | "transfer",
            quantity: movement.quantity,
            value: parseNumericValue(movement.totalValue),
            skuCount: 1,
            channel: movement.channel,
            notes: movement.notes,
          })),
          ...Array.from(orderGroups.values()).map((movement) => ({
            id: movement.id,
            occurredAt: movement.occurredAt,
            outlet: movement.outlet,
            ref: movement.ref,
            type: movement.type,
            quantity: movement.quantity,
            value: movement.value,
            skuCount: movement.skuIds.size,
            channel: movement.channel,
            notes: null,
          })),
        ];

        let filtered = movements;
        if (type && type !== "all" && type !== "all types") {
          const normalizedType = type.replace(/\s+/g, "_");
          filtered = filtered.filter((movement) => movement.type === normalizedType);
        }
        if (outlet) {
          filtered = filtered.filter((movement) => movement.outlet.toLowerCase() === outlet);
        }
        if (search) {
          filtered = filtered.filter((movement) =>
            [movement.outlet, movement.ref, movement.channel].some((value) =>
              value.toLowerCase().includes(search),
            ),
          );
        }

        filtered.sort((a, b) => b.occurredAt.getTime() - a.occurredAt.getTime());

        return res.json(
          filtered.map((movement) => ({
            ...movement,
            occurredAt: movement.occurredAt.toISOString(),
          })),
        );
      } catch (err) {
        console.error("Error in GET /api/admin/inventory/movements", err);
        return res.status(500).json({ error: "Failed to load inventory movements" });
      }
    },
  );

  app.post(
    "/api/admin/inventory/stock-in",
    requireAdmin,
    validateRequest(z.object({
      items: z.array(z.object({
        productId: z.string().trim().min(1),
        variantId: z.number().int().nullable().optional(),
        quantity: z.number().int().min(1),
      })).min(1),
    })),
    async (req: Request, res: Response) => {
      try {
        const { items } = req.body as {
          items: Array<{
            productId: string;
            variantId?: number | null;
            quantity: number;
          }>;
        };
        const actorId = (req.user as { id?: string } | undefined)?.id ?? null;

        for (const item of items) {
          const [product] = await db
            .select()
            .from(products)
            .where(eq(products.id, item.productId))
            .limit(1);

          if (!product) {
            return res.status(404).json({ error: `Product not found: ${item.productId}` });
          }

          const costPrice = product.costPrice || Math.floor(parseNumericValue(product.price) * 0.5);
          let variantId = item.variantId ?? null;
          let batch = 1;

          if (variantId) {
            const [variant] = await db
              .select()
              .from(productVariants)
              .where(eq(productVariants.id, variantId))
              .limit(1);

            if (!variant) {
              return res.status(404).json({ error: `Variant not found: ${variantId}` });
            }

            batch = variant.id;
            await db
              .update(productVariants)
              .set({
                stock: (variant.stock ?? 0) + item.quantity,
                updatedAt: new Date(),
              })
              .where(eq(productVariants.id, variant.id));
          } else {
            const [created] = await db
              .insert(productVariants)
              .values({
                productId: item.productId,
                size: "ONE",
                stock: item.quantity,
                sku: `${product.sku || `RR-${product.id}`}-ONE`,
              })
              .returning();

            variantId = created.id;
            batch = created.id;
          }

          await syncProductStock(item.productId);
          await recordInventoryMovement({
            productId: item.productId,
            variantId,
            movementType: "stock_in",
            quantity: item.quantity,
            unitCost: costPrice,
            totalValue: item.quantity * costPrice,
            outlet: INVENTORY_DEFAULT_OUTLET,
            channel: "Admin",
            batch,
            reference: "MANUAL-STOCK-IN",
            createdById: actorId,
          });
        }

        summaryCache = null;
        return res.json({ success: true });
      } catch (err) {
        console.error("Error in POST /api/admin/inventory/stock-in", err);
        return res.status(500).json({ error: "Failed to stock in items" });
      }
    },
  );

  app.patch(
    "/api/admin/inventory/:productId/stock",
    requireAdmin,
    validateRequest(z.object({
      variantId: z.number().int().nullable().optional(),
      newStock: z.number().int(),
    })),
    async (req: Request, res: Response) => {
      try {
        const { productId } = req.params;
        const { variantId, newStock } = req.body;
        const actorId = (req.user as { id?: string } | undefined)?.id ?? null;

        if (newStock < 0) {
          return res.status(400).json({ error: "Stock cannot be negative" });
        }

        const [product] = await db
          .select()
          .from(products)
          .where(eq(products.id, productId as string))
          .limit(1);

        if (!product) {
          return res.status(404).json({ error: "Product not found" });
        }

        if (!variantId) {
          return res.status(400).json({ error: "Variant ID is required for precise stock updates" });
        }

        const [existingVariant] = await db
          .select()
          .from(productVariants)
          .where(
            and(
              eq(productVariants.id, variantId),
              eq(productVariants.productId, productId as string),
            ),
          )
          .limit(1);

        if (!existingVariant) {
          return res.status(404).json({ error: "Variant not found" });
        }

        const previousStock = existingVariant.stock ?? 0;
        const quantityDelta = newStock - previousStock;

        await db
          .update(productVariants)
          .set({ stock: newStock, updatedAt: new Date() })
          .where(eq(productVariants.id, existingVariant.id));

        await syncProductStock(productId as string);

        if (quantityDelta !== 0) {
          const costPrice = product.costPrice || Math.floor(parseNumericValue(product.price) * 0.5);
          await recordInventoryMovement({
            productId: productId as string,
            variantId: existingVariant.id,
            movementType: quantityDelta > 0 ? "stock_in" : "stock_out",
            quantity: Math.abs(quantityDelta),
            unitCost: costPrice,
            totalValue: Math.abs(quantityDelta) * costPrice,
            outlet: INVENTORY_DEFAULT_OUTLET,
            channel: "Admin",
            batch: existingVariant.id,
            reference: "MANUAL-ADJUSTMENT",
            notes: `Adjusted ${existingVariant.size}${existingVariant.color ? ` / ${existingVariant.color}` : ""} stock from ${previousStock} to ${newStock}`,
            createdById: actorId,
          });
        }

        summaryCache = null;
        return res.json({ success: true });
      } catch (err) {
        console.error("Error in PATCH /api/admin/inventory/:productId/stock", err);
        return res.status(500).json({ error: "Failed to update stock" });
      }
    },
  );

  app.post(
    "/api/admin/inventory/seed-variants",
    requireAdmin,
    async (_req: Request, res: Response) => {
      try {
        const productRows = await db
          .select({
            id: products.id,
            name: products.name,
            stock: products.stock,
            price: products.price,
            sku: products.sku,
          })
          .from(products);

        let seeded = 0;
        let skipped = 0;

        for (const product of productRows) {
          const [existingCount] = await db
            .select({ count: sql<number>`count(*)::int` })
            .from(productVariants)
            .where(eq(productVariants.productId, product.id));

          if ((existingCount?.count ?? 0) > 0) {
            skipped += 1;
            continue;
          }

          const stock = product.stock ?? 0;
          const s = Math.floor(stock * 0.2);
          const m = Math.floor(stock * 0.35);
          const l = Math.floor(stock * 0.3);
          const xl = stock - s - m - l;
          const baseSku = product.sku || `RR-${product.id}`;

          await db.insert(productVariants).values([
            { productId: product.id, size: "S", stock: s, sku: `${baseSku}-S` },
            { productId: product.id, size: "M", stock: m, sku: `${baseSku}-M` },
            { productId: product.id, size: "L", stock: l, sku: `${baseSku}-L` },
            { productId: product.id, size: "XL", stock: xl, sku: `${baseSku}-XL` },
          ]);

          seeded += 1;
        }

        summaryCache = null;
        return res.json({ seeded, skipped });
      } catch (err) {
        console.error("Error in POST /api/admin/inventory/seed-variants", err);
        return res.status(500).json({ error: "Failed to seed variants" });
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
    validateRequest(insertProductAttributeSchema),
    async (req: Request, res: Response) => {
      try {
        const attribute = await storage.createProductAttribute(req.body);
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
        const limit = getQueryParam(req.query.limit);
        const timeRange = getQueryParam(req.query.timeRange);

        const [orders, total] = await Promise.all([
          storage.getOrders({
            status: status as any,
            search,
            page: page ? parseInt(page) : undefined,
            limit: limit ? parseInt(limit) : undefined,
            timeRange: timeRange ?? undefined,
          }),
          storage.getOrdersCount({
            status: status as any,
            search,
            timeRange: timeRange ?? undefined,
          }),
        ]);

        return res.json({ success: true, data: orders, total });
      } catch (err) {
        console.error("Error in GET /api/admin/orders", err);
        return res
          .status(500)
          .json({ success: false, error: "Failed to load orders" });
      }
    },
  );

  // Admin order trends (aggregated)
  app.get(
    "/api/admin/orders/trends",
    requireAdmin,
    async (req: Request, res: Response) => {
      try {
        const status = getQueryParam(req.query.status);
        const search = getQueryParam(req.query.search);
        const timeRange = getQueryParam(req.query.timeRange);
        const conditions = [];

        if (status) {
          conditions.push(eq(orders.status, status as any));
        }

        if (search) {
          const q = `%${search}%`;
          conditions.push(
            or(
              ilike(orders.fullName, q),
              ilike(orders.email, q),
              ilike(orders.id, q),
            ),
          );
        }

        const dayMs = 24 * 60 * 60 * 1000;
        const now = new Date();
        const startOfDay = (value: Date) => {
          const d = new Date(value);
          d.setHours(0, 0, 0, 0);
          return d;
        };

        let rangeStart: Date | null = null;
        let rangeEnd: Date | null = startOfDay(now);

        if (timeRange && timeRange !== "all") {
          const days =
            timeRange === "1d"
              ? 1
              : timeRange === "3d"
                ? 3
                : timeRange === "7d"
                  ? 7
                  : timeRange === "30d"
                    ? 30
                    : 7;
          rangeStart = startOfDay(new Date(now.getTime() - (days - 1) * dayMs));
          conditions.push(gte(orders.createdAt, rangeStart));
        }

        const whereClause =
          conditions.length > 0 ? and(...conditions) : undefined;

        const rows = await db
          .select({
            day: sql<Date>`date_trunc('day', ${orders.createdAt})`,
            revenue: sql<number>`coalesce(sum(${orders.total}), 0)`,
            total: sql<number>`count(*)`,
            completed: sql<number>`sum(case when ${orders.status} = 'completed' then 1 else 0 end)`,
            pending: sql<number>`sum(case when ${orders.status} = 'pending' then 1 else 0 end)`,
          })
          .from(orders)
          .where(whereClause)
          .groupBy(sql`date_trunc('day', ${orders.createdAt})`)
          .orderBy(sql`date_trunc('day', ${orders.createdAt})`);

        if (!rangeStart && rows.length > 0) {
          rangeStart = startOfDay(rows[0].day);
        }

        if (!rangeStart || !rangeEnd) {
          return res.json({
            success: true,
            data: { rangeStart: null, rangeEnd: null, series: [] },
          });
        }

        const series = rows
          .map((row) => {
            const parsedDay =
              row.day instanceof Date
                ? row.day
                : new Date(typeof row.day === "string" ? row.day : String(row.day));
            if (Number.isNaN(parsedDay.getTime())) {
              return null;
            }

            return {
              day: parsedDay.toISOString().split("T")[0],
              revenue: Number(row.revenue ?? 0),
              total: Number(row.total ?? 0),
              completed: Number(row.completed ?? 0),
              pending: Number(row.pending ?? 0),
            };
          })
          .filter((entry): entry is {
            day: string;
            revenue: number;
            total: number;
            completed: number;
            pending: number;
          } => Boolean(entry));

        return res.json({
          success: true,
          data: {
            rangeStart: rangeStart.toISOString(),
            rangeEnd: rangeEnd.toISOString(),
            series,
          },
        });
      } catch (err) {
        console.error("Error in GET /api/admin/orders/trends", err);
        return res
          .status(500)
          .json({ success: false, error: "Failed to load order trends" });
      }
    },
  );

  const statusSchema = z.object({
    status: z.enum(["pending", "processing", "completed", "cancelled", "pos"]),
  });

  app.put(
    "/api/admin/orders/:id",
    requireAdmin,
    validateRequest(statusSchema),
    async (req: Request, res: Response) => {
      try {
        const { id } = req.params;
        if (typeof id !== "string") return res.status(400).json({ success: false, error: "Invalid ID" });
        const updated = await storage.updateOrderStatus(
          id,
          req.body.status,
        );

        // Auto-generate bill only when order is completed AND payment is verified
        if (req.body.status === "completed") {
          try {
            const orderDetails = await storage.getOrderById(id);
            if (orderDetails.paymentVerified === "verified") {
              const user = req.user as any;
              await generateBillFromOrder(
                id,
                user?.id ?? "system",
                user?.name ?? user?.email ?? "Admin"
              );
              console.log(`✅ Bill auto-generated for order ${id} (completed + paid)`);
            } else {
              console.log(`⏳ Bill deferred for order ${id} — payment not yet verified`);
            }
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
              req.body.status,
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
    validateRequest(verifyPaymentSchema),
    async (req: Request, res: Response) => {
      try {
        const { id } = req.params;
        if (typeof id !== "string") return res.status(400).json({ success: false, error: "Invalid ID" });
        const updated = await storage.updateOrderPaymentVerified(
          id,
          req.body.paymentVerified,
        );

        // Auto-generate bill when payment is verified AND order is already completed
        if (req.body.paymentVerified === "verified") {
          try {
            const orderDetails = await storage.getOrderById(id);
            
            // Auto-update status to "processing" if still pending
            if (orderDetails.status === "pending") {
              await storage.updateOrderStatus(id, "processing");
            }
            
            if (orderDetails.status === "completed") {
              const user = req.user as any;
              await generateBillFromOrder(
                id,
                user?.id ?? "system",
                user?.name ?? user?.email ?? "Admin"
              );
              console.log(`✅ Bill auto-generated for order ${id} (paid + completed)`);
            }
          } catch (billErr) {
            console.error("Bill generation failed on payment verify (non-critical):", billErr);
          }
        }

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
        const allOrders = await storage.getOrders();

        const rows: string[] = [];
        rows.push("Order,Customer,Email,Date,Items,Status,Amount");

        const escapeCsv = (value: string | number | null | undefined) => {
          const safe = value == null ? "" : String(value);
          return `"${safe.replace(/"/g, '""')}"`;
        };

        for (const order of allOrders) {
          const items = (order as unknown as { items?: Array<unknown> }).items;
          const itemsCount = Array.isArray(items) ? items.length : 0;
          const date = order.createdAt
            ? new Date(order.createdAt).toISOString()
            : "";

          rows.push(
            [
              escapeCsv(order.id),
              escapeCsv(order.fullName),
              escapeCsv(order.email),
              escapeCsv(date),
              itemsCount.toString(),
              escapeCsv(order.status),
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
        const customers = await storage.getCustomers({ includeZeroOrders: true });

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
        const timeRange = getQueryParam(req.query.timeRange);
        const page = getQueryParam(req.query.page);
        const limit = getQueryParam(req.query.limit);
        const includeZeroOrders = getQueryParam(req.query.includeZeroOrders);

        const includeZero =
          includeZeroOrders === null || includeZeroOrders === undefined
            ? true
            : !(includeZeroOrders === "false" || includeZeroOrders === "0");

        const [customers, total] = await Promise.all([
          storage.getCustomers({
            search: search ?? undefined,
            timeRange: timeRange ?? undefined,
            page: page ? parseInt(page) : undefined,
            limit: limit ? parseInt(limit) : undefined,
            includeZeroOrders: includeZero,
          }),
          storage.getCustomersCount({
            search: search ?? undefined,
            includeZeroOrders: includeZero,
          }),
        ]);

        return res.json({ success: true, data: customers, total });
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

  // Lightweight customer phones for Marketing SMS targeting.
  app.get(
    "/api/admin/customers/phones",
    requireAdminPageAccess("marketing"),
    async (_req: Request, res: Response) => {
      try {
        const rows = await db
          .select({
            email: customers.email,
            phoneNumber: customers.phoneNumber,
            firstName: customers.firstName,
            lastName: customers.lastName,
          })
          .from(customers)
          .where(sql`${customers.phoneNumber} is not null and ${customers.phoneNumber} != ''`)
          .orderBy(desc(customers.createdAt));

        return res.json({ success: true, data: rows });
      } catch (err) {
        console.error("Error in GET /api/admin/customers/phones", err);
        return res
          .status(500)
          .json({ success: false, error: "Failed to load customer phone numbers" });
      }
    },
  );

  app.post(
    "/api/admin/customers",
    requireAdmin,
    validateRequest(z.object({
      firstName: z.string().min(1),
      lastName: z.string().min(1),
      email: z.string().email().optional(),
      phoneNumber: z.string().optional(),
    })),
    async (req: Request, res: Response) => {
      try {
        const { firstName, lastName, email, phoneNumber } = req.body;
        
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
    async (req: Request, res: Response) => {
      try {
        const actor = req.user as Express.User | undefined;
        const isRootActor = actor?.role?.toLowerCase() === "superadmin";
        const users = await storage.getAdminUsers();
        const filtered = users
          .filter((userRow) => isRootActor || userRow.role.toLowerCase() !== "superadmin")
          .sort((a, b) => {
            const aIsSuper = a.role.toLowerCase() === "superadmin";
            const bIsSuper = b.role.toLowerCase() === "superadmin";
            if (aIsSuper !== bIsSuper) return aIsSuper ? -1 : 1;
            return (b.lastLoginAt?.getTime?.() ?? 0) - (a.lastLoginAt?.getTime?.() ?? 0);
          });
        return res.json({ success: true, data: filtered });
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
    async (req: Request, res: Response) => {
      try {
        const actor = req.user as Express.User | undefined;
        const isRootActor = actor?.role?.toLowerCase() === "superadmin";
        const users = await storage.getStoreUsers();
        const filtered = users
          .filter((userRow) => isRootActor || userRow.role.toLowerCase() !== "superadmin")
          .sort((a, b) => {
            const aIsSuper = a.role.toLowerCase() === "superadmin";
            const bIsSuper = b.role.toLowerCase() === "superadmin";
            if (aIsSuper !== bIsSuper) return aIsSuper ? -1 : 1;
            return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
          });
        return res.json({ success: true, data: filtered });
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

  const updateStoreUserRoleEnum = z.enum(["superadmin", "owner", "manager", "csr", "admin", "staff"]);
  const privilegedAdminRoles = new Set(["superadmin", "owner", "admin"]);
  const isSuperAdmin = (role: string | null | undefined) => role?.toLowerCase() === "superadmin";
  const canManagePrivilegedAdminRoles = (actor: Express.User | undefined) =>
    isSuperAdmin(actor?.role);

  const updateStoreUserSchema = z
    .object({
      role: updateStoreUserRoleEnum.optional(),
      email_notifications: z.boolean().optional(),
      name: z.string().trim().min(1).max(100).optional(),
      profile_image_url: z.string().trim().url().optional(),
      phone_number: z.string().trim().max(40).optional(),
    })
    .refine(
      (v) =>
        v.role !== undefined ||
        v.email_notifications !== undefined ||
        v.name !== undefined ||
        v.profile_image_url !== undefined ||
        v.phone_number !== undefined,
      {
      message: "No update fields provided",
    });

  app.patch(
    "/api/admin/store-users/:id",
    requireAdmin,
    validateRequest(updateStoreUserSchema),
    async (req: Request, res: Response) => {
      const { id } = req.params;
      if (typeof id !== "string") {
        return res.status(400).json({ success: false, error: "Invalid ID" });
      }

      try {
        const { role, email_notifications } = req.body;
        const actor = req.user as Express.User | undefined;
        const target = await storage.getUserById(id);
        if (!target) {
          return res.status(404).json({ success: false, error: "User not found" });
        }

        const targetRole = target.role?.toLowerCase() ?? "";
        if (!canManagePrivilegedAdminRoles(actor) && privilegedAdminRoles.has(targetRole)) {
          return res.status(403).json({
            success: false,
            error: "Only superadmin users can manage owner/admin/superadmin users",
          });
        }

        if (
          role !== undefined &&
          !canManagePrivilegedAdminRoles(actor) &&
          privilegedAdminRoles.has(role.toLowerCase())
        ) {
          return res.status(403).json({
            success: false,
            error: "Only superadmin users can assign owner/admin/superadmin roles",
          });
        }

        const updated = await storage.updateStoreUser(id, {
          role,
          emailNotifications: email_notifications,
          name: typeof req.body.name === "string" ? req.body.name : undefined,
          profileImageUrl:
            typeof req.body.profile_image_url === "string" ? req.body.profile_image_url : undefined,
          phoneNumber: typeof req.body.phone_number === "string" ? req.body.phone_number : undefined,
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
        const target = await storage.getUserById(id);
        if (!target) {
          return res.status(404).json({ success: false, error: "User not found" });
        }

        const targetRole = target.role?.toLowerCase() ?? "";
        if (!canManagePrivilegedAdminRoles(actor) && privilegedAdminRoles.has(targetRole)) {
          return res.status(403).json({
            success: false,
            error: "Only superadmin users can delete owner/admin/superadmin users",
          });
        }

        await storage.deleteUser(id);
        return res.json({ success: true });
      } catch (err) {
        console.error("Error in DELETE /api/admin/store-users/:id", err);
        return res.status(500).json({ success: false, error: "Failed to delete store user" });
      }
    },
  );

  app.get(
    "/api/admin/store-users/:id/overview",
    requireAdmin,
    async (req: Request, res: Response) => {
      const { id } = req.params;
      if (typeof id !== "string") {
        return res.status(400).json({ success: false, error: "Invalid ID" });
      }

      try {
        const actor = req.user as Express.User | undefined;
        const targetUser = await storage.getUserById(id);

        if (!targetUser) {
          return res.status(404).json({ success: false, error: "User not found" });
        }

        const targetRole = targetUser.role?.toLowerCase() ?? "";
        if (!canManagePrivilegedAdminRoles(actor) && privilegedAdminRoles.has(targetRole)) {
          return res.status(403).json({
            success: false,
            error: "Only superadmin users can view owner/admin/superadmin users",
          });
        }

        await ensureAdminProfileSettingsTable();

        await db
          .insert(adminProfileSettings)
          .values({ userId: id })
          .onConflictDoNothing({ target: adminProfileSettings.userId });

        const [settings] = await db
          .select()
          .from(adminProfileSettings)
          .where(eq(adminProfileSettings.userId, id))
          .limit(1);

        const { firstName: fallbackFirst, lastName: fallbackLast } = parseName(
          targetUser.displayName,
          targetUser.username,
        );

        const operationalInsights = await getAdminOperationalInsights(id, targetUser.role);
        const sessions = operationalInsights.sessions.map((session) => ({
          ...session,
          isCurrent: actor?.id === id && session.sid === req.sessionID,
        }));

        return res.json({
          success: true,
          data: {
            profile: {
              id: targetUser.id,
              firstName: settings?.firstName?.trim() || fallbackFirst,
              lastName: settings?.lastName?.trim() || fallbackLast,
              email: targetUser.username,
              phone: targetUser.phoneNumber || "",
              language: settings?.language || "en",
              timezone: settings?.timezone || "Asia/Kathmandu",
              department: settings?.department || "",
              role: targetUser.role,
              status: targetUser.status || "active",
              adminSince: targetUser.createdAt,
              lastLoginAt: targetUser.lastLoginAt,
              twoFactorEnabled: !!targetUser.twoFactorEnabled,
              emailNotifications: !!targetUser.emailNotifications,
              avatarUrl: targetUser.profileImageUrl || null,
            },
            accessScope: operationalInsights.accessScope,
            permissions: operationalInsights.permissions,
            accessOverrides: operationalInsights.accessOverrides,
            stats: {
              ...operationalInsights.stats,
            },
            recentActivity: operationalInsights.recentActivity,
            orderActivity: operationalInsights.orderActivity,
            sessions,
          },
        });
      } catch (err) {
        console.error("Error in GET /api/admin/store-users/:id/overview", err);
        return res.status(500).json({ success: false, error: "Failed to load store user overview" });
      }
    },
  );

  const updateStoreUserProfileSchema = z
    .object({
      firstName: z.string().trim().min(1).max(60).optional(),
      lastName: z.string().trim().max(60).optional(),
      phone: z.string().trim().max(40).optional(),
      language: z.string().trim().min(2).max(60).optional(),
      timezone: z.string().trim().min(2).max(80).optional(),
      department: z.string().trim().max(120).optional(),
      loginAlerts: z.boolean().optional(),
      emailNotifications: z.boolean().optional(),
      pageAccessOverrides: z.array(z.enum(ADMIN_PAGE_KEYS)).optional(),
    })
    .refine(
      (value) =>
        value.firstName !== undefined ||
        value.lastName !== undefined ||
        value.phone !== undefined ||
        value.language !== undefined ||
        value.timezone !== undefined ||
        value.department !== undefined ||
        value.loginAlerts !== undefined ||
        value.emailNotifications !== undefined ||
        value.pageAccessOverrides !== undefined,
      { message: "No update fields provided" },
    );

  app.patch(
    "/api/admin/store-users/:id/profile",
    requireAdmin,
    validateRequest(updateStoreUserProfileSchema),
    async (req: Request, res: Response) => {
      const { id } = req.params;
      if (typeof id !== "string") {
        return res.status(400).json({ success: false, error: "Invalid ID" });
      }

      try {
        const actor = req.user as Express.User | undefined;
        if (!canManagePrivilegedAdminRoles(actor)) {
          return res.status(403).json({ success: false, error: "Only superadmin users can edit store-user profiles" });
        }

        const targetUser = await storage.getUserById(id);
        if (!targetUser) {
          return res.status(404).json({ success: false, error: "User not found" });
        }

        await ensureAdminProfileSettingsTable();

        await db
          .insert(adminProfileSettings)
          .values({ userId: id })
          .onConflictDoNothing({ target: adminProfileSettings.userId });

        const [existingSettings] = await db
          .select()
          .from(adminProfileSettings)
          .where(eq(adminProfileSettings.userId, id))
          .limit(1);

        const payload = req.body as z.infer<typeof updateStoreUserProfileSchema>;
        const currentName = parseName(targetUser.displayName, targetUser.username);
        const nextFirstName = payload.firstName ?? existingSettings?.firstName ?? currentName.firstName;
        const nextLastName = payload.lastName ?? existingSettings?.lastName ?? currentName.lastName;

        const userUpdateData: Record<string, unknown> = {};
        if (payload.phone !== undefined) userUpdateData.phoneNumber = payload.phone;
        if (payload.emailNotifications !== undefined) userUpdateData.emailNotifications = payload.emailNotifications;
        if (payload.firstName !== undefined || payload.lastName !== undefined) {
          userUpdateData.displayName = buildDisplayName(nextFirstName, nextLastName, targetUser.displayName);
        }

        if (Object.keys(userUpdateData).length > 0) {
          await db.update(users).set(userUpdateData).where(eq(users.id, id));
        }

        await db
          .update(adminProfileSettings)
          .set({
            firstName: nextFirstName,
            lastName: nextLastName,
            language: payload.language ?? existingSettings?.language ?? "en",
            timezone: payload.timezone ?? existingSettings?.timezone ?? "Asia/Kathmandu",
            department: payload.department ?? existingSettings?.department ?? null,
            loginAlerts: payload.loginAlerts ?? existingSettings?.loginAlerts ?? true,
            pageAccessOverrides:
              payload.pageAccessOverrides !== undefined
                ? normalizeAdminPageList(payload.pageAccessOverrides)
                : normalizeAdminPageList(existingSettings?.pageAccessOverrides),
            updatedAt: sql`now()`,
          })
          .where(eq(adminProfileSettings.userId, id));

        return res.json({ success: true });
      } catch (err) {
        console.error("Error in PATCH /api/admin/store-users/:id/profile", err);
        return res.status(500).json({ success: false, error: "Failed to update store user profile" });
      }
    },
  );

  const adminProfilePatchSchema = z
    .object({
      firstName: z.string().trim().min(1).max(60).optional(),
      lastName: z.string().trim().max(60).optional(),
      email: z.string().trim().email().optional(),
      phone: z.string().trim().max(40).optional(),
      language: z.string().trim().min(2).max(60).optional(),
      timezone: z.string().trim().min(2).max(80).optional(),
      department: z.string().trim().max(120).optional(),
      preferences: z
        .object({
          compactSidebar: z.boolean().optional(),
          showNPRCurrency: z.boolean().optional(),
          orderAlertSound: z.boolean().optional(),
          loginAlerts: z.boolean().optional(),
        })
        .optional(),
      notifications: z
        .object({
          newOrders: z.boolean().optional(),
          lowStock: z.boolean().optional(),
          customerReviews: z.boolean().optional(),
          dailySummary: z.boolean().optional(),
          paymentFailures: z.boolean().optional(),
          marketingReports: z.boolean().optional(),
        })
        .optional(),
    })
    .refine(
      (v) =>
        v.firstName !== undefined ||
        v.lastName !== undefined ||
        v.email !== undefined ||
        v.phone !== undefined ||
        v.language !== undefined ||
        v.timezone !== undefined ||
        v.department !== undefined ||
        v.preferences !== undefined ||
        v.notifications !== undefined,
      { message: "No update fields provided" },
    );

  app.get("/api/admin/profile/overview", requireAuth, async (req: Request, res: Response) => {
    try {
      const actor = req.user as Express.User | undefined;
      if (!actor || !canAccessAdminPanel(actor.role)) {
        return res.status(403).json({ success: false, error: "Forbidden" });
      }

      await ensureAdminProfileSettingsTable();

      const currentUser = await storage.getUserById(actor.id);
      if (!currentUser) {
        return res.status(404).json({ success: false, error: "User not found" });
      }

      await db
        .insert(adminProfileSettings)
        .values({ userId: actor.id })
        .onConflictDoNothing({ target: adminProfileSettings.userId });

      const [settings] = await db
        .select()
        .from(adminProfileSettings)
        .where(eq(adminProfileSettings.userId, actor.id))
        .limit(1);

      const { firstName: fallbackFirst, lastName: fallbackLast } = parseName(
        currentUser.displayName,
        currentUser.username,
      );
      const firstName = settings?.firstName?.trim() || fallbackFirst;
      const lastName = settings?.lastName?.trim() || fallbackLast;
      const notificationPrefs = mergeNotificationPrefs(
        (settings?.notificationPrefs as Record<string, unknown> | null | undefined) ?? undefined,
      );

      const operationalInsights = await getAdminOperationalInsights(actor.id, currentUser.role);
      const sessionData = operationalInsights.sessions.map((session) => ({
        ...session,
        isCurrent: session.sid === req.sessionID,
      }));

      return res.json({
        success: true,
        data: {
          profile: {
            firstName,
            lastName,
            email: currentUser.username,
            phone: currentUser.phoneNumber || "",
            language: settings?.language || "en",
            timezone: settings?.timezone || "Asia/Kathmandu",
            department: settings?.department || "",
            role: currentUser.role,
            adminSince: currentUser.createdAt,
            twoFactorEnabled: !!currentUser.twoFactorEnabled,
            loginAlerts: settings?.loginAlerts ?? true,
            avatarUrl: currentUser.profileImageUrl || null,
          },
          preferences: {
            compactSidebar: settings?.compactSidebar ?? false,
            showNPRCurrency: settings?.showNprCurrency ?? true,
            orderAlertSound: settings?.orderAlertSound ?? true,
          },
          notifications: notificationPrefs,
          stats: {
            ordersManaged: operationalInsights.stats.ordersProcessed,
            revenueProcessed: operationalInsights.stats.totalSales,
            productsManaged: operationalInsights.stats.productsManaged,
            stockEntries: operationalInsights.stats.stockEntries,
            adminActions30d: operationalInsights.stats.adminActions30d,
          },
          accessScope: operationalInsights.accessScope,
          permissions: operationalInsights.permissions,
          accessOverrides: operationalInsights.accessOverrides,
          recentActivity: operationalInsights.recentActivity,
          orderActivity: operationalInsights.orderActivity,
          sessions: sessionData,
        },
      });
    } catch (err) {
      console.error("Error in GET /api/admin/profile/overview", err);
      return res.status(500).json({ success: false, error: "Failed to load profile overview" });
    }
  });

  app.patch(
    "/api/admin/profile",
    requireAuth,
    validateRequest(adminProfilePatchSchema),
    async (req: Request, res: Response) => {
      try {
        const actor = req.user as Express.User | undefined;
        if (!actor || !canAccessAdminPanel(actor.role)) {
          return res.status(403).json({ success: false, error: "Forbidden" });
        }

        await ensureAdminProfileSettingsTable();

        const currentUser = await storage.getUserById(actor.id);
        if (!currentUser) {
          return res.status(404).json({ success: false, error: "User not found" });
        }

        await db
          .insert(adminProfileSettings)
          .values({ userId: actor.id })
          .onConflictDoNothing({ target: adminProfileSettings.userId });

        const [existingSettings] = await db
          .select()
          .from(adminProfileSettings)
          .where(eq(adminProfileSettings.userId, actor.id))
          .limit(1);

        const payload = req.body as z.infer<typeof adminProfilePatchSchema>;
        const currentName = parseName(currentUser.displayName, currentUser.username);
        const nextFirstName = payload.firstName ?? existingSettings?.firstName ?? currentName.firstName;
        const nextLastName = payload.lastName ?? existingSettings?.lastName ?? currentName.lastName;

        if (payload.email && payload.email !== currentUser.username) {
          const existingEmailUser = await storage.getUserByEmail(payload.email);
          if (existingEmailUser && existingEmailUser.id !== actor.id) {
            return res.status(400).json({ success: false, error: "Email already in use" });
          }
        }

        const userUpdateData: Record<string, unknown> = {};
        if (payload.phone !== undefined) userUpdateData.phoneNumber = payload.phone;
        if (payload.email !== undefined) userUpdateData.username = payload.email;
        if (payload.firstName !== undefined || payload.lastName !== undefined) {
          userUpdateData.displayName = buildDisplayName(nextFirstName, nextLastName, currentUser.displayName);
        }

        if (Object.keys(userUpdateData).length > 0) {
          await db.update(users).set(userUpdateData).where(eq(users.id, actor.id));
        }

        const notificationPrefs = mergeNotificationPrefs({
          ...(existingSettings?.notificationPrefs as Record<string, unknown> | undefined),
          ...(payload.notifications || {}),
        });

        const nextSettings = {
          firstName: nextFirstName,
          lastName: nextLastName,
          language: payload.language ?? existingSettings?.language ?? "en",
          timezone: payload.timezone ?? existingSettings?.timezone ?? "Asia/Kathmandu",
          department: payload.department ?? existingSettings?.department ?? null,
          compactSidebar:
            payload.preferences?.compactSidebar ?? existingSettings?.compactSidebar ?? false,
          showNprCurrency:
            payload.preferences?.showNPRCurrency ?? existingSettings?.showNprCurrency ?? true,
          orderAlertSound:
            payload.preferences?.orderAlertSound ?? existingSettings?.orderAlertSound ?? true,
          loginAlerts: payload.preferences?.loginAlerts ?? existingSettings?.loginAlerts ?? true,
          notificationPrefs,
          updatedAt: sql`now()`,
        };

        await db
          .update(adminProfileSettings)
          .set(nextSettings)
          .where(eq(adminProfileSettings.userId, actor.id));

        return res.json({ success: true });
      } catch (err) {
        console.error("Error in PATCH /api/admin/profile", err);
        return res.status(500).json({ success: false, error: "Failed to update profile" });
      }
    },
  );

  const profileSecuritySchema = z.object({
    twoFactorEnabled: z.boolean().optional(),
    loginAlerts: z.boolean().optional(),
  });

  app.put(
    "/api/admin/profile/security",
    requireAuth,
    validateRequest(profileSecuritySchema),
    async (req: Request, res: Response) => {
      try {
        const actor = req.user as Express.User | undefined;
        if (!actor || !canAccessAdminPanel(actor.role)) {
          return res.status(403).json({ success: false, error: "Forbidden" });
        }
        await ensureAdminProfileSettingsTable();

        if (typeof req.body.twoFactorEnabled === "boolean") {
          await storage.updateUserTwoFactor(actor.id, req.body.twoFactorEnabled);
        }
        if (typeof req.body.loginAlerts === "boolean") {
          await db
            .insert(adminProfileSettings)
            .values({
              userId: actor.id,
              loginAlerts: req.body.loginAlerts,
            })
            .onConflictDoUpdate({
              target: adminProfileSettings.userId,
              set: { loginAlerts: req.body.loginAlerts, updatedAt: sql`now()` },
            });
        }

        return res.json({ success: true });
      } catch (err) {
        console.error("Error in PUT /api/admin/profile/security", err);
        return res.status(500).json({ success: false, error: "Failed to update security settings" });
      }
    },
  );

  app.get("/api/admin/sessions", requireAuth, async (req: Request, res: Response) => {
    try {
      const actor = req.user as Express.User | undefined;
      if (!actor || !canAccessAdminPanel(actor.role)) {
        return res.status(403).json({ success: false, error: "Forbidden" });
      }

      const sessionsResult = await db.execute(sql`
        select
          sid,
          expire,
          coalesce(sess->>'ip', '') as ip,
          coalesce(sess->>'userAgent', '') as user_agent,
          coalesce(sess->>'createdAt', '') as created_at,
          coalesce(sess->>'lastAccessedAt', '') as last_accessed_at
        from session
        where (sess->'passport'->>'user') = ${actor.id}
        order by expire desc
      `);

      const data = sessionsResult.rows.map((row: any) => ({
        sid: String(row.sid),
        isCurrent: String(row.sid) === req.sessionID,
        expiresAt: row.expire ? new Date(row.expire as string).toISOString() : null,
        createdAt: row.created_at ? String(row.created_at) : null,
        lastAccessedAt: row.last_accessed_at ? String(row.last_accessed_at) : null,
        ip: row.ip ? String(row.ip) : null,
        userAgent: row.user_agent ? String(row.user_agent) : null,
      }));

      return res.json({ success: true, data });
    } catch (err) {
      console.error("Error in GET /api/admin/sessions", err);
      return res.status(500).json({ success: false, error: "Failed to load active sessions" });
    }
  });

  app.delete("/api/admin/sessions", requireAuth, async (req: Request, res: Response) => {
    try {
      const actor = req.user as Express.User | undefined;
      if (!actor || !canAccessAdminPanel(actor.role)) {
        return res.status(403).json({ success: false, error: "Forbidden" });
      }
      await db.execute(sql`
        delete from session
        where (sess->'passport'->>'user') = ${actor.id}
          and sid <> ${req.sessionID}
      `);
      return res.json({ success: true });
    } catch (err) {
      console.error("Error in DELETE /api/admin/sessions", err);
      return res.status(500).json({ success: false, error: "Failed to revoke sessions" });
    }
  });

  app.post("/api/admin/profile/reset-2fa", requireAuth, async (req: Request, res: Response) => {
    try {
      const actor = req.user as Express.User | undefined;
      if (!actor || !canAccessAdminPanel(actor.role)) {
        return res.status(403).json({ success: false, error: "Forbidden" });
      }
      await storage.updateUserTwoFactor(actor.id, false);
      return res.json({ success: true });
    } catch (err) {
      console.error("Error in POST /api/admin/profile/reset-2fa", err);
      return res.status(500).json({ success: false, error: "Failed to reset 2FA" });
    }
  });

  app.post("/api/admin/profile/signout-all", requireAuth, async (req: Request, res: Response) => {
    try {
      const actor = req.user as Express.User | undefined;
      if (!actor || !canAccessAdminPanel(actor.role)) {
        return res.status(403).json({ success: false, error: "Forbidden" });
      }
      await db.execute(sql`
        delete from session
        where (sess->'passport'->>'user') = ${actor.id}
      `);
      req.logout((err) => {
        if (err) return res.status(500).json({ success: false, error: "Failed to sign out" });
        req.session.destroy(() => {
          return res.json({ success: true });
        });
      });
    } catch (err) {
      console.error("Error in POST /api/admin/profile/signout-all", err);
      return res.status(500).json({ success: false, error: "Failed to sign out all sessions" });
    }
  });

  app.post("/api/admin/profile/deactivate", requireAuth, async (req: Request, res: Response) => {
    try {
      const actor = req.user as Express.User | undefined;
      if (!actor || !canAccessAdminPanel(actor.role)) {
        return res.status(403).json({ success: false, error: "Forbidden" });
      }
      await db.update(users).set({ status: "inactive" }).where(eq(users.id, actor.id));
      await db.execute(sql`
        delete from session
        where (sess->'passport'->>'user') = ${actor.id}
      `);
      req.logout((err) => {
        if (err) return res.status(500).json({ success: false, error: "Failed to sign out" });
        req.session.destroy(() => {
          return res.json({ success: true });
        });
      });
    } catch (err) {
      console.error("Error in POST /api/admin/profile/deactivate", err);
      return res.status(500).json({ success: false, error: "Failed to deactivate account" });
    }
  });

  const updatePasswordSchema = z.object({
    current: z.string().min(1),
    newPassword: z.string().min(8),
    confirm: z.string().min(8),
  });

  const changePasswordHandler = async (req: Request, res: Response) => {
    const actor = req.user as Express.User | undefined;
    if (!actor || !canAccessAdminPanel(actor.role)) {
      return res.status(403).json({ success: false, error: "Forbidden" });
    }

    const { current, newPassword, confirm } = req.body;
    if (newPassword !== confirm) {
      return res.status(400).json({
        success: false,
        error: "New passwords do not match",
      });
    }

    const fullUser = await storage.getUserById(actor.id);
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
  };

  app.put(
    "/api/admin/profile/password",
    requireAuth,
    validateRequest(updatePasswordSchema),
    async (req: Request, res: Response) => {
      const { current, newPassword, confirm } = req.body;
      if (newPassword !== confirm) {
        return res.status(400).json({
          success: false,
          error: "New passwords do not match",
        });
      }

      return changePasswordHandler(req, res);
    },
  );

  app.post(
    "/api/admin/change-password",
    requireAuth,
    validateRequest(updatePasswordSchema),
    async (req: Request, res: Response) => {
      return changePasswordHandler(req, res);
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
    validateRequest(updateProfileSchema),
    async (req: Request, res: Response) => {
      const user = req.user as Express.User | undefined;
      if (!user) {
        return res.status(401).json({ success: false, error: "Not authenticated" });
      }

      try {
        await storage.updateUserProfile(user.id, req.body);
        return res.json({ success: true });
      } catch (err) {
        console.error("Error in PUT /api/admin/profile/update", err);
        return res.status(500).json({ success: false, error: "Failed to update profile" });
      }
    },
  );

  // Upload avatar image
  const uploadAvatarSchema = z.object({
    imageBase64: z.string().min(1),
    provider: z.enum(["local", "cloudinary", "tigris"]).optional(),
  });

  app.post(
    "/api/admin/profile/upload-avatar",
    requireAuth,
    validateRequest(uploadAvatarSchema),
    async (req: Request, res: Response) => {
      try {
        const { imageBase64, provider = "local" } = req.body;

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

        // Keep avatar uploads consistent with the rest of the admin image pipeline:
        // normalize orientation, constrain dimensions, and always store as WebP.
        const finalBuffer = await sharp(buffer)
          .rotate()
          .resize(1440, 1800, { fit: "inside", withoutEnlargement: true })
          .webp({ quality: 96, effort: 6, smartSubsample: true })
          .toBuffer();

        if (provider === "cloudinary") {
          const uploaded = await uploadMediaToCloudinary(finalBuffer, "profile");
          await storage.updateUserProfile(user.id, { profileImageUrl: uploaded.url });
          return res.json({ success: true, url: uploaded.url, provider: "cloudinary" });
        }

        if (provider === "tigris") {
          const fileName = `avatars/avatar-${user.id}-${Date.now()}.webp`;
          const url = await storageService.uploadFile(finalBuffer, fileName, "image/webp");
          await storage.updateUserProfile(user.id, { profileImageUrl: url });
          return res.json({ success: true, url, provider: "tigris" });
        }

        const avatarDir = path.join(UPLOADS_DIR, "avatars");
        fs.mkdirSync(avatarDir, { recursive: true });
        const filename = `avatar-${user.id}-${Date.now()}.webp`;
        const filepath = path.join(avatarDir, filename);
        fs.writeFileSync(filepath, finalBuffer);
        const url = `/uploads/avatars/${filename}`;
        await storage.updateUserProfile(user.id, { profileImageUrl: url });

        return res.json({ success: true, url, provider: "local" });
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
    validateRequest(updateEmailSchema),
    async (req: Request, res: Response) => {

      const user = req.user as Express.User | undefined;
      if (!user) {
        return res.status(401).json({ success: false, error: "Not authenticated" });
      }

      try {
        const { newEmail } = req.body;

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
    validateRequest(verifyEmailChangeSchema),
    async (req: Request, res: Response) => {

      const user = req.user as Express.User | undefined;
      if (!user) {
        return res.status(401).json({ success: false, error: "Not authenticated" });
      }

      try {
        const { tempToken, code, newEmail } = req.body;

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
    validateRequest(twoFASchema),
    async (req: Request, res: Response) => {

      const { id } = req.params;
      if (typeof id !== "string") return res.status(400).json({ success: false, error: "Invalid ID" });
      try {
        const actor = req.user as Express.User | undefined;
        const target = await storage.getUserById(id);
        if (!target) {
          return res.status(404).json({ success: false, error: "User not found" });
        }
        const targetRole = target.role?.toLowerCase() ?? "";
        if (!canManagePrivilegedAdminRoles(actor) && privilegedAdminRoles.has(targetRole)) {
          return res.status(403).json({
            success: false,
            error: "Only superadmin users can manage owner/admin/superadmin users",
          });
        }
        await storage.updateUserTwoFactor(id, req.body.enabled);
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
        const actor = req.user as Express.User | undefined;
        if (actor?.id === id) {
          return res.status(400).json({ success: false, error: "Cannot delete yourself" });
        }
        const target = await storage.getUserById(id);
        if (!target) {
          return res.status(404).json({ success: false, error: "User not found" });
        }
        const targetRole = target.role?.toLowerCase() ?? "";
        if (!canManagePrivilegedAdminRoles(actor) && privilegedAdminRoles.has(targetRole)) {
          return res.status(403).json({
            success: false,
            error: "Only superadmin users can delete owner/admin/superadmin users",
          });
        }
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
    role: z.enum(["superadmin", "owner", "manager", "csr", "admin", "staff"]),
  });

  app.post(
    "/api/admin/users/invite",
    requireAdmin,
    validateRequest(inviteUserSchema),
    async (req: Request, res: Response) => {

      try {
        const { name, email, role } = req.body;
        const actor = req.user as Express.User | undefined;
        if (!canManagePrivilegedAdminRoles(actor) && privilegedAdminRoles.has(role.toLowerCase())) {
          return res.status(403).json({
            success: false,
            error: "Only superadmin users can invite owner/admin/superadmin users",
          });
        }
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
            : new Date().getFullYear();

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
    validateRequest(z.object({
      key: z.string().min(1).regex(/^[a-z0-9_]+$/),
      label: z.string().min(1),
      isActive: z.boolean().optional(),
    })),
    async (req: Request, res: Response) => {
    try {
      const { key, label, isActive } = req.body;
      const [row] = await db
        .insert(platforms)
        .values({
          key,
          label,
          isActive: isActive ?? true,
        })
        .onConflictDoUpdate({
          target: platforms.key,
          set: { label, isActive: isActive ?? true },
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

  app.patch(
    "/api/admin/messages/read-all",
    requireAdmin,
    async (_req: Request, res: Response) => {
      try {
        const messages = await storage.getContactMessages();
        const unreadMessages = messages.filter((message) => message.status === "unread");

        await Promise.all(
          unreadMessages.map((message) =>
            storage.updateContactMessageStatus(message.id, "read"),
          ),
        );

        return res.json({ success: true, updatedCount: unreadMessages.length });
      } catch (err) {
        console.error("Error in PATCH /api/admin/messages/read-all", err);
        return res
          .status(500)
          .json({ success: false, error: "Failed to mark all messages as read" });
      }
    },
  );

  app.patch(
    "/api/admin/messages/:id/read",
    requireAdmin,
    async (req: Request, res: Response) => {
      try {
        const id = getQueryParam(req.params.id);
        if (!id) {
          return res.status(400).json({ success: false, error: "Message ID is required" });
        }
        const updated = await storage.updateContactMessageStatus(id, "read");
        return res.json({ success: true, data: updated });
      } catch (err) {
        console.error("Error in PATCH /api/admin/messages/:id/read", err);
        return res
          .status(500)
          .json({ success: false, error: "Failed to mark message as read" });
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
    "/api/admin/marketing/channels/status",
    requireAdminPageAccess("marketing"),
    async (_req: Request, res: Response) => {
      try {
        const smtpMissing: string[] = [];
        if (!process.env.SMTP_HOST) smtpMissing.push("SMTP_HOST");
        if (!process.env.SMTP_USER) smtpMissing.push("SMTP_USER");
        if (!process.env.SMTP_PASS) smtpMissing.push("SMTP_PASS");

        const smtpConfigured = smtpMissing.length === 0;
        const sms = getSmsChannelStatus();

        return res.json({
          success: true,
          data: {
            smtp: {
              configured: smtpConfigured,
              missing: smtpMissing,
            },
            sms,
            notes: {
              orderCheckoutEmails: smtpConfigured,
              orderStatusEmails: smtpConfigured,
            },
          },
        });
      } catch (err) {
        console.error("Error in GET /api/admin/marketing/channels/status", err);
        return res
          .status(500)
          .json({ success: false, error: "Failed to load channel status" });
      }
    },
  );

  app.get(
    "/api/admin/marketing/analytics",
    requireAdminPageAccess("marketing"),
    async (_req: Request, res: Response) => {
      try {
        const since = new Date();
        since.setDate(since.getDate() - 30);

        const [subscriberRows, customerRows, orderRows] = await Promise.all([
          db
            .select({ email: newsletterSubscribers.email })
            .from(newsletterSubscribers)
            .where(eq(newsletterSubscribers.status, "active")),
          db
            .select({
              email: customers.email,
              phoneNumber: customers.phoneNumber,
            })
            .from(customers)
            .where(sql`${customers.email} is not null and ${customers.email} != ''`),
          db
            .select({
              email: orders.email,
              total: orders.total,
              status: orders.status,
            })
            .from(orders)
            .where(gte(orders.createdAt, since)),
        ]);

        const reachSet = new Set<string>();
        for (const row of subscriberRows) {
          const email = row.email?.trim().toLowerCase();
          if (email) reachSet.add(email);
        }
        for (const row of customerRows) {
          const email = row.email?.trim().toLowerCase();
          if (email) reachSet.add(email);
        }

        const interactingCustomers = new Set<string>();
        let revenue30d = 0;
        let deliveryUpdates30d = 0;

        for (const row of orderRows) {
          const email = row.email?.trim().toLowerCase();
          if (email) interactingCustomers.add(email);
          revenue30d += Number(row.total ?? 0);

          if (["processing", "completed", "cancelled"].includes((row.status || "").toLowerCase())) {
            deliveryUpdates30d += 1;
          }
        }

        const smsReachableCustomers = customerRows.filter(
          (row) => typeof row.phoneNumber === "string" && row.phoneNumber.trim().length > 0,
        ).length;

        const totalReach = reachSet.size;
        const interactions30d = interactingCustomers.size;
        const interactionRatePct = totalReach > 0 ? Number(((interactions30d / totalReach) * 100).toFixed(2)) : 0;

        return res.json({
          success: true,
          data: {
            totalReach,
            newsletterSubscribers: subscriberRows.length,
            customerEmails: customerRows.length,
            smsReachableCustomers,
            interactions30d,
            totalOrders30d: orderRows.length,
            interactionRatePct,
            revenue30d,
            deliveryUpdates30d,
          },
        });
      } catch (err) {
        console.error("Error in GET /api/admin/marketing/analytics", err);
        return res
          .status(500)
          .json({ success: false, error: "Failed to load marketing analytics" });
      }
    },
  );

  app.post(
    "/api/admin/marketing/sms/send",
    validateRequest(z.object({
      message: z.string().trim().min(1, "Message is required"),
      selectedNumbers: z.array(z.string()).optional(),
      sendToAll: z.boolean().optional(),
    })),
    async (req: Request, res: Response) => {
      try {
        const { message, selectedNumbers, sendToAll } = req.body;

        let targetNumbers: string[] = [];
        if (sendToAll) {
          const rows = await db
            .select({ phoneNumber: customers.phoneNumber })
            .from(customers)
            .where(sql`${customers.phoneNumber} is not null and ${customers.phoneNumber} != ''`);
          targetNumbers = rows.map((row) => row.phoneNumber || "");
        } else {
          targetNumbers = selectedNumbers ?? [];
        }

        targetNumbers = Array.from(new Set(targetNumbers.map((value) => value.trim()).filter(Boolean)));
        if (targetNumbers.length === 0) {
          return res.status(400).json({
            success: false,
            error: "No SMS recipients selected",
          });
        }

        const result = await sendMarketingSMS(targetNumbers, message);

        if (result.failed > 0) {
          return res.status(502).json({
            success: false,
            error: "SMS delivery failed for one or more recipients",
            sent: result.sent,
            failed: result.failed,
            errors: result.errors,
          });
        }

        return res.json({
          success: true,
          sent: result.sent,
          failed: result.failed,
        });
      } catch (err) {
        console.error("Error in POST /api/admin/marketing/sms/send", err);
        return res.status(500).json({
          success: false,
          error: "Failed to send SMS campaign",
        });
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
    validateRequest(z.object({ emails: z.array(z.string().email()).min(1) })),
    async (req: Request, res: Response) => {
      try {
        const emails = Array.from(new Set((req.body.emails as string[]).map((e: string) => e.toLowerCase())));
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
  app.post(
    "/api/admin/bills/pos",
    requireAdmin,
    validateRequest(z.object({
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
    })),
    async (req: Request, res: Response) => {
      try {
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
        } = req.body;

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
          variantId: item.variantId ? Number(item.variantId) : null,
          size: item.size || item.selectedSize || "",
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

      for (const item of items) {
        const productId = String(item.productId);
        const size = item.size || item.selectedSize || null;

        if (size) {
          const variant = await db
            .select()
            .from(productVariants)
            .where(and(
              eq(productVariants.productId, productId),
              eq(productVariants.size, size),
            ))
            .limit(1);

          if (variant.length > 0) {
            const newStock = Math.max(0, (variant[0].stock ?? 0) - Number(item.quantity ?? 0));
            await db
              .update(productVariants)
              .set({ stock: newStock, updatedAt: new Date() })
              .where(eq(productVariants.id, variant[0].id));
          }
        }

        const allVariants = await db
          .select()
          .from(productVariants)
          .where(eq(productVariants.productId, productId));

        if (allVariants.length > 0) {
          const totalStock = allVariants.reduce((sum, variant) => sum + (variant.stock ?? 0), 0);

          await db
            .update(products)
            .set({
              stock: totalStock,
              isActive: totalStock > 0 ? sql`${products.isActive}` : false,
              updatedAt: new Date(),
            })
            .where(eq(products.id, productId));
        } else {
          const existingProduct = await db
            .select({ stock: products.stock })
            .from(products)
            .where(eq(products.id, productId))
            .limit(1);

          if (existingProduct.length > 0) {
            const newStock = Math.max(0, (existingProduct[0].stock ?? 0) - Number(item.quantity ?? 0));
            await db
              .update(products)
              .set({
                stock: newStock,
                isActive: newStock > 0 ? sql`${products.isActive}` : false,
                updatedAt: new Date(),
              })
              .where(eq(products.id, productId));
          }
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
    applicableProductIds: z.array(z.string().min(1)).optional().nullable(),
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

  app.post(
    "/api/admin/promo-codes",
    requireAdmin,
    validateRequest(adminPromoCodeUpsertSchema),
    async (req: Request, res: Response) => {
      try {
        const {
          code,
          discountPct,
          discount,
          maxUses,
          active,
          applicableProductIds,
          expiresAt,
          durationPreset,
        } = req.body;

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

  async function updatePromoCodeById(id: string, payload: any, res: Response) {
    const {
      code,
      discountPct,
      discount,
      maxUses,
      active,
      applicableProductIds,
      expiresAt,
      durationPreset,
    } = payload;

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
  app.post(
    "/api/promo/validate",
    validateRequest(z.object({
      code: z.string().min(3).max(50),
      items: z
        .array(
          z.object({
            productId: z.union([z.coerce.number().int(), z.string().min(1)]),
          }),
        )
        .min(1),
    })),
    async (req: Request, res: Response) => {
      try {
        const now = new Date();
        const promo = await storage.getPromoCodeByCode(req.body.code);

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
          req.body.items
            .map((it: any) => String(it.productId))
            .filter((id: string) => id.length > 0),
        );

        const matches = promo.applicableProductIds.some((pid: string) =>
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

  // Dynamic QR images for checkout payment methods.
  app.get("/api/storefront/payment-qr", async (_req: Request, res: Response) => {
    try {
      const rows = await db
        .select({
          category: mediaAssets.category,
          url: mediaAssets.url,
        })
        .from(mediaAssets)
        .where(
          inArray(mediaAssets.category, [
            PAYMENT_QR_CATEGORIES.esewa,
            PAYMENT_QR_CATEGORIES.khalti,
            PAYMENT_QR_CATEGORIES.fonepay,
          ]),
        )
        .orderBy(desc(mediaAssets.createdAt));

      const latestByCategory = new Map<string, string>();
      for (const row of rows) {
        if (!row.url) continue;
        if (!latestByCategory.has(row.category)) {
          latestByCategory.set(row.category, row.url);
        }
      }

      return res.json({
        success: true,
        data: {
          esewaQrUrl:
            latestByCategory.get(PAYMENT_QR_CATEGORIES.esewa) ??
            DEFAULT_PAYMENT_QR_URLS.esewaQrUrl,
          khaltiQrUrl:
            latestByCategory.get(PAYMENT_QR_CATEGORIES.khalti) ??
            DEFAULT_PAYMENT_QR_URLS.khaltiQrUrl,
          fonepayQrUrl:
            latestByCategory.get(PAYMENT_QR_CATEGORIES.fonepay) ??
            DEFAULT_PAYMENT_QR_URLS.fonepayQrUrl,
        },
      });
    } catch (err) {
      handleApiError(res, err, "GET /api/storefront/payment-qr");
    }
  });

  app.get("/api/admin/payment-qr/config", requireAdmin, async (_req: Request, res: Response) => {
    try {
      const rows = await db
        .select({
          id: mediaAssets.id,
          category: mediaAssets.category,
          url: mediaAssets.url,
          createdAt: mediaAssets.createdAt,
        })
        .from(mediaAssets)
        .where(
          inArray(mediaAssets.category, [
            PAYMENT_QR_CATEGORIES.esewa,
            PAYMENT_QR_CATEGORIES.khalti,
            PAYMENT_QR_CATEGORIES.fonepay,
          ]),
        )
        .orderBy(desc(mediaAssets.createdAt));

      const latestByCategory = new Map<
        string,
        { id: string; url: string; createdAt: Date | null }
      >();
      for (const row of rows) {
        if (!row.url) continue;
        if (!latestByCategory.has(row.category)) {
          latestByCategory.set(row.category, {
            id: row.id,
            url: row.url,
            createdAt: row.createdAt ?? null,
          });
        }
      }

      return res.json({
        success: true,
        data: {
          esewa: latestByCategory.get(PAYMENT_QR_CATEGORIES.esewa) ?? {
            id: null,
            url: DEFAULT_PAYMENT_QR_URLS.esewaQrUrl,
            createdAt: null,
          },
          khalti: latestByCategory.get(PAYMENT_QR_CATEGORIES.khalti) ?? {
            id: null,
            url: DEFAULT_PAYMENT_QR_URLS.khaltiQrUrl,
            createdAt: null,
          },
          fonepay: latestByCategory.get(PAYMENT_QR_CATEGORIES.fonepay) ?? {
            id: null,
            url: DEFAULT_PAYMENT_QR_URLS.fonepayQrUrl,
            createdAt: null,
          },
        },
      });
    } catch (err) {
      handleApiError(res, err, "GET /api/admin/payment-qr/config");
    }
  });

  app.post(
    "/api/admin/payment-qr/activate",
    requireAdmin,
    validateRequest(
      z.object({
        provider: z.enum(["esewa", "khalti", "fonepay"]),
        assetId: z.string().min(1),
      }),
    ),
    async (req: Request, res: Response) => {
      try {
        const { provider, assetId } = req.body as {
          provider: "esewa" | "khalti" | "fonepay";
          assetId: string;
        };

        const [source] = await db
          .select()
          .from(mediaAssets)
          .where(eq(mediaAssets.id, assetId))
          .limit(1);

        if (!source) {
          return res.status(404).json({ success: false, error: "Image not found" });
        }

        const category = PAYMENT_QR_CATEGORIES[provider];
        if (!source.url) {
          return res.status(400).json({ success: false, error: "Selected image has no URL" });
        }

        const [created] = await db
          .insert(mediaAssets)
          .values({
            url: source.url,
            provider: source.provider,
            category,
            publicId: source.publicId,
            filename: source.filename,
            bytes: source.bytes,
            width: source.width,
            height: source.height,
          })
          .returning({
            id: mediaAssets.id,
            url: mediaAssets.url,
            category: mediaAssets.category,
            createdAt: mediaAssets.createdAt,
          });

        return res.json({ success: true, data: created });
      } catch (err) {
        handleApiError(res, err, "POST /api/admin/payment-qr/activate");
      }
    },
  );

  // ── Media Discovery (Admin Only) ──────────────────────────────────
  app.get("/api/admin/images", requireAdmin, async (req: Request, res: Response) => {
    try {
      const category = getQueryParam(req.query.category);
      const provider = getQueryParam(req.query.provider);
      const search = getQueryParam(req.query.search);
      const folderPathParam = getQueryParam(req.query.folderPath);
      const assetTypeParam = getQueryParam(req.query.assetType);
      const expiredParam = getQueryParam(req.query.expired);
      const sortBy = getQueryParam(req.query.sortBy) ?? "createdAt";
      const sortDir = (getQueryParam(req.query.sortDir) ?? "desc").toLowerCase() === "asc" ? "asc" : "desc";
      const limit = Math.min(200, Math.max(1, Number(getQueryParam(req.query.limit) ?? "60") || 60));
      const offset = Math.max(0, Number(getQueryParam(req.query.offset) ?? "0") || 0);
      const normalizedFolderPath =
        folderPathParam && folderPathParam !== "root" && folderPathParam !== "/"
          ? folderPathParam.replace(/^\/+|\/+$/g, "")
          : null;
      const assetType = assetTypeParam && assetTypeParam.trim().length > 0 ? assetTypeParam : "file";

      const categoryCondition =
        category === PAYMENT_QR_CATEGORIES.all
          ? inArray(mediaAssets.category, [
              PAYMENT_QR_CATEGORIES.all,
              PAYMENT_QR_CATEGORIES.esewa,
              PAYMENT_QR_CATEGORIES.khalti,
              PAYMENT_QR_CATEGORIES.fonepay,
            ])
          : category
            ? eq(mediaAssets.category, category)
            : sql`true`;

      const conditions = [
        categoryCondition,
        provider ? eq(mediaAssets.provider, provider) : sql`true`,
        assetType ? eq(mediaAssets.assetType, assetType) : sql`true`,
        normalizedFolderPath === null
          ? sql`true`
          : eq(mediaAssets.folderPath, normalizedFolderPath),
      ];

      if (search) {
        const q = `%${search}%`;
        const searchCondition = or(
          ilike(mediaAssets.filename, q),
          ilike(mediaAssets.url, q),
          ilike(mediaAssets.publicId, q),
        );
        if (searchCondition) {
          conditions.push(searchCondition);
        }
      }

      if (expiredParam === "true") {
        conditions.push(sql`${mediaAssets.expiresAt} IS NOT NULL AND ${mediaAssets.expiresAt} < ${new Date()}`);
      } else if (expiredParam === "false") {
        conditions.push(sql`${mediaAssets.expiresAt} IS NULL OR ${mediaAssets.expiresAt} >= ${new Date()}`);
      }

      const where = and(...conditions);

      const [countRow] = await db
        .select({ count: sql<number>`count(*)` })
        .from(mediaAssets)
        .where(where);

      const sortColumn =
        sortBy === "name"
          ? sql`lower(${mediaAssets.filename})`
          : sortBy === "size"
            ? mediaAssets.bytes
            : mediaAssets.createdAt;

      const rows = await db
        .select()
        .from(mediaAssets)
        .where(where)
        .orderBy(sortDir === "asc" ? asc(sortColumn) : desc(sortColumn))
        .limit(limit)
        .offset(offset);

      return res.json({ success: true, data: rows, total: Number(countRow?.count ?? 0) });
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

  app.get("/api/admin/folders", requireAdmin, async (req: Request, res: Response) => {
    try {
      const category = getQueryParam(req.query.category);
      const provider = getQueryParam(req.query.provider);

      const baseConditions = [
        category ? eq(mediaAssets.category, category) : sql`true`,
        provider ? eq(mediaAssets.provider, provider) : sql`true`,
      ];

      const fileRows = await db
        .select({
          path: mediaAssets.folderPath,
          count: sql<number>`count(*)`,
        })
        .from(mediaAssets)
        .where(and(eq(mediaAssets.assetType, "file"), isNotNull(mediaAssets.folderPath), ...baseConditions))
        .groupBy(mediaAssets.folderPath);

      const folderRows = await db
        .select({
          path: mediaAssets.folderPath,
        })
        .from(mediaAssets)
        .where(and(eq(mediaAssets.assetType, "folder"), isNotNull(mediaAssets.folderPath), ...baseConditions));

      const map = new Map<string, number>();
      for (const row of fileRows) {
        if (row.path) map.set(row.path, Number(row.count ?? 0));
      }
      for (const row of folderRows) {
        if (row.path && !map.has(row.path)) map.set(row.path, 0);
      }

      const data = Array.from(map.entries())
        .map(([path, count]) => ({ path, count }))
        .sort((a, b) => a.path.localeCompare(b.path));

      return res.json({ success: true, data });
    } catch (err) {
      handleApiError(res, err, "GET /api/admin/folders");
    }
  });

  app.post(
    "/api/admin/folders",
    requireAdmin,
    validateRequest(
      z.object({
        folderPath: z.string().min(1),
        category: z.string().min(1),
        provider: z.string().optional(),
      }),
    ),
    async (req: Request, res: Response) => {
      try {
        const { folderPath, category, provider } = req.body as {
          folderPath: string;
          category: string;
          provider?: string;
        };
        const normalized = folderPath.replace(/^\/+|\/+$/g, "");

        const [existing] = await db
          .select()
          .from(mediaAssets)
          .where(
            and(
              eq(mediaAssets.assetType, "folder"),
              eq(mediaAssets.folderPath, normalized),
              eq(mediaAssets.category, category),
            ),
          )
          .limit(1);
        if (existing) return res.json({ success: true, data: existing });

        const [created] = await db
          .insert(mediaAssets)
          .values({
            url: null,
            provider: provider ?? "folder",
            category,
            publicId: null,
            filename: normalized.split("/").pop() ?? normalized,
            bytes: null,
            width: null,
            height: null,
            folderPath: normalized,
            assetType: "folder",
            expiresAt: null,
          })
          .returning();

        return res.json({ success: true, data: created });
      } catch (err) {
        handleApiError(res, err, "POST /api/admin/folders");
      }
    },
  );

  app.delete("/api/admin/folders/:id", requireAdmin, async (req: Request, res: Response) => {
    try {
      const id = getQueryParam(req.params.id);
      if (!id) return sendError(res, "Invalid id", undefined, 400);

      const [folder] = await db
        .select()
        .from(mediaAssets)
        .where(eq(mediaAssets.id, id))
        .limit(1);

      if (!folder || folder.assetType !== "folder") {
        return res.status(404).json({ success: false, error: "Folder not found" });
      }

      const folderPath = folder.folderPath ?? "";
      const prefix = `${folderPath}/%`;
      const [countRow] = await db
        .select({ count: sql<number>`count(*)` })
        .from(mediaAssets)
        .where(
          and(
            eq(mediaAssets.assetType, "file"),
            or(eq(mediaAssets.folderPath, folderPath), ilike(mediaAssets.folderPath, prefix)),
          ),
        );

      if (Number(countRow?.count ?? 0) > 0) {
        return res.status(409).json({ success: false, error: "Folder not empty" });
      }

      await db.delete(mediaAssets).where(eq(mediaAssets.id, id));
      return res.json({ success: true });
    } catch (err) {
      handleApiError(res, err, "DELETE /api/admin/folders/:id");
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
        const folderPathRaw = String((req.body as any)?.folderPath || "");
        const expiresAtRaw = (req.body as any)?.expiresAt;
        const qualityMode = String((req.body as any)?.qualityMode || "").toLowerCase();
        const normalizedFolderPath = folderPathRaw ? folderPathRaw.replace(/^\/+|\/+$/g, "") : null;
        const expiresAt = expiresAtRaw ? new Date(expiresAtRaw) : null;

        const files = (req as any).files as Express.Multer.File[] | undefined;
        if (!files || files.length === 0) {
          return sendError(res, "Missing images", undefined, 400);
        }

        const results = [];

        for (const file of files) {
          const cleanedName = sanitizeUploadFilename(file.originalname || "image.jpg");
          if (provider === "local") {
            const asset = await processAndStoreImage(
              file.buffer,
              category,
              cleanedName
            );
            const [row] = await db
              .update(mediaAssets)
              .set({
                folderPath: normalizedFolderPath,
                assetType: "file",
                expiresAt,
              })
              .where(eq(mediaAssets.id, asset.id))
              .returning();
            results.push(row ?? asset);
          } else if (provider === "tigris") {
            const folderPrefix = normalizedFolderPath ? `${normalizedFolderPath}/` : "";
            const fileName = `media/${category}/${folderPrefix}${Date.now()}_${cleanedName.replace(/\.[^.]+$/, "")}.webp`;
            const webpBuffer = await sharp(file.buffer)
              .webp({
                quality: qualityMode === "high" ? 92 : 85,
                effort: 4,
              })
              .toBuffer();
            const uploadedUrl = await storageService.uploadFile(
              webpBuffer,
              fileName,
              "image/webp",
            );
            const [row] = await db
              .insert(mediaAssets)
              .values({
                url: uploadedUrl,
                provider: "tigris",
                category,
                publicId: fileName,
                filename: cleanedName,
                bytes: webpBuffer.byteLength,
                folderPath: normalizedFolderPath,
                assetType: "file",
                expiresAt,
              })
              .returning();
            results.push(row);
          } else {
            const uploaded = await uploadMediaToCloudinary(file.buffer, category, {
              qualityMode: qualityMode === "medium" ? "medium" : "high",
              folderPath: normalizedFolderPath,
            });
            const [row] = await db
              .insert(mediaAssets)
              .values({
                url: uploaded.url,
                provider: "cloudinary",
                category,
                publicId: uploaded.publicId,
                filename: cleanedName,
                bytes: file.size ?? null,
                folderPath: normalizedFolderPath,
                assetType: "file",
                expiresAt,
              })
              .returning();
            results.push(row);
          }
        }

        return res.json({ success: true, data: results });
      } catch (err) {
        if (err instanceof multer.MulterError && err.code === "LIMIT_FILE_SIZE") {
          return res.status(413).json({
            success: false,
            error: `File too large. Maximum file size is ${MAX_ADMIN_IMAGE_UPLOAD_LABEL}. Please reduce the image size or upload a smaller file.`,
          });
        }
        const message =
          err instanceof Error
            ? err.message
            : err && typeof err === "object" && typeof (err as { message?: unknown }).message === "string"
              ? (err as { message: string }).message
              : err && typeof err === "object"
                ? JSON.stringify(err)
                : "Image upload failed";
        return res.status(500).json({
          success: false,
          error: message,
        });
      }
    },
  );

  app.delete("/api/admin/images/:id", requireAdmin, async (req: Request, res: Response) => {
    try {
      const id = getQueryParam(req.params.id);
      if (!id) return sendError(res, "Invalid id", undefined, 400);

      const [asset] = await db.select().from(mediaAssets).where(eq(mediaAssets.id, id)).limit(1);
      if (!asset) return res.status(404).json({ success: false, error: "Not found" });

      if (asset.assetType === "folder") {
        await db.delete(mediaAssets).where(eq(mediaAssets.id, id));
        return res.json({ success: true });
      }

      if (asset.provider === "cloudinary" && asset.publicId) {
        await deleteFromCloudinary(asset.publicId);
      } else if (asset.provider === "local") {
        if (asset.url) await deleteLocalImage(asset.url);
      } else if (asset.provider === "tigris") {
        const key =
          asset.publicId ||
          (() => {
            try {
              const u = new URL(asset.url ?? "");
              return u.pathname.split("/").slice(2).join("/");
            } catch {
              return "";
            }
          })();
        if (key) {
          await storageService.deleteFile(key);
        }
      }

      await db.delete(mediaAssets).where(eq(mediaAssets.id, id));
      return res.json({ success: true });
    } catch (err) {
      handleApiError(res, err, "DELETE /api/admin/images/:id");
    }
  });

  app.patch(
    "/api/admin/images/:id",
    requireAdmin,
    validateRequest(
      z.object({
        folderPath: z.string().optional().nullable(),
        expiresAt: z.string().optional().nullable(),
      }),
    ),
    async (req: Request, res: Response) => {
      try {
        const id = getQueryParam(req.params.id);
        if (!id) return sendError(res, "Invalid id", undefined, 400);

        const { folderPath, expiresAt } = req.body as {
          folderPath?: string | null;
          expiresAt?: string | null;
        };

        const normalizedFolderPath =
          folderPath === null || folderPath === undefined || folderPath === ""
            ? null
            : folderPath.replace(/^\/+|\/+$/g, "");
        const resolvedExpiresAt = expiresAt ? new Date(expiresAt) : null;

        const [updated] = await db
          .update(mediaAssets)
          .set({
            folderPath: normalizedFolderPath,
            expiresAt: resolvedExpiresAt,
          })
          .where(eq(mediaAssets.id, id))
          .returning();

        return res.json({ success: true, data: updated });
      } catch (err) {
        handleApiError(res, err, "PATCH /api/admin/images/:id");
      }
    },
  );

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
