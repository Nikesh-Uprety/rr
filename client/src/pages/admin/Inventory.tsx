import React, { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, Download, Loader2, Package, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";

interface InventorySummary {
  totalProducts: number;
  totalSkus: number;
  totalQuantity: number;
  totalInventoryValue: number;
  totalInventoryCost: number;
  lowStockCount: number;
  criticalStockCount: number;
}

interface InventoryProduct {
  id: string;
  name: string;
  sku: string;
  category: string;
  price: number;
  costPrice: number;
  stockBySize: Record<string, number>;
  totalStock: number;
  inventoryValue: number;
  status: "healthy" | "low" | "critical";
}

const SIZE_KEYS = ["S", "M", "L", "XL"] as const;

type StockDraft = Record<string, number>;

const EMPTY_SUMMARY: InventorySummary = {
  totalProducts: 0,
  totalSkus: 0,
  totalQuantity: 0,
  totalInventoryValue: 0,
  totalInventoryCost: 0,
  lowStockCount: 0,
  criticalStockCount: 0,
};

async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Request failed for ${url}`);
  }
  return response.json() as Promise<T>;
}

function buildDraft(product: InventoryProduct | null): StockDraft {
  const base: StockDraft = { S: 0, M: 0, L: 0, XL: 0 };
  if (!product) return base;

  const next: StockDraft = { ...base, ...product.stockBySize };

  const assigned = Object.values(next).reduce((sum, value) => sum + value, 0);
  if (assigned === 0 && product.totalStock > 0) {
    next.M = product.totalStock;
  }

  return next;
}

function badgeClasses(status: InventoryProduct["status"]): string {
  if (status === "critical") return "bg-red-100 text-red-700 border-red-200";
  if (status === "low") return "bg-amber-100 text-amber-700 border-amber-200";
  return "bg-green-100 text-green-700 border-green-200";
}

function getInventoryEditorSizes(product: InventoryProduct | null): string[] {
  if (!product) return [...SIZE_KEYS];

  const extras = Object.keys(product.stockBySize)
    .filter((size) => !SIZE_KEYS.includes(size as (typeof SIZE_KEYS)[number]))
    .sort((a, b) => a.localeCompare(b));

  return [...SIZE_KEYS, ...extras];
}

const InventoryRow = React.memo(function InventoryRow({
  product,
  onEdit,
}: {
  product: InventoryProduct;
  onEdit: (product: InventoryProduct) => void;
}) {
  return (
    <tr className="border-t border-border">
      <td className="px-4 py-4">
        <div className="flex items-center gap-3">
          <span className="h-8 w-8 rounded-md bg-primary/10" />
          <div>
            <p className="font-medium">{product.name}</p>
            <p className="text-xs text-muted-foreground">{product.sku || "No SKU"}</p>
          </div>
        </div>
      </td>
      <td className="px-4 py-4 text-muted-foreground">{product.category}</td>
      {SIZE_KEYS.map((size) => {
        const value = product.stockBySize[size] ?? 0;
        const valueClass =
          value === 0
            ? "font-semibold text-red-500"
            : value <= 3
              ? "text-red-500"
              : value <= 10
                ? "text-amber-500"
                : "text-muted-foreground";

        return (
          <td key={size} className={`px-4 py-4 text-center ${valueClass}`}>
            {value}
          </td>
        );
      })}
      <td className="px-4 py-4 text-right font-medium">{product.totalStock}</td>
      <td className="px-4 py-4 text-right">
        NPR {product.inventoryValue.toLocaleString()}
      </td>
      <td className="px-4 py-4 text-center">
        <Badge className={badgeClasses(product.status)}>{product.status}</Badge>
      </td>
      <td className="px-4 py-4 text-right">
        <Button variant="outline" size="sm" onClick={() => onEdit(product)}>
          Edit stock
        </Button>
      </td>
    </tr>
  );
});

export default function Inventory() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [statusFilter, setStatusFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null);
  const [pickerSearch, setPickerSearch] = useState("");
  const [editStocks, setEditStocks] = useState<StockDraft>({ S: 0, M: 0, L: 0, XL: 0 });

  useEffect(() => {
    const timer = window.setTimeout(() => setSearch(searchInput), 300);
    return () => window.clearTimeout(timer);
  }, [searchInput]);

  const { data: summary = EMPTY_SUMMARY } = useQuery<InventorySummary>({
    queryKey: ["inventory-summary"],
    queryFn: () => fetchJson<InventorySummary>("/api/admin/inventory/summary"),
    staleTime: 30 * 1000,
  });

  const { data: products = [], isLoading } = useQuery<InventoryProduct[]>({
    queryKey: ["inventory-products", statusFilter, categoryFilter, search],
    queryFn: () => {
      const params = new URLSearchParams();
      if (statusFilter !== "all") params.set("status", statusFilter);
      if (categoryFilter) params.set("category", categoryFilter);
      if (search) params.set("search", search);
      return fetchJson<InventoryProduct[]>(`/api/admin/inventory/products?${params.toString()}`);
    },
    staleTime: 30 * 1000,
  });

  const selectedProduct = useMemo(
    () => products.find((product) => product.id === selectedProductId) ?? null,
    [products, selectedProductId],
  );
  const editorSizes = useMemo(
    () => getInventoryEditorSizes(selectedProduct),
    [selectedProduct],
  );

  useEffect(() => {
    setEditStocks(buildDraft(selectedProduct));
  }, [selectedProduct]);

  const updateStock = useMutation({
    mutationFn: async ({
      productId,
      size,
      newStock,
    }: {
      productId: string;
      size?: string;
      newStock: number;
    }) => {
      const response = await fetch(`/api/admin/inventory/${productId}/stock`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ size, newStock }),
      });

      if (!response.ok) {
        throw new Error("Failed to update stock");
      }

      return response.json();
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["inventory-products"] });
      await queryClient.invalidateQueries({ queryKey: ["inventory-summary"] });
      toast({
        title: "Stock updated",
        description: "Inventory totals were refreshed.",
      });
    },
    onError: () => {
      toast({
        title: "Stock update failed",
        description: "Please try again.",
        variant: "destructive",
      });
    },
  });

  const categoryTotals = useMemo(() => {
    const totals = new Map<string, number>();

    products.forEach((product) => {
      const key = product.category || "Uncategorized";
      totals.set(key, (totals.get(key) ?? 0) + product.totalStock);
    });

    return Array.from(totals.entries())
      .map(([category, totalStock]) => ({ category, totalStock }))
      .sort((a, b) => b.totalStock - a.totalStock);
  }, [products]);

  const maxCategoryTotal = categoryTotals[0]?.totalStock ?? 0;

  const { healthyCount, lowCount, criticalCount } = useMemo(
    () => ({
      healthyCount: products.filter((product) => product.status === "healthy").length,
      lowCount: products.filter((product) => product.status === "low").length,
      criticalCount: products.filter((product) => product.status === "critical").length,
    }),
    [products],
  );

  const categoryOptions = useMemo(
    () => Array.from(new Set(products.map((product) => product.category).filter(Boolean))).sort(),
    [products],
  );

  const pickerProducts = useMemo(() => {
    const normalized = pickerSearch.trim().toLowerCase();
    if (!normalized) return products;

    return products.filter((product) => {
      const haystack = `${product.name} ${product.sku} ${product.category}`.toLowerCase();
      return haystack.includes(normalized);
    });
  }, [pickerSearch, products]);

  const openEditor = (product?: InventoryProduct) => {
    setSelectedProductId(product?.id ?? null);
    setPickerSearch("");
    setEditModalOpen(true);
  };

  const handleExportCsv = () => {
    const csv = [
      ["Product", "SKU", "Category", "S", "M", "L", "XL", "Total", "Price (NPR)", "Value (NPR)", "Status"],
      ...products.map((product) => [
        product.name,
        product.sku,
        product.category,
        product.stockBySize.S ?? 0,
        product.stockBySize.M ?? 0,
        product.stockBySize.L ?? 0,
        product.stockBySize.XL ?? 0,
        product.totalStock,
        product.price,
        product.inventoryValue,
        product.status,
      ]),
    ]
      .map((row) => row.join(","))
      .join("\n");

    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `rarenp-inventory-${new Date().toISOString().split("T")[0]}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const adjustSize = (size: string, delta: number) => {
    setEditStocks((prev) => ({
      ...prev,
      [size]: Math.max(0, (prev[size] ?? selectedProduct?.stockBySize[size] ?? 0) + delta),
    }));
  };

  const saveStocks = async () => {
    if (!selectedProduct) return;

    for (const size of editorSizes) {
      const newVal = editStocks[size];
      const oldVal = selectedProduct.stockBySize[size] ?? 0;
      if (newVal !== undefined && newVal !== oldVal) {
        await updateStock.mutateAsync({
          productId: selectedProduct.id,
          size,
          newStock: newVal,
        });
      }
    }
    setEditModalOpen(false);
    setEditStocks({ S: 0, M: 0, L: 0, XL: 0 });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Inventory</h1>
          <p className="text-sm text-muted-foreground">
            Stock management across all products and variants
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={handleExportCsv} disabled={products.length === 0}>
            <Download className="mr-2 h-4 w-4" />
            Export CSV
          </Button>
          <Button onClick={() => openEditor()}>
            <Package className="mr-2 h-4 w-4" />
            + Adjust Stock
          </Button>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="mb-2 text-xs uppercase tracking-wide text-muted-foreground">
            Total inventory value
          </p>
          <p className="text-2xl font-semibold">
            NPR {summary.totalInventoryValue.toLocaleString()}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">Retail price x qty in stock</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="mb-2 text-xs uppercase tracking-wide text-muted-foreground">
            Total inventory cost
          </p>
          <p className="text-2xl font-semibold">
            NPR {summary.totalInventoryCost.toLocaleString()}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">Cost price x qty in stock</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="mb-2 text-xs uppercase tracking-wide text-muted-foreground">Total SKUs</p>
          <p className="text-2xl font-semibold">{summary.totalSkus}</p>
          <div className="mt-1 flex items-center justify-between gap-3">
            <p className="text-xs text-muted-foreground">
              {summary.totalProducts} products · {summary.totalSkus - summary.totalProducts} variants
            </p>
            <Badge className="border-amber-200 bg-amber-100 text-amber-700">
              {summary.lowStockCount} low stock
            </Badge>
          </div>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="mb-2 text-xs uppercase tracking-wide text-muted-foreground">
            Total qty in stock
          </p>
          <p className="text-2xl font-semibold">{summary.totalQuantity.toLocaleString()}</p>
          <div className="mt-1 flex items-center justify-between gap-3">
            <p className="text-xs text-muted-foreground">Units across all variants</p>
            {summary.criticalStockCount > 0 ? (
              <Badge className="border-red-200 bg-red-100 text-red-700">
                {summary.criticalStockCount} critical
              </Badge>
            ) : null}
          </div>
        </div>
      </div>

      {(summary.criticalStockCount > 0 || summary.lowStockCount > 0) && (
        <div className="mb-4 flex items-center justify-between gap-3 rounded-lg border border-amber-200 bg-amber-50 p-3 dark:bg-amber-950">
          <div className="flex items-center gap-2 text-sm text-amber-900 dark:text-amber-100">
            <AlertTriangle className="h-4 w-4" />
            <span>
              {summary.criticalStockCount} products critically low (≤3 units) ·{" "}
              {summary.lowStockCount} products below reorder threshold (≤10 units)
            </span>
          </div>
          <Button variant="ghost" className="text-amber-900 dark:text-amber-100" onClick={() => setStatusFilter("critical")}>
            View critical →
          </Button>
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="mb-4">
            <h2 className="text-lg font-semibold">Stock by category</h2>
            <p className="text-sm text-muted-foreground">Quantity ranked by current stock</p>
          </div>
          <div className="space-y-3">
            {categoryTotals.map((item) => {
              const width = maxCategoryTotal > 0 ? (item.totalStock / maxCategoryTotal) * 100 : 0;
              const barClass =
                item.totalStock > 200
                  ? "bg-green-500"
                  : item.totalStock >= 50
                    ? "bg-amber-500"
                    : "bg-red-500";

              return (
                <div key={item.category} className="grid grid-cols-[120px_1fr_auto] items-center gap-3">
                  <span className="truncate text-sm font-medium">{item.category}</span>
                  <div className="h-2 rounded-full bg-muted">
                    <div className={`h-2 rounded-full ${barClass}`} style={{ width: `${width}%` }} />
                  </div>
                  <span className="text-sm text-muted-foreground">{item.totalStock}</span>
                </div>
              );
            })}
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card p-4">
          <div className="mb-4">
            <h2 className="text-lg font-semibold">Stock health overview</h2>
            <p className="text-sm text-muted-foreground">Product counts by stock status</p>
          </div>
          <div className="space-y-3">
            <div className="flex items-center justify-between rounded-lg bg-green-50 px-4 py-3 text-sm dark:bg-green-950/40">
              <span>Healthy (&gt;10)</span>
              <span className="font-semibold">{healthyCount}</span>
            </div>
            <div className="flex items-center justify-between rounded-lg bg-amber-50 px-4 py-3 text-sm dark:bg-amber-950/40">
              <span>Low (4-10)</span>
              <span className="font-semibold">{lowCount}</span>
            </div>
            <div className="flex items-center justify-between rounded-lg bg-red-50 px-4 py-3 text-sm dark:bg-red-950/40">
              <span>Critical (0-3)</span>
              <span className="font-semibold">{criticalCount}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card">
        <div className="flex flex-col gap-3 border-b border-border p-4 lg:flex-row lg:items-center">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
              placeholder="Search products or SKU"
              className="pl-9"
            />
          </div>
          <Select
            value={categoryFilter || "all"}
            onValueChange={(value) => setCategoryFilter(value === "all" ? "" : value)}
          >
            <SelectTrigger className="w-full lg:w-[220px]">
              <SelectValue placeholder="All categories" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All categories</SelectItem>
              {categoryOptions.map((category) => (
                <SelectItem key={category} value={category}>
                  {category}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-full lg:w-[180px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="healthy">Healthy</SelectItem>
              <SelectItem value="low">Low</SelectItem>
              <SelectItem value="critical">Critical</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-4 py-3">Product</th>
                <th className="px-4 py-3">Category</th>
                {SIZE_KEYS.map((size) => (
                  <th key={size} className="px-4 py-3 text-center">
                    {size}
                  </th>
                ))}
                <th className="px-4 py-3 text-right">Total</th>
                <th className="px-4 py-3 text-right">Value (NPR)</th>
                <th className="px-4 py-3 text-center">Status</th>
                <th className="px-4 py-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {isLoading
                ? Array.from({ length: 5 }).map((_, index) => (
                    <tr key={index} className="border-t border-border">
                      <td className="px-4 py-4" colSpan={10}>
                        <div className="h-10 animate-pulse rounded-lg bg-muted" />
                      </td>
                    </tr>
                  ))
                : products.length === 0
                  ? (
                    <tr>
                      <td colSpan={10} className="px-4 py-12 text-center text-muted-foreground">
                        No products found
                      </td>
                    </tr>
                    )
                  : products.map((product) => (
                      <InventoryRow key={product.id} product={product} onEdit={openEditor} />
                    ))}
            </tbody>
          </table>
        </div>
      </div>

      <Dialog
        open={editModalOpen}
        onOpenChange={(open) => {
          setEditModalOpen(open);
          if (!open) setSelectedProductId(null);
        }}
      >
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {selectedProduct ? `Restock — ${selectedProduct.name}` : "Restock — Select Product"}
            </DialogTitle>
          </DialogHeader>

          {!selectedProduct ? (
            <div className="space-y-4">
              <Input
                value={pickerSearch}
                onChange={(event) => setPickerSearch(event.target.value)}
                placeholder="Search product to adjust"
              />
              <div className="max-h-72 space-y-2 overflow-y-auto">
                {pickerProducts.map((product) => (
                  <button
                    key={product.id}
                    type="button"
                    onClick={() => setSelectedProductId(product.id)}
                    className="flex w-full items-center justify-between rounded-lg border border-border px-3 py-3 text-left hover:bg-muted"
                  >
                    <div>
                      <p className="font-medium">{product.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {product.category} · {product.totalStock} in stock
                      </p>
                    </div>
                    <span className="text-xs uppercase tracking-wide text-muted-foreground">
                      Select
                    </span>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {editorSizes.map((size) => (
                <div
                  key={size}
                  className="flex items-center justify-between py-3 border-b border-border"
                >
                  <div className="flex items-center gap-3">
                    <span className="w-8 h-8 flex items-center justify-center border border-border rounded text-sm font-medium">
                      {size}
                    </span>
                    <span
                      className={`text-xs px-2 py-0.5 rounded font-medium ${
                        (selectedProduct.stockBySize[size] ?? 0) === 0
                          ? "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300"
                          : (selectedProduct.stockBySize[size] ?? 0) <= 5
                            ? "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300"
                            : "bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300"
                      }`}
                    >
                      {(selectedProduct.stockBySize[size] ?? 0) === 0
                        ? "Out of stock"
                        : (selectedProduct.stockBySize[size] ?? 0) <= 5
                          ? `Low — ${selectedProduct.stockBySize[size] ?? 0} left`
                          : `${selectedProduct.stockBySize[size] ?? 0} in stock`}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => adjustSize(size, -5)}
                      className="w-7 h-7 border border-border rounded text-sm hover:bg-muted transition-colors"
                    >
                      -5
                    </button>
                    <button
                      type="button"
                      onClick={() => adjustSize(size, -1)}
                      className="w-7 h-7 border border-border rounded text-sm hover:bg-muted transition-colors"
                    >
                      -1
                    </button>
                    <input
                      type="number"
                      min={0}
                      value={editStocks[size] ?? selectedProduct.stockBySize[size] ?? 0}
                      onChange={(e) =>
                        setEditStocks((prev) => ({
                          ...prev,
                          [size]: Math.max(0, parseInt(e.target.value) || 0),
                        }))
                      }
                      className="w-16 text-center border border-border rounded px-2 py-1 text-sm bg-background"
                    />
                    <button
                      type="button"
                      onClick={() => adjustSize(size, 1)}
                      className="w-7 h-7 border border-border rounded text-sm hover:bg-muted transition-colors"
                    >
                      +1
                    </button>
                    <button
                      type="button"
                      onClick={() => adjustSize(size, 10)}
                      className="w-7 h-7 border border-border rounded text-sm hover:bg-muted transition-colors"
                    >
                      +10
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setEditModalOpen(false);
                setSelectedProductId(null);
                setEditStocks({ S: 0, M: 0, L: 0, XL: 0 });
              }}
            >
              Cancel
            </Button>
            <Button onClick={saveStocks} disabled={!selectedProduct || updateStock.isPending}>
              {updateStock.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving
                </>
              ) : (
                "Save Changes"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
