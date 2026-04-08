import { useMemo, useRef, useState, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { UploadProgress } from "@/components/ui/upload-progress";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import {
  activateAdminPaymentQr,
  deleteAdminImage,
  fetchAdminPaymentQrConfig,
  fetchAdminImagesPage,
  uploadAdminImage,
  type AdminImageAsset,
  type PaymentQrProvider,
} from "@/lib/adminApi";
import { Trash2, Upload, Images as ImagesIcon, Copy, Eye, ChevronLeft, ChevronRight } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Pagination } from "@/components/admin/Pagination";

type ImageCategory =
  | "product"
  | "model"
  | "website"
  | "landing_page"
  | "collection_page"
  | "payment_qr"
  | "our_services";

const CATEGORY_LABELS: Record<ImageCategory, string> = {
  product: "Product images",
  model: "Model images",
  website: "Website assets",
  landing_page: "Landing page",
  collection_page: "Collection page",
  payment_qr: "Payment QR",
  our_services: "Our Services",
};

const PAYMENT_QR_PROVIDER_META: Array<{ key: PaymentQrProvider; label: string }> = [
  { key: "esewa", label: "eSewa" },
  { key: "khalti", label: "Khalti" },
  { key: "fonepay", label: "Fonepay" },
];

const MAX_IMAGE_SIZE_BYTES = 30 * 1024 * 1024;
const MAX_IMAGE_SIZE_LABEL = "30MB";

export default function AdminImagesPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [provider, setProvider] = useState<"local" | "cloudinary" | "tigris">("local");
  const [category, setCategory] = useState<ImageCategory>("product");
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [imagePage, setImagePage] = useState(1);
  const [imagePageSize, setImagePageSize] = useState(60);
  const bulkInputRef = useRef<HTMLInputElement | null>(null);

  type BulkFileStatus = "idle" | "uploading" | "success" | "error" | "skipped";
  type BulkFile = {
    id: string;
    file: File;
    previewUrl: string;
    tooLarge: boolean;
    status: BulkFileStatus;
    error?: string;
    progress: number;
  };

  const [bulkFiles, setBulkFiles] = useState<BulkFile[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [isBulkUploading, setIsBulkUploading] = useState(false);
  const [currentBatchIndex, setCurrentBatchIndex] = useState(0);
  const [totalBatches, setTotalBatches] = useState(0);
  const [completedCount, setCompletedCount] = useState(0);
  const [previewIndex, setPreviewIndex] = useState<number | null>(null);
  const [assetToDelete, setAssetToDelete] = useState<AdminImageAsset | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const swipeStartRef = useRef<{ x: number; y: number } | null>(null);

  const paymentQrConfigQuery = useQuery({
    queryKey: ["admin", "payment-qr", "config"],
    queryFn: fetchAdminPaymentQrConfig,
    enabled: category === "payment_qr",
  });

  const imagesQuery = useQuery<{ data: AdminImageAsset[]; total: number }>({
    queryKey: ["admin", "images", { provider, category, search: debouncedSearch, page: imagePage, limit: imagePageSize }],
    queryFn: () =>
      fetchAdminImagesPage({
        provider,
        category,
        search: debouncedSearch || undefined,
        assetType: "file",
        limit: imagePageSize,
        offset: (imagePage - 1) * imagePageSize,
      }),
  });

  const images = imagesQuery.data?.data ?? [];
  const totalImages = imagesQuery.data?.total ?? 0;
  const paymentQrConfig = paymentQrConfigQuery.data;

  const qrImageProvidersMap = useMemo(() => {
    const map = new Map<string, PaymentQrProvider[]>();
    if (!paymentQrConfig) return map;
    for (const provider of PAYMENT_QR_PROVIDER_META.map((entry) => entry.key)) {
      const url = paymentQrConfig[provider]?.url;
      if (!url) continue;
      const list = map.get(url) ?? [];
      list.push(provider);
      map.set(url, list);
    }
    return map;
  }, [paymentQrConfig]);

  useEffect(() => {
    setImagePage(1);
  }, [provider, category, debouncedSearch, imagePageSize]);

  useEffect(() => {
    const handle = setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => clearTimeout(handle);
  }, [search]);

  const normalizeName = (value: string) =>
    (value.split("/").pop() || value)
      .toLowerCase()
      .replace(/\?.*$/, "")
      .replace(/#[^]*$/, "")
      .replace(/\.[a-z0-9]+$/i, "")
      .replace(/[%_]+/g, " ")
      .replace(/-+/g, " ")
      .replace(/\s+/g, " ")
      .trim();

  const getDisplayName = (value?: string | null) => {
    if (!value) return "untitled";
    const base = value.split("/").pop() || value;
    const decoded = (() => {
      try {
        return decodeURIComponent(base);
      } catch {
        return base;
      }
    })();
    const stripped = decoded.replace(/\?.*$/, "").replace(/#[^]*$/, "");
    const withoutExt = stripped.replace(/\.[a-z0-9]+$/i, "");
    const cleaned = withoutExt
      .replace(/[%_]+/g, " ")
      .replace(/-+/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    return cleaned || withoutExt || stripped;
  };

  const getAbsoluteAssetUrl = (value?: string | null) => {
    if (!value) return "";
    try {
      return new URL(value, window.location.origin).toString();
    } catch {
      return value;
    }
  };

  const sanitizeFilename = (value: string) => {
    const base = value.split("/").pop() || value;
    const decoded = (() => {
      try {
        return decodeURIComponent(base);
      } catch {
        return base;
      }
    })();
    const trimmed = decoded.replace(/\?.*$/, "").replace(/#[^]*$/, "").trim();
    const extMatch = trimmed.match(/\\.[a-z0-9]+$/i);
    const ext = extMatch ? extMatch[0].toLowerCase() : "";
    const body = (ext ? trimmed.slice(0, -ext.length) : trimmed)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
    const safeBody = body || "image";
    return `${safeBody}${ext || ".jpg"}`;
  };

  const filtered = useMemo(() => {
    const q = normalizeName(debouncedSearch.trim());
    const data = images ?? [];
    if (!q) return data;
    return data.filter((img) => normalizeName(img.filename ?? img.url ?? "").includes(q));
  }, [images, debouncedSearch]);

  const previewAsset = previewIndex !== null ? filtered[previewIndex] ?? null : null;
  const imageTotalPages = Math.max(1, Math.ceil(totalImages / imagePageSize));

  const goToPreview = (index: number) => {
    if (filtered.length === 0) return;
    const safeIndex = Math.max(0, Math.min(index, filtered.length - 1));
    setPreviewIndex(safeIndex);
  };

  const goPrev = () => {
    if (filtered.length === 0 || previewIndex === null) return;
    setPreviewIndex((prev) =>
      prev === null ? null : (prev - 1 + filtered.length) % filtered.length,
    );
  };

  const goNext = () => {
    if (filtered.length === 0 || previewIndex === null) return;
    setPreviewIndex((prev) =>
      prev === null ? null : (prev + 1) % filtered.length,
    );
  };

  useEffect(() => {
    setSelectedIds(new Set());
  }, [provider, category, debouncedSearch, imagePage]);

  useEffect(() => {
    if (previewIndex === null) return;
    if (filtered.length === 0) {
      setPreviewIndex(null);
    } else if (previewIndex >= filtered.length) {
      setPreviewIndex(filtered.length - 1);
    }
  }, [filtered.length, previewIndex]);

  useEffect(() => {
    return () => {
      bulkFiles.forEach((bf) => URL.revokeObjectURL(bf.previewUrl));
    };
  }, [bulkFiles]);

  const deleteMutation = useMutation({
    mutationFn: (id: string) => {
      return deleteAdminImage(id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "images"] });
      setAssetToDelete(null);
      setPreviewIndex(null);
      setSelectedIds((prev) => {
        const next = new Set(prev);
        if (assetToDelete?.id) next.delete(assetToDelete.id);
        return next;
      });
      toast({ title: "Image deleted successfully" });
    },
  });

  const bulkDeleteMutation = useMutation({
    mutationFn: async (ids: string[]) => {
      await Promise.all(ids.map((id) => deleteAdminImage(id)));
    },
    onSuccess: (_data, ids) => {
      queryClient.invalidateQueries({ queryKey: ["admin", "images"] });
      setSelectedIds((prev) => {
        const next = new Set(prev);
        ids.forEach((id) => next.delete(id));
        return next;
      });
      toast({ title: `${ids.length} image(s) deleted` });
    },
    onError: (err: any) => {
      toast({ title: "Bulk delete failed", description: err.message, variant: "destructive" });
    },
  });

  const activatePaymentQrMutation = useMutation({
    mutationFn: (input: { provider: PaymentQrProvider; assetId: string }) =>
      activateAdminPaymentQr(input),
    onSuccess: (_data, vars) => {
      queryClient.invalidateQueries({ queryKey: ["admin", "payment-qr", "config"] });
      toast({ title: `${vars.provider.toUpperCase()} QR activated` });
    },
    onError: (err: any) => {
      toast({
        title: "Failed to activate QR image",
        description: err?.message || "Please try again.",
        variant: "destructive",
      });
    },
  });

  function addBulkFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    const next: BulkFile[] = [];
    let oversizedCount = 0;
    Array.from(files).forEach((file) => {
      if (!file.type.startsWith("image/")) return;
      const cleanedName = sanitizeFilename(file.name);
      const normalizedFile = new File([file], cleanedName, {
        type: file.type,
        lastModified: file.lastModified,
      });
      const tooLarge = file.size > MAX_IMAGE_SIZE_BYTES;
      const previewUrl = URL.createObjectURL(normalizedFile);
      if (tooLarge) oversizedCount += 1;
      next.push({
        id: `${cleanedName}-${file.size}-${file.lastModified}-${Math.random().toString(36).slice(2)}`,
        file: normalizedFile,
        previewUrl,
        tooLarge,
        status: tooLarge ? "skipped" : "idle",
        error: tooLarge ? `File exceeds ${MAX_IMAGE_SIZE_LABEL} limit` : undefined,
        progress: 0,
      });
    });
    if (next.length === 0) return;
    setBulkFiles((prev) => [...prev, ...next]);

    if (oversizedCount > 0) {
      toast({
        title: "Large image skipped",
        description: `Files over ${MAX_IMAGE_SIZE_LABEL} are not allowed. Reduce the image size or upload a smaller file.`,
        variant: "warning",
        duration: 2000,
      });
    }
  }

  async function handleBulkUpload() {
    const pending = bulkFiles.filter((f) => !f.tooLarge && (f.status === "idle" || f.status === "error"));
    if (pending.length === 0) return;
    setIsBulkUploading(true);
    setCompletedCount(0);
    let successCount = 0;
    const failedNames: string[] = [];

    const chunkSize = 3;
    const batches: BulkFile[][] = [];
    for (let i = 0; i < pending.length; i += chunkSize) {
      batches.push(pending.slice(i, i + chunkSize));
    }
    setTotalBatches(batches.length);

    for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
      const batch = batches[batchIndex];
      setCurrentBatchIndex(batchIndex + 1);

      await Promise.allSettled(
        batch.map(async (bf) => {
          setBulkFiles((prev) =>
            prev.map((f) =>
              f.id === bf.id
                ? { ...f, status: "uploading", error: undefined, progress: 0 }
                : f,
            ),
          );
          try {
            await uploadAdminImage({
              file: bf.file,
              category,
              provider,
              onProgress: (value) => {
                setBulkFiles((prev) =>
                  prev.map((f) => (f.id === bf.id ? { ...f, progress: value } : f)),
                );
              },
            });
            successCount += 1;
            setBulkFiles((prev) =>
              prev.map((f) => (f.id === bf.id ? { ...f, status: "success", progress: 100 } : f)),
            );
          } catch (err: any) {
            const message =
              err?.message ||
              (bf.file.size > MAX_IMAGE_SIZE_BYTES ? `File exceeds ${MAX_IMAGE_SIZE_LABEL} limit` : "Upload failed");
            failedNames.push(bf.file.name);
            setBulkFiles((prev) =>
              prev.map((f) =>
                f.id === bf.id ? { ...f, status: "error", error: message, progress: 0 } : f,
              ),
            );
          } finally {
            setCompletedCount((c) => c + 1);
          }
        }),
      );
    }

    setIsBulkUploading(false);
    queryClient.invalidateQueries({ queryKey: ["admin", "images"] });

    if (successCount > 0) {
      toast({ title: `${successCount} images uploaded.` });
    }
    if (failedNames.length > 0) {
      toast({
        title: "Some uploads failed",
        description: failedNames.join(", "),
        variant: "destructive",
      });
    }
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="rounded-3xl border border-[#DCE8DB] dark:border-[#2E3B32] bg-gradient-to-br from-[#F6FBF6] via-white to-[#F1F6F1] dark:from-[#0F1712] dark:via-[#111A15] dark:to-[#0C140F] p-6 sm:p-8 shadow-[0_18px_40px_rgba(34,63,41,0.14)] dark:shadow-[0_24px_50px_rgba(0,0,0,0.4)]">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
          <div>
            <div className="flex items-center gap-3">
              <ImagesIcon className="h-7 w-7 text-[#2C3E2D] dark:text-[#D7E6D9]" />
              <h1 className="text-3xl font-serif font-medium text-[#2C3E2D] dark:text-foreground">Images</h1>
              <span className="rounded-full bg-[#223C2A] px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.35em] text-white shadow-sm">
                New
              </span>
            </div>
            <p className="text-muted-foreground mt-2 max-w-2xl">
              Central library for product, model, website, and payment QR assets.
            </p>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="rounded-2xl border border-[#D6E2D6] dark:border-[#2C3A30] bg-white/80 dark:bg-card/70 px-3 py-2">
              <p className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground">Total</p>
              <p className="text-lg font-semibold text-[#1E2F22] dark:text-foreground">{totalImages}</p>
            </div>
            <div className="rounded-2xl border border-[#D6E2D6] dark:border-[#2C3A30] bg-white/80 dark:bg-card/70 px-3 py-2">
              <p className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground">Selected</p>
              <p className="text-lg font-semibold text-[#1E2F22] dark:text-foreground">{selectedIds.size}</p>
            </div>
            <div className="rounded-2xl border border-[#D6E2D6] dark:border-[#2C3A30] bg-white/80 dark:bg-card/70 px-3 py-2">
              <p className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground">Provider</p>
              <p className="text-sm font-semibold capitalize text-[#1E2F22] dark:text-foreground">{provider}</p>
            </div>
            <div className="rounded-2xl border border-[#D6E2D6] dark:border-[#2C3A30] bg-white/80 dark:bg-card/70 px-3 py-2">
              <p className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground">Category</p>
              <p className="text-sm font-semibold text-[#1E2F22] dark:text-foreground">
                {CATEGORY_LABELS[category]}
              </p>
            </div>
          </div>
        </div>
      </div>

      <section className="bg-white/90 dark:bg-card rounded-2xl border border-[#E5E5E0] dark:border-border p-6 space-y-5 shadow-[0_12px_30px_rgba(34,63,41,0.08)] dark:shadow-[0_14px_30px_rgba(0,0,0,0.35)]">
        <div className="flex flex-col lg:flex-row lg:items-center gap-3 justify-between">
          <div className="flex flex-wrap items-center gap-2">
            <div className="inline-flex items-center gap-1 rounded-full bg-muted p-1">
              {(["cloudinary", "tigris", "local"] as const).map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setProvider(p)}
                  className={cn(
                    "px-3 py-1.5 text-xs font-medium rounded-full transition-colors",
                    provider === p
                      ? "bg-background text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {p === "cloudinary" ? "Cloudinary" : p === "tigris" ? "Tigris" : "Local"}
                </button>
              ))}
            </div>

            <select
              value={category}
              onChange={(e) => setCategory(e.target.value as ImageCategory)}
              className="h-9 rounded-lg border border-muted bg-background px-3 text-sm"
            >
              {Object.entries(CATEGORY_LABELS).map(([key, label]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-col sm:flex-row gap-2">
            <Input
              placeholder="Search by filename…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-9"
            />
            <input
              ref={bulkInputRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={(e) => {
                addBulkFiles(e.target.files);
                e.currentTarget.value = "";
              }}
            />
            <Button
              type="button"
              variant="outline"
              className="h-9 min-w-[160px] px-5"
              onClick={() => bulkInputRef.current?.click()}
            >
              <Upload className="h-4 w-4 mr-2" />
              Upload Multiple
            </Button>
            <Button
              type="button"
              variant="destructive"
              className="h-9 min-w-[170px] px-5 transition-transform active:scale-[0.98]"
              disabled={selectedIds.size === 0 || bulkDeleteMutation.isPending}
              loading={bulkDeleteMutation.isPending}
              loadingText="Deleting..."
              onClick={() => {
                if (selectedIds.size === 0) return;
                const ids = Array.from(selectedIds);
                if (!window.confirm(`Delete ${ids.length} image(s)? This cannot be undone.`)) return;
                bulkDeleteMutation.mutate(ids);
              }}
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Delete Selected
            </Button>
          </div>
        </div>

        {category === "payment_qr" && (
          <div className="rounded-xl border border-border bg-muted/30 p-3">
            <p className="text-[11px] font-black uppercase tracking-[0.22em] text-muted-foreground mb-2">
              Active QR by Provider
            </p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {PAYMENT_QR_PROVIDER_META.map((provider) => {
                const active = paymentQrConfig?.[provider.key];
                return (
                  <div key={provider.key} className="rounded-lg border border-border bg-background p-2 flex items-center gap-3">
                    {active?.url ? (
                      <img src={active.url} alt={`${provider.label} active QR`} className="h-12 w-12 rounded object-cover border border-border" />
                    ) : (
                      <div className="h-12 w-12 rounded border border-border bg-muted" />
                    )}
                    <div className="min-w-0">
                      <p className="text-xs font-semibold">{provider.label}</p>
                      <p className="text-[10px] text-muted-foreground truncate">{active?.url ?? "No active QR"}</p>
                    </div>
                  </div>
                );
              })}
            </div>
            <p className="mt-2 text-[10px] text-muted-foreground">
              Upload QR images here, then click provider buttons on any image card to activate for checkout.
            </p>
          </div>
        )}

        {/* Bulk upload drop zone + preview */}
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragging(true);
          }}
          onDragLeave={(e) => {
            e.preventDefault();
            setIsDragging(false);
          }}
          onDrop={(e) => {
            e.preventDefault();
            setIsDragging(false);
            addBulkFiles(e.dataTransfer.files);
          }}
          className={cn(
            "mt-3 border-2 border-dashed rounded-2xl p-6 flex flex-col gap-3 items-center justify-center text-center transition-all",
            isDragging
              ? "border-primary bg-primary/5"
              : "border-border hover:border-primary/60 hover:bg-gradient-to-br hover:from-white hover:to-[#F3F7F1] dark:hover:from-[#121A15] dark:hover:to-[#0F1511]",
          )}
        >
          <p className="text-xs font-black uppercase tracking-[0.25em] text-muted-foreground">
            Drag & drop images here
          </p>
          <p className="text-[10px] text-muted-foreground">
            Max {MAX_IMAGE_SIZE_LABEL} per image. Accepted formats: JPG, JPEG, PNG, WEBP.
          </p>
          {bulkFiles.length > 0 && (
            <div className="w-full mt-3 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <p className="text-[11px] text-muted-foreground">
                  {bulkFiles.length} file(s) selected
                </p>
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-8 text-[10px] font-black uppercase tracking-[0.25em]"
                    onClick={() => setBulkFiles([])}
                    disabled={isBulkUploading}
                  >
                    Clear
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    className="h-8 text-[10px] font-black uppercase tracking-[0.25em]"
                    onClick={handleBulkUpload}
                    disabled={
                      isBulkUploading ||
                      bulkFiles.every((f) => f.tooLarge || f.status === "success")
                    }
                  >
                    {isBulkUploading ? "Uploading…" : "Upload All"}
                  </Button>
                </div>
              </div>

              {isBulkUploading && totalBatches > 0 && (
                <div className="space-y-1">
                  <p className="text-[11px] text-muted-foreground">
                    Uploading batch {currentBatchIndex} of {totalBatches}…
                  </p>
                  <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full bg-primary transition-all duration-300"
                      style={{
                        width: `${Math.min(
                          100,
                          (completedCount / Math.max(1, bulkFiles.length)) * 100,
                        )}%`,
                      }}
                    />
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                {bulkFiles.map((bf) => (
                  <div
                    key={bf.id}
                    className="border border-border rounded-xl overflow-hidden bg-background flex flex-col"
                  >
                    <div className="aspect-square bg-muted">
                      <img
                        src={bf.previewUrl}
                        alt={bf.file.name}
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <div className="p-2 space-y-1">
                      <p className="text-[10px] font-medium truncate">
                        {bf.file.name}
                      </p>
                      <p className="text-[10px] text-muted-foreground">
                        {(bf.file.size / 1024 / 1024).toFixed(2)} MB
                      </p>
                      {(bf.status === "uploading" || bf.status === "success") && (
                        <UploadProgress
                          value={bf.progress}
                          label="Upload progress"
                          className="max-w-none"
                        />
                      )}
                      {bf.tooLarge && (
                        <p className="text-[10px] text-red-500">
                          Exceeds {MAX_IMAGE_SIZE_LABEL} — will be skipped
                        </p>
                      )}
                      <p className="text-[10px]">
                        {bf.status === "idle" && "Waiting"}
                        {bf.status === "uploading" && "Uploading…"}
                        {bf.status === "success" && "Done ✓"}
                        {bf.status === "error" && (
                          <span className="text-red-500">
                            Failed ✗ {bf.error ? `— ${bf.error}` : ""}
                          </span>
                        )}
                        {bf.status === "skipped" && "Skipped"}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {imagesQuery.isLoading ? (
          <div className="py-12 text-center text-sm text-muted-foreground">
            Loading images…
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-12 text-center text-sm text-muted-foreground">
            No images found in this category.
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-6 gap-3">
            {filtered.map((item: AdminImageAsset, index) => {
              const id = item.id;
              const url = item.url ?? "";
              const absoluteUrl = getAbsoluteAssetUrl(url);
              const displayName = getDisplayName(item.filename ?? url);
              const isSelected = selectedIds.has(id);

              return (
                <div
                  key={id}
                  className={cn(
                    "group relative rounded-2xl border bg-white dark:bg-card overflow-hidden shadow-sm transition-shadow hover:shadow-xl",
                    isSelected ? "border-primary ring-2 ring-primary/40" : "border-muted/40",
                  )}
                >
                  <div
                    className="relative aspect-square cursor-pointer"
                    role="button"
                    tabIndex={0}
                    onClick={() => goToPreview(index)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        goToPreview(index);
                      }
                    }}
                  >
                    <img
                      src={url}
                      alt={displayName ?? ""}
                      className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                      loading="lazy"
                    />
                    <div className="absolute inset-x-0 bottom-0 p-2 bg-gradient-to-t from-black/70 to-transparent opacity-0 group-hover:opacity-100 transition-opacity">
                      <p className="text-[10px] text-white truncate" title={displayName}>
                        {displayName}
                      </p>
                    </div>

                    <label className="absolute top-2 left-2 inline-flex items-center justify-center rounded-full bg-black/60 text-white h-7 w-7">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => {
                          setSelectedIds((prev) => {
                            const next = new Set(prev);
                            if (next.has(id)) next.delete(id);
                            else next.add(id);
                            return next;
                          });
                        }}
                        onClick={(e) => e.stopPropagation()}
                        className="h-4 w-4 accent-primary"
                        aria-label={`Select ${displayName}`}
                      />
                    </label>
                  </div>
                  <div className="px-2 py-2 bg-background">
                    <p className="text-[10px] text-foreground truncate" title={displayName}>
                      {displayName}
                    </p>
                    {category === "payment_qr" && (
                      <div className="mt-2 flex flex-wrap gap-1">
                        {PAYMENT_QR_PROVIDER_META.map((provider) => {
                          const linkedProviders = item.url ? (qrImageProvidersMap.get(item.url) ?? []) : [];
                          const isActiveForProvider = linkedProviders.includes(provider.key);
                          return (
                            <button
                              key={`${item.id}-${provider.key}`}
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                activatePaymentQrMutation.mutate({ provider: provider.key, assetId: item.id });
                              }}
                              disabled={activatePaymentQrMutation.isPending}
                              className={cn(
                                "rounded px-2 py-1 text-[10px] font-semibold border transition-colors",
                                isActiveForProvider
                                  ? "bg-primary text-primary-foreground border-primary"
                                  : "bg-background border-border hover:border-primary/60",
                              )}
                            >
                              {provider.label}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  <div className="absolute top-2 right-2 flex flex-col gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        goToPreview(index);
                      }}
                      className="h-8 w-8 rounded-full bg-black/60 text-white flex items-center justify-center hover:bg-black/80"
                      aria-label="Preview image"
                    >
                      <Eye className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        navigator.clipboard.writeText(absoluteUrl);
                        toast({ title: "URL copied to clipboard" });
                      }}
                      className="h-8 w-8 rounded-full bg-black/60 text-white flex items-center justify-center hover:bg-black/80"
                      aria-label="Copy URL"
                    >
                      <Copy className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setAssetToDelete(item);
                      }}
                      disabled={deleteMutation.isPending}
                      className="h-8 w-8 rounded-full bg-red-500/80 text-white flex items-center justify-center hover:bg-red-600"
                      aria-label="Delete image"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
            )})}
          </div>
        )}
      </section>

      <div className="bg-white dark:bg-card rounded-xl border border-border overflow-hidden shadow-sm">
        <Pagination
          currentPage={imagePage}
          totalPages={imageTotalPages}
          onPageChange={(page) => {
            setImagePage(page);
            setPreviewIndex(null);
          }}
          totalItems={totalImages}
          pageSize={imagePageSize}
          onPageSizeChange={setImagePageSize}
        />
      </div>

      <Dialog open={previewIndex !== null} onOpenChange={(open) => !open && setPreviewIndex(null)}>
        <DialogContent className="max-w-4xl overflow-hidden p-0">
          {previewAsset ? (
            <div className="grid lg:grid-cols-[minmax(0,1fr)_320px]">
              <div
                className="relative flex min-h-[420px] items-center justify-center bg-black p-6"
                onTouchStart={(e) => {
                  const touch = e.touches[0];
                  if (!touch) return;
                  swipeStartRef.current = { x: touch.clientX, y: touch.clientY };
                }}
                onTouchEnd={(e) => {
                  const start = swipeStartRef.current;
                  swipeStartRef.current = null;
                  const touch = e.changedTouches[0];
                  if (!start || !touch) return;
                  const dx = touch.clientX - start.x;
                  const dy = touch.clientY - start.y;
                  if (Math.abs(dx) < 50 || Math.abs(dx) < Math.abs(dy)) return;
                  if (dx > 0) goPrev();
                  else goNext();
                }}
              >
                <button
                  type="button"
                  onClick={goPrev}
                  className="absolute left-4 top-1/2 -translate-y-1/2 h-10 w-10 rounded-full bg-black/50 text-white flex items-center justify-center hover:bg-black/70 transition-colors"
                  aria-label="Previous image"
                >
                  <ChevronLeft className="h-5 w-5" />
                </button>
                <img
                  src={previewAsset.url ?? undefined}
                  alt={previewAsset.filename ?? "Preview"}
                  className="max-h-[75vh] w-auto max-w-full rounded-xl object-contain"
                />
                <button
                  type="button"
                  onClick={goNext}
                  className="absolute right-4 top-1/2 -translate-y-1/2 h-10 w-10 rounded-full bg-black/50 text-white flex items-center justify-center hover:bg-black/70 transition-colors"
                  aria-label="Next image"
                >
                  <ChevronRight className="h-5 w-5" />
                </button>
              </div>
              <div className="space-y-5 p-6">
                <DialogHeader>
                  <DialogTitle>{getDisplayName(previewAsset.filename ?? previewAsset.url)}</DialogTitle>
                  <DialogDescription>
                    Review the uploaded asset, copy its URL, or remove it from the media library.
                  </DialogDescription>
                </DialogHeader>

                <div className="space-y-3 rounded-2xl border border-border bg-muted/20 p-4 text-sm">
                  <div>
                    <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Provider</div>
                    <div className="mt-1 font-medium capitalize">{previewAsset.provider}</div>
                  </div>
                  <div>
                    <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Category</div>
                    <div className="mt-1 font-medium">{CATEGORY_LABELS[previewAsset.category as ImageCategory] ?? previewAsset.category}</div>
                  </div>
                  <div>
                    <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">URL</div>
                    <div className="mt-1 break-all text-xs">{getAbsoluteAssetUrl(previewAsset.url)}</div>
                  </div>
                </div>

                <DialogFooter className="flex-col gap-2 sm:flex-col">
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full"
                    onClick={() => {
                      navigator.clipboard.writeText(getAbsoluteAssetUrl(previewAsset.url));
                      toast({ title: "URL copied to clipboard" });
                    }}
                  >
                    <Copy className="mr-2 h-4 w-4" />
                    Copy URL
                  </Button>
                  <Button
                    type="button"
                    variant="destructive"
                    className="w-full"
                    onClick={() => setAssetToDelete(previewAsset)}
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    Delete Image
                  </Button>
                </DialogFooter>
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>

      <Dialog open={!!assetToDelete} onOpenChange={(open) => !open && setAssetToDelete(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Delete Image</DialogTitle>
            <DialogDescription>
              This will remove the image from the admin media library.
            </DialogDescription>
          </DialogHeader>
          {assetToDelete ? (
            <div className="space-y-4 py-2">
              <div className="overflow-hidden rounded-2xl border border-border bg-muted/20">
                <img
                  src={assetToDelete.url ?? undefined}
                  alt={assetToDelete.filename ?? "Delete image"}
                  className="h-48 w-full object-cover"
                />
              </div>
              <div className="rounded-2xl border border-border bg-muted/10 px-4 py-3 text-sm">
                <p className="font-medium">{getDisplayName(assetToDelete.filename ?? assetToDelete.url)}</p>
                <p className="mt-1 text-xs text-muted-foreground capitalize">
                  {assetToDelete.provider} • {CATEGORY_LABELS[assetToDelete.category as ImageCategory] ?? assetToDelete.category}
                </p>
              </div>
            </div>
          ) : null}
          <DialogFooter>
            <Button variant="outline" onClick={() => setAssetToDelete(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              loading={deleteMutation.isPending}
              loadingText="Deleting..."
              onClick={() => {
                if (assetToDelete) deleteMutation.mutate(assetToDelete.id);
              }}
            >
              Delete Image
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

