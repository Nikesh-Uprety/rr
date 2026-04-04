import { lazy, Suspense, useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ViewToggle } from "@/components/admin/ViewToggle";
import { useQuery, useMutation, useQueryClient, keepPreviousData } from "@tanstack/react-query";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Search, Eye, Download, XCircle, Clock } from "lucide-react";
import { fetchBills, voidBill } from "@/lib/adminApi";
import type { AdminBill } from "@/lib/adminApi";
import { formatPrice } from "@/lib/format";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { Pagination } from "@/components/admin/Pagination";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const BillViewer = lazy(() =>
  import("@/components/admin/BillViewer").then((module) => ({ default: module.BillViewer })),
);

export default function AdminBills() {
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [selectedBill, setSelectedBill] = useState<AdminBill | null>(null);
  const [viewMode, setViewMode] = useState<"grid" | "list">("list");
  const [billPage, setBillPage] = useState(1);
  const [billPageSize, setBillPageSize] = useState(20);
  const [timeRange, setTimeRange] = useState<"all" | "1d" | "3d" | "7d" | "30d">("all");
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: bills, isLoading } = useQuery<AdminBill[]>({
    queryKey: ["admin", "bills"],
    queryFn: fetchBills,
    staleTime: 60_000,
    placeholderData: keepPreviousData,
  });

  const voidMutation = useMutation({
    mutationFn: voidBill,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "bills"] });
      toast({ title: "Bill voided successfully" });
    },
    onError: () => {
      toast({ title: "Failed to void bill", variant: "destructive" });
    },
  });

  const filtered = useMemo(() => {
    if (!bills) return [];
    const now = Date.now();
    const cutoffMs =
      timeRange === "1d"
        ? now - 1 * 24 * 60 * 60 * 1000
        : timeRange === "3d"
          ? now - 3 * 24 * 60 * 60 * 1000
          : timeRange === "7d"
            ? now - 7 * 24 * 60 * 60 * 1000
            : timeRange === "30d"
              ? now - 30 * 24 * 60 * 60 * 1000
              : null;

    return bills.filter((b) => {
      if (cutoffMs !== null) {
        const created = new Date(b.createdAt).getTime();
        if (!Number.isFinite(created) || created < cutoffMs) return false;
      }
      // Type filter
      if (typeFilter === "void" && b.status !== "void") return false;
      if (typeFilter === "sale" && b.billType !== "sale") return false;
      if (typeFilter === "pos" && b.billType !== "pos") return false;
      if (typeFilter !== "all" && typeFilter !== "void" && typeFilter !== "sale" && typeFilter !== "pos") return false;

      // Search filter
      if (search) {
        const q = search.toLowerCase();
        return (
          b.billNumber.toLowerCase().includes(q) ||
          b.customerName.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [bills, typeFilter, search, timeRange]);

  useEffect(() => {
    setBillPage(1);
  }, [typeFilter, search, billPageSize, timeRange]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / billPageSize));
  const paginated = filtered.slice(
    (billPage - 1) * billPageSize,
    billPage * billPageSize,
  );

  const handleDownloadPDF = async (bill: AdminBill) => {
    setSelectedBill(bill);
    // PDF download is handled inside BillViewer
  };

  const tabs = [
    { key: "all", label: "All" },
    { key: "sale", label: "Sale" },
    { key: "pos", label: "POS" },
    { key: "void", label: "Void" },
  ];

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-serif font-medium text-[#2C3E2D] dark:text-foreground">
            Bills
          </h1>
                  <p className="text-muted-foreground mt-1">
            {filtered.length} bills • {typeFilter === "all" ? "All" : typeFilter.charAt(0).toUpperCase() + typeFilter.slice(1)}
          </p>
        </div>
        <div className="flex items-center gap-4">
          <ViewToggle view={viewMode} onViewChange={setViewMode} />
        </div>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2">
        {tabs.map((tab) => (
          <Button
            key={tab.key}
            variant={typeFilter === tab.key ? "default" : "outline"}
            size="sm"
            className={
              typeFilter === tab.key
                ? "bg-[#2C3E2D] text-white hover:bg-[#1A251B]"
                : "bg-white dark:bg-card border-[#E5E5E0] dark:border-border"
            }
            onClick={() => setTypeFilter(tab.key)}
          >
            {tab.label}
          </Button>
        ))}
      </div>

      {/* Search */}
      <div className="flex w-full max-w-md items-center gap-3">
        <div className="flex items-center gap-1.5 bg-white dark:bg-card border border-[#E5E5E0] dark:border-border rounded-lg px-2 py-1 shadow-sm">
          <Clock className="h-3 w-3 text-muted-foreground" />
          <Select
            value={timeRange}
            onValueChange={(v) => setTimeRange(v as "all" | "1d" | "3d" | "7d" | "30d")}
          >
            <SelectTrigger className="h-7 border-0 bg-transparent px-0 shadow-none focus:ring-0 text-xs font-medium">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All time</SelectItem>
              <SelectItem value="1d">Last 1 day</SelectItem>
              <SelectItem value="3d">Last 3 days</SelectItem>
              <SelectItem value="7d">Last 7 days</SelectItem>
              <SelectItem value="30d">Last 30 days</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="relative w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by bill number or customer..."
            className="pl-9 bg-white dark:bg-card border-[#E5E5E0] dark:border-border rounded-full h-11"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      {/* View Rendering */}
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
                    <th className="px-6 py-4 font-medium">Bill No.</th>
                    <th className="px-6 py-4 font-medium">Date</th>
                    <th className="px-6 py-4 font-medium">Customer</th>
                    <th className="px-6 py-4 font-medium">Items</th>
                    <th className="px-6 py-4 font-medium text-right">Amount</th>
                    <th className="px-6 py-4 font-medium">Payment</th>
                    <th className="px-6 py-4 font-medium">Type</th>
                    <th className="px-6 py-4 font-medium">Status</th>
                    <th className="px-6 py-4 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E5E5E0] dark:divide-border">
                  {isLoading
                    ? Array.from({ length: 5 }).map((_, i) => (
                        <tr key={i}>
                          {Array.from({ length: 9 }).map((_, j) => (
                            <td key={j} className="px-6 py-4">
                              <div className="h-3 w-20 bg-muted animate-pulse rounded" />
                            </td>
                          ))}
                        </tr>
                      ))
                    : paginated.map((bill) => {
                        const items = Array.isArray(bill.items) ? bill.items : [];
                        return (
                          <tr key={bill.id} className="hover:bg-muted/50 transition-colors">
                            <td className="px-6 py-4 font-medium font-mono text-xs">
                              {bill.billNumber}
                            </td>
                            <td className="px-6 py-4 text-muted-foreground">
                              {new Date(bill.createdAt).toLocaleDateString()}
                            </td>
                            <td className="px-6 py-4">
                              <div className="font-medium">{bill.customerName}</div>
                              {bill.customerPhone && (
                                <div className="text-xs text-muted-foreground">{bill.customerPhone}</div>
                              )}
                            </td>
                            <td className="px-6 py-4 text-muted-foreground">
                              {items.length} item{items.length !== 1 ? "s" : ""}
                            </td>
                            <td className="px-6 py-4 text-right font-medium">
                              {formatPrice(bill.totalAmount)}
                            </td>
                            <td className="px-6 py-4">
                              <span className="capitalize text-xs">
                                {bill.paymentMethod.replace(/_/g, " ")}
                              </span>
                            </td>
                            <td className="px-6 py-4">
                              <Badge
                                variant="outline"
                                className={
                                  bill.billType === "pos"
                                    ? "bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300 border-none"
                                    : "bg-[#E8F3EB] text-[#2C5234] dark:bg-green-950 dark:text-green-300 border-none"
                                }
                              >
                                {bill.billType.toUpperCase()}
                              </Badge>
                            </td>
                            <td className="px-6 py-4">
                              <Badge
                                variant="outline"
                                className={
                                  bill.status === "void"
                                    ? "bg-[#FDECEC] text-[#9A2D2D] dark:bg-red-950 dark:text-red-300 border-none"
                                    : "bg-[#E8F3EB] text-[#2C5234] dark:bg-green-950 dark:text-green-300 border-none"
                                }
                              >
                                {bill.status}
                              </Badge>
                            </td>
                            <td className="px-6 py-4">
                              <div className="flex gap-1">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8"
                                  title="View Bill"
                                  onClick={() => setSelectedBill(bill)}
                                >
                                  <Eye className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8"
                                  title="Download PDF"
                                  onClick={() => handleDownloadPDF(bill)}
                                >
                                  <Download className="h-4 w-4" />
                                </Button>
                                {bill.status !== "void" && (
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8 text-red-500 hover:text-red-700"
                                    title="Void Bill"
                                    onClick={() => {
                                      if (confirm(`Void bill ${bill.billNumber}? This cannot be undone.`)) {
                                        voidMutation.mutate(bill.id);
                                      }
                                    }}
                                  >
                                    <XCircle className="h-4 w-4" />
                                  </Button>
                                )}
                              </div>
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
            {isLoading
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
              : paginated.map((bill) => (
                  <div key={bill.id} className="bg-white dark:bg-card rounded-xl border border-border p-5 hover:shadow-lg transition-all">
                    <div className="flex justify-between items-start mb-4">
                      <div>
                        <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">{bill.billNumber}</p>
                        <h3 className="font-serif font-medium text-base mt-1">{bill.customerName}</h3>
                      </div>
                      <Badge
                        variant="outline"
                        className={cn(
                          "text-[10px] font-bold uppercase tracking-wider border-none",
                          bill.status === "void" ? "bg-red-100 text-red-700" : "bg-green-100 text-green-700"
                        )}
                      >
                        {bill.status}
                      </Badge>
                    </div>

                    <div className="space-y-3 mb-6">
                      <div className="flex justify-between text-xs text-muted-foreground">
                        <span>Date</span>
                        <span>{new Date(bill.createdAt).toLocaleDateString()}</span>
                      </div>
                      <div className="flex justify-between text-xs text-muted-foreground">
                        <span>Items</span>
                        <span>{Array.isArray(bill.items) ? bill.items.length : 0} items</span>
                      </div>
                      <div className="flex justify-between items-center py-2 border-t border-dashed border-border mt-2">
                        <span className="text-sm font-medium">Total Amount</span>
                        <span className="text-lg font-bold">{formatPrice(bill.totalAmount)}</span>
                      </div>
                    </div>

                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-1 text-xs"
                        onClick={() => setSelectedBill(bill)}
                      >
                        <Eye className="h-3.5 w-3.5 mr-2" /> View
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-1 text-xs"
                        onClick={() => handleDownloadPDF(bill)}
                      >
                        <Download className="h-3.5 w-3.5 mr-2" /> PDF
                      </Button>
                    </div>
                  </div>
                ))}
          </motion.div>
        )}
      </AnimatePresence>

      <div className="bg-white dark:bg-card rounded-xl border border-border overflow-hidden shadow-sm">
        <Pagination
          currentPage={billPage}
          totalPages={totalPages}
          onPageChange={setBillPage}
          totalItems={filtered.length}
          pageSize={billPageSize}
          onPageSizeChange={setBillPageSize}
        />
      </div>

      {/* Bill Viewer Modal */}
      {selectedBill && (
        <div className="bill-modal-overlay" onClick={() => setSelectedBill(null)}>
          <div className="bill-modal" onClick={(e) => e.stopPropagation()}>
            <Suspense fallback={<div className="p-6 text-sm text-muted-foreground">Loading bill viewer...</div>}>
              <BillViewer bill={selectedBill} onClose={() => setSelectedBill(null)} />
            </Suspense>
          </div>
        </div>
      )}
    </div>
  );
}
