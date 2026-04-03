import { create } from 'zustand';
import { createJSONStorage, persist, type StateStorage } from 'zustand/middleware';
import { Product } from '@/lib/mockData';
import { apiRequest } from '@/lib/queryClient';

const GUEST_ID_KEY = 'ra-guest-id';
const GUEST_ID_COOKIE = 'ra_guest_id';
const CART_ITEMS_KEY = 'ra-guest-cart-items';
const GUEST_ID_MAX_AGE_SECONDS = 60 * 60 * 24 * 7;

export interface CartProduct {
  id: string;
  name: string;
  sku: string;
  price: number;
  originalPrice?: number | null;
  salePercentage?: number | null;
  saleActive?: boolean | null;
  stock: number;
  category: string;
  images: string[];
  variants: { id?: number; size: string; color: string }[];
  description?: string;
}

export interface CartItem {
  id: string;
  product: CartProduct;
  variant: { id?: number; size: string; color: string };
  quantity: number;
}

function normalizeCartProduct(product: Partial<Product> & Record<string, any>): CartProduct {
  const images = Array.isArray(product.images)
    ? product.images.filter((image): image is string => typeof image === 'string' && image.length > 0)
    : [];
  const variants = Array.isArray(product.variants)
    ? product.variants
        .filter((variant): variant is { id?: number; size: string; color: string } =>
          Boolean(variant) && typeof variant.size === 'string' && typeof variant.color === 'string',
        )
        .map((variant) => ({
          id: typeof variant.id === 'number' ? variant.id : undefined,
          size: variant.size,
          color: variant.color,
        }))
    : [];

  return {
    id: String(product.id ?? ''),
    name: String(product.name ?? ''),
    sku: String(product.sku ?? ''),
    price: Number(product.price ?? 0),
    originalPrice:
      product.originalPrice === null || product.originalPrice === undefined
        ? null
        : Number(product.originalPrice),
    salePercentage:
      product.salePercentage === null || product.salePercentage === undefined
        ? null
        : Number(product.salePercentage),
    saleActive: Boolean(product.saleActive),
    stock: Number(product.stock ?? 0),
    category: String(product.category ?? ''),
    images,
    variants,
    description: typeof product.description === 'string' ? product.description : undefined,
  };
}

function getUnitOriginalPrice(product: Product): number {
  const currentPrice = Number(product.price);
  const explicitOriginalPrice = Number(product.originalPrice);

  if (Number.isFinite(explicitOriginalPrice) && explicitOriginalPrice > currentPrice) {
    return explicitOriginalPrice;
  }

  const salePercentage = Number(product.salePercentage);
  if (
    Boolean(product.saleActive) &&
    Number.isFinite(salePercentage) &&
    salePercentage > 0 &&
    salePercentage < 100 &&
    currentPrice > 0
  ) {
    return currentPrice / (1 - salePercentage / 100);
  }

  return currentPrice;
}

const memoryStorage = new Map<string, string>();

function resolveBrowserStorage(): StateStorage {
  if (typeof window === 'undefined') {
    return {
      getItem: (name) => memoryStorage.get(name) ?? null,
      setItem: (name, value) => {
        memoryStorage.set(name, value);
      },
      removeItem: (name) => {
        memoryStorage.delete(name);
      },
    };
  }

  const storageCandidates = [window.localStorage, window.sessionStorage];

  for (const candidate of storageCandidates) {
    try {
      const probeKey = '__ra_cart_probe__';
      candidate.setItem(probeKey, '1');
      candidate.removeItem(probeKey);
      return candidate;
    } catch {
      // Try the next storage option.
    }
  }

  return {
    getItem: (name) => memoryStorage.get(name) ?? null,
    setItem: (name, value) => {
      memoryStorage.set(name, value);
    },
    removeItem: (name) => {
      memoryStorage.delete(name);
    },
  };
}

function readBrowserStorageItem(key: string): string | null {
  if (typeof window === 'undefined') return memoryStorage.get(key) ?? null;

  try {
    return window.localStorage.getItem(key);
  } catch {
    return memoryStorage.get(key) ?? null;
  }
}

function readCookie(name: string): string | null {
  if (typeof document === 'undefined') return null;

  const target = `${name}=`;
  const entry = document.cookie
    .split(';')
    .map((part) => part.trim())
    .find((part) => part.startsWith(target));

  if (!entry) return null;
  return decodeURIComponent(entry.slice(target.length));
}

function writeCookie(name: string, value: string, maxAgeSeconds: number): void {
  if (typeof document === 'undefined') return;

  document.cookie = [
    `${name}=${encodeURIComponent(value)}`,
    'Path=/',
    'SameSite=Lax',
    `Max-Age=${maxAgeSeconds}`,
  ].join('; ');
}

function writeBrowserStorageItem(key: string, value: string): void {
  if (typeof window === 'undefined') {
    memoryStorage.set(key, value);
    return;
  }

  try {
    window.localStorage.setItem(key, value);
  } catch {
    memoryStorage.set(key, value);
  }
}

function removeBrowserStorageItem(key: string): void {
  if (typeof window === 'undefined') {
    memoryStorage.delete(key);
    return;
  }

  try {
    window.localStorage.removeItem(key);
  } catch {
    memoryStorage.delete(key);
  }
}

function normalizeCartVariant(variant: unknown): { id?: number; size: string; color: string } {
  const raw = (variant ?? {}) as Record<string, unknown>;
  return {
    id: typeof raw.id === 'number' ? raw.id : undefined,
    size: typeof raw.size === 'string' && raw.size.trim() ? raw.size : 'One Size',
    color: typeof raw.color === 'string' && raw.color.trim() ? raw.color : 'Default',
  };
}

export function normalizeCartItems(items: unknown): CartItem[] {
  if (!Array.isArray(items)) return [];

  return items
    .filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === 'object')
    .map((item) => {
      const variant = normalizeCartVariant(item.variant);
      const product = normalizeCartProduct((item.product ?? {}) as Partial<Product> & Record<string, any>);
      return {
        id: String(item.id ?? `${product.id}-${variant.size}-${variant.color}`),
        product,
        variant,
        quantity: Math.max(1, Number(item.quantity ?? 1)),
      };
    })
    .filter((item) => item.product.id.length > 0);
}

function readCartItemsFromLocalStorage(): CartItem[] {
  const raw = readBrowserStorageItem(CART_ITEMS_KEY);
  if (!raw) return [];

  try {
    return normalizeCartItems(JSON.parse(raw));
  } catch {
    return [];
  }
}

function writeCartItemsToLocalStorage(items: CartItem[]): void {
  writeBrowserStorageItem(CART_ITEMS_KEY, JSON.stringify(items));
}

export function getOrCreateGuestId(): string | null {
  if (typeof window === 'undefined') return null;

  const existing = readBrowserStorageItem(GUEST_ID_KEY);
  if (existing) return existing;

  const cookieFallback = readCookie(GUEST_ID_COOKIE);
  if (cookieFallback) {
    writeBrowserStorageItem(GUEST_ID_KEY, cookieFallback);
    return cookieFallback;
  }

  const generated =
    typeof window.crypto?.randomUUID === 'function'
      ? window.crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  writeBrowserStorageItem(GUEST_ID_KEY, generated);
  writeCookie(GUEST_ID_COOKIE, generated, GUEST_ID_MAX_AGE_SECONDS);
  return generated;
}

async function syncGuestCartToServer(guestId: string | null, items: CartItem[]): Promise<void> {
  if (!guestId) return;

  try {
    await apiRequest('POST', '/api/cart/guest/sync', { guestId, items });
  } catch {
    // Local cart stays authoritative when network sync fails.
  }
}

async function fetchGuestCartFromServer(guestId: string | null): Promise<{ found: boolean; items: CartItem[] }> {
  if (!guestId) return { found: false, items: [] };

  try {
    const response = await fetch(`/api/cart/guest/${guestId}`, {
      method: 'GET',
      credentials: 'include',
      cache: 'no-store',
      headers: {
        'Cache-Control': 'no-store',
        Pragma: 'no-cache',
      },
    });
    if (!response.ok) {
      throw new Error(`Failed to load guest cart: ${response.status}`);
    }
    const payload = (await response.json()) as {
      success: boolean;
      found?: boolean;
      items?: unknown;
    };

    return {
      found: Boolean(payload.found),
      items: normalizeCartItems(payload.items),
    };
  } catch {
    return { found: false, items: [] };
  }
}

function persistGuestCartSnapshot(items: CartItem[]): void {
  writeCartItemsToLocalStorage(items);
  void syncGuestCartToServer(getOrCreateGuestId(), items);
}

export interface CartState {
  items: CartItem[];
  isCartSidebarOpen: boolean;
  hasHydrated: boolean;
  addItem: (product: CartProduct, variant: { id?: number; size: string; color: string }, quantity?: number) => void;
  removeItem: (id: string) => void;
  updateQuantity: (id: string, quantity: number) => void;
  clearCart: () => void;
  openCartSidebar: () => void;
  closeCartSidebar: () => void;
  toggleCartSidebar: () => void;
  setHasHydrated: (value: boolean) => void;
  get subtotal(): number;
  get originalSubtotal(): number;
  get productDiscountTotal(): number;
}

export const useCartStore = create<CartState>()(
  persist(
    (set, get) => ({
      items: [],
      isCartSidebarOpen: false,
      hasHydrated: false,
      setHasHydrated: (value) => set({ hasHydrated: value }),
      addItem: (product, variant, quantity = 1) => {
        let shouldNotify = false;
        let notifyPayload: {
          action: "add" | "update" | "remove";
          productName: string;
          size?: string;
          color?: string;
          quantity?: number;
        } | null = null;
        let nextItems: CartItem[] = [];

        set((state) => {
          const normalizedProduct = normalizeCartProduct(product);
          const normalizedVariant = normalizeCartVariant(variant);
          const cartItemId = `${normalizedProduct.id}-${normalizedVariant.size}-${normalizedVariant.color}`;

          const existingItem = state.items.find(item => item.id === cartItemId);
          if (existingItem) {
            shouldNotify = true;
            notifyPayload = {
              action: "update",
              productName: normalizedProduct.name,
              size: normalizedVariant.size,
              color: normalizedVariant.color,
              quantity: existingItem.quantity + quantity,
            };
            nextItems = state.items.map(item =>
              item.id === cartItemId
                ? { ...item, quantity: item.quantity + quantity }
                : item,
            );
            return { items: nextItems };
          }

          shouldNotify = true;
          notifyPayload = {
            action: "add",
            productName: normalizedProduct.name,
            size: normalizedVariant.size,
            color: normalizedVariant.color,
            quantity,
          };
          nextItems = [
            ...state.items,
            { id: cartItemId, product: normalizedProduct, variant: normalizedVariant, quantity },
          ];
          return { items: nextItems };
        });

        persistGuestCartSnapshot(nextItems);

        if (shouldNotify && notifyPayload) {
          void apiRequest("POST", "/api/user-activity/cart", notifyPayload).catch(() => {
            // Don't block cart UX if notifications fail.
          });
        }
      },
      removeItem: (id) => {
        let target: CartItem | undefined;
        let nextItems: CartItem[] = [];
        set((state) => {
          nextItems = state.items.filter((item) => {
            if (item.id === id) target = item;
            return item.id !== id;
          });
          return { items: nextItems };
        });

        persistGuestCartSnapshot(nextItems);

        if (target) {
          void apiRequest("POST", "/api/user-activity/cart", {
            action: "remove",
            productName: target.product.name,
            size: target.variant.size,
            color: target.variant.color,
            quantity: target.quantity,
          }).catch(() => {
            // Don't block cart UX if notifications fail.
          });
        }
      },
      updateQuantity: (id, quantity) => {
        let target: CartItem | undefined;
        let nextItems: CartItem[] = [];
        set((state) => {
          nextItems = state.items.map((item) => {
            if (item.id !== id) return item;
            target = item;
            return { ...item, quantity: Math.max(1, quantity) };
          });
          return { items: nextItems };
        });

        persistGuestCartSnapshot(nextItems);

        if (target) {
          void apiRequest("POST", "/api/user-activity/cart", {
            action: "update",
            productName: target.product.name,
            size: target.variant.size,
            color: target.variant.color,
            quantity: Math.max(1, quantity),
          }).catch(() => {
            // Don't block cart UX if notifications fail.
          });
        }
      },
      clearCart: () => {
        set({ items: [] });
        persistGuestCartSnapshot([]);
      },
      openCartSidebar: () => set({ isCartSidebarOpen: true }),
      closeCartSidebar: () => set({ isCartSidebarOpen: false }),
      toggleCartSidebar: () =>
        set((state) => ({ isCartSidebarOpen: !state.isCartSidebarOpen })),
      get subtotal() {
        return get().items.reduce((total, item) => total + (item.product.price * item.quantity), 0);
      },
      get originalSubtotal() {
        return get().items.reduce(
          (total, item) => total + getUnitOriginalPrice(item.product) * item.quantity,
          0,
        );
      },
      get productDiscountTotal() {
        return Math.max(0, get().originalSubtotal - get().subtotal);
      },
    }),
    {
      name: "ra-cart",
      storage: createJSONStorage(resolveBrowserStorage),
      partialize: (state) => ({ isCartSidebarOpen: state.isCartSidebarOpen }),
      version: 3,
      migrate: (persistedState: any) => {
        return {
          isCartSidebarOpen: Boolean(persistedState?.isCartSidebarOpen),
        };
      },
      merge: (persistedState, currentState) => {
        const mergedState = Object.create(Object.getPrototypeOf(currentState));
        Object.defineProperties(mergedState, Object.getOwnPropertyDescriptors(currentState));

        if (persistedState && typeof persistedState === 'object') {
          Object.entries(persistedState).forEach(([key, value]) => {
            Object.defineProperty(mergedState, key, {
              configurable: true,
              enumerable: true,
              writable: true,
              value,
            });
          });
        }

        return mergedState as CartState;
      },
      onRehydrateStorage: () => (state, error) => {
        if (error) {
          console.error('Failed to rehydrate cart store', error);
        }
        state?.setHasHydrated(false);
      },
    },
  ),
);

export async function initializeGuestCart(): Promise<void> {
  if (typeof window === 'undefined') return;

  const guestId = getOrCreateGuestId();
  const localItems = readCartItemsFromLocalStorage();

  try {
    const remoteCart = await fetchGuestCartFromServer(guestId);
    if (remoteCart.found) {
      useCartStore.setState({ items: remoteCart.items, hasHydrated: true });
      writeCartItemsToLocalStorage(remoteCart.items);
      return;
    }

    useCartStore.setState({ items: localItems, hasHydrated: true });
    if (localItems.length > 0) {
      void syncGuestCartToServer(guestId, localItems);
    }
  } catch {
    useCartStore.setState({ items: localItems, hasHydrated: true });
  }
}

if (typeof window !== 'undefined') {
  void initializeGuestCart();
}
