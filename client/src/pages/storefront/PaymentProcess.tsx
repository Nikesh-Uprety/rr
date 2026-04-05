import { useState, useRef, useEffect } from "react";
import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import {
  fetchOrderById,
  fetchPaymentQrConfig,
  getCachedLatestOrder,
  uploadPaymentProof,
} from "@/lib/api";
import { formatPrice } from "@/lib/format";
import { Upload, CheckCircle2, Loader2 } from "lucide-react";
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

export default function PaymentProcess() {
  const query = useSearchQuery();
  const orderId = query.get("orderId") ?? "";
  const method = query.get("method") ?? "esewa";
  const { toast } = useToast();
  const [order, setOrder] = useState<Awaited<ReturnType<typeof fetchOrderById>>>(() => getCachedLatestOrder(orderId));
  const [isResolved, setIsResolved] = useState(() => !!getCachedLatestOrder(orderId));
  const [uploading, setUploading] = useState(false);
  const [uploaded, setUploaded] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const paymentQrQuery = useQuery({
    queryKey: ["storefront", "payment-qr"],
    queryFn: fetchPaymentQrConfig,
    staleTime: 30_000,
  });

  useEffect(() => {
    if (!orderId) return;
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
  }, [orderId]);

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

  if (!orderId) {
    return (
      <div className="container mx-auto px-4 py-32 text-center">
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
      <div className="container mx-auto px-4 py-32 text-center">
        <p className="text-muted-foreground">We could not load this order.</p>
        <Button asChild className="mt-6 rounded-none">
          <Link href="/cart">Back to Cart</Link>
        </Button>
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

  return (
    <div className="container mx-auto px-4 py-32 max-w-xl mt-10">
      <h1 className="text-2xl font-black uppercase tracking-tighter mb-2">
        {title}
      </h1>
      <p className="text-muted-foreground text-sm mb-8">
        Order total: {formatPrice(Number(order.total))}
      </p>

      <div className="bg-gray-50 border border-gray-200 p-8 flex flex-col items-center mb-8">
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
            <div className="w-56 h-56 bg-white rounded-lg flex items-center justify-center overflow-hidden border border-gray-200 p-2">
              <img
                src={resolvedQrImageSrc}
                alt={`${paymentLabel} QR Code`}
                className="w-full h-full object-contain"
              />
            </div>
            <p className="mt-4 text-xs text-muted-foreground text-center">
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
              <span className="text-sm font-medium">Screenshot uploaded. We will verify your payment shortly.</span>
            </div>
            <Button asChild className="w-full h-14 bg-black text-white rounded-none uppercase tracking-widest text-xs font-bold">
              <Link href={`/order-confirmation/${orderId}`}>View Order Summary</Link>
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

      <div className="mt-12 pt-8 border-t border-gray-100">
        <Button asChild variant="outline" className="rounded-none">
          <Link href="/">Back to Home</Link>
        </Button>
      </div>
    </div>
  );
}
