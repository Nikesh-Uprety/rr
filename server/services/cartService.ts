import { redis } from "../redis";

const CART_PREFIX = "rarenp:cart:";
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
};
