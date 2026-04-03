import type { ProductApi } from "@/lib/api";
import { uniqueNormalizedValues } from "@shared/productAttributes";

export type ProductStockFormValues = {
  stockStatus: "in_stock" | "out_of_stock";
  stock: number;
  stockBySize?: Record<string, number>;
  sizeOptions: string[];
};

export function parseStoredSizeOptions(sizeOptions: string | null | undefined): string[] {
  if (!sizeOptions || !sizeOptions.trim()) return [];

  try {
    const parsed = JSON.parse(sizeOptions);
    return Array.isArray(parsed)
      ? uniqueNormalizedValues(parsed.filter((value): value is string => typeof value === "string"))
      : [];
  } catch {
    return [];
  }
}

function normalizeStockValue(value: unknown): number {
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(parsed)) return 0;
  return Math.max(0, Math.trunc(parsed));
}

export function syncStockBySizeToSizes(
  stockBySize: Record<string, number> | null | undefined,
  activeSizes: string[],
): Record<string, number> {
  return uniqueNormalizedValues(activeSizes).reduce<Record<string, number>>((draft, size) => {
    draft[size] = normalizeStockValue(stockBySize?.[size]);
    return draft;
  }, {});
}

export function buildStockBySizeDraft(product?: ProductApi | null): Record<string, number> {
  const sizeOptions = parseStoredSizeOptions(product?.sizeOptions);
  const seeded = syncStockBySizeToSizes(product?.stockBySize, sizeOptions);

  Object.entries(product?.stockBySize ?? {}).forEach(([size, stock]) => {
    if (!size.trim()) return;
    seeded[size] = normalizeStockValue(stock);
  });

  if (Object.keys(seeded).length === 0 && (product?.stock ?? 0) > 0) {
    seeded.M = normalizeStockValue(product?.stock);
  }

  return seeded;
}

export function getTotalStockFromForm(values: ProductStockFormValues): number {
  if (values.stockStatus === "out_of_stock") return 0;

  const totalBySize = Object.values(
    syncStockBySizeToSizes(values.stockBySize, values.sizeOptions),
  ).reduce((sum, value) => sum + value, 0);

  return totalBySize > 0 ? totalBySize : normalizeStockValue(values.stock);
}

export function buildInventorySyncPayload(input: {
  stockStatus: "in_stock" | "out_of_stock";
  currentSizes: string[];
  currentStockBySize?: Record<string, number> | null;
  previousSizes?: string[] | null;
  previousStockBySize?: Record<string, number> | null;
}): { sizeStocks: Record<string, number>; sizesToSync: string[] } {
  const currentSizes = uniqueNormalizedValues(input.currentSizes);
  const sizeStocks =
    input.stockStatus === "out_of_stock"
      ? {}
      : syncStockBySizeToSizes(input.currentStockBySize, currentSizes);

  const sizesToSync = uniqueNormalizedValues([
    ...currentSizes,
    ...(input.previousSizes ?? []),
    ...Object.keys(input.currentStockBySize ?? {}),
    ...Object.keys(input.previousStockBySize ?? {}),
  ]);

  return { sizeStocks, sizesToSync };
}
