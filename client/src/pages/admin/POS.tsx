import { BillViewer } from "@/components/admin/BillViewer";
import { motion, AnimatePresence } from "framer-motion";
import { ViewToggle } from "@/components/admin/ViewToggle";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { OptimizedImage } from "@/components/ui/OptimizedImage";
import { useToast } from "@/hooks/use-toast";
import type {
  AdminBill,
  AdminProduct,
  POSSession,
  AdminCustomer,
} from "@/lib/adminApi";
import {
  closePosSession,
  createPosBill,
  fetchAdminProducts,
  fetchTodaySession,
  openPosSession,
  fetchAdminCustomers,
  createAdminCustomer,
} from "@/lib/adminApi";
import { formatPrice } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Banknote,
  CheckCircle2,
  Clock,
  CreditCard,
  DollarSign,
  Minus,
  ParkingCircle,
  Plus,
  Search,
  ShoppingCart,
  Smartphone,
  Trash2,
  X,
  UserPlus,
  History,
  ParkingCircle as ParkIcon,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Label } from "@/components/ui/label";
import { useEffect, useMemo, useState } from "react";

interface CartItem {
  productId: string;
  productName: string;
  imageUrl: string;
  unitPrice: number;
  quantity: number;
  lineTotal: number;
}

export default function AdminPOS() {
  const [search, setSearch] = useState("");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [customerName, setCustomerName] = useState("Walk-in Customer");
  const [customerPhone, setCustomerPhone] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [cashReceived, setCashReceived] = useState<string>("");
  const [discount, setDiscount] = useState<string>("0");
  const [notes, setNotes] = useState("");
  const [completedBill, setCompletedBill] = useState<AdminBill | null>(null);
  const [session, setSession] = useState<POSSession | null>(null);
  const [lastClosedSession, setLastClosedSession] = useState<POSSession | null>(null);
  const [showSummaryDialog, setShowSummaryDialog] = useState(false);
  const [openingCash, setOpeningCash] = useState<string>("");
  const [closingCash, setClosingCash] = useState<string>("");
  const [showEndOfDay, setShowEndOfDay] = useState(false);
  const [openingLoading, setOpeningLoading] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<AdminCustomer | null>(null);
  const [customerSearch, setCustomerSearch] = useState("");
  const [isAddCustomerOpen, setIsAddCustomerOpen] = useState(false);
  const [parkedSales, setParkedSales] = useState<
    { name: string; cart: CartItem[] }[]
  >(() => {
    try {
      const saved = localStorage.getItem("rare-pos-parked-sales");
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [showQR, setShowQR] = useState(false);
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [selectedCategory, setSelectedCategory] = useState("All");
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // Fetch today's session via useQuery (no flash)
  const { data: sessionData, isLoading: sessionLoading } = useQuery<POSSession | null>({
    queryKey: ["pos", "session"],
    queryFn: async () => {
      try {
        return await fetchTodaySession();
      } catch {
        return null;
      }
    },
  });

  // Sync session state from query
  useEffect(() => {
    if (sessionData !== undefined) {
      setSession(sessionData);
    }
  }, [sessionData]);

  const { data: products } = useQuery<AdminProduct[]>({
    queryKey: ["admin", "products", "pos"],
    queryFn: () => fetchAdminProducts({ limit: 1000 }),
  });

  // Extract unique categories
  const categories = useMemo(() => {
    if (!products) return ["All"];
    const cats = Array.from(new Set(products.map((p) => p.category || "General").filter(Boolean)));
    return ["All", ...cats.sort()];
  }, [products]);

  const filteredProducts = useMemo(() => {
    if (!products) return [];
    let result = products;
    // Category filter
    if (selectedCategory !== "All") {
      result = result.filter((p) => (p.category || "General") === selectedCategory);
    }
    // Multi-word search: ALL words must match product name or category
    const q = search.trim().toLowerCase();
    if (q) {
      const words = q.split(/\s+/);
      result = result.filter((p) => {
        const haystack = `${p.name} ${p.category || ""}`.toLowerCase();
        return words.every((word) => haystack.includes(word));
      });
    }
    return result;
  }, [products, search, selectedCategory]);

  const { data: customers } = useQuery<AdminCustomer[]>({
    queryKey: ["admin", "customers", customerSearch],
    queryFn: () => fetchAdminCustomers(customerSearch),
  });

  // Persist parked sales
  useEffect(() => {
    localStorage.setItem("rare-pos-parked-sales", JSON.stringify(parkedSales));
  }, [parkedSales]);

  // Barcode Scanner Listener
  // Hardware scanners emulate rapid keyboard typing then "Enter"
  useEffect(() => {
    if (!products) return;

    let barcodeBuffer = "";
    let lastKeyTime = Date.now();

    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't intercept if user is typing in an input/textarea
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      ) {
        return;
      }

      const now = Date.now();

      // If time between keystrokes is > 50ms, it's a human typing, reset buffer
      if (now - lastKeyTime > 50) {
        barcodeBuffer = "";
      }
      lastKeyTime = now;

      if (e.key === "Enter") {
        if (barcodeBuffer.length > 0) {
          const scannedProduct = products.find(
            (p) => p.name.toLowerCase() === barcodeBuffer.toLowerCase(),
          );

          if (scannedProduct) {
            addToCart(scannedProduct);
            toast({ title: `Added ${scannedProduct.name}` });
          } else {
            toast({ title: "Product not found", variant: "destructive" });
          }
          barcodeBuffer = "";
        }
      } else if (e.key.length === 1) {
        // Collect characters
        barcodeBuffer += e.key;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [products, cart]); // Add cart to dependencies for stock check in barcode scanner

  // Cart calculations (VAT removed per user request)
  const subtotal = cart.reduce((s, i) => s + i.lineTotal, 0);
  const discountAmount = Number(discount) || 0;
  const total = subtotal - discountAmount;
  const cashReceivedNum = Number(cashReceived) || 0;
  const changeAmount =
    paymentMethod === "cash" ? Math.max(0, cashReceivedNum - total) : 0;

  // Cart operations — toggle: click to add, click again to remove
  const toggleCartItem = (product: AdminProduct) => {
    const existingInCart = cart.find((i) => i.productId === product.id);

    if (existingInCart) {
      // Second click → remove from cart
      setCart((prev) => prev.filter((i) => i.productId !== product.id));
      return;
    }

    // First click → add 1 unit
    if (product.stock <= 0) {
      toast({
        title: "Out of Stock",
        description: `${product.name} is currently unavailable`,
        variant: "destructive",
      });
      return;
    }

    setCart((prev) => [
      ...prev,
      {
        productId: product.id,
        productName: product.name,
        imageUrl: product.imageUrl ?? "",
        unitPrice: Number(product.price),
        quantity: 1,
        lineTotal: Number(product.price),
      },
    ]);
  };

  // For quantity adjustment only (used in cart sidebar)
  const addToCart = (product: AdminProduct) => {
    const existingInCart = cart.find((i) => i.productId === product.id);
    const currentQty = existingInCart ? existingInCart.quantity : 0;

    if (currentQty + 1 > product.stock) {
      toast({
        title: "Insufficient Stock",
        description: `Only ${product.stock} units available for ${product.name}`,
        variant: "destructive",
      });
      return;
    }

    setCart((prev) => {
      if (existingInCart) {
        return prev.map((i) =>
          i.productId === product.id
            ? {
                ...i,
                quantity: i.quantity + 1,
                lineTotal: (i.quantity + 1) * i.unitPrice,
              }
            : i,
        );
      }
      return [
        ...prev,
        {
          productId: product.id,
          productName: product.name,
          imageUrl: product.imageUrl ?? "",
          unitPrice: Number(product.price),
          quantity: 1,
          lineTotal: Number(product.price),
        },
      ];
    });
  };

  const updateQuantity = (productId: string, delta: number) => {
    const product = products?.find(p => p.id === productId);
    if (!product) return;

    setCart((prev) =>
      prev
        .map((i) => {
          if (i.productId !== productId) return i;
          const qty = i.quantity + delta;
          
          // Stock Check on Increase
          if (delta > 0 && qty > product.stock) {
             toast({
              title: "Stock Limit Reached",
              description: `Maximum available stock is ${product.stock}`,
              variant: "destructive",
            });
            return i;
          }

          if (qty <= 0) return null;
          return { ...i, quantity: qty, lineTotal: qty * i.unitPrice };
        })
        .filter(Boolean) as CartItem[],
    );
  };

  const removeFromCart = (productId: string) => {
    setCart((prev) => prev.filter((i) => i.productId !== productId));
  };

  const addCustomerMutation = useMutation({
    mutationFn: createAdminCustomer,
    onSuccess: (newCustomer) => {
      toast({ title: "Customer created successfully" });
      setIsAddCustomerOpen(false);
      
      // Auto-select the newly created customer
      setSelectedCustomer(newCustomer);
      setCustomerName(`${newCustomer.firstName} ${newCustomer.lastName}`);
      setCustomerPhone("");
      setCustomerSearch("");

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

    addCustomerMutation.mutate({ firstName, lastName, email, phoneNumber });
  };

  // Checkout
  const chargeMutation = useMutation({
    mutationFn: () =>
      createPosBill({
        customerName: selectedCustomer 
          ? `${selectedCustomer.firstName} ${selectedCustomer.lastName}` 
          : (customerName || "Walk-in Customer"),
        customerPhone: "phoneNumber" in (selectedCustomer || {}) ? (selectedCustomer as any).phoneNumber : customerPhone || undefined,
        items: cart.map((i) => ({
          productId: i.productId,
          productName: i.productName,
          variantColor: "",
          size: "",
          sku: "",
          quantity: i.quantity,
          unitPrice: i.unitPrice,
          lineTotal: i.lineTotal,
        })),
        paymentMethod,
        cashReceived: paymentMethod === "cash" ? cashReceivedNum : null,
        discountAmount: discountAmount,
        notes: notes || undefined,
      }),

    onError: (error) => {
      toast({ 
        title: "Checkout Failed", 
        description: error instanceof Error ? error.message : "An error occurred during checkout.", 
        variant: "destructive" 
      });
      // Deliberately NOT clearing cart/customer state here so user can retry
    }
  });

  const handleCloseSession = async () => {
    if (!session) return;
    try {
      const closed = await closePosSession(session.id, {
        closingCash: Number(closingCash) || 0,
        openedAt: session.openedAt,
      });
      setSession(null);
      setLastClosedSession(closed);
      setShowEndOfDay(false);
      setShowSummaryDialog(true);
      toast({ title: "Session closed successfully" });
    } catch {
      toast({ title: "Failed to close session", variant: "destructive" });
    }
  };

  // Park sale
  const parkSale = () => {
    if (cart.length === 0) return;
    setParkedSales((prev) => [
      ...prev,
      { name: customerName, cart: [...cart] },
    ]);
    setCart([]);
    setCustomerName("Walk-in Customer");
    toast({ title: "Sale parked" });
  };

  const restoreParkedSale = (index: number) => {
    const sale = parkedSales[index];
    setCart(sale.cart);
    setCustomerName(sale.name);
    setParkedSales((prev) => prev.filter((_, i) => i !== index));
  };

  const paymentMethods = [
    { key: "cash", label: "Cash", icon: Banknote },
    { key: "esewa", label: "eSewa", icon: Smartphone },
    { key: "khalti", label: "Khalti", icon: Smartphone },
    { key: "card", label: "Card", icon: CreditCard },
  ];

  // ── Loading session? Show skeleton ──────────────────
  if (sessionLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-6 animate-in fade-in">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-4 w-64" />
        <div className="w-full max-w-sm space-y-4">
          <Skeleton className="h-10 w-full rounded-xl" />
          <Skeleton className="h-12 w-full rounded-xl" />
        </div>
      </div>
    );
  }

  // ── No session? Show session opener ──────────────────
  if (!session) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-6 animate-in fade-in">
        <div className="text-center">
          <h1 className="text-3xl font-serif font-medium text-[#2C3E2D] dark:text-foreground mb-2">
            Point of Sale
          </h1>
          <p className="text-muted-foreground">
            Start a new session to begin selling
          </p>
        </div>
        <div className="bg-white dark:bg-card rounded-xl border border-[#E5E5E0] dark:border-border p-8 w-full max-w-sm space-y-4">
          <div>
            <label className="text-sm font-medium text-muted-foreground mb-1 block">
              Opening Cash (NPR)
            </label>
            <Input
              type="number"
              value={openingCash}
              onChange={(e) => setOpeningCash(e.target.value)}
              placeholder="0"
              className="bg-background border-[#E5E5E0] dark:border-border rounded-full"
            />
          </div>
          <Button
            className="w-full bg-[#2C3E2D] hover:bg-[#1A251B] text-white rounded-full"
            onClick={async () => {
              setOpeningLoading(true);
              try {
                const s = await openPosSession(Number(openingCash) || 0);
                setSession(s);
                setOpeningCash("");
                queryClient.invalidateQueries({ queryKey: ["pos", "session"] });
                toast({ title: "POS session opened" });
              } catch {
                toast({ title: "Failed to open session", variant: "destructive" });
              } finally {
                setOpeningLoading(false);
              }
            }}
            loading={openingLoading}
          >
            <DollarSign className="mr-2 h-4 w-4" />
            Open Session
          </Button>
        </div>
      </div>
    );
  }

  // ── Completed bill modal ─────────────────────────────
  if (completedBill) {
    return (
      <div className="max-w-lg mx-auto py-8 animate-in fade-in">
        <BillViewer
          bill={completedBill}
          onClose={() => setCompletedBill(null)}
        />
        <div className="text-center mt-6">
          <Button
            className="bg-[#2C3E2D] hover:bg-[#1A251B] text-white"
            onClick={() => setCompletedBill(null)}
          >
            New Sale
          </Button>
        </div>
      </div>
    );
  }

  // ── Main POS interface ───────────────────────────────
  return (
    <div className="animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-serif font-medium text-[#2C3E2D] dark:text-foreground">
            Point of Sale
          </h1>
          <div className="flex items-center gap-2 mt-1">
            <Badge
              variant="outline"
              className="bg-[#E8F3EB] text-[#2C5234] border-none"
            >
              <Clock className="h-3 w-3 mr-1" />
              Session active since{" "}
              {new Date(session.openedAt).toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </Badge>
            {parkedSales.length > 0 && (
              <Badge
                variant="outline"
                className="bg-yellow-50 text-yellow-700 border-none rounded-full"
              >
                <History className="h-3 w-3 mr-1" />
                {parkedSales.length} Active Workspaces
              </Badge>
            )}
          </div>
        </div>
        <Button
          variant="outline"
          className="border-red-300 text-red-600 hover:bg-red-50"
          onClick={() => setShowEndOfDay(true)}
        >
          End Session
        </Button>
      </div>

      {/* Main Grid: Products | Customers | Cart */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_280px_350px] gap-6">
        {/* LEFT: Products */}
        <div className="space-y-4">
          {/* Professional search bar */}
          <div className="flex items-center gap-3">
            <div className="flex-1 min-w-0 relative">
              <div className="flex items-center bg-white dark:bg-card border border-[#E5E5E0] dark:border-border rounded-full h-11 px-4 transition-all duration-300 focus-within:border-primary/50 shadow-inner">
                <Search className={`h-4 w-4 shrink-0 transition-colors ${search.length > 0 ? 'text-primary' : 'text-muted-foreground'}`} />
                <Input
                  placeholder="Search products..."
                  className="border-none focus-visible:ring-0 bg-transparent h-full text-sm placeholder:text-muted-foreground/50 px-3 w-full"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  autoFocus
                />
                {search && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 shrink-0 rounded-full hover:bg-muted"
                    onClick={() => setSearch("")}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>
            <ViewToggle view={viewMode} onViewChange={setViewMode} />
          </div>

          {/* Category pills */}
          <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
            {categories.map((cat) => (
              <button
                key={cat}
                className={cn(
                  "px-4 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-all border",
                  selectedCategory === cat
                    ? "bg-[#2C3E2D] text-white border-[#2C3E2D]"
                    : "bg-white dark:bg-card text-muted-foreground border-[#E5E5E0] dark:border-border hover:bg-muted"
                )}
                onClick={() => setSelectedCategory(cat)}
              >
                {cat}
              </button>
            ))}
          </div>

          {/* Workspaces (Parked Sales) */}
          {parkedSales.length > 0 && (
            <div className="flex gap-3 flex-wrap">
              {parkedSales.map((sale, i) => (
                <motion.div
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  key={i}
                  className="bg-white dark:bg-card border border-[#E5E5E0] dark:border-border rounded-2xl p-4 shadow-sm hover:shadow-md transition-all cursor-pointer min-w-[180px] group"
                  onClick={() => restoreParkedSale(i)}
                >
                  <div className="flex justify-between items-center mb-3">
                    <div className="bg-[#2C3E2D]/10 text-[#2C3E2D] dark:bg-green-900/30 dark:text-green-400 p-1.5 rounded-full group-hover:scale-110 transition-transform">
                      <History className="h-4 w-4" />
                    </div>
                    <Badge variant="secondary" className="text-[10px] font-bold rounded-full bg-secondary/50">
                      {sale.cart.length} items
                    </Badge>
                  </div>
                  <div className="text-sm font-semibold truncate text-[#2C3E2D] dark:text-foreground">{sale.name}</div>
                  <div className="text-[10px] text-muted-foreground mt-1 tracking-wide uppercase">
                    Resume Workspace &rarr;
                  </div>
                </motion.div>
              ))}
            </div>
          )}

          {/* Product grid/list */}
          <AnimatePresence mode="wait">
            {viewMode === "grid" ? (
              <motion.div
                key="grid"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2 }}
                className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3"
              >
                {!products ? (
                  Array.from({ length: 8 }).map((_, i) => (
                    <div key={i} className="bg-white dark:bg-card rounded-xl border border-border p-3 space-y-2">
                      <Skeleton className="w-full h-20 rounded-lg" />
                      <Skeleton className="h-4 w-3/4" />
                      <Skeleton className="h-5 w-1/2" />
                    </div>
                  ))
                ) : (
                  filteredProducts.map((product) => {
                    const inCart = cart.find((i) => i.productId === product.id);
                    return (
                      <motion.div
                        layout
                        key={product.id}
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        className={cn(
                          "relative bg-white dark:bg-card rounded-xl border p-3 text-left transition-all hover:shadow-md",
                          inCart
                            ? "border-[#2C3E2D] dark:border-green-600 ring-1 ring-[#2C3E2D]/20"
                            : "border-[#E5E5E0] dark:border-border",
                          product.stock <= 0 && "opacity-40 pointer-events-none"
                        )}
                      >
                        <div onClick={() => toggleCartItem(product)} className="cursor-pointer">
                          {product.imageUrl && (
                            <img
                              src={product.imageUrl}
                              alt={product.name}
                              className="w-full h-20 object-cover rounded-lg mb-2"
                            />
                          )}
                          <div className="text-xs font-medium line-clamp-2 mb-1">
                            {product.name}
                          </div>
                          <div className="text-sm font-bold text-[#2C3E2D] dark:text-foreground">
                            {formatPrice(product.price)}
                          </div>
                          {product.stock <= 5 && product.stock > 0 && (
                            <div className="text-[10px] text-red-500 mt-1">
                              Only {product.stock} left
                            </div>
                          )}
                        </div>
                        {inCart ? (
                          <div className="flex items-center justify-between mt-2 pt-2 border-t border-border/50">
                            <button
                              className="w-7 h-7 rounded-full border border-[#E5E5E0] dark:border-border flex items-center justify-center hover:bg-muted transition"
                              onClick={(e) => { e.stopPropagation(); updateQuantity(product.id, -1); }}
                            >
                              <Minus className="h-3 w-3" />
                            </button>
                            <span className="text-sm font-bold">{inCart.quantity}</span>
                            <button
                              className="w-7 h-7 rounded-full border border-[#E5E5E0] dark:border-border flex items-center justify-center hover:bg-muted transition"
                              onClick={(e) => { e.stopPropagation(); updateQuantity(product.id, 1); }}
                            >
                              <Plus className="h-3 w-3" />
                            </button>
                          </div>
                        ) : (
                          <div className="absolute top-2 right-2">
                            <div className="w-6 h-6 rounded-full bg-muted/60 flex items-center justify-center">
                              <Plus className="h-3 w-3 text-muted-foreground" />
                            </div>
                          </div>
                        )}
                      </motion.div>
                    );
                  })
                )}
              </motion.div>
            ) : (
              <motion.div
                key="list"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2 }}
                className="bg-white dark:bg-card rounded-xl border border-border overflow-hidden"
              >
                <div className="divide-y divide-border">
                  {!products ? (
                    Array.from({ length: 6 }).map((_, i) => (
                      <div key={i} className="flex items-center gap-4 p-3 border-b border-border last:border-none">
                        <Skeleton className="w-12 h-12 rounded-lg" />
                        <div className="flex-1 space-y-2">
                           <Skeleton className="h-4 w-1/3" />
                           <Skeleton className="h-3 w-1/4" />
                        </div>
                        <div className="text-right space-y-2">
                           <Skeleton className="h-4 w-16 ml-auto" />
                           <Skeleton className="h-3 w-12 ml-auto" />
                        </div>
                      </div>
                    ))
                  ) : (
                    filteredProducts.map((product) => {
                      const inCart = cart.find((i) => i.productId === product.id);
                      return (
                        <motion.div
                          layout
                          key={product.id}
                          whileHover={{ backgroundColor: "rgba(0,0,0,0.02)" }}
                          className={cn(
                            "w-full flex items-center gap-4 p-3 text-left transition-all border-b border-border last:border-none",
                            inCart && "bg-primary/5",
                            product.stock <= 0 && "opacity-40 pointer-events-none"
                          )}
                        >
                          <div className="relative w-12 h-12 flex-shrink-0 cursor-pointer" onClick={() => toggleCartItem(product)}>
                            {product.imageUrl ? (
                              <img
                                src={product.imageUrl}
                                alt={product.name}
                                className="w-full h-full object-cover rounded-lg"
                              />
                            ) : (
                              <div className="w-full h-full bg-muted rounded-lg" />
                            )}
                            {inCart && (
                              <div className="absolute -top-1 -right-1 bg-[#2C3E2D] text-white w-4 h-4 rounded-full flex items-center justify-center text-[8px] font-bold">
                                {inCart.quantity}
                              </div>
                            )}
                          </div>
                          <div className="flex-1 min-w-0 cursor-pointer" onClick={() => toggleCartItem(product)}>
                            <div className="text-sm font-medium truncate">{product.name}</div>
                            <div className="text-xs text-muted-foreground uppercase">{product.category || "General"}</div>
                          </div>
                          <div className="text-right shrink-0">
                            <div className="text-sm font-bold">{formatPrice(product.price)}</div>
                            <div className={cn(
                              "text-[10px] font-medium",
                              product.stock <= 5 ? "text-red-500" : "text-muted-foreground"
                            )}>
                              {product.stock} in stock
                            </div>
                          </div>
                          {inCart && (
                            <div className="flex items-center gap-1 shrink-0">
                              <button
                                className="w-7 h-7 rounded-full border border-[#E5E5E0] dark:border-border flex items-center justify-center hover:bg-muted transition"
                                onClick={() => updateQuantity(product.id, -1)}
                              >
                                <Minus className="h-3 w-3" />
                              </button>
                              <span className="w-6 text-center text-sm font-bold">{inCart.quantity}</span>
                              <button
                                className="w-7 h-7 rounded-full border border-[#E5E5E0] dark:border-border flex items-center justify-center hover:bg-muted transition"
                                onClick={() => updateQuantity(product.id, 1)}
                              >
                                <Plus className="h-3 w-3" />
                              </button>
                            </div>
                          )}
                        </motion.div>

                      );
                    })
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* CENTER: Customers */}
        <div className="space-y-4">
          <div className="bg-white dark:bg-card rounded-xl border border-[#E5E5E0] dark:border-border p-4 h-[calc(100vh-140px)] flex flex-col">
            <h2 className="text-sm font-semibold tracking-[0.18em] uppercase text-muted-foreground mb-4">
              Customers
            </h2>
            <div className="relative mb-4 shrink-0">
              <div className="flex items-center bg-white dark:bg-card border border-[#E5E5E0] dark:border-border rounded-full h-10 px-3 transition-all duration-300 focus-within:border-primary/50 shadow-inner">
                <Search className={`h-4 w-4 shrink-0 transition-colors ${customerSearch.length > 0 ? 'text-primary' : 'text-muted-foreground'}`} />
                <Input
                  placeholder="Search name or phone..."
                  className="border-none focus-visible:ring-0 bg-transparent h-full text-sm placeholder:text-muted-foreground/50 px-2 w-full"
                  value={customerSearch}
                  onChange={(e) => setCustomerSearch(e.target.value)}
                />
                {customerSearch && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 shrink-0 rounded-full hover:bg-muted"
                    onClick={() => setCustomerSearch("")}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>
            
            <div className="flex-1 overflow-y-auto space-y-2 pr-2 scrollbar-hide">
              {customers?.slice(0, 10).map((customer) => {
                const isSelected = selectedCustomer?.id === customer.id;
                return (
                  <motion.button
                    layout
                    key={customer.id}
                    onClick={() => {
                      if (isSelected) {
                        setSelectedCustomer(null);
                        setCustomerName("Walk-in Customer");
                      } else {
                        setSelectedCustomer(customer);
                        setCustomerName(`${customer.firstName} ${customer.lastName}`);
                      }
                      setCustomerPhone("");
                    }}
                    className={cn(
                      "w-full text-left p-3 rounded-xl border transition-all hover:shadow-sm",
                      isSelected 
                        ? "bg-[#2C3E2D] border-[#2C3E2D] text-white ring-2 ring-[#2C3E2D]/20" 
                        : "bg-background border-[#E5E5E0] dark:border-border hover:border-primary/40"
                    )}
                  >
                    <div className="font-semibold text-sm truncate">
                      {customer.firstName} {customer.lastName}
                    </div>
                    <div className={cn("text-xs truncate", isSelected ? "text-white/80" : "text-muted-foreground")}>
                      {customer.email}
                    </div>
                    {customer.phoneNumber && (
                      <div className={cn("text-xs truncate mt-0.5", isSelected ? "text-white/80" : "text-muted-foreground")}>
                        {customer.phoneNumber}
                      </div>
                    )}
                    <div className="flex justify-between items-center mt-2 pt-2 border-t border-current/10">
                      <span className="text-[10px] uppercase font-bold tracking-wider opacity-80">
                        {customer.orderCount} Orders
                      </span>
                      <span className="text-xs font-bold">
                        {formatPrice(customer.totalSpent)}
                      </span>
                    </div>
                  </motion.button>
                );
              })}
              {customers?.length === 0 && (
                <div className="text-center py-8 text-muted-foreground text-sm flex flex-col items-center gap-3">
                  <p>No customers found for "{customerSearch}"</p>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="border-primary/20 hover:border-primary/50 text-primary bg-primary/5 rounded-full"
                    onClick={() => setIsAddCustomerOpen(true)}
                  >
                    <UserPlus className="w-4 h-4 mr-2" /> Add this Customer
                  </Button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* RIGHT: Cart and checkout */}
        <div className="space-y-4">
          {/* Selected Customer Header */}
          {selectedCustomer ? (
            <div className="bg-[#E8F3EB] dark:bg-green-950/30 rounded-xl p-4 border border-[#2C5234]/20 relative">
              <button
                className="absolute top-2 right-2 text-[#2C5234]/60 hover:text-[#2C5234] dark:text-green-400/60 dark:hover:text-green-400"
                onClick={() => {
                  setSelectedCustomer(null);
                  setCustomerName("Walk-in Customer");
                  setCustomerPhone("");
                  setCustomerSearch(""); // Clear search so they can find someone else easily
                }}
              >
                <X className="h-4 w-4" />
              </button>
              <div className="flex items-center gap-2 mb-1">
                <div className="bg-[#2C5234] text-white text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-sm">
                  Selected
                </div>
              </div>
              <div className="font-bold text-[#2C5234] dark:text-green-400 text-lg">
                {selectedCustomer.firstName} {selectedCustomer.lastName}
              </div>
              <div className="text-xs text-[#2C5234]/80 dark:text-green-400/80 mb-3">
                {selectedCustomer.email}
              </div>
              <div className="flex gap-4 pt-3 border-t border-[#2C5234]/10">
                <div>
                  <div className="text-[10px] uppercase text-[#2C5234]/70 dark:text-green-400/70 font-bold">Lifetime Value</div>
                  <div className="text-sm font-bold text-[#2C5234] dark:text-green-400">{formatPrice(selectedCustomer.totalSpent)}</div>
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-muted/30 rounded-xl p-4 border border-dashed border-border text-center">
              <div className="text-sm font-medium text-muted-foreground mb-1">Walk-in Customer</div>
              <div className="text-xs text-muted-foreground/60">Select from the middle column to link to a profile</div>
            </div>
          )}

          {/* Cart items */}
          <div className="bg-white dark:bg-card rounded-xl border border-[#E5E5E0] dark:border-border overflow-hidden">
            <div className="p-4 border-b border-[#E5E5E0] dark:border-border flex justify-between items-center">
              <div className="flex items-center gap-2">
                <ShoppingCart className="h-4 w-4" />
                <span className="font-medium text-sm">
                  Cart ({cart.length})
                </span>
              </div>
              {cart.length > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-yellow-600 hover:text-yellow-700 text-xs"
                  onClick={parkSale}
                >
                  <ParkingCircle className="h-3 w-3 mr-1" />
                  Park
                </Button>
              )}
            </div>
            <div className="max-h-[400px] overflow-y-auto">
              <AnimatePresence initial={false}>
                {cart.length === 0 ? (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="p-8 text-center text-muted-foreground text-sm"
                  >
                    Add products to cart
                  </motion.div>
                ) : (
                  cart.map((item) => (
                    <motion.div
                      layout
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -20 }}
                      key={item.productId}
                      className="flex items-center gap-3 p-3 border-b border-[#f5f5f5] dark:border-border last:border-none"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium truncate">
                          {item.productName}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {formatPrice(item.unitPrice)} × {item.quantity}
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="outline"
                          size="icon"
                          className="w-7 h-7 rounded-full border border-[#E5E5E0] dark:border-border"
                          onClick={() => updateQuantity(item.productId, -1)}
                        >
                          <Minus className="h-3 w-3" />
                        </Button>
                        <span className="w-6 text-center text-sm font-medium">
                          {item.quantity}
                        </span>
                        <Button
                          variant="outline"
                          size="icon"
                          className="w-7 h-7 rounded-full border border-[#E5E5E0] dark:border-border"
                          onClick={() => updateQuantity(item.productId, 1)}
                        >
                          <Plus className="h-3 w-3" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="w-7 h-7 rounded-full text-red-400 hover:bg-red-50"
                          onClick={() => removeFromCart(item.productId)}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                      <div className="w-20 text-right text-sm font-medium">
                        {formatPrice(item.lineTotal)}
                      </div>
                    </motion.div>
                  ))
                )}
              </AnimatePresence>
            </div>
          </div>

          {/* Totals + discount */}
          {cart.length > 0 && (
            <div className="bg-white dark:bg-card rounded-xl border border-[#E5E5E0] dark:border-border p-4 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Subtotal</span>
                <span>{formatPrice(subtotal)}</span>
              </div>
              <div className="flex justify-between text-sm items-center">
                <span className="text-muted-foreground">Discount</span>
                <Input
                  type="number"
                  value={discount}
                  onChange={(e) => setDiscount(e.target.value)}
                  className="w-24 h-7 text-right text-sm bg-background border-[#E5E5E0] rounded-full"
                />
              </div>
              <div className="border-t border-[#E5E5E0] pt-2 flex justify-between font-bold text-lg">
                <span>Total</span>
                <span>{formatPrice(total)}</span>
              </div>
            </div>
          )}

          {/* Payment methods */}
          {cart.length > 0 && (
            <div className="bg-white dark:bg-card rounded-xl border border-[#E5E5E0] dark:border-border p-4 space-y-3">
              <div className="text-sm font-medium mb-2">Payment Method</div>
              <div className="grid grid-cols-2 gap-2">
                {paymentMethods.map((pm) => {
                  const Icon = pm.icon;
                  return (
                    <button
                      key={pm.key}
                      className={cn(
                        "flex items-center gap-2 px-3 py-2 rounded-full border text-sm transition-all",
                        paymentMethod === pm.key
                          ? "bg-[#2C3E2D] text-white border-[#2C3E2D]"
                          : "bg-background border-[#E5E5E0] dark:border-border hover:bg-muted"
                      )}
                      onClick={() => setPaymentMethod(pm.key)}
                    >
                      <Icon className="h-4 w-4" />
                      {pm.label}
                    </button>
                  );
                })}
              </div>

              {/* Cash input */}
              {paymentMethod === "cash" && (
                <div className="space-y-2 pt-2">
                  <div>
                    <label className="text-xs text-muted-foreground">
                      Cash Received
                    </label>
                    <Input
                      type="number"
                      value={cashReceived}
                      onChange={(e) => setCashReceived(e.target.value)}
                      placeholder={String(total)}
                      className="bg-background border-[#E5E5E0] text-sm rounded-full"
                    />
                  </div>
                  {cashReceivedNum > 0 && (
                    <div className="flex justify-between text-sm font-medium text-green-600">
                      <span>Change</span>
                      <span>{formatPrice(changeAmount)}</span>
                    </div>
                  )}
                  {/* Quick cash buttons */}
                  <div className="flex gap-1 flex-wrap">
                    {[100, 500, 1000, 5000].map((amt) => (
                      <Button
                        key={amt}
                        variant="outline"
                        size="sm"
                        className="text-xs h-7 rounded-full"
                        onClick={() => setCashReceived(String(amt))}
                      >
                        Rs. {amt}
                      </Button>
                    ))}
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-xs h-7 rounded-full"
                      onClick={() => setCashReceived(String(total))}
                    >
                      Exact
                    </Button>
                  </div>
                </div>
              )}

              <Input
                placeholder="Notes (optional)"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="bg-background border-[#E5E5E0] text-sm rounded-full"
              />

              <Button
                className="w-full bg-[#2C3E2D] hover:bg-[#1A251B] text-white h-12 text-base font-medium"
                loading={chargeMutation.isPending}
                loadingText="Processing..."
                disabled={
                  cart.length === 0 ||
                  (paymentMethod === "cash" && cashReceivedNum < total)
                }
                onClick={() => chargeMutation.mutate()}
              >
                <CheckCircle2 className="mr-2 h-5 w-5" />
                Charge {formatPrice(total)}
              </Button>

              {(paymentMethod === "esewa" || paymentMethod === "khalti") && (
                <Button
                  variant="outline"
                  className="w-full h-10 mt-2 border-[#2C3E2D] text-[#2C3E2D]"
                  onClick={() => setShowQR(true)}
                >
                  Show QR Code
                </Button>
              )}
            </div>
          )}
        </div>
      </div>

      <Dialog open={showQR} onOpenChange={setShowQR}>
        <DialogContent className="sm:max-w-sm text-center">
          <DialogHeader>
            <DialogTitle className="text-xl font-serif">Scan to Pay</DialogTitle>
            <DialogDescription>
              Scan the QR code with your mobile banking app.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col items-center gap-4 py-4">
            <div className="bg-white border-2 border-[#2C3E2D] rounded-xl p-4 shadow-sm">
              <OptimizedImage
                src="/images/esewa-qr.webp"
                alt="Payment QR"
                className="w-full max-w-[200px] rounded-lg"
              />
            </div>
            <p className="text-sm text-muted-foreground">
              Total Amount: <span className="font-bold text-foreground">{formatPrice(total)}</span>
            </p>
          </div>
          <DialogFooter>
            <Button
              className="w-full bg-[#2C3E2D] hover:bg-[#1A251B] text-white rounded-full"
              onClick={() => setShowQR(false)}
            >
              I have paid
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showEndOfDay} onOpenChange={setShowEndOfDay}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="font-serif">Close Session</DialogTitle>
            <DialogDescription>
              Opened at {new Date(session.openedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <label className="text-sm font-medium text-muted-foreground mb-1 block">
                Closing Cash (NPR)
              </label>
              <Input
                type="number"
                value={closingCash}
                onChange={(e) => setClosingCash(e.target.value)}
                placeholder="0"
                className="bg-background border-[#E5E5E0] rounded-full"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="destructive"
              className="w-full rounded-full"
              onClick={handleCloseSession}
            >
              End Session & Close Terminal
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showSummaryDialog} onOpenChange={setShowSummaryDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <div className="mx-auto bg-green-100 p-3 rounded-full mb-4">
              <CheckCircle2 className="h-6 w-6 text-green-600" />
            </div>
            <DialogTitle className="text-center text-xl font-serif">Session Summary</DialogTitle>
            <DialogDescription className="text-center">
              Detailed breakdown of the closed session.
            </DialogDescription>
          </DialogHeader>
          {lastClosedSession && (
            <div className="space-y-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-muted/50 p-3 rounded-xl border border-border/50 text-center">
                  <div className="text-[10px] uppercase text-muted-foreground font-bold">Total Sales</div>
                  <div className="text-lg font-bold">{formatPrice(lastClosedSession.totalSales)}</div>
                </div>
                <div className="bg-muted/50 p-3 rounded-xl border border-border/50 text-center">
                  <div className="text-[10px] uppercase text-muted-foreground font-bold">Orders</div>
                  <div className="text-lg font-bold">{lastClosedSession.totalOrders}</div>
                </div>
                <div className="bg-muted/50 p-3 rounded-xl border border-border/50 text-center">
                  <div className="text-[10px] uppercase text-muted-foreground font-bold">Cash Sales</div>
                  <div className="text-sm font-semibold">{formatPrice(lastClosedSession.totalCashSales)}</div>
                </div>
                <div className="bg-muted/50 p-3 rounded-xl border border-border/50 text-center">
                  <div className="text-[10px] uppercase text-muted-foreground font-bold">Digital Sales</div>
                  <div className="text-sm font-semibold">{formatPrice(lastClosedSession.totalDigitalSales)}</div>
                </div>
              </div>
              <div className="space-y-2 pt-2 border-t border-border/50">
                 <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Opening Cash</span>
                    <span className="font-medium">{formatPrice(lastClosedSession.openingCash)}</span>
                 </div>
                 <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Closing Cash</span>
                    <span className="font-medium">{formatPrice(lastClosedSession.closingCash || 0)}</span>
                 </div>
              </div>
            </div>
          )}
          <DialogFooter className="sm:justify-center">
            <Button
              type="button"
              className="bg-[#2C3E2D] hover:bg-[#1A251B] text-white rounded-full px-8"
              onClick={() => setShowSummaryDialog(false)}
            >
              Close Summary
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Inline Quick Add Customer Dialog */}
      <Dialog open={isAddCustomerOpen} onOpenChange={setIsAddCustomerOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle className="font-serif text-2xl">Create Customer</DialogTitle>
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
              <Input 
                id="phoneNumber" 
                name="phoneNumber" 
                placeholder="e.g. 9812345678" 
                defaultValue={customerSearch.replace(/\D/g, '')} 
                className="rounded-lg" 
              />
            </div>
            <div className="pt-4 flex justify-end gap-3">
              <Button type="button" variant="outline" onClick={() => setIsAddCustomerOpen(false)} className="rounded-full">Cancel</Button>
              <Button type="submit" disabled={addCustomerMutation.isPending} className="rounded-full bg-[#2C3E2D] hover:bg-[#1A251B] text-white">
                {addCustomerMutation.isPending ? "Creating..." : "Save & Assign"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
