import type {
  GroupedInventoryMovement,
  InventoryMovement,
  InventoryMovementType,
  InventoryStatus,
} from "./inventoryTypes";

export const INVENTORY_ACCENT = "#534AB7";

export const EMPTY_SUMMARY = {
  totalProducts: 0,
  totalSkus: 0,
  totalQuantity: 0,
  totalInventoryValue: 0,
  totalInventoryCost: 0,
  lowStockCount: 0,
  criticalStockCount: 0,
  inStockCount: 0,
  outletCount: 0,
};

export function formatNpr(value: number): string {
  return `रू ${value.toLocaleString("ne-NP")}`;
}

export function getStatusLabel(status: InventoryStatus): string {
  switch (status) {
    case "in_stock":
      return "In stock";
    case "low_stock":
      return "Low stock";
    default:
      return "Out of stock";
  }
}

export function getMovementTypeLabel(type: InventoryMovementType): string {
  switch (type) {
    case "stock_in":
      return "Stock in";
    case "stock_out":
      return "Stock out";
    default:
      return "Transfer";
  }
}

export function formatMovementDate(dateLike: string): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(dateLike));
}

export function formatMovementTime(dateLike: string): string {
  return new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(dateLike));
}

export function groupMovementsByDate(
  movements: InventoryMovement[],
): GroupedInventoryMovement[] {
  const groups = new Map<string, InventoryMovement[]>();

  for (const movement of movements) {
    const label = formatMovementDate(movement.occurredAt);
    const bucket = groups.get(label) ?? [];
    bucket.push(movement);
    groups.set(label, bucket);
  }

  return Array.from(groups.entries()).map(([label, items]) => ({
    label,
    items,
  }));
}

export function getInventoryStatusClasses(status: InventoryStatus): string {
  switch (status) {
    case "in_stock":
      return "border-emerald-200 bg-emerald-50 text-emerald-700";
    case "low_stock":
      return "border-amber-200 bg-amber-50 text-amber-700";
    default:
      return "border-rose-200 bg-rose-50 text-rose-700";
  }
}

export function getMovementClasses(type: InventoryMovementType): string {
  switch (type) {
    case "stock_in":
      return "border-emerald-200 bg-emerald-50 text-emerald-700";
    case "stock_out":
      return "border-rose-200 bg-rose-50 text-rose-700";
    default:
      return "border-slate-200 bg-slate-100 text-slate-700";
  }
}
