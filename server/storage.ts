import { db } from "./db";
import {
  categories,
  customers,
  orderItems,
  orders,
  products,
  users,
  type Category,
  type Customer,
  type Order,
  type OrderItem,
  type Product,
  type User,
} from "@shared/schema";
import { and, asc, desc, eq, ilike, sql } from "drizzle-orm";

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
  items: CreateOrderItemInput[];
}

export interface RevenueByDay {
  date: string;
  revenue: number;
}

export interface SalesByCategory {
  category: string;
  value: number;
  percent: number;
}

export interface AnalyticsData {
  totalRevenue: number;
  totalOrders: number;
  avgOrderValue: number;
  newCustomers: number;
  revenueByDay: RevenueByDay[];
  salesByCategory: SalesByCategory[];
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
  getOrderById(id: string): Promise<Order & { items: OrderItem[] }>;
  createOrder(data: CreateOrderInput): Promise<Order>;
  updateOrderStatus(id: string, status: string): Promise<Order>;
  updateOrderPaymentProof(id: string, paymentProofUrl: string): Promise<Order>;
  updateOrderPaymentVerified(
    id: string,
    paymentVerified: "verified" | "rejected",
  ): Promise<Order>;

  // Customers
  getCustomers(search?: string): Promise<Customer[]>;
  getCustomerById(id: string): Promise<Customer & { orders: Order[] }>;
  createCustomer(
    data: Omit<Customer, "id" | "createdAt">,
  ): Promise<Customer>;
  upsertCustomerFromOrder(
    email: string,
    firstName: string,
    lastName: string,
  ): Promise<Customer>;

  // Users
  getUserByEmail(email: string): Promise<User | null>;
  getUserById(id: string): Promise<User | null>;
  createUser(data: Omit<User, "id">): Promise<User>;

  // Analytics
  getAnalytics(range: "7d" | "30d" | "90d" | "1y"): Promise<AnalyticsData>;

  // Categories
  getCategories(): Promise<Category[]>;
  createCategory(data: { name: string; slug: string }): Promise<Category>;
}

export class PgStorage implements IStorage {
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
      const q = `%${filters.search}%`;
      conditions.push(
        ilike(products.name, q),
      );
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
        createdAt: products.createdAt,
        updatedAt: products.updatedAt,
      })
      .from(products)
      .where(whereClause)
      .orderBy(desc(products.createdAt))
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
        createdAt: products.createdAt,
        updatedAt: products.updatedAt,
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
        createdAt: products.createdAt,
        updatedAt: products.updatedAt,
      });

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

  async getOrderById(id: string): Promise<Order & { items: OrderItem[] }> {
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
      })
      .from(orderItems)
      .where(eq(orderItems.orderId, id))
      .orderBy(asc(orderItems.id));

    return { ...orderRow, items };
  }

  async createOrder(data: CreateOrderInput): Promise<Order> {
    const [orderRow] = await db
      .insert(orders)
      .values({
        userId: null,
        email: data.email,
        fullName: data.fullName,
        addressLine1: data.addressLine1,
        addressLine2: data.addressLine2 ?? null,
        city: data.city,
        region: data.region,
        postalCode: data.postalCode,
        country: data.country,
        total: data.total,
        status: "pending",
        paymentMethod: data.paymentMethod ?? "cash_on_delivery",
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
        createdAt: orders.createdAt,
        updatedAt: orders.updatedAt,
      });

    if (data.items.length > 0) {
      await db.insert(orderItems).values(
        data.items.map((item) => ({
          orderId: orderRow.id,
          productId: item.productId,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
        })),
      );
    }

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
        createdAt: orders.createdAt,
        updatedAt: orders.updatedAt,
      });

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
        ilike(customers.firstName, q),
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
        totalSpent: customers.totalSpent,
        orderCount: customers.orderCount,
        avatarColor: customers.avatarColor,
        createdAt: customers.createdAt,
      })
      .from(customers)
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
        totalSpent: customers.totalSpent,
        orderCount: customers.orderCount,
        avatarColor: customers.avatarColor,
        createdAt: customers.createdAt,
      })
      .from(customers)
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
        totalSpent: data.totalSpent,
        orderCount: data.orderCount,
        avatarColor: data.avatarColor,
      })
      .returning({
        id: customers.id,
        firstName: customers.firstName,
        lastName: customers.lastName,
        email: customers.email,
        totalSpent: customers.totalSpent,
        orderCount: customers.orderCount,
        avatarColor: customers.avatarColor,
        createdAt: customers.createdAt,
      });

    return row;
  }

  async upsertCustomerFromOrder(
    email: string,
    firstName: string,
    lastName: string,
  ): Promise<Customer> {
    const [existing] = await db
      .select({
        id: customers.id,
        firstName: customers.firstName,
        lastName: customers.lastName,
        email: customers.email,
        totalSpent: customers.totalSpent,
        orderCount: customers.orderCount,
        avatarColor: customers.avatarColor,
        createdAt: customers.createdAt,
      })
      .from(customers)
      .where(eq(customers.email, email))
      .limit(1);

    if (existing) {
      return existing;
    }

    const [row] = await db
      .insert(customers)
      .values({
        firstName,
        lastName,
        email,
        totalSpent: 0,
        orderCount: 0,
        avatarColor: "#2D4A35",
      })
      .returning({
        id: customers.id,
        firstName: customers.firstName,
        lastName: customers.lastName,
        email: customers.email,
        totalSpent: customers.totalSpent,
        orderCount: customers.orderCount,
        avatarColor: customers.avatarColor,
        createdAt: customers.createdAt,
      });

    return row;
  }

  async getUserByEmail(email: string): Promise<User | null> {
    const [row] = await db
      .select({
        id: users.id,
        username: users.username,
        password: users.password,
        role: users.role,
      })
      .from(users)
      .where(eq(users.username, email))
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
      })
      .returning({
        id: users.id,
        username: users.username,
        password: users.password,
        role: users.role,
      });

    return row;
  }

  async getAnalytics(range: "7d" | "30d" | "90d" | "1y"): Promise<AnalyticsData> {
    const days =
      range === "7d" ? 7 : range === "30d" ? 30 : range === "90d" ? 90 : 365;

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

    const salesCategoryRows = await db
      .select({
        category: products.category,
        value: sql<number>`sum(${orders.total})`,
      })
      .from(orders)
      .innerJoin(
        orderItems,
        eq(orderItems.orderId, orders.id),
      )
      .innerJoin(products, eq(orderItems.productId, products.id))
      .where(sql.raw(`"orders"."created_at" >= now() - interval '${days} days'`))
      .groupBy(products.category);

    const totalCategoryRevenue = salesCategoryRows.reduce(
      (acc, row) => acc + row.value,
      0,
    );

    const salesByCategory: SalesByCategory[] = salesCategoryRows.map(
      (row) => ({
        category: row.category ?? "Uncategorized",
        value: row.value,
        percent:
          totalCategoryRevenue > 0
            ? (row.value / totalCategoryRevenue) * 100
            : 0,
      }),
    );

    return {
      totalRevenue: summary.totalRevenue,
      totalOrders: summary.totalOrders,
      avgOrderValue,
      newCustomers: newCustomersRow.count,
      revenueByDay,
      salesByCategory,
    };
  }
}

export class MemStorage implements IStorage {
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
      description: data.description,
      price: data.price,
      imageUrl: data.imageUrl,
      category: data.category,
      stock: data.stock,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this._products.push(product);
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

  async getOrders(): Promise<Order[]> {
    return this._orders.map(({ items: _items, ...order }) => order);
  }

  async getOrderById(id: string): Promise<Order & { items: OrderItem[] }> {
    const order = this._orders.find((o) => o.id === id);
    if (!order) {
      throw new Error("Order not found");
    }
    return order;
  }

  async createOrder(data: CreateOrderInput): Promise<Order> {
    const order: Order & { items: OrderItem[] } = {
      id: crypto.randomUUID(),
      userId: null,
      email: data.email,
      fullName: data.fullName,
      addressLine1: data.addressLine1,
      addressLine2: data.addressLine2 ?? null,
      city: data.city,
      region: data.region,
      postalCode: data.postalCode,
      country: data.country,
      total: data.total,
      status: "pending",
      createdAt: new Date(),
      updatedAt: new Date(),
      items: data.items.map((item) => ({
        id: crypto.randomUUID(),
        orderId: "",
        productId: item.productId,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
      })),
    };
    this._orders.push(order);
    return order;
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
      totalSpent: data.totalSpent,
      orderCount: data.orderCount,
      avatarColor: data.avatarColor,
      createdAt: new Date(),
    };
    this._customers.push(customer);
    return customer;
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
      totalSpent: 0,
      orderCount: 0,
      avatarColor: "#2D4A35",
    });
  }

  async getCategories(): Promise<Category[]> {
    return this._categories;
  }

  async createCategory(data: { name: string; slug: string }): Promise<Category> {
    const category: Category = {
      id: crypto.randomUUID(),
      name: data.name,
      slug: data.slug,
      createdAt: new Date(),
    };
    this._categories.push(category);
    return category;
  }

  async getUserByEmail(email: string): Promise<User | null> {
    return this._users.find((u) => u.username === email) ?? null;
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
    };
    this._users.push(user);
    return user;
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

  async getAnalytics(): Promise<AnalyticsData> {
    return {
      totalRevenue: 0,
      totalOrders: 0,
      avgOrderValue: 0,
      newCustomers: 0,
      revenueByDay: [],
      salesByCategory: [],
    };
  }
}

export const storage: IStorage = new PgStorage();

