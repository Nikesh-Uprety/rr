import { redis } from "../redis";

const CART_PREFIX = "rarenp:cart:";
const GUEST_CART_PREFIX = "guest:";
const DEFAULT_EXPIRY = 60 * 60 * 24 * 7; // 7 days

export interface CartItem {
  productId: string;
  variantId?: number | null;
  size?: string;
  color?: string;
  quantity: number;
}

export interface Cart {
  items: CartItem[];
  updatedAt: string;
}

export interface GuestCartVariant {
  id?: number;
  size: string;
  color: string;
}

export interface GuestCartProduct {
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
  variants: GuestCartVariant[];
  description?: string;
}

export interface GuestCartItem {
  id: string;
  product: GuestCartProduct;
  variant: GuestCartVariant;
  quantity: number;
}

export interface GuestCart {
  items: GuestCartItem[];
  updatedAt: string;
}

function guestCartKey(guestId: string): string {
  return `${GUEST_CART_PREFIX}${guestId}:cart`;
}

export const cartService = {
  /**
   * Save cart for a session or user
   */
  async saveCart(id: string, cart: Cart): Promise<void> {
    const key = `${CART_PREFIX}${id}`;
    await redis.set(key, JSON.stringify(cart), "EX", DEFAULT_EXPIRY);
  },

  /**
   * Get cart for a session or user
   */
  async getCart(id: string): Promise<Cart | null> {
    const key = `${CART_PREFIX}${id}`;
    const data = await redis.get(key);
    if (!data) return null;
    try {
      return JSON.parse(data);
    } catch (err) {
      console.error("Failed to parse cart from Redis:", err);
      return null;
    }
  },

  /**
   * Clear cart
   */
  async deleteCart(id: string): Promise<void> {
    const key = `${CART_PREFIX}${id}`;
    await redis.del(key);
  },

  async saveGuestCart(guestId: string, items: GuestCartItem[]): Promise<void> {
    const payload: GuestCart = {
      items,
      updatedAt: new Date().toISOString(),
    };
    await redis.set(guestCartKey(guestId), JSON.stringify(payload), "EX", DEFAULT_EXPIRY);
  },

  async getGuestCart(guestId: string): Promise<GuestCart | null> {
    const data = await redis.get(guestCartKey(guestId));
    if (!data) return null;

    try {
      return JSON.parse(data) as GuestCart;
    } catch (err) {
      console.error("Failed to parse guest cart from Redis:", err);
      return null;
    }
  },
};
