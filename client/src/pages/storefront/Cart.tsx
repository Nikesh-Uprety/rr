import { Link, useLocation } from "wouter";
import { useCartStore } from "@/store/cart";
import { Button } from "@/components/ui/button";
import { Minus, Plus, Trash2, ArrowRight } from "lucide-react";

export default function Cart() {
  const [, setLocation] = useLocation();
  const { items, removeItem, updateQuantity, subtotal } = useCartStore();
  
  const tax = subtotal * 0.08; // 8% mock tax
  const total = subtotal + tax;

  if (items.length === 0) {
    return (
      <div className="container mx-auto px-4 py-24 text-center max-w-lg">
        <h1 className="text-4xl font-serif font-medium tracking-tight mb-4">Your Cart</h1>
        <p className="text-muted-foreground mb-8">Your cart is currently empty. Discover our new arrivals to start building your wardrobe.</p>
        <Button size="lg" asChild className="rounded-full px-8">
          <Link href="/products">Shop Collection</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-12 max-w-6xl">
      <h1 className="text-4xl font-serif font-medium tracking-tight mb-10">Your Cart</h1>

      <div className="flex flex-col lg:flex-row gap-12">
        {/* Cart Items */}
        <div className="flex-1 space-y-8">
          <div className="hidden md:grid grid-cols-12 gap-4 pb-4 border-b text-sm font-medium text-muted-foreground uppercase tracking-wider">
            <div className="col-span-6">Product</div>
            <div className="col-span-2 text-center">Quantity</div>
            <div className="col-span-2 text-right">Price</div>
            <div className="col-span-2 text-right">Total</div>
          </div>

          <div className="divide-y">
            {items.map((item) => (
              <div key={item.id} className="py-6 flex flex-col md:grid md:grid-cols-12 gap-4 items-start md:items-center">
                <div className="col-span-6 flex gap-4 w-full">
                  <Link href={`/product/${item.product.id}`} className="w-24 h-32 bg-muted rounded-md overflow-hidden shrink-0 block">
                    <img 
                      src={item.product.images[0]} 
                      alt={item.product.name}
                      className="w-full h-full object-cover hover:scale-105 transition-transform duration-500"
                    />
                  </Link>
                  <div className="flex flex-col justify-center">
                    <Link href={`/product/${item.product.id}`} className="font-medium hover:text-primary transition-colors text-lg mb-1">
                      {item.product.name}
                    </Link>
                    <p className="text-sm text-muted-foreground mb-2">
                      {item.variant.color} / {item.variant.size}
                    </p>
                    <button 
                      onClick={() => removeItem(item.id)}
                      className="text-xs text-muted-foreground hover:text-destructive transition-colors flex items-center gap-1 w-fit mt-auto"
                    >
                      <Trash2 className="w-3 h-3" /> Remove
                    </button>
                  </div>
                </div>

                <div className="col-span-2 flex justify-center w-full md:w-auto mt-4 md:mt-0">
                  <div className="flex items-center border border-border rounded-md">
                    <button 
                      onClick={() => updateQuantity(item.id, item.quantity - 1)}
                      className="w-8 h-8 flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
                      disabled={item.quantity <= 1}
                    >
                      <Minus className="w-3 h-3" />
                    </button>
                    <span className="w-8 text-center text-sm font-medium">{item.quantity}</span>
                    <button 
                      onClick={() => updateQuantity(item.id, item.quantity + 1)}
                      className="w-8 h-8 flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
                    >
                      <Plus className="w-3 h-3" />
                    </button>
                  </div>
                </div>

                <div className="col-span-2 text-right hidden md:block text-muted-foreground">
                  ${item.product.price.toFixed(2)}
                </div>

                <div className="col-span-2 text-right font-medium hidden md:block">
                  ${(item.product.price * item.quantity).toFixed(2)}
                </div>
                
                {/* Mobile price display */}
                <div className="flex justify-between w-full md:hidden mt-2 font-medium">
                  <span>${item.product.price.toFixed(2)} each</span>
                  <span>Total: ${(item.product.price * item.quantity).toFixed(2)}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Order Summary */}
        <div className="w-full lg:w-96 shrink-0">
          <div className="bg-muted/30 border rounded-xl p-8 sticky top-24">
            <h2 className="text-xl font-serif font-medium mb-6">Order Summary</h2>
            
            <div className="space-y-4 text-sm mb-6">
              <div className="flex justify-between text-muted-foreground">
                <span>Subtotal ({items.length} items)</span>
                <span>${subtotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-muted-foreground">
                <span>Shipping</span>
                <span>Calculated at checkout</span>
              </div>
              <div className="flex justify-between text-muted-foreground">
                <span>Estimated Tax</span>
                <span>${tax.toFixed(2)}</span>
              </div>
            </div>
            
            <div className="border-t pt-4 mb-8 flex justify-between items-center">
              <span className="font-medium">Total</span>
              <span className="text-2xl font-serif font-medium">${total.toFixed(2)}</span>
            </div>
            
            <Button 
              size="lg" 
              className="w-full h-12 text-base rounded-full"
              onClick={() => setLocation('/checkout')}
            >
              Proceed to Checkout <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
            
            <p className="text-xs text-muted-foreground text-center mt-6 flex items-center justify-center gap-1">
              Secure checkout guaranteed
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}