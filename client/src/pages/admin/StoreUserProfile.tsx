import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocation, useRoute } from "wouter";
import { format, formatDistanceToNow } from "date-fns";
import {
  Activity,
  ArrowLeft,
  BadgeCheck,
  Briefcase,
  CalendarDays,
  CreditCard,
  PackagePlus,
  Receipt,
  Save,
  Shield,
  ShoppingBag,
  UserCircle2,
} from "lucide-react";

import { apiRequest } from "@/lib/queryClient";
import { getRoleLabel } from "@/lib/adminAccess";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useToast } from "@/hooks/use-toast";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { ADMIN_PAGE_KEYS } from "@shared/auth-policy";

type StoreUserOverview = {
  profile: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
    language: string;
    timezone: string;
    department: string;
    role: string;
    status: string;
    adminSince: string | null;
    lastLoginAt: string | null;
    twoFactorEnabled: boolean;
    emailNotifications: boolean;
    avatarUrl: string | null;
  };
  accessScope: string[];
  permissions: string[];
  accessOverrides: string[];
  stats: {
    totalSales: string;
    salesCount: number;
    posSalesCount: number;
    onlineSalesCount: number;
    ordersProcessed: number;
    ordersCompleted: number;
    paymentVerifications: number;
    stockEntries: number;
    stockAddedUnits: number;
    productsManaged: number;
    adminActions30d: number;
    activeSessionsCount: number;
  };
  recentActivity: Array<{
    id: string;
    action: string;
    target: string;
    status: number;
    timestamp: string;
  }>;
  orderActivity: Array<{
    id: string;
    billNumber: string;
    orderId: string | null;
    source: string | null;
    customer: {
      name: string | null;
      email: string | null;
      phone: string | null;
    };
    items: Array<{ productName?: string; quantity?: number; size?: string; variantColor?: string }>;
    totalAmount: string;
    paymentMethod: string | null;
    paymentVerified: string | null;
    orderStatus: string | null;
    orderCreatedAt: string | null;
    orderUpdatedAt: string | null;
    processedAt: string | null;
    deliveryRequired: boolean;
    deliveryProvider: string | null;
    deliveryAddress: string | null;
    deliveryLocation: string | null;
    linkedOrderEmail: string | null;
    linkedOrderFullName: string | null;
  }>;
  sessions: Array<{
    sid: string;
    isCurrent: boolean;
    expiresAt: string | null;
    createdAt: string | null;
    lastAccessedAt: string | null;
    ip: string | null;
    userAgent: string | null;
  }>;
};

type EditableStoreUserProfile = {
  firstName: string;
  lastName: string;
  phone: string;
  language: string;
  timezone: string;
  department: string;
  emailNotifications: boolean;
  pageAccessOverrides: string[];
};

function formatNpr(value: string) {
  const amount = Number(value || "0");
  return new Intl.NumberFormat("en-NP", {
    style: "currency",
    currency: "NPR",
    maximumFractionDigits: 0,
  }).format(Number.isFinite(amount) ? amount : 0);
}

function getInitials(firstName: string, lastName: string, fallbackEmail: string) {
  const candidate = `${firstName} ${lastName}`.trim();
  if (candidate) {
    return candidate
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() || "")
      .join("");
  }
  return fallbackEmail.slice(0, 2).toUpperCase();
}

function formatTimestamp(value: string | null | undefined) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return format(date, "dd MMM yyyy, hh:mm a");
}

function formatRelativeTime(value: string | null | undefined) {
  if (!value) return "Never";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Never";
  return formatDistanceToNow(date, { addSuffix: true });
}

function permissionLabel(value: string) {
  return value
    .split("-")
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(" ");
}

function buildEditableProfile(overview: StoreUserOverview): EditableStoreUserProfile {
  return {
    firstName: overview.profile.firstName || "",
    lastName: overview.profile.lastName || "",
    phone: overview.profile.phone || "",
    language: overview.profile.language || "en",
    timezone: overview.profile.timezone || "Asia/Kathmandu",
    department: overview.profile.department || "",
    emailNotifications: overview.profile.emailNotifications,
    pageAccessOverrides: [...overview.accessOverrides],
  };
}

export default function StoreUserProfile() {
  const [, setLocation] = useLocation();
  const { user: currentUser } = useCurrentUser();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [match, params] = useRoute("/admin/store-users/:id");
  const userId = match ? params.id : null;
  const [editForm, setEditForm] = useState<EditableStoreUserProfile | null>(null);

  const overviewQuery = useQuery<{ success: boolean; data: StoreUserOverview }>({
    queryKey: ["admin", "store-user", userId, "overview"],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/admin/store-users/${userId}/overview`);
      return (await res.json()) as { success: boolean; data: StoreUserOverview };
    },
    enabled: !!userId,
  });

  const overview = overviewQuery.data?.data;
  const canEdit = currentUser?.role?.toLowerCase() === "superadmin";

  useEffect(() => {
    if (overview) {
      setEditForm(buildEditableProfile(overview));
    }
  }, [overview]);

  const saveMutation = useMutation({
    mutationFn: async (payload: EditableStoreUserProfile) => {
      const res = await apiRequest("PATCH", `/api/admin/store-users/${userId}/profile`, payload);
      return (await res.json()) as { success: boolean };
    },
    onSuccess: async () => {
      toast({ title: "Store user updated" });
      await queryClient.invalidateQueries({ queryKey: ["admin", "store-user", userId, "overview"] });
      await queryClient.invalidateQueries({ queryKey: ["admin", "store-users"] });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to update store user",
        description: error?.message ?? "Please try again.",
        variant: "destructive",
      });
    },
  });

  const displayName = useMemo(() => {
    if (!overview) return "";
    return `${overview.profile.firstName} ${overview.profile.lastName}`.trim() || overview.profile.email;
  }, [overview]);

  const initials = useMemo(() => {
    if (!overview) return "SU";
    return getInitials(
      overview.profile.firstName,
      overview.profile.lastName,
      overview.profile.email,
    );
  }, [overview]);

  const isDirty = useMemo(() => {
    if (!overview || !editForm) return false;
    return JSON.stringify(editForm) !== JSON.stringify(buildEditableProfile(overview));
  }, [editForm, overview]);

  if (overviewQuery.isLoading) {
    return (
      <div className="space-y-6 animate-in fade-in duration-500">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 animate-pulse rounded-full bg-muted" />
          <div className="space-y-2">
            <div className="h-4 w-48 animate-pulse rounded bg-muted" />
            <div className="h-3 w-64 animate-pulse rounded bg-muted" />
          </div>
        </div>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="h-32 animate-pulse rounded-2xl border border-border bg-card" />
          ))}
        </div>
        <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
          <div className="h-[420px] animate-pulse rounded-2xl border border-border bg-card" />
          <div className="h-[420px] animate-pulse rounded-2xl border border-border bg-card" />
        </div>
      </div>
    );
  }

  if (!overview || overviewQuery.isError) {
    const errorMessage =
      overviewQuery.error instanceof Error ? overviewQuery.error.message : "Failed to load user profile.";
    return (
      <div className="space-y-6 animate-in fade-in duration-500">
        <Button variant="outline" className="rounded-full" onClick={() => setLocation("/admin/store-users")}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Store Users
        </Button>
        <Card className="rounded-3xl border-destructive/30">
          <CardHeader>
            <CardTitle>Unable to load this user</CardTitle>
            <CardDescription>{errorMessage}</CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  const stats = [
    {
      label: "Total Sales",
      value: formatNpr(overview.stats.totalSales),
      description: `${overview.stats.salesCount} bills processed`,
      icon: CreditCard,
    },
    {
      label: "Orders Processed",
      value: overview.stats.ordersProcessed.toString(),
      description: `${overview.stats.ordersCompleted} completed orders`,
      icon: ShoppingBag,
    },
    {
      label: "POS Activity",
      value: overview.stats.posSalesCount.toString(),
      description: `${overview.stats.onlineSalesCount} online bills`,
      icon: Receipt,
    },
    {
      label: "Stock Added",
      value: overview.stats.stockAddedUnits.toString(),
      description: `${overview.stats.stockEntries} inventory entries`,
      icon: PackagePlus,
    },
  ];

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col gap-5 rounded-[28px] border border-[#D9E1D3] bg-gradient-to-br from-[#FCF9F1] via-white to-[#F4F8F2] p-6 shadow-[0_18px_40px_rgba(43,62,45,0.08)] dark:border-border dark:from-card dark:via-card dark:to-card/90">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Button variant="outline" className="rounded-full" onClick={() => setLocation("/admin/store-users")}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Store Users
          </Button>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="secondary" className="rounded-full px-3 py-1">
              {getRoleLabel(overview.profile.role)}
            </Badge>
            <Badge
              className={`rounded-full px-3 py-1 ${
                overview.profile.status === "active"
                  ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300"
                  : "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300"
              }`}
            >
              {overview.profile.status || "Active"}
            </Badge>
          </div>
        </div>

        <div className="flex flex-col gap-5 md:flex-row md:items-center">
          <Avatar className="h-20 w-20 border border-black/5 shadow-sm dark:border-white/10">
            {overview.profile.avatarUrl ? (
              <img src={overview.profile.avatarUrl} alt={displayName} className="object-cover" />
            ) : (
              <AvatarFallback className="bg-muted text-lg font-semibold">{initials}</AvatarFallback>
            )}
          </Avatar>
          <div className="min-w-0 flex-1">
            <h1 className="text-3xl font-serif font-medium text-[#2C3E2D] dark:text-foreground">
              {displayName}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">{overview.profile.email}</p>
            <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-sm text-muted-foreground">
              <span className="inline-flex items-center gap-2">
                <CalendarDays className="h-4 w-4" />
                Joined {formatTimestamp(overview.profile.adminSince)}
              </span>
              <span className="inline-flex items-center gap-2">
                <Activity className="h-4 w-4" />
                Last login {formatRelativeTime(overview.profile.lastLoginAt)}
              </span>
              <span className="inline-flex items-center gap-2">
                <Shield className="h-4 w-4" />
                2FA {overview.profile.twoFactorEnabled ? "enabled" : "not enabled"}
              </span>
            </div>
          </div>
        </div>
      </div>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <Card key={stat.label} className="rounded-[24px] border-[#E5E5E0] dark:border-border">
              <CardHeader className="space-y-3 pb-3">
                <div className="flex items-center justify-between">
                  <CardDescription className="text-[11px] font-semibold uppercase tracking-[0.22em]">
                    {stat.label}
                  </CardDescription>
                  <div className="rounded-full bg-[#EEF4EA] p-2 text-[#2C5234] dark:bg-muted dark:text-foreground">
                    <Icon className="h-4 w-4" />
                  </div>
                </div>
                <CardTitle className="text-3xl font-serif">{stat.value}</CardTitle>
              </CardHeader>
              <CardContent className="pt-0 text-sm text-muted-foreground">
                {stat.description}
              </CardContent>
            </Card>
          );
        })}
      </section>

      <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <div className="space-y-6">
          <Card className="rounded-[26px] border-[#E5E5E0] dark:border-border">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-xl">
                <UserCircle2 className="h-5 w-5 text-[#2C5234]" />
                Profile Overview
              </CardTitle>
              <CardDescription>
                {canEdit
                  ? "Superadmin can edit the user profile and access from here."
                  : "Read-only contact and account details for this team member."}
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Phone</p>
                {canEdit && editForm ? (
                  <Input
                    value={editForm.phone}
                    onChange={(event) => setEditForm((prev) => (prev ? { ...prev, phone: event.target.value } : prev))}
                  />
                ) : (
                  <p className="mt-1 font-medium">{overview.profile.phone || "—"}</p>
                )}
              </div>
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Department</p>
                {canEdit && editForm ? (
                  <Input
                    value={editForm.department}
                    onChange={(event) => setEditForm((prev) => (prev ? { ...prev, department: event.target.value } : prev))}
                  />
                ) : (
                  <p className="mt-1 font-medium">{overview.profile.department || "—"}</p>
                )}
              </div>
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Language</p>
                {canEdit && editForm ? (
                  <Input
                    value={editForm.language}
                    onChange={(event) => setEditForm((prev) => (prev ? { ...prev, language: event.target.value } : prev))}
                  />
                ) : (
                  <p className="mt-1 font-medium">{overview.profile.language || "en"}</p>
                )}
              </div>
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Timezone</p>
                {canEdit && editForm ? (
                  <Input
                    value={editForm.timezone}
                    onChange={(event) => setEditForm((prev) => (prev ? { ...prev, timezone: event.target.value } : prev))}
                  />
                ) : (
                  <p className="mt-1 font-medium">{overview.profile.timezone || "Asia/Kathmandu"}</p>
                )}
              </div>
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">First name</p>
                {canEdit && editForm ? (
                  <Input
                    value={editForm.firstName}
                    onChange={(event) => setEditForm((prev) => (prev ? { ...prev, firstName: event.target.value } : prev))}
                  />
                ) : (
                  <p className="mt-1 font-medium">{overview.profile.firstName || "—"}</p>
                )}
              </div>
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Last name</p>
                {canEdit && editForm ? (
                  <Input
                    value={editForm.lastName}
                    onChange={(event) => setEditForm((prev) => (prev ? { ...prev, lastName: event.target.value } : prev))}
                  />
                ) : (
                  <p className="mt-1 font-medium">{overview.profile.lastName || "—"}</p>
                )}
              </div>
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Email notifications</p>
                {canEdit && editForm ? (
                  <div className="mt-2">
                    <Switch
                      checked={editForm.emailNotifications}
                      onCheckedChange={(checked) =>
                        setEditForm((prev) => (prev ? { ...prev, emailNotifications: checked } : prev))
                      }
                    />
                  </div>
                ) : (
                  <p className="mt-1 font-medium">{overview.profile.emailNotifications ? "Enabled" : "Disabled"}</p>
                )}
              </div>
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Last login</p>
                <p className="mt-1 font-medium">{formatTimestamp(overview.profile.lastLoginAt)}</p>
              </div>
              {canEdit && editForm ? (
                <div className="sm:col-span-2 flex justify-end">
                  <Button
                    type="button"
                    className="rounded-full"
                    disabled={!isDirty}
                    loading={saveMutation.isPending}
                    loadingText="Saving..."
                    onClick={() => saveMutation.mutate(editForm)}
                  >
                    <Save className="mr-2 h-4 w-4" />
                    Save Profile
                  </Button>
                </div>
              ) : null}
            </CardContent>
          </Card>

          <Card className="rounded-[26px] border-[#E5E5E0] dark:border-border">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-xl">
                <Briefcase className="h-5 w-5 text-[#2C5234]" />
                Activity Breakdown
              </CardTitle>
              <CardDescription>Operational metrics pulled from orders, POS, inventory, and audit logs.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <div className="rounded-2xl bg-[#F8FAF7] p-4 dark:bg-muted/30">
                <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Orders completed</p>
                <p className="mt-2 text-2xl font-serif">{overview.stats.ordersCompleted}</p>
              </div>
              <div className="rounded-2xl bg-[#F8FAF7] p-4 dark:bg-muted/30">
                <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Payment verifications</p>
                <p className="mt-2 text-2xl font-serif">{overview.stats.paymentVerifications}</p>
              </div>
              <div className="rounded-2xl bg-[#F8FAF7] p-4 dark:bg-muted/30">
                <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Admin actions (30d)</p>
                <p className="mt-2 text-2xl font-serif">{overview.stats.adminActions30d}</p>
              </div>
              <div className="rounded-2xl bg-[#F8FAF7] p-4 dark:bg-muted/30">
                <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Products managed</p>
                <p className="mt-2 text-2xl font-serif">{overview.stats.productsManaged}</p>
              </div>
              <div className="rounded-2xl bg-[#F8FAF7] p-4 dark:bg-muted/30">
                <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Active sessions</p>
                <p className="mt-2 text-2xl font-serif">{overview.stats.activeSessionsCount}</p>
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-[26px] border-[#E5E5E0] dark:border-border">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-xl">
                <Receipt className="h-5 w-5 text-[#2C5234]" />
                Order Activity
              </CardTitle>
              <CardDescription>Orders, bills, customer details, and timestamps handled by this user.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {overview.orderActivity.length === 0 ? (
                <p className="text-sm text-muted-foreground">No order activity recorded for this user yet.</p>
              ) : (
                overview.orderActivity.map((entry) => (
                  <div key={entry.id} className="rounded-2xl border border-border p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="font-medium">{entry.billNumber}</p>
                      <Badge variant="outline" className="rounded-full capitalize">
                        {entry.orderStatus || entry.source || "processed"}
                      </Badge>
                    </div>
                    <div className="mt-2 space-y-1 text-sm text-muted-foreground">
                      <p>Customer: {entry.customer.name || entry.linkedOrderFullName || "—"} • {entry.customer.email || entry.linkedOrderEmail || "—"}</p>
                      <p>Products: {entry.items.map((item) => `${item.productName || "Item"} x${item.quantity || 0}`).join(", ") || "—"}</p>
                      <p>Total: {formatNpr(entry.totalAmount)} • Payment: {entry.paymentMethod || "—"} {entry.paymentVerified ? `• ${entry.paymentVerified}` : ""}</p>
                      <p>Created: {formatTimestamp(entry.orderCreatedAt)} • Delivered/Updated: {formatTimestamp(entry.orderUpdatedAt)}</p>
                      <p>Processed: {formatTimestamp(entry.processedAt)} • Delivery: {entry.deliveryLocation || entry.deliveryAddress || "—"}</p>
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          <Card className="rounded-[26px] border-[#E5E5E0] dark:border-border">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-xl">
                <Activity className="h-5 w-5 text-[#2C5234]" />
                Recent Activity
              </CardTitle>
              <CardDescription>Latest recorded admin actions associated with this user.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {overview.recentActivity.length === 0 ? (
                <p className="text-sm text-muted-foreground">No recent activity recorded for this user yet.</p>
              ) : (
                overview.recentActivity.map((entry, index) => (
                  <div key={entry.id}>
                    <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
                      <div className="min-w-0">
                        <p className="font-medium">{entry.action}</p>
                        <p className="truncate text-sm text-muted-foreground">{entry.target}</p>
                      </div>
                      <div className="flex items-center gap-3 text-sm text-muted-foreground">
                        <Badge variant="outline" className="rounded-full">
                          {entry.status}
                        </Badge>
                        <span>{formatRelativeTime(entry.timestamp)}</span>
                      </div>
                    </div>
                    {index < overview.recentActivity.length - 1 ? <Separator className="mt-4" /> : null}
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card className="rounded-[26px] border-[#E5E5E0] dark:border-border">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-xl">
                <Shield className="h-5 w-5 text-[#2C5234]" />
                Role & Permissions
              </CardTitle>
              <CardDescription>Permission scope inherited from the current admin role.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="rounded-2xl bg-[#F8FAF7] p-4 dark:bg-muted/30">
                <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Role</p>
                <p className="mt-2 text-lg font-semibold">{getRoleLabel(overview.profile.role)}</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Access scope</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {overview.accessScope.map((item) => (
                    <Badge key={item} variant="outline" className="rounded-full">
                      {permissionLabel(item)}
                    </Badge>
                  ))}
                </div>
              </div>
              {canEdit && editForm ? (
                <div>
                  <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Manage Access</p>
                  <div className="mt-3 grid gap-2">
                    {ADMIN_PAGE_KEYS.map((pageKey) => {
                      const inherited = overview.accessScope.includes(pageKey) && !overview.accessOverrides.includes(pageKey);
                      const checked = inherited || editForm.pageAccessOverrides.includes(pageKey);
                      return (
                        <div
                          key={pageKey}
                          className="flex items-center justify-between rounded-2xl border border-border px-3 py-2"
                        >
                          <div>
                            <p className="text-sm font-medium">{permissionLabel(pageKey)}</p>
                            <p className="text-xs text-muted-foreground">
                              {inherited ? "Granted by role" : "Manual access toggle"}
                            </p>
                          </div>
                          <Switch
                            checked={checked}
                            disabled={inherited}
                            onCheckedChange={(nextChecked) => {
                              setEditForm((prev) => {
                                if (!prev) return prev;
                                const nextOverrides = new Set(prev.pageAccessOverrides);
                                if (nextChecked) nextOverrides.add(pageKey);
                                else nextOverrides.delete(pageKey);
                                return { ...prev, pageAccessOverrides: Array.from(nextOverrides) };
                              });
                            }}
                          />
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : null}
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Permissions</p>
                <div className="mt-3 grid gap-2">
                  {overview.permissions.map((item) => (
                    <div
                      key={item}
                      className="flex items-center gap-2 rounded-2xl border border-dashed border-border px-3 py-2 text-sm"
                    >
                      <BadgeCheck className="h-4 w-4 text-[#2C5234]" />
                      {permissionLabel(item)}
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-[26px] border-[#E5E5E0] dark:border-border">
            <CardHeader>
              <CardTitle className="text-xl">Session Summary</CardTitle>
              <CardDescription>Current and historical sessions tied to this admin account.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {overview.sessions.length === 0 ? (
                <p className="text-sm text-muted-foreground">No active sessions found.</p>
              ) : (
                overview.sessions.map((session) => (
                  <div key={session.sid} className="rounded-2xl border border-border p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="font-medium">{session.isCurrent ? "Current session" : "Session"}</p>
                      <Badge variant={session.isCurrent ? "default" : "secondary"} className="rounded-full">
                        {session.isCurrent ? "Current" : "Recorded"}
                      </Badge>
                    </div>
                    <div className="mt-3 space-y-2 text-sm text-muted-foreground">
                      <p>Created: {formatTimestamp(session.createdAt)}</p>
                      <p>Last active: {formatTimestamp(session.lastAccessedAt)}</p>
                      <p>Expires: {formatTimestamp(session.expiresAt)}</p>
                      <p>IP: {session.ip || "—"}</p>
                      <p className="break-words">User agent: {session.userAgent || "—"}</p>
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
