import { db } from "../server/db";
import { products } from "../shared/schema";
import { eq } from "drizzle-orm";

type ColorImageMap = Record<string, string[]>;

const toJsonArray = (values: string[]) => JSON.stringify(values);

const now = () => new Date();

const TEST_PRODUCTS: Array<{
  name: string;
  category: string;
  price: string;
  costPrice: number;
  sku: string;
  stock: number;
  imageUrl: string;
  galleryUrls: string[];
  colorOptions: string[];
  sizeOptions: string[];
  colorImageMap: ColorImageMap;
}> = [
  {
    name: "Stuffy Test Hoodie",
    category: "Stuffy Test",
    price: "4990",
    costPrice: 2200,
    sku: "STUFFY-HOODIE-001",
    stock: 60,
    imageUrl: "/images/hoodie_left_landscape.webp",
    galleryUrls: ["/images/hoodie_left_landscape.webp", "/images/hoodie_right_landscape.webp"],
    colorOptions: ["Black", "Sky Blue"],
    sizeOptions: ["S", "M", "L", "XL"],
    colorImageMap: {
      Black: ["/images/hoodie_left_landscape.webp", "/images/hoodie_right_landscape.webp"],
      "Sky Blue": ["/images/feature1.webp", "/images/feature2.webp"],
    },
  },
  {
    name: "Stuffy Test Tee",
    category: "Stuffy Test",
    price: "2490",
    costPrice: 900,
    sku: "STUFFY-TEE-001",
    stock: 140,
    imageUrl: "/images/feature3.webp",
    galleryUrls: ["/images/feature3.webp", "/images/concept.webp"],
    colorOptions: ["White", "Rose"],
    sizeOptions: ["S", "M", "L", "XL"],
    colorImageMap: {
      White: ["/images/feature3.webp", "/images/concept.webp"],
      Rose: ["/images/explore.webp", "/images/feature_premium_1.webp"],
    },
  },
  {
    name: "Stuffy Test Jacket",
    category: "Stuffy Test",
    price: "7990",
    costPrice: 3900,
    sku: "STUFFY-JACKET-001",
    stock: 25,
    imageUrl: "/images/maison-nocturne-hero-1.webp",
    galleryUrls: ["/images/maison-nocturne-hero-1.webp", "/images/home-campaign-editorial.webp"],
    colorOptions: ["Charcoal", "Gold"],
    sizeOptions: ["S", "M", "L", "XL"],
    colorImageMap: {
      Charcoal: ["/images/maison-nocturne-hero-1.webp", "/images/home-campaign-editorial.webp"],
      Gold: ["/images/collection-banner.png", "/images/landingpage3.webp"],
    },
  },
  {
    name: "Stuffy Test Pants",
    category: "Stuffy Test",
    price: "3590",
    costPrice: 1400,
    sku: "STUFFY-PANTS-001",
    stock: 72,
    imageUrl: "/images/about.webp",
    galleryUrls: ["/images/about.webp", "/images/explore.webp"],
    colorOptions: ["Beige", "Olive"],
    sizeOptions: ["28", "30", "32", "34"],
    colorImageMap: {
      Beige: ["/images/about.webp", "/images/explore.webp"],
      Olive: ["/images/feature2.webp", "/images/feature3.webp"],
    },
  },
  {
    name: "Stuffy Test Cap",
    category: "Stuffy Test",
    price: "1290",
    costPrice: 450,
    sku: "STUFFY-CAP-001",
    stock: 100,
    imageUrl: "/images/collection-banner.png",
    galleryUrls: ["/images/collection-banner.png", "/images/landingpage3.webp"],
    colorOptions: ["Navy", "Red"],
    sizeOptions: ["One Size"],
    colorImageMap: {
      Navy: ["/images/collection-banner.png", "/images/landingpage3.webp"],
      Red: ["/images/feature1.webp", "/images/feature_premium_1.webp"],
    },
  },
  {
    name: "Stuffy Test Shorts",
    category: "Stuffy Test",
    price: "2190",
    costPrice: 820,
    sku: "STUFFY-SHORTS-001",
    stock: 66,
    imageUrl: "/images/feature1.webp",
    galleryUrls: ["/images/feature1.webp", "/images/feature2.webp"],
    colorOptions: ["Mint", "Orange"],
    sizeOptions: ["S", "M", "L", "XL"],
    colorImageMap: {
      Mint: ["/images/feature1.webp", "/images/feature2.webp"],
      Orange: ["/images/feature3.webp", "/images/explore.webp"],
    },
  },
  {
    name: "Stuffy Test Socks",
    category: "Stuffy Test",
    price: "490",
    costPrice: 120,
    sku: "STUFFY-SOCKS-001",
    stock: 250,
    imageUrl: "/images/explore.webp",
    galleryUrls: ["/images/explore.webp", "/images/about.webp"],
    colorOptions: ["Grey", "Lavender"],
    sizeOptions: ["Free"],
    colorImageMap: {
      Grey: ["/images/explore.webp", "/images/about.webp"],
      Lavender: ["/images/feature_premium_1.webp", "/images/maison-nocturne-hero-1.webp"],
    },
  },
  {
    name: "Stuffy Test Bag",
    category: "Stuffy Test",
    price: "2890",
    costPrice: 1100,
    sku: "STUFFY-BAG-001",
    stock: 44,
    imageUrl: "/images/home-campaign-editorial.webp",
    galleryUrls: ["/images/home-campaign-editorial.webp", "/images/maison-nocturne-hero-1.webp"],
    colorOptions: ["Brown", "Teal"],
    sizeOptions: ["One Size"],
    colorImageMap: {
      Brown: ["/images/home-campaign-editorial.webp", "/images/maison-nocturne-hero-1.webp"],
      Teal: ["/images/feature2.webp", "/images/feature1.webp"],
    },
  },
];

async function main() {
  console.log(`Seeding ${TEST_PRODUCTS.length} Stuffy test products...`);

  for (const item of TEST_PRODUCTS) {
    const values = {
      name: item.name,
      category: item.category,
      price: item.price,
      costPrice: item.costPrice,
      sku: item.sku,
      stock: item.stock,
      imageUrl: item.imageUrl,
      galleryUrls: toJsonArray(item.galleryUrls),
      colorOptions: toJsonArray(item.colorOptions),
      sizeOptions: toJsonArray(item.sizeOptions),
      colorImageMap: item.colorImageMap,
      isActive: true,
      updatedAt: now(),
    };

    // Name is unique so it's a stable upsert target.
    await db
      .insert(products)
      .values({
        ...values,
        createdAt: now(),
      })
      .onConflictDoUpdate({
        target: products.name,
        set: values,
      });

    console.log(`✓ Upserted ${item.name}`);
  }

  console.log("Done.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
