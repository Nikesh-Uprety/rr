import { useMemo, useRef, useState, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
  deleteAdminImage,
  fetchAdminImages,
  uploadAdminImage,
  type AdminImageAsset,
} from "@/lib/adminApi";
import { Trash2, Upload, Images as ImagesIcon, Copy, Eye } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

type ImageCategory =
  | "product"
  | "model"
  | "website"
  | "landing_page"
  | "collection_page";

const CATEGORY_LABELS: Record<ImageCategory, string> = {
  product: "Product images",
  model: "Model images",
  website: "Website assets",
  landing_page: "Landing page",
  collection_page: "Collection page",
};

export default function AdminImagesPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [provider, setProvider] = useState<"local" | "cloudinary">("local");
  const [category, setCategory] = useState<ImageCategory>("product");
  const [search, setSearch] = useState("");
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const bulkInputRef = useRef<HTMLInputElement | null>(null);

  type BulkFileStatus = "idle" | "uploading" | "success" | "error" | "skipped";
  type BulkFile = {
    id: string;
    file: File;
    previewUrl: string;
    tooLarge: boolean;
    status: BulkFileStatus;
    error?: string;
  };

  const [bulkFiles, setBulkFiles] = useState<BulkFile[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [isBulkUploading, setIsBulkUploading] = useState(false);
  const [currentBatchIndex, setCurrentBatchIndex] = useState(0);
  const [totalBatches, setTotalBatches] = useState(0);
  const [completedCount, setCompletedCount] = useState(0);
  const [previewAsset, setPreviewAsset] = useState<AdminImageAsset | null>(null);
  const [assetToDelete, setAssetToDelete] = useState<AdminImageAsset | null>(null);

  const imagesQuery = useQuery<AdminImageAsset[]>({
    queryKey: ["admin", "images", { provider, category }],
    queryFn: () => fetchAdminImages({ provider, category, limit: 120 }),
  });

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const data = imagesQuery.data ?? [];
    if (!q) return data;
    return data.filter((img) =>
      (img.filename || img.url).toLowerCase().includes(q),
    );
  }, [imagesQuery.data, search]);

  useEffect(() => {
    return () => {
      bulkFiles.forEach((bf) => URL.revokeObjectURL(bf.previewUrl));
    };
  }, [bulkFiles]);

  const uploadMutation = useMutation({
    mutationFn: async (file: File): Promise<AdminImageAsset> => {
      return uploadAdminImage({ file, category, provider });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "images"] });
      toast({ title: provider === "local" ? "WebP image uploaded successfully" : "Image uploaded to Cloudinary" });
    },
    onError: (err: any) => {
      toast({ title: "Upload failed", description: err.message, variant: "destructive" });
    }
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => {
      return deleteAdminImage(id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "images"] });
      setAssetToDelete(null);
      setPreviewAsset(null);
      toast({ title: "Image deleted successfully" });
    },
  });

  const MAX_SIZE = 5 * 1024 * 1024;

  function addBulkFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    const next: BulkFile[] = [];
    Array.from(files).forEach((file) => {
      if (!file.type.startsWith("image/")) return;
      const tooLarge = file.size > MAX_SIZE;
      const previewUrl = URL.createObjectURL(file);
      next.push({
        id: `${file.name}-${file.size}-${file.lastModified}-${Math.random().toString(36).slice(2)}`,
        file,
        previewUrl,
        tooLarge,
        status: tooLarge ? "skipped" : "idle",
        error: tooLarge ? "File exceeds 5MB limit" : undefined,
      });
    });
    if (next.length === 0) return;
    setBulkFiles((prev) => [...prev, ...next]);
  }

  async function handleBulkUpload() {
    const pending = bulkFiles.filter((f) => !f.tooLarge && (f.status === "idle" || f.status === "error"));
    if (pending.length === 0) return;
    setIsBulkUploading(true);
    setCompletedCount(0);

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
            prev.map((f) => (f.id === bf.id ? { ...f, status: "uploading", error: undefined } : f)),
          );
          try {
            await uploadAdminImage({ file: bf.file, category, provider });
            setBulkFiles((prev) =>
              prev.map((f) => (f.id === bf.id ? { ...f, status: "success" } : f)),
            );
          } catch (err: any) {
            const message =
              err?.message ||
              (bf.file.size > MAX_SIZE ? "File exceeds 5MB limit" : "Upload failed");
            setBulkFiles((prev) =>
              prev.map((f) =>
                f.id === bf.id ? { ...f, status: "error", error: message } : f,
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

    const successCount = bulkFiles.filter((f) => f.status === "success").length;
    const errorFiles = bulkFiles.filter((f) => f.status === "error");

    if (successCount > 0) {
      toast({ title: `${successCount} images uploaded.` });
    }
    if (errorFiles.length > 0) {
      const names = errorFiles.map((f) => f.file.name).join(", ");
      toast({
        title: "Some uploads failed",
        description: names,
        variant: "destructive",
      });
    }
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-serif font-medium text-[#2C3E2D] dark:text-foreground flex items-center gap-3">
            <ImagesIcon className="h-7 w-7" />
            Images
          </h1>
          <p className="text-muted-foreground mt-1">
            Central library for product, model, and website assets.
          </p>
        </div>
      </div>

      <section className="bg-white dark:bg-card rounded-2xl border border-[#E5E5E0] dark:border-border p-6 space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center gap-3 justify-between">
          <div className="flex flex-wrap items-center gap-2">
            <div className="inline-flex items-center gap-1 rounded-full bg-muted p-1">
              {(["cloudinary", "local"] as const).map((p) => (
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
                  {p === "cloudinary" ? "Cloudinary" : "Local"}
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
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) uploadMutation.mutate(file);
                e.currentTarget.value = "";
              }}
            />
            <Button
              type="button"
              className="h-9"
              loading={uploadMutation.isPending}
              loadingText="Uploading…"
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload className="h-4 w-4 mr-2" />
              Upload
            </Button>
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
              className="h-9"
              onClick={() => bulkInputRef.current?.click()}
            >
              <Upload className="h-4 w-4 mr-2" />
              Bulk Upload
            </Button>
          </div>
        </div>

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
            "mt-3 border-2 border-dashed rounded-xl p-4 flex flex-col gap-3 items-center justify-center text-center cursor-pointer transition-colors",
            isDragging
              ? "border-primary bg-primary/5"
              : "border-border hover:border-primary/60 hover:bg-muted/40",
          )}
          onClick={() => bulkInputRef.current?.click()}
        >
          <p className="text-xs font-black uppercase tracking-[0.25em] text-muted-foreground">
            Drag & drop images here or click to select
          </p>
          <p className="text-[10px] text-muted-foreground">
            Max 5MB per image. Accepted formats: JPG, JPEG, PNG, WEBP.
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
                      {bf.tooLarge && (
                        <p className="text-[10px] text-red-500">
                          Exceeds 5MB — will be skipped
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
            {filtered.map((item: AdminImageAsset) => {
              const id = item.id;
              const url = item.url;
              const displayName = item.filename ?? url.split("/").pop();

              return (
              <div
                key={id}
                className="group relative aspect-square rounded-xl border border-muted/40 bg-muted overflow-hidden"
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
                
                <div className="absolute top-2 right-2 flex flex-col gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    type="button"
                    onClick={() => setPreviewAsset(item)}
                    className="h-8 w-8 rounded-full bg-black/60 text-white flex items-center justify-center hover:bg-black/80"
                    aria-label="Preview image"
                  >
                    <Eye className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                        navigator.clipboard.writeText(url);
                        toast({ title: "URL copied to clipboard" });
                    }}
                    className="h-8 w-8 rounded-full bg-black/60 text-white flex items-center justify-center hover:bg-black/80"
                    aria-label="Copy URL"
                  >
                    <Copy className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setAssetToDelete(item)}
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

      <Dialog open={!!previewAsset} onOpenChange={(open) => !open && setPreviewAsset(null)}>
        <DialogContent className="max-w-4xl overflow-hidden p-0">
          {previewAsset ? (
            <div className="grid lg:grid-cols-[minmax(0,1fr)_320px]">
              <div className="flex min-h-[420px] items-center justify-center bg-black p-6">
                <img
                  src={previewAsset.url}
                  alt={previewAsset.filename ?? "Preview"}
                  className="max-h-[75vh] w-auto max-w-full rounded-xl object-contain"
                />
              </div>
              <div className="space-y-5 p-6">
                <DialogHeader>
                  <DialogTitle>{previewAsset.filename ?? "Image preview"}</DialogTitle>
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
                    <div className="mt-1 break-all text-xs">{previewAsset.url}</div>
                  </div>
                </div>

                <DialogFooter className="flex-col gap-2 sm:flex-col">
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full"
                    onClick={() => {
                      navigator.clipboard.writeText(previewAsset.url);
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
                  src={assetToDelete.url}
                  alt={assetToDelete.filename ?? "Delete image"}
                  className="h-48 w-full object-cover"
                />
              </div>
              <div className="rounded-2xl border border-border bg-muted/10 px-4 py-3 text-sm">
                <p className="font-medium">{assetToDelete.filename ?? assetToDelete.url.split("/").pop()}</p>
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

