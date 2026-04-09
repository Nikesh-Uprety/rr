import { useRoute, Link } from "wouter";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Check, Package, Truck, MapPin, Printer, LifeBuoy, ClipboardCheck, Sparkles, Shield, Mail, MessageSquare } from "lucide-react";
import { fetchOrderById, getCachedLatestOrder, updateCachedOrder } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { BrandedLoader } from "@/components/ui/BrandedLoader";
import { formatPrice } from "@/lib/format";
import { StorefrontSeo } from "@/components/seo/StorefrontSeo";

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

const ORDER_COLOR_NAME_SWATCHES: Record<string, string> = {
  black: "#111111",
  white: "#f5f5f5",
  cream: "#f2eadf",
  ivory: "#fff8e7",
  beige: "#d8c3a5",
  brown: "#7a5a43",
  mocha: "#7b5b45",
  grey: "#7c7c7c",
  gray: "#7c7c7c",
  blue: "#2548b1",
  navy: "#1f2a44",
  "navy blue": "#1f2a44",
  green: "#2f7d32",
  red: "#c62828",
  maroon: "#6b1f2a",
  burgundy: "#6d213c",
  pink: "#f7a6ec",
  purple: "#7c3aed",
  yellow: "#facc15",
  orange: "#f97316",
  gold: "#c9a84c",
};

function parseOrderColor(value: string): { label: string; swatch: string | null } {
  const trimmed = value.trim();
  const hexMatch = trimmed.match(/#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})\b/);
  const label = trimmed.replace(/\(\s*#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})\s*\)/g, "").trim();
  const normalized = label.toLowerCase();
  return {
    label: label || trimmed,
    swatch: hexMatch?.[0] ?? ORDER_COLOR_NAME_SWATCHES[normalized] ?? null,
  };
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
  const [isDownloadingPdf, setIsDownloadingPdf] = useState(false);

  useEffect(() => {
    if (fetchedOrder) {
      updateCachedOrder(fetchedOrder);
    }
  }, [fetchedOrder]);

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
      <>
        <StorefrontSeo
          title="Order Confirmed | Rare Atelier"
          description="Your Rare Atelier order has been placed successfully."
          canonicalPath={typeof window !== "undefined" ? window.location.pathname : "/order-confirmation"}
          noIndex
        />
        <div className="min-h-[70vh] flex items-center justify-center">
          <BrandedLoader />
        </div>
      </>
    );
  }

  if (!order) {
    return (
      <>
        <StorefrontSeo
          title="Order Confirmation | Rare Atelier"
          description="This order confirmation page is not available."
          canonicalPath={typeof window !== "undefined" ? window.location.pathname : "/order-confirmation"}
          noIndex
        />
        <div className="min-h-[60vh] flex flex-col items-center justify-center p-4 text-center">
          <h1 className="text-2xl font-bold mb-4">Order Not Found</h1>
          <p className="text-muted-foreground mb-8">
            We couldn't find this order, or you do not have access to view it.
          </p>
          <Link href="/">
            <Button>Return to Home</Button>
          </Link>
        </div>
      </>
    );
  }

  const firstName = firstNameFromFull(order.fullName);
  const orderDateLabel = new Date(order.createdAt).toLocaleDateString("en-NP", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const handleDownloadPdf = async () => {
    const target = document.getElementById("order-confirmation-export");
    if (!target || !order) return;
    setIsDownloadingPdf(true);
    try {
      const [{ default: html2canvas }, { jsPDF }] = await Promise.all([
        import("html2canvas"),
        import("jspdf"),
      ]);

      const canvas = await html2canvas(target, {
        backgroundColor: "#ffffff",
        scale: 2,
        useCORS: true,
        onclone: (doc) => {
          doc.documentElement.classList.remove("dark");
          doc.body.classList.remove("dark");
          doc.body.style.background = "#ffffff";
          const cloned = doc.getElementById("order-confirmation-export");
          if (cloned) {
            cloned.style.background = "#ffffff";
            cloned.style.color = "#111111";
          }
        },
      });

      const imageData = canvas.toDataURL("image/png");
      const pdf = new jsPDF("p", "mm", "a4");
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
      pdf.addImage(imageData, "PNG", 0, 0, pdfWidth, pdfHeight);
      pdf.save(`rare-order-${order.id.slice(0, 8)}.pdf`);
    } finally {
      setIsDownloadingPdf(false);
    }
  };

  return (
    <div className="order-confirmation-page container mx-auto max-w-5xl px-4 pb-10 pt-4 sm:pt-6 lg:pb-16">
      <StorefrontSeo
        title="Order Confirmed | Rare Atelier"
        description={`Your order ${order.id.slice(0, 8)}… has been confirmed. View your bill and delivery details.`}
        canonicalPath={`/order-confirmation/${order.id}`}
        noIndex
      />
      <style>
        {`
          @keyframes ocFloat {
            0%, 100% { transform: translateY(0); }
            50% { transform: translateY(-12px); }
          }
          @keyframes ocGlowPulse {
            0%, 100% { opacity: 0.15; transform: scale(1); }
            50% { opacity: 0.25; transform: scale(1.05); }
          }
          @keyframes ocIconSpin {
            0% { transform: rotate(0deg) scale(1); }
            50% { transform: rotate(8deg) scale(1.15); }
            100% { transform: rotate(0deg) scale(1); }
          }
          @keyframes ocBorderShimmer {
            0% { background-position: -200% 0; }
            100% { background-position: 200% 0; }
          }
          @keyframes ocFadeInUp {
            from { opacity: 0; transform: translateY(20px); }
            to { opacity: 1; transform: translateY(0); }
          }
          .order-confirm-icon-float { animation: ocFloat 3s ease-in-out infinite; }
          .order-confirm-icon-glow { animation: ocGlowPulse 2.5s ease-in-out infinite; }
          .order-confirm-step:hover .step-icon { animation: ocIconSpin 0.6s ease-in-out; }
          .order-confirm-step:hover .step-card { transform: translateY(-6px); box-shadow: 0 12px 40px -8px var(--step-shadow); }
          .order-confirm-step { transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1); }
          .step-card { transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1); }
          .step-icon { transition: transform 0.3s ease; }
          .order-confirm-fade-in { animation: ocFadeInUp 0.6s ease-out both; }
          .order-confirm-fade-in-delay-1 { animation: ocFadeInUp 0.6s ease-out 0.15s both; }
          .order-confirm-fade-in-delay-2 { animation: ocFadeInUp 0.6s ease-out 0.3s both; }
        `}
      </style>

      {/* Success hero — screen only */}
      <div className="no-print relative mb-8 overflow-visible rounded-2xl border border-border/60 bg-gradient-to-br from-emerald-500/5 via-background to-blue-500/5 dark:from-emerald-500/5 dark:via-background dark:to-blue-500/5 px-6 pb-8 pt-10 md:px-10 md:pb-10 md:pt-14">
        <div className="relative flex flex-col items-center text-center">
          <div className="min-w-0 space-y-3">
            <p className="text-[10px] font-bold uppercase tracking-[0.35em] text-muted-foreground">Order Success</p>
            <h1 className="text-2xl font-black uppercase tracking-tight text-foreground md:text-4xl">
              {firstName ? `Thank you, ${firstName}` : "Thank you for your order"}
            </h1>
            <p className="text-sm md:text-base text-muted-foreground leading-relaxed max-w-2xl mx-auto">
              We&apos;ve received your payment details and your order is being processed. A confirmation has been sent to{" "}
              <span className="font-semibold text-foreground">{order.email}</span>. Keep this page as your receipt or print
              it below.
            </p>
            <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
              <span className="inline-flex items-center rounded-md border border-border bg-background/80 px-3 py-1.5 font-mono text-xs font-semibold text-foreground">
                Order ID · {order.id}
              </span>
              <span className="text-xs text-muted-foreground">{orderDateLabel}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Brand logo circle between hero and steps */}
      <div className="relative z-10 -mt-6 mb-6 flex justify-center">
        <div className="order-confirm-icon-float relative flex h-24 w-24 items-center justify-center rounded-full border-4 border-white dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-[0_0_30px_rgba(0,0,0,0.2),0_6px_24px_rgba(0,0,0,0.1)] md:h-28 md:w-28 overflow-hidden">
          <span className="order-confirm-icon-glow absolute inset-0 rounded-full bg-black/10 blur-lg" />
          <img
            src="/images/order-success-icon.webp"
            alt="RARE.NP"
            className="relative z-10 h-full w-full object-cover rounded-full"
          />
        </div>
      </div>

      {/* Large Order Verification Notice */}
      {order.items.reduce((acc: number, item: any) => acc + Number(item.quantity), 0) > 10 && (
        <div className="no-print mb-8 rounded-2xl border-2 border-amber-300 dark:border-amber-700 bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-950/40 dark:to-orange-950/40 p-6 md:p-8">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 text-white shadow-lg shadow-amber-500/25">
              <Shield className="h-6 w-6" />
            </div>
            <div className="flex-1">
              <h3 className="text-base font-black uppercase tracking-tight text-amber-900 dark:text-amber-200 mb-2">
                Large Order Verification Required
              </h3>
              <p className="text-sm text-amber-800 dark:text-amber-300 leading-relaxed mb-4">
                Your order contains <strong className="font-bold">{order.items.reduce((acc: number, item: any) => acc + Number(item.quantity), 0)} items</strong>. For orders with more than 10 items, we require a quick two-step verification to ensure order authenticity and prevent fraud.
              </p>
              <div className="space-y-3">
                <div className="flex items-start gap-3 p-3 bg-white/60 dark:bg-zinc-900/40 rounded-xl">
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-amber-500 text-white text-xs font-bold">1</div>
                  <p className="text-sm text-amber-800 dark:text-amber-300">
                    <strong className="font-semibold">Contact us</strong> via email at{" "}
                    <a href="mailto:upretynikesh123@gmail.com" className="underline font-semibold hover:no-underline">upretynikesh123@gmail.com</a> or through our{" "}
                    <Link href="/atelier#contact" className="underline font-semibold hover:no-underline">contact page</Link>
                    {" "}with your order ID.
                  </p>
                </div>
                <div className="flex items-start gap-3 p-3 bg-white/60 dark:bg-zinc-900/40 rounded-xl">
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-amber-500 text-white text-xs font-bold">2</div>
                  <p className="text-sm text-amber-800 dark:text-amber-300">
                    <strong className="font-semibold">Our team will verify</strong> your order and contact you within 24 hours to confirm details. Once verified, your order will be processed immediately.
                  </p>
                </div>
              </div>
              <div className="mt-4 flex flex-wrap gap-3">
                <a
                  href="mailto:upretynikesh123@gmail.com?subject=Large Order Verification - {order.id.slice(0, 8)}"
                  className="inline-flex items-center gap-2 px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white text-sm font-semibold rounded-lg transition-colors"
                >
                  <Mail className="h-4 w-4" />
                  Email Us Now
                </a>
                <Link
                  href="/atelier#contact"
                  className="inline-flex items-center gap-2 px-4 py-2 border-2 border-amber-600 text-amber-700 dark:text-amber-300 dark:border-amber-500 hover:bg-amber-100 dark:hover:bg-amber-900/30 text-sm font-semibold rounded-lg transition-colors"
                >
                  <MessageSquare className="h-4 w-4" />
                  Contact Page
                </Link>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* What happens next — screen only */}
      <div className="no-print mb-10">
        <h2 className="text-lg md:text-xl font-black uppercase tracking-tight text-black dark:text-white mb-6">
          What happens next
        </h2>
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {/* Step 1 */}
          <div className="order-confirm-step order-confirm-fade-in">
            <div className="step-card group relative rounded-2xl border border-border/60 bg-card/50 dark:bg-card/30 p-6 cursor-default overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-br from-violet-500/0 to-violet-500/0 group-hover:from-violet-500/5 group-hover:to-purple-500/5 transition-all duration-300" />
              <div className="relative">
                <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 text-white shadow-lg shadow-violet-500/25 group-hover:shadow-violet-500/40 transition-shadow duration-300">
                  <ClipboardCheck className="step-icon h-6 w-6" aria-hidden />
                </div>
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-violet-500 dark:text-violet-400">Step 1</span>
                  <div className="h-px flex-1 bg-gradient-to-r from-violet-500/30 to-transparent" />
                </div>
                <p className="font-bold text-base text-foreground mb-2">Confirmation</p>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  We verify your order and prepare it for fulfillment at our atelier.
                </p>
              </div>
            </div>
          </div>

          {/* Step 2 */}
          <div className="order-confirm-step order-confirm-fade-in-delay-1">
            <div className="step-card group relative rounded-2xl border border-border/60 bg-card/50 dark:bg-card/30 p-6 cursor-default overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-br from-blue-500/0 to-cyan-500/0 group-hover:from-blue-500/5 group-hover:to-cyan-500/5 transition-all duration-300" />
              <div className="relative">
                <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-cyan-600 text-white shadow-lg shadow-blue-500/25 group-hover:shadow-blue-500/40 transition-shadow duration-300">
                  <Package className="step-icon h-6 w-6" aria-hidden />
                </div>
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-blue-500 dark:text-blue-400">Step 2</span>
                  <div className="h-px flex-1 bg-gradient-to-r from-blue-500/30 to-transparent" />
                </div>
                <p className="font-bold text-base text-foreground mb-2">Packing & dispatch</p>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Your items are packed carefully. Our delivery partner will be assigned when the order ships.
                </p>
              </div>
            </div>
          </div>

          {/* Step 3 */}
          <div className="order-confirm-step order-confirm-fade-in-delay-2 sm:col-span-2 lg:col-span-1">
            <div className="step-card group relative rounded-2xl border border-border/60 bg-card/50 dark:bg-card/30 p-6 cursor-default overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/0 to-green-500/0 group-hover:from-emerald-500/5 group-hover:to-green-500/5 transition-all duration-300" />
              <div className="relative">
                <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-green-600 text-white shadow-lg shadow-emerald-500/25 group-hover:shadow-emerald-500/40 transition-shadow duration-300">
                  <MapPin className="step-icon h-6 w-6" aria-hidden />
                </div>
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-emerald-500 dark:text-emerald-400">Step 3</span>
                  <div className="h-px flex-1 bg-gradient-to-r from-emerald-500/30 to-transparent" />
                </div>
                <p className="font-bold text-base text-foreground mb-2">Delivery</p>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Estimated delivery within 3–5 business days in Nepal. See our{" "}
                  <Link href="/shipping" className="underline font-semibold text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 dark:hover:text-emerald-300 transition-colors">
                    shipping policy
                  </Link>
                  .
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div id="order-confirmation-export" className="order-confirmation-bill relative overflow-hidden rounded-2xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-black dark:text-zinc-100 shadow-[0_30px_80px_-35px_rgba(0,0,0,0.45)] dark:shadow-[0_30px_80px_-35px_rgba(0,0,0,0.6)]">
        {(order.paymentMethod === "esewa" || order.paymentMethod === "khalti" || order.paymentMethod === "fonepay") && order.paymentVerified !== "verified" && (
          <div className="no-print rounded-none border-b border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/50 px-6 py-5">
            <div className="flex gap-3">
              <Check className="h-5 w-5 shrink-0 text-amber-600 dark:text-amber-400 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-amber-800 dark:text-amber-300">Payment Proof Under Review</p>
                <p className="text-xs text-amber-700 dark:text-amber-400 mt-1">
                  Thank you for uploading your payment proof. Our team will review it and contact you very soon. Your order is being processed in the meantime.
                </p>
              </div>
            </div>
          </div>
        )}
        <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-emerald-600 via-emerald-400 to-emerald-600" />
        <div className="p-6 md:p-10">
          <div className="flex items-center justify-between border-b border-zinc-200 dark:border-zinc-700 pb-6">
            <div className="flex items-center gap-4">
              <img src="/images/newproductpagelogo.png" alt="RARE.NP" className="h-11 w-11 object-contain" />
              <div>
                <p className="text-xl font-black tracking-tight text-black dark:text-white">RARE.NP</p>
                <p className="text-xs uppercase tracking-[0.2em] text-zinc-500 dark:text-zinc-400">Official Bill Preview</p>
              </div>
            </div>
            <div className="text-right text-sm">
              <p className="font-semibold text-black dark:text-white">Order ID: {order.id}</p>
              <p className="text-zinc-500 dark:text-zinc-400">{orderDateLabel}</p>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2 py-6 border-b border-zinc-200 dark:border-zinc-700 text-sm">
            <div>
              <p className="text-xs uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-1">Customer</p>
              <p className="font-semibold text-black dark:text-white">{order.fullName}</p>
              <p className="text-zinc-700 dark:text-zinc-300">{order.email}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-1">Delivery Location</p>
              <p className="font-semibold text-black dark:text-white">{order.deliveryLocation || order.locationCoordinates || "-"}</p>
              {order.deliveryAddress && <p className="text-zinc-700 dark:text-zinc-300">{order.deliveryAddress}</p>}
            </div>
            <div>
              <p className="text-xs uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-1">Delivery</p>
              <p className="text-zinc-700 dark:text-zinc-300">
                {order.deliveryRequired === false
                  ? "Pickup / No delivery required"
                  : order.deliveryProvider
                    ? `Partner: ${order.deliveryProvider}`
                    : "Partner: To be assigned"}
              </p>
              <p className="text-zinc-500 dark:text-zinc-400">Estimated delivery: 3-5 business days</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-1">Payment Method</p>
              <p className="font-semibold text-black dark:text-white">{paymentMethodLabel(order.paymentMethod)}</p>
            </div>
          </div>

          <div className="py-6 border-b border-zinc-200 dark:border-zinc-700 overflow-x-auto">
            <table className="w-full text-sm min-w-[500px]">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wider text-zinc-500 dark:text-zinc-400 border-b border-zinc-200 dark:border-zinc-700">
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
                  const colorMeta = colorLabel !== "-" ? parseOrderColor(colorLabel) : null;
                  return (
                    <tr key={item.id} className="border-b border-zinc-100 dark:border-zinc-800 align-top">
                      <td className="py-3 pr-2">
                        <p className="font-medium text-black dark:text-white">{item.product?.name || "Product"}</p>
                      </td>
                      <td className="py-3 px-2">
                        <span className="inline-flex rounded-full bg-zinc-100 dark:bg-zinc-800 px-2 py-0.5 text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                          {sizeLabel}
                        </span>
                      </td>
                      <td className="py-3 px-2">
                        {colorMeta ? (
                          <span className="inline-flex items-center gap-2 rounded-full bg-zinc-100 dark:bg-zinc-800 px-2 py-0.5 text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                            <span
                              className="h-3.5 w-3.5 rounded-sm border border-black/10"
                              style={{ background: colorMeta.swatch ?? "#d4d4d8" }}
                            />
                            {colorMeta.label}
                          </span>
                        ) : (
                          <span className="inline-flex rounded-full bg-zinc-100 dark:bg-zinc-800 px-2 py-0.5 text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                            -
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-2 text-center text-zinc-700 dark:text-zinc-300">{item.quantity}</td>
                      <td className="py-3 px-2 text-right text-zinc-700 dark:text-zinc-300">{formatPrice(item.unitPrice)}</td>
                      <td className="py-3 pl-2 text-right font-medium text-black dark:text-white">{formatPrice(lineTotal)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="py-6 space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-zinc-600 dark:text-zinc-400">Subtotal</span>
              <span className="text-black dark:text-white">{formatPrice(itemsSubtotal)}</span>
            </div>
            {promoDiscountAmount > 0 && (
              <div className="flex justify-between">
                <span className="text-zinc-600 dark:text-zinc-400">
                  Discount {order.promoCode ? `(${order.promoCode})` : ""}
                </span>
                <span className="text-green-600 dark:text-green-400">-{formatPrice(promoDiscountAmount)}</span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-zinc-600 dark:text-zinc-400">Shipping</span>
              <span className="text-black dark:text-white">{formatPrice(shippingFee)}</span>
            </div>
            <div className="flex justify-between border-t border-zinc-200 dark:border-zinc-700 mt-3 pt-3 text-lg font-black">
              <span className="text-black dark:text-white">Grand Total (NPR)</span>
              <span className="text-black dark:text-white">{formatPrice(order.total)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Help — screen only */}
      <div className="no-print mt-8 rounded-xl border border-dashed border-border bg-muted/20 dark:bg-muted/10 px-4 py-5 md:px-6 md:flex md:items-center md:justify-between md:gap-6">
        <div className="flex gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-background dark:bg-zinc-800 text-muted-foreground">
            <LifeBuoy className="h-5 w-5" aria-hidden />
          </div>
          <div>
            <p className="text-sm font-semibold text-foreground">Need help with your order?</p>
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
        <Button onClick={handleDownloadPdf} disabled={isDownloadingPdf} className="h-11 rounded-none uppercase tracking-widest text-xs">
          <Printer className="h-4 w-4 mr-2" />
          {isDownloadingPdf ? "Preparing PDF" : "Download as PDF"}
        </Button>
        <Button asChild variant="outline" className="h-11 rounded-none uppercase tracking-widest text-xs">
          <Link href="/">Continue Shopping</Link>
        </Button>
      </div>
    </div>
  );
}
