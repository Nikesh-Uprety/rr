import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowUpRight,
  Boxes,
  ChartColumnBig,
  CheckCircle2,
  Download,
  LayoutGrid,
  Package2,
  Search,
  Settings2,
  SlidersHorizontal,
  Wallet,
} from "lucide-react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Pagination } from "@/components/admin/Pagination";
import {
  Dialog,
  DialogContent,
  DialogDescription,
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
import { useIsMobile } from "@/hooks/use-mobile";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import {
  InventoryCard,
  MovementCard,
  StatusBadge,
  StockInSheet,
} from "./inventoryComponents";
import type {
  InventoryListItem,
  InventoryMovement,
  InventorySummary,
  StockInSelection,
} from "./inventoryTypes";
import {
  EMPTY_SUMMARY,
  formatMovementDate,
  formatNpr,
  getStatusLabel,
  groupMovementsByDate,
  INVENTORY_ACCENT,
} from "./inventoryUtils";

type InventoryTab = "overview" | "inventory" | "movements" | "settings";

async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url, {
    credentials: "include",
  });

  if (!response.ok) {
    throw new Error(`Request failed for ${url}`);
  }

  return response.json() as Promise<T>;
}

const STATUS_CHIPS = [
  { id: "all", label: "All" },
  { id: "in_stock", label: "In stock" },
  { id: "low_stock", label: "Low stock" },
  { id: "out_of_stock", label: "Out of stock" },
] as const;

const MOVEMENT_TYPE_CHIPS = [
  { id: "all", label: "All types" },
  { id: "stock_out", label: "Stock out" },
  { id: "stock_in", label: "Stock in" },
  { id: "transfer", label: "Transfer" },
] as const;

const INVENTORY_TABS: {
  id: InventoryTab;
  label: string;
  disabled?: boolean;
  icon: typeof ChartColumnBig;
}[] = [
  { id: "overview", label: "Inventory Overview", icon: ChartColumnBig },
  { id: "inventory", label: "Inventory", icon: Boxes },
  { id: "movements", label: "Stock Movements", icon: ArrowUpRight },
  { id: "settings", label: "Settings", icon: Settings2 },
];

export default function Inventory() {
  const [location, setLocation] = useLocation();
  const isMobile = useIsMobile();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const getTabFromUrl = (): InventoryTab => {
    if (typeof window === "undefined") return "overview";
    const tab = new URLSearchParams(window.location.search).get("tab");
    if (tab === "inventory" || tab === "movements" || tab === "settings" || tab === "overview") {
      return tab;
    }
    return "overview";
  };
  const [activeTab, setActiveTab] = useState<InventoryTab>(() => getTabFromUrl());
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [movementTypeFilter, setMovementTypeFilter] = useState<string>("all");
  const [selectedOutlet, setSelectedOutlet] = useState<string>("all");
  const [inventorySearchInput, setInventorySearchInput] = useState("");
  const [inventorySearch, setInventorySearch] = useState("");
  const [movementSearchInput, setMovementSearchInput] = useState("");
  const [movementSearch, setMovementSearch] = useState("");
  const [inventoryPage, setInventoryPage] = useState(1);
  const [inventoryPageSize, setInventoryPageSize] = useState(10);
  const [movementPage, setMovementPage] = useState(1);
  const [movementPageSize, setMovementPageSize] = useState(20);
  const [stockInOpen, setStockInOpen] = useState(false);
  const [stockInInitialId, setStockInInitialId] = useState<string | null>(null);
  const [batchDialogOpen, setBatchDialogOpen] = useState(false);
  const [batchProductId, setBatchProductId] = useState<string | null>(null);
  const [batchDraft, setBatchDraft] = useState<Record<string, number>>({});
  const [movementDetail, setMovementDetail] = useState<InventoryMovement | null>(null);
  const [settingsDraft, setSettingsDraft] = useState({
    defaultTab: "overview" as InventoryTab,
    preferLowStockFirst: true,
    showOverviewFirst: true,
  });

  useEffect(() => {
    const timer = window.setTimeout(() => setInventorySearch(inventorySearchInput.trim()), 250);
    return () => window.clearTimeout(timer);
  }, [inventorySearchInput]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const saved = window.localStorage.getItem("inventory-workspace-settings");
    if (!saved) return;
    try {
      const parsed = JSON.parse(saved) as Partial<typeof settingsDraft>;
      setSettingsDraft((current) => ({ ...current, ...parsed }));
    } catch {
      // ignore malformed local state
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem("inventory-workspace-settings", JSON.stringify(settingsDraft));
  }, [settingsDraft]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const syncFromUrl = () => {
      setActiveTab(getTabFromUrl());
    };

    syncFromUrl();
    window.addEventListener("popstate", syncFromUrl);

    return () => {
      window.removeEventListener("popstate", syncFromUrl);
    };
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.location.search || settingsDraft.defaultTab === "overview") return;
    handleTabChange(settingsDraft.defaultTab);
  }, [settingsDraft.defaultTab]);

  useEffect(() => {
    const timer = window.setTimeout(() => setMovementSearch(movementSearchInput.trim()), 250);
    return () => window.clearTimeout(timer);
  }, [movementSearchInput]);

  useEffect(() => {
    setInventoryPage(1);
  }, [inventorySearch, selectedOutlet, statusFilter]);

  useEffect(() => {
    setMovementPage(1);
  }, [movementSearch, selectedOutlet, movementTypeFilter]);

  const { data: summary = EMPTY_SUMMARY as InventorySummary, isLoading: summaryLoading } = useQuery<InventorySummary>({
    queryKey: ["inventory-summary"],
    queryFn: () => fetchJson<InventorySummary>("/api/admin/inventory/summary"),
    staleTime: 30_000,
  });

  const inventoryQuery = useQuery<InventoryListItem[]>({
    queryKey: ["inventory-products-v2", statusFilter, selectedOutlet, inventorySearch],
    queryFn: () => {
      const params = new URLSearchParams();
      if (statusFilter !== "all") params.set("status", statusFilter);
      if (selectedOutlet !== "all") params.set("outlet", selectedOutlet);
      if (inventorySearch) params.set("search", inventorySearch);
      return fetchJson<InventoryListItem[]>(`/api/admin/inventory/products?${params.toString()}`);
    },
    staleTime: 30_000,
  });

  const movementQuery = useQuery<InventoryMovement[]>({
    queryKey: ["inventory-movements", movementTypeFilter, selectedOutlet, movementSearch],
    queryFn: () => {
      const params = new URLSearchParams();
      if (movementTypeFilter !== "all") params.set("type", movementTypeFilter);
      if (selectedOutlet !== "all") params.set("outlet", selectedOutlet);
      if (movementSearch) params.set("search", movementSearch);
      return fetchJson<InventoryMovement[]>(`/api/admin/inventory/movements?${params.toString()}`);
    },
    staleTime: 30_000,
  });

  const inventoryItems = inventoryQuery.data ?? [];
  const movements = movementQuery.data ?? [];

  const outlets = useMemo(
    () => Array.from(new Set(inventoryItems.map((item) => item.outlet))).sort((left, right) => left.localeCompare(right)),
    [inventoryItems],
  );

  const paginatedInventory = useMemo(() => {
    const start = (inventoryPage - 1) * inventoryPageSize;
    return inventoryItems.slice(start, start + inventoryPageSize);
  }, [inventoryItems, inventoryPage, inventoryPageSize]);

  const inventoryTotalPages = Math.max(1, Math.ceil(inventoryItems.length / inventoryPageSize));
  const groupedMovements = useMemo(() => groupMovementsByDate(movements), [movements]);
  const paginatedMovements = useMemo(() => {
    const start = (movementPage - 1) * movementPageSize;
    return movements.slice(start, start + movementPageSize);
  }, [movementPage, movementPageSize, movements]);
  const movementTotalPages = Math.max(1, Math.ceil(movements.length / movementPageSize));
  const paginatedGroupedMovements = useMemo(
    () => groupMovementsByDate(paginatedMovements),
    [paginatedMovements],
  );

  const movementSummary = useMemo(() => {
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);

    const weeklyMovements = movements.filter(
      (movement) => new Date(movement.occurredAt) >= weekAgo,
    );

    const stockOut = weeklyMovements
      .filter((movement) => movement.type === "stock_out")
      .reduce((sum, movement) => sum + movement.quantity, 0);
    const stockIn = weeklyMovements
      .filter((movement) => movement.type === "stock_in")
      .reduce((sum, movement) => sum + movement.quantity, 0);

    return {
      stockOut,
      stockIn,
      net: stockIn - stockOut,
    };
  }, [movements]);

  const batchItems = useMemo(
    () => inventoryItems.filter((item) => item.productId === batchProductId),
    [batchProductId, inventoryItems],
  );

  useEffect(() => {
    if (!batchDialogOpen) return;

    const nextDraft = Object.fromEntries(
      batchItems.map((item) => [item.id, item.currentQty]),
    );
    setBatchDraft(nextDraft);
  }, [batchDialogOpen, batchItems]);

  const stockInMutation = useMutation({
    mutationFn: async (selections: StockInSelection[]) => {
      const response = await fetch("/api/admin/inventory/stock-in", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({
          items: selections.map((selection) => ({
            productId: selection.productId,
            variantId: selection.variantId,
            quantity: selection.qty,
          })),
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to stock in products");
      }

      return response.json();
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["inventory-summary"] }),
        queryClient.invalidateQueries({ queryKey: ["inventory-products-v2"] }),
        queryClient.invalidateQueries({ queryKey: ["inventory-movements"] }),
        queryClient.invalidateQueries({ queryKey: ["admin", "products"] }),
        queryClient.invalidateQueries({ queryKey: ["products"] }),
      ]);
      toast({
        title: "Stock added",
        description: "Inventory counts and movement logs were updated.",
      });
      setStockInOpen(false);
      setStockInInitialId(null);
    },
    onError: () => {
      toast({
        title: "Stock in failed",
        description: "Please try again.",
        variant: "destructive",
      });
    },
  });

  const updateStockMutation = useMutation({
    mutationFn: async ({
      productId,
      variantId,
      newStock,
    }: {
      productId: string;
      variantId: number | null;
      newStock: number;
    }) => {
      const response = await fetch(`/api/admin/inventory/${productId}/stock`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({ variantId, newStock }),
      });

      if (!response.ok) {
        throw new Error("Failed to update stock");
      }

      return response.json();
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["inventory-summary"] }),
        queryClient.invalidateQueries({ queryKey: ["inventory-products-v2"] }),
        queryClient.invalidateQueries({ queryKey: ["inventory-movements"] }),
        queryClient.invalidateQueries({ queryKey: ["admin", "products"] }),
        queryClient.invalidateQueries({ queryKey: ["products"] }),
      ]);
    },
  });

  const openStockIn = (item?: InventoryListItem) => {
    setStockInInitialId(item?.id ?? null);
    setStockInOpen(true);
  };

  const openBatches = (item: InventoryListItem) => {
    setBatchProductId(item.productId);
    setBatchDialogOpen(true);
  };

  const saveBatchChanges = async () => {
    const changedItems = batchItems.filter((item) => (batchDraft[item.id] ?? item.currentQty) !== item.currentQty);

    for (const item of changedItems) {
      await updateStockMutation.mutateAsync({
        productId: item.productId,
        variantId: item.variantId,
        newStock: Math.max(0, batchDraft[item.id] ?? item.currentQty),
      });
    }

    toast({
      title: "Batch stock updated",
      description: "The selected inventory batches were refreshed.",
    });
    setBatchDialogOpen(false);
    setBatchProductId(null);
  };

  const exportMovementsCsv = () => {
    const rows = [
      ["Date", "Time", "Outlet", "Type", "Reference", "Quantity", "Value", "SKU Count"],
      ...movements.map((movement) => [
        formatMovementDate(movement.occurredAt),
        new Intl.DateTimeFormat("en-US", {
          hour: "numeric",
          minute: "2-digit",
        }).format(new Date(movement.occurredAt)),
        movement.outlet,
        movement.type,
        movement.ref,
        String(movement.quantity),
        String(movement.value),
        String(movement.skuCount),
      ]),
    ];

    const csv = rows.map((row) => row.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `inventory-movements-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleTabChange = (tab: InventoryTab) => {
    setActiveTab(tab);
    const params = typeof window !== "undefined"
      ? new URLSearchParams(window.location.search)
      : new URLSearchParams(location.split("?")[1] ?? "");
    if (tab === "overview") {
      params.delete("tab");
    } else {
      params.set("tab", tab);
    }
    const query = params.toString();
    setLocation(`/admin/inventory${query ? `?${query}` : ""}`);
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("admin-inventory-tab-change", { detail: { tab } }));
    }
  };

  const activeDesktopTab = activeTab;
  const pageTitle =
    activeDesktopTab === "overview"
      ? "Inventory Overview"
      : activeDesktopTab === "movements"
        ? "Stock movements"
        : activeDesktopTab === "settings"
          ? "Inventory settings"
        : "Inventory items";
  const pageSubtitle =
    activeDesktopTab === "overview"
      ? `Real-time metrics for ${selectedOutlet === "all" ? "All Warehouses" : selectedOutlet}`
      : activeDesktopTab === "movements"
        ? "Unified log of stock updates, outgoing orders, and manual adjustments."
        : activeDesktopTab === "settings"
          ? "Tune how the inventory workspace behaves for your team."
        : "Manage stock levels, variants, and replenishment across the admin inventory.";

  const overviewSummaryCards = [
    {
      label: "Total Inventory Value",
      value: formatNpr(summary.totalInventoryValue),
      subLabel: "Estimated live value across tracked inventory",
      icon: Wallet,
      tone: "text-emerald-600",
      iconBg: "bg-emerald-50 text-emerald-600",
    },
    {
      label: "Total Inventory Cost",
      value: formatNpr(summary.totalInventoryCost),
      subLabel: "Average acquisition cost across all units",
      icon: ChartColumnBig,
      tone: "text-sky-600",
      iconBg: "bg-sky-50 text-sky-600",
    },
    {
      label: "Total SKUs",
      value: `${summary.totalSkus}`,
      subLabel: "Products and variants currently tracked",
      icon: Boxes,
      tone: "text-emerald-600",
      iconBg: "bg-emerald-50 text-emerald-600",
    },
    {
      label: "Total Inventory Quantity",
      value: `${summary.totalQuantity}`,
      subLabel: "Units available across all outlets",
      icon: Package2,
      tone: "text-emerald-600",
      iconBg: "bg-emerald-50 text-emerald-600",
    },
  ];

  const topSummaryCards = activeDesktopTab === "movements"
    ? [
        { label: "Out this week", value: `${movementSummary.stockOut}`, tone: "text-rose-700", subLabel: "units moved out" },
        { label: "In this week", value: `${movementSummary.stockIn}`, tone: "text-emerald-700", subLabel: "units moved in" },
        { label: "Net movement", value: `${movementSummary.net}`, tone: "text-foreground", subLabel: "weekly net change" },
      ]
    : activeDesktopTab === "inventory"
      ? [
        { label: "Total products", value: `${summary.totalProducts}`, tone: "text-foreground", subLabel: `${summary.outletCount} outlet${summary.outletCount === 1 ? "" : "s"}` },
        { label: "In stock", value: `${summary.inStockCount}`, tone: "text-emerald-700", subLabel: "healthy inventory" },
        { label: "Low stock", value: `${summary.lowStockCount}`, tone: "text-amber-700", subLabel: "needs restocking" },
        { label: "Total value", value: formatNpr(summary.totalInventoryValue), tone: "text-foreground", subLabel: "current inventory value" },
        ]
      : [];

  return (
    <div className="space-y-6">
      <div className="sticky top-3 z-20">
        <div className="rounded-[22px] border border-border/80 bg-background/92 px-3 py-3 shadow-[0_14px_40px_-26px_rgba(15,23,42,0.5)] backdrop-blur">
          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex items-center gap-2 overflow-x-auto">
                {INVENTORY_TABS.map((tab) => {
                  const Icon = tab.icon;
                  const isSelected = activeDesktopTab === tab.id;

                  return (
                    <button
                      key={tab.id}
                      type="button"
                      disabled={tab.disabled}
                      className={cn(
                        "inline-flex items-center gap-2 whitespace-nowrap rounded-2xl border px-4 py-2 text-sm font-medium transition-colors",
                        isSelected
                          ? "border-transparent shadow-sm"
                          : "border-border bg-card text-muted-foreground hover:bg-muted/60",
                        tab.disabled && "cursor-not-allowed opacity-40",
                      )}
                      style={isSelected ? { backgroundColor: "rgba(83, 74, 183, 0.10)", color: INVENTORY_ACCENT } : undefined}
                      onClick={() => {
                        if (tab.disabled) return;
                        handleTabChange(tab.id);
                      }}
                    >
                      <Icon className="h-4 w-4" />
                      {tab.label}
                    </button>
                  );
                })}
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <Select value={selectedOutlet} onValueChange={setSelectedOutlet}>
                  <SelectTrigger className="w-full min-w-[180px] bg-background sm:w-[190px]">
                    <SelectValue placeholder="All outlets" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All outlets</SelectItem>
                    {outlets.map((outlet) => (
                      <SelectItem key={outlet} value={outlet}>
                        {outlet}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {activeDesktopTab === "inventory" ? (
              <div className="flex items-center gap-2 overflow-x-auto pb-1">
                {STATUS_CHIPS.map((chip) => (
                  <button
                    key={chip.id}
                    type="button"
                    className={cn(
                      "whitespace-nowrap rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
                      statusFilter === chip.id
                        ? "border-purple-300 bg-purple-100 text-purple-800"
                        : "border-border bg-card text-muted-foreground",
                    )}
                    onClick={() => setStatusFilter(chip.id)}
                  >
                    {chip.label}
                  </button>
                ))}
                {outlets.map((outlet) => (
                  <button
                    key={outlet}
                    type="button"
                    className={cn(
                      "whitespace-nowrap rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
                      selectedOutlet === outlet
                        ? "border-purple-300 bg-purple-100 text-purple-800"
                        : "border-border bg-card text-muted-foreground",
                    )}
                    onClick={() => setSelectedOutlet(outlet)}
                  >
                    {outlet}
                  </button>
                ))}
              </div>
            ) : activeDesktopTab === "movements" ? (
              <div className="flex items-center gap-2 overflow-x-auto pb-1">
                {MOVEMENT_TYPE_CHIPS.map((chip) => (
                  <button
                    key={chip.id}
                    type="button"
                    className={cn(
                      "whitespace-nowrap rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
                      movementTypeFilter === chip.id
                        ? "border-purple-300 bg-purple-100 text-purple-800"
                        : "border-border bg-card text-muted-foreground",
                    )}
                    onClick={() => setMovementTypeFilter(chip.id)}
                  >
                    {chip.label}
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        </div>
      </div>

      <section className="rounded-[28px] border border-border/70 bg-gradient-to-br from-card via-card to-muted/30 p-5 shadow-sm md:p-6">
        <div className="flex flex-col gap-6">
          <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
            <div className="space-y-2">
              <span
                className="inline-flex w-fit items-center rounded-full border border-transparent px-3 py-1 text-xs font-semibold"
                style={{ backgroundColor: "rgba(83, 74, 183, 0.10)", color: INVENTORY_ACCENT }}
              >
                Inventory workspace
              </span>
              <div>
                <h1 className="text-3xl font-semibold tracking-tight text-foreground">{pageTitle}</h1>
                <p className="mt-2 max-w-2xl text-sm text-muted-foreground">{pageSubtitle}</p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {!isMobile && activeDesktopTab === "movements" ? (
                <Button variant="outline" onClick={exportMovementsCsv}>
                  <Download className="mr-2 h-4 w-4" />
                  Export CSV
                </Button>
              ) : null}
              <Button
                className="border-0 text-white shadow-sm"
                style={{ backgroundColor: INVENTORY_ACCENT }}
                onClick={() => openStockIn()}
              >
                + Stock in
              </Button>
            </div>
          </div>

          {activeDesktopTab === "overview" ? (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              {overviewSummaryCards.map((card) => {
                const Icon = card.icon;
                return (
                  <div
                    key={card.label}
                    className="rounded-[24px] border border-border/70 bg-background/90 p-5 shadow-[0_16px_40px_-28px_rgba(15,23,42,0.35)]"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className={cn("flex h-10 w-10 items-center justify-center rounded-2xl", card.iconBg)}>
                        <Icon className="h-5 w-5" />
                      </div>
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted/60 text-muted-foreground">
                        <ArrowUpRight className="h-4 w-4" />
                      </div>
                    </div>
                    <p className="mt-6 text-sm font-medium text-muted-foreground">{card.label}</p>
                    <p className={cn("mt-2 text-3xl font-semibold tracking-tight", card.tone)}>
                      {summaryLoading ? "..." : card.value}
                    </p>
                    <p className="mt-2 text-xs text-muted-foreground">{card.subLabel}</p>
                  </div>
                );
              })}
            </div>
          ) : null}
        </div>
      </section>

      {topSummaryCards.length ? (
        <div className={cn("grid gap-3", activeDesktopTab === "movements" ? "md:grid-cols-3" : "md:grid-cols-2 xl:grid-cols-4")}>
          {topSummaryCards.map((card) => (
            <div key={card.label} className="rounded-2xl border border-border bg-card p-4 shadow-sm">
              <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">{card.label}</p>
              <p className={cn("mt-3 text-2xl font-semibold", card.tone)}>{summaryLoading ? "..." : card.value}</p>
              <p className="mt-2 text-xs text-muted-foreground">{card.subLabel}</p>
            </div>
          ))}
        </div>
      ) : null}

      {activeDesktopTab === "overview" ? (
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1.35fr)_minmax(320px,0.85fr)]">
          <section className="rounded-[24px] border border-border bg-card p-5 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-foreground">Inventory health</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Quick view of stock readiness before you dive into batches and movement logs.
                </p>
              </div>
            </div>
            <div className="mt-5 grid gap-3 md:grid-cols-3">
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50/70 p-4">
                <p className="text-xs uppercase tracking-[0.18em] text-emerald-700">In stock</p>
                <p className="mt-2 text-2xl font-semibold text-emerald-800">{summary.inStockCount}</p>
                <p className="mt-1 text-xs text-emerald-700/80">Items ready for selling right now</p>
              </div>
              <div className="rounded-2xl border border-amber-200 bg-amber-50/80 p-4">
                <p className="text-xs uppercase tracking-[0.18em] text-amber-700">Low stock</p>
                <p className="mt-2 text-2xl font-semibold text-amber-800">{summary.lowStockCount}</p>
                <p className="mt-1 text-xs text-amber-700/80">Good candidates for a fast replenishment</p>
              </div>
              <div className="rounded-2xl border border-rose-200 bg-rose-50/80 p-4">
                <p className="text-xs uppercase tracking-[0.18em] text-rose-700">Out of stock</p>
                <p className="mt-2 text-2xl font-semibold text-rose-800">{summary.criticalStockCount}</p>
                <p className="mt-1 text-xs text-rose-700/80">Needs immediate action to restore availability</p>
              </div>
            </div>
          </section>

          <section className="rounded-[24px] border border-border bg-card p-5 shadow-sm">
            <h2 className="text-lg font-semibold text-foreground">Recent movement</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Latest stock changes from manual updates and outgoing orders.
            </p>
            <div className="mt-4 space-y-3">
              {movements.slice(0, 4).map((movement) => (
                <div key={movement.id} className="rounded-2xl border border-border/80 bg-muted/20 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium text-foreground">{movement.outlet}</p>
                      <p className="mt-1 text-xs text-muted-foreground">{movement.ref}</p>
                    </div>
                    <span
                      className={cn(
                        "inline-flex rounded-full border px-2.5 py-1 text-[11px] font-medium",
                        movement.type === "stock_out"
                          ? "border-rose-200 bg-rose-50 text-rose-700"
                          : movement.type === "stock_in"
                            ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                            : "border-slate-200 bg-slate-100 text-slate-700",
                      )}
                    >
                      {movement.type === "stock_out" ? "Stock out" : movement.type === "stock_in" ? "Stock in" : "Transfer"}
                    </span>
                  </div>
                  <div className="mt-3 flex items-center justify-between gap-3">
                    <p className="text-xs text-muted-foreground">
                      {formatMovementDate(movement.occurredAt)} at{" "}
                      {new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit" }).format(new Date(movement.occurredAt))}
                    </p>
                    <p className={cn("text-sm font-semibold", movement.type === "stock_out" ? "text-rose-700" : "text-emerald-700")}>
                      {movement.type === "stock_out" ? "-" : "+"}
                      {movement.quantity} units
                    </p>
                  </div>
                  <Button className="mt-3" variant="outline" size="sm" onClick={() => setMovementDetail(movement)}>
                    Details
                  </Button>
                </div>
              ))}
            </div>
          </section>
        </div>
      ) : activeDesktopTab === "settings" ? (
        <div className="grid gap-4 xl:grid-cols-2">
          <section className="rounded-[24px] border border-border bg-card p-5 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-purple-100 text-purple-700">
                <SlidersHorizontal className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-foreground">Workspace preferences</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Control how the inventory workspace opens and behaves for your admin session.
                </p>
              </div>
            </div>

            <div className="mt-5 space-y-4">
              <div className="rounded-2xl border border-border p-4">
                <p className="text-sm font-medium text-foreground">Default opening tab</p>
                <p className="mt-1 text-xs text-muted-foreground">Choose where inventory lands when you return to this page.</p>
                <div className="mt-3">
                  <Select
                    value={settingsDraft.defaultTab}
                    onValueChange={(value) => setSettingsDraft((current) => ({ ...current, defaultTab: value as InventoryTab }))}
                  >
                    <SelectTrigger className="max-w-[220px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="overview">Inventory Overview</SelectItem>
                      <SelectItem value="inventory">Inventory</SelectItem>
                      <SelectItem value="movements">Stock Movements</SelectItem>
                      <SelectItem value="settings">Settings</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                <button
                  type="button"
                  className={cn(
                    "rounded-2xl border p-4 text-left transition-colors",
                    settingsDraft.showOverviewFirst ? "border-purple-300 bg-purple-50" : "border-border bg-background",
                  )}
                  onClick={() => setSettingsDraft((current) => ({ ...current, showOverviewFirst: !current.showOverviewFirst }))}
                >
                  <p className="text-sm font-medium text-foreground">Show overview hero first</p>
                  <p className="mt-1 text-xs text-muted-foreground">Keeps the metrics hero visible before inventory tables.</p>
                </button>
                <button
                  type="button"
                  className={cn(
                    "rounded-2xl border p-4 text-left transition-colors",
                    settingsDraft.preferLowStockFirst ? "border-purple-300 bg-purple-50" : "border-border bg-background",
                  )}
                  onClick={() => setSettingsDraft((current) => ({ ...current, preferLowStockFirst: !current.preferLowStockFirst }))}
                >
                  <p className="text-sm font-medium text-foreground">Prioritize low stock in stock-in drawer</p>
                  <p className="mt-1 text-xs text-muted-foreground">Sorts urgent variants to the top while receiving stock.</p>
                </button>
              </div>
            </div>
          </section>

          <section className="rounded-[24px] border border-border bg-card p-5 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700">
                <CheckCircle2 className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-foreground">Centralized stock source</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Inventory and Products both read and write against the same variant stock records.
                </p>
              </div>
            </div>

            <div className="mt-5 space-y-3">
              {[
                "Stock in updates product variants first, then syncs total product stock.",
                "Batch adjustments now target the exact variant instead of only product size.",
                "Inventory changes invalidate both inventory and product queries for live refresh.",
              ].map((item) => (
                <div key={item} className="flex items-start gap-3 rounded-2xl border border-border/80 bg-muted/20 p-4">
                  <LayoutGrid className="mt-0.5 h-4 w-4 text-purple-700" />
                  <p className="text-sm text-foreground">{item}</p>
                </div>
              ))}
            </div>
          </section>
        </div>
      ) : activeDesktopTab === "inventory" ? (
        <>
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-end">
            <div className="relative md:w-[260px]">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={inventorySearchInput}
                onChange={(event) => setInventorySearchInput(event.target.value)}
                placeholder="Search products..."
                className="pl-9"
              />
            </div>
          </div>

          {isMobile ? (
            <div className="space-y-3">
              {inventoryQuery.isLoading
                ? Array.from({ length: 5 }).map((_, index) => (
                    <div key={index} className="h-36 animate-pulse rounded-2xl border border-border bg-muted/50" />
                  ))
                : inventoryItems.map((item) => (
                    <InventoryCard
                      key={item.id}
                      item={item}
                      onStockIn={openStockIn}
                      onViewBatches={openBatches}
                    />
                  ))}
            </div>
          ) : (
            <>
              <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
                <div className="overflow-x-auto">
                  <table className="min-w-full table-fixed text-sm">
                    <colgroup>
                      <col style={{ width: "30%" }} />
                      <col style={{ width: "14%" }} />
                      <col style={{ width: "10%" }} />
                      <col style={{ width: "14%" }} />
                      <col style={{ width: "12%" }} />
                      <col style={{ width: "10%" }} />
                      <col style={{ width: "10%" }} />
                    </colgroup>
                    <thead className="bg-muted/40 text-left text-xs uppercase tracking-[0.16em] text-muted-foreground">
                      <tr>
                        <th className="px-4 py-3">Product</th>
                        <th className="px-4 py-3">Variant</th>
                        <th className="px-4 py-3">Batch</th>
                        <th className="px-4 py-3">Outlet</th>
                        <th className="px-4 py-3">Avg cost</th>
                        <th className="px-4 py-3">Stock</th>
                        <th className="px-4 py-3">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {inventoryQuery.isLoading
                        ? Array.from({ length: 8 }).map((_, index) => (
                            <tr key={index} className="border-t border-border">
                              <td className="px-4 py-4" colSpan={7}>
                                <div className="h-10 animate-pulse rounded-xl bg-muted" />
                              </td>
                            </tr>
                          ))
                        : paginatedInventory.map((item) => (
                            <tr key={item.id} className="border-t border-border">
                              <td className="px-4 py-4">
                                <div className="flex items-center gap-3">
                                  <div className="h-10 w-10 overflow-hidden rounded-xl border border-border bg-muted">
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
                                    <p className="truncate font-medium text-foreground">{item.name}</p>
                                    <p className="truncate text-xs text-muted-foreground">{item.channel}</p>
                                  </div>
                                </div>
                              </td>
                              <td className="px-4 py-4 text-muted-foreground">{item.variant}</td>
                              <td className="px-4 py-4 text-muted-foreground">{item.batch}</td>
                              <td className="px-4 py-4 text-muted-foreground">{item.outlet}</td>
                              <td className="px-4 py-4">{formatNpr(item.avgCost)}</td>
                              <td className={cn("px-4 py-4 font-medium", item.status !== "in_stock" && "text-rose-700")}>
                                {item.units} units
                              </td>
                              <td className="px-4 py-4">
                                <div className="flex items-center gap-2">
                                  <StatusBadge status={item.status} />
                                  <Button variant="outline" size="sm" onClick={() => openBatches(item)}>
                                    View
                                  </Button>
                                  <Button
                                    size="sm"
                                    className="border-0 text-white"
                                    style={{ backgroundColor: INVENTORY_ACCENT }}
                                    onClick={() => openStockIn(item)}
                                  >
                                    + Stock in
                                  </Button>
                                </div>
                              </td>
                            </tr>
                          ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
                <Pagination
                  currentPage={inventoryPage}
                  totalPages={inventoryTotalPages}
                  onPageChange={setInventoryPage}
                  totalItems={inventoryItems.length}
                  pageSize={inventoryPageSize}
                  onPageSizeChange={setInventoryPageSize}
                />
              </div>
            </>
          )}
        </>
      ) : (
        <>
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-end">
            <div className="relative md:w-[240px]">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={movementSearchInput}
                onChange={(event) => setMovementSearchInput(event.target.value)}
                placeholder="Search by ref..."
                className="pl-9"
              />
            </div>
          </div>
          {isMobile ? (
            <div className="space-y-4">
              {paginatedGroupedMovements.map((group) => (
                <section key={group.label}>
                  <p className="mb-2 text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
                    {group.label}
                  </p>
                  <div className="space-y-3">
                    {group.items.map((movement) => (
                      <MovementCard key={movement.id} movement={movement} onDetails={setMovementDetail} />
                    ))}
                  </div>
                </section>
              ))}
            </div>
          ) : (
            <>
              <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
                <div className="overflow-x-auto">
                  <table className="min-w-full table-fixed text-sm">
                  <colgroup>
                    <col style={{ width: "14%" }} />
                    <col style={{ width: "18%" }} />
                    <col style={{ width: "12%" }} />
                    <col style={{ width: "14%" }} />
                    <col style={{ width: "10%" }} />
                    <col style={{ width: "12%" }} />
                    <col style={{ width: "10%" }} />
                    <col style={{ width: "10%" }} />
                  </colgroup>
                  <thead className="bg-muted/40 text-left text-xs uppercase tracking-[0.16em] text-muted-foreground">
                    <tr>
                      <th className="px-4 py-3">Date + time</th>
                      <th className="px-4 py-3">Outlet</th>
                      <th className="px-4 py-3">Type</th>
                      <th className="px-4 py-3">Ref</th>
                      <th className="px-4 py-3">SKUs</th>
                      <th className="px-4 py-3">Qty</th>
                      <th className="px-4 py-3">Value</th>
                      <th className="px-4 py-3" />
                    </tr>
                  </thead>
                    <tbody>
                      {paginatedGroupedMovements.flatMap((group) => [
                      <tr key={`${group.label}-label`} className="bg-muted/60">
                        <td colSpan={8} className="px-4 py-2 text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
                          {group.label}
                        </td>
                      </tr>,
                      ...group.items.map((movement) => (
                        <tr key={movement.id} className="border-t border-border">
                          <td className="px-4 py-3 text-muted-foreground">
                            {formatMovementDate(movement.occurredAt)} · {new Intl.DateTimeFormat("en-US", {
                              hour: "numeric",
                              minute: "2-digit",
                            }).format(new Date(movement.occurredAt))}
                          </td>
                          <td className="px-4 py-3">{movement.outlet}</td>
                          <td className="px-4 py-3">
                            <span className={cn(
                              "inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-medium",
                              movement.type === "stock_out"
                                ? "border-rose-200 bg-rose-50 text-rose-700"
                                : movement.type === "stock_in"
                                  ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                                  : "border-slate-200 bg-slate-100 text-slate-700",
                            )}>
                              {movement.type === "stock_out" ? "↗" : movement.type === "stock_in" ? "↙" : "↔"}{" "}
                              {movement.type.replace("_", " ")}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-muted-foreground">{movement.ref}</td>
                          <td className="px-4 py-3 text-muted-foreground">{movement.skuCount}</td>
                          <td className={cn("px-4 py-3 font-semibold", movement.type === "stock_out" ? "text-rose-700" : "text-emerald-700")}>
                            {movement.type === "stock_out" ? "-" : "+"}{movement.quantity}
                          </td>
                          <td className="px-4 py-3">{formatNpr(movement.value)}</td>
                          <td className="px-4 py-3 text-right">
                            <Button variant="outline" size="sm" onClick={() => setMovementDetail(movement)}>
                              Details
                            </Button>
                          </td>
                        </tr>
                        )),
                      ])}
                    </tbody>
                  </table>
                </div>
              </div>
              <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
                <Pagination
                  currentPage={movementPage}
                  totalPages={movementTotalPages}
                  onPageChange={setMovementPage}
                  totalItems={movements.length}
                  pageSize={movementPageSize}
                  onPageSizeChange={setMovementPageSize}
                />
              </div>
            </>
          )}
        </>
      )}

      <Dialog
        open={batchDialogOpen}
        onOpenChange={(open) => {
          setBatchDialogOpen(open);
          if (!open) {
            setBatchProductId(null);
            setBatchDraft({});
          }
        }}
      >
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>View batches</DialogTitle>
            <DialogDescription>
              Review variant-level stock and adjust counts where needed.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            {batchItems.map((item) => (
              <div key={item.id} className="flex items-center justify-between gap-3 rounded-xl border border-border p-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-foreground">
                    Batch {item.batch} · {item.variant}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {item.outlet} · {item.channel} · {getStatusLabel(item.status)}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      setBatchDraft((current) => ({
                        ...current,
                        [item.id]: Math.max(0, (current[item.id] ?? item.currentQty) - 1),
                      }))
                    }
                  >
                    -
                  </Button>
                  <Input
                    type="number"
                    min={0}
                    value={batchDraft[item.id] ?? item.currentQty}
                    onChange={(event) =>
                      setBatchDraft((current) => ({
                        ...current,
                        [item.id]: Math.max(0, Number(event.target.value) || 0),
                      }))
                    }
                    className="h-9 w-20 text-center text-sm font-semibold"
                    aria-label={`Stock for ${item.name} ${item.variant}`}
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      setBatchDraft((current) => ({
                        ...current,
                        [item.id]: (current[item.id] ?? item.currentQty) + 1,
                      }))
                    }
                  >
                    +
                  </Button>
                </div>
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBatchDialogOpen(false)}>
              Close
            </Button>
            <Button
              className="border-0 text-white"
              style={{ backgroundColor: INVENTORY_ACCENT }}
              disabled={updateStockMutation.isPending}
              onClick={saveBatchChanges}
            >
              Save changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!movementDetail} onOpenChange={(open) => !open && setMovementDetail(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Movement details</DialogTitle>
            <DialogDescription>
              Review the full stock movement reference, quantity, and outlet context.
            </DialogDescription>
          </DialogHeader>
          {movementDetail ? (
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-2xl border border-border p-4">
                <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Reference</p>
                <p className="mt-2 text-sm font-medium text-foreground">{movementDetail.ref}</p>
              </div>
              <div className="rounded-2xl border border-border p-4">
                <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Outlet</p>
                <p className="mt-2 text-sm font-medium text-foreground">{movementDetail.outlet}</p>
              </div>
              <div className="rounded-2xl border border-border p-4">
                <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Type</p>
                <p className="mt-2 text-sm font-medium capitalize text-foreground">{movementDetail.type.replace("_", " ")}</p>
              </div>
              <div className="rounded-2xl border border-border p-4">
                <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Quantity</p>
                <p className="mt-2 text-sm font-medium text-foreground">{movementDetail.quantity} units</p>
              </div>
              <div className="rounded-2xl border border-border p-4">
                <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Value</p>
                <p className="mt-2 text-sm font-medium text-foreground">{formatNpr(movementDetail.value)}</p>
              </div>
              <div className="rounded-2xl border border-border p-4">
                <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">When</p>
                <p className="mt-2 text-sm font-medium text-foreground">
                  {formatMovementDate(movementDetail.occurredAt)} · {new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit" }).format(new Date(movementDetail.occurredAt))}
                </p>
              </div>
              <div className="rounded-2xl border border-border p-4 sm:col-span-2">
                <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Notes</p>
                <p className="mt-2 text-sm text-foreground">{movementDetail.notes || "No additional notes were stored for this movement."}</p>
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>

      <StockInSheet
        isOpen={stockInOpen}
        products={inventoryItems}
        initialProductId={stockInInitialId}
        defaultLowStockFirst={settingsDraft.preferLowStockFirst}
        onClose={() => {
          if (stockInMutation.isPending) return;
          setStockInOpen(false);
          setStockInInitialId(null);
        }}
        onConfirm={(selections) => stockInMutation.mutate(selections)}
      />
    </div>
  );
}
