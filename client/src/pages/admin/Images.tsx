import { useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
  deleteAdminImage,
  fetchAdminImages,
  uploadAdminImage,
  type AdminImageAsset,
} from "@/lib/adminApi";
import { Trash2, Upload, Images } from "lucide-react";

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
  const queryClient = useQueryClient();
  const [provider, setProvider] = useState<"local" | "cloudinary">("cloudinary");
  const [category, setCategory] = useState<ImageCategory>("product");
  const [search, setSearch] = useState("");
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const imagesQuery = useQuery<AdminImageAsset[]>({
    queryKey: ["admin", "images", { provider, category }],
    queryFn: () => fetchAdminImages({ provider, category, limit: 120 }),
  });

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return imagesQuery.data ?? [];
    return (imagesQuery.data ?? []).filter((img) =>
      (img.filename || img.url).toLowerCase().includes(q),
    );
  }, [imagesQuery.data, search]);

  const uploadMutation = useMutation({
    mutationFn: (file: File) => uploadAdminImage({ file, category, provider }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "images"] });
      queryClient.invalidateQueries({ queryKey: ["admin", "media"] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteAdminImage(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "images"] });
      queryClient.invalidateQueries({ queryKey: ["admin", "media"] });
    },
  });

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-serif font-medium text-[#2C3E2D] dark:text-foreground flex items-center gap-3">
            <Images className="h-7 w-7" />
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
          </div>
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
            {filtered.map((img) => (
              <div
                key={img.id}
                className="group relative aspect-square rounded-xl border border-muted/40 bg-muted overflow-hidden"
              >
                <img
                  src={img.url}
                  alt={img.filename ?? "image"}
                  className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                  loading="lazy"
                />
                <div className="absolute inset-x-0 bottom-0 p-2 bg-gradient-to-t from-black/70 to-transparent opacity-0 group-hover:opacity-100 transition-opacity">
                  <p className="text-[10px] text-white truncate">
                    {img.filename ?? img.url.split("/").pop()}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => deleteMutation.mutate(img.id)}
                  disabled={deleteMutation.isPending}
                  className="absolute top-2 right-2 h-8 w-8 rounded-full bg-black/60 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-black/70"
                  aria-label="Delete image"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

