import { apiRequest } from "./queryClient";
import type { ProductApi, CategoryApi } from "./api";

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
