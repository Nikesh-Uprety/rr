import { Link, useLocation } from "wouter";
import { useCartStore } from "@/store/cart";
import { Button } from "@/components/ui/button";
import { Minus, Plus, Trash2, ArrowRight } from "lucide-react";
import { formatPrice } from "@/lib/format";

export default function Cart() {
  const [, setLocation] = useLocation();
  const { items, removeItem, updateQuantity } = useCartStore();

  const subtotal = items.reduce((sum, item) => sum + item.product.price * item.quantity, 0);
  const shipping = 100;
  const total = subtotal + shipping;

  if (items.length === 0) {
    return (
      <div className="container mx-auto px-4 py-40 text-center max-w-lg mt-20">
        <h1 className="text-4xl font-black uppercase tracking-tighter mb-4">Empty Bag</h1>
        <p className="text-muted-foreground uppercase text-[10px] tracking-widest mb-12">Your bag is currently empty.</p>
        <Button size="lg" asChild className="rounded-none px-12 h-14 bg-black text-white uppercase tracking-widest text-xs font-bold">
          <Link href="/products">Explore Shop</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-32 max-w-7xl mt-10">
      <h1 className="text-4xl font-black uppercase tracking-tighter mb-16">Your Bag</h1>

      <div className="flex flex-col lg:flex-row gap-20">
        <div className="flex-1">
          <div className="divide-y border-t border-b">
            {items.map((item) => (
              <div key={item.id} className="py-8 flex gap-8">
                <Link href={`/product/${item.product.id}`} className="w-24 h-32 bg-gray-50 shrink-0 block">
                  <img src={item.product.images[0]} alt={item.product.name} className="w-full h-full object-cover" />
                </Link>
                <div className="flex-1 flex flex-col">
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <h3 className="font-bold uppercase tracking-widest text-xs mb-1">{item.product.name}</h3>
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wider">{item.variant.size} / {item.variant.color}</p>
                    </div>
                    <span className="font-bold text-xs tracking-widest">
                      {formatPrice(item.product.price)}
                    </span>
                  </div>
                  
                  <div className="mt-auto flex justify-between items-end">
                    <div className="flex items-center border border-gray-200">
                      <button onClick={() => updateQuantity(item.id, item.quantity - 1)} className="w-8 h-8 flex items-center justify-center text-muted-foreground hover:text-black transition-colors" disabled={item.quantity <= 1}>-</button>
                      <span className="w-8 text-center text-xs font-bold">{item.quantity}</span>
                      <button onClick={() => updateQuantity(item.id, item.quantity + 1)} className="w-8 h-8 flex items-center justify-center text-muted-foreground hover:text-black transition-colors">+</button>
                    </div>
                    <button onClick={() => removeItem(item.id)} className="text-[10px] uppercase tracking-widest text-muted-foreground hover:text-red-500 transition-colors font-bold">Remove</button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="w-full lg:w-[400px]">
          <div className="bg-gray-50 p-10 border-none sticky top-32">
            <h2 className="text-lg font-black uppercase tracking-tighter mb-8">Summary</h2>
            
            <div className="space-y-4 text-[10px] uppercase tracking-widest font-medium mb-10 text-muted-foreground">
              <div className="flex justify-between">
                <span>Subtotal</span>
                <span className="text-black">{formatPrice(subtotal)}</span>
              </div>
              <div className="flex justify-between">
                <span>Shipping</span>
                <span className="text-black">{formatPrice(shipping)}</span>
              </div>
              <div className="flex justify-between text-black text-sm font-black pt-6 border-t">
                <span>Total</span>
                <span>{formatPrice(total)}</span>
              </div>
            </div>
            
            <Button size="lg" className="w-full h-16 rounded-none bg-black text-white uppercase tracking-[0.2em] text-xs font-bold" onClick={() => setLocation('/checkout')}>
              Checkout
            </Button>
            
            <Link href="/products" className="block text-center mt-6 text-[10px] uppercase tracking-widest font-bold hover:underline">
              Continue Shopping
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}