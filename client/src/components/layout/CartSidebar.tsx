import { Link, useLocation } from "wouter";
import { Minus, Plus, ShoppingBag, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { formatPrice } from "@/lib/format";
import { useCartStore } from "@/store/cart";

const SHIPPING_FEE = 100;

export default function CartSidebar() {
  const [, setLocation] = useLocation();
  const items = useCartStore((state) => state.items);
  const isCartSidebarOpen = useCartStore((state) => state.isCartSidebarOpen);
  const closeCartSidebar = useCartStore((state) => state.closeCartSidebar);
  const updateQuantity = useCartStore((state) => state.updateQuantity);
  const removeItem = useCartStore((state) => state.removeItem);
  const openCartSidebar = useCartStore((state) => state.openCartSidebar);

  const subtotal = items.reduce((sum, item) => sum + item.product.price * item.quantity, 0);
  const total = subtotal + (items.length > 0 ? SHIPPING_FEE : 0);
  const itemCount = items.reduce((sum, item) => sum + item.quantity, 0);

  const goTo = (href: string) => {
    closeCartSidebar();
    setLocation(href);
  };

  return (
    <Sheet
      open={isCartSidebarOpen}
      onOpenChange={(nextOpen) => {
        if (nextOpen === isCartSidebarOpen) return;
        if (nextOpen) {
          openCartSidebar();
        } else {
          closeCartSidebar();
        }
      }}
    >
      <SheetContent
        side="right"
        className="w-full border-l border-border/70 bg-background/98 p-0 sm:max-w-[430px]"
      >
        <SheetHeader className="border-b border-border/60 px-6 py-5">
          <SheetTitle className="text-[12px] font-black uppercase tracking-[0.26em]">
            Your Bag ({itemCount})
          </SheetTitle>
          <SheetDescription className="text-xs uppercase tracking-[0.16em]">
            Review your items before checkout.
          </SheetDescription>
        </SheetHeader>

        {items.length === 0 ? (
          <div className="flex h-[calc(100%-85px)] flex-col items-center justify-center gap-5 px-6 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-full border border-border/60 bg-muted/30">
              <ShoppingBag className="h-6 w-6 text-muted-foreground" />
            </div>
            <div className="space-y-1">
              <p className="text-sm font-bold uppercase tracking-[0.2em]">Your bag is empty</p>
              <p className="text-xs text-muted-foreground">Add products to see them here instantly.</p>
            </div>
            <Button
              type="button"
              onClick={() => goTo("/products")}
              className="h-11 rounded-none px-8 text-[10px] font-black uppercase tracking-[0.22em]"
            >
              Continue Shopping
            </Button>
          </div>
        ) : (
          <div className="flex h-[calc(100%-85px)] flex-col">
            <div className="sidebar-scrollbar flex-1 overflow-y-auto px-6 py-4">
              <div className="space-y-4">
                {items.map((item) => (
                  <div key={item.id} className="rounded-xl border border-border/60 bg-card/50 p-3">
                    <div className="flex gap-3">
                      <Link
                        href={`/product/${item.product.id}`}
                        onClick={() => closeCartSidebar()}
                        className="h-24 w-20 shrink-0 overflow-hidden rounded-lg border border-border/50 bg-muted/40"
                      >
                        <img
                          src={item.product.images[0] ?? ""}
                          alt={item.product.name}
                          className="h-full w-full object-cover"
                          loading="lazy"
                        />
                      </Link>

                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-3">
                          <p className="line-clamp-2 text-[11px] font-black uppercase tracking-[0.12em]">
                            {item.product.name}
                          </p>
                          <button
                            type="button"
                            onClick={() => removeItem(item.id)}
                            className="mt-0.5 shrink-0 text-muted-foreground transition-colors hover:text-foreground"
                            aria-label={`Remove ${item.product.name}`}
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>

                        <p className="mt-1 text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
                          {item.variant.color} / {item.variant.size}
                        </p>

                        <div className="mt-3 flex items-center justify-between">
                          <div className="flex items-center rounded-md border border-border/60">
                            <button
                              type="button"
                              onClick={() => updateQuantity(item.id, item.quantity - 1)}
                              className="flex h-8 w-8 items-center justify-center text-muted-foreground transition-colors hover:text-foreground"
                              disabled={item.quantity <= 1}
                            >
                              <Minus className="h-3.5 w-3.5" />
                            </button>
                            <span className="w-8 text-center text-xs font-semibold">{item.quantity}</span>
                            <button
                              type="button"
                              onClick={() => updateQuantity(item.id, item.quantity + 1)}
                              className="flex h-8 w-8 items-center justify-center text-muted-foreground transition-colors hover:text-foreground"
                            >
                              <Plus className="h-3.5 w-3.5" />
                            </button>
                          </div>

                          <p className="text-xs font-bold uppercase tracking-[0.12em]">
                            {formatPrice(item.product.price * item.quantity)}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="border-t border-border/60 bg-background px-6 py-5">
              <div className="space-y-2 text-[11px] uppercase tracking-[0.15em]">
                <div className="flex items-center justify-between text-muted-foreground">
                  <span>Subtotal</span>
                  <span className="font-bold text-foreground">{formatPrice(subtotal)}</span>
                </div>
                <div className="flex items-center justify-between text-muted-foreground">
                  <span>Shipping</span>
                  <span className="font-bold text-foreground">{formatPrice(items.length > 0 ? SHIPPING_FEE : 0)}</span>
                </div>
                <div className="mt-2 flex items-center justify-between border-t border-border/50 pt-3 text-foreground">
                  <span className="font-black">Total</span>
                  <span className="text-sm font-black">{formatPrice(total)}</span>
                </div>
              </div>

              <div className="mt-4 grid grid-cols-1 gap-2">
                <Button
                  type="button"
                  onClick={() => goTo("/checkout")}
                  className="h-11 rounded-none bg-black text-[10px] font-black uppercase tracking-[0.2em] text-white hover:bg-zinc-900 dark:bg-white dark:text-black dark:hover:bg-zinc-100"
                >
                  Buy Now
                </Button>
                <Button
                  type="button"
                  onClick={() => goTo("/checkout")}
                  variant="outline"
                  className="h-11 rounded-none text-[10px] font-black uppercase tracking-[0.2em]"
                >
                  Checkout
                </Button>
                <Button
                  type="button"
                  onClick={() => goTo("/cart")}
                  variant="ghost"
                  className="h-10 rounded-none text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground"
                >
                  View Full Cart
                </Button>
              </div>
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
