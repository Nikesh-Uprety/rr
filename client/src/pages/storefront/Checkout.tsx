import { useMemo, useState, useRef } from "react";
import { Link, useLocation } from "wouter";
import { useCartStore } from "@/store/cart";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Trash2, AlertCircle, CheckCircle2, ShoppingBag, Wallet, Banknote, Building2, Smartphone } from "lucide-react";
import { LocationPicker } from "@/components/LocationPicker";
import { useToast } from "@/hooks/use-toast";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createOrder, validatePromoCode } from "@/lib/api";
import { formatPrice } from "@/lib/format";

const PAYMENT_OPTIONS = [
  { id: "esewa", label: "eSewa", logoUrl: "/images/esewa.webp" },
  { id: "khalti", label: "Khalti", logoUrl: "/images/khalti.webp", logoColor: "bg-white" },
  { id: "fonepay", label: "Fonepay", icon: Smartphone, logoColor: "bg-slate-700" },
  { id: "card", label: "Card", icon: Wallet, logoColor: "bg-slate-700" },
  { id: "bank_transfer", label: "Bank Transfer", icon: Building2, logoColor: "bg-slate-700" },
] as const;

export type PaymentMethodId = (typeof PAYMENT_OPTIONS)[number]["id"] | "cash_on_delivery";

export default function Checkout() {
  const [, setLocation] = useLocation();
  const { items, clearCart } = useCartStore();
  const { toast } = useToast();

  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [formError, setFormError] = useState<string | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethodId>("cash_on_delivery");
  const [locationCoordinates, setLocationCoordinates] = useState<string | null>(null);
  const [deliveryRequired, setDeliveryRequired] = useState(true);
  const [deliveryProvider, setDeliveryProvider] = useState<string>("pathao");
  const [deliveryAddress, setDeliveryAddress] = useState<string>("");

  const shipping = 100;
  // Promo code state
  const [promoCodeInput, setPromoCodeInput] = useState("");
  const [appliedPromo, setAppliedPromo] = useState<{ id: string; code: string; discountPct: number } | null>(null);
  const [isValidatingPromo, setIsValidatingPromo] = useState(false);

  const subtotal = useMemo(
    () =>
      items.reduce(
        (sum, item) => sum + item.product.price * item.quantity,
        0,
      ),
    [items],
  );

  const discountAmount = useMemo(() => {
    if (!appliedPromo) return 0;
    return (subtotal * appliedPromo.discountPct) / 100;
  }, [subtotal, appliedPromo]);

  const total = subtotal + shipping - discountAmount;

  const handleApplyPromo = async () => {
    if (!promoCodeInput) return;
    setIsValidatingPromo(true);
    try {
      const result = await validatePromoCode(promoCodeInput.toUpperCase());
      if (result.success && result.data) {
        setAppliedPromo(result.data);
        toast({ title: "Promo code applied!", description: `${result.data.discountPct}% discount added.` });
      } else {
        toast({ title: "Invalid promo code", description: result.error || "Please check the code and try again.", variant: "destructive" });
      }
    } catch (err) {
      toast({ title: "Error", description: "Failed to validate promo code.", variant: "destructive" });
    } finally {
      setIsValidatingPromo(false);
    }
  };

  if (items.length === 0 && step !== 3) {
    setLocation("/cart");
    return null;
  }

  const { mutateAsync, isPending } = useMutation({
    mutationFn: createOrder,
  });

  const [manualLocation, setManualLocation] = useState("");
  const [showManualLocation, setShowManualLocation] = useState(true);
  const [errors, setErrors] = useState<Record<string, boolean>>({});
  
  const fieldRefs = {
    email: useRef<HTMLInputElement>(null),
    firstName: useRef<HTMLInputElement>(null),
    lastName: useRef<HTMLInputElement>(null),
    address: useRef<HTMLInputElement>(null),
    city: useRef<HTMLInputElement>(null),
    phone: useRef<HTMLInputElement>(null),
    location: useRef<HTMLDivElement>(null),
  };

  const clearError = (field: string) => {
    if (errors[field]) {
      setErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[field];
        return newErrors;
      });
    }
  };

  const handlePlaceOrder = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFormError(null);
    const newErrors: Record<string, boolean> = {};

    const formData = new FormData(event.currentTarget);

    const email = String(formData.get("email") || "").trim();
    const firstName = String(formData.get("firstName") || "").trim();
    const lastName = String(formData.get("lastName") || "").trim();
    const address = String(formData.get("address") || "").trim();
    const city = String(formData.get("city") || "").trim();
    const phone = String(formData.get("phone") || "").trim();

    if (!email) newErrors.email = true;
    if (!firstName) newErrors.firstName = true;
    if (!lastName) newErrors.lastName = true;
    if (!address) newErrors.address = true;
    if (!city) newErrors.city = true;
    if (!phone) newErrors.phone = true;
    
    const finalLocation = locationCoordinates || manualLocation;
    if (!finalLocation) newErrors.location = true;

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      setFormError("Please fill in all required fields.");
      
      // Scroll to first error
      const firstField = Object.keys(newErrors)[0] as keyof typeof fieldRefs;
      fieldRefs[firstField].current?.scrollIntoView({ behavior: "smooth", block: "center" });
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
          zip: "00000",
          country: "Nepal",
          locationCoordinates: finalLocation,
        },
        paymentMethod,
        source: "website",
        deliveryRequired,
        deliveryProvider: deliveryRequired ? deliveryProvider : null,
        deliveryAddress: deliveryRequired ? (deliveryAddress || manualLocation || null) : null,
        promoCodeId: appliedPromo?.id,
      });

      if (!result.success || !result.data) {
        setFormError(result.error || "Failed to place order.");
        return;
      }

      const needsPaymentPage =
        paymentMethod === "esewa" ||
        paymentMethod === "khalti" ||
        paymentMethod === "bank_transfer" ||
        paymentMethod === "fonepay" ||
        paymentMethod === "card";

      if (needsPaymentPage) {
        clearCart();
        localStorage.setItem("ra_last_order_id", result.data.order.id);
        setLocation(
          `/checkout/payment?orderId=${result.data.order.id}&method=${paymentMethod}`,
        );
        return;
      }

      clearCart();
      localStorage.setItem("ra_last_order_id", result.data.order.id);
      setLocation(`/checkout/success/${result.data.order.id}`);
      toast({ title: "Order Placed" });
    } catch (err) {
      setFormError((err as Error).message || "Failed to place order.");
    }
  };

  return (
    <div className="container mx-auto px-4 py-16 lg:py-32 max-w-7xl mt-10">
      <div className="flex flex-col lg:flex-row gap-20">
        <form
          className="flex-1 space-y-12"
          onSubmit={handlePlaceOrder}
        >
          <div>
            <h2 className="text-xl font-black uppercase tracking-tighter mb-8">Contact</h2>
            <div className="space-y-4">
              <Input
                ref={fieldRefs.email}
                name="email"
                type="email"
                placeholder="Email Address"
                className={`h-14 rounded-none transition-colors ${errors.email ? "border-red-500 border-2" : "border-gray-200"}`}
                onFocus={() => clearError("email")}
                onChange={(e) => {
                  if (e.target.value) clearError("email");
                }}
              />
              {errors.email && <p className="text-[10px] text-red-500 uppercase font-bold">Email is required</p>}
            </div>
          </div>

          <div>
            <h2 className="text-xl font-black uppercase tracking-tighter mb-8">Shipping Address</h2>
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div className="space-y-1">
                <Input
                  ref={fieldRefs.firstName}
                  name="firstName"
                  placeholder="First name"
                  className={`h-14 rounded-none transition-colors ${errors.firstName ? "border-red-500 border-2" : "border-gray-200"}`}
                  onFocus={() => clearError("firstName")}
                  onChange={(e) => {
                    if (e.target.value) clearError("firstName");
                  }}
                />
                {errors.firstName && <p className="text-[10px] text-red-500 uppercase font-bold">Required</p>}
              </div>
              <div className="space-y-1">
                <Input
                  ref={fieldRefs.lastName}
                  name="lastName"
                  placeholder="Last name"
                  className={`h-14 rounded-none transition-colors ${errors.lastName ? "border-red-500 border-2" : "border-gray-200"}`}
                  onFocus={() => clearError("lastName")}
                  onChange={(e) => {
                    if (e.target.value) clearError("lastName");
                  }}
                />
                {errors.lastName && <p className="text-[10px] text-red-500 uppercase font-bold">Required</p>}
              </div>
            </div>
            <div className="space-y-4">
              <div className="space-y-1">
                <Input
                  ref={fieldRefs.address}
                  name="address"
                  placeholder="Address"
                  className={`h-14 rounded-none transition-colors ${errors.address ? "border-red-500 border-2" : "border-gray-200"}`}
                  onFocus={() => clearError("address")}
                  onChange={(e) => {
                    if (e.target.value) clearError("address");
                  }}
                />
                {errors.address && <p className="text-[10px] text-red-500 uppercase font-bold">Address is required</p>}
              </div>
              <div className="grid gap-4">
                <div className="space-y-1">
                  <Input
                    ref={fieldRefs.city}
                    name="city"
                    placeholder="City"
                    className={`h-14 rounded-none transition-colors ${errors.city ? "border-red-500 border-2" : "border-gray-200"}`}
                    onFocus={() => clearError("city")}
                    onChange={(e) => {
                      if (e.target.value) clearError("city");
                    }}
                  />
                  {errors.city && <p className="text-[10px] text-red-500 uppercase font-bold">City is required</p>}
                </div>
              </div>
              <div className="space-y-1">
                <Input
                  ref={fieldRefs.phone}
                  name="phone"
                  placeholder="Phone"
                  className={`h-14 rounded-none transition-colors ${errors.phone ? "border-red-500 border-2" : "border-gray-200"}`}
                  onFocus={() => clearError("phone")}
                  onChange={(e) => {
                    if (e.target.value) clearError("phone");
                  }}
                />
                {errors.phone && <p className="text-[10px] text-red-500 uppercase font-bold">Phone is required</p>}
              </div>
              
              <div className="pt-2 scroll-mt-20" ref={fieldRefs.location}>
                <div className="flex justify-between items-center mb-2">
                  <p className="text-sm font-semibold uppercase tracking-wide">Delivery Location</p>
                    <button 
                      type="button" 
                      onClick={() => setShowManualLocation(!showManualLocation)}
                      className="text-[10px] uppercase font-bold underline hover:text-muted-foreground"
                    >
                      {showManualLocation ? "Use Maps" : "Type Manually"}
                    </button>
                </div>

                {showManualLocation ? (
                  <div className="space-y-2">
                    <Input
                      placeholder="Enter specific delivery location details (e.g. Near Big Mart, Baneshwor)"
                      className={`h-14 rounded-none ${errors.location ? "border-red-500 border-2" : "border-gray-200"}`}
                      value={manualLocation}
                      onChange={(e) => {
                        setManualLocation(e.target.value);
                        if (e.target.value) clearError("location");
                      }}
                      onFocus={() => clearError("location")}
                    />
                    <p className="text-[10px] text-muted-foreground uppercase">Please be as specific as possible for faster delivery.</p>
                  </div>
                ) : (
                  <>
                    <LocationPicker onLocationSelect={(loc) => {
                      setLocationCoordinates(loc);
                      clearError("location");
                    }} />
                    {!locationCoordinates && errors.location && (
                      <p className="text-[10px] text-red-500 mt-1 uppercase font-bold">Please provide a delivery location</p>
                    )}
                  </>
                )}
              </div>

              <div className="pt-2 space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold uppercase tracking-wide">
                    Delivery
                  </p>
                  <button
                    type="button"
                    onClick={() => setDeliveryRequired((v) => !v)}
                    className={`text-[10px] uppercase font-bold underline hover:text-muted-foreground ${
                      deliveryRequired ? "" : "opacity-70"
                    }`}
                  >
                    {deliveryRequired ? "Required" : "Not required"}
                  </button>
                </div>
                {deliveryRequired && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-[10px] uppercase font-bold text-muted-foreground">
                        Delivery Partner
                      </label>
                      <select
                        value={deliveryProvider}
                        onChange={(e) => setDeliveryProvider(e.target.value)}
                        className="h-14 w-full rounded-none border-2 border-gray-200 bg-background px-4 text-sm"
                      >
                        <option value="pathao">Pathao Parcel</option>
                        <option value="nepal_can_move">Nepal Can Move</option>
                        <option value="yango">Yango</option>
                        <option value="other">Other</option>
                      </select>
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] uppercase font-bold text-muted-foreground">
                        Address (optional)
                      </label>
                      <Input
                        value={deliveryAddress}
                        onChange={(e) => setDeliveryAddress(e.target.value)}
                        placeholder="Extra address details for the rider"
                        className="h-14 rounded-none transition-colors border-gray-200"
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div>
            <h2 className="text-xl font-black uppercase tracking-tighter mb-6">
              Payment Option
            </h2>
            <div className="space-y-3">
              {PAYMENT_OPTIONS.map((opt) => {
                const isSelected = paymentMethod === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setPaymentMethod(opt.id)}
                    className={`w-full flex items-center gap-4 p-4 rounded-none border-2 text-left transition-all ${
                      isSelected
                        ? "border-zinc-900 dark:border-zinc-100 bg-zinc-900/5 dark:bg-white/10"
                        : "border-gray-200 dark:border-white/10 hover:border-gray-300 dark:hover:border-white/20"
                    }`}
                  >
                    <span
                      className={`w-12 h-12 flex items-center justify-center shrink-0 overflow-hidden ${
                        opt.id === "esewa" ? "rounded-full" : "rounded-none"
                      } ${"logoColor" in opt ? opt.logoColor : ""}`}
                    >
                      {"logoUrl" in opt ? (
                        <img 
                          src={opt.logoUrl} 
                          alt={opt.label} 
                          className={`w-full h-full object-contain ${
                            opt.id === "esewa" ? "scale-150" : "p-1"
                          }`} 
                        />
                      ) : opt.icon ? (
                        <opt.icon className="w-6 h-6" />
                      ) : null}
                    </span>
                    <span className="font-semibold uppercase tracking-wide text-sm text-zinc-900 dark:text-zinc-100">
                      {opt.label}
                    </span>
                    {isSelected && (
                      <CheckCircle2 className="w-5 h-5 text-zinc-900 dark:text-zinc-100 ml-auto shrink-0" />
                    )}
                  </button>
                );
              })}

              <div className="mt-6 pt-6 border-t border-gray-200">
                <button
                  type="button"
                  onClick={() => setPaymentMethod("cash_on_delivery")}
                  className={`w-full flex items-center gap-4 p-4 rounded-none border-2 text-left transition-all ${
                    paymentMethod === "cash_on_delivery"
                      ? "border-zinc-900 dark:border-zinc-100 bg-amber-50 dark:bg-amber-900/20"
                      : "border-gray-200 dark:border-white/10 hover:border-gray-300 dark:hover:border-white/20"
                  }`}
                >
                  <span className="w-12 h-12 rounded-none flex items-center justify-center text-white shrink-0 bg-amber-600">
                    <Banknote className="w-6 h-6" />
                  </span>
                  <span className="font-semibold uppercase tracking-wide text-sm text-black dark:text-white">
                    Cash on Delivery
                  </span>
                  {paymentMethod === "cash_on_delivery" && (
                    <CheckCircle2 className="w-5 h-5 text-amber-600 ml-auto shrink-0" />
                  )}
                </button>
              </div>
            </div>
          </div>

          {formError && (
            <p className="text-sm text-red-500">{formError}</p>
          )}

          <Button
            type="submit"
            className="w-full h-16 bg-black text-white rounded-none uppercase tracking-[0.2em] text-xs font-bold"
            disabled={isPending || (!locationCoordinates && !manualLocation)}
          >
            {isPending ? "Processing..." : paymentMethod === "cash_on_delivery" ? "Confirm Order" : "Pay Now"}
          </Button>
        </form>

        <div className="w-full lg:w-[450px] bg-zinc-50 dark:bg-zinc-200 p-10 h-fit rounded-2xl border border-zinc-200 dark:border-zinc-300 shadow-sm text-zinc-900">
          <div className="space-y-6 mb-10">
            {items.map(item => (
              <div key={item.id} className="flex gap-4">
                <div className="w-24 h-32 bg-muted shrink-0 relative rounded-sm overflow-hidden">
                  <img src={item.product.images[0]} className="w-full h-full object-cover" />
                  <span className="absolute top-2 right-2 min-w-[20px] h-5 px-1 bg-black text-white text-[10px] flex items-center justify-center rounded-sm font-bold shadow-sm">{item.quantity}</span>
                </div>
                <div className="flex-1">
                  <h4 className="text-[10px] font-bold uppercase tracking-widest">{item.product.name}</h4>
                  <p className="text-[10px] text-muted-foreground uppercase">{item.variant.size}</p>
                </div>
                <div className="text-[10px] font-black uppercase tracking-widest text-zinc-900">
                  {formatPrice(item.product.price)}
                </div>
              </div>
            ))}
          </div>

          <div className="flex gap-2 mb-10">
            <div className="flex-1 relative">
              <Input 
                placeholder="Gift card or discount code" 
                className={`h-12 rounded-none bg-white border-gray-200 uppercase ${appliedPromo ? "pr-10 border-emerald-500" : ""}`} 
                value={promoCodeInput}
                onChange={(e) => setPromoCodeInput(e.target.value)}
                disabled={!!appliedPromo}
              />
              {appliedPromo && (
                <button
                  type="button"
                  onClick={() => {
                    setAppliedPromo(null);
                    setPromoCodeInput("");
                  }}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              )}
            </div>
            <Button 
              type="button"
              variant="secondary" 
              className="h-12 rounded-none px-6 text-xs uppercase tracking-widest font-bold"
              onClick={handleApplyPromo}
              disabled={isValidatingPromo || !!appliedPromo || !promoCodeInput}
            >
              {isValidatingPromo ? "..." : "Apply"}
            </Button>
          </div>

          <div className="space-y-4 text-[10px] uppercase tracking-widest font-bold text-zinc-600 pt-8 border-t border-zinc-200">
            <div className="flex justify-between items-center">
              <span>Subtotal</span>
              <span className="text-zinc-900 font-black">{formatPrice(subtotal)}</span>
            </div>
            {appliedPromo && (
              <div className="flex justify-between items-center text-emerald-600">
                <span>Discount ({appliedPromo.code})</span>
                <span className="font-black">-{formatPrice(discountAmount)}</span>
              </div>
            )}
            <div className="flex justify-between items-center text-zinc-600">
              <span>Shipping</span>
              <span className="text-zinc-900 font-black">{formatPrice(shipping)}</span>
            </div>
            <div className="flex justify-between text-zinc-900 text-sm font-extrabold pt-4">
              <span>Total</span>
              <span>{formatPrice(total)}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}