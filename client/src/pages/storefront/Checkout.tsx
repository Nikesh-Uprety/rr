import { useMemo, useState, useRef } from "react";
import { Link, useLocation } from "wouter";
import { type CartState, useCartStore } from "@/store/cart";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Trash2, CheckCircle2, ShoppingBag, Banknote, BadgePercent, Sparkles } from "lucide-react";
import { DeliveryLocationSelect, NEPAL_LOCATIONS } from "@/components/DeliveryLocationSelect";
import { useToast } from "@/hooks/use-toast";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { cacheLatestOrder, createOrder, validatePromoCode } from "@/lib/api";
import { formatPrice } from "@/lib/format";

const PAYMENT_OPTIONS = [
  {
    id: "esewa",
    label: "eSewa",
    logoUrl: "/images/esewa-logo.png",
    logoWrapClass: "px-0",
    logoImageClass: "h-10 w-auto",
  },
  {
    id: "khalti",
    label: "Khalti",
    logoUrl: "/images/khalti-logo.png",
    logoWrapClass: "px-0 justify-start",
    logoImageClass: "h-10 w-auto mr-2",
  },
  {
    id: "fonepay",
    label: "Fonepay",
    logoUrl: "/images/fonepay-logo.png",
    logoWrapClass: "px-0",
    logoImageClass: "h-10 w-auto",
  },
  {
    id: "stripe",
    label: "Pay by Card",
    logoUrl: "/images/stripe-logo.svg",
    logoWrapClass: "px-0",
    logoImageClass: "h-8 w-auto",
  },
] as const;

const NEPAL_DISTRICTS = [
  "Achham", "Arghakhanchi", "Baglung", "Baitadi", "Bajhang", "Bajura", "Banke", "Bara", "Bardiya", "Bhaktapur",
  "Bhojpur", "Chitwan", "Dadeldhura", "Dailekh", "Dang", "Darchula", "Dhading", "Dhankuta", "Dhanusha", "Dolakha",
  "Dolpa", "Doti", "Gorkha", "Gulmi", "Humla", "Ilam", "Jajarkot", "Jhapa", "Jumla", "Kailali",
  "Kalikot", "Kanchanpur", "Kapilvastu", "Kaski", "Kathmandu", "Kavrepalanchok", "Khotang", "Lalitpur", "Lamjung", "Mahottari",
  "Makwanpur", "Manang", "Morang", "Mugu", "Mustang", "Myagdi", "Nawalpur", "Nuwakot", "Okhaldhunga", "Palpa",
  "Panchthar", "Parasi", "Parbat", "Parsa", "Pyuthan", "Ramechhap", "Rasuwa", "Rautahat", "Rolpa", "Rukum East",
  "Rukum West", "Rupandehi", "Salyan", "Sankhuwasabha", "Saptari", "Sarlahi", "Sindhuli", "Sindhupalchok", "Siraha", "Solukhumbu",
  "Sunsari", "Surkhet", "Syangja", "Tanahun", "Taplejung", "Tehrathum", "Udayapur",
] as const;

export type PaymentMethodId = (typeof PAYMENT_OPTIONS)[number]["id"] | "cash_on_delivery";

function getCheckoutOriginalPrice(price: number, originalPrice?: number | null, salePercentage?: number | null, saleActive?: boolean | null) {
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

export default function Checkout() {
  const [, setLocation] = useLocation();
  const { items, clearCart, hasHydrated = true } = useCartStore((state: CartState) => state);
  const { toast } = useToast();

  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [formError, setFormError] = useState<string | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethodId>("cash_on_delivery");
  const [deliveryRequired, setDeliveryRequired] = useState(true);
  const [deliveryProvider, setDeliveryProvider] = useState<string>("pathao");
  const [deliveryAddress, setDeliveryAddress] = useState<string>("");
  const [deliveryLocation, setDeliveryLocation] = useState<string>("");

  const shipping = 100;
  // Promo code state
  const [promoCodeInput, setPromoCodeInput] = useState("");
  const [appliedPromo, setAppliedPromo] = useState<{ id: string; code: string; discountPct: number } | null>(null);
  const [isValidatingPromo, setIsValidatingPromo] = useState(false);

  const subtotal = useMemo(
    () => items.reduce((sum, item) => sum + item.product.price * item.quantity, 0),
    [items],
  );
  const productDiscountTotal = useMemo(
    () =>
      items.reduce((sum, item) => {
        const originalPrice = getCheckoutOriginalPrice(
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

  const discountAmount = useMemo(() => {
    if (!appliedPromo) return 0;
    return (subtotal * appliedPromo.discountPct) / 100;
  }, [subtotal, appliedPromo]);

  const total = subtotal + shipping - discountAmount;

  const handleApplyPromo = async () => {
    if (!promoCodeInput) return;
    setIsValidatingPromo(true);
    try {
      const productIds = items.map((it) => it.product.id);
      const result = await validatePromoCode(promoCodeInput.toUpperCase(), productIds);

      if (result.valid && result.data) {
        setAppliedPromo(result.data);
        toast({
          title: "Promo code applied!",
          description: `${result.data.discountPct}% discount added.`,
        });
      } else {
        setAppliedPromo(null);
        toast({
          title: "Invalid promo code",
          description: result.reason || "Please check the code and try again.",
          variant: "destructive",
        });
      }
    } catch (err) {
      toast({ title: "Error", description: "Failed to validate promo code.", variant: "destructive" });
    } finally {
      setIsValidatingPromo(false);
    }
  };

  if (!hasHydrated) {
    return null;
  }

  if (items.length === 0 && step !== 3) {
    setLocation("/cart");
    return null;
  }

  const { mutateAsync, isPending } = useMutation({
    mutationFn: createOrder,
  });

  const [errors, setErrors] = useState<Record<string, boolean>>({});
  
  const fieldRefs = {
    email: useRef<HTMLInputElement>(null),
    firstName: useRef<HTMLInputElement>(null),
    lastName: useRef<HTMLInputElement>(null),
    address: useRef<HTMLInputElement>(null),
    city: useRef<HTMLSelectElement>(null),
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
    
    const isLocationValid =
      !!deliveryLocation && NEPAL_LOCATIONS.includes(deliveryLocation);
    if (!isLocationValid) newErrors.location = true;

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
          variantId:
            item.variant.id?.toString() ??
            item.product.variants
              ?.find(
                (variant) =>
                  variant.size === item.variant.size && variant.color === item.variant.color,
              )
              ?.id
              ?.toString(),
          productId: item.product.id,
          size: item.variant.size,
          color: item.variant.color,
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
          locationCoordinates: deliveryLocation,
          deliveryLocation,
        },
        paymentMethod,
        source: "website",
        deliveryRequired,
        deliveryProvider: deliveryRequired ? deliveryProvider : null,
        deliveryAddress: deliveryRequired ? deliveryAddress || null : null,
        promoCodeId: appliedPromo?.id,
      });

      if (!result.success || !result.data) {
        setFormError(result.error || "Failed to place order.");
        return;
      }

      const needsPaymentPage =
        paymentMethod === "esewa" ||
        paymentMethod === "khalti" ||
        paymentMethod === "fonepay";

      if (paymentMethod === "stripe") {
        setStep(3);
        cacheLatestOrder(result.data.order);
        clearCart();
        toast({ title: "Order created. Redirecting to Stripe..." });
        try {
          const { createCheckoutSession } = await import("@/lib/api");
          const sessionResult = await createCheckoutSession(result.data.order.id);
          if (sessionResult.success && sessionResult.data?.checkoutUrl) {
            window.location.href = sessionResult.data.checkoutUrl;
          } else {
            setLocation(
              `/checkout/payment?orderId=${result.data.order.id}&method=stripe`,
            );
          }
        } catch {
          setLocation(
            `/checkout/payment?orderId=${result.data.order.id}&method=stripe`,
          );
        }
        return;
      }

      if (needsPaymentPage) {
        setStep(3);
        cacheLatestOrder(result.data.order);
        setLocation(
          `/checkout/payment?orderId=${result.data.order.id}&method=${paymentMethod}`,
        );
        clearCart();
        return;
      }

      setStep(3);
      cacheLatestOrder(result.data.order);
      setLocation(`/order-confirmation/${result.data.order.id}`);
      clearCart();
      toast({ title: "Order Placed" });
    } catch (err) {
      setFormError((err as Error).message || "Failed to place order.");
    }
  };

  return (
    <div className="container mx-auto px-4 py-16 lg:py-32 max-w-7xl mt-10">
      <div className="flex flex-col lg:flex-row gap-20">
        <form
          data-testid="checkout-form"
          className="flex-1 space-y-12"
          onSubmit={handlePlaceOrder}
        >
          <div>
            <h2 className="text-xl font-black uppercase tracking-tighter mb-8">Contact</h2>
            <div className="space-y-4">
              <label className="text-[10px] uppercase font-bold text-muted-foreground">
                Email Address <span className="text-red-500">*</span>
              </label>
              <Input
                ref={fieldRefs.email}
                name="email"
                type="email"
                placeholder="Email Address"
                data-testid="checkout-email"
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
                <label className="text-[10px] uppercase font-bold text-muted-foreground">
                  First Name <span className="text-red-500">*</span>
                </label>
                <Input
                  ref={fieldRefs.firstName}
                  name="firstName"
                  placeholder="First name"
                  data-testid="checkout-first-name"
                  className={`h-14 rounded-none transition-colors ${errors.firstName ? "border-red-500 border-2" : "border-gray-200"}`}
                  onFocus={() => clearError("firstName")}
                  onChange={(e) => {
                    if (e.target.value) clearError("firstName");
                  }}
                />
                {errors.firstName && <p className="text-[10px] text-red-500 uppercase font-bold">Required</p>}
              </div>
              <div className="space-y-1">
                <label className="text-[10px] uppercase font-bold text-muted-foreground">
                  Last Name <span className="text-red-500">*</span>
                </label>
                <Input
                  ref={fieldRefs.lastName}
                  name="lastName"
                  placeholder="Last name"
                  data-testid="checkout-last-name"
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
                <label className="text-[10px] uppercase font-bold text-muted-foreground">
                  Address <span className="text-red-500">*</span>
                </label>
                <Input
                  ref={fieldRefs.address}
                  name="address"
                  placeholder="Address"
                  data-testid="checkout-address"
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
                  <label className="text-[10px] uppercase font-bold text-muted-foreground">
                    District <span className="text-red-500">*</span>
                  </label>
                  <select
                    ref={fieldRefs.city}
                    name="city"
                    data-testid="checkout-city"
                    className={`h-14 w-full rounded-none border-2 bg-background px-4 text-sm transition-colors ${errors.city ? "border-red-500" : "border-gray-200"}`}
                    onFocus={() => clearError("city")}
                    onChange={(e) => {
                      if (e.target.value) clearError("city");
                    }}
                    defaultValue=""
                  >
                    <option value="" disabled>
                      Select District
                    </option>
                    {NEPAL_DISTRICTS.map((district) => (
                      <option key={district} value={district}>
                        {district}
                      </option>
                    ))}
                  </select>
                  {errors.city && <p className="text-[10px] text-red-500 uppercase font-bold">City is required</p>}
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-[10px] uppercase font-bold text-muted-foreground">
                  Phone <span className="text-red-500">*</span>
                </label>
                <Input
                  ref={fieldRefs.phone}
                  name="phone"
                  placeholder="Phone"
                  data-testid="checkout-phone"
                  className={`h-14 rounded-none transition-colors ${errors.phone ? "border-red-500 border-2" : "border-gray-200"}`}
                  onFocus={() => clearError("phone")}
                  onChange={(e) => {
                    if (e.target.value) clearError("phone");
                  }}
                />
                {errors.phone && <p className="text-[10px] text-red-500 uppercase font-bold">Phone is required</p>}
              </div>
              
              <div className="pt-2 scroll-mt-20" ref={fieldRefs.location}>
                <p className="text-sm font-semibold uppercase tracking-wide mb-2">
                  Delivery Location <span className="text-red-500">*</span>
                </p>

                <DeliveryLocationSelect
                  value={deliveryLocation}
                  onChange={(next) => {
                    setDeliveryLocation(next);
                    clearError("location");
                  }}
                  error={!!errors.location}
                />
              </div>

              <div className="pt-2 space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold uppercase tracking-wide">
                    Delivery
                  </p>
                <button
                  type="button"
                  data-testid="checkout-toggle-delivery"
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
                        data-testid="checkout-delivery-provider"
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
                        data-testid="checkout-delivery-address"
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
              Payment Option <span className="text-red-500">*</span>
            </h2>
            <div className="space-y-3">
              {PAYMENT_OPTIONS.map((opt) => {
                const isSelected = paymentMethod === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    data-testid={`checkout-payment-${opt.id}`}
                    onClick={() => setPaymentMethod(opt.id)}
                    className={`w-full flex items-center gap-4 p-4 rounded-none border-2 text-left transition-all ${
                      isSelected
                        ? "border-zinc-900 dark:border-zinc-100 bg-zinc-900/5 dark:bg-white/10"
                        : "border-gray-200 dark:border-white/10 hover:border-gray-300 dark:hover:border-white/20"
                    }`}
                  >
                    <span
                      className={`h-12 min-w-[140px] flex items-center justify-center shrink-0 overflow-hidden ${
                        "logoWrapClass" in opt ? opt.logoWrapClass : ""
                      }`}
                    >
                      {"logoUrl" in opt ? (
                        <img 
                          src={opt.logoUrl} 
                          alt={opt.label} 
                          className={`max-w-full object-contain ${
                            "logoImageClass" in opt ? opt.logoImageClass : "h-8 w-auto"
                          }`}
                        />
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
                  data-testid="checkout-payment-cash-on-delivery"
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
                    Cash on Delivery <span className="text-red-500">*</span>
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
            data-testid="checkout-submit"
            className="w-full h-16 bg-black text-white rounded-none uppercase tracking-[0.2em] text-xs font-bold"
            disabled={isPending}
          >
            {isPending ? "Processing..." : "Confirm Order"}
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
                  {Number(item.product.originalPrice ?? item.product.price) > item.product.price && (
                    <div className="mt-2 inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-1 text-[8px] font-black uppercase tracking-[0.16em] text-emerald-700">
                      <BadgePercent className="h-3 w-3" />
                      Deal applied
                    </div>
                  )}
                </div>
                <div className="text-right text-[10px] font-black uppercase tracking-widest text-zinc-900">
                  <div>{formatPrice(item.product.price)}</div>
                  {Number(item.product.originalPrice ?? item.product.price) > item.product.price && (
                    <div className="mt-1 text-[8px] text-zinc-500 line-through">
                      {formatPrice(Number(item.product.originalPrice))}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>

          <div className="flex gap-2 mb-10">
            <div className="flex-1 relative">
              <Input 
                placeholder="Gift card or discount code" 
                data-testid="checkout-promo-input"
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
              data-testid="checkout-apply-promo"
              variant="secondary" 
              className="h-12 rounded-none px-6 text-xs uppercase tracking-widest font-bold"
              onClick={handleApplyPromo}
              disabled={isValidatingPromo || !!appliedPromo || !promoCodeInput}
            >
              {isValidatingPromo ? "..." : "Apply"}
            </Button>
          </div>

          <div className="space-y-4 text-[10px] uppercase tracking-widest font-bold text-zinc-600 pt-8 border-t border-zinc-200">
            {productDiscountTotal > 0 && (
              <div className="flex items-start gap-3 rounded-2xl border border-emerald-500/20 bg-gradient-to-r from-emerald-500/10 via-lime-300/10 to-amber-200/10 px-4 py-4 text-emerald-700">
                <div className="mt-0.5 rounded-full bg-emerald-500/15 p-2">
                  <Sparkles className="h-4 w-4" />
                </div>
                <div className="flex-1">
                  <p className="text-[9px] uppercase tracking-[0.2em] font-black">Product Discount Live</p>
                  <p className="mt-1 text-[11px] normal-case tracking-normal font-semibold">
                    Discounted item pricing is already included in this subtotal.
                  </p>
                </div>
                <span className="text-[12px] font-black">-{formatPrice(productDiscountTotal)}</span>
              </div>
            )}
            <div className="flex justify-between items-center">
              <span>Subtotal</span>
              <span className="text-zinc-900 font-black">{formatPrice(subtotal)}</span>
            </div>
            {productDiscountTotal > 0 && (
              <div className="flex justify-between items-center text-emerald-600">
                <span className="inline-flex items-center gap-2">
                  <BadgePercent className="h-3.5 w-3.5" />
                  Product Savings
                </span>
                <span className="font-black">-{formatPrice(productDiscountTotal)}</span>
              </div>
            )}
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
