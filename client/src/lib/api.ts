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
  imageUrl: string | null;
  galleryUrls?: string | null;
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
  stockBySize?: Record<string, number>;
  variants?: Array<{
    id: number;
    size: string;
    color: string | null;
    stock: number;
    sku: string | null;
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

export async function fetchProducts(filters?: {
  category?: string;
  search?: string;
  page?: number;
  limit?: number;
}): Promise<ProductApi[]> {
  const params = new URLSearchParams();
  if (filters?.category) params.set("category", filters.category);
  if (filters?.search) params.set("search", filters.search);
  if (filters?.page) params.set("page", String(filters.page));
  if (filters?.limit) params.set("limit", String(filters.limit));

  const url =
    "/api/products" + (params.toString() ? `?${params.toString()}` : "");

  const res = await apiRequest("GET", url);
  const json = (await res.json()) as { success: boolean; data: ProductApi[] };
  return json.data;
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
  const res = await fetch(url, { cache: "force-cache" });
  if (!res.ok) {
    throw new Error(`Failed to load page config: ${res.status}`);
  }
  return res.json();
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

const LAST_ORDER_ID_KEY = "ra_last_order_id";
const LAST_ORDER_CACHE_KEY = "ra_last_order_cache";

export function cacheLatestOrder(order: OrderDetail): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(LAST_ORDER_ID_KEY, order.id);
  localStorage.setItem(LAST_ORDER_CACHE_KEY, JSON.stringify(order));
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
