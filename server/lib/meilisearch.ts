import "dotenv/config";
import { MeiliSearch } from "meilisearch";

const host = process.env.MEILISEARCH_URL;
const apiKey = process.env.MEILI_MASTER_KEY;

if (!host || !apiKey) {
  console.warn("[MeiliSearch] URL or Master Key missing. Search will fall back to Database.");
}

export const meiliClient = host && apiKey ? new MeiliSearch({
  host,
  apiKey,
}) : null;

export const PRODUCT_INDEX = "products";

/**
 * Initialize MeiliSearch index and settings
 */
export async function initMeiliSearch() {
  if (!meiliClient) return;

  try {
    const index = meiliClient.index(PRODUCT_INDEX);
    
    // Configure index settings for better relevance
    await index.updateSettings({
      searchableAttributes: ["name", "description", "category", "subCategory", "brand"],
      filterableAttributes: ["category", "subCategory", "brand", "isFeatured", "onSale"],
      sortableAttributes: ["createdAt", "price"],
      rankingRules: [
        "words",
        "typo",
        "proximity",
        "attribute",
        "sort",
        "exactness",
      ],
    });

    console.log("[MeiliSearch] Product index initialized and settings updated");
  } catch (err) {
    console.error("[MeiliSearch] Initialization failed:", err);
  }
}
