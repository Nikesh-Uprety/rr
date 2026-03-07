import { useState, useRef, useEffect } from "react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { fetchOrderById, uploadPaymentProof } from "@/lib/api";
import { formatPrice } from "@/lib/format";
import { Upload, CheckCircle2, Loader2 } from "lucide-react";

function useQuery() {
  if (typeof window === "undefined") return new URLSearchParams();
  return new URLSearchParams(window.location.search);
}

export default function PaymentProcess() {
  const query = useQuery();
  const orderId = query.get("orderId") ?? "";
  const method = query.get("method") ?? "esewa";
  const { toast } = useToast();
  const [order, setOrder] = useState<Awaited<ReturnType<typeof fetchOrderById>>>(null);
  const [uploading, setUploading] = useState(false);
  const [uploaded, setUploaded] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!orderId) return;
    fetchOrderById(orderId).then(setOrder);
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

  if (!order) {
    return (
      <div className="container mx-auto px-4 py-32 text-center">
        <Loader2 className="w-10 h-10 animate-spin mx-auto text-muted-foreground" />
        <p className="mt-4 text-muted-foreground">Loading order...</p>
      </div>
    );
  }

  const title =
    method === "esewa"
      ? "Pay with eSewa"
      : method === "khalti"
        ? "Pay with Khalti"
        : "Bank Transfer";

  // Use provided eSewa QR for esewa; placeholder for others (you can add khalti/bank QR images later)
  const qrImage =
    method === "esewa"
      ? "/esewa-qr.png"
      : method === "khalti"
        ? "/esewa-qr.png"
        : "/esewa-qr.png";

  return (
    <div className="container mx-auto px-4 py-32 max-w-xl mt-10">
      <h1 className="text-2xl font-black uppercase tracking-tighter mb-2">
        {title}
      </h1>
      <p className="text-muted-foreground text-sm mb-8">
        Order total: {formatPrice(Number(order.total))}
      </p>

      <div className="bg-gray-50 border border-gray-200 p-8 flex flex-col items-center mb-8">
        <p className="text-xs uppercase tracking-widest text-muted-foreground mb-4">
          Scan QR code to pay
        </p>
        <div className="w-56 h-56 bg-white rounded-lg flex items-center justify-center overflow-hidden border border-gray-200">
          <img
            src={qrImage}
            alt="Payment QR Code"
            className="w-full h-full object-contain"
          />
        </div>
        {method === "esewa" && (
          <p className="mt-4 text-xs text-muted-foreground text-center">
            eSewa • Nikesh Uprety • 9843010717
          </p>
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
          accept="image/*"
          className="hidden"
          onChange={handleFileChange}
          disabled={uploading || uploaded}
        />
        {uploaded ? (
          <div className="flex items-center gap-3 p-4 border border-green-200 bg-green-50 text-green-800 rounded-none">
            <CheckCircle2 className="w-5 h-5 shrink-0" />
            <span className="text-sm font-medium">Screenshot uploaded. We will verify your payment shortly.</span>
          </div>
        ) : (
          <Button
            type="button"
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
