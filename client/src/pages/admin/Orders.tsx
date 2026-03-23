import { useEffect, useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ViewToggle } from "@/components/admin/ViewToggle";
import { useQuery, useMutation, useQueryClient, keepPreviousData } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, Receipt, Clock, MapPin, Truck, Mail, Phone, Package, ChevronRight, CheckCircle2, Globe } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  exportOrdersCSV,
  fetchAdminOrders,
  updateOrderStatus,
  verifyOrderPayment,
  fetchBillByOrder,
} from "@/lib/adminApi";
import type { AdminOrder, AdminBill } from "@/lib/adminApi";
import { BillViewer } from "@/components/admin/BillViewer";
import { ExportButton } from "@/components/admin/ExportButton";
import { useToast } from "@/hooks/use-toast";
import { formatPrice } from "@/lib/format";
import { cn } from "@/lib/utils";

function BillButton({ orderId }: { orderId: string }) {
  const [showBill, setShowBill] = useState(false);

  const { data, isLoading } = useQuery<AdminBill | null>({
    queryKey: ["bill", "order", orderId],
    queryFn: () => fetchBillByOrder(orderId),
  });

  if (isLoading) return <div className="text-muted-foreground text-xs">Loading bill...</div>;

  if (!data) return (
    <div className="text-muted-foreground text-xs">
      Bill not generated yet.
    </div>
  );

  return (
    <>
      <button
        onClick={() => setShowBill(true)}
        className="view-bill-btn"
      >
        <Receipt size={14} />
        View Bill — {data.billNumber}
      </button>

      {showBill && (
        <div className="bill-modal-overlay" onClick={() => setShowBill(false)}>
          <div className="bill-modal" onClick={e => e.stopPropagation()}>
            <BillViewer bill={data} onClose={() => setShowBill(false)} />
          </div>
        </div>
      )}
    </>
  );
}

export default function AdminOrders() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [viewMode, setViewMode] = useState<"grid" | "list">("list");
  const [timeRange, setTimeRange] = useState<"all" | "1d" | "3d" | "7d">("all");
  const [selectedOrder, setSelectedOrder] = useState<AdminOrder | null>(null);
  const [selectedOrderSn, setSelectedOrderSn] = useState<number | null>(null);
  const [selectedOrderItems, setSelectedOrderItems] = useState<
    Array<{
      id: string;
      productId: string;
      quantity: number;
      unitPrice: string | number;
      product?: { name?: string } | null;
      size?: string;
      color?: string;
    }>
  >([]);
  const [selectedOrderItemsLoading, setSelectedOrderItemsLoading] = useState(false);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const filters = useMemo(
    () => ({
      search: search || undefined,
      status: statusFilter === "all" ? undefined : statusFilter,
    }),
    [search, statusFilter],
  );

  const {
    data: orders,
    isLoading,
    isError,
  } = useQuery<AdminOrder[]>({
    queryKey: ["admin", "orders", filters],
    queryFn: () => fetchAdminOrders(filters),
    staleTime: 60_000,
    placeholderData: keepPreviousData,
  });

  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      updateOrderStatus(id, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "orders"] });
      toast({ title: "Order status updated" });
    },
    onError: () => {
      toast({ title: "Failed to update status" });
    },
  });

  const verifyMutation = useMutation({
    mutationFn: ({
      id,
      paymentVerified,
    }: {
      id: string;
      paymentVerified: "verified" | "rejected";
    }) => verifyOrderPayment(id, paymentVerified),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "orders"] });
      toast({ title: "Payment verification updated" });
    },
    onError: () => {
      toast({ title: "Failed to update verification" });
    },
  });

  const sortedOrders = useMemo(() => {
    if (!orders) return [];
    const now = Date.now();
    const cutoffMs =
      timeRange === "1d"
        ? now - 1 * 24 * 60 * 60 * 1000
        : timeRange === "3d"
          ? now - 3 * 24 * 60 * 60 * 1000
          : timeRange === "7d"
            ? now - 7 * 24 * 60 * 60 * 1000
            : null;

    const filtered =
      cutoffMs === null
        ? orders
        : orders.filter((o) => {
            const t = new Date(o.createdAt).getTime();
            return Number.isFinite(t) && t >= cutoffMs;
          });

    return [...filtered].sort((a, b) => {
      const dateA = new Date(a.createdAt).getTime();
      const dateB = new Date(b.createdAt).getTime();
      // Always latest first (ORDER BY created_at DESC)
      return dateB - dateA;
    });
  }, [orders, timeRange]);

  // Display serial numbers based on creation order (oldest = 1),
  // while still showing the list latest-first.
  const orderSnById = useMemo(() => {
    if (!orders) return new Map<string, number>();
    const now = Date.now();
    const cutoffMs =
      timeRange === "1d"
        ? now - 1 * 24 * 60 * 60 * 1000
        : timeRange === "3d"
          ? now - 3 * 24 * 60 * 60 * 1000
          : timeRange === "7d"
            ? now - 7 * 24 * 60 * 60 * 1000
            : null;

    const filtered =
      cutoffMs === null
        ? orders
        : orders.filter((o) => {
            const t = new Date(o.createdAt).getTime();
            return Number.isFinite(t) && t >= cutoffMs;
          });

    const asc = [...filtered].sort((a, b) => {
      const dateA = new Date(a.createdAt).getTime();
      const dateB = new Date(b.createdAt).getTime();
      return dateA - dateB;
    });

    const map = new Map<string, number>();
    asc.forEach((o, i) => map.set(o.id, i + 1));
    return map;
  }, [orders, timeRange]);

  const orderTypeBadge = (order: AdminOrder) => {
    const isPos = order.source === "pos";
    return (
      <Badge
        variant="outline"
        className={
          isPos
            ? "bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950 dark:text-purple-300 dark:border-purple-900"
            : "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950 dark:text-blue-300 dark:border-blue-900"
        }
      >
        {isPos ? "POS ORDER" : "ONLINE ORDER"}
      </Badge>
    );
  };

  const formatOrderStatusBadge = (status: string) => {
    const normalized = status?.toLowerCase?.() ?? status;
    const statusMap: Record<string, { label: string; className: string }> = {
      pending: {
        label: "Pending",
        className:
          "bg-[#FFF4E5] text-[#8C5A14] border-[#8C5A14]/20 dark:bg-yellow-950 dark:text-yellow-400 dark:border-yellow-900",
      },
      processing: {
        label: "Processing",
        className:
          "bg-blue-100 text-blue-700 border-blue-700/20 dark:bg-blue-950 dark:text-blue-300 dark:border-blue-900",
      },
      completed: {
        label: "Completed",
        className:
          "bg-[#E8F3EB] text-[#2C5234] border-[#2C5234]/20 dark:bg-green-950 dark:text-green-300 dark:border-green-900",
      },
      cancelled: {
        label: "Cancelled",
        className:
          "bg-[#FDECEC] text-[#9A2D2D] border-[#9A2D2D]/20 dark:bg-red-950 dark:text-red-300 dark:border-red-900",
      },
      pos: {
        label: "POS",
        className:
          "bg-purple-100 text-purple-700 border-purple-700/20 dark:bg-purple-950 dark:text-purple-300 dark:border-purple-900",
      },
    };

    const entry = statusMap[normalized] ?? { label: normalized, className: "bg-muted text-foreground" };
    return <Badge variant="outline" className={entry.className}>{entry.label}</Badge>;
  };

  useEffect(() => {
    if (!selectedOrder) {
      setSelectedOrderItems([]);
      setSelectedOrderItemsLoading(false);
      return;
    }

    let cancelled = false;
    setSelectedOrderItemsLoading(true);
    setSelectedOrderItems([]);

    fetch(`/api/orders/${selectedOrder.id}`, { credentials: "include" })
      .then((r) => r.json())
      .then((json) => {
        if (cancelled) return;
        setSelectedOrderItems(json?.data?.items ?? []);
      })
      .catch(() => {
        if (cancelled) return;
        setSelectedOrderItems([]);
      })
      .finally(() => {
        if (cancelled) return;
        setSelectedOrderItemsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [selectedOrder?.id]);

  const orderItemsSubtotal = useMemo(() => {
    return selectedOrderItems.reduce((sum, it) => {
      const unit = Number(it.unitPrice) || 0;
      return sum + unit * (it.quantity || 0);
    }, 0);
  }, [selectedOrderItems]);

  const discountAmount = selectedOrder?.promoDiscountAmount ?? 0;

  const { data: posBill } = useQuery<AdminBill | null>({
    queryKey: ["bill", "order", selectedOrder?.id],
    enabled: !!selectedOrder && selectedOrder.source === "pos",
    queryFn: () => {
      if (!selectedOrder) return Promise.resolve(null);
      return fetchBillByOrder(selectedOrder.id);
    },
    staleTime: 0,
    retry: false,
  });

  const STATUS_TABS = ['All', 'Pending', 'Processing', 'Completed', 'Cancelled', 'POS'];

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-serif font-medium text-[#2C3E2D] dark:text-foreground">
            Orders
          </h1>
          <p className="text-muted-foreground mt-1">
            {orders?.length ?? 0} orders • {statusFilter === 'all' ? 'All' : statusFilter.charAt(0).toUpperCase() + statusFilter.slice(1)}
          </p>
        </div>
        <ExportButton onExport={() => exportOrdersCSV()} />
      </div>

      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center">
        <div className="relative w-full max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search orders, customers..."
            className="pl-9 bg-white dark:bg-card border-[#E5E5E0] dark:border-border rounded-full h-11"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="flex gap-2 flex-wrap">
          {STATUS_TABS.map(tab => (
            <button
              key={tab}
              onClick={() => setStatusFilter(tab === 'All' ? 'all' : tab.toLowerCase())}
              className={cn(
                "px-3 py-1 rounded-full text-xs font-medium border transition-all",
                (tab === 'All' ? statusFilter === 'all' : statusFilter === tab.toLowerCase())
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-background text-muted-foreground border-border hover:border-primary hover:text-foreground"
              )}
            >
              {tab}
            </button>
          ))}
        </div>

        <div className="ml-auto sm:ml-0 flex items-center gap-3">
           <p className="text-xs font-medium text-muted-foreground hidden sm:block">
             {orders?.length ?? 0} orders found
           </p>
           <div className="flex items-center gap-2 border-l border-border pl-3 ml-1">
             <div className="flex items-center gap-1.5 bg-white dark:bg-card border border-[#E5E5E0] dark:border-border rounded-lg px-2 py-1 shadow-sm">
               <Clock className="h-3 w-3 text-muted-foreground" />
               <Select
                 value={timeRange}
                 onValueChange={(v) => setTimeRange(v as "all" | "1d" | "3d" | "7d")}
               >
                 <SelectTrigger className="h-7 border-0 bg-transparent px-0 shadow-none focus:ring-0 text-xs font-medium">
                   <SelectValue />
                 </SelectTrigger>
                 <SelectContent>
                   <SelectItem value="all">All time</SelectItem>
                   <SelectItem value="1d">Last 1 day</SelectItem>
                   <SelectItem value="3d">Last 3 days</SelectItem>
                   <SelectItem value="7d">Last 7 days</SelectItem>
                 </SelectContent>
               </Select>
             </div>
             <ViewToggle view={viewMode} onViewChange={setViewMode} />
           </div>
        </div>
      </div>

      <AnimatePresence mode="wait">
        {viewMode === "list" ? (
          <motion.div
            key="list"
            initial={{ opacity: 0, scale: 0.99 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.99 }}
            transition={{ duration: 0.2 }}
            className="bg-white dark:bg-card rounded-xl border border-[#E5E5E0] dark:border-border overflow-hidden"
          >
            <div className="overflow-x-auto">
          <table className="w-full text-sm text-left min-w-[640px]">
            <thead className="bg-transparent border-b border-[#E5E5E0] dark:border-border text-xs uppercase text-muted-foreground font-semibold tracking-wider">
              <tr>
                <th className="px-4 py-3 font-medium">S.N</th>
                <th className="px-4 py-3 font-medium">Customer</th>
                <th className="px-4 py-3 font-medium">Date</th>
                <th className="px-4 py-3 font-medium">Payment</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium text-right">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E5E5E0] dark:divide-border">
              {isLoading || isError
                ? Array.from({ length: 6 }).map((_, i) => (
                    <tr key={i}>
                      <td className="px-4 py-3">
                        <div className="h-3 w-24 bg-muted animate-pulse" />
                      </td>
                      <td className="px-4 py-3">
                        <div className="h-3 w-32 bg-muted animate-pulse mb-2" />
                        <div className="h-3 w-40 bg-muted animate-pulse" />
                      </td>
                      <td className="px-4 py-3">
                        <div className="h-3 w-20 bg-muted animate-pulse" />
                      </td>
                      <td className="px-4 py-3">
                        <div className="h-6 w-20 bg-muted rounded-full animate-pulse" />
                      </td>
                      <td className="px-4 py-3">
                        <div className="h-4 w-12 bg-muted rounded-full animate-pulse" />
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="h-3 w-16 bg-muted animate-pulse ml-auto" />
                      </td>
                    </tr>
                  ))
                : sortedOrders.map((order, idx) => {
                    const statusMap: Record<string, string> = {
                      pending: 'Pending',
                      processing: 'Processing',
                      completed: 'Completed',
                      cancelled: 'Cancelled',
                      pos: 'POS',
                    };
                    const status = statusMap[order.status] ?? order.status;
                    return (
                      <tr
                        key={order.id}
                        className="hover:bg-muted/50 transition-colors cursor-pointer"
                        onClick={() => {
                          setSelectedOrder(order);
                          setSelectedOrderSn(orderSnById.get(order.id) ?? idx + 1);
                        }}
                      >
                        <td className="px-4 py-3 font-medium text-xs">{orderSnById.get(order.id) ?? idx + 1}</td>
                        <td className="px-4 py-3">
                          <div className="font-medium text-[#2C3E2D] dark:text-foreground">
                            {order.fullName}
                          </div>
                          <div className="text-muted-foreground text-xs">
                            {order.email}
                          </div>
                          {order.country && (
                            <div className="text-muted-foreground text-xs mt-1">
                              <p>{order.country}</p>
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">
                          {order.createdAt ? (
                            <div className="flex flex-col">
                              <span className="font-medium text-foreground">{format(new Date(order.createdAt), "MMM d, yyyy")}</span>
                              <span className="text-[10px]">{format(new Date(order.createdAt), "h:mm a")}</span>
                            </div>
                          ) : (
                            "—"
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex flex-col gap-1 text-xs">
                            <span className="font-medium capitalize">
                              {order.paymentMethod?.replace(/_/g, " ") ?? "—"}
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <Badge
                            className={cn(
                              "text-[10px] font-bold uppercase tracking-wider",
                              status === "Completed" ? "bg-[#E8F3EB] text-[#2C5234] border-[#2C5234]/20 dark:bg-green-950 dark:text-green-300 dark:border-green-900" :
                              status === "Pending" ? "bg-[#FFF4E5] text-[#8C5A14] border-[#8C5A14]/20 dark:bg-yellow-950 dark:text-yellow-300 dark:border-yellow-900" :
                              status === "Processing" ? "bg-blue-100 text-blue-700 border-blue-700/20 dark:bg-blue-950 dark:text-blue-300 dark:border-blue-900" :
                              status === "POS" ? "bg-purple-100 text-purple-700 border-purple-700/20 dark:bg-purple-950 dark:text-purple-300 dark:border-purple-900" :
                              "bg-[#FDECEC] text-[#9A2D2D] border-[#9A2D2D]/20 dark:bg-red-950 dark:text-red-300 dark:border-red-900"
                            )}>
                            {status}
                          </Badge>
                        </td>
                        <td className="px-4 py-3 text-right font-medium">
                          {formatPrice((order.total ?? 0) - (order.discountAmount ?? 0))}
                        </td>
                      </tr>
                    );
                  })}
            </tbody>
          </table>
        </div>
      </motion.div>
    ) : (
      <motion.div
        key="grid"
        initial={{ opacity: 0, scale: 0.99 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.99 }}
        transition={{ duration: 0.2 }}
        className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6"
      >
        {isLoading || isError
          ? Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="bg-card rounded-xl border border-border p-5 space-y-4 animate-pulse">
                <div className="flex justify-between items-start">
                  <div className="h-4 w-24 bg-muted rounded" />
                  <div className="h-4 w-16 bg-muted rounded" />
                </div>
                <div className="space-y-2">
                  <div className="h-3 w-32 bg-muted rounded" />
                  <div className="h-3 w-40 bg-muted rounded" />
                </div>
                <div className="h-10 w-full bg-muted rounded" />
              </div>
            ))
          : sortedOrders.map((order, idx) => {
              const status = order.status.charAt(0).toUpperCase() + order.status.slice(1);
              return (
                <div 
                  key={order.id} 
                  className="bg-card rounded-xl border border-border p-5 hover:shadow-lg transition-shadow bg-white dark:bg-card cursor-pointer"
                  onClick={() => {
                    setSelectedOrder(order);
                    setSelectedOrderSn(orderSnById.get(order.id) ?? idx + 1);
                  }}
                >
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                        S.N {orderSnById.get(order.id) ?? idx + 1}
                      </p>
                      <h3 className="font-serif font-medium text-base mt-1">{order.fullName}</h3>
                    </div>
                    <Badge
                      className={cn(
                        "text-[10px] font-bold uppercase tracking-wider",
                        order.status === "completed" ? "bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-400" :
                        order.status === "pending" ? "bg-yellow-100 text-yellow-700 dark:bg-yellow-950 dark:text-yellow-400" :
                        "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-400"
                      )}
                    >
                      {status}
                    </Badge>
                  </div>
                  
                  <div className="space-y-3 mb-6">
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>Date</span>
                      <span className="font-medium text-foreground">{format(new Date(order.createdAt), "MMM d, yyyy")}</span>
                    </div>
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>Payment</span>
                      <span className="uppercase">{order.paymentMethod || 'Manual'}</span>
                    </div>
                    <div className="flex justify-between items-center py-2 border-t border-dashed border-border mt-2">
                      <span className="text-sm font-medium">Total Amount</span>
                      <span className="text-lg font-bold">{formatPrice(order.total)}</span>
                    </div>
                  </div>

                  <div className="flex flex-col gap-2 mt-4">
                    <Button
                      variant="outline"
                      className="w-full text-xs font-bold uppercase tracking-wider"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedOrder(order);
                        setSelectedOrderSn(orderSnById.get(order.id) ?? idx + 1);
                      }}
                    >
                      Manage Order <ChevronRight className="w-4 h-4 ml-1" />
                    </Button>
                  </div>
                </div>
              );
            })}
      </motion.div>
    )}
  </AnimatePresence>

      {/* Sliding Drawer for Order Details */}
      <Sheet
        open={!!selectedOrder}
        onOpenChange={(open) => {
          if (!open) {
            setSelectedOrder(null);
            setSelectedOrderSn(null);
            setSelectedOrderItems([]);
          }
        }}
      >
        <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto p-0 flex flex-col bg-[#FDFDFB] dark:bg-card border-l border-[#E5E5E0] dark:border-border">
          {selectedOrder && (
            <>
              <div className="p-6 border-b border-border/50 flex-none space-y-4">
                <SheetHeader className="space-y-1">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="outline" className="text-[10px] font-bold uppercase tracking-widest bg-muted">
                        S.N {selectedOrderSn ?? "—"}
                      </Badge>
                      {orderTypeBadge(selectedOrder)}
                      {formatOrderStatusBadge(selectedOrder.status)}
                    </div>
                    <span className="text-xs font-medium text-muted-foreground whitespace-nowrap">
                      {format(new Date(selectedOrder.createdAt), "MMM d, yyyy • h:mm a")}
                    </span>
                  </div>
                  <SheetTitle className="text-2xl font-serif text-[#2C3E2D] dark:text-foreground pt-2">
                    {selectedOrder.fullName}
                  </SheetTitle>
                  <div className="space-y-1">
                    <SheetDescription className="text-sm">
                      {selectedOrder.email}
                    </SheetDescription>
                    <div className="text-sm text-muted-foreground flex items-center gap-2">
                      <Phone className="w-4 h-4" />
                      <span>Customer Phone: {selectedOrder.phoneNumber ?? "—"}</span>
                    </div>
                  </div>
                </SheetHeader>
                
                <div className="flex items-center gap-2">
                  <Select
                    value={selectedOrder.status}
                    onValueChange={(val) => {
                      statusMutation.mutate({
                        id: selectedOrder.id,
                        status: val,
                      });
                      setSelectedOrder(prev => prev ? { ...prev, status: val } : null);
                    }}
                  >
                    <SelectTrigger className={cn(
                        "h-10 text-xs font-bold uppercase tracking-wider rounded-md",
                        selectedOrder.status === "completed" ? "bg-[#E8F3EB] text-[#2C5234] border-[#2C5234]/20" :
                        selectedOrder.status === "pending" ? "bg-[#FFF4E5] text-[#8C5A14] border-[#8C5A14]/20" :
                        selectedOrder.status === "processing" ? "bg-blue-100 text-blue-700 border-blue-700/20" :
                        selectedOrder.status === "pos" ? "bg-purple-100 text-purple-700 border-purple-700/20" :
                        "bg-[#FDECEC] text-[#9A2D2D] border-[#9A2D2D]/20"
                      )}>
                      <SelectValue placeholder="Update Status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pending">⏳ Pending</SelectItem>
                      <SelectItem value="processing">🔵 Processing</SelectItem>
                      <SelectItem value="completed">✅ Completed</SelectItem>
                      <SelectItem value="cancelled">❌ Cancelled</SelectItem>
                      <SelectItem value="pos">🟣 POS</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="p-6 space-y-8 flex-1">
                {/* Items Ordered */}
                <div className="space-y-3">
                  <h4 className="text-xs font-bold uppercase tracking-widest text-[#2C3E2D] dark:text-foreground/80">
                    Items Ordered
                  </h4>
                  <div className="bg-white dark:bg-muted/30 border border-[#E5E5E0] dark:border-border rounded-xl p-4 shadow-sm">
                    {selectedOrderItemsLoading ? (
                      <div className="space-y-3">
                        {Array.from({ length: 4 }).map((_, i) => (
                          <div key={i} className="h-12 bg-muted rounded-lg animate-pulse" />
                        ))}
                      </div>
                    ) : selectedOrderItems.length === 0 ? (
                      <p className="text-sm text-muted-foreground">No items found.</p>
                    ) : (
                      <div className="space-y-3">
                        {selectedOrderItems.map((it) => {
                          const qty = Number(it.quantity) || 0;
                          const unit = Number(it.unitPrice) || 0;
                          const lineSubtotal = qty * unit;
                          return (
                            <div
                              key={it.id}
                              className="flex items-start justify-between gap-3 border border-border/50 rounded-xl p-3 bg-card/60"
                            >
                              <div className="flex-1 min-w-0">
                                <p className="font-medium text-sm truncate">
                                  {it.product?.name ?? "Unknown Product"}
                                </p>
                                <p className="text-[10px] text-muted-foreground uppercase tracking-[0.2em] mt-1">
                                  Size: {it.size ?? "—"} • Color: {it.color ?? "—"}
                                </p>
                                <p className="text-[11px] text-muted-foreground mt-2">
                                  Qty: {qty} • Unit: {formatPrice(unit)}
                                </p>
                              </div>
                              <div className="text-right">
                                <p className="text-sm font-bold">{formatPrice(lineSubtotal)}</p>
                                <p className="text-[10px] text-muted-foreground uppercase tracking-widest mt-1">
                                  Subtotal
                                </p>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>

                {/* Payment Section */}
                <div className="space-y-3">
                  <h4 className="text-xs font-bold uppercase tracking-widest text-[#2C3E2D] dark:text-foreground/80 flex items-center gap-2">
                    <Receipt className="w-4 h-4" /> Payment Details
                  </h4>
                  <div className="bg-white dark:bg-muted/30 border border-[#E5E5E0] dark:border-border rounded-xl p-4 space-y-3 shadow-sm">
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-muted-foreground">Method</span>
                      <span className="font-medium capitalize">{selectedOrder.paymentMethod?.replace(/_/g, " ") ?? "—"}</span>
                    </div>
                    <div className="pt-2 border-t border-dashed border-border/50 space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Subtotal</span>
                        <span>{formatPrice(selectedOrder.total ?? 0)}</span>
                      </div>

                      {(selectedOrder.discountAmount ?? 0) > 0 && (
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">Discount</span>
                          <span className="text-green-500">
                            - {formatPrice(selectedOrder.discountAmount ?? 0)}
                          </span>
                        </div>
                      )}

                      <div className="flex justify-between text-sm font-semibold border-t pt-2 mt-1">
                        <span>Total Paid</span>
                        <span>{formatPrice((selectedOrder.total ?? 0) - (selectedOrder.discountAmount ?? 0))}</span>
                      </div>
                    </div>

                    {selectedOrder.paymentProofUrl && (
                      <div className="pt-3 border-t border-border/50">
                        <div className="flex items-center justify-between mb-2">
                          <a
                            href={selectedOrder.paymentProofUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs font-semibold text-blue-600 hover:text-blue-800 transition-colors"
                          >
                            View screenshot
                          </a>
                          {selectedOrder.paymentVerified == null ? (
                            <div className="flex gap-2">
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-7 text-[10px] font-bold tracking-wider"
                                onClick={() => {
                                  verifyMutation.mutate({ id: selectedOrder.id, paymentVerified: "verified" });
                                  setSelectedOrder(prev => prev ? { ...prev, paymentVerified: "verified" } : null);
                                }}
                              >
                                <CheckCircle2 className="w-3 h-3 mr-1 text-green-600" /> Verify
                              </Button>
                            </div>
                          ) : (
                            <Badge
                              variant="outline"
                              className={
                                selectedOrder.paymentVerified === "verified"
                                  ? "bg-[#E8F3EB] text-[#2C5234] text-[10px]"
                                  : "bg-[#FDECEC] text-[#9A2D2D] text-[10px]"
                              }
                            >
                              {selectedOrder.paymentVerified}
                            </Badge>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Delivery & Shipping Section */}
                <div className="space-y-3">
                  <h4 className="text-xs font-bold uppercase tracking-widest text-[#2C3E2D] dark:text-foreground/80 flex items-center gap-2">
                    <Truck className="w-4 h-4" /> Delivery Information
                  </h4>
                  <div className="bg-white dark:bg-muted/30 border border-[#E5E5E0] dark:border-border rounded-xl p-4 shadow-sm">
                    
                    <div className="mb-4 pb-4 border-b border-border/50 grid grid-cols-2 gap-4">
                      <div>
                         <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider mb-1">Source</p>
                         <p className="text-sm font-medium capitalize flex items-center gap-1.5">
                           {selectedOrder.source === 'instagram' ? <Globe className="w-3 h-3 text-pink-600"/> :
                            selectedOrder.source === 'tiktok' ? <Globe className="w-3 h-3"/> :
                            selectedOrder.source === 'pos' ? <Package className="w-3 h-3 text-purple-600"/> :
                            <Globe className="w-3 h-3 text-blue-600"/> }
                           {selectedOrder.source || 'Website'}
                         </p>
                      </div>
                      <div>
                         <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider mb-1">Provider</p>
                         {selectedOrder.deliveryRequired === false ? (
                           <Badge variant="outline" className="text-[10px]">No Delivery</Badge>
                         ) : (
                           <p className="text-sm font-medium capitalize text-[#2C3E2D] dark:text-foreground">
                             {selectedOrder.deliveryProvider ? selectedOrder.deliveryProvider.replace(/_/g, " ") : 'Not Assigned'}
                           </p>
                         )}
                      </div>
                    </div>

                    {selectedOrder.source === "pos" ? (
                      <div className="space-y-3 mt-3">
                        <div>
                          <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider mb-1">
                            Staff Created
                          </p>
                          <p className="text-sm font-medium text-foreground">
                            {posBill?.processedBy ?? "—"}
                          </p>
                        </div>
                        <Badge variant="outline" className="text-[10px]">
                          POS order (no delivery address)
                        </Badge>
                      </div>
                    ) : selectedOrder.deliveryRequired !== false && (
                      <div className="space-y-4">
                        <div>
                          <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider mb-1">
                            Delivery Location
                          </p>
                          <p className="text-sm font-medium text-foreground">
                            {selectedOrder.deliveryLocation ?? "—"}
                          </p>
                        </div>
                        {selectedOrder.deliveryAddress ? (
                          <div>
                            <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider mb-1">Custom Delivery Address</p>
                            <p className="text-sm font-medium text-foreground">{selectedOrder.deliveryAddress}</p>
                          </div>
                        ) : selectedOrder.addressLine1 ? (
                          <div>
                            <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider mb-1">Delivery Address</p>
                            <div className="text-sm font-medium text-foreground leading-relaxed">
                              {selectedOrder.addressLine1}, {selectedOrder.city}
                              {selectedOrder.region && `, ${selectedOrder.region}`}
                              {selectedOrder.postalCode && ` ${selectedOrder.postalCode}`}
                              {selectedOrder.country ? `, ${selectedOrder.country}` : ""}
                              <div className="text-muted-foreground mt-1 text-xs">
                                Customer Phone: {selectedOrder.phoneNumber ?? "—"}
                              </div>
                            </div>
                            
                            {selectedOrder.locationCoordinates && (
                              <div className="mt-3">
                                <a
                                  href={`https://www.google.com/maps?q=${selectedOrder.locationCoordinates}`}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="inline-flex items-center gap-1.5 text-xs font-bold py-1.5 px-3 rounded-full bg-blue-50 text-blue-700 hover:bg-blue-100 transition-colors"
                                >
                                  <MapPin className="w-3 h-3" /> View Map Location
                                </a>
                              </div>
                            )}
                          </div>
                        ) : (
                          <p className="text-sm text-muted-foreground italic">No address provided.</p>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* Additional Actions */}
                {selectedOrder.status === "completed" && (
                  <div className="pt-4 border-t border-border">
                    <BillButton orderId={selectedOrder.id} />
                  </div>
                )}
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
