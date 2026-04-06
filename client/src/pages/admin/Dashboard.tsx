import { lazy, Suspense, useMemo, useState } from "react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  AlertCircle,
  ArrowRight,
  Clock,
  Package,
  User as UserIcon,
} from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import {
  fetchAdminOrders,
  fetchAdminProducts,
  fetchAdminCustomers,
  exportOrdersCSVInstant,
  type AdminOrder,
  type AdminCustomer,
} from "@/lib/adminApi";
import type { ProductApi, OrderDetail } from "@/lib/api";
import { fetchOrderById } from "@/lib/api";
import { formatPrice } from "@/lib/format";
import { ExportButton } from "@/components/admin/ExportButton";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { fetchAnalytics, type AdminAnalytics } from "@/lib/adminApi";
import OrdersTrendChart from "@/components/admin/OrdersTrendChart";

const DashboardCharts = lazy(() =>
  import("@/components/admin/DashboardCharts").then((module) => ({ default: module.DashboardCharts })),
);

function isSameDay(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

export default function AdminDashboard() {
  const today = new Date();
  const [, setLocation] = useLocation();
  const { user } = useCurrentUser();
  const quickActionBtnClass =
    "group relative h-12 rounded-2xl border px-4 text-[#1C2E1E] dark:text-foreground shadow-[0_8px_22px_rgba(34,63,41,0.12)] transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_14px_30px_rgba(34,63,41,0.18)]";
  const quickActionLightClass =
    "border-[#D6DDCE] bg-gradient-to-br from-white to-[#F2F7F2] dark:from-card dark:to-card/80 hover:border-[#95B39B]";
  const quickActionPrimaryClass =
    "border-[#3C6A47] bg-gradient-to-r from-[#2C5234] to-[#396744] text-white hover:brightness-110";

  const {
    data: orders = [],
    isLoading: ordersLoading,
  } = useQuery<AdminOrder[]>({
    queryKey: ["admin", "orders", { page: 1 }],
    queryFn: () => fetchAdminOrders({ page: 1 }),
  });

  const {
    data: products = [],
    isLoading: productsLoading,
  } = useQuery<ProductApi[]>({
    queryKey: ["admin", "products", { page: 1, limit: 200 }],
    queryFn: () => fetchAdminProducts({ page: 1, limit: 200 }),
  });

  const {
    data: customers = [],
    isLoading: customersLoading,
  } = useQuery<AdminCustomer[]>({
    queryKey: ["admin", "customers", "dashboard"],
    queryFn: () => fetchAdminCustomers(),
  });
  
  const { data: analytics } = useQuery<AdminAnalytics>({
    queryKey: ["admin", "analytics", "dashboard"],
    queryFn: () => fetchAnalytics("7d"), // Default to 7 days for quick overview
  });

  const ordersToday = useMemo(() => {
    return orders.filter((order) => {
      if (!order.createdAt) return false;
      const d = new Date(order.createdAt);
      return isSameDay(d, today);
    });
  }, [orders, today]);

  const todaysRevenue = useMemo(
    () =>
      ordersToday.reduce((sum, order) => {
        return sum + Number(order.total ?? 0);
      }, 0),
    [ordersToday],
  );

  const pendingToday = useMemo(
    () =>
      ordersToday.filter((order) => order.status === "pending").length,
    [ordersToday],
  );

  const lowStockProducts = useMemo(
    () => products.filter((p) => p.stock < 5),
    [products],
  );

  const recentOrders = useMemo(
    () => orders.slice(0, 10),
    [orders],
  );

  const recentCustomers = useMemo(
    () => customers.slice(0, 5),
    [customers],
  );

  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);

  const {
    data: orderDetail,
    isLoading: orderDetailLoading,
  } = useQuery<OrderDetail | null>({
    queryKey: ["admin", "dashboard-order", selectedOrderId],
    queryFn: () =>
      selectedOrderId ? fetchOrderById(selectedOrderId) : Promise.resolve(null),
    enabled: !!selectedOrderId,
  });

  const loadingKpis = ordersLoading && productsLoading && customersLoading;
  const greeting = useMemo(() => {
    const hour = new Date().getHours();
    if (hour >= 5 && hour < 12) return "Good Morning";
    if (hour >= 12 && hour < 17) return "Good Afternoon";
    if (hour >= 17 && hour < 22) return "Good Evening";
    return "Good Night";
  }, []);
  const greetingName = user?.name || user?.email?.split("@")[0] || "there";
  const initials = (user?.name || user?.email || "U")
    .split(/\s+/)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <section className="overflow-hidden rounded-[30px] border border-[#D9E1D3] bg-gradient-to-r from-[#FCF9F1] via-white to-[#F3F7F2] p-6 shadow-[0_20px_40px_rgba(43,62,45,0.08)] dark:border-border dark:from-card dark:via-card dark:to-card/90">
        <div className="flex flex-col gap-6 xl:flex-row xl:items-start xl:justify-between">
          <div className="flex items-center gap-4">
            <Avatar className="h-16 w-16 border border-black/5 shadow-sm dark:border-white/10">
              {user?.profileImageUrl ? (
                <img src={user.profileImageUrl} alt={greetingName} className="object-cover" />
              ) : (
                <AvatarFallback className="bg-muted text-lg font-semibold">{initials}</AvatarFallback>
              )}
            </Avatar>
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.22em] text-[#6D7C6A] dark:text-muted-foreground">
                Dashboard
              </p>
              <h1 className="mt-1 text-3xl font-serif font-medium text-[#2C3E2D] dark:text-foreground">
                {greeting}, {greetingName}
              </h1>
              <p className="mt-2 text-sm text-muted-foreground">
                Here are your live stats for {today.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}.
              </p>
            </div>
          </div>

          <div className="flex justify-start xl:justify-end">
            <Button
              variant="outline"
              className="h-12 rounded-2xl border-[#D6DDCE] bg-white/90 px-5 text-sm font-semibold text-[#1C2E1E] shadow-[0_8px_22px_rgba(34,63,41,0.12)] transition-all duration-300 hover:-translate-y-0.5 hover:border-[#95B39B] hover:bg-white dark:border-border dark:bg-card/70 dark:text-foreground"
              onClick={() => {
                if (typeof window !== "undefined") {
                  window.open("/", "_blank", "noopener,noreferrer");
                }
              }}
            >
              Go to Website
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </div>
        </div>
      </section>

      {/* Today's Summary Row */}
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Today Revenue */}
        <div className="bg-white dark:bg-card rounded-2xl border border-[#E5E5E0] dark:border-border p-5 space-y-2">
          <p className="text-[11px] font-semibold tracking-[0.22em] uppercase text-muted-foreground">
            Today&apos;s Revenue
          </p>
          <p className="text-2xl font-serif font-semibold">
            {formatPrice(todaysRevenue)}
          </p>
          <p className="text-xs text-muted-foreground">
            Based on confirmed orders today
          </p>
        </div>

        {/* Orders today */}
        <div className="bg-white dark:bg-card rounded-2xl border border-[#E5E5E0] dark:border-border p-5 space-y-2">
          <p className="text-[11px] font-semibold tracking-[0.22em] uppercase text-muted-foreground">
            Orders Today
          </p>
          <p className="text-2xl font-serif font-semibold">
            {ordersToday.length.toString()}
          </p>
          <p className="text-xs text-muted-foreground">
            Since midnight ({today.toLocaleDateString()})
          </p>
        </div>

        {/* Pending orders */}
        <div className="bg-white dark:bg-card rounded-2xl border border-[#E5E5E0] dark:border-border p-5 space-y-2 flex flex-col">
          <div className="flex items-center justify-between">
            <p className="text-[11px] font-semibold tracking-[0.22em] uppercase text-muted-foreground">
              Pending Orders
            </p>
            {pendingToday > 0 && (
              <span className="inline-flex w-2 h-2 rounded-full bg-amber-500" />
            )}
          </div>
          <p className="text-2xl font-serif font-semibold">
            {pendingToday.toString()}
          </p>
          <p className="text-xs text-muted-foreground">
            Awaiting fulfillment today
          </p>
        </div>

        {/* Low stock items */}
        <div className="bg-white dark:bg-card rounded-2xl border border-[#E5E5E0] dark:border-border p-5 space-y-2 flex flex-col">
          <div className="flex items-center justify-between">
            <p className="text-[11px] font-semibold tracking-[0.22em] uppercase text-muted-foreground">
              Low Stock Items
            </p>
            {lowStockProducts.length > 0 && (
              <span className="inline-flex w-2 h-2 rounded-full bg-red-500" />
            )}
          </div>
          <p className="text-2xl font-serif font-semibold">
            {lowStockProducts.length.toString()}
          </p>
          <p className="text-xs text-muted-foreground">
            Products with &lt; 5 units in stock
          </p>
        </div>
      </section>

      {/* Quick Actions */}
      <section className="grid grid-cols-1 md:grid-cols-4 gap-3">
        <Button
          variant="outline"
          className={`flex items-center justify-between ${quickActionBtnClass} ${quickActionPrimaryClass}`}
          onClick={() => {
            setLocation("/admin/products/new");
          }}
        >
          <span className="text-sm font-semibold tracking-[0.01em]">Add Product</span>
          <ArrowRight className="h-4 w-4 text-white transition-transform duration-300 group-hover:translate-x-1" />
        </Button>
        <Button
          variant="outline"
          className={`flex items-center justify-between ${quickActionBtnClass} ${quickActionLightClass}`}
          onClick={() => {
            setLocation("/admin/orders");
          }}
        >
          <span className="text-sm font-semibold">View All Orders</span>
          <ArrowRight className="h-4 w-4 text-[#2C5234] transition-transform duration-300 group-hover:translate-x-1 dark:text-foreground" />
        </Button>
        <ExportButton
          onExport={() => exportOrdersCSVInstant()}
          label="Export Report"
          className={`justify-between ${quickActionBtnClass} ${quickActionLightClass}`}
        />
        <Button
          variant="outline"
          className={`flex items-center justify-between ${quickActionBtnClass} ${quickActionLightClass}`}
          onClick={() => {
            setLocation("/admin/customers");
          }}
        >
          <span className="text-sm font-semibold">Manage Customers</span>
          <ArrowRight className="h-4 w-4 text-[#2C5234] transition-transform duration-300 group-hover:translate-x-1 dark:text-foreground" />
        </Button>
      </section>

      <OrdersTrendChart orders={orders} timeRange="7d" />

      <Suspense
        fallback={
          <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="h-[360px] rounded-2xl border border-[#E5E5E0] bg-white dark:bg-card dark:border-border animate-pulse" />
            <div className="h-[360px] rounded-2xl border border-[#E5E5E0] bg-white dark:bg-card dark:border-border animate-pulse" />
          </section>
        }
      >
        <DashboardCharts analytics={analytics} />
      </Suspense>

      {/* Main content row: Recent Orders + Right column */}
      <section className="grid grid-cols-1 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)] gap-6">
        {/* Recent Orders Table */}
        <div className="bg-white dark:bg-card rounded-2xl border border-[#E5E5E0] dark:border-border p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-sm font-semibold tracking-[0.18em] uppercase text-muted-foreground">
                Recent Orders
              </h2>
              <p className="text-xs text-muted-foreground">
                Last 10 orders across the store
              </p>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="border-b border-[#E5E5E0] dark:border-border text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                <tr>
                  <th className="py-2 pr-4 text-left font-semibold">Order#</th>
                  <th className="py-2 pr-4 text-left font-semibold">
                    Customer
                  </th>
                  <th className="py-2 pr-4 text-left font-semibold">Items</th>
                  <th className="py-2 pr-4 text-right font-semibold">
                    Amount
                  </th>
                  <th className="py-2 pr-4 text-left font-semibold">Status</th>
                  <th className="py-2 pl-2 text-right font-semibold">Time</th>
                </tr>
              </thead>
              <tbody>
                {loadingKpis &&
                  Array.from({ length: 5 }).map((_, i) => (
                    <tr key={i} className="border-b border-[#F0F0EB]">
                      <td className="py-3 pr-4">
                        <div className="h-3 w-20 bg-muted animate-pulse rounded" />
                      </td>
                      <td className="py-3 pr-4">
                        <div className="h-3 w-24 bg-muted animate-pulse rounded mb-1" />
                        <div className="h-3 w-32 bg-muted animate-pulse rounded" />
                      </td>
                      <td className="py-3 pr-4">
                        <div className="h-3 w-10 bg-muted animate-pulse rounded" />
                      </td>
                      <td className="py-3 pr-4 text-right">
                        <div className="h-3 w-16 bg-muted animate-pulse rounded ml-auto" />
                      </td>
                      <td className="py-3 pr-4">
                        <div className="h-4 w-20 bg-muted animate-pulse rounded-full" />
                      </td>
                      <td className="py-3 pl-2 text-right">
                        <div className="h-3 w-12 bg-muted animate-pulse rounded ml-auto" />
                      </td>
                    </tr>
                  ))}
                {!loadingKpis &&
                  recentOrders.map((order) => {
                    const created =
                      order.createdAt && new Date(order.createdAt);
                    const timeLabel = created
                      ? created.toLocaleTimeString("en-NP", {
                          hour: "2-digit",
                          minute: "2-digit",
                        })
                      : "";
                    const statusLabel =
                      order.status === "completed"
                        ? "Completed"
                        : order.status === "pending"
                          ? "Pending"
                          : "Cancelled";
                    const statusColor =
                      order.status === "completed"
                        ? "bg-[#E8F3EB] text-[#2C5234]"
                        : order.status === "pending"
                          ? "bg-[#FFF4E5] text-[#8C5A14]"
                          : "bg-[#FDECEC] text-[#9A2D2D]";

                    return (
                      <tr
                        key={order.id}
                        className="border-b border-[#F0F0EB] hover:bg-muted/40 cursor-pointer transition-colors"
                        onClick={() => setSelectedOrderId(order.id)}
                      >
                        <td className="py-3 pr-4 font-medium text-[11px]">
                          {order.id.slice(0, 8)}
                        </td>
                        <td className="py-3 pr-4">
                          <div className="text-[12px] font-medium">
                            {order.fullName}
                          </div>
                          <div className="text-[11px] text-muted-foreground">
                            {order.email}
                          </div>
                        </td>
                        <td className="py-3 pr-4 text-[11px] text-muted-foreground">
                          —
                        </td>
                        <td className="py-3 pr-4 text-right text-[12px] font-semibold">
                          {formatPrice(order.total)}
                        </td>
                        <td className="py-3 pr-4">
                          <span
                            className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] ${statusColor} bg-opacity-90`}
                          >
                            <span className="w-1.5 h-1.5 rounded-full bg-current" />
                            {statusLabel}
                          </span>
                        </td>
                        <td className="py-3 pl-2 text-right text-[11px] text-muted-foreground">
                          {timeLabel}
                        </td>
                      </tr>
                    );
                  })}
                {!loadingKpis && recentOrders.length === 0 && (
                  <tr>
                    <td
                      colSpan={6}
                      className="py-6 text-center text-xs text-muted-foreground"
                    >
                      No orders yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Right column: Low stock + Recent customers */}
        <div className="space-y-4">
          {/* Low Stock Alert Panel */}
          <div className="bg-white dark:bg-card rounded-2xl border border-[#E5E5E0] dark:border-border p-5 space-y-3">
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-2">
                <AlertCircle className="h-4 w-4 text-red-500" />
                <h3 className="text-sm font-semibold tracking-[0.18em] uppercase text-muted-foreground">
                  Low Stock Alerts
                </h3>
              </div>
            </div>
            {lowStockProducts.length === 0 ? (
              <div className="flex items-center gap-2 text-xs text-emerald-700 bg-emerald-50 dark:bg-emerald-950/30 rounded-xl px-3 py-2">
                <span className="w-2 h-2 rounded-full bg-emerald-500" />
                <span className="font-medium">
                  All products well stocked.
                </span>
              </div>
            ) : (
              <div className="space-y-2 max-h-56 overflow-y-auto">
                {lowStockProducts.map((p) => (
                  <div
                    key={p.id}
                    className="flex items-center justify-between text-xs"
                  >
                    <div className="flex items-center gap-2">
                      <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-red-50 text-red-600">
                        <Package className="h-3 w-3" />
                      </span>
                      <span className="font-medium line-clamp-2">
                        {p.name}
                      </span>
                    </div>
                    <Badge className="bg-red-100 text-red-700 border-none text-[11px]">
                      {p.stock} left
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Recent Customers */}
          <div className="bg-white dark:bg-card rounded-2xl border border-[#E5E5E0] dark:border-border p-5 space-y-3">
            <h3 className="text-sm font-semibold tracking-[0.18em] uppercase text-muted-foreground">
              Recent Customers
            </h3>
            <div className="space-y-2">
              {customersLoading &&
                Array.from({ length: 3 }).map((_, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between text-xs"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-muted animate-pulse" />
                      <div>
                        <div className="h-3 w-24 bg-muted animate-pulse rounded mb-1" />
                        <div className="h-3 w-32 bg-muted animate-pulse rounded" />
                      </div>
                    </div>
                  </div>
                ))}
              {!customersLoading &&
                recentCustomers.map((customer) => {
                  const initials = `${customer.firstName[0] ?? ""}${
                    customer.lastName[0] ?? ""
                  }`.toUpperCase();
                  const joined = customer.createdAt
                    ? new Date(customer.createdAt).toLocaleDateString("en-NP", {
                        year: "numeric",
                        month: "short",
                        day: "numeric",
                      })
                    : "";
                  return (
                    <div
                      key={customer.id}
                      className="flex items-center justify-between text-xs"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-[#2D4A35] text-white flex items-center justify-center text-[11px] font-semibold">
                          {initials}
                        </div>
                        <div>
                          <div className="font-medium text-[12px]">
                            {customer.firstName} {customer.lastName}
                          </div>
                          <div className="text-[11px] text-muted-foreground">
                            Joined {joined}
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-[11px] text-muted-foreground">
                          Total spent
                        </div>
                        <div className="text-[12px] font-semibold">
                          {formatPrice(customer.totalSpent)}
                        </div>
                      </div>
                    </div>
                  );
                })}
              {!customersLoading && recentCustomers.length === 0 && (
                <p className="text-xs text-muted-foreground">
                  No customers yet.
                </p>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Order detail sheet */}
      <Sheet
        open={!!selectedOrderId}
        onOpenChange={(open) => {
          if (!open) setSelectedOrderId(null);
        }}
      >
        <SheetContent side="right" className="w-full sm:max-w-md">
          <SheetHeader>
            <SheetTitle>Order Details</SheetTitle>
            <SheetDescription>
              Full breakdown of the selected order.
            </SheetDescription>
          </SheetHeader>
          <div className="mt-4 space-y-4 text-sm">
            {orderDetailLoading && (
              <p className="text-xs text-muted-foreground">Loading…</p>
            )}
            {!orderDetailLoading && !orderDetail && (
              <p className="text-xs text-muted-foreground">
                Unable to load order details.
              </p>
            )}
            {orderDetail && (
              <>
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">Order ID</p>
                  <p className="font-mono text-xs">{orderDetail.id}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">Customer</p>
                  <p className="font-medium">{orderDetail.fullName}</p>
                  <p className="text-xs text-muted-foreground">
                    {orderDetail.email}
                  </p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">Total</p>
                  <p className="font-semibold">
                    {formatPrice(orderDetail.total)}
                  </p>
                </div>
                <div className="space-y-2">
                  <p className="text-xs text-muted-foreground">Items</p>
                  <div className="space-y-1">
                    {orderDetail.items.map((item) => (
                      <div
                        key={item.id}
                        className="flex justify-between text-xs"
                      >
                        <span className="font-mono text-[11px]">
                          {item.productId.slice(0, 6)}… × {item.quantity}
                        </span>
                        <span className="font-medium">
                          {formatPrice(item.quantity * Number(item.unitPrice))}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}

