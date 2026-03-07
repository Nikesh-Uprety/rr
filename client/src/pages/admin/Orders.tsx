import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  exportOrdersCSV,
  fetchAdminOrders,
  updateOrderStatus,
  verifyOrderPayment,
  type AdminOrder,
} from "@/lib/adminApi";
import { useToast } from "@/hooks/use-toast";
import { formatPrice } from "@/lib/format";

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

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-serif font-medium text-[#2C3E2D] dark:text-foreground">
            Orders
          </h1>
          <p className="text-muted-foreground mt-1">
            {orders?.length ?? 0} orders • All
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            className="bg-white dark:bg-card border-[#E5E5E0] dark:border-border text-[#2C3E2D] dark:text-foreground"
            onClick={() =>
              setStatusFilter((prev) =>
                prev === "all" ? "pending" : "all",
              )
            }
          >
            {statusFilter === "all" ? "All Status" : "Pending Only"}
          </Button>
          <Button
            variant="outline"
            className="bg-white dark:bg-card border-[#E5E5E0] dark:border-border text-[#2C3E2D] dark:text-foreground"
            onClick={() => exportOrdersCSV()}
          >
            Export CSV
          </Button>
        </div>
      </div>

      <div className="relative w-full max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search orders, customers..."
          className="pl-9 bg-white dark:bg-card border-[#E5E5E0] dark:border-border rounded-full h-11"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <div className="bg-white dark:bg-card rounded-xl border border-[#E5E5E0] dark:border-border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-transparent border-b border-[#E5E5E0] dark:border-border text-xs uppercase text-muted-foreground font-semibold tracking-wider">
              <tr>
                <th className="px-6 py-4 font-medium">Order</th>
                <th className="px-6 py-4 font-medium">Customer</th>
                <th className="px-6 py-4 font-medium">Date</th>
                <th className="px-6 py-4 font-medium">Payment</th>
                <th className="px-6 py-4 font-medium">Status</th>
                <th className="px-6 py-4 font-medium text-right">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E5E5E0] dark:divide-border">
              {isLoading || isError
                ? Array.from({ length: 6 }).map((_, i) => (
                    <tr key={i}>
                      <td className="px-6 py-4">
                        <div className="h-3 w-24 bg-muted animate-pulse" />
                      </td>
                      <td className="px-6 py-4">
                        <div className="h-3 w-32 bg-muted animate-pulse mb-2" />
                        <div className="h-3 w-40 bg-muted animate-pulse" />
                      </td>
                      <td className="px-6 py-4">
                        <div className="h-3 w-20 bg-muted animate-pulse" />
                      </td>
                      <td className="px-6 py-4">
                        <div className="h-6 w-20 bg-muted rounded-full animate-pulse" />
                      </td>
                      <td className="px-6 py-4">
                        <div className="h-3 w-16 bg-muted animate-pulse" />
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="h-3 w-16 bg-muted animate-pulse ml-auto" />
                      </td>
                    </tr>
                  ))
                : orders?.map((order) => {
                    const status =
                      order.status === "completed"
                        ? "Completed"
                        : order.status === "pending"
                          ? "Pending"
                          : "Cancelled";
                    return (
                      <tr
                        key={order.id}
                        className="hover:bg-muted/50 transition-colors"
                      >
                        <td className="px-6 py-4 font-medium">{order.id}</td>
                        <td className="px-6 py-4">
                          <div className="font-medium text-[#2C3E2D] dark:text-foreground">
                            {order.fullName}
                          </div>
                          <div className="text-muted-foreground text-xs">
                            {order.email}
                          </div>
                        </td>
                        <td className="px-6 py-4 text-muted-foreground">
                          {order.createdAt
                            ? new Date(order.createdAt).toLocaleDateString()
                            : ""}
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex flex-col gap-1 text-xs">
                            <span className="font-medium capitalize">
                              {order.paymentMethod?.replace(/_/g, " ") ?? "—"}
                            </span>
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
                        <td className="px-6 py-4">
                          <select
                            value={order.status}
                            onChange={(e) =>
                              statusMutation.mutate({
                                id: order.id,
                                status: e.target.value,
                              })
                            }
                            className="text-xs bg-transparent"
                          >
                            <option value="pending">Pending</option>
                            <option value="completed">Completed</option>
                            <option value="cancelled">Cancelled</option>
                          </select>
                          <Badge
                            variant="outline"
                            className={`ml-2 border-none ${
                              status === "Completed"
                                ? "bg-[#E8F3EB] text-[#2C5234] dark:bg-green-950 dark:text-green-300"
                                : status === "Pending"
                                  ? "bg-[#FFF4E5] text-[#8C5A14] dark:bg-yellow-950 dark:text-yellow-300"
                                  : "bg-[#FDECEC] text-[#9A2D2D] dark:bg-red-950 dark:text-red-300"
                            }`}
                          >
                            {status}
                          </Badge>
                        </td>
                        <td className="px-6 py-4 text-right font-medium">
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