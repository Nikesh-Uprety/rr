import { db } from "./db";
import {
  bills,
  categories,
  customers,
  orderItems,
  orders,
  platforms,
  products,
  users,
  otpTokens,
  contactMessages,
  productAttributes,
  newsletterSubscribers,
  adminNotifications,
  securityLogs,
  mediaAssets,
  siteAssets,
  productVariants,
  type Category,
  type Customer,
  type Order,
  type OrderItem,
  type Product,
  type User,
  type OtpToken,
  type ContactMessage,
  type ProductAttribute,
  type InsertProductAttribute,
  type AdminNotification,
  type InsertAdminNotification,
  type SecurityLog,
  type InsertSecurityLog,
  promoCodes,
  type PromoCode,
  type InsertPromoCode,
  type Bill,
  type Platform,
  type MediaAsset,
  type NewMediaAsset,
  type SiteAsset,
  type InsertSiteAsset,
} from "@shared/schema";
import { and, or, asc, desc, eq, gt, gte, ilike, inArray, isNull, isNotNull, ne, sql } from "drizzle-orm";
import { meiliClient, PRODUCT_INDEX } from "./lib/meilisearch";
import { broadcastNotification } from "./websocket";

const ARCHIVED_PRODUCT_CATEGORY = "__archived__";
const ARCHIVED_PRODUCT_CATEGORY_PREFIX = `${ARCHIVED_PRODUCT_CATEGORY}::`;

const isArchivedCategoryValue = (category: string | null | undefined): boolean =>
  category === ARCHIVED_PRODUCT_CATEGORY ||
  (typeof category === "string" && category.startsWith(ARCHIVED_PRODUCT_CATEGORY_PREFIX));

const archiveCategoryValue = (category: string | null | undefined): string =>
  category && category.trim().length > 0
    ? `${ARCHIVED_PRODUCT_CATEGORY_PREFIX}${category.trim()}`
    : ARCHIVED_PRODUCT_CATEGORY;

const restoreArchivedCategoryValue = (category: string | null | undefined): string | null => {
  if (!category) return null;
  if (category.startsWith(ARCHIVED_PRODUCT_CATEGORY_PREFIX)) {
    const restored = category.slice(ARCHIVED_PRODUCT_CATEGORY_PREFIX.length).trim();
    return restored.length > 0 ? restored : null;
  }
  if (category === ARCHIVED_PRODUCT_CATEGORY) return null;
  return category;
};

const archivedCategoryCondition = sql<boolean>`
  ${products.category} = ${ARCHIVED_PRODUCT_CATEGORY}
  OR ${products.category} LIKE ${`${ARCHIVED_PRODUCT_CATEGORY_PREFIX}%`}
`;

const notArchivedCategoryCondition = sql<boolean>`
  ${products.category} IS NULL
  OR (
    ${products.category} <> ${ARCHIVED_PRODUCT_CATEGORY}
    AND ${products.category} NOT LIKE ${`${ARCHIVED_PRODUCT_CATEGORY_PREFIX}%`}
  )
`;

type ProductFilterInput = {
  category?: string;
  search?: string;
  includeInactive?: boolean;
  isNewArrival?: boolean;
  isNewCollection?: boolean;
  status?: "active" | "draft" | "archived";
};

const buildProductConditions = (filters?: ProductFilterInput) => {
  const conditions = [];

  if (filters?.category) {
    conditions.push(eq(products.category, filters.category));
  } else if (filters?.status !== "archived") {
    conditions.push(notArchivedCategoryCondition);
  }

  if (filters?.search) {
    const terms = filters.search.trim().split(/\s+/).filter(Boolean);
    if (terms.length > 0) {
      const termConditions = terms.map((term) => {
        const baseTerm = term.replace(/s$/i, "");
        return or(
          ilike(products.name, `%${baseTerm}%`),
          ilike(products.category, `%${baseTerm}%`),
          ilike(products.description, `%${baseTerm}%`),
        );
      });
      conditions.push(and(...termConditions)!);
    }
  }

  if (!filters?.includeInactive && "isActive" in products) {
    conditions.push(eq(products.isActive, true));
  }

  if (filters?.status === "active") {
    conditions.push(eq(products.isActive, true));
    conditions.push(notArchivedCategoryCondition);
  }

  if (filters?.status === "draft") {
    conditions.push(eq(products.isActive, false));
    conditions.push(notArchivedCategoryCondition);
  }

  if (filters?.status === "archived") {
    conditions.push(archivedCategoryCondition);
  }

  if (filters?.isNewArrival) {
    conditions.push(eq(products.isNewArrival, true));
  }

  if (filters?.isNewCollection) {
    conditions.push(eq(products.isNewCollection, true));
  }

  return conditions;
};

export interface CreateOrderItemInput {
  productId: string;
  variantId?: number | null;
  size?: string | null;
  quantity: number;
  unitPrice: number;
}

export interface CreateOrderInput {
  userId?: string | null;
  email: string;
  fullName: string;
  addressLine1: string;
  addressLine2?: string | null;
  city: string;
  region: string;
  postalCode: string;
  country: string;
  total: number;
  paymentMethod: string;
  source?: string;
  deliveryRequired?: boolean;
  deliveryProvider?: string | null;
  deliveryAddress?: string | null;
  deliveryLocation?: string | null;
  locationCoordinates?: string;
  promoCode?: string;
  promoDiscountAmount?: number;
  items: CreateOrderItemInput[];
}

export interface RevenueByDay {
  date: string;
  revenue: number;
}

export interface OrdersByDay {
  date: string;
  count: number;
}

export interface NewCustomersByDay {
  date: string;
  count: number;
}

export interface AnalyticsKpisTrends {
  revenue: number;
  orders: number;
  avgOrderValue: number;
  newCustomers: number;
}

export interface AnalyticsKpis {
  revenue: number;
  orders: number;
  avgOrderValue: number;
  newCustomers: number;
  trends: AnalyticsKpisTrends;
}

export interface OrdersByStatus {
  completed: number;
  pending: number;
  cancelled: number;
}

export interface TopProduct {
  name: string;
  imageUrl?: string | null;
  units: number;
  revenue: number;
  percent: number;
}

export interface SalesByCategory {
  category: string;
  revenue: number;
  percent: number;
}

export interface OrdersByDayOfWeek {
  day: string;
  count: number;
}

export interface PaymentMethodBreakdown {
  method: string;
  count: number;
  percent: number;
}

export interface StoreUser {
  id: string;
  email: string;
  name: string | null;
  role: string;
  profileImageUrl: string | null;
  phoneNumber: string | null;
  emailNotifications: boolean;
  createdAt: Date;
}

export interface RevenueByPlatform {
  platform: string;
  label: string;
  revenue: number;
  percent: number;
}

export interface AnalyticsCalendarDay {
  date: string;
  revenue: number;
  orderCount: number;
  isHoliday: boolean;
}

export interface AnalyticsData {
  kpis: AnalyticsKpis;
  revenueByDay: RevenueByDay[];
  ordersByDay: OrdersByDay[];
  newCustomersByDay: NewCustomersByDay[];
  ordersByStatus: OrdersByStatus;
  topProducts: TopProduct[];
  salesByCategory: SalesByCategory[];
  revenueByPlatform: RevenueByPlatform[];
  ordersByDayOfWeek: OrdersByDayOfWeek[];
  paymentMethods: PaymentMethodBreakdown[];
}

export interface IStorage {
  // Products
  getProducts(filters?: {
    category?: string;
    search?: string;
    page?: number;
    limit?: number;
    includeInactive?: boolean;
    isNewArrival?: boolean;
    isNewCollection?: boolean;
    status?: "active" | "draft" | "archived";
  }): Promise<Product[]>;
  getProductsCount(filters?: {
    category?: string;
    search?: string;
    includeInactive?: boolean;
    isNewArrival?: boolean;
    isNewCollection?: boolean;
    status?: "active" | "draft" | "archived";
  }): Promise<number>;
  getProductStats(): Promise<{
    total: number;
    featuredCount: number;
    categoryCounts: Record<string, number>;
    activeCount: number;
    draftCount: number;
    archivedCount: number;
  }>;
  getProductById(id: string): Promise<Product | null>;
  createProduct(
    data: Omit<Product, "id" | "createdAt" | "updatedAt">,
  ): Promise<Product>;
  updateProduct(
    id: string,
    data: Partial<Omit<Product, "id">>,
  ): Promise<Product>;
  deleteProduct(id: string, options?: { permanent?: boolean }): Promise<void>;

  // Orders
  getOrders(filters?: {
    status?: string;
    search?: string;
    page?: number;
    limit?: number;
    timeRange?: string;
  }): Promise<Order[]>;
  getOrdersCount(filters?: {
    status?: string;
    search?: string;
    timeRange?: string;
  }): Promise<number>;
  getOrderById(id: string): Promise<Order & { items: (OrderItem & { product?: Product | null })[] }>;
  getOrderCountByEmail(email: string): Promise<number>;
  createOrder(data: CreateOrderInput): Promise<Order>;
  updateOrderStatus(id: string, status: string): Promise<Order>;
  updateOrderPaymentMethod(id: string, paymentMethod: string): Promise<Order>;
  updateOrderPaymentProof(id: string, paymentProofUrl: string): Promise<Order>;
  updateOrderPaymentVerified(
    id: string,
    paymentVerified: "verified" | "rejected",
  ): Promise<Order>;
  updateOrderStripePaymentIntent(id: string, paymentIntentId: string): Promise<Order>;
  updateOrderStripeCheckoutSession(id: string, sessionId: string): Promise<Order>;
  updateOrderStripePaymentStatus(id: string, status: string): Promise<Order>;

  // Bills (POS / invoices)
  getBills(): Promise<Bill[]>;

  // Customers
  getCustomers(filters?: {
    search?: string;
    timeRange?: string;
    page?: number;
    limit?: number;
    includeZeroOrders?: boolean;
  }): Promise<Customer[]>;
  getCustomersCount(filters?: {
    search?: string;
    includeZeroOrders?: boolean;
  }): Promise<number>;
  getCustomerById(
    id: string,
  ): Promise<
    Customer & {
      orders: Order[];
      deliveryAddress: { street: string | null; city: string | null; region: string | null } | null;
    }
  >;
  // Unified order history (online orders + POS bills)
  getCustomerOrders(
    id: string,
  ): Promise<
    {
      id: string;
      createdAt: Date;
      items: { name: string; quantity: number }[];
      total: string;
      paymentMethod: string;
      status: string;
      source: "online" | "pos";
    }[]
  >;
  createCustomer(
    data: Omit<Customer, "id" | "createdAt">,
  ): Promise<Customer>;
  updateCustomer(
    id: string,
    data: Partial<Omit<Customer, "id" | "createdAt">>
  ): Promise<Customer>;
  deleteCustomer(id: string): Promise<void>;
  upsertCustomerFromOrder(
    email: string,
    firstName: string,
    lastName: string,
    phoneNumber?: string | null,
  ): Promise<Customer>;

  // Users
  getUserByEmail(email: string): Promise<User | null>;
  getUserById(id: string): Promise<User | null>;
  createUser(data: {
    username: string;
    password: string;
    role: string;
    status?: string;
    requires2FASetup?: boolean;
    twoFactorEnabled?: number;
    lastLoginAt?: Date | null;
    displayName?: string | null;
    profileImageUrl?: string | null;
    phoneNumber?: string | null;
  }): Promise<User>;
  updateLastLoginAt(id: string): Promise<void>;
  updateUserPassword(id: string, passwordHash: string): Promise<void>;
  updateUserTwoFactor(id: string, enabled: boolean): Promise<void>;
  updateUserProfile(
    id: string,
    data: { displayName?: string; profileImageUrl?: string; phoneNumber?: string },
  ): Promise<void>;
  updateUserEmail(id: string, newEmail: string): Promise<void>;
  deleteUser(id: string): Promise<void>;
  revokeUser(id: string): Promise<void>;
  getAdminUsers(): Promise<
    {
      id: string;
      email: string;
      name: string | null;
      role: string;
      twoFactorEnabled: boolean;
      lastLoginAt: Date | null;
      status: string;
      profileImageUrl: string | null;
      phoneNumber: string | null;
    }[]
  >;
  inviteAdminUser(data: {
    name: string;
    email: string;
    role: string;
    passwordHash: string;
  }): Promise<User>;

  // Internal team (non-customer) users for admin store-users page
  getStoreUsers(): Promise<StoreUser[]>;
  createStoreUser(data: {
    name: string;
    email: string;
    passwordHash: string;
    role: string;
    phoneNumber?: string | null;
    profileImageUrl?: string | null;
  }): Promise<StoreUser>;
  updateStoreUser(
    id: string,
    data: {
      role?: string;
      emailNotifications?: boolean;
      name?: string;
      profileImageUrl?: string;
      phoneNumber?: string;
    },
  ): Promise<StoreUser>;

  getNewsletterSubscribers(includeUnsubscribed?: boolean): Promise<{ email: string; status: string; unsubscribedAt: Date | null; createdAt: Date | null }[]>;

  // OTP tokens
  createOtpToken(data: {
    id: string;
    userId: string;
    token: string;
    expiresAt: Date;
  }): Promise<OtpToken>;
  consumeOtpToken(
    id: string,
    token: string,
  ): Promise<OtpToken | null>;
  refreshOtpToken(
    id: string,
  ): Promise<{ email: string; code: string; name?: string } | null>;

  // Analytics
  getAnalytics(range: "7d" | "30d" | "90d" | "1y"): Promise<AnalyticsData>;
  getAnalyticsCalendar(year: number): Promise<AnalyticsCalendarDay[]>;

  // Categories
  getCategories(): Promise<Category[]>;
  createCategory(data: { name: string; slug: string }): Promise<Category>;
  updateCategory(id: string, data: { name: string; slug: string }): Promise<Category>;
  deleteCategory(id: string): Promise<void>;

  // Product Attributes
  getProductAttributes(type?: string): Promise<ProductAttribute[]>;
  createProductAttribute(data: InsertProductAttribute): Promise<ProductAttribute>;
  deleteProductAttribute(id: string): Promise<void>;

  // Newsletter
  subscribeToNewsletter(email: string): Promise<void>;
  unsubscribeFromNewsletter(email: string): Promise<void>;
  unsubscribeAllFromNewsletter(): Promise<void>;

  // Admin Notifications
  getAdminNotifications(): Promise<AdminNotification[]>;
  createAdminNotification(data: InsertAdminNotification): Promise<AdminNotification>;
  markAdminNotificationsRead(): Promise<void>;
  markAdminNotificationRead(id: string): Promise<void>;
  markAdminNotificationsByTypeRead(type: string): Promise<void>;

  // Contact Messages
  createContactMessage(data: Omit<ContactMessage, "id" | "createdAt" | "status">): Promise<ContactMessage>;
  getContactMessages(): Promise<ContactMessage[]>;
  updateContactMessageStatus(id: string, status: "unread" | "read" | "replied"): Promise<ContactMessage>;
  // Security Logs
  getSecurityLogs(limit?: number): Promise<SecurityLog[]>;
  insertSecurityLog(data: InsertSecurityLog): Promise<SecurityLog>;

  // Promo Codes
  getPromoCodes(): Promise<PromoCode[]>;
  createPromoCode(data: InsertPromoCode): Promise<PromoCode>;
  updatePromoCode(id: string, data: Partial<PromoCode>): Promise<PromoCode>;
  deletePromoCode(id: string): Promise<void>;
  getPromoCodeByCode(code: string): Promise<PromoCode | null>;

  // Media Assets
  getMediaAssets(params: {
    category?: string;
    provider?: string;
    limit?: number;
    offset?: number;
  }): Promise<MediaAsset[]>;
  createMediaAsset(data: NewMediaAsset): Promise<MediaAsset>;
  deleteMediaAsset(id: string): Promise<void>;
}

export class PgStorage implements IStorage {
  private async getCustomerFinancialStats(customer: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    phoneNumber: string | null;
    since?: Date;
  }): Promise<{ totalSpent: number; orderCount: number }> {
    const normalizedEmail = customer.email.toLowerCase();
    const fullName = `${customer.firstName} ${customer.lastName}`;

    const onlineConditions: any[] = [
      eq(sql`lower(${orders.email})`, normalizedEmail),
      sql`${orders.status} != 'cancelled'`,
    ];
    if (customer.since) {
      onlineConditions.push(sql`${orders.createdAt} >= ${customer.since}`);
    }

    const [onlineSummary] = await db
      .select({
        total: sql<number>`coalesce(sum(${orders.total}), 0)`,
        count: sql<number>`count(*)`,
      })
      .from(orders)
      .where(and(...onlineConditions));

    const billMatchClauses = [eq(bills.customerId, customer.id)];
    if (customer.email) {
      billMatchClauses.push(eq(sql`lower(${bills.customerEmail})`, normalizedEmail));
    }
    if (customer.phoneNumber) {
      billMatchClauses.push(eq(bills.customerPhone, customer.phoneNumber));
    }
    billMatchClauses.push(eq(bills.customerName, fullName));
    if (customer.since) {
      billMatchClauses.push(sql`${bills.createdAt} >= ${customer.since}`);
    }

    const [posSummary] = await db
      .select({
        total: sql<number>`coalesce(sum(${bills.totalAmount}), 0)`,
        count: sql<number>`count(*)`,
      })
      .from(bills)
      .where(
        and(
          sql`${bills.status} != 'void'`,
          or(...billMatchClauses),
        ),
      );

    return {
      totalSpent: Number(onlineSummary?.total ?? 0) + Number(posSummary?.total ?? 0),
      orderCount: Number(onlineSummary?.count ?? 0) + Number(posSummary?.count ?? 0),
    };
  }

  async getBills(): Promise<Bill[]> {
    return db.select().from(bills).orderBy(desc(bills.createdAt));
  }

  async getProducts(filters?: {
    category?: string;
    search?: string;
    page?: number;
    limit?: number;
    includeInactive?: boolean;
    isNewArrival?: boolean;
    isNewCollection?: boolean;
  }): Promise<Product[]> {
    const page = filters?.page && filters.page > 0 ? filters.page : 1;
    const limit = filters?.limit && filters.limit > 0 ? filters.limit : 24;
    const offset = (page - 1) * limit;

    // Use MeiliSearch if search term is present and client is available
    if (filters?.search && meiliClient) {
      try {
        const index = meiliClient.index(PRODUCT_INDEX);
        const searchRes = await index.search(filters.search, {
          limit,
          offset,
          filter: filters.category ? `category = "${filters.category}"` : undefined,
        });

        if (searchRes.hits.length > 0) {
          const hitIds = searchRes.hits.map((h: any) => h.id);
          // Fetch full product data from DB for the hits to ensure data consistency
          // This keeps the return type as Product[] with all fields including internal ones
          return db
            .select()
            .from(products)
            .where(inArray(products.id, hitIds))
            .orderBy(asc(products.ranking));
        }
        return []; // No hits in MeiliSearch
      } catch (err) {
        console.warn("[MeiliSearch] Search failed, falling back to Database:", err);
      }
    }

    const conditions = buildProductConditions(filters);

    const whereClause =
      conditions.length > 0 ? and(...conditions) : undefined;

    const rows = await db
      .select()
      .from(products)
      .where(whereClause)
      .orderBy(asc(products.ranking), desc(products.createdAt))
      .limit(limit)
      .offset(offset);

    return rows;
  }

  async getProductsCount(filters?: {
    category?: string;
    search?: string;
    includeInactive?: boolean;
    isNewArrival?: boolean;
    isNewCollection?: boolean;
  }): Promise<number> {
    if (filters?.search && meiliClient) {
      try {
        const index = meiliClient.index(PRODUCT_INDEX);
        const searchRes = await index.search(filters.search, {
          limit: 0,
          offset: 0,
          filter: filters.category ? `category = "${filters.category}"` : undefined,
        });
        const estimated = (searchRes as { estimatedTotalHits?: number }).estimatedTotalHits;
        if (typeof estimated === "number") return estimated;
        return searchRes.hits.length;
      } catch (err) {
        console.warn("[MeiliSearch] Count failed, falling back to Database:", err);
      }
    }

    const conditions = buildProductConditions(filters);
    const whereClause =
      conditions.length > 0 ? and(...conditions) : undefined;

    const [row] = await db
      .select({ count: sql<number>`count(*)` })
      .from(products)
      .where(whereClause);

    return Number(row?.count ?? 0);
  }

  async getProductStats(): Promise<{
    total: number;
    featuredCount: number;
    categoryCounts: Record<string, number>;
    activeCount: number;
    draftCount: number;
    archivedCount: number;
  }> {
    const [totals] = await db
      .select({
        total: sql<number>`count(*)`,
        featured: sql<number>`count(*) FILTER (WHERE ${products.homeFeatured} = true)`,
        active: sql<number>`count(*) FILTER (WHERE ${products.isActive} = true AND (${notArchivedCategoryCondition}))`,
        draft: sql<number>`count(*) FILTER (WHERE ${products.isActive} = false AND (${notArchivedCategoryCondition}))`,
        archived: sql<number>`count(*) FILTER (WHERE (${archivedCategoryCondition}))`,
      })
      .from(products);

    const categoryRows = await db
      .select({
        category: products.category,
        count: sql<number>`count(*)`,
      })
      .from(products)
      .groupBy(products.category);

    const categoryCounts: Record<string, number> = {};
    categoryRows.forEach((row) => {
      if (!row.category) return;
      categoryCounts[row.category.toLowerCase()] = Number(row.count ?? 0);
    });

    return {
      total: Number(totals?.total ?? 0),
      featuredCount: Number(totals?.featured ?? 0),
      categoryCounts,
      activeCount: Number(totals?.active ?? 0),
      draftCount: Number(totals?.draft ?? 0),
      archivedCount: Number(totals?.archived ?? 0),
    };
  }

  async getProductById(id: string): Promise<Product | null> {
    const [row] = await db
      .select({
        id: products.id,
        name: products.name,
        shortDetails: products.shortDetails,
        description: products.description,
        price: products.price,
        costPrice: products.costPrice,
        sku: products.sku,
        imageUrl: products.imageUrl,
        galleryUrls: products.galleryUrls,
        category: products.category,
        stock: products.stock,
        colorOptions: products.colorOptions,
        sizeOptions: products.sizeOptions,
        ranking: products.ranking,
        originalPrice: products.originalPrice,
        salePercentage: products.salePercentage,
        saleActive: products.saleActive,
        homeFeatured: products.homeFeatured,
        homeFeaturedImageIndex: products.homeFeaturedImageIndex,
        isNewArrival: products.isNewArrival,
        isNewCollection: products.isNewCollection,
        isActive: products.isActive,
        createdAt: products.createdAt,
        updatedAt: products.updatedAt,
      })
      .from(products)
      .where(eq(products.id, id))
      .limit(1);

    return row ?? null;
  }

  async createProduct(
    data: Omit<Product, "id" | "createdAt" | "updatedAt">,
  ): Promise<Product> {
    const nextIsActive = (data.isActive ?? true) && Number(data.stock ?? 0) > 0;
    const [row] = await db
      .insert(products)
      .values({
        name: data.name,
        shortDetails: data.shortDetails ?? null,
        description: data.description ?? null,
        price: data.price,
        costPrice: data.costPrice ?? 0,
        sku: data.sku ?? "",
        imageUrl: data.imageUrl ?? null,
        galleryUrls: data.galleryUrls ?? null,
        category: data.category ?? null,
        stock: data.stock,
        colorOptions: data.colorOptions ?? null,
        sizeOptions: data.sizeOptions ?? null,
        ranking: data.ranking ?? 999,
        originalPrice: data.originalPrice ?? null,
        salePercentage: data.salePercentage ?? 0,
        saleActive: data.saleActive ?? false,
        homeFeatured: data.homeFeatured ?? false,
        homeFeaturedImageIndex: data.homeFeaturedImageIndex ?? 2,
        isNewArrival: false,
        isNewCollection: false,
        isActive: nextIsActive,
      })
      .returning({
        id: products.id,
        name: products.name,
        shortDetails: products.shortDetails,
        description: products.description,
        price: products.price,
        costPrice: products.costPrice,
        sku: products.sku,
        imageUrl: products.imageUrl,
        galleryUrls: products.galleryUrls,
        category: products.category,
        stock: products.stock,
        colorOptions: products.colorOptions,
        sizeOptions: products.sizeOptions,
        ranking: products.ranking,
        originalPrice: products.originalPrice,
        salePercentage: products.salePercentage,
        saleActive: products.saleActive,
        homeFeatured: products.homeFeatured,
        homeFeaturedImageIndex: products.homeFeaturedImageIndex,
        isNewArrival: products.isNewArrival,
        isNewCollection: products.isNewCollection,
        isActive: products.isActive,
        createdAt: products.createdAt,
        updatedAt: products.updatedAt,
      });

    // Sync to MeiliSearch
    if (meiliClient) {
      meiliClient.index(PRODUCT_INDEX).addDocuments([{
        id: row.id,
        name: row.name,
        shortDetails: row.shortDetails,
        description: row.description,
        price: parseFloat(row.price.toString()),
        imageUrl: row.imageUrl,
        category: row.category,
        stock: row.stock,
        saleActive: row.saleActive,
        salePercentage: row.salePercentage,
        createdAt: row.createdAt ? new Date(row.createdAt).getTime() : Date.now(),
      }]).catch(err => console.warn("[MeiliSearch] Sync failed for new product:", err));
    }

    // Create a notification for the new product
    await this.createAdminNotification({
      title: "New Product Added",
      message: `${row.name} has been added to the catalog.`,
      type: "product",
      link: "/admin/products",
    });

    return row;
  }

  async updateProduct(
    id: string,
    data: Partial<Omit<Product, "id">>,
  ): Promise<Product> {
    const computedIsActive =
      data.stock !== undefined
        ? Number(data.stock) > 0
          ? data.isActive
          : false
        : data.isActive;

    const [row] = await db
      .update(products)
      .set({
        name: data.name,
        shortDetails: data.shortDetails,
        description: data.description,
        price: data.price,
        costPrice: data.costPrice,
        sku: data.sku,
        imageUrl: data.imageUrl,
        galleryUrls: data.galleryUrls,
        category: data.category,
        stock: data.stock,
        colorOptions: data.colorOptions,
        sizeOptions: data.sizeOptions,
        salePercentage: data.salePercentage,
        saleActive: data.saleActive,
        originalPrice: data.originalPrice,
        homeFeatured: data.homeFeatured,
        homeFeaturedImageIndex: data.homeFeaturedImageIndex,
        isNewArrival: data.isNewArrival ?? false,
        isNewCollection: data.isNewCollection ?? false,
        isActive: computedIsActive,
        updatedAt: new Date(),
      })
      .where(eq(products.id, id))
      .returning();

    if (row && meiliClient) {
      meiliClient.index(PRODUCT_INDEX).updateDocuments([{
        id: row.id,
        name: row.name,
        shortDetails: row.shortDetails,
        description: row.description,
        price: parseFloat(row.price.toString()),
        imageUrl: row.imageUrl,
        category: row.category,
        stock: row.stock,
        saleActive: row.saleActive,
        salePercentage: row.salePercentage,
        updatedAt: Date.now(),
      }]).catch(err => console.warn("[MeiliSearch] Sync failed for updated product:", err));
    }

    if (row && row.stock === 0) {
      await this.createAdminNotification({
        title: "Product Out of Stock",
        message: `${row.name} is now out of stock.`,
        type: "product",
        link: "/admin/products",
      });
    } else if (row) {
      await this.createAdminNotification({
        title: "Product Details Updated",
        message: `${row.name} has been updated.`,
        type: "product",
        link: "/admin/products",
      });
    }

    return row;
  }

  async deleteProduct(id: string, options?: { permanent?: boolean }): Promise<void> {
    const permanent = options?.permanent === true;

    const [existing] = await db
      .select({
        id: products.id,
        name: products.name,
        category: products.category,
      })
      .from(products)
      .where(eq(products.id, id))
      .limit(1);

    if (!existing) return;

    if (!permanent) {
      if (isArchivedCategoryValue(existing.category)) return;

      await db
        .update(products)
        .set({
          category: archiveCategoryValue(existing.category),
          isActive: false,
          saleActive: false,
          homeFeatured: false,
          updatedAt: new Date(),
        })
        .where(eq(products.id, id));

      if (meiliClient) {
        meiliClient.index(PRODUCT_INDEX).deleteDocument(id).catch(err =>
          console.warn("[MeiliSearch] Delete failed for archived product:", err)
        );
      }
      return;
    }

    try {
      await db.delete(products).where(eq(products.id, id));
      return;
    } catch (err: any) {
      const referencedByOrderItems =
        err?.code === "23503" &&
        err?.constraint === "order_items_product_id_products_id_fk";

      if (!referencedByOrderItems) {
        throw err;
      }

      if (permanent) {
        throw err;
      }

      const suffix = `${id.slice(0, 8)}-${Date.now().toString(36)}`;

      await db
        .update(products)
        .set({
          name: `${existing.name} [archived-${suffix}]`,
          category: archiveCategoryValue(existing.category),
          stock: 0,
          saleActive: false,
          homeFeatured: false,
          isActive: false,
          updatedAt: new Date(),
        })
        .where(eq(products.id, id));
      
      // Sync deletion to MeiliSearch
      if (meiliClient) {
        meiliClient.index(PRODUCT_INDEX).deleteDocument(id).catch(err => 
          console.warn("[MeiliSearch] Delete failed for archived product:", err)
        );
      }
    }
  }

  async getCategories(): Promise<Category[]> {
    const cats = await db.select().from(categories);
    const productCounts = await db
      .select({
        category: products.category,
        count: sql<number>`count(*)`.mapWith(Number),
      })
      .from(products)
      .where(isNotNull(products.category))
      .groupBy(products.category);

    const countMap = new Map<string, number>();
    for (const pc of productCounts) {
      if (pc.category) countMap.set(pc.category, pc.count);
    }

    return cats.sort((a, b) => {
      const aCount = countMap.get(a.slug) ?? 0;
      const bCount = countMap.get(b.slug) ?? 0;
      if (bCount !== aCount) return bCount - aCount;
      return a.name.localeCompare(b.name);
    });
  }

  async createCategory(data: { name: string; slug: string }): Promise<Category> {
    const [row] = await db
      .insert(categories)
      .values({ name: data.name, slug: data.slug })
      .returning();
    return row;
  }

  async updateCategory(id: string, data: { name: string; slug: string }): Promise<Category> {
    const [row] = await db
      .update(categories)
      .set({ name: data.name, slug: data.slug })
      .where(eq(categories.id, id))
      .returning();
    if (!row) throw new Error("Category not found");
    return row;
  }

  async deleteCategory(id: string): Promise<void> {
    await db.delete(categories).where(eq(categories.id, id));
  }

  // Product Attributes
  async getProductAttributes(type?: string): Promise<ProductAttribute[]> {
    const conditions = [];
    if (type) {
      conditions.push(eq(productAttributes.type, type));
    }
    
    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;
    
    return db
      .select()
      .from(productAttributes)
      .where(whereClause)
      .orderBy(asc(productAttributes.value));
  }

  async createProductAttribute(data: InsertProductAttribute): Promise<ProductAttribute> {
    const [row] = await db
      .insert(productAttributes)
      .values(data)
      .returning();
    return row;
  }

  async deleteProductAttribute(id: string): Promise<void> {
    await db.delete(productAttributes).where(eq(productAttributes.id, id));
  }

  async getOrders(filters?: {
    status?: string;
    search?: string;
    page?: number;
    limit?: number;
    timeRange?: string;
  }): Promise<Order[]> {
    const page = filters?.page && filters.page > 0 ? filters.page : 1;
    const limit = typeof filters?.limit === "number"
      ? Math.max(1, filters.limit)
      : filters?.page
        ? 25
        : undefined;
    const offset = limit ? (page - 1) * limit : 0;
    const conditions = [];

    if (filters?.status) {
      conditions.push(eq(orders.status, filters.status));
    }

    if (filters?.search) {
      const q = `%${filters.search}%`;
      conditions.push(
        or(
          ilike(orders.fullName, q),
          ilike(orders.email, q),
          ilike(orders.id, q),
        ),
      );
    }

    if (filters?.timeRange && filters.timeRange !== "all") {
      const now = Date.now();
      const since =
        filters.timeRange === "1d"
          ? new Date(now - 1 * 24 * 60 * 60 * 1000)
          : filters.timeRange === "3d"
            ? new Date(now - 3 * 24 * 60 * 60 * 1000)
            : filters.timeRange === "7d"
              ? new Date(now - 7 * 24 * 60 * 60 * 1000)
              : filters.timeRange === "30d"
                ? new Date(now - 30 * 24 * 60 * 60 * 1000)
                : undefined;
      if (since) {
        conditions.push(gte(orders.createdAt, since));
      }
    }

    const whereClause =
      conditions.length > 0 ? and(...conditions) : undefined;

    const baseQuery = db
      .select({
        id: orders.id,
        userId: orders.userId,
        email: orders.email,
        fullName: orders.fullName,
        phoneNumber: customers.phoneNumber,
        addressLine1: orders.addressLine1,
        addressLine2: orders.addressLine2,
        city: orders.city,
        region: orders.region,
        postalCode: orders.postalCode,
        country: orders.country,
        total: orders.total,
        status: orders.status,
        paymentMethod: orders.paymentMethod,
        paymentProofUrl: orders.paymentProofUrl,
        paymentVerified: orders.paymentVerified,
        locationCoordinates: orders.locationCoordinates,
        promoCode: orders.promoCode,
        promoDiscountAmount: orders.promoDiscountAmount,
        source: orders.source,
        deliveryRequired: orders.deliveryRequired,
        deliveryProvider: orders.deliveryProvider,
        // Backward-compatible fallback: older DBs may not have `orders.delivery_location`.
        // Checkout already stores the selected delivery location inside `location_coordinates`.
        deliveryLocation: orders.locationCoordinates,
        deliveryAddress: orders.deliveryAddress,
        stripePaymentIntentId: orders.stripePaymentIntentId,
        stripeCheckoutSessionId: orders.stripeCheckoutSessionId,
        stripePaymentStatus: orders.stripePaymentStatus,
        stripeAmountUsdCents: orders.stripeAmountUsdCents,
        createdAt: orders.createdAt,
        updatedAt: orders.updatedAt,
      })
      .from(orders)
      .leftJoin(customers, sql`lower(${orders.email}) = lower(${customers.email})`)
      .where(whereClause)
      .orderBy(desc(orders.createdAt));

    const rows = await (limit ? baseQuery.limit(limit).offset(offset) : baseQuery);

    if (rows.length === 0) {
      return rows;
    }

    const orderIds = rows.map((row) => row.id);
    const items = await db
      .select({
        orderId: orderItems.orderId,
        productId: orderItems.productId,
        quantity: orderItems.quantity,
        size: orderItems.size,
        productName: products.name,
      })
      .from(orderItems)
      .leftJoin(products, eq(orderItems.productId, products.id))
      .where(inArray(orderItems.orderId, orderIds))
      .orderBy(asc(orderItems.id));

    const itemsByOrderId = new Map<string, Array<{
      productId: string;
      quantity: number;
      size: string | null;
      name: string;
    }>>();

    items.forEach((item) => {
      const entry = itemsByOrderId.get(item.orderId) ?? [];
      entry.push({
        productId: item.productId,
        quantity: item.quantity,
        size: item.size,
        name: item.productName ?? "Unknown Product",
      });
      itemsByOrderId.set(item.orderId, entry);
    });

    return rows.map((row) => ({
      ...row,
      items: itemsByOrderId.get(row.id) ?? [],
    }));
  }

  async getOrdersCount(filters?: {
    status?: string;
    search?: string;
    timeRange?: string;
  }): Promise<number> {
    const conditions = [];

    if (filters?.status) {
      conditions.push(eq(orders.status, filters.status));
    }

    if (filters?.search) {
      const q = `%${filters.search}%`;
      conditions.push(
        or(
          ilike(orders.fullName, q),
          ilike(orders.email, q),
          ilike(orders.id, q),
        ),
      );
    }

    if (filters?.timeRange && filters.timeRange !== "all") {
      const now = Date.now();
      const since =
        filters.timeRange === "1d"
          ? new Date(now - 1 * 24 * 60 * 60 * 1000)
          : filters.timeRange === "3d"
            ? new Date(now - 3 * 24 * 60 * 60 * 1000)
            : filters.timeRange === "7d"
              ? new Date(now - 7 * 24 * 60 * 60 * 1000)
              : filters.timeRange === "30d"
                ? new Date(now - 30 * 24 * 60 * 60 * 1000)
                : undefined;
      if (since) {
        conditions.push(gte(orders.createdAt, since));
      }
    }

    const whereClause =
      conditions.length > 0 ? and(...conditions) : undefined;

    const [row] = await db
      .select({ count: sql<number>`count(*)` })
      .from(orders)
      .where(whereClause);

    return Number(row?.count ?? 0);
  }

  async getOrderById(id: string): Promise<Order & { items: (OrderItem & { product?: Product | null })[] }> {
    const [orderRow] = await db
      .select({
        id: orders.id,
        userId: orders.userId,
        email: orders.email,
        fullName: orders.fullName,
        phoneNumber: customers.phoneNumber,
        addressLine1: orders.addressLine1,
        addressLine2: orders.addressLine2,
        city: orders.city,
        region: orders.region,
        postalCode: orders.postalCode,
        country: orders.country,
        total: orders.total,
        status: orders.status,
        paymentMethod: orders.paymentMethod,
        paymentProofUrl: orders.paymentProofUrl,
        paymentVerified: orders.paymentVerified,
        locationCoordinates: orders.locationCoordinates,
        promoCode: orders.promoCode,
        promoDiscountAmount: orders.promoDiscountAmount,
        source: orders.source,
        deliveryRequired: orders.deliveryRequired,
        deliveryProvider: orders.deliveryProvider,
        // Backward-compatible fallback: older DBs may not have `orders.delivery_location`.
        // Checkout already stores the selected delivery location inside `location_coordinates`.
        deliveryLocation: orders.locationCoordinates,
        deliveryAddress: orders.deliveryAddress,
        stripePaymentIntentId: orders.stripePaymentIntentId,
        stripeCheckoutSessionId: orders.stripeCheckoutSessionId,
        stripePaymentStatus: orders.stripePaymentStatus,
        stripeAmountUsdCents: orders.stripeAmountUsdCents,
        createdAt: orders.createdAt,
        updatedAt: orders.updatedAt,
      })
      .from(orders)
      .leftJoin(customers, sql`lower(${orders.email}) = lower(${customers.email})`)
      .where(eq(orders.id, id))
      .limit(1);

    if (!orderRow) {
      throw new Error("Order not found");
    }

    const items = await db
      .select({
        id: orderItems.id,
        orderId: orderItems.orderId,
        productId: orderItems.productId,
        variantId: orderItems.variantId,
        variantColor: productVariants.color,
        size: orderItems.size,
        quantity: orderItems.quantity,
        unitPrice: orderItems.unitPrice,
        product: products,
      })
      .from(orderItems)
      .leftJoin(products, eq(orderItems.productId, products.id))
      .leftJoin(productVariants, eq(orderItems.variantId, productVariants.id))
      .where(eq(orderItems.orderId, id))
      .orderBy(asc(orderItems.id));

    return { ...orderRow, items };
  }

  async getOrderCountByEmail(email: string): Promise<number> {
    const normalizedEmail = email.toLowerCase().trim();
    const [result] = await db
      .select({ count: sql<number>`count(*)` })
      .from(orders)
      .where(sql`lower(${orders.email}) = ${normalizedEmail}`);
    return Number(result?.count ?? 0);
  }

  async createOrder(data: CreateOrderInput): Promise<Order> {
    // IMPORTANT:
    // Some deployed/staged DBs don't have `orders.delivery_location`.
    // Using drizzle's insert with the full `orders` definition can still attempt
    // to reference that missing column. To stay backward compatible, we
    // explicitly omit it from the INSERT and store the selected location in
    // `location_coordinates` instead.
    const result = await db.execute(
      sql`
        INSERT INTO "orders" (
          "user_id",
          "email",
          "full_name",
          "address_line1",
          "address_line2",
          "city",
          "region",
          "postal_code",
          "country",
          "total",
          "status",
          "payment_method",
          "location_coordinates",
          "promo_code",
          "promo_discount_amount",
          "source",
          "delivery_required",
          "delivery_provider",
          "delivery_address"
        ) VALUES (
          ${data.userId ?? null},
          ${data.email},
          ${data.fullName},
          ${data.addressLine1},
          ${data.addressLine2 ?? null},
          ${data.city},
          ${data.region},
          ${data.postalCode},
          ${data.country},
          ${data.total.toString()},
          'pending',
          ${data.paymentMethod ?? "cash_on_delivery"},
          ${data.locationCoordinates ?? null},
          ${data.promoCode ?? null},
          ${data.promoDiscountAmount ?? 0},
          ${data.source ?? "website"},
          ${data.deliveryRequired ?? true},
          ${data.deliveryProvider ?? null},
          ${data.deliveryAddress ?? null}
        )
        RETURNING
          "id",
          "email",
          "full_name" as "fullName"
      `,
    );

    const orderRow = result.rows[0] as any as Order;

    if (data.items.length > 0) {
      await db.insert(orderItems).values(
        data.items.map((item) => ({
          orderId: orderRow.id,
          productId: item.productId,
          variantId: item.variantId ?? null,
          size: item.size ?? "",
          quantity: item.quantity,
          unitPrice: item.unitPrice.toString(),
        })),
      );
    }

    // Create a notification for the new order
    await this.createAdminNotification({
      title: "New Order Received",
      message: `Order #${orderRow.id.substring(0, 8)} placed by ${orderRow.fullName}.`,
      type: "order",
      link: "/admin/orders",
    });

    // Sync customer stats after creating order
    await this.syncCustomerStats(orderRow.email);

    return orderRow;
  }

  async updateOrderStatus(id: string, status: string): Promise<Order> {
    const [row] = await db
      .update(orders)
      .set({ status })
      .where(eq(orders.id, id))
      .returning({
        id: orders.id,
        userId: orders.userId,
        email: orders.email,
        fullName: orders.fullName,
        addressLine1: orders.addressLine1,
        addressLine2: orders.addressLine2,
        city: orders.city,
        region: orders.region,
        postalCode: orders.postalCode,
        country: orders.country,
        total: orders.total,
        status: orders.status,
        paymentMethod: orders.paymentMethod,
        paymentProofUrl: orders.paymentProofUrl,
        paymentVerified: orders.paymentVerified,
        locationCoordinates: orders.locationCoordinates,
        promoCode: orders.promoCode,
        promoDiscountAmount: orders.promoDiscountAmount,
        source: orders.source,
        deliveryRequired: orders.deliveryRequired,
        deliveryProvider: orders.deliveryProvider,
        // Backward-compatible fallback: older DBs may not have `orders.delivery_location`.
        // Checkout already stores the selected delivery location inside `location_coordinates`.
        deliveryLocation: orders.locationCoordinates,
        deliveryAddress: orders.deliveryAddress,
        stripePaymentIntentId: orders.stripePaymentIntentId,
        stripeCheckoutSessionId: orders.stripeCheckoutSessionId,
        stripePaymentStatus: orders.stripePaymentStatus,
        stripeAmountUsdCents: orders.stripeAmountUsdCents,
        createdAt: orders.createdAt,
        updatedAt: orders.updatedAt,
      });

    if (status === "completed") {
      await this.syncCustomerStats(row.email);
    }

    if (status === "cancelled") {
      await this.syncCustomerStats(row.email);
      await this.createAdminNotification({
        title: "Order Cancelled",
        message: `Order #${row.id.substring(0, 8)} has been cancelled.`,
        type: "order",
        link: "/admin/orders",
      });
    }

    return row;
  }

  async updateOrderPaymentMethod(id: string, paymentMethod: string): Promise<Order> {
    const [row] = await db
      .update(orders)
      .set({ paymentMethod })
      .where(eq(orders.id, id))
      .returning({
        id: orders.id,
        userId: orders.userId,
        email: orders.email,
        fullName: orders.fullName,
        addressLine1: orders.addressLine1,
        addressLine2: orders.addressLine2,
        city: orders.city,
        region: orders.region,
        postalCode: orders.postalCode,
        country: orders.country,
        total: orders.total,
        status: orders.status,
        paymentMethod: orders.paymentMethod,
        paymentProofUrl: orders.paymentProofUrl,
        paymentVerified: orders.paymentVerified,
        locationCoordinates: orders.locationCoordinates,
        promoCode: orders.promoCode,
        promoDiscountAmount: orders.promoDiscountAmount,
        source: orders.source,
        deliveryRequired: orders.deliveryRequired,
        deliveryProvider: orders.deliveryProvider,
        // Backward-compatible fallback: older DBs may not have `orders.delivery_location`.
        deliveryLocation: orders.locationCoordinates,
        deliveryAddress: orders.deliveryAddress,
        stripePaymentIntentId: orders.stripePaymentIntentId,
        stripeCheckoutSessionId: orders.stripeCheckoutSessionId,
        stripePaymentStatus: orders.stripePaymentStatus,
        stripeAmountUsdCents: orders.stripeAmountUsdCents,
        createdAt: orders.createdAt,
        updatedAt: orders.updatedAt,
      });

    if (!row) throw new Error("Order not found");
    return row;
  }

  async updateOrderPaymentProof(
    id: string,
    paymentProofUrl: string,
  ): Promise<Order> {
    const [row] = await db
      .update(orders)
      .set({ paymentProofUrl })
      .where(eq(orders.id, id))
      .returning({
        id: orders.id,
        userId: orders.userId,
        email: orders.email,
        fullName: orders.fullName,
        addressLine1: orders.addressLine1,
        addressLine2: orders.addressLine2,
        city: orders.city,
        region: orders.region,
        postalCode: orders.postalCode,
        country: orders.country,
        total: orders.total,
        status: orders.status,
        paymentMethod: orders.paymentMethod,
        paymentProofUrl: orders.paymentProofUrl,
        paymentVerified: orders.paymentVerified,
        locationCoordinates: orders.locationCoordinates,
        promoCode: orders.promoCode,
        promoDiscountAmount: orders.promoDiscountAmount,
        source: orders.source,
        deliveryRequired: orders.deliveryRequired,
        deliveryProvider: orders.deliveryProvider,
        // Backward-compatible fallback: older DBs may not have `orders.delivery_location`.
        // Checkout already stores the selected delivery location inside `location_coordinates`.
        deliveryLocation: orders.locationCoordinates,
        deliveryAddress: orders.deliveryAddress,
        stripePaymentIntentId: orders.stripePaymentIntentId,
        stripeCheckoutSessionId: orders.stripeCheckoutSessionId,
        stripePaymentStatus: orders.stripePaymentStatus,
        stripeAmountUsdCents: orders.stripeAmountUsdCents,
        createdAt: orders.createdAt,
        updatedAt: orders.updatedAt,
      });
    if (!row) throw new Error("Order not found");
    return row;
  }

  async updateOrderPaymentVerified(
    id: string,
    paymentVerified: "verified" | "rejected",
  ): Promise<Order> {
    const [row] = await db
      .update(orders)
      .set({ paymentVerified })
      .where(eq(orders.id, id))
      .returning({
        id: orders.id,
        userId: orders.userId,
        email: orders.email,
        fullName: orders.fullName,
        addressLine1: orders.addressLine1,
        addressLine2: orders.addressLine2,
        city: orders.city,
        region: orders.region,
        postalCode: orders.postalCode,
        country: orders.country,
        total: orders.total,
        status: orders.status,
        paymentMethod: orders.paymentMethod,
        paymentProofUrl: orders.paymentProofUrl,
        paymentVerified: orders.paymentVerified,
        locationCoordinates: orders.locationCoordinates,
        promoCode: orders.promoCode,
        promoDiscountAmount: orders.promoDiscountAmount,
        source: orders.source,
        deliveryRequired: orders.deliveryRequired,
        deliveryProvider: orders.deliveryProvider,
        // Backward-compatible fallback: older DBs may not have `orders.delivery_location`.
        // Checkout already stores the selected delivery location inside `location_coordinates`.
        deliveryLocation: orders.locationCoordinates,
        deliveryAddress: orders.deliveryAddress,
        stripePaymentIntentId: orders.stripePaymentIntentId,
        stripeCheckoutSessionId: orders.stripeCheckoutSessionId,
        stripePaymentStatus: orders.stripePaymentStatus,
        stripeAmountUsdCents: orders.stripeAmountUsdCents,
        createdAt: orders.createdAt,
        updatedAt: orders.updatedAt,
      });
    if (!row) throw new Error("Order not found");
    return row;
  }

  async updateOrderStripePaymentIntent(id: string, paymentIntentId: string): Promise<Order> {
    const [row] = await db
      .update(orders)
      .set({ stripePaymentIntentId: paymentIntentId })
      .where(eq(orders.id, id))
      .returning({
        id: orders.id,
        userId: orders.userId,
        email: orders.email,
        fullName: orders.fullName,
        addressLine1: orders.addressLine1,
        addressLine2: orders.addressLine2,
        city: orders.city,
        region: orders.region,
        postalCode: orders.postalCode,
        country: orders.country,
        total: orders.total,
        status: orders.status,
        paymentMethod: orders.paymentMethod,
        paymentProofUrl: orders.paymentProofUrl,
        paymentVerified: orders.paymentVerified,
        locationCoordinates: orders.locationCoordinates,
        promoCode: orders.promoCode,
        promoDiscountAmount: orders.promoDiscountAmount,
        source: orders.source,
        deliveryRequired: orders.deliveryRequired,
        deliveryProvider: orders.deliveryProvider,
        deliveryLocation: orders.deliveryLocation,
        deliveryAddress: orders.deliveryAddress,
        stripePaymentIntentId: orders.stripePaymentIntentId,
        stripeCheckoutSessionId: orders.stripeCheckoutSessionId,
        stripePaymentStatus: orders.stripePaymentStatus,
        stripeAmountUsdCents: orders.stripeAmountUsdCents,
        createdAt: orders.createdAt,
        updatedAt: orders.updatedAt,
      });
    if (!row) throw new Error("Order not found");
    return row;
  }

  async updateOrderStripeCheckoutSession(id: string, sessionId: string): Promise<Order> {
    const [row] = await db
      .update(orders)
      .set({ stripeCheckoutSessionId: sessionId })
      .where(eq(orders.id, id))
      .returning({
        id: orders.id,
        userId: orders.userId,
        email: orders.email,
        fullName: orders.fullName,
        addressLine1: orders.addressLine1,
        addressLine2: orders.addressLine2,
        city: orders.city,
        region: orders.region,
        postalCode: orders.postalCode,
        country: orders.country,
        total: orders.total,
        status: orders.status,
        paymentMethod: orders.paymentMethod,
        paymentProofUrl: orders.paymentProofUrl,
        paymentVerified: orders.paymentVerified,
        locationCoordinates: orders.locationCoordinates,
        promoCode: orders.promoCode,
        promoDiscountAmount: orders.promoDiscountAmount,
        source: orders.source,
        deliveryRequired: orders.deliveryRequired,
        deliveryProvider: orders.deliveryProvider,
        deliveryLocation: orders.deliveryLocation,
        deliveryAddress: orders.deliveryAddress,
        stripePaymentIntentId: orders.stripePaymentIntentId,
        stripeCheckoutSessionId: orders.stripeCheckoutSessionId,
        stripePaymentStatus: orders.stripePaymentStatus,
        stripeAmountUsdCents: orders.stripeAmountUsdCents,
        createdAt: orders.createdAt,
        updatedAt: orders.updatedAt,
      });
    if (!row) throw new Error("Order not found");
    return row;
  }

  async updateOrderStripePaymentStatus(id: string, status: string): Promise<Order> {
    const [row] = await db
      .update(orders)
      .set({ stripePaymentStatus: status })
      .where(eq(orders.id, id))
      .returning({
        id: orders.id,
        userId: orders.userId,
        email: orders.email,
        fullName: orders.fullName,
        addressLine1: orders.addressLine1,
        addressLine2: orders.addressLine2,
        city: orders.city,
        region: orders.region,
        postalCode: orders.postalCode,
        country: orders.country,
        total: orders.total,
        status: orders.status,
        paymentMethod: orders.paymentMethod,
        paymentProofUrl: orders.paymentProofUrl,
        paymentVerified: orders.paymentVerified,
        locationCoordinates: orders.locationCoordinates,
        promoCode: orders.promoCode,
        promoDiscountAmount: orders.promoDiscountAmount,
        source: orders.source,
        deliveryRequired: orders.deliveryRequired,
        deliveryProvider: orders.deliveryProvider,
        deliveryLocation: orders.deliveryLocation,
        deliveryAddress: orders.deliveryAddress,
        stripePaymentIntentId: orders.stripePaymentIntentId,
        stripeCheckoutSessionId: orders.stripeCheckoutSessionId,
        stripePaymentStatus: orders.stripePaymentStatus,
        stripeAmountUsdCents: orders.stripeAmountUsdCents,
        createdAt: orders.createdAt,
        updatedAt: orders.updatedAt,
      });
    if (!row) throw new Error("Order not found");
    return row;
  }

  async getCustomers(filters?: {
    search?: string;
    timeRange?: string;
    page?: number;
    limit?: number;
    includeZeroOrders?: boolean;
  }): Promise<Customer[]> {
    const conditions = [];

    if (filters?.search) {
      const q = `%${filters.search}%`;
      conditions.push(
        or(
          ilike(customers.firstName, q),
          ilike(customers.lastName, q),
          ilike(customers.phoneNumber, q),
          ilike(customers.email, q)
        )
      );
    }

    const includeZeroOrders = filters?.includeZeroOrders ?? true;
    const timeRange = filters?.timeRange;

    if (!includeZeroOrders && !timeRange) {
      conditions.push(gt(customers.orderCount, 0));
    }

    const whereClause =
      conditions.length > 0 ? and(...conditions) : undefined;

    const page = filters?.page && filters.page > 0 ? filters.page : 1;
    const limit = typeof filters?.limit === "number"
      ? Math.max(1, filters.limit)
      : filters?.page
        ? 25
        : undefined;
    const offset = limit ? (page - 1) * limit : 0;

    const baseQuery = db
      .select({
        id: customers.id,
        firstName: customers.firstName,
        lastName: customers.lastName,
        email: customers.email,
        phoneNumber: customers.phoneNumber,
        totalSpent: customers.totalSpent,
        orderCount: customers.orderCount,
        avatarColor: customers.avatarColor,
        createdAt: customers.createdAt,
        profileImageUrl: users.profileImageUrl,
      })
      .from(customers)
      .leftJoin(users, eq(sql`lower(${customers.email})`, sql`lower(${users.username})`))
      .where(whereClause)
      .orderBy(desc(customers.createdAt));

    const rows = await (limit ? baseQuery.limit(limit).offset(offset) : baseQuery);

    const since = timeRange === "1w"
      ? new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
      : timeRange === "1m"
        ? new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
        : undefined;

    const rowsWithLiveStats = await Promise.all(
      rows.map(async (row) => {
        const stats = await this.getCustomerFinancialStats({
          id: row.id,
          email: row.email,
          firstName: row.firstName,
          lastName: row.lastName,
          phoneNumber: row.phoneNumber ?? null,
          since,
        });

        return {
          ...row,
          totalSpent: stats.totalSpent.toString(),
          orderCount: stats.orderCount,
        };
      }),
    );

    if (includeZeroOrders) {
      return rowsWithLiveStats;
    }

    return rowsWithLiveStats.filter((row) => row.orderCount > 0);
  }

  async getCustomersCount(filters?: {
    search?: string;
    includeZeroOrders?: boolean;
  }): Promise<number> {
    const conditions = [];

    if (filters?.search) {
      const q = `%${filters.search}%`;
      conditions.push(
        or(
          ilike(customers.firstName, q),
          ilike(customers.lastName, q),
          ilike(customers.phoneNumber, q),
          ilike(customers.email, q)
        )
      );
    }

    const includeZeroOrders = filters?.includeZeroOrders ?? true;
    if (!includeZeroOrders) {
      conditions.push(gt(customers.orderCount, 0));
    }

    const whereClause =
      conditions.length > 0 ? and(...conditions) : undefined;

    const [row] = await db
      .select({ count: sql<number>`count(*)` })
      .from(customers)
      .where(whereClause);

    return Number(row?.count ?? 0);
  }

  async getCustomerById(
    id: string,
  ): Promise<
    Customer & {
      orders: Order[];
      deliveryAddress: {
        street: string | null;
        city: string | null;
        region: string | null;
      } | null;
    }
  > {
    const [customerRow] = await db
      .select({
        id: customers.id,
        firstName: customers.firstName,
        lastName: customers.lastName,
        email: customers.email,
        phoneNumber: customers.phoneNumber,
        totalSpent: customers.totalSpent,
        orderCount: customers.orderCount,
        avatarColor: customers.avatarColor,
        createdAt: customers.createdAt,
        profileImageUrl: users.profileImageUrl,
      })
      .from(customers)
      .leftJoin(users, eq(sql`lower(${customers.email})`, sql`lower(${users.username})`))
      .where(eq(customers.id, id))
      .limit(1);

    if (!customerRow) {
      throw new Error("Customer not found");
    }

    const customerOrders = await db
      .select({
        id: orders.id,
        userId: orders.userId,
        email: orders.email,
        fullName: orders.fullName,
        addressLine1: orders.addressLine1,
        addressLine2: orders.addressLine2,
        city: orders.city,
        region: orders.region,
        postalCode: orders.postalCode,
        country: orders.country,
        total: orders.total,
        status: orders.status,
        paymentMethod: orders.paymentMethod,
        paymentProofUrl: orders.paymentProofUrl,
        paymentVerified: orders.paymentVerified,
        locationCoordinates: orders.locationCoordinates,
        promoCode: orders.promoCode,
        promoDiscountAmount: orders.promoDiscountAmount,
        source: orders.source,
        deliveryRequired: orders.deliveryRequired,
        deliveryProvider: orders.deliveryProvider,
        // Backward-compatible fallback: older DBs may not have `orders.delivery_location`.
        // Checkout already stores the selected delivery location inside `location_coordinates`.
        deliveryLocation: orders.locationCoordinates,
        deliveryAddress: orders.deliveryAddress,
        stripePaymentIntentId: orders.stripePaymentIntentId,
        stripeCheckoutSessionId: orders.stripeCheckoutSessionId,
        stripePaymentStatus: orders.stripePaymentStatus,
        stripeAmountUsdCents: orders.stripeAmountUsdCents,
        createdAt: orders.createdAt,
        updatedAt: orders.updatedAt,
      })
      .from(orders)
      .where(eq(orders.email, customerRow.email))
      .orderBy(desc(orders.createdAt));

    const latestOnlineOrder = customerOrders[0];
    const deliveryAddressFromOnline: {
      street: string | null;
      city: string | null;
      region: string | null;
    } | null = latestOnlineOrder?.addressLine1
      ? {
          street: latestOnlineOrder.addressLine1,
          city: latestOnlineOrder.city ?? null,
          region: latestOnlineOrder.region ?? null,
        }
      : null;

    let deliveryAddress: {
      street: string | null;
      city: string | null;
      region: string | null;
    } | null = deliveryAddressFromOnline;

    // Fallback to the most recent POS bill's deliveryAddress (POS doesn't store city/region separately)
    if (!deliveryAddress) {
      const billConditions = [eq(bills.customerName, `${customerRow.firstName} ${customerRow.lastName}`)];
      if (customerRow.email) {
        billConditions.push(eq(bills.customerEmail, customerRow.email));
      }
      if (customerRow.phoneNumber) {
        billConditions.push(eq(bills.customerPhone, customerRow.phoneNumber));
      }

      const [latestBill] = await db
        .select({
          deliveryAddress: bills.deliveryAddress,
        })
        .from(bills)
        .where(or(...billConditions))
        .orderBy(desc(bills.createdAt))
        .limit(1);

      deliveryAddress = latestBill?.deliveryAddress
        ? { street: latestBill.deliveryAddress, city: null, region: null }
        : null;
    }

    const stats = await this.getCustomerFinancialStats({
      id: customerRow.id,
      email: customerRow.email,
      firstName: customerRow.firstName,
      lastName: customerRow.lastName,
      phoneNumber: customerRow.phoneNumber ?? null,
    });

    return {
      ...customerRow,
      totalSpent: stats.totalSpent.toString(),
      orderCount: stats.orderCount,
      orders: customerOrders,
      deliveryAddress,
    };
  }

  async getCustomerOrders(id: string) {
    const [customerRow] = await db
      .select({
        id: customers.id,
        firstName: customers.firstName,
        lastName: customers.lastName,
        email: customers.email,
        phoneNumber: customers.phoneNumber,
      })
      .from(customers)
      .where(eq(customers.id, id))
      .limit(1);

    if (!customerRow) {
      throw new Error("Customer not found");
    }

    const customerFullName = `${customerRow.firstName} ${customerRow.lastName}`;

    // Online orders (website)
    const onlineOrders = await db
      .select({
        id: orders.id,
        createdAt: orders.createdAt,
        total: orders.total,
        status: orders.status,
        paymentMethod: orders.paymentMethod,
        addressLine1: orders.addressLine1,
        addressLine2: orders.addressLine2,
        city: orders.city,
        region: orders.region,
        deliveryAddress: orders.deliveryAddress,
      })
      .from(orders)
      .where(eq(orders.email, customerRow.email))
      .orderBy(desc(orders.createdAt));

    const orderIds = onlineOrders.map((o) => o.id);
    const itemsByOrder = new Map<string, { name: string; quantity: number; productId?: string; imageUrl?: string | null }[]>();

    if (orderIds.length) {
      const itemRows = await db
        .select({
          orderId: orderItems.orderId,
          quantity: orderItems.quantity,
          productId: orderItems.productId,
          productName: products.name,
          productImage: products.imageUrl,
        })
        .from(orderItems)
        .leftJoin(products, eq(orderItems.productId, products.id))
        .where(inArray(orderItems.orderId, orderIds))
        .orderBy(asc(orderItems.id));

      for (const row of itemRows) {
        const list = itemsByOrder.get(row.orderId) ?? [];
        list.push({
          name: row.productName ?? "Unknown",
          quantity: Number(row.quantity ?? 0),
          productId: row.productId,
          imageUrl: row.productImage ?? null,
        });
        itemsByOrder.set(row.orderId, list);
      }
    }

    const onlineMapped = onlineOrders.map((o) => {
      const fallbackAddress = [o.addressLine1, o.addressLine2, o.city, o.region]
        .filter(Boolean)
        .join(", ");
      const deliveryAddress = o.deliveryAddress || fallbackAddress || null;
      return {
        id: o.id,
        createdAt: o.createdAt ?? new Date(),
        items: itemsByOrder.get(o.id) ?? [],
        total: typeof o.total === "string" ? o.total : String(o.total ?? "0"),
        paymentMethod: o.paymentMethod,
        status: o.status,
        source: "online" as const,
        deliveryAddress,
      };
    });

    // POS orders (stored as bills)
    const billConditions = [eq(bills.customerName, customerFullName)];
    if (customerRow.email) {
      billConditions.push(eq(bills.customerEmail, customerRow.email));
    }
    if (customerRow.phoneNumber) {
      billConditions.push(eq(bills.customerPhone, customerRow.phoneNumber));
    }

    const posBills = await db
      .select({
        id: bills.id,
        createdAt: bills.createdAt,
        totalAmount: bills.totalAmount,
        status: bills.status,
        paymentMethod: bills.paymentMethod,
        items: bills.items,
        deliveryAddress: bills.deliveryAddress,
      })
      .from(bills)
      .where(and(isNull(bills.orderId), or(...billConditions)))
      .orderBy(desc(bills.createdAt));

    const posProductIds = new Set<string>();
    posBills.forEach((bill) => {
      const rawItems = Array.isArray(bill.items) ? (bill.items as any[]) : [];
      rawItems.forEach((it) => {
        if (typeof it?.productId === "string" && it.productId) {
          posProductIds.add(it.productId);
        }
      });
    });
    const posProductMap = new Map<string, string | null>();
    if (posProductIds.size) {
      const rows = await db
        .select({ id: products.id, imageUrl: products.imageUrl })
        .from(products)
        .where(inArray(products.id, Array.from(posProductIds)));
      rows.forEach((row) => posProductMap.set(row.id, row.imageUrl ?? null));
    }

    const posMapped = posBills.map((b) => {
      const rawItems = Array.isArray(b.items) ? (b.items as any[]) : [];
      return {
        id: b.id,
        createdAt: b.createdAt ?? new Date(),
        items: rawItems.map((it) => ({
          name: it.productName ?? "Unknown",
          quantity: Number(it.quantity ?? 0),
          productId: typeof it.productId === "string" ? it.productId : undefined,
          imageUrl:
            typeof it.productId === "string"
              ? posProductMap.get(it.productId) ?? null
              : null,
        })),
        total:
          typeof b.totalAmount === "string"
            ? b.totalAmount
            : String(b.totalAmount ?? "0"),
        paymentMethod: b.paymentMethod,
        status: b.status ?? "issued",
        source: "pos" as const,
        deliveryAddress: b.deliveryAddress ?? null,
      };
    });

    const combined = [...onlineMapped, ...posMapped];
    combined.sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );

    return combined;
  }

  async createCustomer(
    data: Omit<Customer, "id" | "createdAt">,
  ): Promise<Customer> {
    const [row] = await db
      .insert(customers)
      .values({
        firstName: data.firstName,
        lastName: data.lastName,
        email: data.email,
        phoneNumber: data.phoneNumber,
        totalSpent: data.totalSpent,
        orderCount: data.orderCount,
        avatarColor: data.avatarColor,
      })
      .returning();

    return row;
  }

  async updateCustomer(
    id: string,
    data: Partial<Omit<Customer, "id" | "createdAt">>
  ): Promise<Customer> {
    const [row] = await db
      .update(customers)
      .set(data)
      .where(eq(customers.id, id))
      .returning();
    if (!row) throw new Error("Customer not found");
    return row;
  }

  async deleteCustomer(id: string): Promise<void> {
    await db.delete(customers).where(eq(customers.id, id));
  }

  async upsertCustomerFromOrder(
    email: string,
    firstName: string,
    lastName: string,
    phoneNumber?: string | null,
  ): Promise<Customer> {
    const emailLower = email.toLowerCase();
    const [existing] = await db
      .select({
        id: customers.id,
        firstName: customers.firstName,
        lastName: customers.lastName,
        email: customers.email,
        phoneNumber: customers.phoneNumber,
        totalSpent: customers.totalSpent,
        orderCount: customers.orderCount,
        avatarColor: customers.avatarColor,
        createdAt: customers.createdAt,
      })
      .from(customers)
      .where(eq(sql`lower(${customers.email})`, emailLower))
      .limit(1);

    if (existing) {
      if (phoneNumber && !existing.phoneNumber) {
        const [updated] = await db
          .update(customers)
          .set({ phoneNumber })
          .where(eq(customers.id, existing.id))
          .returning();
        return updated ?? existing;
      }
      return existing;
    }

    const [row] = await db
      .insert(customers)
      .values({
        firstName,
        lastName,
        email: emailLower,
        phoneNumber: phoneNumber ?? null,
        totalSpent: "0",
        orderCount: 0,
        avatarColor: "#2D4A35",
      })
      .returning({
        id: customers.id,
        firstName: customers.firstName,
        lastName: customers.lastName,
        email: customers.email,
        phoneNumber: customers.phoneNumber,
        totalSpent: customers.totalSpent,
        orderCount: customers.orderCount,
        avatarColor: customers.avatarColor,
        createdAt: customers.createdAt,
      });

    return row;
  }

  async syncCustomerStats(email: string): Promise<void> {
    const emailLower = email.toLowerCase();
    const [customer] = await db
      .select({
        id: customers.id,
        firstName: customers.firstName,
        lastName: customers.lastName,
        email: customers.email,
        phoneNumber: customers.phoneNumber,
      })
      .from(customers)
      .where(eq(sql`lower(${customers.email})`, emailLower))
      .limit(1);

    if (!customer) return;

    const stats = await this.getCustomerFinancialStats({
      id: customer.id,
      email: customer.email,
      firstName: customer.firstName,
      lastName: customer.lastName,
      phoneNumber: customer.phoneNumber ?? null,
    });

    await db
      .update(customers)
      .set({
        totalSpent: stats.totalSpent.toString(),
        orderCount: stats.orderCount,
      })
      .where(eq(sql`lower(${customers.email})`, emailLower));
  }

  async subscribeToNewsletter(email: string): Promise<void> {
    const emailLower = email.toLowerCase();
    await db
      .insert(newsletterSubscribers)
      .values({ email: emailLower, status: "active" })
      .onConflictDoUpdate({
        target: newsletterSubscribers.email,
        set: { status: "active", unsubscribedAt: null },
      });
  }

  async unsubscribeFromNewsletter(email: string): Promise<void> {
    await db
      .update(newsletterSubscribers)
      .set({ status: "unsubscribed", unsubscribedAt: new Date() })
      .where(eq(sql`lower(${newsletterSubscribers.email})`, email.toLowerCase()));
  }

  async unsubscribeAllFromNewsletter(): Promise<void> {
    await db
      .update(newsletterSubscribers)
      .set({ status: "unsubscribed", unsubscribedAt: new Date() })
      .where(eq(newsletterSubscribers.status, "active"));
  }

  async getNewsletterSubscribers(includeUnsubscribed = false): Promise<{ email: string; status: string; unsubscribedAt: Date | null; createdAt: Date | null }[]> {
    const conditions = [];
    if (!includeUnsubscribed) {
      conditions.push(eq(newsletterSubscribers.status, "active"));
    }
    
    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    return db
      .select()
      .from(newsletterSubscribers)
      .where(whereClause)
      .orderBy(desc(newsletterSubscribers.createdAt));
  }

  // Admin Notifications Implementations
  async getAdminNotifications(): Promise<AdminNotification[]> {
    return db
      .select()
      .from(adminNotifications)
      .orderBy(desc(adminNotifications.createdAt))
      .limit(50);
  }

  async createAdminNotification(data: InsertAdminNotification): Promise<AdminNotification> {
    const [row] = await db
      .insert(adminNotifications)
      .values(data)
      .returning();
    try {
      broadcastNotification(row);
    } catch (err) {
      console.error("[WebSocket] Failed to broadcast admin notification", err);
    }
    return row;
  }

  async markAdminNotificationsRead(): Promise<void> {
    await db
      .update(adminNotifications)
      .set({ isRead: 1 })
      .where(eq(adminNotifications.isRead, 0));
  }

  async markAdminNotificationRead(id: string): Promise<void> {
    await db
      .update(adminNotifications)
      .set({ isRead: 1 })
      .where(eq(adminNotifications.id, id));
  }

  async markAdminNotificationsByTypeRead(type: string): Promise<void> {
    await db
      .update(adminNotifications)
      .set({ isRead: 1 })
      .where(eq(adminNotifications.type, type));
  }

  // Security Logs
  async getSecurityLogs(limit = 100): Promise<SecurityLog[]> {
    return db
      .select()
      .from(securityLogs)
      .orderBy(desc(securityLogs.createdAt))
      .limit(limit);
  }

  async insertSecurityLog(data: InsertSecurityLog): Promise<SecurityLog> {
    const [row] = await db
      .insert(securityLogs)
      .values(data)
      .returning();
    return row;
  }

  // ── Contact Messages ─────────────────────────────────────
  async createContactMessage(data: Omit<ContactMessage, "id" | "createdAt" | "status">): Promise<ContactMessage> {
    const [row] = await db
      .insert(contactMessages)
      .values({
        ...data,
        status: "unread",
      })
      .returning();

    // Create an admin notification for the new contact message
    await this.createAdminNotification({
      title: "New Contact Message",
      message: `From ${row.name}: ${row.subject}`,
      type: "contact",
      link: "/admin/messages",
    });

    return row;
  }

  async getContactMessages(): Promise<ContactMessage[]> {
    return db
      .select()
      .from(contactMessages)
      .orderBy(desc(contactMessages.createdAt));
  }

  async updateContactMessageStatus(id: string, status: "unread" | "read" | "replied"): Promise<ContactMessage> {
    const [row] = await db
      .update(contactMessages)
      .set({ status })
      .where(eq(contactMessages.id, id))
      .returning();
    
    if (!row) throw new Error("Contact message not found");
    return row;
  }

  async getUserByEmail(email: string): Promise<User | null> {
    const [row] = await db
      .select({
        id: users.id,
        username: users.username,
        password: users.password,
        role: users.role,
        displayName: users.displayName,
        profileImageUrl: users.profileImageUrl,
        phoneNumber: users.phoneNumber,
        requires2FASetup: users.requires2FASetup,
        emailNotifications: users.emailNotifications,
        twoFactorEnabled: users.twoFactorEnabled,
        lastLoginAt: users.lastLoginAt,
        createdAt: users.createdAt,
        status: users.status,
      })
      .from(users)
      .where(eq(sql`lower(${users.username})`, email.toLowerCase()))
      .limit(1);

    return row ?? null;
  }

  async getUserById(id: string): Promise<User | null> {
    const [row] = await db
      .select({
        id: users.id,
        username: users.username,
        password: users.password,
        role: users.role,
        displayName: users.displayName,
        profileImageUrl: users.profileImageUrl,
        phoneNumber: users.phoneNumber,
        requires2FASetup: users.requires2FASetup,
        emailNotifications: users.emailNotifications,
        twoFactorEnabled: users.twoFactorEnabled,
        lastLoginAt: users.lastLoginAt,
        createdAt: users.createdAt,
        status: users.status,
      })
      .from(users)
      .where(eq(users.id, id))
      .limit(1);

    return row ?? null;
  }

  async createUser(data: {
    username: string;
    password: string;
    role: string;
    status?: string;
    requires2FASetup?: boolean;
    twoFactorEnabled?: number;
    lastLoginAt?: Date | null;
    displayName?: string | null;
    profileImageUrl?: string | null;
    phoneNumber?: string | null;
  }): Promise<User> {
    const [row] = await db
      .insert(users)
      .values({
        username: data.username,
        password: data.password,
        role: data.role,
        displayName: data.displayName ?? null,
        profileImageUrl: data.profileImageUrl ?? null,
        phoneNumber: data.phoneNumber ?? null,
        requires2FASetup: data.requires2FASetup ?? false,
        twoFactorEnabled: data.twoFactorEnabled ?? 0,
        emailNotifications: true,
        status: data.status ?? "active",
      })
      .returning({
        id: users.id,
        username: users.username,
        password: users.password,
        role: users.role,
        displayName: users.displayName,
        profileImageUrl: users.profileImageUrl,
        phoneNumber: users.phoneNumber,
        requires2FASetup: users.requires2FASetup,
        emailNotifications: users.emailNotifications,
        twoFactorEnabled: users.twoFactorEnabled,
        lastLoginAt: users.lastLoginAt,
        createdAt: users.createdAt,
        status: users.status,
      });

    return row;
  }

  async updateLastLoginAt(id: string): Promise<void> {
    await db
      .update(users)
      .set({ lastLoginAt: sql`now()` })
      .where(eq(users.id, id));
  }

  async updateUserPassword(id: string, passwordHash: string): Promise<void> {
    await db
      .update(users)
      .set({ password: passwordHash })
      .where(eq(users.id, id));
  }

  async updateUserTwoFactor(id: string, enabled: boolean): Promise<void> {
    await db
      .update(users)
      .set({ twoFactorEnabled: enabled ? 1 : 0, requires2FASetup: false })
      .where(eq(users.id, id));
  }

  async revokeUser(id: string): Promise<void> {
    await db
      .update(users)
      .set({ status: "suspended" })
      .where(eq(users.id, id));
  }

  async updateUserProfile(
    id: string,
    data: { displayName?: string; profileImageUrl?: string; phoneNumber?: string },
  ): Promise<void> {
    const updateData: Record<string, any> = {};
    if (data.displayName !== undefined) updateData.displayName = data.displayName;
    if (data.profileImageUrl !== undefined) updateData.profileImageUrl = data.profileImageUrl;
    if (data.phoneNumber !== undefined) updateData.phoneNumber = data.phoneNumber;
    if (Object.keys(updateData).length === 0) return;
    await db.update(users).set(updateData).where(eq(users.id, id));
  }

  async updateUserEmail(id: string, newEmail: string): Promise<void> {
    await db.update(users).set({ username: newEmail }).where(eq(users.id, id));
  }

  async deleteUser(id: string): Promise<void> {
    await db.transaction(async (tx) => {
      await tx.update(orders).set({ userId: null }).where(eq(orders.userId, id));
      await tx.delete(otpTokens).where(eq(otpTokens.userId, id));
      await tx.delete(users).where(eq(users.id, id));
    });
  }

  async getAdminUsers(): Promise<
    {
      id: string;
      email: string;
      name: string | null;
      role: string;
      twoFactorEnabled: boolean;
      lastLoginAt: Date | null;
      status: string;
      profileImageUrl: string | null;
      phoneNumber: string | null;
    }[]
  > {
    const rows = await db
      .select({
        id: users.id,
        email: users.username,
        displayName: users.displayName,
        role: users.role,
        twoFactorEnabled: users.twoFactorEnabled,
        lastLoginAt: users.lastLoginAt,
        status: users.status,
        profileImageUrl: users.profileImageUrl,
        phoneNumber: users.phoneNumber,
      })
      .from(users)
      .where(sql`${users.role} != 'customer'`);

    return rows.map((row) => ({
      ...row,
      name: row.displayName || row.email,
      phoneNumber: row.phoneNumber ?? null,
      twoFactorEnabled: !!row.twoFactorEnabled,
    }));
  }

  async getStoreUsers(): Promise<StoreUser[]> {
    const rows = await db
      .select({
        id: users.id,
        email: users.username,
        name: users.displayName,
        role: users.role,
        profileImageUrl: users.profileImageUrl,
        phoneNumber: users.phoneNumber,
        emailNotifications: users.emailNotifications,
        createdAt: users.createdAt,
      })
      .from(users)
      .where(sql`${users.role} != 'customer'`)
      .orderBy(desc(users.createdAt));

    return rows.map((r) => ({
      ...r,
      name: r.name ?? null,
      profileImageUrl: r.profileImageUrl ?? null,
      phoneNumber: r.phoneNumber ?? null,
      emailNotifications: !!r.emailNotifications,
    }));
  }

  async createStoreUser(data: {
    name: string;
    email: string;
    passwordHash: string;
    role: string;
    phoneNumber?: string | null;
    profileImageUrl?: string | null;
  }): Promise<StoreUser> {
    const [row] = await db
      .insert(users)
      .values({
        username: data.email,
        password: data.passwordHash,
        role: data.role,
        displayName: data.name,
        profileImageUrl: data.profileImageUrl ?? null,
        phoneNumber: data.phoneNumber ?? null,
        requires2FASetup: true,
        twoFactorEnabled: 0,
        status: "active",
        emailNotifications: true,
      })
      .returning({
        id: users.id,
        email: users.username,
        name: users.displayName,
        role: users.role,
        profileImageUrl: users.profileImageUrl,
        phoneNumber: users.phoneNumber,
        emailNotifications: users.emailNotifications,
        createdAt: users.createdAt,
      });

    return {
      ...row,
      name: row.name ?? null,
      profileImageUrl: row.profileImageUrl ?? null,
      phoneNumber: row.phoneNumber ?? null,
      emailNotifications: !!row.emailNotifications,
    };
  }

  async updateStoreUser(
    id: string,
    data: {
      role?: string;
      emailNotifications?: boolean;
      name?: string;
      profileImageUrl?: string;
      phoneNumber?: string;
    },
  ): Promise<StoreUser> {
    const updateData: Record<string, any> = {};
    if (data.role !== undefined) updateData.role = data.role;
    if (data.emailNotifications !== undefined)
      updateData.emailNotifications = data.emailNotifications;
    if (data.name !== undefined) updateData.displayName = data.name;
    if (data.profileImageUrl !== undefined) updateData.profileImageUrl = data.profileImageUrl;
    if (data.phoneNumber !== undefined) updateData.phoneNumber = data.phoneNumber;

    const [row] = await db
      .update(users)
      .set(updateData)
      .where(eq(users.id, id))
      .returning({
        id: users.id,
        email: users.username,
        name: users.displayName,
        role: users.role,
        profileImageUrl: users.profileImageUrl,
        phoneNumber: users.phoneNumber,
        emailNotifications: users.emailNotifications,
        createdAt: users.createdAt,
      });

    if (!row) throw new Error("User not found");

    return {
      ...row,
      name: row.name ?? null,
      profileImageUrl: row.profileImageUrl ?? null,
      phoneNumber: row.phoneNumber ?? null,
      emailNotifications: !!row.emailNotifications,
    };
  }

  async inviteAdminUser(data: {
    name: string;
    email: string;
    role: string;
    passwordHash: string;
  }): Promise<User> {
    const [row] = await db
      .insert(users)
      .values({
        username: data.email,
        password: data.passwordHash,
        role: data.role,
        displayName: data.name,
        phoneNumber: null,
        status: "invited",
        requires2FASetup: true,
        twoFactorEnabled: 1,
      })
      .returning({
        id: users.id,
        username: users.username,
        password: users.password,
        role: users.role,
        displayName: users.displayName,
        profileImageUrl: users.profileImageUrl,
        phoneNumber: users.phoneNumber,
        requires2FASetup: users.requires2FASetup,
        emailNotifications: users.emailNotifications,
        twoFactorEnabled: users.twoFactorEnabled,
        lastLoginAt: users.lastLoginAt,
        createdAt: users.createdAt,
        status: users.status,
      });

    return row;
  }

  async createOtpToken(data: {
    id: string;
    userId: string;
    token: string;
    expiresAt: Date;
  }): Promise<OtpToken> {
    const [row] = await db
      .insert(otpTokens)
      .values({
        id: data.id,
        userId: data.userId,
        token: data.token,
        expiresAt: data.expiresAt,
        used: 0,
      })
      .returning();
    return row;
  }

  async consumeOtpToken(
    id: string,
    token: string,
  ): Promise<OtpToken | null> {
    const now = new Date();
    const [row] = await db
      .select()
      .from(otpTokens)
      .where(
        and(
          eq(otpTokens.id, id),
          eq(otpTokens.used, 0),
          gte(otpTokens.expiresAt, now),
        ),
      )
      .limit(1);

    if (!row || row.token !== token) {
      return null;
    }

    await db
      .update(otpTokens)
      .set({ used: 1 })
      .where(eq(otpTokens.id, id));

    return row;
  }

  async refreshOtpToken(
    id: string,
  ): Promise<{ email: string; code: string; name?: string } | null> {
    const [otp] = await db
      .select()
      .from(otpTokens)
      .where(
        and(
          eq(otpTokens.id, id),
          eq(otpTokens.used, 0),
        ),
      )
      .limit(1);

    if (!otp) return null;

    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.id, otp.userId))
      .limit(1);

    if (!user) return null;

    const code = Math.floor(100000 + Math.random() * 900000)
      .toString()
      .slice(0, 6);
    const expiresAt = new Date(
      Date.now() +
        Number(process.env.OTP_EXPIRY_MINUTES ?? "10") * 60 * 1000,
    );

    await db
      .update(otpTokens)
      .set({ token: code, expiresAt })
      .where(eq(otpTokens.id, id));

    return {
      email: user.username,
      code,
      name: user.username,
    };
  }

  async getAnalytics(range: "7d" | "30d" | "90d" | "1y"): Promise<AnalyticsData> {
    const days =
      range === "7d" ? 7 : range === "30d" ? 30 : range === "90d" ? 90 : 365;

    // Current period summary
    const [summary] = await db
      .select({
        totalRevenue: sql<number>`coalesce(sum(${orders.total}), 0)`,
        totalOrders: sql<number>`count(*)`,
      })
      .from(orders)
      .where(sql.raw(`"created_at" >= now() - interval '${days} days'`));

    const avgOrderValue =
      summary.totalOrders > 0
        ? summary.totalRevenue / summary.totalOrders
        : 0;

    const [newCustomersRow] = await db
      .select({
        count: sql<number>`count(*)`,
      })
      .from(customers)
      .where(sql.raw(`"created_at" >= now() - interval '${days} days'`));

    // Previous period summary for trends
    const [prevSummary] = await db
      .select({
        totalRevenue: sql<number>`coalesce(sum(${orders.total}), 0)`,
        totalOrders: sql<number>`count(*)`,
      })
      .from(orders)
      .where(
        sql.raw(
          `"created_at" >= now() - interval '${days * 2} days' AND "created_at" < now() - interval '${days} days'`,
        ),
      );

    const [prevNewCustomersRow] = await db
      .select({
        count: sql<number>`count(*)`,
      })
      .from(customers)
      .where(
        sql.raw(
          `"created_at" >= now() - interval '${days * 2} days' AND "created_at" < now() - interval '${days} days'`,
        ),
      );

    const prevAvgOrderValue =
      prevSummary.totalOrders > 0
        ? prevSummary.totalRevenue / prevSummary.totalOrders
        : 0;

    const pctChange = (current: number, previous: number): number => {
      if (previous === 0) {
        return current === 0 ? 0 : 100;
      }
      return ((current - previous) / previous) * 100;
    };

    const kpis: AnalyticsKpis = {
      revenue: summary.totalRevenue,
      orders: summary.totalOrders,
      avgOrderValue,
      newCustomers: newCustomersRow.count,
      trends: {
        revenue: pctChange(summary.totalRevenue, prevSummary.totalRevenue),
        orders: pctChange(summary.totalOrders, prevSummary.totalOrders),
        avgOrderValue: pctChange(avgOrderValue, prevAvgOrderValue),
        newCustomers: pctChange(
          newCustomersRow.count,
          prevNewCustomersRow.count,
        ),
      },
    };

    // Revenue by day
    const revenueRows = await db
      .select({
        day: sql<string>`date_trunc('day', ${orders.createdAt})::date`,
        revenue: sql<number>`sum(${orders.total})`,
      })
      .from(orders)
      .where(sql.raw(`"created_at" >= now() - interval '${days} days'`))
      .groupBy(sql`date_trunc('day', ${orders.createdAt})::date`)
      .orderBy(asc(sql`date_trunc('day', ${orders.createdAt})::date`));

    const revenueByDay: RevenueByDay[] = revenueRows.map((row) => ({
      date: row.day,
      revenue: row.revenue,
    }));

    // Orders by day
    const ordersByDayRows = await db
      .select({
        day: sql<string>`date_trunc('day', ${orders.createdAt})::date`,
        count: sql<number>`count(*)`,
      })
      .from(orders)
      .where(sql.raw(`"created_at" >= now() - interval '${days} days'`))
      .groupBy(sql`date_trunc('day', ${orders.createdAt})::date`)
      .orderBy(asc(sql`date_trunc('day', ${orders.createdAt})::date`));

    const ordersByDay: OrdersByDay[] = ordersByDayRows.map((row) => ({
      date: row.day,
      count: row.count,
    }));

    // New customers by day
    const newCustomersByDayRows = await db
      .select({
        day: sql<string>`date_trunc('day', ${customers.createdAt})::date`,
        count: sql<number>`count(*)`,
      })
      .from(customers)
      .where(sql.raw(`"created_at" >= now() - interval '${days} days'`))
      .groupBy(sql`date_trunc('day', ${customers.createdAt})::date`)
      .orderBy(asc(sql`date_trunc('day', ${customers.createdAt})::date`));

    const newCustomersByDay: NewCustomersByDay[] = newCustomersByDayRows.map(
      (row) => ({
        date: row.day,
        count: row.count,
      }),
    );

    // Orders by status
    const statusRows = await db
      .select({
        status: orders.status,
        count: sql<number>`count(*)`,
      })
      .from(orders)
      .where(sql.raw(`"created_at" >= now() - interval '${days} days'`))
      .groupBy(orders.status);

    const ordersByStatus: OrdersByStatus = {
      completed: 0,
      pending: 0,
      cancelled: 0,
    };
    for (const row of statusRows) {
      if (row.status === "completed") ordersByStatus.completed = row.count;
      else if (row.status === "cancelled") ordersByStatus.cancelled = row.count;
      else if (row.status === "pending") ordersByStatus.pending = row.count;
    }

    // Top products
    const topProductRows = await db
      .select({
        productId: products.id,
        name: products.name,
        imageUrl: products.imageUrl,
        units: sql<number>`sum(${orderItems.quantity})`,
        revenue: sql<number>`sum(${orderItems.quantity} * ${orderItems.unitPrice})`,
      })
      .from(orderItems)
      .innerJoin(orders, eq(orderItems.orderId, orders.id))
      .innerJoin(products, eq(orderItems.productId, products.id))
      .where(sql.raw(`"orders"."created_at" >= now() - interval '${days} days'`))
      .groupBy(products.id, products.name, products.imageUrl)
      .orderBy(desc(sql`sum(${orderItems.quantity} * ${orderItems.unitPrice})`))
      .limit(10);

    const totalTopRevenue = topProductRows.reduce(
      (acc, row) => acc + row.revenue,
      0,
    );

    const topProducts: TopProduct[] = topProductRows.map((row) => ({
      name: row.name,
      imageUrl: row.imageUrl ?? null,
      units: row.units,
      revenue: row.revenue,
      percent:
        totalTopRevenue > 0 ? (row.revenue / totalTopRevenue) * 100 : 0,
    }));

    // Sales by category
    const salesCategoryRows = await db
      .select({
        category: products.category,
        revenue: sql<number>`sum(${orderItems.quantity} * ${orderItems.unitPrice})`,
      })
      .from(orderItems)
      .innerJoin(orders, eq(orderItems.orderId, orders.id))
      .innerJoin(products, eq(orderItems.productId, products.id))
      .where(sql.raw(`"orders"."created_at" >= now() - interval '${days} days'`))
      .groupBy(products.category);

    const totalCategoryRevenue = salesCategoryRows.reduce(
      (acc, row) => acc + row.revenue,
      0,
    );

    const salesByCategory: SalesByCategory[] = salesCategoryRows.map(
      (row) => ({
        category: row.category ?? "Uncategorized",
        revenue: row.revenue,
        percent:
          totalCategoryRevenue > 0
            ? (row.revenue / totalCategoryRevenue) * 100
            : 0,
      }),
    );

    // Orders by day of week (Mon-Sun)
    const dayOfWeekRows = await db
      .select({
        dow: sql<number>`extract(dow from ${orders.createdAt})`,
        count: sql<number>`count(*)`,
      })
      .from(orders)
      .where(sql.raw(`"created_at" >= now() - interval '${days} days'`))
      .groupBy(sql`extract(dow from ${orders.createdAt})`);

    const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;
    const ordersByDayOfWeek: OrdersByDayOfWeek[] = dayOfWeekRows.map(
      (row) => ({
        day: dayNames[Math.round(row.dow)] ?? "Unknown",
        count: row.count,
      }),
    );

    // Payment methods
    const paymentRows = await db
      .select({
        method: orders.paymentMethod,
        count: sql<number>`count(*)`,
      })
      .from(orders)
      .where(sql.raw(`"created_at" >= now() - interval '${days} days'`))
      .groupBy(orders.paymentMethod);

    const totalPayments = paymentRows.reduce(
      (acc, row) => acc + row.count,
      0,
    );

    const paymentMethods: PaymentMethodBreakdown[] = paymentRows.map(
      (row) => ({
        method: row.method ?? "Unknown",
        count: row.count,
        percent:
          totalPayments > 0 ? (row.count / totalPayments) * 100 : 0,
      }),
    );

    // Revenue by platform/source (orders + POS bills)
    const platformRows = await db
      .select({
        platform: orders.source,
        revenue: sql<number>`sum(${orders.total})`,
      })
      .from(orders)
      .where(sql.raw(`"created_at" >= now() - interval '${days} days'`))
      .groupBy(orders.source);

    const posRows = await db
      .select({
        platform: bills.source,
        revenue: sql<number>`sum(${bills.totalAmount})`,
      })
      .from(bills)
      .where(
        and(
          eq(bills.status, "issued"),
          eq(bills.billType, "pos"),
          isNull(bills.orderId),
          sql.raw(`"created_at" >= now() - interval '${days} days'`),
        ),
      )
      .groupBy(bills.source);

    const platformMap = new Map<string, number>();
    for (const row of platformRows) {
      const key = row.platform ?? "website";
      platformMap.set(key, (platformMap.get(key) ?? 0) + (row.revenue ?? 0));
    }
    for (const row of posRows) {
      const key = row.platform ?? "pos";
      platformMap.set(key, (platformMap.get(key) ?? 0) + (row.revenue ?? 0));
    }

    const configuredPlatforms: Platform[] = await db
      .select()
      .from(platforms)
      .where(eq(platforms.isActive, true))
      .orderBy(asc(platforms.label));

    const labelByKey = new Map<string, string>([
      ["website", "Website"],
      ["pos", "POS"],
      ["instagram", "Instagram"],
      ["tiktok", "TikTok"],
      ...configuredPlatforms.map((p) => [p.key, p.label] as const),
    ]);

    // Ensure configured platforms show even if revenue is zero
    for (const p of configuredPlatforms) {
      if (!platformMap.has(p.key)) platformMap.set(p.key, 0);
    }

    const totalPlatformRevenue = Array.from(platformMap.values()).reduce(
      (acc, v) => acc + v,
      0,
    );

    const revenueByPlatform: RevenueByPlatform[] = Array.from(platformMap.entries())
      .map(([platform, revenue]) => ({
        platform,
        label: labelByKey.get(platform) ?? platform,
        revenue,
        percent: totalPlatformRevenue > 0 ? (revenue / totalPlatformRevenue) * 100 : 0,
      }))
      .sort((a, b) => b.revenue - a.revenue);

    return {
      kpis,
      revenueByDay,
      ordersByDay,
      newCustomersByDay,
      ordersByStatus,
      topProducts,
      salesByCategory,
      revenueByPlatform,
      ordersByDayOfWeek,
      paymentMethods,
    };
  }

  async getAnalyticsCalendar(year: number): Promise<AnalyticsCalendarDay[]> {
    const start = new Date(year, 0, 1);
    const end = new Date(year + 1, 0, 1);

    const orderRows = await db
      .select({
        day: sql<string>`date_trunc('day', ${orders.createdAt})::date`,
        revenue: sql<number>`sum(${orders.total})`,
        count: sql<number>`count(*)`,
      })
      .from(orders)
      .where(
        sql.raw(
          `"created_at" >= '${year}-01-01'::date AND "created_at" < '${
            year + 1
          }-01-01'::date`,
        ),
      )
      .groupBy(sql`date_trunc('day', ${orders.createdAt})::date`)
      .orderBy(asc(sql`date_trunc('day', ${orders.createdAt})::date`));

    const posRows = await db
      .select({
        day: sql<string>`date_trunc('day', ${bills.createdAt})::date`,
        revenue: sql<number>`sum(${bills.totalAmount})`,
        count: sql<number>`count(*)`,
      })
      .from(bills)
      .where(
        and(
          eq(bills.status, "issued"),
          eq(bills.billType, "pos"),
          isNull(bills.orderId),
          sql.raw(
            `"created_at" >= '${year}-01-01'::date AND "created_at" < '${
              year + 1
            }-01-01'::date`,
          ),
        ),
      )
      .groupBy(sql`date_trunc('day', ${bills.createdAt})::date`)
      .orderBy(asc(sql`date_trunc('day', ${bills.createdAt})::date`));

    const byDate = new Map<
      string,
      { revenue: number; orderCount: number }
    >();

    const upsertDayAggregate = (day: string, revenue: number, orderCount: number) => {
      const d = new Date(day);
      const key = d.toISOString().slice(0, 10);
      const existing = byDate.get(key) ?? { revenue: 0, orderCount: 0 };
      byDate.set(key, {
        revenue: existing.revenue + Number(revenue ?? 0),
        orderCount: existing.orderCount + Number(orderCount ?? 0),
      });
    };

    for (const row of orderRows) {
      upsertDayAggregate(row.day, row.revenue, row.count);
    }
    for (const row of posRows) {
      upsertDayAggregate(row.day, row.revenue, row.count);
    }

    // Hardcoded Nepal public holidays for 2025 (approximate set)
    const holidayDates =
      year === 2025
        ? new Set([
            "2025-01-01", // New Year
            "2025-01-15", // Maghe Sankranti (approx)
            "2025-03-01", // Maha Shivaratri (approx)
            "2025-03-14", // Fagu Purnima / Holi (approx)
            "2025-04-14", // Nepali New Year (approx)
            "2025-05-01", // Labour Day
            "2025-05-12", // Buddha Jayanti (approx)
            "2025-08-19", // Janai Purnima (approx)
            "2025-09-19", // Constitution Day (approx)
            "2025-10-01", // Ghatasthapana (approx)
            "2025-10-06", // Fulpati (approx)
            "2025-10-07", // Maha Ashtami
            "2025-10-08", // Maha Navami
            "2025-10-09", // Vijaya Dashami
            "2025-10-20", // Laxmi Puja (approx)
          ])
        : new Set<string>();

    const days: AnalyticsCalendarDay[] = [];
    for (let d = new Date(start); d < end; d.setDate(d.getDate() + 1)) {
      const key = d.toISOString().slice(0, 10);
      const aggregate = byDate.get(key);
      const revenue = aggregate?.revenue ?? 0;
      const orderCount = aggregate?.orderCount ?? 0;
      const isHoliday = holidayDates.has(key);

      days.push({
        date: key,
        revenue,
        orderCount,
        isHoliday,
      });
    }

    return days;
  }

  // Promo Codes Implementation
  async getPromoCodes(): Promise<PromoCode[]> {
    return db.select().from(promoCodes).orderBy(desc(promoCodes.createdAt));
  }

  async createPromoCode(data: InsertPromoCode): Promise<PromoCode> {
    const [row] = await db.insert(promoCodes).values(data).returning();
    return row;
  }

  async updatePromoCode(id: string, data: Partial<PromoCode>): Promise<PromoCode> {
    const [row] = await db.update(promoCodes).set(data).where(eq(promoCodes.id, id)).returning();
    if (!row) throw new Error("Promo code not found");
    return row;
  }

  async deletePromoCode(id: string): Promise<void> {
    await db.delete(promoCodes).where(eq(promoCodes.id, id));
  }

  async getPromoCodeByCode(code: string): Promise<PromoCode | null> {
    const [row] = await db.select().from(promoCodes).where(eq(promoCodes.code, code.toUpperCase())).limit(1);
    return row ?? null;
  }

  // Media Assets Implementation
  async getMediaAssets(params: {
    category?: string;
    provider?: string;
    limit?: number;
    offset?: number;
  }): Promise<MediaAsset[]> {
    const conditions = [];
    if (params.category) conditions.push(eq(mediaAssets.category, params.category));
    if (params.provider) conditions.push(eq(mediaAssets.provider, params.provider));
    
    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;
    const limit = params.limit || 50;
    const offset = params.offset || 0;

    return db
      .select()
      .from(mediaAssets)
      .where(whereClause)
      .orderBy(desc(mediaAssets.createdAt))
      .limit(limit)
      .offset(offset);
  }

  async createMediaAsset(data: NewMediaAsset): Promise<MediaAsset> {
    const [row] = await db.insert(mediaAssets).values(data).returning();
    return row;
  }

  async deleteMediaAsset(id: string): Promise<void> {
    await db.delete(mediaAssets).where(eq(mediaAssets.id, id));
  }
}

export class MemStorage implements IStorage {
  async getBills(): Promise<Bill[]> {
    return [];
  }

  private _users: User[] = [];
  private _products: Product[] = [];
  private _orders: (Order & { items: OrderItem[] })[] = [];
  private _customers: Customer[] = [];
  private _categories: Category[] = [
    { id: "1", name: "Hoodies", slug: "HOODIE", createdAt: new Date() },
    { id: "2", name: "Trousers", slug: "TROUSER", createdAt: new Date() },
    { id: "3", name: "T-Shirts", slug: "TSHIRTS", createdAt: new Date() },
    { id: "4", name: "Winter '25", slug: "WINTER_25", createdAt: new Date() },
  ];
  private _productAttributes: ProductAttribute[] = [];
  private adminNotifications: Map<string, AdminNotification> = new Map();
  private currentId: number = 1;

  async getProducts(_filters?: {
    category?: string;
    search?: string;
    page?: number;
    limit?: number;
    includeInactive?: boolean;
    status?: "active" | "draft" | "archived";
  }): Promise<Product[]> {
    const page = _filters?.page && _filters.page > 0 ? _filters.page : 1;
    const limit = _filters?.limit && _filters.limit > 0 ? _filters.limit : 24;
    const offset = (page - 1) * limit;

    let results = this._products.slice();

    if (_filters?.category) {
      results = results.filter((p) => p.category === _filters.category);
    } else if (_filters?.status !== "archived") {
      results = results.filter((p) => !isArchivedCategoryValue(p.category));
    }

    if (_filters?.status === "active") {
      results = results.filter((p) => !isArchivedCategoryValue(p.category) && p.isActive !== false);
    } else if (_filters?.status === "draft") {
      results = results.filter((p) => !isArchivedCategoryValue(p.category) && p.isActive === false);
    } else if (_filters?.status === "archived") {
      results = results.filter((p) => isArchivedCategoryValue(p.category));
    }

    if (_filters?.search) {
      const terms = _filters.search.trim().split(/\s+/).filter(Boolean);
      if (terms.length > 0) {
        results = results.filter((p) =>
          terms.every((term) => {
            const baseTerm = term.replace(/s$/i, "").toLowerCase();
            const haystack = `${p.name ?? ""} ${p.category ?? ""} ${p.description ?? ""}`.toLowerCase();
            return haystack.includes(baseTerm);
          }),
        );
      }
    }

    return results.slice(offset, offset + limit);
  }

  async getProductsCount(filters?: {
    category?: string;
    search?: string;
    includeInactive?: boolean;
    status?: "active" | "draft" | "archived";
  }): Promise<number> {
    const results = await this.getProducts({ ...filters, page: 1, limit: Number.MAX_SAFE_INTEGER });
    return results.length;
  }

  async getProductStats(): Promise<{
    total: number;
    featuredCount: number;
    categoryCounts: Record<string, number>;
    activeCount: number;
    draftCount: number;
    archivedCount: number;
  }> {
    const products = this._products.slice();
    const categoryCounts: Record<string, number> = {};
    let featuredCount = 0;
    let activeCount = 0;
    let draftCount = 0;
    let archivedCount = 0;
    products.forEach((p) => {
      if (p.homeFeatured) featuredCount += 1;
      if (isArchivedCategoryValue(p.category)) archivedCount += 1;
      else if (p.isActive === false) draftCount += 1;
      else activeCount += 1;
      if (p.category) {
        const slug = p.category.toLowerCase();
        categoryCounts[slug] = (categoryCounts[slug] || 0) + 1;
      }
    });
    return {
      total: products.length,
      featuredCount,
      categoryCounts,
      activeCount,
      draftCount,
      archivedCount,
    };
  }

  async getProductById(id: string): Promise<Product | null> {
    return this._products.find((p) => p.id === id) ?? null;
  }

  async createProduct(
    data: Omit<Product, "id" | "createdAt" | "updatedAt">,
  ): Promise<Product> {
    const nextIsActive = (data.isActive ?? true) && Number(data.stock ?? 0) > 0;
    const product: Product = {
      id: crypto.randomUUID(),
      name: data.name,
      shortDetails: data.shortDetails ?? null,
      description: data.description ?? null,
      price: data.price.toString(),
      costPrice: data.costPrice ?? 0,
      sku: data.sku ?? "",
      imageUrl: data.imageUrl ?? null,
      galleryUrls: data.galleryUrls ?? null,
      category: data.category ?? null,
      stock: data.stock,
      colorOptions: data.colorOptions ?? null,
      sizeOptions: data.sizeOptions ?? null,
      ranking: data.ranking ?? 999,
      originalPrice: data.originalPrice ?? null,
      salePercentage: data.salePercentage ?? 0,
      saleActive: data.saleActive ?? false,
      homeFeatured: data.homeFeatured ?? false,
      homeFeaturedImageIndex: data.homeFeaturedImageIndex ?? 2,
        isNewArrival: false,
        isNewCollection: false,
      isActive: nextIsActive,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this._products.push(product);

    // Notification for new product
    await this.createAdminNotification({
      title: "New Product Added",
      message: `${product.name} has been added to the catalog.`,
      type: "product",
      link: "/admin/products",
    });

    return product;
  }

  async updateProduct(
    id: string,
    data: Partial<Omit<Product, "id">>,
  ): Promise<Product> {
    const product = await this.getProductById(id);
    if (!product) {
      throw new Error("Product not found");
    }
    Object.assign(product, data, { updatedAt: new Date() });
    if (data.stock !== undefined && Number(data.stock) <= 0) {
      product.isActive = false;
    }

    if (product.stock === 0) {
      await this.createAdminNotification({
        title: "Product Out of Stock",
        message: `${product.name} is now out of stock.`,
        type: "product",
        link: "/admin/products",
      });
    } else {
      await this.createAdminNotification({
        title: "Product Details Updated",
        message: `${product.name} has been updated.`,
        type: "product",
        link: "/admin/products",
      });
    }

    return product;
  }

  async deleteProduct(id: string, options?: { permanent?: boolean }): Promise<void> {
    const product = await this.getProductById(id);
    if (!product) return;

    if (options?.permanent) {
      this._products = this._products.filter((p) => p.id !== id);
      return;
    }

    if (isArchivedCategoryValue(product.category)) return;

    product.category = archiveCategoryValue(product.category);
    product.isActive = false;
    product.saleActive = false;
    product.homeFeatured = false;
    product.updatedAt = new Date();
  }

  async getCategories(): Promise<Category[]> {
    return this._categories;
  }

  async createCategory(data: { name: string; slug: string }): Promise<Category> {
    const cat: Category = {
      id: crypto.randomUUID(),
      name: data.name,
      slug: data.slug,
      createdAt: new Date(),
    };
    this._categories.push(cat);
    return cat;
  }

  async updateCategory(id: string, data: { name: string; slug: string }): Promise<Category> {
    const cat = this._categories.find((c) => c.id === id);
    if (!cat) throw new Error("Category not found");
    Object.assign(cat, data);
    return cat;
  }

  async deleteCategory(id: string): Promise<void> {
    this._categories = this._categories.filter((c) => c.id !== id);
  }

  async getProductAttributes(type?: string): Promise<ProductAttribute[]> {
    let attrs = this._productAttributes;
    if (type) {
      attrs = attrs.filter((a: ProductAttribute) => a.type === type);
    }
    return attrs.sort((a: ProductAttribute, b: ProductAttribute) => a.value.localeCompare(b.value));
  }

  async createProductAttribute(data: InsertProductAttribute): Promise<ProductAttribute> {
    const attr: ProductAttribute = {
      id: crypto.randomUUID(),
      type: data.type,
      value: data.value,
      createdAt: new Date(),
    };
    this._productAttributes.push(attr);
    return attr;
  }

  async deleteProductAttribute(id: string): Promise<void> {
    this._productAttributes = this._productAttributes.filter((a: ProductAttribute) => a.id !== id);
  }

  async getOrders(filters?: {
    status?: string;
    search?: string;
    page?: number;
    limit?: number;
    timeRange?: string;
  }): Promise<Order[]> {
    const now = Date.now();
    const since =
      filters?.timeRange === "1d"
        ? new Date(now - 1 * 24 * 60 * 60 * 1000)
        : filters?.timeRange === "3d"
          ? new Date(now - 3 * 24 * 60 * 60 * 1000)
          : filters?.timeRange === "7d"
            ? new Date(now - 7 * 24 * 60 * 60 * 1000)
            : filters?.timeRange === "30d"
              ? new Date(now - 30 * 24 * 60 * 60 * 1000)
              : undefined;

    let filtered = [...this._orders];
    if (filters?.status) {
      filtered = filtered.filter((order) => order.status === filters.status);
    }

    if (filters?.search) {
      const q = filters.search.toLowerCase();
      filtered = filtered.filter((order) =>
        [order.fullName, order.email, order.id]
          .filter(Boolean)
          .some((value) => value.toLowerCase().includes(q)),
      );
    }

    if (since) {
      filtered = filtered.filter((order) => {
        const createdAt = order.createdAt ? new Date(order.createdAt) : null;
        return createdAt ? createdAt >= since : false;
      });
    }

    filtered.sort((a, b) => {
      const dateA = new Date(a.createdAt).getTime();
      const dateB = new Date(b.createdAt).getTime();
      return dateB - dateA;
    });

    const page = filters?.page && filters.page > 0 ? filters.page : 1;
    const limit = typeof filters?.limit === "number"
      ? Math.max(1, filters.limit)
      : filters?.page
        ? 25
        : undefined;

    if (limit) {
      const offset = (page - 1) * limit;
      filtered = filtered.slice(offset, offset + limit);
    }

    return filtered.map(({ items, ...order }) => ({
      ...order,
      items: items.map((item) => ({
        productId: item.productId,
        quantity: item.quantity,
        size: item.size ?? null,
        name: this._products.find((product) => product.id === item.productId)?.name ?? "Unknown Product",
      })),
    }));
  }

  async getOrdersCount(filters?: {
    status?: string;
    search?: string;
    timeRange?: string;
  }): Promise<number> {
    const now = Date.now();
    const since =
      filters?.timeRange === "1d"
        ? new Date(now - 1 * 24 * 60 * 60 * 1000)
        : filters?.timeRange === "3d"
          ? new Date(now - 3 * 24 * 60 * 60 * 1000)
          : filters?.timeRange === "7d"
            ? new Date(now - 7 * 24 * 60 * 60 * 1000)
            : filters?.timeRange === "30d"
              ? new Date(now - 30 * 24 * 60 * 60 * 1000)
              : undefined;

    let filtered = [...this._orders];
    if (filters?.status) {
      filtered = filtered.filter((order) => order.status === filters.status);
    }
    if (filters?.search) {
      const q = filters.search.toLowerCase();
      filtered = filtered.filter((order) =>
        [order.fullName, order.email, order.id]
          .filter(Boolean)
          .some((value) => value.toLowerCase().includes(q)),
      );
    }
    if (since) {
      filtered = filtered.filter((order) => {
        const createdAt = order.createdAt ? new Date(order.createdAt) : null;
        return createdAt ? createdAt >= since : false;
      });
    }
    return filtered.length;
  }

  async getOrderById(id: string): Promise<Order & { items: (OrderItem & { product?: Product | null })[] }> {
    const order = this._orders.find((o) => o.id === id);
    if (!order) {
      throw new Error("Order not found");
    }
    
    const itemsWithProducts = order.items.map(item => ({
      ...item,
      variantColor: null,
      product: this._products.find(p => p.id === item.productId)
    }));

    return { ...order, items: itemsWithProducts };
  }

  async getOrderCountByEmail(email: string): Promise<number> {
    const normalizedEmail = email.toLowerCase().trim();
    return this._orders.filter((o) => o.email.toLowerCase().trim() === normalizedEmail).length;
  }

  async createOrder(data: CreateOrderInput): Promise<Order> {
    const id = crypto.randomUUID();
    const order: Order & { items: OrderItem[] } = {
      id,
      userId: null,
      email: data.email,
      fullName: data.fullName,
      addressLine1: data.addressLine1,
      addressLine2: data.addressLine2 ?? null,
      city: data.city,
      region: data.region,
      postalCode: data.postalCode,
      country: data.country,
      total: data.total.toString(),
      status: "pending",
      paymentMethod: data.paymentMethod ?? "cash_on_delivery",
      paymentProofUrl: null,
      paymentVerified: null,
      locationCoordinates: data.locationCoordinates ?? null,
      promoCode: data.promoCode ?? null,
      promoDiscountAmount: data.promoDiscountAmount ?? null,
      source: "website",
      deliveryRequired: true,
      deliveryProvider: null,
      deliveryLocation: data.deliveryLocation ?? null,
      deliveryAddress: null,
      stripePaymentIntentId: null,
      stripeCheckoutSessionId: null,
      stripePaymentStatus: null,
      stripeAmountUsdCents: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      items: data.items.map((item) => ({
        id: crypto.randomUUID(),
        orderId: id,
        productId: item.productId,
        variantId: item.variantId ?? null,
        size: item.size ?? "",
        quantity: item.quantity,
        unitPrice: item.unitPrice.toString(),
      })),
    };
    this._orders.push(order);
    return order;
  }

  async updateOrderPaymentProof(id: string, url: string): Promise<Order> {
    const order = this._orders.find((o) => o.id === id);
    if (!order) throw new Error("Order not found");
    order.paymentProofUrl = url;
    const { items: _, ...rest } = order;
    return rest;
  }

  async updateOrderPaymentMethod(id: string, paymentMethod: string): Promise<Order> {
    const order = this._orders.find((o) => o.id === id);
    if (!order) throw new Error("Order not found");
    order.paymentMethod = paymentMethod;
    order.updatedAt = new Date();
    const { items: _, ...rest } = order;
    return rest;
  }

  async updateOrderPaymentVerified(id: string, status: "verified" | "rejected"): Promise<Order> {
    const order = this._orders.find((o) => o.id === id);
    if (!order) throw new Error("Order not found");
    order.paymentVerified = status;
    const { items: _, ...rest } = order;
    return rest;
  }

  async updateOrderStripePaymentIntent(id: string, paymentIntentId: string): Promise<Order> {
    const order = this._orders.find((o) => o.id === id);
    if (!order) throw new Error("Order not found");
    (order as any).stripePaymentIntentId = paymentIntentId;
    const { items: _, ...rest } = order;
    return rest as Order;
  }

  async updateOrderStripeCheckoutSession(id: string, sessionId: string): Promise<Order> {
    const order = this._orders.find((o) => o.id === id);
    if (!order) throw new Error("Order not found");
    (order as any).stripeCheckoutSessionId = sessionId;
    const { items: _, ...rest } = order;
    return rest as Order;
  }

  async updateOrderStripePaymentStatus(id: string, status: string): Promise<Order> {
    const order = this._orders.find((o) => o.id === id);
    if (!order) throw new Error("Order not found");
    (order as any).stripePaymentStatus = status;
    const { items: _, ...rest } = order;
    return rest as Order;
  }

  async updateOrderStatus(id: string, status: string): Promise<Order> {
    const order = this._orders.find((o) => o.id === id);
    if (!order) {
      throw new Error("Order not found");
    }
    order.status = status;
    order.updatedAt = new Date();
    const { items: _items, ...rest } = order;
    return rest;
  }

  async getCustomers(filters?: {
    search?: string;
    timeRange?: string;
    page?: number;
    limit?: number;
    includeZeroOrders?: boolean;
  }): Promise<Customer[]> {
    let filtered = [...this._customers];

    if (filters?.search) {
      const q = filters.search.toLowerCase();
      filtered = filtered.filter((customer) =>
        [
          customer.firstName,
          customer.lastName,
          customer.email,
          customer.phoneNumber ?? "",
        ]
          .filter(Boolean)
          .some((value) => value.toLowerCase().includes(q)),
      );
    }

    const includeZeroOrders = filters?.includeZeroOrders ?? true;
    if (!includeZeroOrders) {
      filtered = filtered.filter((customer) => customer.orderCount > 0);
    }

    const page = filters?.page && filters.page > 0 ? filters.page : 1;
    const limit = typeof filters?.limit === "number"
      ? Math.max(1, filters.limit)
      : filters?.page
        ? 25
        : undefined;

    if (limit) {
      const offset = (page - 1) * limit;
      filtered = filtered.slice(offset, offset + limit);
    }

    return filtered;
  }

  async getCustomersCount(filters?: {
    search?: string;
    includeZeroOrders?: boolean;
  }): Promise<number> {
    let filtered = [...this._customers];
    if (filters?.search) {
      const q = filters.search.toLowerCase();
      filtered = filtered.filter((customer) =>
        [
          customer.firstName,
          customer.lastName,
          customer.email,
          customer.phoneNumber ?? "",
        ]
          .filter(Boolean)
          .some((value) => value.toLowerCase().includes(q)),
      );
    }

    const includeZeroOrders = filters?.includeZeroOrders ?? true;
    if (!includeZeroOrders) {
      filtered = filtered.filter((customer) => customer.orderCount > 0);
    }
    return filtered.length;
  }

  async getCustomerById(
    id: string,
  ): Promise<
    Customer & {
      orders: Order[];
      deliveryAddress: {
        street: string | null;
        city: string | null;
        region: string | null;
      } | null;
    }
  > {
    const customer = this._customers.find((c) => c.id === id);
    if (!customer) {
      throw new Error("Customer not found");
    }
    const customerOrders = this._orders
      .filter((o) => o.email === customer.email)
      .map(({ items: _items, ...order }) => order);
    return { ...customer, orders: customerOrders, deliveryAddress: null };
  }

  async getCustomerOrders(_id: string) {
    return [];
  }

  async createCustomer(
    data: Omit<Customer, "id" | "createdAt">,
  ): Promise<Customer> {
    const customer: Customer = {
      id: crypto.randomUUID(),
      firstName: data.firstName,
      lastName: data.lastName,
      email: data.email,
      phoneNumber: data.phoneNumber || null,
      totalSpent: data.totalSpent.toString(),
      orderCount: data.orderCount,
      avatarColor: data.avatarColor,
      createdAt: new Date(),
    };
    this._customers.push(customer);
    return customer;
  }

  async updateCustomer(
    id: string,
    data: Partial<Omit<Customer, "id" | "createdAt">>,
  ): Promise<Customer> {
    const customer = this._customers.find((c) => c.id === id);
    if (!customer) throw new Error("Customer not found");
    Object.assign(customer, data);
    return customer;
  }

  async deleteCustomer(id: string): Promise<void> {
    this._customers = this._customers.filter((c) => c.id !== id);
  }

  async upsertCustomerFromOrder(
    email: string,
    firstName: string,
    lastName: string,
    phoneNumber?: string | null,
  ): Promise<Customer> {
    const existing = this._customers.find((c) => c.email === email);
    if (existing) {
      if (phoneNumber && !existing.phoneNumber) {
        existing.phoneNumber = phoneNumber;
      }
      return existing;
    }
    return this.createCustomer({
      firstName,
      lastName,
      email,
      phoneNumber: phoneNumber ?? null,
      totalSpent: "0",
      orderCount: 0,
      avatarColor: "#2D4A35",
    });
  }

  async subscribeToNewsletter(email: string): Promise<void> {
    // No-op for memory storage
  }

  async unsubscribeFromNewsletter(_email: string): Promise<void> {
    // No-op for memory storage
  }

  async unsubscribeAllFromNewsletter(): Promise<void> {
    // No-op for memory storage
  }

  async getNewsletterSubscribers(
    _includeUnsubscribed = false,
  ): Promise<
    { email: string; status: string; unsubscribedAt: Date | null; createdAt: Date | null }[]
  > {
    return [];
  }

  async getAdminNotifications(): Promise<AdminNotification[]> {
    return Array.from(this.adminNotifications.values())
      .sort((a, b) => (b.createdAt?.getTime() ?? 0) - (a.createdAt?.getTime() ?? 0))
      .slice(0, 50);
  }

  async createAdminNotification(data: InsertAdminNotification): Promise<AdminNotification> {
    const id = String(this.currentId++);
    const notification: AdminNotification = {
      ...data,
      link: data.link ?? null,
      id,
      isRead: 0,
      createdAt: new Date(),
    };
    this.adminNotifications.set(id, notification);
    try {
      broadcastNotification(notification);
    } catch (err) {
      console.error("[WebSocket] Failed to broadcast admin notification", err);
    }
    return notification;
  }

  async markAdminNotificationsRead(): Promise<void> {
    this.adminNotifications.forEach((notif, id) => {
      if (notif.isRead === 0) {
        this.adminNotifications.set(id, { ...notif, isRead: 1 });
      }
    });
  }

  async markAdminNotificationRead(id: string): Promise<void> {
    const notif = this.adminNotifications.get(id);
    if (notif) {
      this.adminNotifications.set(id, { ...notif, isRead: 1 });
    }
  }

  async markAdminNotificationsByTypeRead(type: string): Promise<void> {
    this.adminNotifications.forEach((notif, id) => {
      if (notif.type === type && notif.isRead === 0) {
        this.adminNotifications.set(id, { ...notif, isRead: 1 });
      }
    });
  }

  async getUserByEmail(email: string): Promise<User | null> {
    const lower = email.toLowerCase();
    return this._users.find((u) => u.username.toLowerCase() === lower) ?? null;
  }

  async getUserById(id: string): Promise<User | null> {
    return this._users.find((u) => u.id === id) ?? null;
  }

  async createUser(data: {
    username: string;
    password: string;
    role: string;
    status?: string;
    requires2FASetup?: boolean;
    twoFactorEnabled?: number;
    lastLoginAt?: Date | null;
    displayName?: string | null;
    profileImageUrl?: string | null;
    phoneNumber?: string | null;
  }): Promise<User> {
    const user: User = {
      id: crypto.randomUUID(),
      username: data.username,
      password: data.password,
      role: data.role,
      displayName: data.displayName ?? null,
      profileImageUrl: data.profileImageUrl ?? null,
      phoneNumber: data.phoneNumber ?? null,
      requires2FASetup: data.requires2FASetup ?? false,
      emailNotifications: true,
      twoFactorEnabled: 0,
      lastLoginAt: data.lastLoginAt ?? null,
      status: data.status ?? "active",
      createdAt: new Date(),
    };
    user.twoFactorEnabled = data.twoFactorEnabled ?? 0;
    this._users.push(user);
    return user;
  }

  async updateLastLoginAt(id: string): Promise<void> {
    const user = this._users.find((u) => u.id === id);
    if (user) user.lastLoginAt = new Date();
  }

  async updateUserPassword(id: string, passwordHash: string): Promise<void> {
    const user = this._users.find((u) => u.id === id);
    if (user) user.password = passwordHash;
  }

  // No-op for security logs in memory
  async getSecurityLogs(): Promise<SecurityLog[]> { return []; }
  async insertSecurityLog(data: InsertSecurityLog): Promise<SecurityLog> {
    return { ...data, id: crypto.randomUUID(), createdAt: new Date() } as SecurityLog;
  }

  async inviteAdminUser(data: { name: string; email: string; role: string; passwordHash: string }): Promise<User> {
    return this.createUser({ username: data.email, password: data.passwordHash, role: data.role, displayName: data.name, profileImageUrl: null, requires2FASetup: false, twoFactorEnabled: 0, lastLoginAt: null, status: "active" } as any);
  }

  async createOtpToken(data: { id: string; userId: string; token: string; expiresAt: Date }): Promise<OtpToken> {
    return { ...data, used: 0, createdAt: new Date() };
  }

  async consumeOtpToken(id: string, token: string): Promise<OtpToken | null> {
    return null;
  }

  async refreshOtpToken(id: string): Promise<{ email: string; code: string; name?: string } | null> {
    return null;
  }

  async getAnalytics(range: "7d" | "30d" | "90d" | "1y"): Promise<AnalyticsData> {
    return {
      kpis: { revenue: 0, orders: 0, avgOrderValue: 0, newCustomers: 0, trends: { revenue: 0, orders: 0, avgOrderValue: 0, newCustomers: 0 } },
      revenueByDay: [],
      ordersByDay: [],
      newCustomersByDay: [],
      ordersByStatus: { completed: 0, pending: 0, cancelled: 0 },
      topProducts: [],
      salesByCategory: [],
      revenueByPlatform: [],
      ordersByDayOfWeek: [],
      paymentMethods: [],
    };
  }

  async getAnalyticsCalendar(year: number): Promise<AnalyticsCalendarDay[]> {
    return [];
  }

  async updateUserTwoFactor(id: string, enabled: boolean): Promise<void> {
    const user = this._users.find((u) => u.id === id);
    if (!user) return;
    user.twoFactorEnabled = enabled ? 1 : 0;
    user.requires2FASetup = false;
  }
  async updateUserProfile(
    id: string,
    data: { displayName?: string; profileImageUrl?: string; phoneNumber?: string },
  ): Promise<void> {}
  async updateUserEmail(id: string, newEmail: string): Promise<void> {}
  async deleteUser(id: string): Promise<void> {}
  async revokeUser(id: string): Promise<void> {}
  async getAdminUsers(): Promise<
    {
      id: string;
      email: string;
      name: string | null;
      role: string;
      twoFactorEnabled: boolean;
      lastLoginAt: Date | null;
      status: string;
      profileImageUrl: string | null;
      phoneNumber: string | null;
    }[]
  > {
    return this._users.map((u) => ({
      id: u.id,
      email: u.username,
      name: u.displayName || null,
      role: u.role,
      twoFactorEnabled: u.twoFactorEnabled === 1,
      lastLoginAt: u.lastLoginAt,
      status: u.status,
      profileImageUrl: u.profileImageUrl || null,
      phoneNumber: u.phoneNumber || null,
    }));
  }

  async getStoreUsers(): Promise<StoreUser[]> {
    return this._users
      .filter((u) => u.role !== "customer")
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .map((u) => ({
        id: u.id,
        email: u.username,
        name: u.displayName ?? null,
        role: u.role,
        profileImageUrl: u.profileImageUrl ?? null,
        phoneNumber: u.phoneNumber ?? null,
        emailNotifications: !!u.emailNotifications,
        createdAt: u.createdAt,
      }));
  }

  async createStoreUser(data: {
    name: string;
    email: string;
    passwordHash: string;
    role: string;
    phoneNumber?: string | null;
    profileImageUrl?: string | null;
  }): Promise<StoreUser> {
    const user: User = {
      id: crypto.randomUUID(),
      username: data.email,
      password: data.passwordHash,
      role: data.role,
      displayName: data.name,
      profileImageUrl: data.profileImageUrl ?? null,
      phoneNumber: data.phoneNumber ?? null,
      requires2FASetup: true,
      twoFactorEnabled: 0,
      lastLoginAt: null,
      createdAt: new Date(),
      emailNotifications: true,
      status: "active",
    };
    this._users.push(user);
    return {
      id: user.id,
      email: user.username,
      name: user.displayName ?? null,
      role: user.role,
      profileImageUrl: user.profileImageUrl ?? null,
      phoneNumber: user.phoneNumber ?? null,
      emailNotifications: !!user.emailNotifications,
      createdAt: user.createdAt,
    };
  }

  async updateStoreUser(
    id: string,
    data: {
      role?: string;
      emailNotifications?: boolean;
      name?: string;
      profileImageUrl?: string;
      phoneNumber?: string;
    },
  ): Promise<StoreUser> {
    const user = this._users.find((u) => u.id === id);
    if (!user) throw new Error("User not found");
    if (data.role !== undefined) user.role = data.role;
    if (data.emailNotifications !== undefined) user.emailNotifications = data.emailNotifications;
    if (data.name !== undefined) user.displayName = data.name;
    if (data.profileImageUrl !== undefined) user.profileImageUrl = data.profileImageUrl;
    if (data.phoneNumber !== undefined) user.phoneNumber = data.phoneNumber;

    return {
      id: user.id,
      email: user.username,
      name: user.displayName ?? null,
      role: user.role,
      profileImageUrl: user.profileImageUrl ?? null,
      phoneNumber: user.phoneNumber ?? null,
      emailNotifications: !!user.emailNotifications,
      createdAt: user.createdAt,
    };
  }

  async createContactMessage(data: Omit<ContactMessage, "id" | "createdAt" | "status">): Promise<ContactMessage> {
    return { ...data, id: "mock", status: "unread", createdAt: new Date() };
  }
  async getContactMessages(): Promise<ContactMessage[]> {
    return [];
  }
  async updateContactMessageStatus(id: string, status: "unread" | "read" | "replied"): Promise<ContactMessage> {
    return { id, name: "mock", email: "mock", phone: null, subject: "mock", message: "mock", status, createdAt: new Date() };
  }

  async getPromoCodes(): Promise<PromoCode[]> {
    return [];
  }

  async createPromoCode(data: InsertPromoCode): Promise<PromoCode> {
    const id = crypto.randomUUID();
    const promo: PromoCode = {
      id,
      code: data.code,
      discountPct: data.discountPct,
      maxUses: data.maxUses ?? 100,
      usedCount: 0,
      active: data.active ?? true,
      expiresAt: data.expiresAt ?? null,
      applicableProductIds: data.applicableProductIds ?? null,
      durationPreset: data.durationPreset ?? null,
      createdAt: new Date(),
    };
    return promo;
  }

  async updatePromoCode(id: string, data: Partial<PromoCode>): Promise<PromoCode> {
    return {
      id,
      code: data.code ?? "TEST",
      discountPct: data.discountPct ?? 10,
      maxUses: data.maxUses ?? 100,
      usedCount: 0,
      active: data.active ?? true,
      expiresAt: data.expiresAt ?? null,
      applicableProductIds: data.applicableProductIds ?? null,
      durationPreset: data.durationPreset ?? null,
      createdAt: new Date(),
    };
  }

  async deletePromoCode(id: string): Promise<void> {}

  async getPromoCodeByCode(code: string): Promise<PromoCode | null> {
    return null;
  }

  // Media Assets Stubs
  async getMediaAssets(_params: {
    category?: string;
    provider?: string;
    limit?: number;
    offset?: number;
  }): Promise<MediaAsset[]> {
    return [];
  }

  async createMediaAsset(data: NewMediaAsset): Promise<MediaAsset> {
    const asset: MediaAsset = {
      id: crypto.randomUUID(),
      category: data.category,
      url: data.url ?? null,
      provider: data.provider,
      assetType: data.assetType ?? "file",
      publicId: data.publicId ?? null,
      filename: data.filename ?? null,
      bytes: data.bytes ?? null,
      width: data.width ?? null,
      height: data.height ?? null,
      folderPath: data.folderPath ?? null,
      expiresAt: data.expiresAt ?? null,
      createdAt: new Date(),
    };
    return asset;
  }

  async deleteMediaAsset(_id: string): Promise<void> {}
}

export const storage: IStorage = new PgStorage();
