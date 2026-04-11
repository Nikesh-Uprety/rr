import React, { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, Plus, Mail, Phone, MapPin, ShoppingBag, Calendar, User as UserIcon, MoreVertical, ExternalLink, Download, Loader2, ChevronRight } from "lucide-react";
import { useQuery, useMutation, useQueryClient, keepPreviousData } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import {
  fetchAdminCustomersPage,
  fetchCustomerById,
  fetchCustomerOrders,
  createAdminCustomer,
  updateAdminCustomer,
  deleteAdminCustomer,
  exportCustomersCSV,
  type AdminCustomer,
  type AdminCustomerDetail,
  type AdminCustomerOrderHistoryItem,
} from "@/lib/adminApi";
import { formatPrice } from "@/lib/format";
import { ViewToggle } from "@/components/admin/ViewToggle";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Trash2, Edit } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Card, CardContent } from "@/components/ui/card";
import { Pagination } from "@/components/admin/Pagination";
import CustomerSpendingChart from "@/components/admin/CustomerSpendingChart";

export default function AdminCustomers() {
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<"grid" | "list">("list");
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<AdminCustomer | null>(null);
  const [deletingCustomer, setDeletingCustomer] = useState<AdminCustomer | null>(null);
  const [isExportingCustomers, setIsExportingCustomers] = useState(false);
  const [expandedOrderId, setExpandedOrderId] = useState<string | null>(null);
  const [customerPage, setCustomerPage] = useState(1);
  const customerPageSize = 10;
  const [chartTimeRange, setChartTimeRange] = useState<"1w" | "1m" | "all">("1w");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  useEffect(() => {
    const handle = setTimeout(() => setSearch(searchInput.trim()), 300);
    return () => clearTimeout(handle);
  }, [searchInput]);

  const {
    data: customerPageData,
    isLoading,
    isError,
  } = useQuery<{ data: AdminCustomer[]; total: number }>({
    queryKey: ["admin", "customers", "list", { search, page: customerPage, limit: customerPageSize }],
    queryFn: () =>
      fetchAdminCustomersPage({
        search: search || undefined,
        page: customerPage,
        limit: customerPageSize,
        includeZeroOrders: false,
      }),
    placeholderData: keepPreviousData,
  });

  const { data: chartCustomersData } = useQuery<{ data: AdminCustomer[]; total: number }>({
    queryKey: ["admin", "customers", "chart", search, chartTimeRange],
    queryFn: () =>
      fetchAdminCustomersPage({
        search: search || undefined,
        timeRange: chartTimeRange === "all" ? undefined : chartTimeRange,
        page: 1,
        limit: 100,
        includeZeroOrders: false,
      }),
    staleTime: 60_000,
    placeholderData: keepPreviousData,
  });

  const {
    data: detail,
    isLoading: detailLoading,
  } = useQuery<AdminCustomerDetail | null>({
    queryKey: ["admin", "customers", expandedId],
    queryFn: () =>
      expandedId ? fetchCustomerById(expandedId) : Promise.resolve(null),
    enabled: !!expandedId,
  });

  const {
    data: orders = [],
    isLoading: ordersLoading,
  } = useQuery<AdminCustomerOrderHistoryItem[]>({
    queryKey: ["admin", "customers", expandedId, "orders"],
    queryFn: () =>
      expandedId ? fetchCustomerOrders(expandedId) : Promise.resolve([]),
    enabled: !!expandedId,
  });

  useEffect(() => {
    setCustomerPage(1);
  }, [search]);

  const listCustomers = customerPageData?.data ?? [];
  const totalCustomers = customerPageData?.total ?? 0;
  const chartCustomers = chartCustomersData?.data ?? [];
  const selectedCustomerRevenue = useMemo(
    () =>
      orders.reduce((sum, order) => sum + Number(order.total ?? 0), 0),
    [orders],
  );
  const selectedCustomerOnlineOrders = useMemo(
    () => orders.filter((order) => order.source === "online").length,
    [orders],
  );

  const customerTotalPages = Math.max(1, Math.ceil(totalCustomers / customerPageSize));
  const paginatedCustomers = listCustomers;

  const handleToggleExpand = (id: string) => {
    setExpandedId(expandedId === id ? null : id);
  };

  const getInitials = (first: string, last: string) => {
    return `${first?.[0] ?? ""}${last?.[0] ?? ""}`.toUpperCase();
  };

  const addMutation = useMutation({
    mutationFn: createAdminCustomer,
    onSuccess: () => {
      toast({ title: "Customer created successfully" });
      setIsAddOpen(false);
      queryClient.invalidateQueries({ queryKey: ["admin", "customers"] });
    },
    onError: (error: Error) => {
      toast({ title: "Failed to create customer", description: error.message, variant: "destructive" });
    }
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => updateAdminCustomer(id, data),
    onSuccess: () => {
      toast({ title: "Customer updated successfully" });
      setEditingCustomer(null);
      queryClient.invalidateQueries({ queryKey: ["admin", "customers"] });
    },
    onError: (error: Error) => {
      toast({ title: "Failed to update customer", description: error.message, variant: "destructive" });
    }
  });

  const deleteMutation = useMutation({
    mutationFn: deleteAdminCustomer,
    onSuccess: () => {
      toast({ title: "Customer deleted successfully" });
      setDeletingCustomer(null);
      queryClient.invalidateQueries({ queryKey: ["admin", "customers"] });
    },
    onError: (error: Error) => {
      toast({ title: "Failed to delete customer", description: error.message, variant: "destructive" });
    }
  });

  const handleAddSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const firstName = fd.get("firstName") as string;
    const lastName = fd.get("lastName") as string;
    const email = fd.get("email") as string;
    const phoneNumber = fd.get("phoneNumber") as string;

    if (!firstName || !lastName) {
      toast({ title: "First and last name are required", variant: "destructive" });
      return;
    }

    addMutation.mutate({ firstName, lastName, email, phoneNumber });
  };

  const handleEditSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!editingCustomer) return;
    const fd = new FormData(e.currentTarget);
    const firstName = fd.get("firstName") as string;
    const lastName = fd.get("lastName") as string;
    const email = fd.get("email") as string;
    const phoneNumber = fd.get("phoneNumber") as string;

    updateMutation.mutate({ 
      id: editingCustomer.id, 
      data: { firstName, lastName, email, phoneNumber } 
    });
  };

  const handleExportCustomers = async () => {
    if (isExportingCustomers) return;
    setIsExportingCustomers(true);
    try {
      await exportCustomersCSV();
      toast({ title: "Customers CSV downloaded" });
    } catch (error: any) {
      toast({
        title: "Export failed",
        description: error?.message || "Failed to export customers",
        variant: "destructive",
      });
    } finally {
      setIsExportingCustomers(false);
    }
  };

  const bgGradients = [
    "bg-gradient-to-br from-[#2C5234] to-[#1A3320]",
    "bg-gradient-to-br from-[#1E40AF] to-[#112361]",
    "bg-gradient-to-br from-[#8B2020] to-[#591414]",
    "bg-gradient-to-br from-[#926019] to-[#5C3C0F]",
    "bg-gradient-to-br from-[#1B6A68] to-[#103D3C]",
    "bg-gradient-to-br from-[#4B3B6D] to-[#2B2240]",
    "bg-gradient-to-br from-indigo-500 to-indigo-900",
    "bg-gradient-to-br from-emerald-500 to-emerald-900",
  ];

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-serif font-medium text-[#2C3E2D] dark:text-foreground">
            Customers
          </h1>
          <p className="text-muted-foreground mt-1">
            Manage your customer relationships and view order history
          </p>
        </div>
        <div className="flex items-center gap-3 w-full sm:w-auto">
          <Button
            variant="outline"
            className="flex-1 sm:flex-none bg-white dark:bg-card border-[#E5E5E0] dark:border-border text-[#2C3E2D] dark:text-foreground"
            onClick={handleExportCustomers}
            disabled={isExportingCustomers}
          >
            {isExportingCustomers ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Download className="w-4 h-4 mr-2" />
            )}
            {isExportingCustomers ? "Exporting..." : "Export CSV"}
          </Button>
          <Button className="flex-1 sm:flex-none bg-[#2C3E2D] hover:bg-[#1A251B] text-white" onClick={() => setIsAddOpen(true)}>
            <Plus className="w-4 h-4 mr-2" /> Add Customer
          </Button>
        </div>
      </div>

      <div className="flex flex-col md:flex-row gap-4 items-center justify-between bg-white dark:bg-card p-4 rounded-xl border border-border shadow-sm">
        <div className="relative w-full md:max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by name or email..."
            className="pl-9 bg-background border-border rounded-lg"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
          />
          {searchInput && (
            <button
              type="button"
              onClick={() => {
                setSearchInput("");
                setSearch("");
              }}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground hover:text-foreground"
            >
              Clear
            </button>
          )}
        </div>
        <div className="flex items-center gap-4 w-full md:w-auto justify-end">
          <div className="text-sm text-muted-foreground hidden sm:block">
            Showing {paginatedCustomers.length} of {totalCustomers} customers
          </div>
          <ViewToggle view={viewMode} onViewChange={setViewMode} />
        </div>
      </div>

      <CustomerSpendingChart
        customers={chartCustomers}
        timeRange={chartTimeRange}
        onTimeRangeChange={setChartTimeRange}
      />

      <AnimatePresence mode="wait">
        {viewMode === "list" ? (
          <motion.div
            key="list"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
            className="bg-white dark:bg-card rounded-xl border border-border overflow-hidden shadow-sm"
          >
            <div className="overflow-x-auto">
            <Table className="w-full min-w-[1040px] table-fixed">
              <colgroup>
                <col className="w-[46%]" />
                <col className="w-[16%]" />
                <col className="w-[16%]" />
                <col className="w-[14%]" />
                <col className="w-[8%]" />
              </colgroup>
              <TableHeader className="bg-transparent">
                <TableRow className="border-b border-[#E5E5E0] dark:border-border hover:bg-transparent">
                  <TableHead className="px-4 py-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Customer Info</TableHead>
                  <TableHead className="px-4 py-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Joined</TableHead>
                  <TableHead className="px-4 py-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Orders</TableHead>
                  <TableHead className="px-4 py-4 text-right text-xs font-semibold uppercase tracking-wider text-muted-foreground">Total Spent</TableHead>
                  <TableHead className="px-4 py-4 text-right text-xs font-semibold uppercase tracking-wider text-muted-foreground">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody className="divide-y divide-[#E5E5E0] dark:divide-border">
                {isLoading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <TableRow key={i}>
                      <TableCell className="px-4 py-4 align-top">
                        <div className="flex items-center gap-3">
                          <div className="w-12 h-12 rounded-full bg-muted animate-pulse" />
                          <div>
                            <div className="h-4 w-32 bg-muted animate-pulse mb-2" />
                            <div className="h-3 w-24 bg-muted animate-pulse" />
                            <div className="mt-2 h-3 w-40 bg-muted animate-pulse" />
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="px-4 py-4 align-top"><div className="h-4 w-20 bg-muted animate-pulse" /></TableCell>
                      <TableCell className="px-4 py-4 align-top"><div className="h-4 w-12 bg-muted animate-pulse" /></TableCell>
                      <TableCell className="px-4 py-4 align-top text-right"><div className="ml-auto h-4 w-20 bg-muted animate-pulse" /></TableCell>
                      <TableCell className="px-4 py-4 align-top text-right"><div className="ml-auto h-8 w-8 rounded bg-muted animate-pulse" /></TableCell>
                    </TableRow>
                  ))
                ) : paginatedCustomers.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="h-32 text-center text-muted-foreground">
                      No customers found
                    </TableCell>
                  </TableRow>
                ) : (
                  paginatedCustomers.map((customer, i) => (
                    <React.Fragment key={customer.id}>
                      <TableRow 
                        className={cn(
                          "cursor-pointer transition-all duration-200 border-b border-[#E5E5E0] dark:border-border relative",
                          "before:absolute before:inset-y-0 before:left-0 before:w-[3px] before:rounded-r-full before:transition-all before:duration-200",
                          expandedId === customer.id 
                            ? "bg-[#2C5234]/[0.06] dark:bg-[#2C5234]/[0.12] before:bg-[#2C5234] dark:before:bg-[#4ADE80] border-b-0"
                            : "before:bg-transparent hover:bg-muted/30",
                        )}
                        onClick={() => handleToggleExpand(customer.id)}
                      >
                        <TableCell className="px-4 py-4 align-middle">
                          <div className="grid w-full min-w-0 grid-cols-[auto_minmax(0,1fr)] items-start gap-3">
                            <Avatar className={cn("w-12 h-12 shadow-sm border border-black/5 dark:border-white/5", !customer.profileImageUrl && bgGradients[i % bgGradients.length])}>
                              {customer.profileImageUrl ? (
                                <img src={customer.profileImageUrl} alt={`${customer.firstName} ${customer.lastName}`} className="object-cover" />
                              ) : (
                                <AvatarFallback className="text-white text-sm font-bold bg-transparent">
                                  {getInitials(customer.firstName, customer.lastName)}
                                </AvatarFallback>
                              )}
                            </Avatar>
                            <div className="min-w-0 flex-1 space-y-1.5">
                              <div className="truncate font-semibold leading-tight text-base text-[#2C3E2D] dark:text-foreground">
                                {customer.firstName} {customer.lastName}
                              </div>
                              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                <UserIcon className="w-3.5 h-3.5 shrink-0" />
                                <span className="truncate">
                                  {customer.orderCount > 0 ? "Active customer" : "No completed orders yet"}
                                </span>
                              </div>
                              <div className="space-y-1.5">
                                <div className="flex min-w-0 items-start gap-1.5 text-xs text-muted-foreground">
                                  <Mail className="w-3.5 h-3.5 shrink-0" />
                                  <span className="break-words leading-relaxed">{customer.email}</span>
                                </div>
                                <div className="flex min-w-0 items-start gap-1.5 text-xs text-muted-foreground">
                                  <Phone className="w-3.5 h-3.5 shrink-0" />
                                  <span className="break-words leading-relaxed">{customer.phoneNumber || "No phone number"}</span>
                                </div>
                              </div>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="px-4 py-4 align-middle">
                          <div className="flex flex-col gap-1 text-xs text-muted-foreground">
                            <span className="inline-flex items-center gap-1.5">
                              <Calendar className="w-3.5 h-3.5 shrink-0" />
                              <span>{new Date(customer.createdAt).toLocaleDateString()}</span>
                            </span>
                            <span className="pl-5">Customer since</span>
                          </div>
                        </TableCell>
                        <TableCell className="px-4 py-4 align-middle">
                          <div className="flex min-h-[56px] flex-wrap items-center gap-2">
                            <Badge variant="outline" className="font-medium bg-muted/50">
                              {customer.orderCount} orders
                            </Badge>
                            {customer.orderCount > 0 ? (
                              <Badge className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 border-0">Active</Badge>
                            ) : (
                              <Badge variant="secondary" className="bg-muted text-muted-foreground border-0">Inactive</Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="px-4 py-4 align-middle text-right">
                          <div className="flex min-h-[56px] flex-col items-end justify-center">
                            <div className="font-bold text-[#2C3E2D] dark:text-foreground">
                              {formatPrice(customer.totalSpent)}
                            </div>
                            <div className="text-[11px] text-muted-foreground">Lifetime spend</div>
                          </div>
                        </TableCell>
                        <TableCell className="px-4 py-4 align-middle text-right" onClick={(e) => e.stopPropagation()}>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-muted rounded-full">
                                <MoreVertical className="w-4 h-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-40 rounded-xl overflow-hidden border-border shadow-lg">
                              <DropdownMenuItem 
                                className="cursor-pointer flex items-center gap-2 py-2"
                                onClick={() => setEditingCustomer(customer)}
                              >
                                <Edit className="w-4 h-4 text-primary" /> Edit Profile
                              </DropdownMenuItem>
                              <DropdownMenuItem 
                                className="cursor-pointer flex items-center gap-2 py-2 text-destructive focus:text-destructive"
                                onClick={() => setDeletingCustomer(customer)}
                              >
                                <Trash2 className="w-4 h-4" /> Delete Customer
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                      
                      {/* Expandable row details */}
                      <AnimatePresence>
                        {expandedId === customer.id && (
                          <TableRow className="bg-muted/10 border-t-0">
                            <TableCell colSpan={5} className="p-0">
                              <motion.div
                                initial={{ opacity: 0, height: 0 }}
                                animate={{ opacity: 1, height: "auto" }}
                                exit={{ opacity: 0, height: 0 }}
                                transition={{ duration: 0.2 }}
                                className="overflow-hidden"
                              >
                                <div className="border-t border-border/60 bg-white px-6 py-5 dark:bg-card">
                                  {detailLoading ? (
                                    <div className="py-12 flex flex-col items-center justify-center gap-3">
                                      <div className="w-8 h-8 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
                                      <p className="text-xs text-muted-foreground">Fetching history...</p>
                                    </div>
                                  ) : detail ? (
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                                      <div className="md:col-span-1 space-y-6">
                                        <div>
                                          <h4 className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-3">Customer Stats</h4>
                                          <div className="grid grid-cols-2 gap-3">
                                            <div className="p-3 rounded-lg bg-muted/20 border border-border/50">
                                              <div className="text-xs text-muted-foreground mb-1 uppercase tracking-tighter">Website Orders</div>
                                              <div className="text-xl font-bold">
                                                {ordersLoading ? "..." : selectedCustomerOnlineOrders}
                                              </div>
                                            </div>
                                            <div className="p-3 rounded-lg bg-muted/20 border border-border/50">
                                              <div className="text-xs text-muted-foreground mb-1 uppercase tracking-tighter">Lifetime Orders</div>
                                              <div className="text-xl font-bold">
                                                {ordersLoading ? detail.orderCount : orders.length}
                                              </div>
                                            </div>
                                            <div className="p-3 rounded-lg bg-primary/5 border border-primary/10">
                                              <div className="text-xs text-primary/70 mb-1 uppercase tracking-tighter">Total Revenue</div>
                                              <div className="text-xl font-bold text-primary">
                                                {formatPrice(
                                                  ordersLoading
                                                    ? detail.totalSpent
                                                    : selectedCustomerRevenue,
                                                )}
                                              </div>
                                            </div>
                                          </div>
                                        </div>
                                        <div>
                                          <h4 className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-3">Personal Details</h4>
                                            <div className="overflow-hidden rounded-lg border border-border/60">
                                            <div className="grid grid-cols-[128px_minmax(0,1fr)] gap-x-0 gap-y-0 text-sm">
                                              <div className="flex items-center gap-2 border-b border-border/60 bg-muted/20 px-3 py-2 font-medium text-muted-foreground">
                                                <UserIcon className="w-3.5 h-3.5" />
                                                Name
                                              </div>
                                              <div className="border-b border-border/60 px-4 py-2">
                                                {detail.firstName} {detail.lastName}
                                              </div>
                                              <div className="flex items-center gap-2 border-b border-border/60 bg-muted/20 px-3 py-2 font-medium text-muted-foreground">
                                                <Mail className="w-3.5 h-3.5" />
                                                Email
                                              </div>
                                              <div className="border-b border-border/60 px-4 py-2 break-all">
                                                {detail.email}
                                              </div>
                                              <div className="flex items-center gap-2 border-b border-border/60 bg-muted/20 px-3 py-2 font-medium text-muted-foreground">
                                                <Phone className="w-3.5 h-3.5" />
                                                Phone
                                              </div>
                                              <div className="border-b border-border/60 px-4 py-2">
                                                {detail.phoneNumber || "No phone number"}
                                              </div>
                                              <div className="flex items-start gap-2 border-b border-border/60 bg-muted/20 px-3 py-2 font-medium text-muted-foreground">
                                                <MapPin className="mt-0.5 w-3.5 h-3.5" />
                                                Address
                                              </div>
                                              <div className="border-b border-border/60 px-4 py-2">
                                                {detail.deliveryAddress
                                                  ? [
                                                      detail.deliveryAddress.street,
                                                      detail.deliveryAddress.city,
                                                      detail.deliveryAddress.region,
                                                    ]
                                                      .filter(Boolean)
                                                      .join(", ") || "No address on file"
                                                  : "No address on file"}
                                              </div>
                                              <div className="flex items-center gap-2 bg-muted/20 px-3 py-2 font-medium text-muted-foreground">
                                                <Calendar className="w-3.5 h-3.5" />
                                                Joined
                                              </div>
                                              <div className="px-3 py-2">
                                                {new Date(detail.createdAt).toLocaleDateString()}
                                              </div>
                                            </div>
                                          </div>
                                        </div>
                                      </div>
                                      <div className="md:col-span-2">
                                        <div className="flex items-center justify-between mb-3">
                                          <h4 className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Order History</h4>
                                          <Badge variant="secondary" className="text-[10px] px-1.5 h-5">
                                            {ordersLoading ? "Loading..." : `${orders.length} orders`}
                                          </Badge>
                                        </div>
                                        <div className="space-y-2 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                                          {ordersLoading ? (
                                            <div className="text-center py-10 text-muted-foreground text-sm border-2 border-dashed rounded-xl">
                                              Loading order history...
                                            </div>
                                          ) : orders.length === 0 ? (
                                            <div className="text-center py-10 text-muted-foreground text-sm border-2 border-dashed rounded-xl">
                                              No transactions found
                                            </div>
                                          ) : (
                                            orders.map((order) => (
                                              <div
                                                key={order.id}
                                                className="group flex items-start justify-between p-3 rounded-xl border border-border bg-muted/5 hover:bg-muted/10 transition-colors gap-3"
                                              >
                                                <div className="flex items-start gap-3 min-w-0">
                                                  <div className="w-8 h-8 rounded-lg bg-background flex items-center justify-center border border-border shadow-sm text-primary">
                                                    <ShoppingBag className="w-4 h-4" />
                                                  </div>
                                                  <div className="min-w-0">
                                                    <div className="text-xs font-bold">
                                                      Order #{order.id.slice(0, 8)}
                                                    </div>
                                                    <div className="text-[10px] text-muted-foreground flex items-center gap-1.5">
                                                      <span>{new Date(order.createdAt).toLocaleDateString()}</span>
                                                      <span>•</span>
                                                      <Badge
                                                        className={cn(
                                                          "h-4 px-1.5 text-[9px] leading-none uppercase border-0",
                                                          order.source === "pos"
                                                            ? "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300"
                                                            : "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
                                                        )}
                                                      >
                                                        {order.source === "pos" ? "POS" : "ONLINE"}
                                                      </Badge>
                                                    </div>

                                                    <div className="mt-2 space-y-1">
                                                      {order.items.slice(0, 3).map((it, idx) => (
                                                        <div
                                                          key={`${order.id}-${idx}`}
                                                          className="flex items-center justify-between gap-3"
                                                        >
                                                          <span className="text-[10px] text-muted-foreground truncate max-w-[200px]">
                                                            {it.name}
                                                          </span>
                                                          <span className="text-[10px] font-semibold text-foreground">
                                                            {it.quantity}x
                                                          </span>
                                                        </div>
                                                      ))}
                                                      {order.items.length > 3 && (
                                                        <div className="text-[10px] text-muted-foreground">
                                                          +{order.items.length - 3} more items
                                                        </div>
                                                      )}
                                                    </div>
                                                    <button
                                                      type="button"
                                                      onClick={() =>
                                                        setExpandedOrderId((current) =>
                                                          current === order.id ? null : order.id,
                                                        )
                                                      }
                                                      className="mt-2 inline-flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-primary hover:text-primary/80"
                                                    >
                                                      <ChevronRight
                                                        className={cn(
                                                          "h-3 w-3 transition-transform",
                                                          expandedOrderId === order.id && "rotate-90",
                                                        )}
                                                      />
                                                      Order details
                                                    </button>
                                                    {expandedOrderId === order.id ? (
                                                      <div className="mt-3 rounded-lg border border-border/60 bg-background/80 p-3">
                                                        <div className="flex items-start gap-2 text-[10px] text-muted-foreground">
                                                          <MapPin className="mt-0.5 h-3 w-3" />
                                                          <span>
                                                            {order.deliveryAddress || "No delivery address on file"}
                                                          </span>
                                                        </div>
                                                        <div className="mt-3 space-y-2">
                                                          {order.items.map((item, index) => (
                                                            <div key={`${order.id}-item-${index}`} className="flex items-center gap-3">
                                                              <div className="h-9 w-9 overflow-hidden rounded-md border border-border bg-muted/30">
                                                                {item.imageUrl ? (
                                                                  <img
                                                                    src={item.imageUrl}
                                                                    alt={item.name}
                                                                    className="h-full w-full object-cover"
                                                                  />
                                                                ) : (
                                                                  <div className="flex h-full w-full items-center justify-center text-[9px] text-muted-foreground">
                                                                    N/A
                                                                  </div>
                                                                )}
                                                              </div>
                                                              <div className="min-w-0 flex-1">
                                                                <p className="truncate text-xs font-semibold">{item.name}</p>
                                                                <p className="text-[10px] text-muted-foreground">Qty {item.quantity}</p>
                                                              </div>
                                                            </div>
                                                          ))}
                                                        </div>
                                                      </div>
                                                    ) : null}
                                                  </div>
                                                </div>

                                                <div className="flex flex-col items-end gap-2">
                                                  <div className="text-right">
                                                    <div className="text-xs font-bold">
                                                      {formatPrice(order.total)}
                                                    </div>
                                                    <div className="text-[10px] text-muted-foreground capitalize">
                                                      {order.paymentMethod}
                                                    </div>
                                                    <div
                                                      className={cn(
                                                        "text-[10px] font-semibold uppercase tracking-tighter",
                                                        order.status === "completed" ||
                                                          order.status === "issued"
                                                          ? "text-green-600"
                                                          : "text-yellow-600",
                                                      )}
                                                    >
                                                      {order.status}
                                                    </div>
                                                  </div>
                                                </div>
                                              </div>
                                            ))
                                          )}
                                        </div>
                                      </div>
                                    </div>
                                  ) : (
                                    <p className="text-center py-10 text-muted-foreground">Failed to load data</p>
                                  )}
                                </div>
                              </motion.div>
                            </TableCell>
                          </TableRow>
                        )}
                      </AnimatePresence>
                    </React.Fragment>
                  ))
                )}
              </TableBody>
            </Table>
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="grid"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4"
          >
            {isLoading ? (
              Array.from({ length: 8 }).map((_, i) => (
                <Card key={i} className="border-border shadow-sm">
                  <CardContent className="p-6">
                    <div className="flex flex-col items-center text-center space-y-4">
                      <div className="w-16 h-16 rounded-full bg-muted animate-pulse" />
                      <div className="space-y-2 w-full">
                        <div className="h-4 w-3/4 bg-muted animate-pulse mx-auto" />
                        <div className="h-3 w-1/2 bg-muted animate-pulse mx-auto" />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
            ) : paginatedCustomers.length === 0 ? (
              <Card className="border-border shadow-sm sm:col-span-2 lg:col-span-3 xl:col-span-4">
                <CardContent className="p-10 text-center text-muted-foreground">
                  No customers found
                </CardContent>
              </Card>
            ) : paginatedCustomers.map((customer, i) => (
              <Card 
                key={customer.id} 
                className={cn(
                  "group border-border shadow-sm hover:shadow-md transition-all cursor-pointer relative",
                  expandedId === customer.id ? "ring-2 ring-primary border-transparent" : "hover:border-primary/50"
                )}
                onClick={() => handleToggleExpand(customer.id)}
              >
                <div className="absolute top-2 right-2" onClick={(e) => e.stopPropagation()}>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-7 w-7 rounded-full opacity-0 group-hover:opacity-100 transition-opacity hover:bg-muted/50">
                          <MoreVertical className="w-3.5 h-3.5" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="rounded-xl overflow-hidden shadow-lg border-border">
                        <DropdownMenuItem className="cursor-pointer flex items-center gap-2" onClick={() => setEditingCustomer(customer)}>
                          <Edit className="w-3.5 h-3.5 text-primary" /> Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem className="cursor-pointer flex items-center gap-2 text-destructive focus:text-destructive" onClick={() => setDeletingCustomer(customer)}>
                          <Trash2 className="w-3.5 h-3.5" /> Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                </div>
                <CardContent className="p-6">
                  <div className="flex flex-col items-center text-center">
                    <Avatar className={cn("w-20 h-20 mb-4 shadow-md border-2 border-white dark:border-card group-hover:scale-105 transition-transform", !customer.profileImageUrl && bgGradients[i % bgGradients.length])}>
                      {customer.profileImageUrl ? (
                        <img src={customer.profileImageUrl} alt={`${customer.firstName} ${customer.lastName}`} className="object-cover" />
                      ) : (
                        <AvatarFallback className="text-white text-xl font-bold bg-transparent">
                          {getInitials(customer.firstName, customer.lastName)}
                        </AvatarFallback>
                      )}
                    </Avatar>
                    <h3 className="font-bold text-[#2C3E2D] dark:text-foreground text-lg truncate w-full">
                      {customer.firstName} {customer.lastName}
                    </h3>
                    <p className="text-xs text-muted-foreground truncate w-full mb-1">
                      {customer.email}
                    </p>
                    <div className="flex justify-center gap-1.5 mt-1">
                      {customer.orderCount > 0 && <Badge className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 border-0 h-4 text-[9px] px-1.5">ACTIVE</Badge>}
                    </div>
                    
                    <div className="grid grid-cols-2 w-full gap-2 pt-4 border-t border-border mt-4">
                      <div className="text-left">
                        <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Orders</div>
                        <div className="font-bold">{customer.orderCount}</div>
                      </div>
                      <div className="text-right">
                        <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Spent</div>
                        <div className="font-bold text-primary">{formatPrice(customer.totalSpent)}</div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Pagination */}
      <div className="bg-white dark:bg-card rounded-xl border border-border overflow-hidden shadow-sm">
        <Pagination
          currentPage={customerPage}
          totalPages={customerTotalPages}
          onPageChange={(page) => {
            setCustomerPage(page);
            setExpandedId(null);
          }}
          totalItems={totalCustomers}
          pageSize={customerPageSize}
        />
      </div>

      {/* No side sheet needed anymore as we use expandable rows */}

      {/* Add Customer Dialog */}
      <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle className="font-serif text-2xl">Add New Customer</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleAddSubmit} className="space-y-4 mt-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="firstName">First Name *</Label>
                <Input id="firstName" name="firstName" required className="rounded-lg" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="lastName">Last Name *</Label>
                <Input id="lastName" name="lastName" required className="rounded-lg" />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email Address</Label>
              <Input id="email" name="email" type="email" placeholder="customer@example.com" className="rounded-lg" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phoneNumber">Phone Number</Label>
              <Input id="phoneNumber" name="phoneNumber" placeholder="e.g. 9812345678" className="rounded-lg" />
            </div>
            <div className="pt-4 flex justify-end gap-3">
              <Button type="button" variant="outline" onClick={() => setIsAddOpen(false)} className="rounded-full">Cancel</Button>
              <Button type="submit" disabled={addMutation.isPending} className="rounded-full bg-[#2C3E2D] hover:bg-[#1A251B] text-white">
                {addMutation.isPending ? "Saving..." : "Create Customer"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit Customer Dialog */}
      <Dialog open={!!editingCustomer} onOpenChange={(open) => !open && setEditingCustomer(null)}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle className="font-serif text-2xl">Edit Customer Profile</DialogTitle>
          </DialogHeader>
          {editingCustomer && (
            <form onSubmit={handleEditSubmit} className="space-y-4 mt-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="edit-firstName">First Name</Label>
                  <Input id="edit-firstName" name="firstName" defaultValue={editingCustomer.firstName} required className="rounded-lg" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-lastName">Last Name</Label>
                  <Input id="edit-lastName" name="lastName" defaultValue={editingCustomer.lastName} required className="rounded-lg" />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-email">Email Address</Label>
                <Input id="edit-email" name="email" type="email" defaultValue={editingCustomer.email} className="rounded-lg" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-phoneNumber">Phone Number</Label>
                <Input id="edit-phoneNumber" name="phoneNumber" defaultValue={editingCustomer.phoneNumber || ""} className="rounded-lg" />
              </div>
              <div className="pt-4 flex justify-end gap-3">
                <Button type="button" variant="outline" onClick={() => setEditingCustomer(null)} className="rounded-full">Cancel</Button>
                <Button type="submit" disabled={updateMutation.isPending} className="rounded-full bg-[#2C3E2D] hover:bg-[#1A251B] text-white">
                  {updateMutation.isPending ? "Updating..." : "Save Changes"}
                </Button>
              </div>
            </form>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Alert */}
      <AlertDialog open={!!deletingCustomer} onOpenChange={(open) => !open && setDeletingCustomer(null)}>
        <AlertDialogContent className="rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-xl font-bold text-destructive">Delete Customer?</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove <strong>{deletingCustomer?.firstName} {deletingCustomer?.lastName}</strong> from your records.
              This action cannot be undone, although their order history will remain in the database for accounting.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-full">Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={() => deletingCustomer && deleteMutation.mutate(deletingCustomer.id)}
              className="rounded-full bg-destructive hover:bg-destructive/90 text-destructive-foreground"
            >
              {deleteMutation.isPending ? "Deleting..." : "Confirm Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
