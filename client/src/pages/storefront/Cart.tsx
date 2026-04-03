import { Link, useLocation } from "wouter";
import { type CartState, useCartStore } from "@/store/cart";
import { Button } from "@/components/ui/button";
import { Minus, Plus, Trash2, RotateCcw, ShoppingBag, History, BadgePercent, Sparkles } from "lucide-react";
import { formatPrice } from "@/lib/format";
import { useQuery } from "@tanstack/react-query";
import { fetchOrderById } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { motion } from "framer-motion";
import { useMemo } from "react";

function getCartOriginalPrice(price: number, originalPrice?: number | null, salePercentage?: number | null, saleActive?: boolean | null) {
  const currentPrice = Number(price);
  const explicitOriginalPrice = Number(originalPrice);

  if (Number.isFinite(explicitOriginalPrice) && explicitOriginalPrice > currentPrice) {
    return explicitOriginalPrice;
  }

  const resolvedSalePercentage = Number(salePercentage);
  if (
    Boolean(saleActive) &&
    Number.isFinite(resolvedSalePercentage) &&
    resolvedSalePercentage > 0 &&
    resolvedSalePercentage < 100 &&
    currentPrice > 0
  ) {
    return currentPrice / (1 - resolvedSalePercentage / 100);
  }

  return currentPrice;
}

export default function Cart() {
  const [, setLocation] = useLocation();
  const { items, removeItem, updateQuantity, addItem, hasHydrated = true } = useCartStore(
    (state: CartState) => state,
  );
  const { toast } = useToast();

  const lastOrderId = typeof window !== 'undefined' ? localStorage.getItem("ra_last_order_id") : null;

  const { data: lastOrder, isLoading: isLoadingRecent } = useQuery({
    queryKey: ["recent-order", lastOrderId],
    queryFn: () => fetchOrderById(lastOrderId!),
    enabled: !!lastOrderId,
  });

  const handleReorder = (order: any) => {
    order.items.forEach((item: any) => {
      if (item.product) {
        // Convert server-side product to the client-side Product format expected by addItem
        const clientProduct = {
          id: item.product.id || item.productId,
          name: item.product.name,
          sku: item.productId,
          price: parseFloat(item.product.price || item.unitPrice),
          originalPrice:
            item.product.originalPrice !== null && item.product.originalPrice !== undefined
              ? Number(item.product.originalPrice)
              : null,
          salePercentage:
            item.product.salePercentage !== null && item.product.salePercentage !== undefined
              ? Number(item.product.salePercentage)
              : null,
          saleActive: Boolean(item.product.saleActive),
          stock: item.product.stock || 99,
          category: item.product.category || "",
          images: item.product.imageUrl ? [item.product.imageUrl] : [],
          variants: [{ size: "M", color: "Original" }],
        };
        addItem(clientProduct, { size: "M", color: "Original" }, item.quantity);
      }
    });
    toast({
      title: "Items Added to Bag",
      description: "Your previous order items have been re-added.",
    });
  };

  const subtotal = useMemo(
    () => items.reduce((sum, item) => sum + item.product.price * item.quantity, 0),
    [items],
  );
  const productDiscountTotal = useMemo(
    () =>
      items.reduce((sum, item) => {
        const originalPrice = getCartOriginalPrice(
          item.product.price,
          item.product.originalPrice,
          item.product.salePercentage,
          item.product.saleActive,
        );
        if (!Number.isFinite(originalPrice) || originalPrice <= item.product.price) {
          return sum;
        }
        return sum + (originalPrice - item.product.price) * item.quantity;
      }, 0),
    [items],
  );
  const shipping = 100;
  const total = subtotal + shipping;

  const RecentOrderSection = () => {
    if (!lastOrder) return null;

    return (
      <div className="mt-20 pt-16 border-t border-gray-100 dark:border-white/5 animate-in fade-in slide-in-from-bottom-4 duration-1000">
        <div className="flex items-center justify-between mb-10">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-full bg-zinc-50 dark:bg-zinc-900 border border-gray-100 dark:border-white/5 flex items-center justify-center">
              <History size={18} className="text-zinc-400" />
            </div>
            <div>
              <h2 className="text-lg font-black uppercase tracking-tighter">Recent Order</h2>
              <p className="text-[9px] text-zinc-400 uppercase tracking-widest font-bold mt-0.5">
                #{lastOrder.id.slice(0, 8)} · {new Date(lastOrder.createdAt).toLocaleDateString()}
              </p>
            </div>
          </div>
          <Button 
            onClick={() => handleReorder(lastOrder)}
            variant="outline" 
            className="rounded-full px-6 h-10 gap-2 uppercase tracking-widest text-[9px] font-black border-zinc-200 dark:border-white/10 hover:bg-black hover:text-white dark:hover:bg-white dark:hover:text-black transition-all"
          >
            <RotateCcw size={12} />
            Order Again
          </Button>
        </div>

        <div className="divide-y border-t border-b border-gray-100 dark:border-white/5">
          {lastOrder.items.map((item: any) => (
            <div key={item.id} className="py-6 flex gap-6 opacity-70 hover:opacity-100 transition-opacity">
              <div className="w-24 h-30 bg-zinc-50 dark:bg-zinc-800 shrink-0 border border-gray-100 dark:border-white/10 p-1 rounded-sm overflow-hidden">
                {item.product?.imageUrl ? (
                  <img 
                    src={item.product.imageUrl} 
                    alt={item.product?.name || "Product"} 
                    className="w-full h-full object-cover rounded-sm" 
                  />
                ) : (
                  <div className="w-full h-full bg-zinc-100 dark:bg-zinc-700 rounded-sm flex items-center justify-center">
                    <ShoppingBag size={20} className="text-zinc-300 dark:text-zinc-500" />
                  </div>
                )}
              </div>
              <div className="flex-1 flex flex-col justify-center">
                <div className="flex justify-between items-start mb-1">
                  <div>
                    <h3 className="font-black uppercase tracking-widest text-[11px] mb-1 line-clamp-1">
                      {item.product?.name || "Product"}
                    </h3>
                    <p className="text-[9px] text-zinc-400 uppercase tracking-widest font-bold">
                      SKU: {item.productId.slice(0, 8)}
                    </p>
                  </div>
                  <span className="font-black text-[11px] tracking-widest shrink-0 ml-4">
                    {formatPrice(item.unitPrice)}
                  </span>
                </div>
                <div className="mt-auto pt-2">
                  <span className="text-[9px] text-zinc-400 uppercase tracking-widest font-bold">
                    Qty: {item.quantity}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="flex justify-between items-center mt-6 pt-6 border-t border-zinc-100 dark:border-white/5">
          <span className="text-[10px] text-zinc-400 uppercase tracking-widest font-black">Order Total</span>
          <span className="text-lg font-black">{formatPrice(lastOrder.total)}</span>
        </div>
      </div>
    );
  };

  if (!hasHydrated) {
    return (
      <div className="container mx-auto mt-10 max-w-7xl px-4 py-32">
        <div className="flex items-center justify-center py-20">
          <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-zinc-400">Loading bag</p>
        </div>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="container mx-auto px-4 py-32 max-w-7xl mt-10">
        <div className="max-w-lg mx-auto text-center py-20">
          <motion.div 
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
          >
            <h1 className="text-4xl font-black uppercase tracking-tighter mb-4 italic">Empty Bag</h1>
            <p className="text-zinc-500 uppercase text-[10px] tracking-widest font-bold mb-12">Your selection is currently empty.</p>
            <Button size="lg" asChild className="rounded-none px-12 h-14 bg-black text-white hover:bg-zinc-800 transition-colors uppercase tracking-[0.3em] text-[10px] font-black shadow-2xl">
              <Link href="/products">Continue Exploring</Link>
            </Button>
          </motion.div>
        </div>
        <RecentOrderSection />
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-32 max-w-7xl mt-10">
      <h1 className="text-4xl font-black uppercase tracking-tighter mb-16 italic underline decoration-zinc-100 dark:decoration-white/5 underline-offset-[20px]">Your Bag</h1>

      <div className="flex flex-col lg:flex-row gap-20">
        <div className="flex-1">
          {/* Glassmorphism Items Container */}
          <div className="rounded-3xl p-6 lg:p-8 backdrop-blur-xl bg-black/[0.03] dark:bg-white/[0.05] border border-black/[0.06] dark:border-white/[0.08] shadow-[0_8px_32px_rgba(0,0,0,0.04)] dark:shadow-[0_8px_32px_rgba(0,0,0,0.3)]">
            <div className="divide-y divide-black/[0.04] dark:divide-white/[0.06]">
              {items.map((item) => (
                <div key={item.id} className="py-7 flex gap-6 group transition-all duration-300 hover:bg-white/40 dark:hover:bg-white/[0.03] -mx-6 lg:-mx-8 px-6 lg:px-8 first:rounded-t-2xl last:rounded-b-2xl">
                  <Link href={`/product/${item.product.id}`} className="w-24 h-32 lg:w-28 lg:h-36 bg-white dark:bg-white/[0.04] shrink-0 block border border-black/[0.04] dark:border-white/[0.06] p-1 rounded-xl overflow-hidden flex-shrink-0 transition-all duration-300 group-hover:scale-[1.03] group-hover:shadow-lg">
                    <img src={item.product.images[0]} alt={item.product.name} className="w-full h-full object-cover rounded-lg" />
                  </Link>
                  <div className="flex-1 flex flex-col">
                    {(() => {
                      const originalPrice = getCartOriginalPrice(
                        item.product.price,
                        item.product.originalPrice,
                        item.product.salePercentage,
                        item.product.saleActive,
                      );
                      const hasDiscount = Number.isFinite(originalPrice) && originalPrice > item.product.price;
                      const resolvedSalePercentage = hasDiscount
                        ? Math.round(((originalPrice - item.product.price) / originalPrice) * 100)
                        : 0;

                      return (
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <h3 className="font-black uppercase tracking-widest text-[11px] mb-1.5 line-clamp-1 text-zinc-900 dark:text-zinc-100">{item.product.name}</h3>
                        <p className="text-[10px] text-zinc-500 dark:text-zinc-400 uppercase tracking-widest font-bold">{item.variant.size} / {item.variant.color}</p>
                        {hasDiscount && (
                          <>
                            <div className="mt-2 inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2.5 py-1 text-[9px] font-black uppercase tracking-[0.18em] text-emerald-700 dark:text-emerald-300">
                              <BadgePercent size={10} />
                              {resolvedSalePercentage}
                              % Off Applied
                            </div>
                            <p className="mt-2 text-[9px] font-black uppercase tracking-[0.16em] text-emerald-600 dark:text-emerald-300">
                              You save{" "}
                              {formatPrice(
                                (originalPrice - item.product.price) * item.quantity,
                              )}
                            </p>
                          </>
                        )}
                      </div>
                      <div className="text-right">
                        <span className="block font-black text-[11px] tracking-widest text-zinc-900 dark:text-zinc-100">
                          {formatPrice(item.product.price)}
                        </span>
                        {hasDiscount && (
                          <span className="mt-1 block text-[9px] font-bold uppercase tracking-[0.18em] text-zinc-400 line-through">
                            {formatPrice(originalPrice)}
                          </span>
                        )}
                      </div>
                    </div>
                      );
                    })()}
                    
                    <div className="mt-auto flex justify-between items-end">
                      <div className="flex items-center rounded-lg border border-black/[0.06] dark:border-white/[0.08] bg-white/50 dark:bg-white/[0.04] backdrop-blur-sm">
                        <button data-testid={`cart-decrement-${item.id}`} onClick={() => updateQuantity(item.id, item.quantity - 1)} className="w-9 h-9 flex items-center justify-center text-zinc-400 hover:text-black dark:hover:text-white transition-colors" disabled={item.quantity <= 1}>
                          <Minus size={12} />
                        </button>
                        <span className="w-8 text-center text-[11px] font-black text-zinc-900 dark:text-zinc-100">{item.quantity}</span>
                        <button data-testid={`cart-increment-${item.id}`} onClick={() => updateQuantity(item.id, item.quantity + 1)} className="w-9 h-9 flex items-center justify-center text-zinc-400 hover:text-black dark:hover:text-white transition-colors">
                          <Plus size={12} />
                        </button>
                      </div>
                      <button 
                        data-testid={`cart-remove-${item.id}`}
                        onClick={() => removeItem(item.id)} 
                        className="text-[9px] uppercase tracking-widest text-white bg-red-500 md:bg-transparent md:text-red-500 md:hover:bg-red-500 md:hover:text-white transition-all font-black border border-red-500 md:border-red-500/20 px-4 py-2 rounded-full backdrop-blur-sm"
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="w-full lg:w-[400px]">
          {/* Glassmorphism Summary Card */}
          <div className="backdrop-blur-xl bg-black/[0.03] dark:bg-white/[0.05] p-10 lg:p-12 border border-black/[0.06] dark:border-white/[0.08] rounded-3xl sticky top-32 shadow-[0_8px_32px_rgba(0,0,0,0.04)] dark:shadow-[0_8px_32px_rgba(0,0,0,0.3)]">
            <h2 className="text-xl font-black uppercase tracking-tighter mb-10 italic text-zinc-900 dark:text-zinc-100">Checkout Summary</h2>
            
            <div className="space-y-5 text-[10px] uppercase tracking-widest font-black mb-12">
              {productDiscountTotal > 0 && (
                <div className="flex items-start gap-3 rounded-2xl border border-emerald-500/20 bg-gradient-to-r from-emerald-500/12 via-lime-400/10 to-amber-300/10 px-4 py-4 text-emerald-700 dark:text-emerald-300">
                  <div className="mt-0.5 rounded-full bg-emerald-500/15 p-2">
                    <Sparkles size={14} />
                  </div>
                  <div className="flex-1">
                    <p className="text-[9px] uppercase tracking-[0.22em] font-black">Discount Applied</p>
                    <p className="mt-1 text-[11px] normal-case tracking-normal font-semibold">
                      Your bag already includes product savings.
                    </p>
                  </div>
                  <span className="text-[12px] font-black">-{formatPrice(productDiscountTotal)}</span>
                </div>
              )}
              <div className="flex justify-between items-center text-zinc-500 dark:text-zinc-400">
                <span>Items Subtotal</span>
                <span className="text-[12px] text-zinc-900 dark:text-zinc-100">{formatPrice(subtotal)}</span>
              </div>
              {productDiscountTotal > 0 && (
                <div className="flex justify-between items-center text-emerald-600 dark:text-emerald-300">
                  <span className="inline-flex items-center gap-2">
                    <BadgePercent size={12} />
                    Product Savings
                  </span>
                  <span className="text-[12px] font-black">-{formatPrice(productDiscountTotal)}</span>
                </div>
              )}
              <div className="flex justify-between items-center text-zinc-500 dark:text-zinc-400">
                <span>Shipping & Handling</span>
                <span className="text-[12px] text-zinc-900 dark:text-zinc-100">{formatPrice(shipping)}</span>
              </div>
              <div className="flex justify-between items-center text-zinc-900 dark:text-white text-lg font-black pt-8 border-t border-black/[0.06] dark:border-white/[0.08] mt-4">
                <span className="text-zinc-500 dark:text-zinc-400">Grand Total</span>
                <span>{formatPrice(total)}</span>
              </div>
            </div>
            
            <Button data-testid="cart-proceed-checkout" size="lg" className="w-full h-16 rounded-none bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 hover:bg-zinc-800 dark:hover:bg-zinc-100 transition-colors uppercase tracking-[0.3em] text-[10px] font-black shadow-xl" onClick={() => setLocation('/checkout')}>
              Proceed to Checkout
            </Button>
            
            <Link href="/products" className="block text-center mt-8 text-[10px] uppercase tracking-[0.2em] font-black text-zinc-400 hover:text-zinc-900 dark:hover:text-white transition-colors">
              Continue Shopping
            </Link>
          </div>
        </div>
      </div>
      
      <RecentOrderSection />
    </div>
  );
}
