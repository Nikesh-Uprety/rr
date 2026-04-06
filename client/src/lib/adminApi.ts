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
  userId?: string | null;
  phoneNumber?: string | null;
  addressLine1?: string | null;
  addressLine2?: string | null;
  city?: string | null;
  region?: string | null;
  postalCode?: string | null;
  country?: string | null;
  locationCoordinates?: string | null;
  deliveryLocation?: string | null;
  promoCode?: string;
  promoDiscountAmount?: number;
  discountAmount?: number;
  source?: string;
  deliveryRequired?: boolean;
  deliveryProvider?: string | null;
  deliveryAddress?: string | null;
  items?: Array<{
    productId: string;
    quantity: number;
    size?: string | null;
    name: string;
  }>;
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
  phoneNumber?: string | null;
  profileImageUrl?: string | null;
}

export interface AdminCustomerDetail extends AdminCustomer {
  deliveryAddress: {
    street: string | null;
    city: string | null;
    region: string | null;
  } | null;
  orders: AdminOrder[];
}

export interface AdminCustomerOrderHistoryItem {
  id: string;
  createdAt: string;
  deliveryAddress?: string | null;
  items: { name: string; quantity: number; productId?: string; imageUrl?: string | null }[];
  total: string | number;
  paymentMethod: string;
  status: string;
  source: "online" | "pos";
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
  ordersByDay: { date: string; count: number }[];
  newCustomersByDay: { date: string; count: number }[];
  ordersByStatus: { completed: number; pending: number; cancelled: number };
  topProducts: { name: string; imageUrl?: string | null; units: number; revenue: number; percent: number }[];
  salesByCategory: { category: string; revenue: number; percent: number }[];
  revenueByPlatform: { platform: string; label: string; revenue: number; percent: number }[];
  ordersByDayOfWeek: { day: string; count: number }[];
  paymentMethods: { method: string; count: number; percent: number }[];
}

export interface AdminPlatform {
  id: string;
  key: string;
  label: string;
  isActive: boolean;
  createdAt: string;
}

async function downloadAdminCsv(url: string, fallbackFilename: string): Promise<void> {
  const res = await fetch(url, {
    method: "GET",
    credentials: "include",
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `Failed to export ${fallbackFilename}`);
  }

  const blob = await res.blob();
  const disposition = res.headers.get("Content-Disposition") || "";
  const match = disposition.match(/filename="?([^"]+)"?/i);
  const filename = match?.[1] || fallbackFilename;
  const downloadUrl = window.URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = downloadUrl;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(downloadUrl);
}

function triggerAdminCsvDownload(url: string): void {
  if (typeof window === "undefined") return;
  const anchor = document.createElement("a");
  const separator = url.includes("?") ? "&" : "?";
  anchor.href = `${url}${separator}dl=${Date.now()}`;
  anchor.style.display = "none";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
}

export async function fetchPlatforms(): Promise<AdminPlatform[]> {
  const res = await apiRequest("GET", "/api/admin/platforms");
  const json = (await res.json()) as { success: boolean; data: AdminPlatform[] };
  return json.data ?? [];
}

export async function upsertPlatform(input: {
  key: string;
  label: string;
  isActive?: boolean;
}): Promise<AdminPlatform> {
  const res = await apiRequest("POST", "/api/admin/platforms", input);
  const json = (await res.json()) as { success: boolean; data: AdminPlatform };
  return json.data;
}

export async function deletePlatform(key: string): Promise<void> {
  await apiRequest("DELETE", `/api/admin/platforms/${encodeURIComponent(key)}`);
}

export interface AdminImageAsset {
  id: string;
  url: string;
  provider: string;
  category: string;
  publicId: string | null;
  filename: string | null;
  bytes: number | null;
  width: number | null;
  height: number | null;
  createdAt: string;
}

export interface AdminStorefrontImageEntry {
  filename: string;
  url: string;
  relPath: string;
}

export type PaymentQrProvider = "esewa" | "khalti" | "fonepay";

export interface AdminPaymentQrSelection {
  id: string | null;
  url: string;
  createdAt: string | null;
}

export interface AdminPaymentQrConfig {
  esewa: AdminPaymentQrSelection;
  khalti: AdminPaymentQrSelection;
  fonepay: AdminPaymentQrSelection;
}

export async function fetchAdminImages(params?: {
  category?: string;
  provider?: "local" | "cloudinary" | "tigris" | string;
  search?: string;
  limit?: number;
  offset?: number;
}): Promise<AdminImageAsset[]> {
  const qs = new URLSearchParams();
  if (params?.category) qs.set("category", params.category);
  if (params?.provider) qs.set("provider", params.provider);
  if (params?.search) qs.set("search", params.search);
  if (params?.limit) qs.set("limit", String(params.limit));
  if (params?.offset) qs.set("offset", String(params.offset));
  const res = await apiRequest("GET", `/api/admin/images?${qs.toString()}`);
  const json = (await res.json()) as { success: boolean; data: AdminImageAsset[] };
  return json.data ?? [];
}

export async function fetchAdminImagesPage(params?: {
  category?: string;
  provider?: "local" | "cloudinary" | "tigris" | string;
  search?: string;
  limit?: number;
  offset?: number;
}): Promise<{ data: AdminImageAsset[]; total: number }> {
  const qs = new URLSearchParams();
  if (params?.category) qs.set("category", params.category);
  if (params?.provider) qs.set("provider", params.provider);
  if (params?.search) qs.set("search", params.search);
  if (params?.limit) qs.set("limit", String(params.limit));
  if (params?.offset) qs.set("offset", String(params.offset));
  const res = await apiRequest("GET", `/api/admin/images?${qs.toString()}`);
  const json = (await res.json()) as {
    success: boolean;
    data: AdminImageAsset[];
    total?: number;
  };
  return { data: json.data ?? [], total: json.total ?? 0 };
}

export async function fetchAdminPaymentQrConfig(): Promise<AdminPaymentQrConfig> {
  const res = await apiRequest("GET", "/api/admin/payment-qr/config");
  const json = (await res.json()) as { success: boolean; data: AdminPaymentQrConfig };
  return json.data;
}

export async function activateAdminPaymentQr(input: {
  provider: PaymentQrProvider;
  assetId: string;
}): Promise<void> {
  await apiRequest("POST", "/api/admin/payment-qr/activate", input);
}

export interface AdminOrderTrendPoint {
  day: string;
  revenue: number;
  total: number;
  completed: number;
  pending: number;
}

export interface AdminOrderTrend {
  rangeStart: string | null;
  rangeEnd: string | null;
  series: AdminOrderTrendPoint[];
}

export async function fetchAdminOrdersTrend(filters?: {
  status?: string;
  search?: string;
  timeRange?: string;
}): Promise<AdminOrderTrend> {
  const params = new URLSearchParams();
  if (filters?.status) params.set("status", filters.status);
  if (filters?.search) params.set("search", filters.search);
  if (filters?.timeRange) params.set("timeRange", filters.timeRange);

  const url =
    "/api/admin/orders/trends" + (params.toString() ? `?${params.toString()}` : "");
  const res = await apiRequest("GET", url);
  const json = (await res.json()) as { success: boolean; data: AdminOrderTrend };
  return json.data ?? { rangeStart: null, rangeEnd: null, series: [] };
}

export async function fetchAdminStorefrontImageLibrary(): Promise<AdminStorefrontImageEntry[]> {
  const res = await apiRequest("GET", "/api/admin/storefront-image-library");
  const json = (await res.json()) as {
    success: boolean;
    data?: AdminStorefrontImageEntry[];
  };
  return json.data ?? [];
}

export async function deleteAdminStorefrontImage(relPath: string): Promise<void> {
  const res = await apiRequest("DELETE", "/api/admin/storefront-image-library", { relPath });
  const json = (await res.json()) as { success: boolean; error?: string };
  if (!json.success) throw new Error(json.error || "Delete failed");
}

type UploadProgressHandler = (value: number) => void;

function uploadWithProgress<T>(options: {
  url: string;
  body: XMLHttpRequestBodyInit | Document | null;
  method?: string;
  headers?: Record<string, string>;
  onProgress?: UploadProgressHandler;
}) {
  const { url, body, method = "POST", headers, onProgress } = options;

  return new Promise<T>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open(method, url, true);
    xhr.withCredentials = true;
    if (headers) {
      Object.entries(headers).forEach(([key, value]) => {
        xhr.setRequestHeader(key, value);
      });
    }

    if (xhr.upload && onProgress) {
      xhr.upload.onprogress = (event) => {
        if (!event.lengthComputable) return;
        const percent = Math.round((event.loaded / event.total) * 100);
        onProgress(percent);
      };
    }

    xhr.onerror = () => {
      reject(new Error("Upload failed"));
    };

    xhr.onload = () => {
      const ok = xhr.status >= 200 && xhr.status < 300;
      let json: any = null;
      try {
        json = xhr.responseText ? JSON.parse(xhr.responseText) : null;
      } catch {
        json = null;
      }

      if (!ok) {
        reject(new Error(json?.error || json?.message || "Upload failed"));
        return;
      }
      resolve(json as T);
    };

    xhr.send(body);
  });
}

export async function uploadAdminImage(input: {
  file: File;
  category: string;
  provider: "local" | "cloudinary" | "tigris";
  onProgress?: UploadProgressHandler;
}): Promise<AdminImageAsset> {
  const form = new FormData();
  form.append("images", input.file);
  form.append("category", input.category);
  form.append("provider", input.provider);

  const json = await uploadWithProgress<
    { success?: boolean; data?: AdminImageAsset | AdminImageAsset[]; error?: string; message?: string }
  >({
    url: "/api/admin/images/upload",
    body: form,
    onProgress: input.onProgress,
  });

  if (!json?.success || !json.data) {
    throw new Error(json?.error || json?.message || "Upload failed");
  }
  return Array.isArray(json.data) ? json.data[0] : json.data;
}

export async function deleteAdminImage(id: string): Promise<void> {
  const res = await apiRequest("DELETE", `/api/admin/images/${encodeURIComponent(id)}`);
  const json = (await res.json()) as { success: boolean; error?: string };
  if (!json.success) throw new Error(json.error || "Delete failed");
}

// ── Local Media API helpers ──────────────────────────

export interface AdminLocalMedia {
  name: string;
  url: string;
  size: number;
  createdAt: string;
}

export async function fetchLocalMedia(): Promise<AdminLocalMedia[]> {
  const res = await apiRequest("GET", "/api/admin/media");
  const json = (await res.json()) as { success: boolean; data: AdminLocalMedia[] };
  return json.data ?? [];
}

export async function uploadLocalMedia(file: File): Promise<AdminLocalMedia> {
  const form = new FormData();
  form.append("file", file);
  const res = await fetch("/api/admin/media/upload", {
    method: "POST",
    credentials: "include",
    body: form,
  });
  const json = (await res.json()) as { success: boolean; data: AdminLocalMedia; error?: string };
  if (!json.success || !json.data) throw new Error(json.error || "Upload failed");
  return json.data;
}

export async function deleteLocalMedia(filename: string): Promise<void> {
  const res = await apiRequest("DELETE", `/api/admin/media/${encodeURIComponent(filename)}`);
  const json = (await res.json()) as { success: boolean; error?: string };
  if (!json.success) throw new Error(json.error || "Delete failed");
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

export async function toggleProductActive(id: string): Promise<ProductApi> {
  const res = await apiRequest("PUT", `/api/admin/products/${id}/toggle-active`);
  const json = (await res.json()) as { success: boolean; data: ProductApi };
  return json.data;
}

export async function updateAdminProductHomeFeatured(
  id: string,
  data: { homeFeatured: boolean; homeFeaturedImageIndex?: number },
): Promise<ProductApi> {
  const res = await apiRequest("PATCH", `/api/admin/products/${id}/home-featured`, data);
  const json = (await res.json()) as { success: boolean; data: ProductApi };
  return json.data;
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

export async function bulkCategorizeProducts(input: {
  productIds: string[];
  categorySlug: string;
}): Promise<void> {
  const res = await apiRequest("PATCH", "/api/admin/products/bulk-categorize", input);
  const json = (await res.json()) as { success: boolean; error?: string };
  if (!json.success) {
    throw new Error(json.error || "Failed to move products");
  }
}

export async function uploadProductImage(
  imageBase64: string,
  onProgress?: UploadProgressHandler,
): Promise<string> {
  const payload = JSON.stringify({ imageBase64 });
  const json = await uploadWithProgress<{ success: boolean; url?: string; error?: string }>({
    url: "/api/admin/upload-product-image",
    body: payload,
    headers: { "Content-Type": "application/json" },
    onProgress,
  });
  if (!json.success || !json.url) {
    throw new Error(json.error ?? "Upload failed");
  }
  return json.url;
}

export async function uploadProductImageFile(
  file: File,
  onProgress?: UploadProgressHandler,
): Promise<string> {
  const form = new FormData();
  form.append("image", file);

  const json = await uploadWithProgress<{ success: boolean; url?: string; error?: string }>({
    url: "/api/admin/upload-product-image-file",
    body: form,
    onProgress,
  });

  if (!json.success || !json.url) {
    throw new Error(json.error ?? "Upload failed");
  }
  return json.url;
}

export async function fetchAdminOrdersPage(filters?: {
  status?: string;
  search?: string;
  page?: number;
  limit?: number;
  timeRange?: string;
}): Promise<{ data: AdminOrder[]; total: number }> {
  const params = new URLSearchParams();
  if (filters?.status) params.set("status", filters.status);
  if (filters?.search) params.set("search", filters.search);
  if (filters?.page) params.set("page", String(filters.page));
  if (filters?.limit) params.set("limit", String(filters.limit));
  if (filters?.timeRange) params.set("timeRange", filters.timeRange);

  const url =
    "/api/admin/orders" + (params.toString() ? `?${params.toString()}` : "");

  const res = await apiRequest("GET", url);
  const json = (await res.json()) as {
    success: boolean;
    data: AdminOrder[];
    total?: number;
  };
  const data = (json.data ?? []).map((order) => ({
    ...order,
    discountAmount:
      typeof order.discountAmount === "number"
        ? order.discountAmount
        : typeof order.promoDiscountAmount === "number"
          ? order.promoDiscountAmount
          : 0,
  }));
  return { data, total: json.total ?? data.length };
}

export async function fetchAdminOrders(filters?: {
  status?: string;
  search?: string;
  page?: number;
  limit?: number;
  timeRange?: string;
}): Promise<AdminOrder[]> {
  const { data } = await fetchAdminOrdersPage(filters);
  return data;
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

export function exportOrdersCSV(): Promise<void> {
  return downloadAdminCsv("/api/admin/orders/export", "orders.csv");
}

export function exportOrdersCSVInstant(): void {
  triggerAdminCsvDownload("/api/admin/orders/export");
}

export function exportAnalyticsCSV(range: string): Promise<void> {
  return downloadAdminCsv(
    `/api/admin/analytics/export?range=${encodeURIComponent(range)}`,
    `analytics-${range}.csv`,
  );
}

export function exportSubscribersCSV(): Promise<void> {
  return downloadAdminCsv("/api/admin/subscribers/export", "subscribers.csv");
}

export function exportCustomersCSV(): Promise<void> {
  return downloadAdminCsv("/api/admin/customers/export", "customers.csv");
}

export async function fetchAdminCustomersPage(filters?: {
  search?: string;
  timeRange?: string;
  page?: number;
  limit?: number;
  includeZeroOrders?: boolean;
}): Promise<{ data: AdminCustomer[]; total: number }> {
  const params = new URLSearchParams();
  if (filters?.search) params.set("search", filters.search);
  if (filters?.timeRange) params.set("timeRange", filters.timeRange);
  if (filters?.page) params.set("page", String(filters.page));
  if (filters?.limit) params.set("limit", String(filters.limit));
  if (filters?.includeZeroOrders === false) params.set("includeZeroOrders", "false");

  const url =
    "/api/admin/customers" +
    (params.toString() ? `?${params.toString()}` : "");

  const res = await apiRequest("GET", url);
  const json = (await res.json()) as {
    success: boolean;
    data: AdminCustomer[];
    total?: number;
  };
  return { data: json.data ?? [], total: json.total ?? 0 };
}

export async function fetchAdminCustomers(
  search?: string,
  timeRange?: string,
): Promise<AdminCustomer[]> {
  const { data } = await fetchAdminCustomersPage({ search, timeRange });
  return data;
}

export async function createAdminCustomer(data: {
  firstName: string;
  lastName: string;
  email?: string;
  phoneNumber?: string;
}): Promise<AdminCustomer> {
  const res = await apiRequest("POST", "/api/admin/customers", data);
  const json = (await res.json()) as { success: boolean; data: AdminCustomer };
  return json.data;
}

export async function updateAdminCustomer(
  id: string,
  data: { firstName?: string; lastName?: string; email?: string; phoneNumber?: string }
): Promise<AdminCustomer> {
  const res = await apiRequest("PUT", `/api/admin/customers/${id}`, data);
  const json = (await res.json()) as { success: boolean; data: AdminCustomer };
  return json.data;
}

export async function deleteAdminCustomer(id: string): Promise<void> {
  await apiRequest("DELETE", `/api/admin/customers/${id}`);
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

export async function fetchCustomerOrders(id: string): Promise<AdminCustomerOrderHistoryItem[]> {
  const res = await apiRequest("GET", `/api/admin/customers/${encodeURIComponent(id)}/orders`);
  const json = (await res.json()) as { success: boolean; data: AdminCustomerOrderHistoryItem[] };
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
  source?: string;
  items: any[];
  subtotal: string;
  taxRate: string;
  taxAmount: string;
  discountAmount: string;
  totalAmount: string;
  paymentMethod: string;
  isPaid?: boolean;
  deliveryRequired?: boolean;
  deliveryProvider?: string | null;
  deliveryAddress?: string | null;
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
  customerEmail?: string;
  customerPhone?: string;
  items: any[];
  source?: string;
  paymentMethod: string;
  isPaid?: boolean;
  deliveryRequired?: boolean;
  deliveryProvider?: string | null;
  deliveryLocation?: string | null;
  deliveryAddress?: string | null;
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

export async function fetchAdminProductsPage(filters?: {
  search?: string;
  category?: string;
  page?: number;
  limit?: number;
  status?: "active" | "draft" | "archived";
}): Promise<{ data: ProductApi[]; total: number }> {
  const params = new URLSearchParams();
  if (filters?.search) params.set("search", filters.search);
  if (filters?.category) params.set("category", filters.category);
  if (filters?.page) params.set("page", String(filters.page));
  if (filters?.limit) params.set("limit", String(filters.limit));
  if (filters?.status) params.set("status", filters.status);

  const url =
    "/api/admin/products" +
    (params.toString() ? `?${params.toString()}` : "");

  const res = await apiRequest("GET", url);
  const json = (await res.json()) as {
    success: boolean;
    data: ProductApi[];
    total?: number;
  };
  return { data: json.data ?? [], total: Number(json.total ?? 0) };
}

export interface AdminProductStats {
  total: number;
  featuredCount: number;
  categoryCounts: Record<string, number>;
  activeCount: number;
  draftCount: number;
  archivedCount: number;
}

export async function fetchAdminProductStats(): Promise<AdminProductStats> {
  const res = await apiRequest("GET", "/api/admin/products/stats");
  const json = (await res.json()) as { success: boolean; data: AdminProductStats };
  return json.data;
}

export async function exportPosBillsCSV(): Promise<void> {
  return downloadAdminCsv("/api/admin/bills/export?source=pos", "pos-bills.csv");
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

// ── Newsletter Marketing API helpers ────────────────────

export async function addNewsletterEmail(email: string): Promise<{ success: boolean; message: string }> {
  const res = await apiRequest("POST", "/api/admin/newsletter/add", { email });
  return res.json();
}

export async function importNewsletterEmails(emails: string[]): Promise<{ success: boolean; message: string; added: number; total: number }> {
  const res = await apiRequest("POST", "/api/admin/newsletter/import", { emails });
  return res.json();
}

export async function deleteNewsletterEmail(email: string): Promise<{ success: boolean; message: string }> {
  const res = await apiRequest("DELETE", `/api/admin/newsletter/${encodeURIComponent(email)}`);
  return res.json();
}

export async function deleteAllNewsletterEmails(): Promise<{ success: boolean; message: string }> {
  const res = await apiRequest("DELETE", "/api/admin/newsletter/clear-all");
  return res.json();
}

// ── Promo Code API helpers ────────────────────────────

export interface PromoCode {
  id: string;
  code: string;
  discountPct: number;
  maxUses: number;
  usedCount: number;
  active: boolean;
  expiresAt: string | null;
  applicableProductIds: number[] | null;
  durationPreset: string | null;
  createdAt: string;
}

export async function fetchAdminPromoCodes(): Promise<PromoCode[]> {
  const res = await apiRequest("GET", "/api/admin/promo-codes");
  const json = (await res.json()) as { success: boolean; data: PromoCode[] };
  return json.data;
}

export async function createAdminPromoCode(data: {
  code: string;
  discountPct: number;
  maxUses: number;
  expiresAt?: string | null;
  applicableProductIds?: number[] | null;
  durationPreset?: string | null;
}): Promise<PromoCode> {
  const res = await apiRequest("POST", "/api/admin/promo-codes", data);
  const json = (await res.json()) as { success: boolean; data: PromoCode };
  return json.data;
}

export async function updateAdminPromoCode(
  id: string,
  data: Partial<PromoCode>,
): Promise<PromoCode> {
  const res = await apiRequest("PUT", `/api/admin/promo-codes/${id}`, data);
  const json = (await res.json()) as { success: boolean; data: PromoCode };
  return json.data;
}

export async function deleteAdminPromoCode(id: string): Promise<void> {
  await apiRequest("DELETE", `/api/admin/promo-codes/${id}`);
}

// ─── Canvas Pages ──────────────────────────────────────────────

export interface CanvasPage {
  id: number;
  slug: string;
  title: string;
  description: string | null;
  status: "draft" | "published";
  isHomepage: boolean;
  showInNav: boolean;
  sortOrder: number;
  seoTitle: string | null;
  seoDescription: string | null;
  seoImage: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CanvasPageWithSections extends CanvasPage {
  sections: CanvasSection[];
}

export interface CanvasSection {
  id: number;
  templateId: number | null;
  pageId: number | null;
  sectionType: string;
  label: string | null;
  orderIndex: number;
  isVisible: boolean;
  config: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface CanvasTemplate {
  id: number;
  name: string;
  slug: string;
  description: string | null;
  thumbnailUrl: string | null;
  tier: string;
  priceNpr: number;
  isPurchased: boolean;
  isActive?: boolean;
  isCustom?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface SiteBranding {
  id: number;
  logoUrl: string | null;
  logoDarkUrl: string | null;
  logoHeight: number;
  faviconUrl: string | null;
  ogImageUrl: string | null;
  footerLogoUrl: string | null;
  footerText: string | null;
  fontPreset: string | null;
  updatedAt: string;
}

export interface ColorPreset {
  id: number;
  presetName: string;
  bgPrimary: string | null;
  bgSecondary: string | null;
  textPrimary: string | null;
  textSecondary: string | null;
  accentColor: string | null;
  borderColor: string | null;
  isActive: boolean;
  createdAt: string;
}

export async function getCanvasPages(): Promise<CanvasPage[]> {
  const res = await apiRequest("GET", "/api/admin/canvas/pages");
  const json = (await res.json()) as CanvasPage[];
  return json;
}

export async function createCanvasPage(data: { title: string; slug: string; fromTemplateId?: number }): Promise<CanvasPage> {
  const res = await apiRequest("POST", "/api/admin/canvas/pages", data);
  return (await res.json()) as CanvasPage;
}

export async function getCanvasPage(id: number): Promise<CanvasPageWithSections> {
  const res = await apiRequest("GET", `/api/admin/canvas/pages/${id}`);
  return (await res.json()) as CanvasPageWithSections;
}

export async function updateCanvasPage(id: number, data: Partial<CanvasPage>): Promise<CanvasPage> {
  const res = await apiRequest("PATCH", `/api/admin/canvas/pages/${id}`, data);
  return (await res.json()) as CanvasPage;
}

export async function deleteCanvasPage(id: number): Promise<void> {
  await apiRequest("DELETE", `/api/admin/canvas/pages/${id}`);
}

export async function reorderCanvasPages(orderedIds: number[]): Promise<void> {
  await apiRequest("PATCH", "/api/admin/canvas/pages/reorder", { orderedIds });
}

export async function duplicateCanvasPage(id: number): Promise<CanvasPage> {
  const res = await apiRequest("POST", `/api/admin/canvas/pages/${id}/duplicate`);
  return (await res.json()) as CanvasPage;
}

export async function toggleCanvasPagePublish(id: number): Promise<CanvasPage> {
  const res = await apiRequest("PATCH", `/api/admin/canvas/pages/${id}/publish`);
  return (await res.json()) as CanvasPage;
}

// ─── Canvas Page Sections ──────────────────────────────────────

export async function getPageSections(pageId: number): Promise<CanvasSection[]> {
  const res = await apiRequest("GET", `/api/admin/canvas/pages/${pageId}/sections`);
  return (await res.json()) as CanvasSection[];
}

export async function addPageSection(pageId: number, data: { sectionType: string; label?: string; config?: Record<string, unknown> }): Promise<CanvasSection> {
  const res = await apiRequest("POST", `/api/admin/canvas/pages/${pageId}/sections`, data);
  return (await res.json()) as CanvasSection;
}

export async function reorderPageSections(pageId: number, orderedIds: number[]): Promise<void> {
  await apiRequest("PATCH", `/api/admin/canvas/pages/${pageId}/sections/reorder`, { orderedIds });
}

export async function updatePageSection(pageId: number, id: number, data: Partial<CanvasSection>): Promise<CanvasSection> {
  const res = await apiRequest("PATCH", `/api/admin/canvas/pages/${pageId}/sections/${id}`, data);
  return (await res.json()) as CanvasSection;
}

export async function deletePageSection(pageId: number, id: number): Promise<void> {
  await apiRequest("DELETE", `/api/admin/canvas/pages/${pageId}/sections/${id}`);
}

export async function duplicateCanvasSection(id: number): Promise<CanvasSection> {
  const res = await apiRequest("POST", `/api/admin/canvas/sections/${id}/duplicate`);
  return (await res.json()) as CanvasSection;
}

// ─── Canvas Templates (enhanced) ───────────────────────────────

export async function getCanvasTemplates(): Promise<CanvasTemplate[]> {
  const res = await apiRequest("GET", "/api/admin/canvas/templates");
  return (await res.json()) as CanvasTemplate[];
}

export async function createCanvasTemplate(data: { name: string; slug: string; description?: string; tier?: string; fromPageId?: number }): Promise<any> {
  const res = await apiRequest("POST", "/api/admin/canvas/templates", data);
  return (await res.json()) as any;
}

export async function updateCanvasTemplate(id: number, data: Partial<any>): Promise<any> {
  const res = await apiRequest("PATCH", `/api/admin/canvas/templates/${id}`, data);
  return (await res.json()) as any;
}

export async function deleteCanvasTemplate(id: number): Promise<void> {
  await apiRequest("DELETE", `/api/admin/canvas/templates/${id}`);
}

export async function duplicateCanvasTemplate(id: number): Promise<any> {
  const res = await apiRequest("POST", `/api/admin/canvas/templates/${id}/duplicate`);
  return (await res.json()) as any;
}

export async function savePageAsTemplate(pageId: number, data: { name: string; slug: string; tier?: string }): Promise<any> {
  const res = await apiRequest("POST", `/api/admin/canvas/pages/${pageId}/save-as-template`, data);
  return (await res.json()) as any;
}

// ─── Canvas Branding ───────────────────────────────────────────

export async function getBranding(): Promise<SiteBranding | null> {
  const res = await apiRequest("GET", "/api/admin/canvas/branding");
  return (await res.json()) as SiteBranding | null;
}

export async function updateBranding(data: Partial<SiteBranding>): Promise<SiteBranding> {
  const res = await apiRequest("PATCH", "/api/admin/canvas/branding", data);
  return (await res.json()) as SiteBranding;
}

// ─── Canvas Colors ─────────────────────────────────────────────

export async function getColorPresets(): Promise<ColorPreset[]> {
  const res = await apiRequest("GET", "/api/admin/canvas/colors");
  return (await res.json()) as ColorPreset[];
}

export async function createColorPreset(data: Partial<ColorPreset>): Promise<ColorPreset> {
  const res = await apiRequest("POST", "/api/admin/canvas/colors", data);
  return (await res.json()) as ColorPreset;
}

export async function updateColorPreset(id: number, data: Partial<ColorPreset>): Promise<ColorPreset> {
  const res = await apiRequest("PATCH", `/api/admin/canvas/colors/${id}`, data);
  return (await res.json()) as ColorPreset;
}

export async function activateColorPreset(id: number): Promise<ColorPreset> {
  const res = await apiRequest("PATCH", `/api/admin/canvas/colors/${id}/activate`);
  return (await res.json()) as ColorPreset;
}

export async function deleteColorPreset(id: number): Promise<void> {
  await apiRequest("DELETE", `/api/admin/canvas/colors/${id}`);
}

// ─── Public Pages ──────────────────────────────────────────────

export async function getPublicPages(): Promise<CanvasPage[]> {
  const res = await fetch("/api/public/pages");
  const json = (await res.json()) as CanvasPage[];
  return json;
}

export async function generatePreviewToken(pageId: number): Promise<string> {
  const res = await apiRequest("POST", `/api/admin/canvas/pages/${pageId}/preview-token`);
  const json = (await res.json()) as { token: string };
  return json.token;
}

export async function getPublicPageConfig(slug: string, token?: string): Promise<any> {
  const params = new URLSearchParams({ slug });
  if (token) params.set("token", token);
  const res = await fetch(`/api/public/page-config?${params.toString()}`);
  return (await res.json()) as any;
}

export async function getPublicBranding(): Promise<{ branding: SiteBranding | null; colors: ColorPreset | null }> {
  const res = await fetch("/api/public/branding");
  return (await res.json()) as { branding: SiteBranding | null; colors: ColorPreset | null };
}
