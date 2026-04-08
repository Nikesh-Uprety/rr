import React from "react";
import { createPortal } from "react-dom";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, ImageIcon, Check, X } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  fetchAdminImages,
  fetchAdminStorefrontImageLibrary,
  type AdminImageAsset,
} from "@/lib/adminApi";

/**
 * Stacking: admin full-screen overlays + layout use z-40–z-70. Radix Dialog defaults to z-50,
 * so the dim overlay can appear while the panel sits underneath another layer.
 * This picker portals to document.body with a very high z-index so it always wins.
 */
const PORTAL_Z_BACKDROP = 10000;
const PORTAL_Z_PANEL = 10001;

interface MediaLibraryProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (url: string) => void;
  onConfirm?: (urls: string[]) => void;
  selectedUrl?: string;
  selectedUrls?: string[];
  mode?: "single" | "multiple";
  /** When undefined or "all", fetches images from all categories. Otherwise filters by this category. */
  category?: string;
}

export function MediaLibrary({
  open,
  onOpenChange,
  onSelect,
  selectedUrl,
  selectedUrls,
  onConfirm,
  mode = "single",
  category,
}: MediaLibraryProps) {
  type ProviderFilter = "all" | "cloudinary" | "tigris" | "local";
  const [mounted, setMounted] = React.useState(false);
  const [offset, setOffset] = React.useState(0);
  const [accumulated, setAccumulated] = React.useState<AdminImageAsset[]>([]);
  const [hasMore, setHasMore] = React.useState(true);
  const [providerFilter, setProviderFilter] = React.useState<ProviderFilter>("all");

  const pageSize = 120;

  React.useEffect(() => {
    setMounted(true);
  }, []);

  React.useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onOpenChange(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onOpenChange]);

  React.useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  const { data: pageAssets = [], isLoading, isFetching, isError } = useQuery<AdminImageAsset[]>({
    queryKey: ["admin", "images", { category: category ?? "all", provider: providerFilter, limit: pageSize, offset }],
    queryFn: async () => {
      try {
        const assets = await fetchAdminImages({
          ...(category && category !== "all" ? { category } : {}),
          ...(providerFilter !== "all" ? { provider: providerFilter } : {}),
          limit: pageSize,
          offset,
        });

        if (assets.length === 0 && offset === 0 && (providerFilter === "all" || providerFilter === "local")) {
          const local = await fetchAdminStorefrontImageLibrary();
          return local.map((item) => ({
            id: item.relPath,
            url: item.url,
            provider: "local",
            category: "local",
            publicId: null,
            filename: item.filename,
            bytes: null,
            width: null,
            height: null,
            createdAt: "",
          }));
        }

        return assets;
      } catch {
        if (offset === 0 && (providerFilter === "all" || providerFilter === "local")) {
          const local = await fetchAdminStorefrontImageLibrary();
          return local.map((item) => ({
            id: item.relPath,
            url: item.url,
            provider: "local",
            category: "local",
            publicId: null,
            filename: item.filename,
            bytes: null,
            width: null,
            height: null,
            createdAt: "",
          }));
        }
        throw new Error("Failed to load media library");
      }
    },
    enabled: open && mounted,
  });

  React.useEffect(() => {
    if (!open) return;
    setOffset(0);
    setAccumulated([]);
    setHasMore(true);
  }, [open, category, providerFilter]);

  React.useEffect(() => {
    if (!open) return;
    if (offset === 0) {
      setAccumulated(pageAssets);
    } else if (pageAssets.length > 0) {
      setAccumulated((prev) => {
        const seen = new Set(prev.map((a) => a.id));
        const next = [...prev];
        for (const a of pageAssets) {
          if (!seen.has(a.id)) next.push(a);
        }
        return next;
      });
    }
    if (pageAssets.length < pageSize) setHasMore(false);
  }, [pageAssets, offset, open]);

  const images = React.useMemo(
    () =>
      accumulated
        .filter((asset): asset is AdminImageAsset & { url: string } => typeof asset.url === "string" && asset.url.length > 0)
        .map((asset) => ({
          id: asset.id,
          url: asset.url,
          filename: asset.filename ?? asset.url.split("/").pop() ?? "image",
          category: asset.category || "uncategorized",
          provider: asset.provider || "unknown",
        })),
    [accumulated],
  );

  const selectedSet = React.useMemo(() => {
    const set = new Set<string>();
    if (mode === "single") {
      if (selectedUrl) set.add(selectedUrl);
    } else {
      (selectedUrls ?? []).forEach((u) => set.add(u));
    }
    return set;
  }, [mode, selectedUrl, selectedUrls]);

  const [localSelectedSet, setLocalSelectedSet] = React.useState<Set<string>>(new Set());

  React.useEffect(() => {
    if (!open) return;
    if (mode === "multiple") {
      setLocalSelectedSet(new Set(selectedUrls ?? []));
    } else {
      setLocalSelectedSet(new Set(selectedUrl ? [selectedUrl] : []));
    }
  }, [open, mode, selectedUrl, selectedUrls]);

  const effectiveSelected = mode === "multiple" ? localSelectedSet : selectedSet;

  if (!mounted || !open) return null;

  const panel = (
    <div
      className="fixed inset-0 flex items-center justify-center p-4"
      style={{ zIndex: PORTAL_Z_BACKDROP }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="media-library-title"
    >
      <button
        type="button"
        className="absolute inset-0 bg-black/80"
        aria-label="Close media library"
        onClick={() => onOpenChange(false)}
      />
      <div
        className="relative flex w-full max-w-3xl max-h-[85vh] flex-col overflow-hidden rounded-lg border border-border bg-background p-6 shadow-2xl"
        style={{ zIndex: PORTAL_Z_PANEL }}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          className="absolute right-3 top-3 rounded-sm p-1.5 text-muted-foreground opacity-80 hover:opacity-100 hover:bg-muted z-10"
          aria-label="Close"
          onClick={() => onOpenChange(false)}
        >
          <X className="h-5 w-5" />
        </button>

        <div className="pr-10 border-b border-border pb-4 mb-4 shrink-0">
          <h2 id="media-library-title" className="text-xl font-bold flex items-center gap-2">
            <ImageIcon className="h-5 w-5 text-muted-foreground" />
            Media Library
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Select an image from previously uploaded assets.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {(["all", "cloudinary", "tigris", "local"] as const).map((provider) => (
              <Button
                key={provider}
                type="button"
                variant={providerFilter === provider ? "default" : "outline"}
                className="h-8 rounded-full px-3 text-[10px] uppercase tracking-[0.18em]"
                onClick={() => setProviderFilter(provider)}
              >
                {provider}
              </Button>
            ))}
          </div>
        </div>

        <div className="min-h-0 flex-1 flex flex-col overflow-hidden">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-16">
              <Loader2 className="h-10 w-10 animate-spin text-muted-foreground mb-4" />
              <p className="text-sm text-muted-foreground">Loading your media...</p>
            </div>
          ) : isError ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="h-20 w-20 rounded-full bg-muted flex items-center justify-center mb-4">
                <ImageIcon className="h-10 w-10 text-muted-foreground/40" />
              </div>
              <h3 className="text-lg font-medium">Failed to load media</h3>
              <p className="text-sm text-muted-foreground max-w-[320px] mt-2">
                We could not load the image library right now. Try again or upload images from the Images page.
              </p>
            </div>
          ) : images.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="h-20 w-20 rounded-full bg-muted flex items-center justify-center mb-4">
                <ImageIcon className="h-10 w-10 text-muted-foreground/40" />
              </div>
              <h3 className="text-lg font-medium">No images found</h3>
              <p className="text-sm text-muted-foreground max-w-[250px] mt-2">
                Upload images via Admin → Images or product uploads to populate the library.
              </p>
            </div>
          ) : (
            <ScrollArea className="h-[min(50vh,420px)] pr-3">
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 pb-2">
                {images.map((img) => {
                  const isSelected = effectiveSelected.has(img.url);
                  return (
                    <button
                      key={img.id}
                      type="button"
                      onClick={() => {
                        if (mode === "single") {
                          onSelect(img.url);
                          onOpenChange(false);
                          return;
                        }
                        setLocalSelectedSet((prev) => {
                          const next = new Set(prev);
                          if (next.has(img.url)) next.delete(img.url);
                          else next.add(img.url);
                          return next;
                        });
                      }}
                      className={cn(
                        "group relative aspect-square rounded-xl border bg-muted overflow-hidden transition-all hover:ring-2 hover:ring-primary/20",
                        isSelected && "ring-2 ring-primary bg-primary/5 shadow-md scale-[0.98]",
                      )}
                    >
                      <img
                        src={img.url}
                        alt=""
                        className={cn(
                          "h-full w-full object-cover transition-transform duration-300 group-hover:scale-105",
                          isSelected && "opacity-90",
                        )}
                        loading="lazy"
                      />
                      {isSelected && (
                        <div className="absolute inset-0 flex items-center justify-center bg-primary/10">
                          <div className="h-8 w-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center shadow-lg">
                            <Check className="h-4 w-4" />
                          </div>
                        </div>
                      )}
                      <div className="absolute inset-x-0 bottom-0 p-2 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity">
                        <p className="text-[10px] text-white truncate text-left">
                          {img.filename}
                        </p>
                        <p className="mt-0.5 text-[9px] uppercase tracking-[0.14em] text-white/85 text-left">
                          {img.provider} · {img.category}
                        </p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </ScrollArea>
          )}
        </div>

        <div className="mt-4 pt-4 border-t border-border shrink-0 flex flex-col gap-3">
          {mode === "multiple" ? (
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <Button
                type="button"
                variant="outline"
                onClick={() => setLocalSelectedSet(new Set())}
                disabled={localSelectedSet.size === 0}
              >
                Clear Selection
              </Button>
              <div className="flex items-center gap-2">
                <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                  Close
                </Button>
                <Button
                  type="button"
                  onClick={() => {
                    const urls = Array.from(localSelectedSet);
                    if (urls.length === 0) return;
                    onConfirm?.(urls);
                    onOpenChange(false);
                  }}
                  disabled={!onConfirm || localSelectedSet.size === 0}
                >
                  Add Selected ({localSelectedSet.size})
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex justify-end">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Close
              </Button>
            </div>
          )}

          {hasMore && images.length > 0 && (
            <div className="flex justify-center">
              <Button
                type="button"
                variant="outline"
                disabled={isFetching}
                onClick={() => setOffset((o) => o + pageSize)}
              >
                {isFetching ? "Loading..." : "Load more"}
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );

  return createPortal(panel, document.body);
}
