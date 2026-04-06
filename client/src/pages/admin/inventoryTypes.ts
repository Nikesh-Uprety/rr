export type InventoryStatus = "in_stock" | "low_stock" | "out_of_stock";

export interface InventorySummary {
  totalProducts: number;
  totalSkus: number;
  totalQuantity: number;
  totalInventoryValue: number;
  totalInventoryCost: number;
  lowStockCount: number;
  criticalStockCount: number;
  inStockCount: number;
  outletCount: number;
}

export interface InventoryListItem {
  id: string;
  productId: string;
  variantId: number | null;
  name: string;
  thumbnail: string | null;
  batch: number;
  outlet: string;
  channel: string;
  status: InventoryStatus;
  units: number;
  avgCost: number;
  totalValue: number;
  variant: string;
  sku: string;
  category: string;
  currentQty: number;
  size: string;
}

export type InventoryMovementType = "stock_in" | "stock_out" | "transfer";

export interface InventoryMovement {
  id: string;
  occurredAt: string;
  outlet: string;
  ref: string;
  type: InventoryMovementType;
  quantity: number;
  value: number;
  skuCount: number;
  channel: string;
  notes?: string | null;
}

export interface GroupedInventoryMovement {
  label: string;
  items: InventoryMovement[];
}

export interface StockInSelection {
  id: string;
  productId: string;
  variantId: number | null;
  qty: number;
}
