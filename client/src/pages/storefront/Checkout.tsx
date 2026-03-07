import { useMemo, useState } from "react";
import { Link, useLocation } from "wouter";
import { useCartStore } from "@/store/cart";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CheckCircle2, Wallet, Banknote, Building2, Smartphone } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useMutation } from "@tanstack/react-query";
import { createOrder } from "@/lib/api";
import { formatPrice } from "@/lib/format";

const PAYMENT_OPTIONS = [
  { id: "e_wallet", label: "E-Wallet", icon: Wallet, logoColor: "bg-indigo-600" },
  { id: "esewa", label: "eSewa", icon: Smartphone, logoColor: "bg-[#54B848]" },
  { id: "khalti", label: "Khalti", icon: Smartphone, logoColor: "bg-[#5C2D91]" },
  { id: "bank", label: "Bank Transfer", icon: Building2, logoColor: "bg-slate-700" },
  { id: "cash_on_delivery", label: "Cash on Delivery", icon: Banknote, logoColor: "bg-amber-600" },
] as const;

export type PaymentMethodId = (typeof PAYMENT_OPTIONS)[number]["id"];

export default function Checkout() {
  const [, setLocation] = useLocation();
  const { items, clearCart } = useCartStore();
  const { toast } = useToast();

  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [formError, setFormError] = useState<string | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethodId>("cash_on_delivery");

  const shipping = 100;
  const subtotal = useMemo(
    () =>
      items.reduce(
        (sum, item) => sum + item.product.price * item.quantity,
        0,
      ),
    [items],
  );
  const total = subtotal + shipping;

  if (items.length === 0 && step !== 3) {
    setLocation("/cart");
    return null;
  }

  const { mutateAsync, isPending } = useMutation({
    mutationFn: createOrder,
  });

  const handlePlaceOrder = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFormError(null);

    const formData = new FormData(event.currentTarget);

    const firstName = String(formData.get("firstName") || "").trim();
    const lastName = String(formData.get("lastName") || "").trim();
    const email = String(formData.get("email") || "").trim();
    const address = String(formData.get("address") || "").trim();
    const city = String(formData.get("city") || "").trim();
    const state = String(formData.get("state") || "").trim();
    const zip = "00000"; // Nepal – not collected
    const phone = String(formData.get("phone") || "").trim();

    if (!firstName || !lastName || !email || !address || !city || !state) {
      setFormError("Please fill in all required fields.");
      return;
    }

    try {
      const result = await mutateAsync({
        items: items.map((item) => ({
          productId: item.product.id,
          quantity: item.quantity,
          priceAtTime: item.product.price,
        })),
        shipping: {
          firstName,
          lastName,
          email,
          phone,
          address,
          city,
          state,
          zip,
          country: "NP",
        },
        paymentMethod,
      });

      if (!result.success || !result.data) {
        setFormError(result.error || "Failed to place order.");
        return;
      }

      const needsPaymentPage =
        paymentMethod === "esewa" ||
        paymentMethod === "khalti" ||
        paymentMethod === "bank";

      if (needsPaymentPage) {
        clearCart();
        setLocation(
          `/checkout/payment?orderId=${result.data.order.id}&method=${paymentMethod}`,
        );
        return;
      }

      clearCart();
      setStep(3);
      toast({ title: "Order Placed" });
      setLocation(`/checkout/success?orderId=${result.data.order.id}`);
    } catch (err) {
      setFormError((err as Error).message || "Failed to place order.");
    }
  };

  if (step === 3) {
    return (
      <div className="container mx-auto px-4 py-32 text-center mt-20">
        <CheckCircle2 className="w-16 h-16 text-black mx-auto mb-8" />
        <h1 className="text-4xl font-black uppercase tracking-tighter mb-4">
          Confirmed
        </h1>
        <p className="text-muted-foreground mb-12">
          Your order is being processed.
        </p>
        <Button
          asChild
          className="rounded-none px-12 h-14 uppercase tracking-widest text-xs font-bold bg-black text-white"
        >
          <Link href="/">Back Home</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-32 max-w-7xl mt-10">
      <div className="flex flex-col lg:flex-row gap-20">
        <form
          className="flex-1 space-y-12"
          onSubmit={handlePlaceOrder}
        >
          <div>
            <h2 className="text-xl font-black uppercase tracking-tighter mb-8">Contact</h2>
            <div className="space-y-4">
              <Input
                name="email"
                type="email"
                placeholder="Email Address"
                className="h-14 rounded-none border-gray-200"
                required
              />
            </div>
          </div>

          <div>
            <h2 className="text-xl font-black uppercase tracking-tighter mb-8">Shipping Address</h2>
            <div className="grid grid-cols-2 gap-4 mb-4">
              <Input
                name="firstName"
                placeholder="First name"
                className="h-14 rounded-none border-gray-200"
                required
              />
              <Input
                name="lastName"
                placeholder="Last name"
                className="h-14 rounded-none border-gray-200"
                required
              />
            </div>
            <div className="space-y-4">
              <Input
                name="address"
                placeholder="Address"
                className="h-14 rounded-none border-gray-200"
                required
              />
              <div className="grid grid-cols-2 gap-4">
                <Input
                  name="city"
                  placeholder="City"
                  className="h-14 rounded-none border-gray-200"
                  required
                />
                <Input
                  name="state"
                  placeholder="State"
                  className="h-14 rounded-none border-gray-200"
                  required
                />
              </div>
              <Input
                name="phone"
                placeholder="Phone"
                className="h-14 rounded-none border-gray-200"
              />
            </div>
          </div>

          <div>
            <h2 className="text-xl font-black uppercase tracking-tighter mb-6">
              Payment Option
            </h2>
            <div className="space-y-3">
              {PAYMENT_OPTIONS.map((opt) => {
                const Icon = opt.icon;
                const isSelected = paymentMethod === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setPaymentMethod(opt.id)}
                    className={`w-full flex items-center gap-4 p-4 rounded-none border-2 text-left transition-colors ${
                      isSelected
                        ? "border-black bg-black/5"
                        : "border-gray-200 hover:border-gray-300"
                    }`}
                  >
                    <span
                      className={`w-12 h-12 rounded-none flex items-center justify-center text-white shrink-0 ${opt.logoColor}`}
                    >
                      <Icon className="w-6 h-6" />
                    </span>
                    <span className="font-semibold uppercase tracking-wide text-sm">
                      {opt.label}
                    </span>
                    {isSelected && (
                      <CheckCircle2 className="w-5 h-5 text-black ml-auto shrink-0" />
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {formError && (
            <p className="text-sm text-red-500">{formError}</p>
          )}

          <Button
            type="submit"
            className="w-full h-16 bg-black text-white rounded-none uppercase tracking-[0.2em] text-xs font-bold"
            disabled={isPending}
          >
            {isPending ? "Processing..." : "Pay Now"}
          </Button>
        </form>

        <div className="w-full lg:w-[450px] bg-gray-50/50 p-10 h-fit">
          <div className="space-y-6 mb-10">
            {items.map(item => (
              <div key={item.id} className="flex gap-4">
                <div className="w-16 h-20 bg-muted shrink-0 relative">
                  <img src={item.product.images[0]} className="w-full h-full object-cover" />
                  <span className="absolute -top-2 -right-2 w-5 h-5 bg-black text-white text-[10px] flex items-center justify-center rounded-full">1</span>
                </div>
                <div className="flex-1">
                  <h4 className="text-[10px] font-bold uppercase tracking-widest">{item.product.name}</h4>
                  <p className="text-[10px] text-muted-foreground uppercase">{item.variant.size}</p>
                </div>
                <div className="text-[10px] font-bold uppercase tracking-widest">
                  {formatPrice(item.product.price)}
                </div>
              </div>
            ))}
          </div>

          <div className="flex gap-2 mb-10">
            <Input placeholder="Gift card or discount code" className="h-12 rounded-none bg-white border-gray-200" />
            <Button variant="secondary" className="h-12 rounded-none px-6 text-xs uppercase tracking-widest font-bold">Apply</Button>
          </div>

          <div className="space-y-4 text-[10px] uppercase tracking-widest font-medium text-muted-foreground pt-8 border-t border-gray-100">
            <div className="flex justify-between">
              <span>Subtotal</span>
                <span className="text-black">{formatPrice(subtotal)}</span>
            </div>
            <div className="flex justify-between">
              <span>Shipping</span>
                <span className="text-black">{formatPrice(shipping)}</span>
            </div>
            <div className="flex justify-between text-black text-sm font-black pt-4">
              <span>Total</span>
                <span>{formatPrice(subtotal + shipping)}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}