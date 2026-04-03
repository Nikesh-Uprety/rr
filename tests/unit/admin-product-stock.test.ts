import { describe, expect, it } from "vitest";
import {
  buildInventorySyncPayload,
  buildStockBySizeDraft,
  getTotalStockFromForm,
  syncStockBySizeToSizes,
} from "@/pages/admin/productStock";

describe("admin product stock helpers", () => {
  it("builds a stock draft from product sizes and existing size stock", () => {
    const draft = buildStockBySizeDraft({
      id: "p1",
      name: "Studio Tee",
      description: null,
      price: 3200,
      imageUrl: null,
      category: "tees",
      stock: 7,
      sizeOptions: JSON.stringify(["S", "M", "L"]),
      stockBySize: { S: 2, M: 5 },
    });

    expect(draft).toEqual({ S: 2, M: 5, L: 0 });
  });

  it("keeps stock values scoped to the active size options", () => {
    const synced = syncStockBySizeToSizes({ S: 3, M: 4, XL: 9 }, ["S", "M"]);

    expect(synced).toEqual({ S: 3, M: 4 });
  });

  it("calculates total stock from active sizes only", () => {
    const total = getTotalStockFromForm({
      stockStatus: "in_stock",
      stock: 99,
      sizeOptions: ["S", "M", "L"],
      stockBySize: { S: 2, M: 0, L: 3, XL: 50 },
    });

    expect(total).toBe(5);
  });

  it("returns a zeroed inventory sync plan when a product is out of stock", () => {
    const plan = buildInventorySyncPayload({
      stockStatus: "out_of_stock",
      currentSizes: ["M", "L"],
      currentStockBySize: { M: 4, L: 2 },
      previousSizes: ["S", "M"],
      previousStockBySize: { S: 1, M: 5 },
    });

    expect(plan.sizeStocks).toEqual({});
    expect(plan.sizesToSync).toEqual(["M", "L", "S"]);
  });
});
