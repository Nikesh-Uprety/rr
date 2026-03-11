import "dotenv/config";
import bcrypt from "bcryptjs";
import fs from "node:fs/promises";
import path from "node:path";
import { db } from "./db";
import { customers, orders, orderItems, products, users } from "@shared/schema";
import { MOCK_PRODUCTS } from "../client/src/lib/mockData";

interface CsvRow {
  slug: string;
  product_name: string;
  variant_name: string;
  color: string;
  color_hex: string;
  price: string;
  category: string;
  collection: string;
  sizes: string;
  in_stock: string;
  image_1: string;
  image_2: string;
  image_3: string;
  image_4: string;
  image_5: string;
  description: string;
}

interface AggregatedProduct {
  name: string;
  price: number;
  stock: number;
  category: string;
  description: string;
}

function parseCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === "," && !inQuotes) {
      result.push(current);
      current = "";
    } else {
      current += char;
    }
  }

  result.push(current);
  return result.map((v) => v.trim());
}

async function loadProductsFromCsv(): Promise<AggregatedProduct[]> {
  const whitelist = new Set<string>([
    "TWO-WAY ZIP HOODIE",
    "ESSENTIAL HOODIE",
    "ESSENTIAL SWEATPANTS",
    "DUAL ZIP HOODIE",
    "SUEDE QUARTER ZIP",
    "SUEDE 1/2 ZIP",
    "MID WEIGHT FLEECE JACKET",
    "CREW SWEATSHIRT",
    "COLLAR POLO",
    "WIDE RIB QUARTER PULLOVER",
  ]);

  const explicitPath = process.env.PRODUCTS_CSV_PATH;
  const defaultPath = path.join(process.cwd(), "rare_np_products.csv");
  const csvPath = explicitPath && explicitPath.length > 0 ? explicitPath : defaultPath;

  const raw = await fs.readFile(csvPath, "utf8");
  const lines = raw.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length <= 1) return [];

  const headerCells = parseCsvLine(lines[0]);
  const indexOf = (name: string) => headerCells.indexOf(name);

  const iSlug = indexOf("slug");
  const iProductName = indexOf("product_name");
  const iPrice = indexOf("price");
  const iCategory = indexOf("category");
  const iInStock = indexOf("in_stock");
  const iDesc = indexOf("description");

  if (
    iSlug === -1 ||
    iProductName === -1 ||
    iPrice === -1 ||
    iCategory === -1 ||
    iInStock === -1
  ) {
    throw new Error("CSV missing required columns");
  }

  const rows: CsvRow[] = lines.slice(1).map((line) => {
    const cells = parseCsvLine(line);
    const safe = (idx: number) => (idx >= 0 && idx < cells.length ? cells[idx] : "");

    return {
      slug: safe(iSlug),
      product_name: safe(iProductName),
      variant_name: "",
      color: "",
      color_hex: "",
      price: safe(iPrice),
      category: safe(iCategory),
      collection: "",
      sizes: "",
      in_stock: safe(iInStock),
      image_1: "",
      image_2: "",
      image_3: "",
      image_4: "",
      image_5: "",
      description: iDesc === -1 ? "" : safe(iDesc),
    };
  });

  const byProduct = new Map<string, CsvRow[]>();
  for (const row of rows) {
    const baseName = row.product_name.trim();
    if (!whitelist.has(baseName)) continue;
    if (!byProduct.has(baseName)) {
      byProduct.set(baseName, []);
    }
    byProduct.get(baseName)!.push(row);
  }

  const aggregated: AggregatedProduct[] = [];

  const entries = Array.from(byProduct.entries());
  for (const [name, group] of entries) {
    const first = group[0];
    const price = Number.parseFloat(first.price || "0") || 0;

    const inStockCount = group.filter((r: CsvRow) => {
      const value = r.in_stock.toLowerCase();
      return value === "true" || value === "1" || value === "yes";
    }).length;

    const stock = inStockCount * 10;

    aggregated.push({
      name,
      price,
      stock,
      category: first.category || "UNASSIGNED",
      description: first.description || "",
    });
  }

  return aggregated;
}

async function main() {
  // Clear tables in order to avoid FK issues
  await db.delete(orderItems);
  await db.delete(orders);
  await db.delete(customers);
  await db.delete(products);
  await db.delete(users);

  // Seed users
  const adminPassword = await bcrypt.hash("admin123", 10);
  const staffPassword = await bcrypt.hash("staff123", 10);

  await db.insert(users).values([
    {
      username: "admin@rare.np",
      password: adminPassword,
      role: "admin",
    },
    {
      username: "staff@rare.np",
      password: staffPassword,
      role: "staff",
    },
  ]);

  // Seed products from CSV (10 real product families)
  try {
    const csvProducts = await loadProductsFromCsv();
    if (csvProducts.length > 0) {
      await db.insert(products).values(
        csvProducts.map((p) => ({
          name: p.name,
          price: p.price.toString(),
          stock: p.stock,
          category: p.category,
          description: p.description,
        })),
      );
    } else {
      console.warn(
        "CSV loaded but no matching product families were found. Skipping product seed.",
      );
    }
  } catch (err) {
    console.error(
      "Failed to seed products from CSV, falling back to default mock products.",
      err,
    );

    const productDefs = [
      {
        name: "Linen Overshirt",
        sku: "SKU-1024",
        price: 120,
        stock: 12,
        category: "TOPS",
        variants: ["Charcoal", "Sand"],
      },
      {
        name: "Slub Cotton Tee",
        sku: "SKU-0882",
        price: 68,
        stock: 34,
        category: "TOPS",
        variants: ["Cream", "Black", "Olive"],
      },
      {
        name: "Deconstructed Blazer",
        sku: "SKU-1156",
        price: 380,
        stock: 3,
        category: "TOPS",
        variants: ["Navy", "Ecru"],
      },
      {
        name: "Ribbed Modal Longsleeve",
        sku: "SKU-0991",
        price: 95,
        stock: 18,
        category: "TOPS",
        variants: ["White", "Onyx"],
      },
      {
        name: "Wide Leg Trousers",
        sku: "SKU-0774",
        price: 195,
        stock: 8,
        category: "BOTTOMS",
        variants: ["Ecru", "Slate"],
      },
      {
        name: "Tailored Shorts",
        sku: "SKU-0653",
        price: 115,
        stock: 22,
        category: "BOTTOMS",
        variants: ["Khaki", "Black"],
      },
      {
        name: "Merino Turtleneck",
        sku: "SKU-1089",
        price: 155,
        stock: 0,
        category: "TOPS",
        variants: ["Ivory", "Mocha"],
      },
      {
        name: "Canvas Tote",
        sku: "SKU-0442",
        price: 85,
        stock: 45,
        category: "ACCESSORIES",
        variants: ["Natural", "Black"],
      },
      {
        name: "Leather Card Holder",
        sku: "SKU-0318",
        price: 45,
        stock: 30,
        category: "ACCESSORIES",
        variants: ["Tan", "Onyx"],
      },
    ];

    await db.insert(products).values(
      productDefs.map((p) => ({
        name: p.name,
        price: p.price.toString(),
        stock: p.stock,
        category: p.category,
        description: `SKU: ${p.sku} • Variants: ${p.variants.join(", ")}`,
      })),
    );
  }

  // Seed detailed products that power the storefront & admin panel
  await db.insert(products).values(
    MOCK_PRODUCTS.map((p) => ({
      name: p.name,
      price: p.price.toString(),
      stock: p.stock,
      category: p.category,
      description: p.description ?? null,
      imageUrl: p.images[0] ?? null,
    })),
  );

  // Seed customers
  const insertedCustomers = await db
    .insert(customers)
    .values([
      {
        firstName: "Mia",
        lastName: "Laurent",
        email: "mia.laurent@email.com",
        totalSpent: "2140",
        orderCount: 6,
        avatarColor: "#2D4A35",
      },
      {
        firstName: "James",
        lastName: "Okafor",
        email: "james.o@email.com",
        totalSpent: "1220",
        orderCount: 4,
        avatarColor: "#2D3A5A",
      },
      {
        firstName: "Sofia",
        lastName: "Reyes",
        email: "s.reyes@email.com",
        totalSpent: "840",
        orderCount: 3,
        avatarColor: "#7A2D35",
      },
      {
        firstName: "Luca",
        lastName: "Marchetti",
        email: "luca.m@email.com",
        totalSpent: "3890",
        orderCount: 11,
        avatarColor: "#5A4A2D",
      },
      {
        firstName: "Amara",
        lastName: "Diallo",
        email: "amara.d@email.com",
        totalSpent: "68",
        orderCount: 1,
        avatarColor: "#2D5A55",
      },
      {
        firstName: "Noah",
        lastName: "Chen",
        email: "noah.c@email.com",
        totalSpent: "1540",
        orderCount: 5,
        avatarColor: "#3A3A3A",
      },
      {
        firstName: "Isla",
        lastName: "Kim",
        email: "isla.k@email.com",
        totalSpent: "920",
        orderCount: 3,
        avatarColor: "#4A2D5A",
      },
    ])
    .returning();

  const customerByFullName = new Map<string, (typeof insertedCustomers)[number]>();
  for (const c of insertedCustomers) {
    customerByFullName.set(`${c.firstName} ${c.lastName}`, c);
  }

  // Seed orders (basic linkage via customer email/fullName)
  const orderDefs = [
    {
      orderNumber: "UX-2025-0042",
      customerName: "Mia Laurent",
      status: "completed",
      subtotal: 450,
      tax: 35,
      total: 485,
      items: 3,
    },
    {
      orderNumber: "UX-2025-0041",
      customerName: "James Okafor",
      status: "pending",
      subtotal: 110,
      tax: 10,
      total: 120,
      items: 1,
    },
    {
      orderNumber: "UX-2025-0040",
      customerName: "Sofia Reyes",
      status: "completed",
      subtotal: 250,
      tax: 25,
      total: 275,
      items: 2,
    },
    {
      orderNumber: "UX-2025-0039",
      customerName: "Luca Marchetti",
      status: "completed",
      subtotal: 560,
      tax: 50,
      total: 610,
      items: 4,
    },
    {
      orderNumber: "UX-2025-0038",
      customerName: "Amara Diallo",
      status: "cancelled",
      subtotal: 62,
      tax: 6,
      total: 68,
      items: 1,
    },
    {
      orderNumber: "UX-2025-0037",
      customerName: "Noah Chen",
      status: "completed",
      subtotal: 285,
      tax: 30,
      total: 315,
      items: 2,
    },
  ];

  await db.insert(orders).values(
    orderDefs.map((o) => {
      const customer = customerByFullName.get(o.customerName);

      return {
        userId: null,
        email: customer?.email ?? "",
        fullName: o.customerName,
        addressLine1: "Seed Address Line 1",
        addressLine2: null,
        city: "Kathmandu",
        region: "Bagmati",
        postalCode: "00000",
        country: "NP",
        total: o.total.toString(),
        status: o.status,
      };
    }),
  );
}

main()
  .then(() => {
    console.log("Database seeded successfully.");
    process.exit(0);
  })
  .catch((err) => {
    console.error("Error seeding database:", err);
    process.exit(1);
  });

