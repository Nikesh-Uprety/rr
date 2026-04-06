import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { Minus, Package2, Plus, Ruler, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";
import type {
  InventoryListItem,
  InventoryMovement,
  StockInSelection,
} from "./inventoryTypes";
import {
  formatMovementTime,
  formatNpr,
  getInventoryStatusClasses,
  getMovementClasses,
  getMovementTypeLabel,
  getStatusLabel,
  INVENTORY_ACCENT,
} from "./inventoryUtils";

export function StatusBadge({
  status,
  className,
}: {
  status: InventoryListItem["status"];
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-medium",
        getInventoryStatusClasses(status),
        className,
      )}
    >
      {getStatusLabel(status)}
    </span>
  );
}

export function InventoryCard({
  item,
  onStockIn,
  onViewBatches,
}: {
  item: InventoryListItem;
  onStockIn: (item: InventoryListItem) => void;
  onViewBatches: (item: InventoryListItem) => void;
}) {
  return (
    <article className="rounded-2xl border border-border bg-card p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <div className="h-11 w-11 overflow-hidden rounded-xl border border-border bg-muted">
            {item.thumbnail ? (
              <img
                src={item.thumbnail}
                alt={item.name}
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center">
                <Package2 className="h-4 w-4 text-muted-foreground" />
              </div>
            )}
          </div>
          <div className="min-w-0">
            <h3 className="truncate text-sm font-medium text-foreground">{item.name}</h3>
            <p className="mt-1 truncate text-xs text-muted-foreground">
              Batch {item.batch} · {item.outlet} · {item.channel}
            </p>
          </div>
        </div>
        <StatusBadge status={item.status} />
      </div>

      <div className="mt-4 grid grid-cols-3 gap-2">
        <div className="rounded-xl bg-muted/50 px-3 py-2 text-center">
          <p className="text-sm font-semibold text-foreground">{item.units}</p>
          <p className="mt-1 text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
            Units
          </p>
        </div>
        <div className="rounded-xl bg-muted/50 px-3 py-2 text-center">
          <p className="text-sm font-semibold text-foreground">{formatNpr(item.avgCost)}</p>
          <p className="mt-1 text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
            Avg Cost
          </p>
        </div>
        <div className="rounded-xl bg-muted/50 px-3 py-2 text-center">
          <p className="text-sm font-semibold text-foreground">{formatNpr(item.totalValue)}</p>
          <p className="mt-1 text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
            Total Value
          </p>
        </div>
      </div>

      <div className="mt-4 flex gap-2">
        <Button variant="outline" className="flex-1" onClick={() => onViewBatches(item)}>
          View batches
        </Button>
        <Button
          className="flex-1 border-0 text-white"
          style={{ backgroundColor: INVENTORY_ACCENT }}
          onClick={() => onStockIn(item)}
        >
          + Stock in
        </Button>
      </div>
    </article>
  );
}

export function MovementCard({
  movement,
  onDetails,
}: {
  movement: InventoryMovement;
  onDetails: (movement: InventoryMovement) => void;
}) {
  const isOut = movement.type === "stock_out";

  return (
    <article className="rounded-2xl border border-border bg-card p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-foreground">{movement.outlet}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            {movement.ref} · {formatMovementTime(movement.occurredAt)}
          </p>
        </div>
        <span
          className={cn(
            "inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-medium",
            getMovementClasses(movement.type),
          )}
        >
          {isOut ? "↗" : movement.type === "stock_in" ? "↙" : "↔"} {getMovementTypeLabel(movement.type)}
        </span>
      </div>

      <div className="mt-4 flex items-end justify-between gap-3">
        <div>
          <p className={cn("text-2xl font-semibold", isOut ? "text-rose-700" : "text-emerald-700")}>
            {isOut ? "-" : movement.type === "stock_in" ? "+" : ""}{movement.quantity} units
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {formatNpr(movement.value)} · {movement.skuCount} SKU{movement.skuCount === 1 ? "" : "s"}
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => onDetails(movement)}>
          Details
        </Button>
      </div>
    </article>
  );
}

interface StockInSheetProps {
  isOpen: boolean;
  products: InventoryListItem[];
  initialProductId?: string | null;
  defaultLowStockFirst?: boolean;
  onConfirm: (selections: StockInSelection[]) => void;
  onClose: () => void;
}

export function StockInSheet({
  isOpen,
  products,
  initialProductId,
  defaultLowStockFirst = true,
  onConfirm,
  onClose,
}: StockInSheetProps) {
  const isMobile = useIsMobile();
  const [search, setSearch] = useState("");
  const [selectedOnly, setSelectedOnly] = useState(false);
  const [lowStockFirst, setLowStockFirst] = useState(true);
  const [quantities, setQuantities] = useState<Record<string, number>>({});

  useEffect(() => {
    if (!isOpen) return;

    const next: Record<string, number> = {};
    if (initialProductId) {
      next[initialProductId] = 1;
    }
    setQuantities(next);
    setSearch("");
    setSelectedOnly(false);
    setLowStockFirst(defaultLowStockFirst);
  }, [defaultLowStockFirst, initialProductId, isOpen]);

  const filteredProducts = useMemo(() => {
    const normalized = search.trim().toLowerCase();
    const selectedIds = new Set(
      Object.entries(quantities)
        .filter(([, qty]) => qty > 0)
        .map(([id]) => id),
    );

    const base = products.filter((product) => {
      if (selectedOnly && !selectedIds.has(product.id)) return false;
      if (!normalized) return true;

      return [product.name, product.variant, product.sku]
        .some((value) => value.toLowerCase().includes(normalized));
    });

    return [...base].sort((left, right) => {
      if (lowStockFirst && left.status !== right.status) {
        const weight = { out_of_stock: 0, low_stock: 1, in_stock: 2 };
        return weight[left.status] - weight[right.status];
      }
      return left.name.localeCompare(right.name);
    });
  }, [lowStockFirst, products, quantities, search, selectedOnly]);

  const selections = useMemo(
    () =>
      products
        .map((product) => ({
          id: product.id,
          productId: product.productId,
          variantId: product.variantId,
          qty: quantities[product.id] ?? 0,
        }))
        .filter((selection) => selection.qty > 0),
    [products, quantities],
  );

  const selectedCount = selections.length;
  const totalQty = selections.reduce((sum, selection) => sum + selection.qty, 0);
  const estimatedValue = selections.reduce((sum, selection) => {
    const match = products.find((product) => product.id === selection.id);
    return sum + (match ? match.avgCost * selection.qty : 0);
  }, 0);

  const setQuantity = (product: InventoryListItem, nextQty: number) => {
    setQuantities((current) => {
      const safeQty = Math.max(0, nextQty);
      if (safeQty === 0) {
        const { [product.id]: _removed, ...rest } = current;
        return rest;
      }
      return {
        ...current,
        [product.id]: safeQty,
      };
    });
  };

  if (!isOpen || typeof document === "undefined") return null;

  return createPortal(
    <div className="fixed inset-0 z-[120] bg-black/45" onClick={onClose}>
      <div
        className={cn(
          "absolute bg-background shadow-2xl",
          isMobile
            ? "bottom-0 left-0 right-0 max-h-[88vh] rounded-t-[28px]"
            : "right-0 top-0 h-full w-full max-w-[440px] border-l border-border",
        )}
        onClick={(event) => event.stopPropagation()}
      >
        {isMobile ? (
          <div className="mx-auto mt-3 h-1.5 w-12 rounded-full bg-border" />
        ) : null}

        <div className="border-b border-border px-5 pb-4 pt-5">
          <h2 className="text-lg font-semibold text-foreground">Select products</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Choose variants and set quantities for sizes and colors
          </p>
          <div className="relative mt-4">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search products..."
              className="pl-9"
            />
          </div>
          {!isMobile ? (
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                className={cn(
                  "rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
                  lowStockFirst
                    ? "border-transparent text-white"
                    : "border-border bg-muted/40 text-muted-foreground",
                )}
                style={lowStockFirst ? { backgroundColor: INVENTORY_ACCENT } : undefined}
                onClick={() => setLowStockFirst((current) => !current)}
              >
                Low stock first
              </button>
              <button
                type="button"
                className={cn(
                  "rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
                  selectedOnly
                    ? "border-transparent text-white"
                    : "border-border bg-muted/40 text-muted-foreground",
                )}
                style={selectedOnly ? { backgroundColor: INVENTORY_ACCENT } : undefined}
                onClick={() => setSelectedOnly((current) => !current)}
              >
                Selected ({selectedCount})
              </button>
            </div>
          ) : null}
        </div>

        <div className="max-h-[calc(88vh-182px)] overflow-y-auto md:max-h-[calc(100vh-190px)]">
          {filteredProducts.map((product) => {
            const qty = quantities[product.id] ?? 0;
            const checked = qty > 0;

            return (
              <div
                key={product.id}
                className={cn(
                  "flex items-center gap-3 border-b border-border px-5 py-3",
                  !isMobile && product.status === "low_stock" && "bg-amber-50/60",
                )}
              >
                <Checkbox
                  checked={checked}
                  onCheckedChange={(nextChecked) => setQuantity(product, nextChecked ? Math.max(1, qty) : 0)}
                  aria-label={`Select ${product.name}`}
                />
                <div className="h-10 w-10 overflow-hidden rounded-xl border border-border bg-muted">
                  {product.thumbnail ? (
                    <img
                      src={product.thumbnail}
                      alt={product.name}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center">
                      <Package2 className="h-4 w-4 text-muted-foreground" />
                    </div>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-foreground">{product.name}</p>
                  <div
                    className={cn(
                      "mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground",
                      product.status !== "in_stock" && "text-amber-700",
                    )}
                  >
                    <span className="inline-flex items-center gap-1">
                      <Ruler className="h-3 w-3" />
                      {product.variant}
                    </span>
                    <span>SKU: {product.sku}</span>
                    <span>{formatNpr(product.avgCost)}</span>
                    <span>Stock: {product.currentQty}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    className="flex h-8 w-8 items-center justify-center rounded-lg border border-border bg-muted/40 text-foreground"
                    onClick={() => setQuantity(product, qty - 1)}
                    aria-label={`Decrease ${product.name}`}
                  >
                    <Minus className="h-3.5 w-3.5" />
                  </button>
                  <Input
                    type="number"
                    min={0}
                    value={qty}
                    onChange={(event) => setQuantity(product, Number(event.target.value) || 0)}
                    className="h-8 w-16 px-2 text-center text-sm font-semibold"
                    aria-label={`Quantity for ${product.name}`}
                  />
                  <button
                    type="button"
                    className="flex h-8 w-8 items-center justify-center rounded-lg border border-border bg-muted/40 text-foreground"
                    onClick={() => setQuantity(product, Math.max(1, qty) + 1)}
                    aria-label={`Increase ${product.name}`}
                  >
                    <Plus className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        <div className="sticky bottom-0 flex items-center justify-between gap-3 border-t border-border bg-background px-5 py-4">
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-foreground">
              {selectedCount} products selected · Qty: {totalQty}
            </p>
            {!isMobile ? (
              <p className="mt-1 text-xs text-muted-foreground">
                Est. value: {formatNpr(estimatedValue)}
              </p>
            ) : null}
          </div>
          <Button
            className="border-0 text-white"
            style={{ backgroundColor: INVENTORY_ACCENT }}
            disabled={selectedCount === 0}
            onClick={() => onConfirm(selections)}
          >
            Confirm stock in
          </Button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
