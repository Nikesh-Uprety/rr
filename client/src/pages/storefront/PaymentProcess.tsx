import { useState, useRef, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { AnimatePresence, motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import {
  fetchOrderById,
  fetchPaymentQrConfig,
  getCachedLatestOrder,
  uploadPaymentProof,
  updateOrderPaymentMethod,
  createCheckoutSession,
  simulateStripePaymentSuccess,
} from "@/lib/api";
import { formatPrice } from "@/lib/format";
import {
  Upload,
  CheckCircle2,
  Loader2,
  CreditCard,
  ExternalLink,
  AlertCircle,
  X,
  ZoomIn,
  Download,
} from "lucide-react";
import { BrandedLoader } from "@/components/ui/BrandedLoader";

function useSearchQuery() {
  if (typeof window === "undefined") return new URLSearchParams();
  return new URLSearchParams(window.location.search);
}

const FALLBACK_PAYMENT_QR = {
  esewa: "/images/esewa-qr.webp",
  khalti:
    "https://blog.khalti.com/wp-content/uploads/2023/03/MPQRCode-HYLEbgp9z64hDoqP9L8ZyQ-pdf.jpg",
  fonepay:
    "https://cdn11.bigcommerce.com/s-tgrcca6nho/images/stencil/original/products/65305/136311/Quick-Scan-Pay-Stand-Scan1_136310__37301.1758003923.jpg",
} as const;

const PAYMENT_METHOD_SWITCH_OPTIONS = [
  { id: "esewa", label: "eSewa" },
  { id: "khalti", label: "Khalti" },
  { id: "fonepay", label: "Fonepay" },
  { id: "stripe", label: "Card" },
] as const;

export default function PaymentProcess() {
  const query = useSearchQuery();
  const [, setLocation] = useLocation();
  const orderId = query.get("orderId") ?? "";
  const method = query.get("method") ?? "esewa";
  const stripeStatus = query.get("stripe_status");
  const { toast } = useToast();
  const [order, setOrder] = useState<Awaited<ReturnType<typeof fetchOrderById>>>(() => getCachedLatestOrder(orderId));
  const [isResolved, setIsResolved] = useState(() => !!getCachedLatestOrder(orderId));
  const [uploading, setUploading] = useState(false);
  const [uploaded, setUploaded] = useState(false);
  const [redirectingToStripe, setRedirectingToStripe] = useState(false);
  const [simulatingPayment, setSimulatingPayment] = useState(false);
  const [downloadingQr, setDownloadingQr] = useState(false);
  const [switchingPaymentMethod, setSwitchingPaymentMethod] = useState<string | null>(null);
  const [qrPreviewOpen, setQrPreviewOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const isLocalTesting =
    typeof window !== "undefined" &&
    (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1");
  const paymentQrQuery = useQuery({
    queryKey: ["storefront", "payment-qr"],
    queryFn: fetchPaymentQrConfig,
    staleTime: 30_000,
  });

  useEffect(() => {
    if (!orderId) return;

    if (stripeStatus === "success") {
      toast({ title: "Payment confirmed! Redirecting to your order..." });
      setTimeout(() => {
        setLocation(`/order-confirmation/${orderId}`);
      }, 1500);
      return;
    }

    if (stripeStatus === "cancelled") {
      toast({ title: "Payment was cancelled. You can try again below.", variant: "destructive" });
    }

    const cached = getCachedLatestOrder(orderId);
    if (cached) {
      setOrder(cached);
      setIsResolved(true);
      return;
    }

    let cancelled = false;

    fetchOrderById(orderId)
      .then((fetched) => {
        if (cancelled) return;
        setOrder(fetched ?? getCachedLatestOrder(orderId));
      })
      .finally(() => {
        if (cancelled) return;
        setIsResolved(true);
      });

    return () => {
      cancelled = true;
    };
  }, [orderId, stripeStatus, toast, setLocation]);

  const MAX_FILE_SIZE_MB = 5;
  const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !orderId) return;
    if (!file.type.startsWith("image/")) {
      toast({ title: "Please upload an image file (PNG, JPG)", variant: "destructive" });
      return;
    }
    if (file.size > MAX_FILE_SIZE_BYTES) {
      toast({
        title: `File too large. Maximum size is ${MAX_FILE_SIZE_MB} MB. Please use a smaller image.`,
        variant: "destructive",
      });
      e.target.value = "";
      return;
    }
    setUploading(true);
    try {
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
      const result = await uploadPaymentProof(orderId, base64);
      if (result.success) {
        setUploaded(true);
        toast({ title: "Payment screenshot uploaded. We will verify shortly." });
        setTimeout(() => {
          setLocation(`/order-confirmation/${orderId}`);
        }, 2000);
      } else {
        toast({ title: result.error || "Upload failed", variant: "destructive" });
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "";
      const isTooLarge = message.startsWith("413");
      toast({
        title: isTooLarge
          ? `File too large. Maximum size is ${MAX_FILE_SIZE_MB} MB. Please use a smaller image.`
          : "Upload failed. Please try again.",
        variant: "destructive",
      });
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  };

  const handleStripeCheckout = async () => {
    if (!orderId) return;

    if (isLocalTesting) {
      setSimulatingPayment(true);
      try {
        const result = await simulateStripePaymentSuccess(orderId);
        if (result.success) {
          toast({ title: "Test payment completed. Redirecting to your order..." });
          setTimeout(() => {
            setLocation(`/order-confirmation/${orderId}`);
          }, 1200);
        } else {
          toast({ title: result.error || "Test payment failed", variant: "destructive" });
        }
      } catch {
        toast({ title: "Failed to simulate test payment", variant: "destructive" });
      } finally {
        setSimulatingPayment(false);
      }
      return;
    }

    setRedirectingToStripe(true);
    try {
      const result = await createCheckoutSession(orderId);
      if (result.success && result.data?.checkoutUrl) {
        window.location.href = result.data.checkoutUrl;
      } else {
        toast({ title: result.error || "Failed to start checkout", variant: "destructive" });
        setRedirectingToStripe(false);
      }
    } catch (err) {
      toast({ title: "Failed to connect to Stripe. Please try again.", variant: "destructive" });
      setRedirectingToStripe(false);
    }
  };

  const handleChangePaymentMethod = async (
    nextMethod: "esewa" | "khalti" | "fonepay" | "stripe",
  ) => {
    if (!orderId || nextMethod === method) return;

    setSwitchingPaymentMethod(nextMethod);
    try {
      const result = await updateOrderPaymentMethod(orderId, nextMethod);
      if (!result.success) {
        toast({ title: result.error || "Failed to change payment method", variant: "destructive" });
        return;
      }

      const nextLabel =
        PAYMENT_METHOD_SWITCH_OPTIONS.find((option) => option.id === nextMethod)?.label ??
        nextMethod;
      toast({ title: `Payment method changed to ${nextLabel}` });
      setLocation(`/checkout/payment?orderId=${orderId}&method=${nextMethod}`);
    } catch {
      toast({ title: "Failed to change payment method", variant: "destructive" });
    } finally {
      setSwitchingPaymentMethod(null);
    }
  };

  if (!orderId) {
    return (
      <div className="container mx-auto px-4 py-12 text-center sm:py-16">
        <p className="text-muted-foreground">Invalid payment link.</p>
        <Button asChild className="mt-6 rounded-none">
          <Link href="/cart">Back to Cart</Link>
        </Button>
      </div>
    );
  }

  if (!isResolved && !order) {
    return (
      <div className="min-h-[80vh] flex items-center justify-center">
        <BrandedLoader />
      </div>
    );
  }

  if (!order) {
    return (
      <div className="container mx-auto px-4 py-12 text-center sm:py-16">
        <p className="text-muted-foreground">We could not load this order.</p>
        <Button asChild className="mt-6 rounded-none">
          <Link href="/cart">Back to Cart</Link>
        </Button>
      </div>
    );
  }

  if (method === "stripe") {
    return (
      <div className="container mx-auto max-w-3xl px-4 pb-12 pt-4 sm:pb-16 sm:pt-6">
        <div className="mb-6 space-y-2">
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">
            Change Payment Method
          </p>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {PAYMENT_METHOD_SWITCH_OPTIONS.filter((option) => option.id !== "stripe").map((option) => (
              <Button
                key={option.id}
                type="button"
                variant="outline"
                className="h-11 rounded-none text-[11px] uppercase tracking-widest"
                disabled={switchingPaymentMethod !== null}
                onClick={() => handleChangePaymentMethod(option.id)}
              >
                {switchingPaymentMethod === option.id ? "Switching..." : option.label}
              </Button>
            ))}
          </div>
        </div>
        <h1 className="text-2xl font-black uppercase tracking-tighter mb-2">
          Pay by Card
        </h1>
        <p className="mb-8 text-sm text-muted-foreground">
          Order total: {formatPrice(Number(order.total))}
        </p>

        <div className="mb-8 border border-gray-200 bg-gradient-to-br from-slate-50 to-gray-50 p-5 sm:p-8">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-14 h-9 flex items-center justify-center overflow-hidden">
              <img
                src="/images/stripe-logo.svg"
                alt="Stripe"
                className="w-full h-full object-contain"
              />
            </div>
            <div>
              <p className="text-sm font-bold uppercase tracking-wider text-gray-900">Secure Card Payment</p>
              <p className="text-xs text-muted-foreground">Powered by Stripe</p>
            </div>
          </div>

          <div className="mb-4 border border-gray-200 bg-white p-5 sm:p-6">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs uppercase tracking-widest text-muted-foreground font-bold">Amount</span>
              <span className="text-lg font-black">{formatPrice(Number(order.total))}</span>
            </div>
            <p className="text-xs text-muted-foreground">
              You will be charged in USD at the current exchange rate.
            </p>
          </div>

          <div className="flex items-start gap-2 p-3 bg-blue-50 border border-blue-200">
            <AlertCircle className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
            <p className="text-xs text-blue-700">
              {isLocalTesting
                ? "Local testing mode: Stripe redirect is skipped and your payment will be marked successful instantly."
                : "You will be redirected to Stripe&apos;s secure checkout page to enter your card details. After payment, you will be redirected back here."}
            </p>
          </div>
        </div>

        <Button
          type="button"
          onClick={handleStripeCheckout}
          disabled={redirectingToStripe || simulatingPayment}
          className="w-full h-14 bg-[#635bff] text-white rounded-none uppercase tracking-widest text-xs font-bold hover:bg-[#4b45c6] transition-colors"
        >
          {redirectingToStripe || simulatingPayment ? (
            <>
              <Loader2 className="w-5 h-5 mr-2 animate-spin" />
              {isLocalTesting ? "Completing test payment..." : "Redirecting to Stripe..."}
            </>
          ) : (
            <>
              <CreditCard className="w-5 h-5 mr-2" />
              {isLocalTesting ? "Complete Test Payment" : "Proceed to Secure Checkout"}
              {!isLocalTesting && <ExternalLink className="w-4 h-4 ml-2" />}
            </>
          )}
        </Button>

        <div className="mt-8 grid gap-2 border-t border-gray-100 pt-6 sm:grid-cols-2">
          <Button asChild variant="outline" className="h-11 rounded-none text-xs">
            <Link href="/checkout?returning=1">← Back to Checkout</Link>
          </Button>
          <Button asChild variant="ghost" className="h-11 rounded-none text-xs text-muted-foreground">
            <Link href={`/order-confirmation/${orderId}`}>← Back to Order</Link>
          </Button>
        </div>
      </div>
    );
  }

  const normalizedMethod =
    method === "esewa" || method === "khalti" || method === "fonepay" || method === "bank"
      ? method
      : "esewa";

  const title =
    normalizedMethod === "esewa"
      ? "Pay with eSewa"
      : normalizedMethod === "khalti"
        ? "Pay with Khalti"
        : normalizedMethod === "fonepay"
          ? "Pay with Fonepay"
          : "Bank Transfer";

  const qrConfig = paymentQrQuery.data;
  const paymentLabel =
    normalizedMethod === "esewa"
      ? "eSewa"
      : normalizedMethod === "khalti"
        ? "Khalti"
        : "Fonepay";

  const qrImageSrc =
    normalizedMethod === "khalti"
      ? qrConfig?.khaltiQrUrl
      : normalizedMethod === "fonepay"
        ? qrConfig?.fonepayQrUrl
        : qrConfig?.esewaQrUrl;
  const resolvedQrImageSrc =
    qrImageSrc ||
    (normalizedMethod === "khalti"
      ? FALLBACK_PAYMENT_QR.khalti
      : normalizedMethod === "fonepay"
        ? FALLBACK_PAYMENT_QR.fonepay
        : FALLBACK_PAYMENT_QR.esewa);
  const handleDownloadQr = async () => {
    setDownloadingQr(true);
    try {
      const response = await fetch(resolvedQrImageSrc, { mode: "cors" });
      if (!response.ok) {
        throw new Error("Download request failed");
      }
      const blob = await response.blob();
      const extension = blob.type.includes("jpeg")
        ? "jpg"
        : blob.type.includes("webp")
          ? "webp"
          : "png";
      const blobUrl = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = blobUrl;
      link.download = `rare-${normalizedMethod}-qr.${extension}`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(blobUrl);
      toast({ title: `${paymentLabel} QR downloaded` });
    } catch {
      const fallbackLink = document.createElement("a");
      fallbackLink.href = resolvedQrImageSrc;
      fallbackLink.target = "_blank";
      fallbackLink.rel = "noopener noreferrer";
      fallbackLink.download = `rare-${normalizedMethod}-qr`;
      document.body.appendChild(fallbackLink);
      fallbackLink.click();
      fallbackLink.remove();
      toast({
        title: "Opened QR image in a new tab. Save it from your browser if download did not start.",
      });
    } finally {
      setDownloadingQr(false);
    }
  };

  return (
    <div className="container mx-auto max-w-3xl px-4 pb-12 pt-4 sm:pb-16 sm:pt-6">
      <h1 className="text-2xl font-black uppercase tracking-tighter mb-2">
        {title}
      </h1>
      <p className="text-muted-foreground text-sm mb-8">
        Order total: {formatPrice(Number(order.total))}
      </p>

      <div className="mb-8 flex flex-col items-center border border-gray-200 bg-gray-50 p-5 sm:p-8">
        {normalizedMethod === "bank" ? (
          <div className="w-full text-center space-y-4">
            <h3 className="font-bold text-lg uppercase tracking-widest text-black">Bank Details</h3>
            <div className="bg-white p-6 border border-gray-200 rounded-none text-left space-y-3">
              <p className="text-sm"><strong className="font-bold uppercase tracking-wide">Bank Name:</strong> Global IME Bank</p>
              <p className="text-sm"><strong className="font-bold uppercase tracking-wide">Account Name:</strong> Nikesh Uprety</p>
              <p className="text-sm"><strong className="font-bold uppercase tracking-wide">Account N.O:</strong> 01234567890123</p>
            </div>
            <p className="mt-4 text-xs text-muted-foreground text-center">
              Please transfer the exact amount and upload the screenshot below.
            </p>
          </div>
        ) : (
          <>
            <div className="flex items-center gap-3 mb-4">
              <div className={`w-10 h-10 flex items-center justify-center overflow-hidden shrink-0 ${
                normalizedMethod === "esewa" ? "rounded-full" : "rounded-none"
              }`}>
                <img 
                  src={resolvedQrImageSrc} 
                  alt={paymentLabel} 
                  className={`w-full h-full object-contain ${
                    normalizedMethod === "esewa" ? "scale-150" : ""
                  }`}
                />
              </div>
              <p className="text-xs uppercase tracking-widest text-muted-foreground">
                Scan QR code to pay with {paymentLabel}
              </p>
            </div>
            <div
              className="group relative h-52 w-52 cursor-pointer overflow-hidden rounded-lg border border-gray-200 bg-white p-2 sm:h-64 sm:w-64"
              onClick={() => setQrPreviewOpen(true)}
            >
              <img
                src={resolvedQrImageSrc}
                alt={`${paymentLabel} QR Code`}
                className="w-full h-full object-contain"
              />
              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors duration-200 flex items-center justify-center">
                <ZoomIn className="w-8 h-8 text-white opacity-0 group-hover:opacity-100 transition-opacity duration-200 drop-shadow-lg" />
              </div>
            </div>
            <p className="mt-2 text-[10px] text-muted-foreground text-center flex items-center justify-center gap-1">
              <ZoomIn className="w-3 h-3" />
              Click to view full size
            </p>
            <div className="mt-4 grid w-full max-w-md gap-2 sm:grid-cols-2">
              <Button
                type="button"
                variant="outline"
                className="h-11 rounded-none text-xs uppercase tracking-widest"
                onClick={() => setQrPreviewOpen(true)}
              >
                <ZoomIn className="mr-2 h-4 w-4" />
                View QR
              </Button>
              <Button
                type="button"
                className="h-11 rounded-none text-xs uppercase tracking-widest"
                onClick={handleDownloadQr}
                disabled={downloadingQr}
              >
                {downloadingQr ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Downloading...
                  </>
                ) : (
                  <>
                    <Download className="mr-2 h-4 w-4" />
                    Download QR
                  </>
                )}
              </Button>
            </div>
            <p className="mt-1 text-xs text-muted-foreground text-center">
              {paymentLabel} • Nikesh Uprety • 9843010717
            </p>
          </>
        )}
      </div>

      <div className="space-y-4">
        <h2 className="text-sm font-bold uppercase tracking-widest">
          Upload payment screenshot
        </h2>
        <p className="text-muted-foreground text-sm">
          After paying, upload a screenshot of your payment confirmation. We will verify and complete your order. Maximum file size: 5 MB.
        </p>
        <input
          ref={fileInputRef}
          type="file"
          data-testid="payment-proof-input"
          accept="image/*"
          className="hidden"
          onChange={handleFileChange}
          disabled={uploading || uploaded}
        />
        {uploaded ? (
          <div className="space-y-4">
            <div className="flex items-center gap-3 p-4 border border-green-200 bg-green-50 text-green-800 rounded-none">
              <CheckCircle2 className="w-5 h-5 shrink-0" />
              <span className="text-sm font-medium">Screenshot uploaded. Click below to confirm and complete your order.</span>
            </div>
            <Button
              onClick={() => setLocation(`/order-confirmation/${orderId}`)}
              className="w-full h-14 bg-black text-white rounded-none uppercase tracking-widest text-xs font-bold"
            >
              <CheckCircle2 className="w-5 h-5 mr-2" />
              Confirm & Complete Order
            </Button>
          </div>
        ) : (
          <Button
            type="button"
            data-testid="payment-proof-trigger"
            variant="outline"
            className="w-full h-14 rounded-none border-2 border-dashed border-gray-300"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
          >
            {uploading ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <>
                <Upload className="w-5 h-5 mr-2" />
                Choose payment screenshot
              </>
            )}
          </Button>
        )}
      </div>

      <div className="mt-12 grid gap-3 border-t border-gray-100 pt-8 sm:grid-cols-[1fr_auto]">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {PAYMENT_METHOD_SWITCH_OPTIONS.filter((option) => option.id !== method).map((option) => (
            <Button
              key={option.id}
              type="button"
              variant="outline"
              className="h-11 rounded-none text-[11px] uppercase tracking-widest"
              disabled={switchingPaymentMethod !== null}
              onClick={() => handleChangePaymentMethod(option.id)}
            >
              {switchingPaymentMethod === option.id ? "Switching..." : option.label}
            </Button>
          ))}
        </div>
        <Button asChild variant="outline" className="h-11 rounded-none">
          <Link href="/checkout?returning=1">← Back to Checkout</Link>
        </Button>
      </div>

      {/* QR Code Full-Screen Preview Modal */}
      <AnimatePresence>
        {qrPreviewOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-[9999] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
            onClick={() => setQrPreviewOpen(false)}
          >
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.8, opacity: 0 }}
              transition={{ duration: 0.3, ease: "easeOut" }}
              className="relative w-full max-w-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                onClick={() => setQrPreviewOpen(false)}
                className="absolute -top-3 -right-3 z-10 h-10 w-10 rounded-full bg-white dark:bg-zinc-900 shadow-lg flex items-center justify-center hover:bg-gray-100 dark:hover:bg-zinc-800 transition-colors"
                aria-label="Close QR preview"
              >
                <X className="w-5 h-5 text-zinc-700 dark:text-zinc-300" />
              </button>
              <div className="overflow-hidden rounded-2xl bg-white p-2 shadow-2xl">
                <div className="aspect-square w-full bg-white">
                  <img
                    src={resolvedQrImageSrc}
                    alt={`${paymentLabel} QR Code Full Size`}
                    className="w-full h-full object-contain"
                  />
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
