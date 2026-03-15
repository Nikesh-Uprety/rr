import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, Plus, Mail, Phone, MapPin, ShoppingBag, Calendar, User as UserIcon, MoreVertical, ExternalLink } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import {
  fetchAdminCustomers,
  fetchCustomerById,
  createAdminCustomer,
  type AdminCustomer,
  type AdminCustomerDetail,
} from "@/lib/adminApi";
import { formatPrice } from "@/lib/format";
import { ViewToggle } from "@/components/admin/ViewToggle";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
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

export default function AdminCustomers() {
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<"grid" | "list">("list");
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [isAddOpen, setIsAddOpen] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const {
    data: customers,
    isLoading,
    isError,
  } = useQuery<AdminCustomer[]>({
    queryKey: ["admin", "customers", search],
    queryFn: () => fetchAdminCustomers(search || undefined),
  });

  const {
    data: detail,
    isLoading: detailLoading,
  } = useQuery<AdminCustomerDetail | null>({
    queryKey: ["admin", "customers", selectedId],
    queryFn: () =>
      selectedId ? fetchCustomerById(selectedId) : Promise.resolve(null),
    enabled: !!selectedId,
  });

  const list = customers ?? [];

  const handleSelectCustomer = (id: string) => {
    setSelectedId(id);
    setIsSheetOpen(true);
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

  const bgColors = [
    "bg-[#2C5234]",
    "bg-[#1E40AF]",
    "bg-[#8B2020]",
    "bg-[#926019]",
    "bg-[#1B6A68]",
    "bg-[#4B3B6D]",
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
          >
            Export CSV
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
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="flex items-center gap-4 w-full md:w-auto justify-end">
          <div className="text-sm text-muted-foreground hidden sm:block">
            Showing {list.length} customers
          </div>
          <ViewToggle view={viewMode} onViewChange={setViewMode} />
        </div>
      </div>

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
            <Table>
              <TableHeader className="bg-muted/50">
                <TableRow>
                  <TableHead className="w-[80px]">Customer</TableHead>
                  <TableHead>Contact Info</TableHead>
                  <TableHead>Orders</TableHead>
                  <TableHead>Total Spent</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <TableRow key={i}>
                      <TableCell><div className="w-10 h-10 rounded-full bg-muted animate-pulse" /></TableCell>
                      <TableCell>
                        <div className="h-4 w-32 bg-muted animate-pulse mb-2" />
                        <div className="h-3 w-48 bg-muted animate-pulse" />
                      </TableCell>
                      <TableCell><div className="h-4 w-12 bg-muted animate-pulse" /></TableCell>
                      <TableCell><div className="h-4 w-20 bg-muted animate-pulse" /></TableCell>
                      <TableCell className="text-right"><div className="h-8 w-8 bg-muted animate-pulse float-right rounded" /></TableCell>
                    </TableRow>
                  ))
                ) : list.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="h-32 text-center text-muted-foreground">
                      No customers found
                    </TableCell>
                  </TableRow>
                ) : (
                  list.map((customer, i) => (
                    <TableRow 
                      key={customer.id} 
                      className="cursor-pointer hover:bg-muted/30 transition-colors"
                      onClick={() => handleSelectCustomer(customer.id)}
                    >
                      <TableCell>
                        <Avatar className={cn("w-10 h-10", bgColors[i % bgColors.length])}>
                          <AvatarFallback className="text-white text-xs font-bold">
                            {getInitials(customer.firstName, customer.lastName)}
                          </AvatarFallback>
                        </Avatar>
                      </TableCell>
                      <TableCell>
                        <div className="font-medium text-[#2C3E2D] dark:text-foreground">
                          {customer.firstName} {customer.lastName}
                        </div>
                        <div className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                          <Mail className="w-3 h-3" /> {customer.email}
                        </div>
                        {customer.phoneNumber && (
                          <div className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                            <Phone className="w-3 h-3" /> {customer.phoneNumber}
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="font-medium">
                          {customer.orderCount} orders
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="font-bold text-[#2C3E2D] dark:text-foreground">
                          {formatPrice(customer.totalSpent)}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <MoreVertical className="w-4 h-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
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
            ) : list.map((customer, i) => (
              <Card 
                key={customer.id} 
                className="group border-border shadow-sm hover:shadow-md hover:border-primary-foreground transition-all cursor-pointer"
                onClick={() => handleSelectCustomer(customer.id)}
              >
                <CardContent className="p-6">
                  <div className="flex flex-col items-center text-center">
                    <Avatar className={cn("w-16 h-16 mb-4 shadow-sm group-hover:scale-105 transition-transform", bgColors[i % bgColors.length])}>
                      <AvatarFallback className="text-white text-lg font-bold">
                        {getInitials(customer.firstName, customer.lastName)}
                      </AvatarFallback>
                    </Avatar>
                    <h3 className="font-bold text-[#2C3E2D] dark:text-foreground text-lg truncate w-full">
                      {customer.firstName} {customer.lastName}
                    </h3>
                    <p className="text-xs text-muted-foreground truncate w-full mb-1">
                      {customer.email}
                    </p>
                    {customer.phoneNumber && (
                      <p className="text-[10px] text-muted-foreground truncate w-full mb-2 flex items-center justify-center gap-1">
                        <Phone className="w-3 h-3" /> {customer.phoneNumber}
                      </p>
                    )}
                    <div className="grid grid-cols-2 w-full gap-2 pt-4 border-t border-border mt-auto">
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

      {/* Customer Detail Sheet */}
      <Sheet open={isSheetOpen} onOpenChange={setIsSheetOpen}>
        <SheetContent side="right" className="sm:max-w-md w-full p-0 flex flex-col">
          {detailLoading ? (
            <div className="flex-1 flex items-center justify-center flex-col gap-4">
              <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin" />
              <p className="text-muted-foreground">Loading details...</p>
            </div>
          ) : detail ? (
            <>
              <SheetHeader className="p-6 border-b border-border bg-muted/20">
                <div className="flex items-center gap-4">
                  <Avatar className={cn("w-14 h-14 shadow-sm", detail.avatarColor || "bg-[#2C3E2D]")}>
                    <AvatarFallback className="text-white text-xl font-bold">
                      {getInitials(detail.firstName, detail.lastName)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 text-left">
                    <SheetTitle className="text-2xl font-serif">
                      {detail.firstName} {detail.lastName}
                    </SheetTitle>
                    <p className="text-muted-foreground text-sm flex items-center gap-1">
                      Customer since {new Date(detail.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                </div>
              </SheetHeader>

              <div className="flex-1 overflow-y-auto p-6 space-y-8">
                {/* Contact Section */}
                <section className="space-y-4">
                  <h4 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Contact Details</h4>
                  <div className="space-y-3">
                    <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/10 border border-border">
                      <div className="w-8 h-8 rounded-full bg-background flex items-center justify-center shadow-sm">
                        <Mail className="w-4 h-4 text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-xs text-muted-foreground font-medium">Email Address</div>
                        <div className="text-sm font-semibold truncate">{detail.email}</div>
                      </div>
                    </div>
                    {detail.phoneNumber && (
                      <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/10 border border-border">
                        <div className="w-8 h-8 rounded-full bg-background flex items-center justify-center shadow-sm">
                          <Phone className="w-4 h-4 text-primary" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-xs text-muted-foreground font-medium">Phone Number</div>
                          <div className="text-sm font-semibold truncate">{detail.phoneNumber}</div>
                        </div>
                      </div>
                    )}
                  </div>
                </section>

                {/* Statistics Summary */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-4 rounded-xl bg-[#2C3E2D]/5 border border-[#2C3E2D]/10">
                    <ShoppingBag className="w-5 h-5 text-[#2C3E2D] mb-2" />
                    <div className="text-2xl font-bold text-[#2C3E2D]">{detail.orderCount}</div>
                    <div className="text-xs text-muted-foreground font-medium uppercase tracking-tighter">Total Orders</div>
                  </div>
                  <div className="p-4 rounded-xl bg-primary/5 border border-primary/10">
                    <div className="text-xl font-bold text-primary mb-2">NPR</div>
                    <div className="text-2xl font-bold text-primary">{formatPrice(detail.totalSpent).replace("Rs.", "")}</div>
                    <div className="text-xs text-muted-foreground font-medium uppercase tracking-tighter">Total Spent</div>
                  </div>
                </div>

                {/* Recent Orders Section */}
                <section className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Recent Orders</h4>
                    <Badge variant="secondary" className="text-[10px]">{detail.orders.length}</Badge>
                  </div>
                  <div className="space-y-3">
                    {detail.orders.length === 0 ? (
                      <div className="text-center py-8 bg-muted/5 rounded-xl border border-dashed border-border text-muted-foreground text-sm">
                        No orders recorded yet
                      </div>
                    ) : (
                      detail.orders.map((order) => (
                        <div 
                          key={order.id} 
                          className="group p-4 rounded-xl border border-border hover:border-primary transition-all bg-white dark:bg-card shadow-sm"
                        >
                          <div className="flex justify-between items-start mb-2">
                            <div>
                              <div className="font-bold text-sm">Order #{order.id.slice(0, 8)}</div>
                              <div className="text-[10px] text-muted-foreground flex items-center gap-1">
                                <Calendar className="w-3 h-3" /> {new Date(order.createdAt).toLocaleDateString()}
                              </div>
                            </div>
                            <Badge className={cn(
                              "text-[10px] uppercase font-bold",
                              order.status === "completed" ? "bg-green-100 text-green-700 hover:bg-green-100" :
                              order.status === "pending" ? "bg-yellow-100 text-yellow-700 hover:bg-yellow-100" :
                              "bg-muted text-muted-foreground hover:bg-muted"
                            )}>
                              {order.status}
                            </Badge>
                          </div>
                          <div className="flex justify-between items-center text-sm font-medium">
                            <span className="text-primary">{formatPrice(order.total)}</span>
                            <Button variant="ghost" size="sm" className="h-7 px-2 text-[10px] group-hover:text-primary">
                              View Order <ExternalLink className="w-3 h-3 ml-1" />
                            </Button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </section>
              </div>

              <div className="p-6 border-t border-border bg-muted/10 mt-auto">
                <Button className="w-full bg-[#2C3E2D] hover:bg-[#1A251B]">
                  Send Message
                </Button>
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-muted-foreground">
              <p>Customer not found</p>
            </div>
          )}
        </SheetContent>
      </Sheet>

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
    </div>
  );
}