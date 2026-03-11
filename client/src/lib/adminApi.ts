import { apiRequest } from "./queryClient";
import type { ProductApi, CategoryApi } from "./api";

// Type alias for admin product view
export type AdminProduct = ProductApi;

export interface AdminOrder {
  id: string;
  email: string;
  fullName: string;
  total: number;
  status: string;
  paymentMethod?: string;
  paymentProofUrl?: string | null;
  paymentVerified?: string | null;
  createdAt: string;
  shippingAddress: {
    firstName: string;
    lastName: string;
    addressLine1: string;
    city: string;
    region: string;
    postalCode: string;
    country: string;
    phone: string;
    locationCoordinates?: string;
  };
}

export interface AdminCustomer {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  totalSpent: number;
  orderCount: number;
  avatarColor: string | null;
  createdAt: string;
}

export interface AdminCustomerDetail extends AdminCustomer {
  orders: AdminOrder[];
}

export interface AdminAnalyticsKpisTrends {
  revenue: number;
  orders: number;
  avgOrderValue: number;
  newCustomers: number;
}

export interface AdminAnalyticsKpis {
  revenue: number;
  orders: number;
  avgOrderValue: number;
  newCustomers: number;
  trends: AdminAnalyticsKpisTrends;
}

export interface AdminAnalytics {
  kpis: AdminAnalyticsKpis;
  revenueByDay: { date: string; revenue: number }[];
  ordersByStatus: { completed: number; pending: number; cancelled: number };
  topProducts: { name: string; units: number; revenue: number; percent: number }[];
  salesByCategory: { category: string; revenue: number; percent: number }[];
  ordersByDayOfWeek: { day: string; count: number }[];
  paymentMethods: { method: string; count: number; percent: number }[];
}

export async function fetchAdminProducts(filters?: {
  search?: string;
  category?: string;
  page?: number;
  limit?: number;
}): Promise<ProductApi[]> {
  const params = new URLSearchParams();
  if (filters?.search) params.set("search", filters.search);
  if (filters?.category) params.set("category", filters.category);
  if (filters?.page) params.set("page", String(filters.page));
  if (filters?.limit) params.set("limit", String(filters.limit));

  const url =
    "/api/admin/products" +
    (params.toString() ? `?${params.toString()}` : "");

  const res = await apiRequest("GET", url);
  const json = (await res.json()) as {
    success: boolean;
    data: ProductApi[];
  };
  return json.data;
}

export async function createAdminProduct(
  data: Omit<ProductApi, "id">,
): Promise<ProductApi> {
  const res = await apiRequest("POST", "/api/admin/products", data);
  const json = (await res.json()) as {
    success: boolean;
    data: ProductApi;
  };
  return json.data;
}

export async function updateAdminProduct(
  id: string,
  data: Partial<Omit<ProductApi, "id">>,
): Promise<ProductApi> {
  const res = await apiRequest("PUT", `/api/admin/products/${id}`, data);
  const json = (await res.json()) as {
    success: boolean;
    data: ProductApi;
  };
  return json.data;
}

export async function deleteAdminProduct(id: string): Promise<void> {
  await apiRequest("DELETE", `/api/admin/products/${id}`);
}

export async function createCategory(data: {
  name: string;
  slug: string;
}): Promise<CategoryApi> {
  const res = await apiRequest("POST", "/api/admin/categories", data);
  const json = (await res.json()) as { success: boolean; data: CategoryApi };
  return json.data;
}

export async function updateCategory(
  id: string,
  data: { name: string; slug: string },
): Promise<CategoryApi> {
  const res = await apiRequest("PUT", `/api/admin/categories/${id}`, data);
  const json = (await res.json()) as { success: boolean; data: CategoryApi };
  return json.data;
}

export async function deleteCategory(id: string): Promise<void> {
  await apiRequest("DELETE", `/api/admin/categories/${id}`);
}

export async function uploadProductImage(
  imageBase64: string,
): Promise<string> {
  const res = await apiRequest("POST", "/api/admin/upload-product-image", {
    imageBase64,
  });
  const json = (await res.json()) as { success: boolean; url?: string; error?: string };
  if (!json.success || !json.url) {
    throw new Error(json.error ?? "Upload failed");
  }
  return json.url;
}

export async function fetchAdminOrders(filters?: {
  status?: string;
  search?: string;
  page?: number;
}): Promise<AdminOrder[]> {
  const params = new URLSearchParams();
  if (filters?.status) params.set("status", filters.status);
  if (filters?.search) params.set("search", filters.search);
  if (filters?.page) params.set("page", String(filters.page));

  const url =
    "/api/admin/orders" + (params.toString() ? `?${params.toString()}` : "");

  const res = await apiRequest("GET", url);
  const json = (await res.json()) as {
    success: boolean;
    data: AdminOrder[];
  };
  return json.data;
}

export async function updateOrderStatus(
  id: string,
  status: string,
): Promise<AdminOrder> {
  const res = await apiRequest("PUT", `/api/admin/orders/${id}`, { status });
  const json = (await res.json()) as {
    success: boolean;
    data: AdminOrder;
  };
  return json.data;
}

export async function verifyOrderPayment(
  id: string,
  paymentVerified: "verified" | "rejected",
): Promise<AdminOrder> {
  const res = await apiRequest("PUT", `/api/admin/orders/${id}/verify-payment`, {
    paymentVerified,
  });
  const json = (await res.json()) as {
    success: boolean;
    data: AdminOrder;
  };
  return json.data;
}

export function exportOrdersCSV(): void {
  window.location.href = "/api/admin/orders/export";
}

export function exportAnalyticsCSV(range: string): void {
  window.location.href = `/api/admin/analytics/export?range=${encodeURIComponent(range)}`;
}

export function exportSubscribersCSV(): void {
  window.location.href = "/api/admin/subscribers/export";
}

export async function fetchAdminCustomers(
  search?: string,
): Promise<AdminCustomer[]> {
  const params = new URLSearchParams();
  if (search) params.set("search", search);

  const url =
    "/api/admin/customers" +
    (params.toString() ? `?${params.toString()}` : "");

  const res = await apiRequest("GET", url);
  const json = (await res.json()) as {
    success: boolean;
    data: AdminCustomer[];
  };
  return json.data;
}

export async function fetchCustomerById(
  id: string,
): Promise<AdminCustomerDetail> {
  const res = await apiRequest("GET", `/api/admin/customers/${id}`);
  const json = (await res.json()) as {
    success: boolean;
    data: AdminCustomerDetail;
  };
  return json.data;
}

export async function fetchAnalytics(
  range: "7d" | "30d" | "90d" | "1y",
): Promise<AdminAnalytics> {
  const res = await apiRequest(
    "GET",
    `/api/admin/analytics?range=${encodeURIComponent(range)}`,
  );
  const json = (await res.json()) as {
    success: boolean;
    data: AdminAnalytics;
  };
  return json.data;
}

export interface AdminAnalyticsCalendarDay {
  date: string;
  revenue: number;
  orderCount: number;
  isHoliday: boolean;
}

export async function fetchAnalyticsCalendar(
  year: number,
): Promise<AdminAnalyticsCalendarDay[]> {
  const res = await apiRequest(
    "GET",
    `/api/admin/analytics/calendar?year=${encodeURIComponent(String(year))}`,
  );
  const json = (await res.json()) as {
    success: boolean;
    data: AdminAnalyticsCalendarDay[];
  };
  return json.data;
}

// ── Bill API helpers ─────────────────────────────────

export interface AdminBill {
  id: string;
  billNumber: string;
  orderId: string | null;
  customerId: string | null;
  customerName: string;
  customerEmail: string | null;
  customerPhone: string | null;
  items: any[];
  subtotal: string;
  taxRate: string;
  taxAmount: string;
  discountAmount: string;
  totalAmount: string;
  paymentMethod: string;
  cashReceived: string | null;
  changeGiven: string | null;
  processedBy: string;
  processedById: string | null;
  notes: string | null;
  billType: string;
  status: string;
  createdAt: string;
}

export async function fetchBills(): Promise<AdminBill[]> {
  const res = await apiRequest("GET", "/api/admin/bills");
  const json = (await res.json()) as { success: boolean; data: AdminBill[] };
  return json.data;
}

export async function fetchBillByOrder(orderId: string): Promise<AdminBill | null> {
  const res = await apiRequest("GET", `/api/admin/bills/by-order/${orderId}`);
  const json = (await res.json()) as { success: boolean; data: AdminBill | null };
  return json.data;
}

export async function createPosBill(data: {
  customerName: string;
  customerPhone?: string;
  items: any[];
  paymentMethod: string;
  cashReceived?: number | null;
  discountAmount?: number;
  notes?: string;
}): Promise<AdminBill> {
  const res = await apiRequest("POST", "/api/admin/bills/pos", data);
  const json = (await res.json()) as { success: boolean; data: AdminBill };
  return json.data;
}

export async function voidBill(id: string): Promise<AdminBill> {
  const res = await apiRequest("PUT", `/api/admin/bills/${id}/void`);
  const json = (await res.json()) as { success: boolean; data: AdminBill };
  return json.data;
}

// ── POS Session API helpers ──────────────────────────

export interface POSSession {
  id: string;
  openedBy: string;
  openedAt: string;
  closedAt: string | null;
  openingCash: string;
  closingCash: string | null;
  totalSales: string;
  totalOrders: number;
  totalCashSales: string;
  totalDigitalSales: string;
  status: string;
  notes: string | null;
  createdAt: string;
}

export async function openPosSession(openingCash: number): Promise<POSSession> {
  const res = await apiRequest("POST", "/api/admin/pos/session/open", { openingCash });
  const json = (await res.json()) as { success: boolean; data: POSSession };
  return json.data;
}

export async function closePosSession(
  id: string,
  data: { closingCash: number; notes?: string; openedAt: string },
): Promise<POSSession> {
  const res = await apiRequest("PUT", `/api/admin/pos/session/${id}/close`, data);
  const json = (await res.json()) as { success: boolean; data: POSSession };
  return json.data;
}

export async function fetchTodaySession(): Promise<POSSession | null> {
  const res = await apiRequest("GET", "/api/admin/pos/session/today");
  const json = (await res.json()) as { success: boolean; data: POSSession | null };
  return json.data;
}

// ── Attributes API helpers ──────────────────────────

export interface ProductAttribute {
  id: string;
  type: string;
  value: string;
  createdAt: string;
}

export async function fetchAdminAttributes(type?: string): Promise<ProductAttribute[]> {
  const params = new URLSearchParams();
  if (type) params.set("type", type);
  const url = "/api/admin/attributes" + (params.toString() ? `?${params.toString()}` : "");
  const res = await apiRequest("GET", url);
  const json = (await res.json()) as { success: boolean; data: ProductAttribute[] };
  return json.data;
}

export async function createAdminAttribute(data: {
  type: string;
  value: string;
}): Promise<ProductAttribute> {
  const res = await apiRequest("POST", "/api/admin/attributes", data);
  const json = (await res.json()) as { success: boolean; data: ProductAttribute };
  return json.data;
}

export async function deleteAdminAttribute(id: string): Promise<void> {
  await apiRequest("DELETE", `/api/admin/attributes/${id}`);
}
