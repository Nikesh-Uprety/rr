import { apiRequest } from "./queryClient";

export interface ProductSizeMeasurement {
  size: string;
  [key: string]: string | number;
}

export interface ProductMeasurementOverlayPoint {
  top: string;
  left: string;
  width?: string;
  height?: string;
  rotate?: string;
  label?: string;
}

export interface ProductMeasurementOverlay {
  [measurementKey: string]: ProductMeasurementOverlayPoint | undefined;
}

export interface ProductSizeChart {
  image: string;
  measurements: ProductSizeMeasurement[];
  units?: string;
  measureOverlay?: ProductMeasurementOverlay;
}

export interface ProductApi {
  id: string;
  name: string;
  shortDetails?: string | null;
  description: string | null;
  price: number;
  costPrice?: number | null;
  imageUrl: string | null;
  galleryUrls?: string | null;
  colorImageMap?: Record<string, string[]> | null;
  category: string | null;
  stock: number;
  colorOptions?: string | null;
  sizeOptions?: string | null;
  ranking?: number | null;
  originalPrice?: number | string | null;
  salePercentage?: number | null;
  saleActive?: boolean | null;
  homeFeatured?: boolean;
  homeFeaturedImageIndex?: number;
  isNewArrival?: boolean;
  isNewCollection?: boolean;
  isActive?: boolean;
  stockBySize?: Record<string, number>;
  variants?: Array<{
    id: number | string;
    size: string;
    color: string | null;
    stock: number;
    sku: string | null;
    compareAtPrice?: number | null;
    sellingPrice?: number | null;
    costPrice?: number | null;
    weight?: number | null;
  }>;
  sizeChart?: ProductSizeChart | null;
}

export interface CategoryApi {
  id: string;
  name: string;
  slug: string;
  createdAt: string;
}

export interface OrderItemInput {
  productId: string;
  variantId?: string | number;
  size?: string;
  color?: string;
  quantity: number;
  priceAtTime: number;
}

export interface OrderInput {
  items: OrderItemInput[];
  shipping: {
    firstName: string;
    lastName: string;
    email: string;
    phone?: string;
    address: string;
    city: string;
    zip: string;
    country: string;
    locationCoordinates?: string;
    deliveryLocation: string;
  };
  paymentMethod: string;
  source?: string;
  deliveryRequired?: boolean;
  deliveryProvider?: string | null;
  deliveryAddress?: string | null;
  promoCodeId?: string;
}

export interface PendingCheckoutPayload {
  orderInput: OrderInput;
  subtotal: number;
  shipping: number;
  total: number;
  createdAt: string;
}

const PENDING_CHECKOUT_KEY = "ra_pending_checkout_order";

export async function fetchProducts(filters?: {
  category?: string;
  search?: string;
  page?: number;
  limit?: number;
  newArrival?: boolean;
  newCollection?: boolean;
}): Promise<{ products: ProductApi[]; total: number }> {
  const params = new URLSearchParams();
  if (filters?.category) params.set("category", filters.category);
  if (filters?.search) params.set("search", filters.search);
  if (filters?.page) params.set("page", String(filters.page));
  if (filters?.limit) params.set("limit", String(filters.limit));
  if (filters?.newArrival) params.set("newArrival", "true");
  if (filters?.newCollection) params.set("newCollection", "true");

  const url =
    "/api/products" + (params.toString() ? `?${params.toString()}` : "");

  const res = await apiRequest("GET", url);
  const json = (await res.json()) as { success: boolean; data: ProductApi[]; total: number };
  return { products: json.data ?? [], total: json.total ?? json.data?.length ?? 0 };
}

export async function fetchNewArrivals(): Promise<ProductApi[]> {
  const res = await apiRequest("GET", "/api/products/new-arrivals");
  const json = (await res.json()) as { success: boolean; data: ProductApi[] };
  return json.data ?? [];
}

export async function fetchNewCollection(): Promise<ProductApi[]> {
  const res = await apiRequest("GET", "/api/products/new-collection");
  const json = (await res.json()) as { success: boolean; data: ProductApi[] };
  return json.data ?? [];
}

export async function fetchProductById(id: string): Promise<ProductApi | null> {
  const res = await apiRequest("GET", `/api/products/${id}`);
  const json = (await res.json()) as {
    success: boolean;
    data?: ProductApi;
  };
  return json.data ?? null;
}

export async function fetchHomeFeaturedProducts(): Promise<ProductApi[]> {
  const res = await apiRequest("GET", "/api/products/home-featured");
  const json = (await res.json()) as { success: boolean; data: ProductApi[] };
  return json.data ?? [];
}

export async function fetchPageConfig(previewTemplateId?: string | null) {
  const params = new URLSearchParams();
  if (previewTemplateId) {
    params.set("templateId", previewTemplateId);
  }
  const url = params.toString()
    ? `/api/public/page-config?${params.toString()}`
    : "/api/public/page-config";
  const res = await fetch(url, {
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`Failed to load page config: ${res.status}`);
  }
  return res.json();
}

export interface PaymentQrConfig {
  esewaQrUrl: string;
  khaltiQrUrl: string;
  fonepayQrUrl: string;
}

export async function fetchPaymentQrConfig(): Promise<PaymentQrConfig> {
  const res = await fetch("/api/storefront/payment-qr", {
    credentials: "include",
    cache: "no-store",
  });

  if (!res.ok) {
    throw new Error(`Failed to load payment QR config: ${res.status}`);
  }

  const json = (await res.json()) as { success: boolean; data?: PaymentQrConfig };
  return (
    json.data ?? {
      esewaQrUrl: "/images/esewa-qr.webp",
      khaltiQrUrl:
        "https://blog.khalti.com/wp-content/uploads/2023/03/MPQRCode-HYLEbgp9z64hDoqP9L8ZyQ-pdf.jpg",
      fonepayQrUrl:
        "https://cdn11.bigcommerce.com/s-tgrcca6nho/images/stencil/original/products/65305/136311/Quick-Scan-Pay-Stand-Scan1_136310__37301.1758003923.jpg",
    }
  );
}

export async function fetchCategories(): Promise<CategoryApi[]> {
  const res = await apiRequest("GET", "/api/categories");
  const json = (await res.json()) as { success: boolean; data: CategoryApi[] };
  return json.data;
}

export async function createOrder(data: OrderInput) {
  const res = await apiRequest("POST", "/api/orders", data);
  return (await res.json()) as {
    success: boolean;
    data?: { orderNumber: string; total: number; order: OrderDetail };
    error?: string;
  };
}

export function cachePendingCheckout(payload: PendingCheckoutPayload): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(PENDING_CHECKOUT_KEY, JSON.stringify(payload));
  } catch {
    // Ignore storage write errors (private mode / quota).
  }
}

export function getPendingCheckout(): PendingCheckoutPayload | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(PENDING_CHECKOUT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PendingCheckoutPayload;
    if (!parsed?.orderInput?.items?.length) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function clearPendingCheckout(): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(PENDING_CHECKOUT_KEY);
  } catch {
    // Ignore storage write errors (private mode / quota).
  }
}

export function updatePendingCheckoutPaymentMethod(paymentMethod: string): void {
  const existing = getPendingCheckout();
  if (!existing) return;
  cachePendingCheckout({
    ...existing,
    orderInput: {
      ...existing.orderInput,
      paymentMethod,
    },
  });
}

export interface OrderDetail {
  id: string;
  email: string;
  fullName: string;
  addressLine1: string;
  addressLine2: string | null;
  city: string;
  region: string;
  postalCode: string;
  country: string;
  total: number;
  status: string;
  paymentMethod: string;
  paymentProofUrl: string | null;
  paymentVerified: string | null;
  locationCoordinates: string | null;
  deliveryLocation?: string | null;
  deliveryRequired?: boolean;
  deliveryProvider?: string | null;
  deliveryAddress?: string | null;
  promoCode?: string | null;
  promoDiscountAmount?: number | null;
  createdAt: string | Date;
  items: {
    id: string;
    quantity: number;
    unitPrice: number | string;
    productId: string;
    variantColor?: string | null;
    color?: string | null;
    size?: string | null;
    product?: {
      id: string;
      name: string;
      price: string;
      imageUrl: string | null;
      galleryUrls: string | null;
      category: string | null;
      stock: number;
      colorOptions: string | null;
      sizeOptions: string | null;
    };
  }[];
}

export async function fetchOrderById(id: string): Promise<OrderDetail | null> {
  const res = await fetch(`/api/orders/${id}`, { credentials: "include" });
  if (!res.ok) return null;
  const json = (await res.json()) as { success: boolean; data?: OrderDetail };
  return json.data ?? null;
}

export async function cancelOrder(id: string): Promise<OrderDetail | null> {
  const res = await apiRequest("PATCH", `/api/orders/${id}/cancel`);
  const json = (await res.json()) as { success: boolean; data?: OrderDetail };
  return json.data ?? null;
}

const LAST_ORDER_ID_KEY = "ra_last_order_id";
const LAST_ORDER_CACHE_KEY = "ra_last_order_cache";
const ORDER_HISTORY_CACHE_KEY = "ra_order_history_cache";

function readOrderHistoryCache(): OrderDetail[] {
  if (typeof window === "undefined") return [];
  const raw = localStorage.getItem(ORDER_HISTORY_CACHE_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as OrderDetail[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeOrderHistoryCache(orders: OrderDetail[]): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(ORDER_HISTORY_CACHE_KEY, JSON.stringify(orders.slice(0, 12)));
}

export function cacheLatestOrder(order: OrderDetail): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(LAST_ORDER_ID_KEY, order.id);
  localStorage.setItem(LAST_ORDER_CACHE_KEY, JSON.stringify(order));
  const previous = readOrderHistoryCache().filter((entry) => entry.id !== order.id);
  writeOrderHistoryCache([order, ...previous]);
}

export function getCachedLatestOrder(orderId?: string | null): OrderDetail | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem(LAST_ORDER_CACHE_KEY);
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as OrderDetail;
    if (orderId && parsed.id !== orderId) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function getCachedOrderHistory(): OrderDetail[] {
  return readOrderHistoryCache();
}

export function updateCachedOrder(order: OrderDetail): void {
  if (typeof window === "undefined") return;
  if (localStorage.getItem(LAST_ORDER_ID_KEY) === order.id) {
    localStorage.setItem(LAST_ORDER_CACHE_KEY, JSON.stringify(order));
  }
  const existing = readOrderHistoryCache().filter((entry) => entry.id !== order.id);
  writeOrderHistoryCache([order, ...existing]);
}

export async function uploadPaymentProof(
  orderId: string,
  imageBase64: string,
): Promise<{ success: boolean; error?: string }> {
  const res = await apiRequest("POST", `/api/orders/${orderId}/payment-proof`, {
    imageBase64,
  });
  const json = (await res.json()) as { success: boolean; error?: string };
  return json;
}

export async function updateOrderPaymentMethod(
  orderId: string,
  paymentMethod: "esewa" | "khalti" | "fonepay" | "stripe" | "bank" | "bank_transfer" | "cash_on_delivery",
): Promise<{ success: boolean; error?: string }> {
  const res = await apiRequest("PATCH", `/api/orders/${orderId}/payment-method`, {
    paymentMethod,
  });
  const json = (await res.json()) as { success: boolean; error?: string };
  return json;
}

export async function createCheckoutSession(orderId: string): Promise<{
  success: boolean;
  data?: { sessionId: string; checkoutUrl: string; amountCents: number; rate: number };
  error?: string;
}> {
  const res = await apiRequest("POST", "/api/payments/create-checkout-session", {
    orderId,
  });
  const json = (await res.json()) as {
    success: boolean;
    data?: { sessionId: string; checkoutUrl: string; amountCents: number; rate: number };
    error?: string;
  };
  return json;
}

export async function simulateStripePaymentSuccess(orderId: string): Promise<{
  success: boolean;
  message?: string;
  error?: string;
}> {
  const res = await apiRequest("POST", "/api/payments/dev-simulate-success", {
    orderId,
  });
  const json = (await res.json()) as {
    success: boolean;
    message?: string;
    error?: string;
  };
  return json;
}

export async function validatePromoCode(
  code: string,
  itemProductIds: Array<string | number>,
) {
  const res = await apiRequest("POST", "/api/promo/validate", {
    code,
    items: itemProductIds.map((productId) => ({ productId })),
  });

  return (await res.json()) as {
    valid: boolean;
    reason?: string;
    data?: {
      id: string;
      code: string;
      discountPct: number;
    };
  };
}

export interface PublicBill {
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

export async function fetchPublicBill(billNumber: string): Promise<PublicBill | null> {
  const res = await fetch(`/api/public/bills/${billNumber}`);
  if (!res.ok) return null;
  const json = await res.json();
  return json.data ?? null;
}
