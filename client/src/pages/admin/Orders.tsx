import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient, keepPreviousData } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, Receipt } from "lucide-react";
import { Badge } from "@/components/ui/badge";
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
      </div>

      <div className="bg-white dark:bg-card rounded-xl border border-[#E5E5E0] dark:border-border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left min-w-[640px]">
            <thead className="bg-transparent border-b border-[#E5E5E0] dark:border-border text-xs uppercase text-muted-foreground font-semibold tracking-wider">
              <tr>
                <th className="px-4 py-3 font-medium">Order</th>
                <th className="px-4 py-3 font-medium">Customer</th>
                <th className="px-4 py-3 font-medium">Date</th>
                <th className="px-4 py-3 font-medium">Payment</th>
                <th className="px-4 py-3 font-medium">Promo</th>
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
                      <td className="px-4 py-3">
                        <div className="h-3 w-16 bg-muted animate-pulse" />
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="h-3 w-16 bg-muted animate-pulse ml-auto" />
                      </td>
                    </tr>
                  ))
                : orders?.map((order) => {
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
                        className="hover:bg-muted/50 transition-colors"
                      >
                        <td className="px-4 py-3 font-medium text-xs">#{order.id.slice(0, 8)}</td>
                        <td className="px-4 py-3">
                          <div className="font-medium text-[#2C3E2D] dark:text-foreground">
                            {order.fullName}
                          </div>
                          <div className="text-muted-foreground text-xs">
                            {order.email}
                          </div>
                          {order.shippingAddress && (
                            <div className="text-muted-foreground text-xs mt-1">
                              <p>{order.shippingAddress.country}</p>
                              {order.shippingAddress.locationCoordinates && (
                                <div className="pt-2 mt-2 border-t border-border">
                                  <a
                                    href={`https://www.google.com/maps?q=${order.shippingAddress.locationCoordinates}`}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="flex items-center gap-1.5 text-xs font-semibold text-blue-600 hover:text-blue-800 transition-colors uppercase tracking-wider"
                                  >
                                    View on Map
                                  </a>
                                </div>
                              )}
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">
                          {order.createdAt
                            ? new Date(order.createdAt).toLocaleDateString()
                            : ""}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex flex-col gap-1 text-xs">
                            <span className="font-medium capitalize">
                              {order.paymentMethod?.replace(/_/g, " ") ?? "—"}
                            </span>
                            {order.paymentMethod === 'cash_on_delivery' && order.shippingAddress && (
                              <div className="text-[10px] text-muted-foreground/80 mt-0.5 leading-tight flex items-start gap-1">
                                <span className="shrink-0 font-medium">To:</span>
                                <span>
                                  {order.shippingAddress.addressLine1}, {order.shippingAddress.city}
                                  {order.shippingAddress.region && `, ${order.shippingAddress.region}`}
                                </span>
                              </div>
                            )}
                            {order.paymentProofUrl ? (
                              <>
                                <a
                                  href={order.paymentProofUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-blue-600 hover:underline"
                                >
                                  View screenshot
                                </a>
                                {order.paymentVerified == null ? (
                                  <div className="flex gap-1 mt-1">
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      className="h-7 text-xs"
                                      onClick={() =>
                                        verifyMutation.mutate({
                                          id: order.id,
                                          paymentVerified: "verified",
                                        })
                                      }
                                      disabled={verifyMutation.isPending}
                                    >
                                      Verify
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      className="h-7 text-xs text-red-600"
                                      onClick={() =>
                                        verifyMutation.mutate({
                                          id: order.id,
                                          paymentVerified: "rejected",
                                        })
                                      }
                                      disabled={verifyMutation.isPending}
                                    >
                                      Reject
                                    </Button>
                                  </div>
                                ) : (
                                  <Badge
                                    variant="outline"
                                    className={
                                      order.paymentVerified === "verified"
                                        ? "bg-[#E8F3EB] text-[#2C5234] text-[10px]"
                                        : "bg-[#FDECEC] text-[#9A2D2D] text-[10px]"
                                    }
                                  >
                                    {order.paymentVerified}
                                  </Badge>
                                )}
                              </>
                            ) : (
                              order.paymentMethod &&
                              ["esewa", "khalti", "bank"].includes(
                                order.paymentMethod,
                              ) && (
                                <span className="text-muted-foreground">
                                  Awaiting proof
                                </span>
                              )
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          {order.promoCode ? (
                            <div className="flex flex-col gap-1 items-start">
                              <Badge variant="outline" className="text-[10px] uppercase font-bold tracking-wider bg-orange-50 text-orange-600 border-orange-200 dark:bg-orange-950 dark:text-orange-400 dark:border-orange-900">
                                {order.promoCode}
                              </Badge>
                              {(order.promoDiscountAmount ?? 0) > 0 && (
                                <span className="text-[10px] text-muted-foreground font-medium">
                                  -Rs. {order.promoDiscountAmount}
                                </span>
                              )}
                            </div>
                          ) : (
                            <span className="text-muted-foreground text-xs">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <select
                            value={order.status}
                            onChange={(e) =>
                              statusMutation.mutate({
                                id: order.id,
                                status: e.target.value,
                              })
                            }
                            className={cn(
                              "text-xs font-bold uppercase tracking-wider border rounded-md px-2 py-1 appearance-none cursor-pointer focus:outline-none focus:ring-1 focus:ring-primary/20 transition-colors text-center",
                              status === "Completed" ? "bg-[#E8F3EB] text-[#2C5234] border-[#2C5234]/20 dark:bg-green-950 dark:text-green-300 dark:border-green-900" :
                              status === "Pending" ? "bg-[#FFF4E5] text-[#8C5A14] border-[#8C5A14]/20 dark:bg-yellow-950 dark:text-yellow-300 dark:border-yellow-900" :
                              status === "Processing" ? "bg-blue-100 text-blue-700 border-blue-700/20 dark:bg-blue-950 dark:text-blue-300 dark:border-blue-900" :
                              status === "POS" ? "bg-purple-100 text-purple-700 border-purple-700/20 dark:bg-purple-950 dark:text-purple-300 dark:border-purple-900" :
                              "bg-[#FDECEC] text-[#9A2D2D] border-[#9A2D2D]/20 dark:bg-red-950 dark:text-red-300 dark:border-red-900"
                            )}
                          >
                            <option value="pending">⏳ Pending</option>
                            <option value="processing">🔵 Processing</option>
                            <option value="completed">✅ Completed</option>
                            <option value="cancelled">❌ Cancelled</option>
                            <option value="pos">🟣 POS</option>
                          </select>
                          {/* Bill button for completed orders */}
                          {order.status === "completed" && (
                            <div className="mt-2">
                              <BillButton orderId={order.id} />
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right font-medium">
                          {formatPrice(order.total)}
                        </td>
                      </tr>
                    );
                  })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
