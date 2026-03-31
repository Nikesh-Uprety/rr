import "dotenv/config";
import { db } from "../db";
import { products } from "@shared/schema";
import { meiliClient, PRODUCT_INDEX, initMeiliSearch } from "../lib/meilisearch";

async function syncProducts() {
  if (!meiliClient) {
    console.error("MeiliSearch client not initialized. Check your .env file.");
    process.exit(1);
  }

  console.log("Starting MeiliSearch synchronization...");

  try {
    // 1. Initialize settings
    await initMeiliSearch();

    // 2. Fetch all products from DB
    const allProducts = await db.select().from(products);
    console.log(`Fetched ${allProducts.length} products from database.`);

    // 3. Prepare documents for MeiliSearch
    const documents = allProducts.map((p) => ({
      id: p.id,
      name: p.name,
      shortDetails: p.shortDetails,
      description: p.description,
      price: parseFloat(p.price.toString()),
      imageUrl: p.imageUrl,
      category: p.category,
      stock: p.stock,
      saleActive: p.saleActive,
      salePercentage: p.salePercentage,
      createdAt: p.createdAt ? new Date(p.createdAt).getTime() : Date.now(),
    }));

    // 4. Push to MeiliSearch
    const index = meiliClient.index(PRODUCT_INDEX);
    const task = await index.addDocuments(documents);
    
    console.log(`Sync task created. Task ID: ${task.taskUid}`);
    console.log("Check MeiliSearch dashboard or API for task completion status.");
    
    process.exit(0);
  } catch (err) {
    console.error("Sync failed:", err);
    process.exit(1);
  }
}

syncProducts();
