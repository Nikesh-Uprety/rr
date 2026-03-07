import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, User, Tag } from "lucide-react";
import { fetchProducts, type ProductApi, createOrder } from "@/lib/api";
import type { OrderInput } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { formatPrice } from "@/lib/format";

interface PosItem {
  product: ProductApi;
  quantity: number;
}

export default function AdminPOS() {
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [items, setItems] = useState<PosItem[]>([]);
  const { toast } = useToast();

  useEffect(() => {
    const id = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(id);
  }, [search]);

  const { data: products } = useQuery<ProductApi[]>({
    queryKey: ["pos", "products", debouncedSearch],
    queryFn: () =>
      fetchProducts({ search: debouncedSearch || undefined, limit: 20 }),
  });

  const addToCart = (product: ProductApi) => {
    setItems((prev) => {
      const existing = prev.find((i) => i.product.id === product.id);
      if (existing) {
        return prev.map((i) =>
          i.product.id === product.id
            ? { ...i, quantity: i.quantity + 1 }
            : i,
        );
      }
      return [...prev, { product, quantity: 1 }];
    });
  };

  const subtotal = useMemo(
    () =>
      items.reduce(
        (sum, item) => sum + item.product.price * item.quantity,
        0,
      ),
    [items],
  );

  const tax = subtotal * 0.15;
  const total = subtotal + tax;

  const checkoutMutation = useMutation({
    mutationFn: async () => {
      const orderInput: OrderInput = {
        items: items.map((item) => ({
          productId: item.product.id,
          quantity: item.quantity,
          priceAtTime: Number(item.product.price),
        })),
        shipping: {
          firstName: "POS",
          lastName: "Customer",
          email: "pos@example.com",
          address: "In-store",
          city: "Kathmandu",
          state: "Bagmati",
          zip: "00000",
          country: "NP",
        },
        paymentMethod: "pos-cash",
      };
      const res = await createOrder(orderInput);
      if (!res.success) {
        throw new Error(res.error || "Failed to create order");
      }
      return res;
    },
    onSuccess: () => {
      setItems([]);
      toast({ title: "POS order completed" });
    },
    onError: (err: Error) => {
      const msg = err?.message ?? "Failed to complete checkout";
      const serverMsg = msg.startsWith("400:")
        ? msg.replace(/^\d+:\s*/, "")
        : msg.startsWith("500:")
          ? "Server error. Please try again."
          : msg;
      try {
        const parsed = typeof serverMsg === "string" && serverMsg.startsWith("{") ? JSON.parse(serverMsg) : null;
        toast({
          title: "Checkout failed",
          description: parsed?.error ?? serverMsg,
          variant: "destructive",
        });
      } catch {
        toast({ title: "Checkout failed", description: serverMsg, variant: "destructive" });
      }
    },
  });

  return (
    <div className="flex h-[calc(100vh-theme(spacing.20))] md:h-[calc(100vh-theme(spacing.24))] gap-6 -m-2 animate-in fade-in duration-500">
      {/* Product Search & Grid */}
      <div className="flex-1 flex flex-col min-w-0 bg-transparent rounded-xl border-none">
        <div className="p-4 border-b border-transparent">
          <h1 className="text-2xl font-serif font-medium text-[#2C3E2D] dark:text-foreground mb-1">
            Point of Sale
          </h1>
          <p className="text-sm text-muted-foreground mb-4">
            Search catalog and add items to the in-store order.
          </p>
          <div className="relative w-full">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search catalog..."
              className="pl-9 bg-[#E5E5E0]/50 dark:bg-muted border-transparent rounded-lg h-11"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>
        <div className="flex-1 bg-transparent p-4 overflow-y-auto">
          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
            {(products ?? []).map((product) => (
              <button
                key={product.id}
                type="button"
                onClick={() => addToCart(product)}
                className="bg-white dark:bg-card rounded-xl border border-[#E5E5E0] dark:border-border p-4 text-left hover:shadow-sm transition-shadow"
              >
                <div className="text-xs text-muted-foreground uppercase mb-1">
                  {product.category ?? "Product"}
                </div>
                <div className="text-xs font-bold uppercase tracking-widest mb-1 line-clamp-2">
                  {product.name}
                </div>
                <div className="text-sm font-medium">
                  {formatPrice(product.price)}
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Cart Sidebar */}
      <div className="w-80 lg:w-96 bg-white dark:bg-card border-l border-[#E5E5E0] dark:border-border flex flex-col">
        <div className="p-4 border-b border-[#E5E5E0] dark:border-border">
          <div className="text-xs font-semibold tracking-wider text-muted-foreground uppercase mb-4">
            Current POS Order
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              className="flex-1 justify-start text-muted-foreground border-[#E5E5E0] dark:border-border bg-[#F5F5F3] dark:bg-muted h-10"
            >
              <User className="h-4 w-4 mr-2" /> Add Customer
            </Button>
            <Button
              variant="outline"
              className="flex-1 justify-start text-muted-foreground border-[#E5E5E0] dark:border-border bg-[#F5F5F3] dark:bg-muted h-10"
            >
              <Tag className="h-4 w-4 mr-2" /> Add Discount
            </Button>
          </div>
        </div>

        <div className="flex-1 p-4 overflow-y-auto">
          {items.length === 0 ? (
            <div className="text-center text-muted-foreground flex flex-col items-center gap-2 mt-12">
              <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mb-2">
                <svg
                  width="24"
                  height="24"
                  viewBox="0 0 24 24"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                  className="text-muted-foreground opacity-50"
                >
                  <path
                    d="M6 2L3 6V20C3 20.5304 3.21071 21.0391 3.58579 21.4142C3.96086 21.7893 4.46957 22 5 22H19C19.5304 22 20.0391 21.7893 20.4142 21.4142C20.7893 21.0391 21 20.5304 21 20V6L18 2H6Z"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  <path
                    d="M3 6H21"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  <path
                    d="M16 10C16 11.0609 15.5786 12.0783 14.8284 12.8284C14.0783 13.5786 13.0609 14 12 14C10.9391 14 9.92172 13.5786 9.17157 12.8284C8.42143 12.0783 8 11.0609 8 10"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </div>
              Bag is empty
            </div>
          ) : (
            <div className="space-y-3">
              {items.map((item) => (
                <div
                  key={item.product.id}
                  className="flex justify-between items-center text-sm"
                >
                  <div>
                    <div className="font-medium">
                      {item.product.name} × {item.quantity}
                    </div>
                    <div className="text-muted-foreground text-xs">
                      {formatPrice(item.product.price)} each
                    </div>
                  </div>
                  <div className="font-medium">
                    {formatPrice(item.product.price * item.quantity)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="p-6 border-t border-[#E5E5E0] dark:border-border space-y-4">
          <div className="space-y-2 text-sm">
            <div className="flex justify-between text-muted-foreground">
              <span>Subtotal</span>
              <span>{formatPrice(subtotal)}</span>
            </div>
            <div className="flex justify-between text-muted-foreground">
              <span>Tax (15%)</span>
              <span>{formatPrice(tax)}</span>
            </div>
          </div>

          <div className="pt-4 border-t border-[#E5E5E0] dark:border-border flex justify-between items-center">
            <span className="font-medium tracking-wide">TOTAL</span>
            <span className="text-2xl font-serif font-bold">
              {formatPrice(total)}
            </span>
          </div>

          <div className="flex gap-3 pt-2">
            <Button
              className="flex-1 bg-[#2C3E2D] hover:bg-[#1A251B] text-white dark:bg-primary dark:text-primary-foreground h-12"
              disabled={items.length === 0 || checkoutMutation.isLoading}
              onClick={() => checkoutMutation.mutate()}
            >
              CHECKOUT
            </Button>
            <Button
              variant="outline"
              className="flex-1 bg-white dark:bg-transparent border-[#E5E5E0] dark:border-border text-[#2C3E2D] dark:text-foreground h-12"
              onClick={() => setItems([])}
            >
              PARK SALE
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}