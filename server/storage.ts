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
} from "@shared/schema";
import { and, or, asc, desc, eq, gte, ilike, sql } from "drizzle-orm";

export interface CreateOrderItemInput {
  productId: string;
  quantity: number;
  unitPrice: number;
}

export interface CreateOrderInput {
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
  locationCoordinates?: string;
  promoCode?: string;
  promoDiscountAmount?: number;
  items: CreateOrderItemInput[];
}

export interface RevenueByDay {
  date: string;
  revenue: number;
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
  }): Promise<Product[]>;
  getProductById(id: string): Promise<Product | null>;
  createProduct(
    data: Omit<Product, "id" | "createdAt" | "updatedAt">,
  ): Promise<Product>;
  updateProduct(
    id: string,
    data: Partial<Omit<Product, "id">>,
  ): Promise<Product>;
  deleteProduct(id: string): Promise<void>;

  // Orders
  getOrders(filters?: {
    status?: string;
    search?: string;
    page?: number;
  }): Promise<Order[]>;
  getOrderById(id: string): Promise<Order & { items: (OrderItem & { product?: Product | null })[] }>;
  createOrder(data: CreateOrderInput): Promise<Order>;
  updateOrderStatus(id: string, status: string): Promise<Order>;
  updateOrderPaymentProof(id: string, paymentProofUrl: string): Promise<Order>;
  updateOrderPaymentVerified(
    id: string,
    paymentVerified: "verified" | "rejected",
  ): Promise<Order>;

  // Bills (POS / invoices)
  getBills(): Promise<Bill[]>;

  // Customers
  getCustomers(search?: string): Promise<Customer[]>;
  getCustomerById(id: string): Promise<Customer & { orders: Order[] }>;
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
  ): Promise<Customer>;

  // Users
  getUserByEmail(email: string): Promise<User | null>;
  getUserById(id: string): Promise<User | null>;
  createUser(data: {
    username: string;
    password: string;
    role: string;
    status?: string;
    twoFactorEnabled?: number;
    lastLoginAt?: Date | null;
  }): Promise<User>;
  updateLastLoginAt(id: string): Promise<void>;
  updateUserPassword(id: string, passwordHash: string): Promise<void>;
  updateUserTwoFactor(id: string, enabled: boolean): Promise<void>;
  updateUserProfile(id: string, data: { displayName?: string; profileImageUrl?: string }): Promise<void>;
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
    }[]
  >;
  inviteAdminUser(data: {
    name: string;
    email: string;
    role: string;
    passwordHash: string;
  }): Promise<User>;
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
}

export class PgStorage implements IStorage {
  async getBills(): Promise<Bill[]> {
    return db.select().from(bills).orderBy(desc(bills.createdAt));
  }

  async getProducts(filters?: {
    category?: string;
    search?: string;
    page?: number;
    limit?: number;
    includeInactive?: boolean;
  }): Promise<Product[]> {
    const page = filters?.page && filters.page > 0 ? filters.page : 1;
    const limit = filters?.limit && filters.limit > 0 ? filters.limit : 24;
    const offset = (page - 1) * limit;

    const conditions = [];

    if (filters?.category) {
      conditions.push(eq(products.category, filters.category));
    }

    if (filters?.search) {
      const terms = filters.search.trim().split(/\s+/).filter(Boolean);
      if (terms.length > 0) {
        const termConditions = terms.map(term => {
          const baseTerm = term.replace(/s$/i, '');
          return or(
            ilike(products.name, `%${baseTerm}%`),
            ilike(products.category, `%${baseTerm}%`),
            ilike(products.description, `%${baseTerm}%`)
          );
        });
        conditions.push(and(...termConditions)!);
      }
    }

    if (!filters?.includeInactive && "isActive" in products) {
      // @ts-expect-error isActive may not exist in older schemas
      conditions.push(eq(products.isActive, true));
    }

    const whereClause =
      conditions.length > 0 ? and(...conditions) : undefined;

    const rows = await db
      .select({
        id: products.id,
        name: products.name,
        shortDetails: products.shortDetails,
        description: products.description,
        price: products.price,
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
        createdAt: products.createdAt,
        updatedAt: products.updatedAt,
      })
      .from(products)
      .where(whereClause)
      .orderBy(asc(products.ranking), desc(products.createdAt))
      .limit(limit)
      .offset(offset);

    return rows;
  }

  async getProductById(id: string): Promise<Product | null> {
    const [row] = await db
      .select({
        id: products.id,
        name: products.name,
        shortDetails: products.shortDetails,
        description: products.description,
        price: products.price,
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
    const [row] = await db
      .insert(products)
      .values({
        name: data.name,
        shortDetails: data.shortDetails ?? null,
        description: data.description ?? null,
        price: data.price,
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
      })
      .returning({
        id: products.id,
        name: products.name,
        shortDetails: products.shortDetails,
        description: products.description,
        price: products.price,
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
        createdAt: products.createdAt,
        updatedAt: products.updatedAt,
      });

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
    const [row] = await db
      .update(products)
      .set({
        name: data.name,
        shortDetails: data.shortDetails,
        description: data.description,
        price: data.price,
        imageUrl: data.imageUrl,
        galleryUrls: data.galleryUrls,
        category: data.category,
        stock: data.stock,
        colorOptions: data.colorOptions,
        sizeOptions: data.sizeOptions,
        salePercentage: data.salePercentage,
        saleActive: data.saleActive,
        originalPrice: data.originalPrice,
      })
      .where(eq(products.id, id))
      .returning({
        id: products.id,
        name: products.name,
        shortDetails: products.shortDetails,
        description: products.description,
        price: products.price,
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
        createdAt: products.createdAt,
        updatedAt: products.updatedAt,
      });

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

  async deleteProduct(id: string): Promise<void> {
    await db.delete(products).where(eq(products.id, id));
  }

  async getCategories(): Promise<Category[]> {
    return db.select().from(categories).orderBy(asc(categories.name));
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
  }): Promise<Order[]> {
    const page = filters?.page && filters.page > 0 ? filters.page : 1;
    const limit = 25;
    const offset = (page - 1) * limit;

    const conditions = [];

    if (filters?.status) {
      conditions.push(eq(orders.status, filters.status));
    }

    if (filters?.search) {
      const q = `%${filters.search}%`;
      conditions.push(
        ilike(orders.fullName, q),
      );
    }

    const whereClause =
      conditions.length > 0 ? and(...conditions) : undefined;

    const rows = await db
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
        deliveryAddress: orders.deliveryAddress,
        createdAt: orders.createdAt,
        updatedAt: orders.updatedAt,
      })
      .from(orders)
      .where(whereClause)
      .orderBy(desc(orders.createdAt))
      .limit(limit)
      .offset(offset);

    return rows;
  }

  async getOrderById(id: string): Promise<Order & { items: (OrderItem & { product?: Product | null })[] }> {
    const [orderRow] = await db
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
        deliveryAddress: orders.deliveryAddress,
        createdAt: orders.createdAt,
        updatedAt: orders.updatedAt,
      })
      .from(orders)
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
        quantity: orderItems.quantity,
        unitPrice: orderItems.unitPrice,
        product: products,
      })
      .from(orderItems)
      .leftJoin(products, eq(orderItems.productId, products.id))
      .where(eq(orderItems.orderId, id))
      .orderBy(asc(orderItems.id));

    return { ...orderRow, items };
  }

  async createOrder(data: CreateOrderInput): Promise<Order> {
    const [orderRow] = await db
      .insert(orders)
      .values({
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
        locationCoordinates: data.locationCoordinates ?? null,
        promoCode: data.promoCode ?? null,
        promoDiscountAmount: data.promoDiscountAmount ?? 0,
        source: data.source ?? "website",
        deliveryRequired: data.deliveryRequired ?? true,
        deliveryProvider: data.deliveryProvider ?? null,
        deliveryAddress: data.deliveryAddress ?? null,
      })
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
        deliveryAddress: orders.deliveryAddress,
        createdAt: orders.createdAt,
        updatedAt: orders.updatedAt,
      });

    if (data.items.length > 0) {
      await db.insert(orderItems).values(
        data.items.map((item) => ({
          orderId: orderRow.id,
          productId: item.productId,
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
        deliveryAddress: orders.deliveryAddress,
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
        deliveryAddress: orders.deliveryAddress,
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
        deliveryAddress: orders.deliveryAddress,
        createdAt: orders.createdAt,
        updatedAt: orders.updatedAt,
      });
    if (!row) throw new Error("Order not found");
    return row;
  }

  async getCustomers(search?: string): Promise<Customer[]> {
    const conditions = [];

    if (search) {
      const q = `%${search}%`;
      conditions.push(
        or(
          ilike(customers.firstName, q),
          ilike(customers.lastName, q),
          ilike(customers.phoneNumber, q),
          ilike(customers.email, q)
        )
      );
    }

    const whereClause =
      conditions.length > 0 ? and(...conditions) : undefined;

    const rows = await db
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

    return rows;
  }

  async getCustomerById(id: string): Promise<Customer & { orders: Order[] }> {
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
        deliveryAddress: orders.deliveryAddress,
        createdAt: orders.createdAt,
        updatedAt: orders.updatedAt,
      })
      .from(orders)
      .where(eq(orders.email, customerRow.email))
      .orderBy(desc(orders.createdAt));

    return { ...customerRow, orders: customerOrders };
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
      // Logic to update name if it was missing or different? 
      // For now just return existing.
      return existing;
    }

    const [row] = await db
      .insert(customers)
      .values({
        firstName,
        lastName,
        email: emailLower,
        phoneNumber: null,
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
    const customerOrders = await db
      .select({
        total: orders.total,
        status: orders.status,
      })
      .from(orders)
      .where(eq(sql`lower(${orders.email})`, emailLower));

    // We only count completed or pos orders for totalSpent? 
    // Usually totalSpent is for completed transactions.
    const completedOrders = customerOrders.filter(
      (o) => o.status === "completed" || o.status === "pos" || o.status === "shipped" || o.status === "delivered"
    );

    const totalSpent = completedOrders.reduce(
      (sum, o) => sum + Number(o.total || 0),
      0
    );
    const orderCount = customerOrders.length; // Count all orders (even pending) for orderCount? 
    // Let's count all except cancelled for orderCount.
    const validOrderCount = customerOrders.filter(o => o.status !== "cancelled").length;

    await db
      .update(customers)
      .set({
        totalSpent: totalSpent.toString(),
        orderCount: validOrderCount,
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
      type: "system",
      link: "/admin/profile?tab=messages",
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
        twoFactorEnabled: users.twoFactorEnabled,
        lastLoginAt: users.lastLoginAt,
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
        twoFactorEnabled: users.twoFactorEnabled,
        lastLoginAt: users.lastLoginAt,
        status: users.status,
      })
      .from(users)
      .where(eq(users.id, id))
      .limit(1);

    return row ?? null;
  }

  async createUser(data: Omit<User, "id">): Promise<User> {
    const [row] = await db
      .insert(users)
      .values({
        username: data.username,
        password: data.password,
        role: data.role,
        displayName: data.displayName ?? null,
        profileImageUrl: data.profileImageUrl ?? null,
        twoFactorEnabled: data.twoFactorEnabled ?? 0,
        status: data.status ?? "active",
      })
      .returning({
        id: users.id,
        username: users.username,
        password: users.password,
        role: users.role,
        displayName: users.displayName,
        profileImageUrl: users.profileImageUrl,
        twoFactorEnabled: users.twoFactorEnabled,
        lastLoginAt: users.lastLoginAt,
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
      .set({ twoFactorEnabled: enabled ? 1 : 0 })
      .where(eq(users.id, id));
  }

  async revokeUser(id: string): Promise<void> {
    await db
      .update(users)
      .set({ status: "suspended" })
      .where(eq(users.id, id));
  }

  async updateUserProfile(id: string, data: { displayName?: string; profileImageUrl?: string }): Promise<void> {
    const updateData: Record<string, any> = {};
    if (data.displayName !== undefined) updateData.displayName = data.displayName;
    if (data.profileImageUrl !== undefined) updateData.profileImageUrl = data.profileImageUrl;
    if (Object.keys(updateData).length === 0) return;
    await db.update(users).set(updateData).where(eq(users.id, id));
  }

  async updateUserEmail(id: string, newEmail: string): Promise<void> {
    await db.update(users).set({ username: newEmail }).where(eq(users.id, id));
  }

  async deleteUser(id: string): Promise<void> {
    // Delete related OTP tokens first
    await db.delete(otpTokens).where(eq(otpTokens.userId, id));
    // Hard delete the user
    await db.delete(users).where(eq(users.id, id));
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
      })
      .from(users)
      .where(sql`${users.role} IN ('admin', 'staff')`);

    return rows.map((row) => ({
      ...row,
      name: row.displayName || row.email,
      twoFactorEnabled: !!row.twoFactorEnabled,
    }));
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
        status: "invited",
        twoFactorEnabled: 1,
      })
      .returning({
        id: users.id,
        username: users.username,
        password: users.password,
        role: users.role,
        displayName: users.displayName,
        profileImageUrl: users.profileImageUrl,
        twoFactorEnabled: users.twoFactorEnabled,
        lastLoginAt: users.lastLoginAt,
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
    const now = new Date();
    const [otp] = await db
      .select()
      .from(otpTokens)
      .where(
        and(
          eq(otpTokens.id, id),
          eq(otpTokens.used, 0),
          sql`${otpTokens.expiresAt} > ${now}`,
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

    const rows = await db
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

    const byDate = new Map<
      string,
      { revenue: number; orderCount: number }
    >();
    for (const row of rows) {
      const d = new Date(row.day);
      const key = d.toISOString().slice(0, 10);
      byDate.set(key, { revenue: row.revenue, orderCount: row.count });
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
  }): Promise<Product[]> {
    return this._products;
  }

  async getProductById(id: string): Promise<Product | null> {
    return this._products.find((p) => p.id === id) ?? null;
  }

  async createProduct(
    data: Omit<Product, "id" | "createdAt" | "updatedAt">,
  ): Promise<Product> {
    const product: Product = {
      id: crypto.randomUUID(),
      name: data.name,
      shortDetails: data.shortDetails ?? null,
      description: data.description ?? null,
      price: data.price.toString(),
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

  async deleteProduct(id: string): Promise<void> {
    this._products = this._products.filter((p) => p.id !== id);
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

  async getOrders(): Promise<Order[]> {
    return this._orders.map(({ items: _items, ...order }) => order);
  }

  async getOrderById(id: string): Promise<Order & { items: (OrderItem & { product?: Product | null })[] }> {
    const order = this._orders.find((o) => o.id === id);
    if (!order) {
      throw new Error("Order not found");
    }
    
    const itemsWithProducts = order.items.map(item => ({
      ...item,
      product: this._products.find(p => p.id === item.productId)
    }));

    return { ...order, items: itemsWithProducts };
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
      deliveryAddress: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      items: data.items.map((item) => ({
        id: crypto.randomUUID(),
        orderId: id,
        productId: item.productId,
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

  async updateOrderPaymentVerified(id: string, status: "verified" | "rejected"): Promise<Order> {
    const order = this._orders.find((o) => o.id === id);
    if (!order) throw new Error("Order not found");
    order.paymentVerified = status;
    const { items: _, ...rest } = order;
    return rest;
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

  async getCustomers(): Promise<Customer[]> {
    return this._customers;
  }

  async getCustomerById(id: string): Promise<Customer & { orders: Order[] }> {
    const customer = this._customers.find((c) => c.id === id);
    if (!customer) {
      throw new Error("Customer not found");
    }
    const customerOrders = this._orders
      .filter((o) => o.email === customer.email)
      .map(({ items: _items, ...order }) => order);
    return { ...customer, orders: customerOrders };
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
  ): Promise<Customer> {
    const existing = this._customers.find((c) => c.email === email);
    if (existing) {
      return existing;
    }
    return this.createCustomer({
      firstName,
      lastName,
      email,
      phoneNumber: null,
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

  async createUser(data: Omit<User, "id">): Promise<User> {
    const user: User = {
      id: crypto.randomUUID(),
      username: data.username,
      password: data.password,
      role: data.role,
      displayName: data.displayName ?? null,
      profileImageUrl: data.profileImageUrl ?? null,
      twoFactorEnabled: 0,
      lastLoginAt: null,
      status: "active",
    };
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
    return this.createUser({ username: data.email, password: data.passwordHash, role: data.role, displayName: data.name, profileImageUrl: null, twoFactorEnabled: 0, lastLoginAt: null, status: "active" } as any);
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

  async updateUserTwoFactor(id: string, enabled: boolean): Promise<void> {}
  async updateUserProfile(id: string, data: { displayName?: string; profileImageUrl?: string }): Promise<void> {}
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
    }));
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
      createdAt: new Date(),
    };
    return promo;
  }

  async updatePromoCode(id: string, data: Partial<PromoCode>): Promise<PromoCode> {
    return { id, code: "TEST", discountPct: 10, maxUses: 100, usedCount: 0, active: true, expiresAt: null, createdAt: new Date() };
  }

  async deletePromoCode(id: string): Promise<void> {}

  async getPromoCodeByCode(code: string): Promise<PromoCode | null> {
    return null;
  }
}

export const storage: IStorage = new PgStorage();

