import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient, keepPreviousData } from "@tanstack/react-query";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Search, Eye, Download, XCircle } from "lucide-react";
import { BillViewer } from "@/components/admin/BillViewer";
import { fetchBills, voidBill } from "@/lib/adminApi";
import type { AdminBill } from "@/lib/adminApi";
import { formatPrice } from "@/lib/format";
import { useToast } from "@/hooks/use-toast";

export default function AdminBills() {
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [selectedBill, setSelectedBill] = useState<AdminBill | null>(null);
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
    return bills.filter((b) => {
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
  }, [bills, typeFilter, search]);

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
      <div className="relative w-full max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search by bill number or customer..."
          className="pl-9 bg-white dark:bg-card border-[#E5E5E0] dark:border-border rounded-full h-11"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-card rounded-xl border border-[#E5E5E0] dark:border-border overflow-hidden">
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
                : filtered.map((bill) => {
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
      </div>

      {/* Bill Viewer Modal */}
      {selectedBill && (
        <div className="bill-modal-overlay" onClick={() => setSelectedBill(null)}>
          <div className="bill-modal" onClick={(e) => e.stopPropagation()}>
            <BillViewer bill={selectedBill} onClose={() => setSelectedBill(null)} />
          </div>
        </div>
      )}
    </div>
  );
}
