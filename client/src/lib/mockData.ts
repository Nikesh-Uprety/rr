export interface Product {
  id: string;
  name: string;
  sku: string;
  price: number;
  stock: number;
  category: 'Tops' | 'Bottoms' | 'Accessories' | 'Footwear';
  images: string[];
  variants: { size: string; color: string }[];
  description?: string;
}

export const MOCK_PRODUCTS: Product[] = [
  {
    id: "p_1",
    name: "Linen Overshirt",
    sku: "SKU-1024",
    price: 120.00,
    stock: 12,
    category: "Tops",
    images: ["https://images.unsplash.com/photo-1596755094514-f87e34085b2c?auto=format&fit=crop&q=80&w=800"],
    variants: [
      { size: "M", color: "Charcoal" },
      { size: "L", color: "Charcoal" },
      { size: "M", color: "Sand" }
    ],
    description: "A lightweight, breathable overshirt crafted from premium European linen. Perfect for layering."
  },
  {
    id: "p_2",
    name: "Slub Cotton Tee",
    sku: "SKU-0882",
    price: 68.00,
    stock: 34,
    category: "Tops",
    images: ["https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?auto=format&fit=crop&q=80&w=800"],
    variants: [
      { size: "S", color: "Cream" },
      { size: "M", color: "Cream" },
      { size: "L", color: "Black" }
    ],
    description: "An everyday essential with subtle texture and a relaxed drape."
  },
  {
    id: "p_3",
    name: "Deconstructed Blazer",
    sku: "SKU-1156",
    price: 380.00,
    stock: 3,
    category: "Tops",
    images: ["https://images.unsplash.com/photo-1507679799987-c73779587ccf?auto=format&fit=crop&q=80&w=800"],
    variants: [
      { size: "38R", color: "Navy" },
      { size: "40R", color: "Ecru" }
    ],
    description: "A relaxed approach to tailoring with soft shoulders and half-lining."
  },
  {
    id: "p_4",
    name: "Ribbed Modal Longsleeve",
    sku: "SKU-0991",
    price: 95.00,
    stock: 18,
    category: "Tops",
    images: ["https://images.unsplash.com/photo-1618354691373-d851c5c3a990?auto=format&fit=crop&q=80&w=800"],
    variants: [
      { size: "S", color: "White" },
      { size: "M", color: "Onyx" }
    ]
  },
  {
    id: "p_5",
    name: "Pleated Wide Leg Trouser",
    sku: "SKU-2041",
    price: 185.00,
    stock: 8,
    category: "Bottoms",
    images: ["https://images.unsplash.com/photo-1551854716-8b811be39e7e?auto=format&fit=crop&q=80&w=800"],
    variants: [
      { size: "30", color: "Taupe" },
      { size: "32", color: "Black" }
    ]
  },
  {
    id: "p_6",
    name: "Washed Selvedge Denim",
    sku: "SKU-2055",
    price: 210.00,
    stock: 22,
    category: "Bottoms",
    images: ["https://images.unsplash.com/photo-1541099649105-f69ad21f3246?auto=format&fit=crop&q=80&w=800"],
    variants: [
      { size: "31", color: "Vintage Blue" },
      { size: "32", color: "Vintage Blue" }
    ]
  },
  {
    id: "p_7",
    name: "Minimalist Leather Tote",
    sku: "SKU-3012",
    price: 450.00,
    stock: 5,
    category: "Accessories",
    images: ["https://images.unsplash.com/photo-1590874103328-eac38a683ce7?auto=format&fit=crop&q=80&w=800"],
    variants: [
      { size: "OS", color: "Cognac" }
    ]
  }
];

export interface Order {
  id: string;
  orderNumber: string;
  customerName: string;
  customerEmail: string;
  date: string;
  items: number;
  status: 'Pending' | 'Completed' | 'Cancelled';
  amount: number;
}

export const MOCK_ORDERS: Order[] = [
  { id: "o_1", orderNumber: "UX-2025-0042", customerName: "Mia Laurent", customerEmail: "mia.laurent@email.com", date: "Mar 1, 2025", items: 3, status: "Completed", amount: 485.00 },
  { id: "o_2", orderNumber: "UX-2025-0041", customerName: "James Okafor", customerEmail: "james.o@email.com", date: "Mar 1, 2025", items: 1, status: "Pending", amount: 120.00 },
  { id: "o_3", orderNumber: "UX-2025-0040", customerName: "Sofia Reyes", customerEmail: "s.reyes@email.com", date: "Feb 28, 2025", items: 2, status: "Completed", amount: 275.00 },
  { id: "o_4", orderNumber: "UX-2025-0039", customerName: "Luca Marchetti", customerEmail: "luca.m@email.com", date: "Feb 28, 2025", items: 4, status: "Completed", amount: 610.00 },
  { id: "o_5", orderNumber: "UX-2025-0038", customerName: "Amara Diallo", customerEmail: "amara.d@email.com", date: "Feb 27, 2025", items: 1, status: "Cancelled", amount: 68.00 },
  { id: "o_6", orderNumber: "UX-2025-0037", customerName: "Noah Chen", customerEmail: "noah.c@email.com", date: "Feb 27, 2025", items: 2, status: "Completed", amount: 315.00 },
];
