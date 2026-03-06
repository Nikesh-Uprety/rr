import { useState } from "react";
import { Link, useLocation } from "wouter";
import { useCartStore } from "@/store/cart";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { CheckCircle2, ChevronRight, Lock } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function Checkout() {
  const [, setLocation] = useLocation();
  const { items, subtotal, clearCart } = useCartStore();
  const { toast } = useToast();
  
  const [step, setStep] = useState<1 | 2 | 3>(1); // 1: Shipping, 2: Payment, 3: Success
  const [isProcessing, setIsProcessing] = useState(false);

  const tax = subtotal * 0.08;
  const shipping = subtotal > 150 ? 0 : 15;
  const total = subtotal + tax + shipping;

  if (items.length === 0 && step !== 3) {
    setLocation('/cart');
    return null;
  }

  const handlePlaceOrder = () => {
    setIsProcessing(true);
    // Simulate API call
    setTimeout(() => {
      setIsProcessing(false);
      clearCart();
      setStep(3);
      toast({
        title: "Order Placed Successfully",
        description: "Thank you for shopping with Urban Threads.",
      });
    }, 1500);
  };

  if (step === 3) {
    return (
      <div className="container mx-auto px-4 py-24 max-w-2xl text-center">
        <div className="w-20 h-20 bg-green-50 text-green-600 dark:bg-green-950/30 dark:text-green-500 rounded-full flex items-center justify-center mx-auto mb-8 animate-in zoom-in duration-500">
          <CheckCircle2 className="w-10 h-10" />
        </div>
        <h1 className="text-4xl font-serif font-medium mb-4 tracking-tight">Order Confirmed</h1>
        <p className="text-muted-foreground mb-8 text-lg">
          Thank you for your purchase. We've sent a confirmation email to your inbox with the order details.
        </p>
        <div className="bg-muted/30 border rounded-xl p-6 mb-10 text-left">
          <div className="flex justify-between mb-2">
            <span className="text-muted-foreground">Order Number</span>
            <span className="font-medium">#UX-2025-0892</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Date</span>
            <span className="font-medium">{new Date().toLocaleDateString()}</span>
          </div>
        </div>
        <Button asChild size="lg" className="rounded-full px-8">
          <Link href="/">Continue Shopping</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-12 max-w-6xl">
      <div className="flex items-center gap-2 text-sm mb-10 overflow-x-auto pb-2">
        <Link href="/cart"><a className="text-muted-foreground hover:text-foreground whitespace-nowrap">Cart</a></Link>
        <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
        <span className={`${step === 1 ? 'font-medium text-foreground' : 'text-muted-foreground'}`}>Information & Shipping</span>
        <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
        <span className={`${step === 2 ? 'font-medium text-foreground' : 'text-muted-foreground'}`}>Payment</span>
      </div>

      <div className="flex flex-col lg:flex-row gap-12 lg:gap-20">
        {/* Left Column - Forms */}
        <div className="flex-1 space-y-10">
          {step === 1 && (
            <div className="animate-in fade-in slide-in-from-right-4 duration-500">
              <h2 className="text-2xl font-serif font-medium mb-6">Contact Information</h2>
              <div className="space-y-4 mb-10">
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input id="email" type="email" placeholder="you@example.com" className="h-11" />
                </div>
              </div>

              <h2 className="text-2xl font-serif font-medium mb-6">Shipping Address</h2>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="firstName">First name</Label>
                    <Input id="firstName" className="h-11" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="lastName">Last name</Label>
                    <Input id="lastName" className="h-11" />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="address">Address</Label>
                  <Input id="address" className="h-11" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="apartment">Apartment, suite, etc. (optional)</Label>
                  <Input id="apartment" className="h-11" />
                </div>
                <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
                  <div className="space-y-2 lg:col-span-1">
                    <Label htmlFor="city">City</Label>
                    <Input id="city" className="h-11" />
                  </div>
                  <div className="space-y-2 lg:col-span-1">
                    <Label htmlFor="state">State</Label>
                    <Input id="state" className="h-11" />
                  </div>
                  <div className="space-y-2 lg:col-span-1">
                    <Label htmlFor="zip">ZIP Code</Label>
                    <Input id="zip" className="h-11" />
                  </div>
                </div>
              </div>

              <div className="mt-10">
                <Button size="lg" className="w-full sm:w-auto h-12 px-8 rounded-md" onClick={() => setStep(2)}>
                  Continue to Payment
                </Button>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="animate-in fade-in slide-in-from-right-4 duration-500">
              <div className="bg-muted/30 border rounded-xl p-4 mb-10 text-sm">
                <div className="flex justify-between py-2 border-b">
                  <span className="text-muted-foreground">Contact</span>
                  <span>test@example.com</span>
                  <button onClick={() => setStep(1)} className="text-primary text-xs underline">Change</button>
                </div>
                <div className="flex justify-between py-2">
                  <span className="text-muted-foreground">Ship to</span>
                  <span>123 Design St, NY 10001</span>
                  <button onClick={() => setStep(1)} className="text-primary text-xs underline">Change</button>
                </div>
              </div>

              <h2 className="text-2xl font-serif font-medium mb-6">Payment</h2>
              <p className="text-sm text-muted-foreground mb-6">All transactions are secure and encrypted.</p>
              
              <div className="border rounded-xl overflow-hidden">
                <RadioGroup defaultValue="card" className="gap-0">
                  <div className="p-4 border-b flex items-center bg-muted/10">
                    <RadioGroupItem value="card" id="card" className="mr-4" />
                    <Label htmlFor="card" className="font-medium cursor-pointer flex-1 flex justify-between items-center">
                      Credit Card
                      <div className="flex gap-1">
                        <div className="w-8 h-5 bg-muted rounded border flex items-center justify-center text-[8px] font-bold">VISA</div>
                        <div className="w-8 h-5 bg-muted rounded border flex items-center justify-center text-[8px] font-bold">MC</div>
                      </div>
                    </Label>
                  </div>
                  <div className="p-6 bg-background space-y-4 border-b">
                    <div className="space-y-2">
                      <Label htmlFor="cardNumber">Card number</Label>
                      <div className="relative">
                        <Input id="cardNumber" placeholder="0000 0000 0000 0000" className="h-11 pr-10" />
                        <Lock className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="exp">Expiration date (MM/YY)</Label>
                        <Input id="exp" placeholder="MM/YY" className="h-11" />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="cvc">Security code</Label>
                        <Input id="cvc" placeholder="CVC" className="h-11" />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="nameOnCard">Name on card</Label>
                      <Input id="nameOnCard" className="h-11" />
                    </div>
                  </div>
                  
                  <div className="p-4 flex items-center bg-muted/10">
                    <RadioGroupItem value="paypal" id="paypal" className="mr-4" />
                    <Label htmlFor="paypal" className="font-medium cursor-pointer flex-1">
                      PayPal
                    </Label>
                  </div>
                </RadioGroup>
              </div>

              <div className="mt-10 flex gap-4">
                <Button size="lg" className="flex-1 h-12 rounded-md" onClick={handlePlaceOrder} disabled={isProcessing}>
                  {isProcessing ? "Processing..." : `Pay $${total.toFixed(2)}`}
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* Right Column - Order Summary */}
        <div className="w-full lg:w-96 shrink-0 lg:border-l lg:pl-10">
          <div className="sticky top-24">
            <div className="space-y-4 mb-6">
              {items.map(item => (
                <div key={item.id} className="flex gap-4 items-center">
                  <div className="w-16 h-16 bg-muted rounded-md overflow-hidden relative shrink-0">
                    <img src={item.product.images[0]} alt={item.product.name} className="w-full h-full object-cover" />
                    <div className="absolute -top-2 -right-2 w-5 h-5 bg-primary/80 backdrop-blur-sm text-primary-foreground rounded-full text-xs flex items-center justify-center font-medium z-10">
                      {item.quantity}
                    </div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="text-sm font-medium truncate">{item.product.name}</h4>
                    <p className="text-xs text-muted-foreground">{item.variant.color} / {item.variant.size}</p>
                  </div>
                  <div className="text-sm font-medium shrink-0">
                    ${(item.product.price * item.quantity).toFixed(2)}
                  </div>
                </div>
              ))}
            </div>

            <div className="flex gap-2 mb-8 border-y py-4">
              <Input placeholder="Discount code" className="h-10" />
              <Button variant="secondary" className="h-10 shrink-0">Apply</Button>
            </div>

            <div className="space-y-3 text-sm mb-6">
              <div className="flex justify-between text-muted-foreground">
                <span>Subtotal</span>
                <span>${subtotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-muted-foreground">
                <span>Shipping</span>
                <span>{shipping === 0 ? "Free" : `$${shipping.toFixed(2)}`}</span>
              </div>
              <div className="flex justify-between text-muted-foreground">
                <span>Taxes</span>
                <span>${tax.toFixed(2)}</span>
              </div>
            </div>
            
            <div className="border-t pt-4 flex justify-between items-end">
              <span className="font-medium text-lg">Total</span>
              <span className="text-3xl font-serif font-medium">${total.toFixed(2)}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}