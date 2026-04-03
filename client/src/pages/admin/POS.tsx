import { lazy, Suspense, useEffect, useMemo, useRef, useState } from "react";
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
  AdminPlatform,
} from "@/lib/adminApi";
import {
  closePosSession,
  createPosBill,
  fetchAdminProducts,
  fetchTodaySession,
  openPosSession,
  fetchAdminCustomers,
  createAdminCustomer,
  fetchPlatforms,
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
  Landmark,
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
  IndianRupee,
  Users,
  User,
  Grid,
  List,
  ChevronDown,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
const BillViewer = lazy(() =>
  import("@/components/admin/BillViewer").then((module) => ({ default: module.BillViewer })),
);

interface CartItem {
  productId: string;
  productName: string;
  imageUrl: string;
  unitPrice: number;
  quantity: number;
  lineTotal: number;
}

const ESEWA_QR_IMAGE_PATH = "/public/images/esewa-qr.png";
const BANK_QR_IMAGE_PATH = "/public/images/bank-qr.png";
const BANK_NAME = "Nepal Investment Mega Bank";
const BANK_ACCOUNT_NAME = "TO_BE_FILLED_BY_NIKESH";
const BANK_ACCOUNT_NUMBER = "TO_BE_FILLED_BY_NIKESH";

export default function AdminPOS() {
  const [search, setSearch] = useState("");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [customerName, setCustomerName] = useState("Walk-in Customer");
  const [customerPhone, setCustomerPhone] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [platformSource, setPlatformSource] = useState<string>("pos");
  const [isPaid, setIsPaid] = useState(true);
  const [deliveryRequired, setDeliveryRequired] = useState(false);
  const [deliveryProvider, setDeliveryProvider] = useState<string>("");
  const [deliveryLocation, setDeliveryLocation] = useState<string>("");
  const [deliveryAddress, setDeliveryAddress] = useState<string>("");
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
  const [cashRollTick, setCashRollTick] = useState(0);
  const [showPaidCashIcon, setShowPaidCashIcon] = useState(false);
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [selectedCategory, setSelectedCategory] = useState("");
  const [isCustomersOpen, setIsCustomersOpen] = useState(false);
  const [customerViewMode, setCustomerViewMode] = useState<"grid" | "list">("list");
  const [showSocialCustomerDialog, setShowSocialCustomerDialog] = useState(false);
  const [socialCustomerName, setSocialCustomerName] = useState("");
  const [socialCustomerPhone, setSocialCustomerPhone] = useState("");
  const [socialCustomerEmail, setSocialCustomerEmail] = useState("");
  const [socialDeliveryLocation, setSocialDeliveryLocation] = useState("");
  const lastProductClickAtRef = useRef<Record<string, number>>({});
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
    if (!products) return [];
    const cats = Array.from(new Set(products.map((p) => p.category || "General").filter(Boolean)));
    return cats.sort();
  }, [products]);
  const visibleCategories = categories.slice(0, 8);
  const moreCategories = categories.slice(8);

  useEffect(() => {
    if (!categories.length) return;
    if (!selectedCategory || !categories.includes(selectedCategory)) {
      setSelectedCategory(categories[0]);
    }
  }, [categories, selectedCategory]);

  const filteredProducts = useMemo(() => {
    if (!products) return [];
    let result = products;
    // Category filter
    if (selectedCategory) {
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
  const hasValidCashPayment = paymentMethod === "cash" && cashReceivedNum >= total && total > 0;
  const prevHasValidCashPayment = useRef(false);

  useEffect(() => {
    if (paymentMethod !== "cash") return;
    setCashRollTick((prev) => prev + 1);
  }, [cashReceivedNum, paymentMethod]);

  useEffect(() => {
    if (hasValidCashPayment && !prevHasValidCashPayment.current) {
      setShowPaidCashIcon(true);
      const t = window.setTimeout(() => setShowPaidCashIcon(false), 1000);
      prevHasValidCashPayment.current = true;
      return () => window.clearTimeout(t);
    }
    if (!hasValidCashPayment) {
      prevHasValidCashPayment.current = false;
      setShowPaidCashIcon(false);
    }
  }, [hasValidCashPayment]);

  const formatNprNumber = (amount: number) =>
    amount.toLocaleString("en-NP", { maximumFractionDigits: 0 });

  // Cart operations

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

  const handleProductCardClick = (product: AdminProduct) => {
    if (product.stock <= 0) return;

    const now = Date.now();
    const lastClickedAt = lastProductClickAtRef.current[product.id] ?? 0;
    if (now - lastClickedAt < 300) return;
    lastProductClickAtRef.current[product.id] = now;

    const inCart = cart.some((i) => i.productId === product.id);
    if (inCart) {
      removeFromCart(product.id);
      return;
    }

    addToCart(product);
  };

  const addCustomerMutation = useMutation({
    mutationFn: createAdminCustomer,
    onSuccess: (newCustomer) => {
      toast({ title: "Customer created successfully" });
      setIsAddCustomerOpen(false);
      
      // Auto-select the newly created customer
      setSelectedCustomer(newCustomer);
      setCustomerName(`${newCustomer.firstName} ${newCustomer.lastName}`);
        setCustomerPhone(newCustomer.phoneNumber ?? "");
        // Reset cart/checkout totals when switching customers
        setCart([]);
        setDiscount("0");
        setCashReceived("");
        setNotes("");
        setDeliveryRequired(false);
        setDeliveryProvider("");
        setDeliveryLocation("");
        setDeliveryAddress("");
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
        customerName: isSocialDeliverySource
          ? socialCustomerName.trim()
          : selectedCustomer
            ? `${selectedCustomer.firstName} ${selectedCustomer.lastName}`
            : (customerName || "Walk-in Customer"),
        customerEmail: isSocialDeliverySource
          ? (socialCustomerEmail.trim() || undefined)
          : selectedCustomer?.email || undefined,
        customerPhone: isSocialDeliverySource
          ? socialCustomerPhone.trim()
          : "phoneNumber" in (selectedCustomer || {}) ? (selectedCustomer as any).phoneNumber : customerPhone || undefined,
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
        source: platformSource,
        isPaid,
        deliveryRequired: isSocialDeliverySource ? true : deliveryRequired,
        deliveryProvider: (isSocialDeliverySource || deliveryRequired) ? (deliveryProvider || null) : null,
        deliveryLocation: isSocialDeliverySource
          ? socialDeliveryLocation.trim()
          : (deliveryLocation || null),
        deliveryAddress: (isSocialDeliverySource || deliveryRequired) ? (deliveryAddress || null) : null,
        cashReceived: paymentMethod === "cash" ? cashReceivedNum : null,
        discountAmount: discountAmount,
        notes: notes || undefined,
      }),

    onSuccess: (newBill) => {
      setCompletedBill(newBill);
      setCart([]);
      setCustomerName("Walk-in Customer");
      setCustomerPhone("");
      setCashReceived("");
      setDiscount("0");
      setNotes("");
      setPlatformSource("pos");
      setIsPaid(true);
      setDeliveryRequired(false);
      setDeliveryProvider("");
      setDeliveryLocation("");
      setDeliveryAddress("");
      setSelectedCustomer(null);
      setSocialCustomerName("");
      setSocialCustomerPhone("");
      setSocialCustomerEmail("");
      setSocialDeliveryLocation("");
      setShowSocialCustomerDialog(false);
      toast({ title: "Checkout successful" });
    },

    onError: (error) => {
      toast({ 
        title: "Checkout Failed", 
        description: error instanceof Error ? error.message : "An error occurred during checkout.", 
        variant: "destructive" 
      });
      // Deliberately NOT clearing cart/customer state here so user can retry
    }
  });

  const handleCheckout = () => {
    if (isSocialDeliverySource && !hasValidSocialDetails()) {
      setShowSocialCustomerDialog(true);
      toast({
        title: "Social delivery details required",
        description: "Fill customer name, phone, delivery partner and delivery location.",
        variant: "destructive",
      });
      return;
    }
    chargeMutation.mutate();
  };

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
    { key: "fonepay", label: "Fonepay", icon: Smartphone },
    { key: "bank_transfer", label: "Bank Transfer", icon: Landmark },
  ];

  const { data: platforms = [] } = useQuery<AdminPlatform[]>({
    queryKey: ["admin", "platforms"],
    queryFn: fetchPlatforms,
  });

  const platformOptions = useMemo(() => {
    const defaults = [
      { key: "website", label: "Store" },
      { key: "pos", label: "POS" },
      { key: "instagram", label: "Instagram" },
      { key: "tiktok", label: "TikTok" },
    ];
    const custom = platforms.map((p) => ({ key: p.key, label: p.label }));
    const merged = new Map<string, string>();
    for (const d of [...defaults, ...custom]) merged.set(d.key, d.label);
    return Array.from(merged.entries()).map(([key, label]) => ({ key, label }));
  }, [platforms]);

  const isSocialDeliverySource = useMemo(
    () => !["pos", "website", "store"].includes((platformSource || "").toLowerCase()),
    [platformSource],
  );

  useEffect(() => {
    if (!isSocialDeliverySource) return;
    setDeliveryRequired(true);
    if (!socialCustomerName) {
      setSocialCustomerName(
        selectedCustomer
          ? `${selectedCustomer.firstName} ${selectedCustomer.lastName}`
          : customerName || "",
      );
    }
    if (!socialCustomerPhone) {
      setSocialCustomerPhone(
        selectedCustomer && "phoneNumber" in selectedCustomer
          ? (selectedCustomer as any).phoneNumber || ""
          : customerPhone || "",
      );
    }
    if (!socialCustomerEmail) {
      setSocialCustomerEmail(selectedCustomer?.email || "");
    }
    setShowSocialCustomerDialog(true);
  }, [isSocialDeliverySource]);

  const hasValidSocialDetails = () => {
    if (!isSocialDeliverySource) return true;
    return Boolean(
      socialCustomerName.trim() &&
      socialCustomerPhone.trim() &&
      socialDeliveryLocation.trim() &&
      deliveryProvider.trim(),
    );
  };

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
        <Suspense fallback={<div className="p-6 text-sm text-muted-foreground">Loading bill viewer...</div>}>
          <BillViewer
            bill={completedBill}
            onClose={() => setCompletedBill(null)}
          />
        </Suspense>
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
      <div className="flex flex-col gap-4 lg:flex-row lg:justify-between lg:items-center mb-6">
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
        <div className="flex flex-wrap gap-2 items-center">
          <div className="flex bg-white dark:bg-card border border-[#E5E5E0] dark:border-border rounded-full p-1 shadow-sm">
            <Button
              variant="ghost"
              size="sm"
              className={cn(
                "rounded-full h-8 text-xs font-semibold px-4",
                isCustomersOpen ? "bg-muted" : "text-muted-foreground"
              )}
              onClick={() => setIsCustomersOpen(true)}
            >
              <Search className="h-3.5 w-3.5 mr-2" />
              Search Customer
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="rounded-full h-8 text-xs font-semibold px-4 text-muted-foreground hover:text-foreground"
              onClick={() => setIsAddCustomerOpen(true)}
            >
              <UserPlus className="h-3.5 w-3.5 mr-2" />
              Add Customer
            </Button>
          </div>
          <Button
            variant="outline"
            className="border-red-300 text-red-600 hover:bg-red-50"
            onClick={() => setShowEndOfDay(true)}
          >
            End Session
          </Button>
        </div>
      </div>

      {/* Main Grid: Products | Cart */}
      <div className={cn(
        "grid grid-cols-1 gap-6 transition-all duration-300",
        isCustomersOpen ? "lg:grid-cols-[1fr_300px]" : "lg:grid-cols-[1fr_350px]"
      )}>
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
          <div className="flex flex-wrap items-center gap-2 pb-1 min-w-0">
            {visibleCategories.map((cat) => (
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
            {moreCategories.length > 0 && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="outline"
                    className="px-4 py-1.5 h-auto rounded-full text-sm font-medium whitespace-nowrap border-[#E5E5E0] dark:border-border"
                  >
                    More <ChevronDown className="h-3.5 w-3.5 ml-1" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="max-h-72 overflow-y-auto w-56">
                  {moreCategories.map((cat) => (
                    <DropdownMenuItem
                      key={cat}
                      onClick={() => setSelectedCategory(cat)}
                      className={cn(
                        "cursor-pointer",
                        selectedCategory === cat && "bg-muted font-semibold",
                      )}
                    >
                      {cat}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            )}
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
                    const isOutOfStock = product.stock <= 0;
                    const isLowStock = product.stock > 0 && product.stock <= 9;
                    const isInStock = product.stock >= 10;
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
                          isOutOfStock && "opacity-60"
                        )}
                      >
                        <div
                          onClick={() => handleProductCardClick(product)}
                          className={cn("cursor-pointer", isOutOfStock && "cursor-not-allowed")}
                        >
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
                          {isInStock && (
                            <div className="text-[10px] text-green-600 mt-1 font-medium">
                              In Stock: {product.stock}
                            </div>
                          )}
                          {isLowStock && (
                            <div className="text-[10px] text-amber-600 mt-1 font-medium">
                              Low Stock: {product.stock}
                            </div>
                          )}
                          {isOutOfStock && (
                            <div className="text-[10px] text-red-600 mt-1 font-medium">
                              Out of Stock
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
                      const isOutOfStock = product.stock <= 0;
                      const isLowStock = product.stock > 0 && product.stock <= 9;
                      const isInStock = product.stock >= 10;
                      return (
                        <motion.div
                          layout
                          key={product.id}
                          whileHover={{ backgroundColor: "rgba(0,0,0,0.02)" }}
                          className={cn(
                            "w-full flex items-center gap-4 p-3 text-left transition-all border-b border-border last:border-none",
                            inCart && "bg-primary/5",
                            isOutOfStock && "opacity-60"
                          )}
                        >
                          <div className={cn("relative w-12 h-12 flex-shrink-0", isOutOfStock ? "cursor-not-allowed" : "cursor-pointer")} onClick={() => handleProductCardClick(product)}>
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
                          <div className={cn("flex-1 min-w-0", isOutOfStock ? "cursor-not-allowed" : "cursor-pointer")} onClick={() => handleProductCardClick(product)}>
                            <div className="text-sm font-medium truncate">{product.name}</div>
                            <div className="text-xs text-muted-foreground uppercase">{product.category || "General"}</div>
                          </div>
                          <div className="text-right shrink-0">
                            <div className="text-sm font-bold">{formatPrice(product.price)}</div>
                            <div className={cn(
                              "text-[10px] font-medium",
                              isOutOfStock
                                ? "text-red-600"
                                : isLowStock
                                  ? "text-amber-600"
                                  : "text-green-600"
                            )}>
                              {isOutOfStock
                                ? "Out of Stock"
                                : isLowStock
                                  ? `Low Stock: ${product.stock}`
                                  : `In Stock: ${product.stock}`}
                            </div>
                          </div>
                          {inCart && (
                            <div className="flex items-center gap-1 shrink-0">
                              <button
                                className="w-7 h-7 rounded-full border border-[#E5E5E0] dark:border-border flex items-center justify-center hover:bg-muted transition"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  updateQuantity(product.id, -1);
                                }}
                              >
                                <Minus className="h-3 w-3" />
                              </button>
                              <span className="w-6 text-center text-sm font-bold">{inCart.quantity}</span>
                              <button
                                className="w-7 h-7 rounded-full border border-[#E5E5E0] dark:border-border flex items-center justify-center hover:bg-muted transition"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  updateQuantity(product.id, 1);
                                }}
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

        {/* Removed fixed middle column for customers */}

        {/* RIGHT: Cart and checkout */}
        <div className="space-y-4">
          {/* Selected Customer Header */}
          {selectedCustomer ? (
            <div className="bg-[#E8F3EB] dark:bg-green-950/30 rounded-xl p-4 border border-[#2C5234]/20 relative shadow-sm">
              <button
                className="absolute top-2 right-2 text-[#2C5234]/60 hover:text-[#2C5234] dark:text-green-400/60 dark:hover:text-green-400"
                onClick={() => {
                  setSelectedCustomer(null);
                  setCustomerName("Walk-in Customer");
                  setCustomerPhone("");
                  setCustomerSearch("");
                  // Reset cart/checkout state when detaching customer
                  setCart([]);
                  setDiscount("0");
                  setCashReceived("");
                  setNotes("");
                  setDeliveryRequired(false);
                  setDeliveryProvider("");
                  setDeliveryLocation("");
                  setDeliveryAddress("");
                }}
              >
                <X className="h-4 w-4" />
              </button>
              <div className="flex items-center gap-2 mb-1">
                <Users className="w-3.5 h-3.5 text-[#2C5234]" />
                <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#2C5234]/70">Selected Customer</span>
              </div>
              <div className="font-bold text-[#2C3E2D] dark:text-foreground text-lg mb-1 truncate">
                {selectedCustomer.firstName} {selectedCustomer.lastName}
              </div>
              <div className="text-xs text-muted-foreground flex items-center gap-1.5 mb-3">
                <Badge variant="outline" className="h-4 text-[9px] bg-white border-[#2C5234]/10 text-[#2C5234]">{selectedCustomer.orderCount} Orders</Badge>
                <span className="text-primary font-bold">{formatPrice(selectedCustomer.totalSpent)} Total</span>
              </div>
            </div>
          ) : (
            <div className="bg-muted/10 rounded-xl p-4 border border-dashed border-border text-center flex flex-col items-center justify-center gap-1 min-h-[100px]">
              <div className="w-8 h-8 rounded-full bg-muted/20 flex items-center justify-center mb-1">
                <User className="w-4 h-4 text-muted-foreground/60" />
              </div>
              <div className="text-sm font-medium text-muted-foreground">Walk-in Customer</div>
              <Button 
                variant="link" 
                size="sm" 
                className="text-[10px] h-auto p-0 text-primary uppercase tracking-widest font-bold"
                onClick={() => setIsCustomersOpen(true)}
              >
                Attach Profile
              </Button>
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
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div className="space-y-1">
                  <div className="text-xs font-medium text-muted-foreground">
                    Platform
                  </div>
                  <select
                    value={platformSource}
                    onChange={(e) => setPlatformSource(e.target.value)}
                    className="h-10 w-full rounded-full border border-[#E5E5E0] dark:border-border bg-background px-4 text-sm"
                  >
                    {platformOptions.map((platform) => (
                      <option key={platform.key} value={platform.key}>
                        {platform.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1">
                  <div className="text-xs font-medium text-muted-foreground">
                    Paid status
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsPaid((v) => !v)}
                    className={cn(
                      "h-10 w-full rounded-full border px-4 text-sm text-left transition-colors",
                      isPaid
                        ? "bg-[#2C3E2D] text-white border-[#2C3E2D]"
                        : "bg-background border-[#E5E5E0] dark:border-border hover:bg-muted",
                    )}
                  >
                    {isPaid ? "Paid" : "Unpaid"}
                  </button>
                </div>
              </div>

              <div className="rounded-xl border border-muted/40 bg-muted/10 p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="text-sm font-medium">Delivery</div>
                  <button
                    type="button"
                    className={cn(
                      "text-xs font-semibold rounded-full px-3 py-1 border transition-colors",
                      deliveryRequired
                        ? "bg-[#2C3E2D] text-white border-[#2C3E2D]"
                        : "bg-background border-muted/50 text-muted-foreground hover:text-foreground",
                    )}
                    onClick={() => {
                      if (isSocialDeliverySource) return;
                      setDeliveryRequired((v) => !v);
                    }}
                  >
                    {isSocialDeliverySource ? "Required (Social)" : deliveryRequired ? "Required" : "Not required"}
                  </button>
                </div>
                {deliveryRequired && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <div className="text-xs text-muted-foreground">Provider</div>
                      <select
                        value={deliveryProvider}
                        onChange={(e) => setDeliveryProvider(e.target.value)}
                        className="h-10 w-full rounded-full border border-[#E5E5E0] dark:border-border bg-background px-4 text-sm"
                      >
                        <option value="">Select…</option>
                        <option value="pathao">Pathao Parcel</option>
                        <option value="nepal_can_move">Nepal Can Move</option>
                        <option value="yango">Yango</option>
                        <option value="other">Other</option>
                      </select>
                    </div>
                    <div className="space-y-1">
                      <div className="text-xs text-muted-foreground">
                        Delivery Location {isSocialDeliverySource ? "*" : ""}
                      </div>
                      <Input
                        value={isSocialDeliverySource ? socialDeliveryLocation : deliveryLocation}
                        onChange={(e) =>
                          isSocialDeliverySource
                            ? setSocialDeliveryLocation(e.target.value)
                            : setDeliveryLocation(e.target.value)
                        }
                        placeholder="Area / landmark / locality"
                        className="h-10 bg-background border-[#E5E5E0] dark:border-border rounded-full"
                      />
                    </div>
                    <div className="space-y-1 sm:col-span-2">
                      <div className="text-xs text-muted-foreground">Address</div>
                      <Input
                        value={deliveryAddress}
                        onChange={(e) => setDeliveryAddress(e.target.value)}
                        placeholder="Delivery address"
                        className="h-10 bg-background border-[#E5E5E0] dark:border-border rounded-full"
                      />
                    </div>
                  </div>
                )}
              </div>

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

              {paymentMethod === "esewa" && (
                <div className="rounded-xl border border-[#E5E5E0] dark:border-border bg-muted/10 p-4 space-y-3">
                  <p className="text-sm font-medium text-center">Scan to pay via eSewa</p>
                  <div className="flex justify-center">
                    <div className="bg-white rounded-xl border border-[#E5E5E0] dark:border-border p-3 shadow-sm">
                      <OptimizedImage
                        src={ESEWA_QR_IMAGE_PATH}
                        alt="eSewa QR"
                        className="w-full max-w-[220px] rounded-lg"
                      />
                    </div>
                  </div>
                </div>
              )}

              {(paymentMethod === "fonepay" || paymentMethod === "bank_transfer") && (
                <div className="rounded-xl border border-[#E5E5E0] dark:border-border bg-muted/10 p-4 space-y-3">
                  <p className="text-sm font-medium text-center">
                    Scan to pay via Fonepay / Bank Transfer
                  </p>
                  <div className="flex justify-center">
                    <div className="bg-white rounded-xl border border-[#E5E5E0] dark:border-border p-3 shadow-sm">
                      <OptimizedImage
                        src={BANK_QR_IMAGE_PATH}
                        alt="Fonepay or Bank Transfer QR"
                        className="w-full max-w-[220px] rounded-lg"
                      />
                    </div>
                  </div>
                  <div className="rounded-lg bg-white/80 dark:bg-card border border-[#E5E5E0] dark:border-border p-3 space-y-1 text-sm">
                    <div>
                      <span className="text-muted-foreground">Bank Name: </span>
                      <span className="font-medium">{BANK_NAME}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Account Name: </span>
                      <span className="font-medium">{BANK_ACCOUNT_NAME}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Account Number: </span>
                      <span className="font-medium">{BANK_ACCOUNT_NUMBER}</span>
                    </div>
                  </div>
                </div>
              )}

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
                  <div className="relative overflow-hidden rounded-xl border border-[#E5E5E0] dark:border-border bg-muted/20 px-3 py-2">
                    <div className="text-[11px] uppercase tracking-wide text-muted-foreground">
                      Amount Received
                    </div>
                    <div className="flex items-center gap-1 text-lg font-semibold text-[#2C3E2D] dark:text-foreground">
                      <span className="text-sm">NPR</span>
                      <div
                        key={cashRollTick}
                        className="inline-flex items-center gap-[1px]"
                        aria-live="polite"
                      >
                        {formatNprNumber(Math.max(0, cashReceivedNum))
                          .split("")
                          .map((ch, idx) => (
                            <span
                              key={`${ch}-${idx}`}
                              className={/\d/.test(ch) ? "pos-digit-roll" : "text-muted-foreground"}
                              style={{ animationDelay: `${idx * 8}ms` }}
                            >
                              {ch}
                            </span>
                          ))}
                      </div>
                    </div>
                    {showPaidCashIcon && (
                      <div className="absolute right-2 top-2 flex items-center text-green-600 pos-paid-icon-pop">
                        <IndianRupee className="h-4 w-4" />
                      </div>
                    )}
                  </div>
                  <div className="flex justify-between text-sm font-medium text-green-600">
                    <span>Change to Return</span>
                    <span>NPR {formatNprNumber(changeAmount)}</span>
                  </div>
                  {/* Quick cash buttons */}
                  <div className="flex gap-1 flex-wrap">
                    {[100, 200, 500, 1000].map((amt) => (
                      <Button
                        key={amt}
                        variant="outline"
                        size="sm"
                        className="text-xs h-7 rounded-full"
                        onClick={() =>
                          setCashReceived((prev) => String((Number(prev) || 0) + amt))
                        }
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
                  (paymentMethod === "cash" && cashReceivedNum < total) ||
                  (isSocialDeliverySource && !hasValidSocialDetails())
                }
                onClick={handleCheckout}
              >
                <CheckCircle2 className="mr-2 h-5 w-5" />
                Charge {formatPrice(total)}
              </Button>

              {paymentMethod === "esewa" && (
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
                src={ESEWA_QR_IMAGE_PATH}
                alt="eSewa QR"
                className="w-full max-w-[200px] rounded-lg"
              />
            </div>
            <p className="text-sm font-medium">Scan to pay via eSewa</p>
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

      <Dialog open={showSocialCustomerDialog} onOpenChange={setShowSocialCustomerDialog}>
        <DialogContent className="sm:max-w-[480px] rounded-2xl">
          <DialogHeader>
            <DialogTitle className="font-serif text-xl">Social Order Details</DialogTitle>
            <DialogDescription>
              Required for Instagram/TikTok and other delivery platform orders.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1.5">
              <Label className="text-xs uppercase font-bold tracking-widest text-muted-foreground">Customer Name *</Label>
              <Input
                value={socialCustomerName}
                onChange={(e) => setSocialCustomerName(e.target.value)}
                placeholder="Full name"
                className="h-11 rounded-xl"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs uppercase font-bold tracking-widest text-muted-foreground">Phone Number *</Label>
              <Input
                value={socialCustomerPhone}
                onChange={(e) => setSocialCustomerPhone(e.target.value)}
                placeholder="98XXXXXXXX"
                className="h-11 rounded-xl"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs uppercase font-bold tracking-widest text-muted-foreground">Delivery Partner *</Label>
              <select
                value={deliveryProvider}
                onChange={(e) => setDeliveryProvider(e.target.value)}
                className="h-11 w-full rounded-xl border border-[#E5E5E0] dark:border-border bg-background px-4 text-sm"
              >
                <option value="">Select delivery partner…</option>
                <option value="pathao">Pathao Parcel</option>
                <option value="nepal_can_move">Nepal Can Move</option>
                <option value="yango">Yango</option>
                <option value="other">Other</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs uppercase font-bold tracking-widest text-muted-foreground">Delivery Location *</Label>
              <Input
                value={socialDeliveryLocation}
                onChange={(e) => setSocialDeliveryLocation(e.target.value)}
                placeholder="Area / landmark / locality"
                className="h-11 rounded-xl"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs uppercase font-bold tracking-widest text-muted-foreground">Email (Optional)</Label>
              <Input
                type="email"
                value={socialCustomerEmail}
                onChange={(e) => setSocialCustomerEmail(e.target.value)}
                placeholder="customer@example.com"
                className="h-11 rounded-xl"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              className="w-full bg-[#2C3E2D] hover:bg-[#1A251B] text-white h-11 rounded-xl"
              onClick={() => {
                if (!hasValidSocialDetails()) {
                  toast({
                    title: "Missing required fields",
                    description: "Name, phone, delivery partner and delivery location are required.",
                    variant: "destructive",
                  });
                  return;
                }
                setCustomerName(socialCustomerName.trim());
                setCustomerPhone(socialCustomerPhone.trim());
                setDeliveryRequired(true);
                setDeliveryLocation(socialDeliveryLocation.trim());
                setShowSocialCustomerDialog(false);
              }}
            >
              Save Details
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Customer Selection Modal */}
      <Dialog open={isCustomersOpen} onOpenChange={setIsCustomersOpen}>
        <DialogContent className="sm:max-w-4xl max-h-[90vh] flex flex-col p-0 overflow-hidden rounded-2xl">
          <DialogHeader className="p-6 border-b border-border space-y-4">
            <div className="flex justify-between items-center">
              <div>
                <DialogTitle className="text-2xl font-serif">Customer Directory</DialogTitle>
                <DialogDescription>Search and select a customer to link to this order.</DialogDescription>
              </div>
              <div className="flex items-center gap-2 bg-muted/50 p-1 rounded-lg border border-border/50">
                <Button 
                  variant={customerViewMode === 'list' ? 'secondary' : 'ghost'} 
                  size="sm" 
                  className="h-8 w-8 p-0 rounded-md"
                  onClick={() => setCustomerViewMode('list')}
                >
                  <List className="h-4 w-4" />
                </Button>
                <Button 
                  variant={customerViewMode === 'grid' ? 'secondary' : 'ghost'} 
                  size="sm" 
                  className="h-8 w-8 p-0 rounded-md"
                  onClick={() => setCustomerViewMode('grid')}
                >
                  <Grid className="h-4 w-4" />
                </Button>
              </div>
            </div>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search customers by name, email or phone..."
                className="pl-10 h-12 bg-muted/20 border-border rounded-xl"
                value={customerSearch}
                onChange={(e) => setCustomerSearch(e.target.value)}
                autoFocus
              />
            </div>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto p-6 scrollbar-hide">
            {customerViewMode === 'list' ? (
              <div className="bg-white dark:bg-card border border-border rounded-xl overflow-hidden">
                <table className="w-full text-sm text-left">
                  <thead className="bg-muted/50 text-[10px] uppercase font-bold tracking-widest text-muted-foreground border-b border-border">
                    <tr>
                      <th className="px-4 py-3">Customer</th>
                      <th className="px-4 py-3">Contact</th>
                      <th className="px-4 py-3">Sales</th>
                      <th className="px-4 py-3 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {customers?.map((customer) => {
                      const isSelected = selectedCustomer?.id === customer.id;
                      return (
                        <tr key={customer.id} className={cn("hover:bg-muted/20 transition-colors", isSelected && "bg-primary/5")}>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-full bg-[#2C3E2D]/10 flex items-center justify-center text-[#2C3E2D] font-bold text-xs uppercase">
                                {customer.firstName[0]}{customer.lastName[0]}
                              </div>
                              <div className="font-semibold text-[#2C3E2D] dark:text-foreground">
                                {customer.firstName} {customer.lastName}
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-xs text-muted-foreground">
                            <div>{customer.email}</div>
                            <div>{customer.phoneNumber || 'No phone'}</div>
                          </td>
                          <td className="px-4 py-3">
                            <div className="text-xs font-bold">{formatPrice(customer.totalSpent)}</div>
                            <div className="text-[10px] text-muted-foreground uppercase">{customer.orderCount} Orders</div>
                          </td>
                          <td className="px-4 py-3 text-right">
                            <Button 
                              size="sm" 
                              variant={isSelected ? "secondary" : "default"}
                              className={cn("rounded-full h-8 px-4", isSelected ? "bg-[#2C3E2D] text-white hover:bg-[#1A251B]" : "bg-[#2C3E2D] hover:bg-[#1A251B]")}
                              onClick={() => {
                                const nextCustomer = isSelected ? null : customer;
                                setSelectedCustomer(nextCustomer);
                                setCustomerName(
                                  nextCustomer
                                    ? `${nextCustomer.firstName} ${nextCustomer.lastName}`
                                    : "Walk-in Customer",
                                );
                                setCustomerPhone(nextCustomer?.phoneNumber ?? "");
                                // Reset cart/checkout totals when switching customers
                                setCart([]);
                                setDiscount("0");
                                setCashReceived("");
                                setNotes("");
                                setDeliveryRequired(false);
                                setDeliveryProvider("");
                                setDeliveryLocation("");
                                setDeliveryAddress("");
                                setIsCustomersOpen(false);
                              }}
                            >
                              {isSelected ? "Unlink" : "Select"}
                            </Button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {customers?.map((customer) => {
                  const isSelected = selectedCustomer?.id === customer.id;
                  return (
                    <div 
                      key={customer.id} 
                      className={cn(
                        "p-4 rounded-2xl border transition-all cursor-pointer hover:shadow-md h-full flex flex-col",
                        isSelected ? "bg-primary/5 border-primary ring-1 ring-primary" : "bg-card border-border hover:border-primary/50"
                      )}
                      onClick={() => {
                        setSelectedCustomer(customer);
                        setCustomerName(`${customer.firstName} ${customer.lastName}`);
                        setCustomerPhone(customer.phoneNumber ?? "");
                        // Reset cart/checkout totals when switching customers
                        setCart([]);
                        setDiscount("0");
                        setCashReceived("");
                        setNotes("");
                        setDeliveryRequired(false);
                        setDeliveryProvider("");
                        setDeliveryLocation("");
                        setDeliveryAddress("");
                        setIsCustomersOpen(false);
                      }}
                    >
                      <div className="flex items-center gap-3 mb-3">
                        <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-sm">
                          {customer.firstName[0]}{customer.lastName[0]}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="font-bold text-sm truncate">{customer.firstName} {customer.lastName}</div>
                          <div className="text-[10px] text-muted-foreground truncate">{customer.email}</div>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-2 mt-auto pt-3 border-t border-border">
                        <div>
                          <p className="text-[9px] uppercase font-bold text-muted-foreground">Orders</p>
                          <p className="font-bold text-xs">{customer.orderCount}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-[9px] uppercase font-bold text-muted-foreground">Spent</p>
                          <p className="font-bold text-xs text-primary">{formatPrice(customer.totalSpent)}</p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
            
            {customers?.length === 0 && (
              <div className="py-20 text-center flex flex-col items-center gap-4">
                <div className="w-16 h-16 rounded-full bg-muted/20 flex items-center justify-center">
                  <UserPlus className="w-8 h-8 text-muted-foreground/40" />
                </div>
                <div>
                   <h3 className="font-bold text-lg">No Results Found</h3>
                   <p className="text-muted-foreground">No customers match your current search criteria.</p>
                </div>
                <Button 
                   className="bg-[#2C3E2D] hover:bg-[#1A251B] h-10 px-8 rounded-full"
                   onClick={() => {
                     setIsCustomersOpen(false);
                     setIsAddCustomerOpen(true);
                   }}
                >
                  Create New Profile
                </Button>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Inline Quick Add Customer Dialog */}
      <Dialog open={isAddCustomerOpen} onOpenChange={setIsAddCustomerOpen}>
        <DialogContent className="sm:max-w-[425px] p-0 overflow-hidden rounded-2xl">
          <div className="bg-[#2C3E2D] p-6 text-white">
            <h2 className="text-2xl font-serif">Quick Create</h2>
            <p className="text-white/70 text-sm">Fast-track new customer profile creation.</p>
          </div>
          <form onSubmit={handleAddSubmit} className="p-6 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="firstName" className="text-xs uppercase font-bold tracking-widest text-muted-foreground">First Name *</Label>
                <Input id="firstName" name="firstName" required className="bg-muted/30 border-none rounded-xl h-11 focus-visible:ring-1 focus-visible:ring-primary/20" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="lastName" className="text-xs uppercase font-bold tracking-widest text-muted-foreground">Last Name *</Label>
                <Input id="lastName" name="lastName" required className="bg-muted/30 border-none rounded-xl h-11 focus-visible:ring-1 focus-visible:ring-primary/20" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="email" className="text-xs uppercase font-bold tracking-widest text-muted-foreground">Email Address</Label>
              <Input id="email" name="email" type="email" placeholder="customer@example.com" className="bg-muted/30 border-none rounded-xl h-11 focus-visible:ring-1 focus-visible:ring-primary/20" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="phoneNumber" className="text-xs uppercase font-bold tracking-widest text-muted-foreground">Phone Number</Label>
              <Input 
                id="phoneNumber" 
                name="phoneNumber" 
                placeholder="e.g. 9812345678" 
                defaultValue={customerSearch.replace(/\D/g, '')} 
                className="bg-muted/30 border-none rounded-xl h-11 focus-visible:ring-1 focus-visible:ring-primary/20" 
              />
            </div>
            <div className="pt-4 flex flex-col gap-2">
              <Button type="submit" disabled={addCustomerMutation.isPending} className="w-full bg-[#2C3E2D] hover:bg-[#1A251B] text-white h-12 rounded-xl text-base font-semibold">
                {addCustomerMutation.isPending ? "Creating profile..." : "Save & Attach Profile"}
              </Button>
              <Button type="button" variant="ghost" onClick={() => setIsAddCustomerOpen(false)} className="w-full h-10 text-muted-foreground hover:bg-muted">Cancel</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
