import { useRoute, Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Check, Package, Truck, MapPin, Printer, LifeBuoy } from "lucide-react";
import { Helmet } from "react-helmet-async";
import { fetchOrderById, getCachedLatestOrder } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { BrandedLoader } from "@/components/ui/BrandedLoader";
import { formatPrice } from "@/lib/format";

function paymentMethodLabel(method: string) {
  const labels: Record<string, string> = {
    cash_on_delivery: "Cash on Delivery",
    bank_transfer: "Bank Transfer",
    card: "Card",
    esewa: "eSewa",
    khalti: "Khalti",
    fonepay: "Fonepay",
    stripe: "Pay by Card",
  };
  return labels[method] ?? method.replace(/_/g, " ");
}

function firstNameFromFull(fullName: string) {
  const t = fullName.trim();
  if (!t) return "";
  return t.split(/\s+/)[0] ?? t;
}

function parseJsonArray(raw: string | null | undefined): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((value): value is string => typeof value === "string") : [];
  } catch {
    return [];
  }
}

function selectedColorLabel(item: any): string {
  const variantColor = String(item?.variantColor ?? "").trim();
  if (variantColor) return variantColor;

  const color = String(item?.color ?? "").trim();
  if (color) return color;

  const options = parseJsonArray(item?.product?.colorOptions);
  return options.length === 1 ? options[0] : "-";
}

export default function OrderSuccess() {
  const [, newParams] = useRoute("/order-confirmation/:orderId");
  const [, legacyParams] = useRoute("/checkout/success/:id");
  const orderId = newParams?.orderId ?? legacyParams?.id;
  const cachedOrder = getCachedLatestOrder(orderId);

  const { data: fetchedOrder, isLoading } = useQuery({
    queryKey: ["order", orderId],
    queryFn: () => fetchOrderById(orderId!),
    enabled: !!orderId && !cachedOrder,
  });
  const order = fetchedOrder ?? cachedOrder;

  const itemsSubtotal = order
    ? order.items.reduce(
        (acc: number, item: any) => acc + Number(item.unitPrice) * item.quantity,
        0,
      )
    : 0;
  const shippingFee = 100;
  const promoDiscountAmount =
    typeof order?.promoDiscountAmount === "number" ? order.promoDiscountAmount : 0;

  if (isLoading) {
    return (
      <div className="min-h-[70vh] flex items-center justify-center">
        <BrandedLoader />
      </div>
    );
  }

  if (!order) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center p-4 text-center">
        <h1 className="text-2xl font-bold mb-4">Order Not Found</h1>
        <p className="text-muted-foreground mb-8">
          We couldn't find this order, or you do not have access to view it.
        </p>
        <Link href="/">
          <Button>Return to Home</Button>
        </Link>
      </div>
    );
  }

  const firstName = firstNameFromFull(order.fullName);
  const orderDateLabel = new Date(order.createdAt).toLocaleDateString("en-NP", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return (
    <div className="order-confirmation-page container mx-auto px-4 py-10 lg:py-16 max-w-5xl mt-8">
      <Helmet>
        <title>Order confirmed | Rare Atelier</title>
        <meta
          name="description"
          content={`Your order ${order.id.slice(0, 8)}… has been confirmed. View your bill and delivery details.`}
        />
      </Helmet>
      <style>
        {`
          @keyframes ocFloat {
            0%, 100% { transform: translateY(0); }
            50% { transform: translateY(-10px); }
          }
          @keyframes ocTickBreathe {
            0%, 100% { transform: scale(1); }
            50% { transform: scale(0.84); }
          }
          @keyframes ocGlowPulse {
            0%, 100% { opacity: 0.2; }
            50% { opacity: 0.1; }
          }
          @keyframes ocParticleDrift {
            0% { opacity: 0; transform: translateY(10px) scale(0.85); }
            25% { opacity: 0.55; }
            70% { opacity: 0.2; }
            100% { opacity: 0; transform: translateY(-16px) scale(1.1); }
          }
          .order-confirm-icon-float { animation: ocFloat 3.2s ease-in-out infinite; }
          .order-confirm-tick-breathe { animation: ocTickBreathe 1.8s ease-in-out infinite; }
          .order-confirm-icon-glow { animation: ocGlowPulse 2.4s ease-in-out infinite; }
          .order-confirm-particle {
            animation: ocParticleDrift 2.6s ease-in-out infinite;
          }
        `}
      </style>

      {/* Success hero — screen only */}
      <div className="no-print relative mt-20 mb-10 overflow-visible rounded-3xl border border-emerald-500/25 bg-gradient-to-br from-emerald-500/8 via-background to-background px-6 pb-8 pt-24 md:px-10 md:pb-10 md:pt-28">
        <div className="pointer-events-none absolute -top-12 left-1/2 h-40 w-40 -translate-x-1/2 rounded-full bg-black/15 blur-2xl" />
        <div className="pointer-events-none absolute -top-20 left-1/2 z-20 -translate-x-1/2 text-center">
          <div className="order-confirm-icon-float relative flex h-28 w-28 items-center justify-center rounded-full border border-gray-300/70 bg-white shadow-[0_0_30px_rgba(0,0,0,0.35)] md:h-32 md:w-32 overflow-hidden">
            <span className="order-confirm-icon-glow absolute inset-0 rounded-full bg-black/10 blur-md" />
            <img
              src="/images/order-success-icon.webp"
              alt="Order confirmed"
              className="relative z-10 h-full w-full object-cover rounded-full"
            />
          </div>
        </div>
        <div className="relative flex flex-col items-center text-center">
          <div className="min-w-0 space-y-3">
            <p className="text-[10px] font-bold uppercase tracking-[0.35em] text-muted-foreground">Order Success</p>
            <h1 className="text-2xl font-black uppercase tracking-tight md:text-4xl">
              {firstName ? `Thank you, ${firstName}` : "Thank you for your order"}
            </h1>
            <p className="text-sm text-muted-foreground leading-relaxed max-w-2xl mx-auto">
              We&apos;ve received your payment details and your order is being processed. A confirmation has been sent to{" "}
              <span className="font-medium text-foreground">{order.email}</span>. Keep this page as your receipt or print
              it below.
            </p>
            <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
              <span className="inline-flex items-center rounded-md border border-border bg-background/80 px-3 py-1.5 font-mono text-xs font-semibold">
                Order ID · {order.id}
              </span>
              <span className="text-xs text-muted-foreground">{orderDateLabel}</span>
            </div>
          </div>
        </div>
      </div>

      {/* What happens next — screen only */}
      <div className="no-print mb-10">
        <h2 className="text-[10px] font-bold uppercase tracking-[0.35em] text-muted-foreground mb-4">What happens next</h2>
        <div className="grid gap-4 md:grid-cols-3">
          <div className="rounded-xl border border-border/80 bg-muted/30 p-5">
            <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-background text-foreground">
              <Package className="h-5 w-5" aria-hidden />
            </div>
            <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1">Step 1</p>
            <p className="font-semibold text-sm mb-1">Confirmation</p>
            <p className="text-xs text-muted-foreground leading-relaxed">
              We verify your order and prepare it for fulfillment at our atelier.
            </p>
          </div>
          <div className="rounded-xl border border-border/80 bg-muted/30 p-5">
            <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-background text-foreground">
              <Truck className="h-5 w-5" aria-hidden />
            </div>
            <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1">Step 2</p>
            <p className="font-semibold text-sm mb-1">Packing & dispatch</p>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Your items are packed carefully. Our delivery partner will be assigned when the order ships.
            </p>
          </div>
          <div className="rounded-xl border border-border/80 bg-muted/30 p-5">
            <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-background text-foreground">
              <MapPin className="h-5 w-5" aria-hidden />
            </div>
            <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1">Step 3</p>
            <p className="font-semibold text-sm mb-1">Delivery</p>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Estimated delivery within 3–5 business days in Nepal. See our{" "}
              <Link href="/shipping" className="underline font-medium text-foreground hover:no-underline">
                shipping policy
              </Link>
              .
            </p>
          </div>
        </div>
      </div>

      <div className="order-confirmation-bill relative overflow-hidden rounded-2xl border border-zinc-200 bg-white text-black shadow-[0_30px_80px_-35px_rgba(0,0,0,0.45)]">
        {(order.paymentMethod === "esewa" || order.paymentMethod === "khalti" || order.paymentMethod === "fonepay") && order.paymentVerified !== "verified" && (
          <div className="no-print rounded-none border-b border-amber-200 bg-amber-50 px-6 py-5">
            <div className="flex gap-3">
              <Check className="h-5 w-5 shrink-0 text-amber-600 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-amber-800">Payment Proof Under Review</p>
                <p className="text-xs text-amber-700 mt-1">
                  Thank you for uploading your payment proof. Our team will review it and contact you very soon. Your order is being processed in the meantime.
                </p>
              </div>
            </div>
          </div>
        )}
        <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-emerald-600 via-emerald-400 to-emerald-600" />
        <div className="p-6 md:p-10">
          <div className="flex items-center justify-between border-b border-zinc-200 pb-6">
            <div className="flex items-center gap-4">
              <img src="/images/logo.webp" alt="RARE.NP" className="h-11 w-11 object-contain" />
              <div>
                <p className="text-xl font-black tracking-tight">RARE.NP</p>
                <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">Official Bill Preview</p>
              </div>
            </div>
            <div className="text-right text-sm">
              <p className="font-semibold">Order ID: {order.id}</p>
              <p className="text-zinc-500">{orderDateLabel}</p>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2 py-6 border-b border-zinc-200 text-sm">
            <div>
              <p className="text-xs uppercase tracking-wider text-zinc-500 mb-1">Customer</p>
              <p className="font-semibold">{order.fullName}</p>
              <p>{order.email}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wider text-zinc-500 mb-1">Delivery Location</p>
              <p className="font-semibold">{order.deliveryLocation || order.locationCoordinates || "-"}</p>
              {order.deliveryAddress && <p>{order.deliveryAddress}</p>}
            </div>
            <div>
              <p className="text-xs uppercase tracking-wider text-zinc-500 mb-1">Delivery</p>
              <p>
                {order.deliveryRequired === false
                  ? "Pickup / No delivery required"
                  : order.deliveryProvider
                    ? `Partner: ${order.deliveryProvider}`
                    : "Partner: To be assigned"}
              </p>
              <p className="text-zinc-600">Estimated delivery: 3-5 business days</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wider text-zinc-500 mb-1">Payment Method</p>
              <p className="font-semibold">{paymentMethodLabel(order.paymentMethod)}</p>
            </div>
          </div>

          <div className="py-6 border-b border-zinc-200">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wider text-zinc-500 border-b border-zinc-200">
                  <th className="py-2 pr-2">Item</th>
                  <th className="py-2 px-2">Size</th>
                  <th className="py-2 px-2">Color</th>
                  <th className="py-2 px-2 text-center">Qty</th>
                  <th className="py-2 px-2 text-right">Unit Price</th>
                  <th className="py-2 pl-2 text-right">Subtotal</th>
                </tr>
              </thead>
              <tbody>
                {order.items.map((item: any) => {
                  const lineTotal = Number(item.unitPrice) * item.quantity;
                  const sizeLabel = String(item.size ?? "").trim() || "-";
                  const colorLabel = selectedColorLabel(item);
                  return (
                    <tr key={item.id} className="border-b border-zinc-100 align-top">
                      <td className="py-3 pr-2">
                        <p className="font-medium">{item.product?.name || "Product"}</p>
                      </td>
                      <td className="py-3 px-2">
                        <span className="inline-flex rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-semibold text-zinc-700">
                          {sizeLabel}
                        </span>
                      </td>
                      <td className="py-3 px-2">
                        <span className="inline-flex rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-semibold text-zinc-700">
                          {colorLabel}
                        </span>
                      </td>
                      <td className="py-3 px-2 text-center">{item.quantity}</td>
                      <td className="py-3 px-2 text-right">{formatPrice(item.unitPrice)}</td>
                      <td className="py-3 pl-2 text-right">{formatPrice(lineTotal)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="py-6 space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-zinc-600">Subtotal</span>
              <span>{formatPrice(itemsSubtotal)}</span>
            </div>
            {promoDiscountAmount > 0 && (
              <div className="flex justify-between">
                <span className="text-zinc-600">
                  Discount {order.promoCode ? `(${order.promoCode})` : ""}
                </span>
                <span>-{formatPrice(promoDiscountAmount)}</span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-zinc-600">Shipping</span>
              <span>{formatPrice(shippingFee)}</span>
            </div>
            <div className="flex justify-between border-t border-zinc-200 mt-3 pt-3 text-lg font-black">
              <span>Grand Total (NPR)</span>
              <span>{formatPrice(order.total)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Help — screen only */}
      <div className="no-print mt-8 rounded-xl border border-dashed border-border bg-muted/20 px-4 py-5 md:px-6 md:flex md:items-center md:justify-between md:gap-6">
        <div className="flex gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-background text-muted-foreground">
            <LifeBuoy className="h-5 w-5" aria-hidden />
          </div>
          <div>
            <p className="text-sm font-semibold">Need help with your order?</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Reach our team for changes, sizing, or delivery questions.
            </p>
          </div>
        </div>
        <Button asChild variant="outline" className="mt-4 md:mt-0 shrink-0 rounded-none uppercase tracking-widest text-[10px] h-10">
          <Link href="/atelier#contact">Contact us</Link>
        </Button>
      </div>

      <div className="order-confirmation-actions no-print flex flex-wrap gap-3 mt-6">
        <Button onClick={() => window.print()} className="h-11 rounded-none uppercase tracking-widest text-xs">
          <Printer className="h-4 w-4 mr-2" />
          Download as PDF
        </Button>
        <Button asChild variant="outline" className="h-11 rounded-none uppercase tracking-widest text-xs">
          <Link href="/">Continue Shopping</Link>
        </Button>
      </div>
    </div>
  );
}
