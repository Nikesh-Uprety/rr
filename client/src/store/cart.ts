import { create } from 'zustand';
import { Product } from '@/lib/mockData';

export interface CartItem {
  id: string;
  product: Product;
  variant: { size: string; color: string };
  quantity: number;
}

interface CartState {
  items: CartItem[];
  addItem: (product: Product, variant: { size: string; color: string }, quantity?: number) => void;
  removeItem: (id: string) => void;
  updateQuantity: (id: string, quantity: number) => void;
  clearCart: () => void;
  get subtotal(): number;
}

export const useCartStore = create<CartState>((set, get) => ({
  items: [],
  addItem: (product, variant, quantity = 1) => {
    set((state) => {
      // Create a unique ID based on product and variant
      const cartItemId = `${product.id}-${variant.size}-${variant.color}`;
      
      const existingItem = state.items.find(item => item.id === cartItemId);
      if (existingItem) {
        return {
          items: state.items.map(item =>
            item.id === cartItemId
              ? { ...item, quantity: item.quantity + quantity }
              : item
          )
        };
      }
      
      return {
        items: [...state.items, { id: cartItemId, product, variant, quantity }]
      };
    });
  },
  removeItem: (id) => {
    set((state) => ({
      items: state.items.filter(item => item.id !== id)
    }));
  },
  updateQuantity: (id, quantity) => {
    set((state) => ({
      items: state.items.map(item =>
        item.id === id ? { ...item, quantity: Math.max(1, quantity) } : item
      )
    }));
  },
  clearCart: () => set({ items: [] }),
  get subtotal() {
    return get().items.reduce((total, item) => total + (item.product.price * item.quantity), 0);
  }
}));
