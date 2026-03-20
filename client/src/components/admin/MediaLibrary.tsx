import React from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, ImageIcon, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { fetchAdminImages, type AdminImageAsset } from "@/lib/adminApi";

interface MediaLibraryProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (url: string) => void;
  onConfirm?: (urls: string[]) => void;
  selectedUrl?: string;
  selectedUrls?: string[];
  mode?: "single" | "multiple";
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
  category = "product",
}: MediaLibraryProps) {
  const [offset, setOffset] = React.useState(0);
  const [accumulated, setAccumulated] = React.useState<AdminImageAsset[]>([]);
  const [hasMore, setHasMore] = React.useState(true);

  const pageSize = 120; // server clamps to <= 200; this keeps load reasonable

  const { data: pageAssets = [], isLoading, isFetching } = useQuery<AdminImageAsset[]>({
    queryKey: ["admin", "images", { category, limit: pageSize, offset }],
    queryFn: () => fetchAdminImages({ category, limit: pageSize, offset }),
    enabled: open,
  });

  React.useEffect(() => {
    if (!open) return;
    setOffset(0);
    setAccumulated([]);
    setHasMore(true);
  }, [open, category]);

  React.useEffect(() => {
    if (!open) return;
    if (offset === 0) {
      setAccumulated(pageAssets);
    } else if (pageAssets.length > 0) {
      setAccumulated((prev) => {
        const seen = new Set(prev.map((a) => a.url));
        const next = [...prev];
        for (const a of pageAssets) {
          if (!seen.has(a.url)) next.push(a);
        }
        return next;
      });
    }
    // If server returned fewer than a full page, we likely hit the end.
    if (pageAssets.length < pageSize) setHasMore(false);
  }, [pageAssets, offset, open]);

  const images = accumulated.map((a) => a.url);
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[80vh] flex flex-col p-6">
        <DialogHeader className="px-1 border-b pb-4 mb-4">
          <DialogTitle className="text-xl font-bold flex items-center gap-2">
            <ImageIcon className="h-5 w-5 text-muted-foreground" />
            Media Library
          </DialogTitle>
          <p className="text-sm text-muted-foreground">
            Select an image from previously uploaded assets.
          </p>
        </DialogHeader>

        {isLoading ? (
          <div className="flex-1 flex flex-col items-center justify-center py-20">
            <Loader2 className="h-10 w-10 animate-spin text-muted-foreground mb-4" />
            <p className="text-sm text-muted-foreground">Loading your media...</p>
          </div>
        ) : images.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center py-20 text-center">
            <div className="h-20 w-20 rounded-full bg-muted flex items-center justify-center mb-4">
              <ImageIcon className="h-10 w-10 text-muted-foreground/40" />
            </div>
            <h3 className="text-lg font-medium">No images found</h3>
            <p className="text-sm text-muted-foreground max-w-[250px] mt-2">
              Upload images via the products or landing page manager to see them here.
            </p>
          </div>
        ) : (
          <ScrollArea className="flex-1 -mx-1 pr-4">
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
              {images.map((url) => {
                const isSelected = effectiveSelected.has(url);
                return (
                  <button
                    key={url}
                    onClick={() => {
                      if (mode === "single") {
                        onSelect(url);
                        onOpenChange(false);
                        return;
                      }

                      // multiple: toggle selection, keep dialog open
                      setLocalSelectedSet((prev) => {
                        const next = new Set(prev);
                        if (next.has(url)) next.delete(url);
                        else next.add(url);
                        return next;
                      });
                    }}
                    className={cn(
                      "group relative aspect-square rounded-xl border bg-muted overflow-hidden transition-all hover:ring-2 hover:ring-primary/20",
                      isSelected && "ring-2 ring-primary bg-primary/5 shadow-md scale-[0.98]"
                    )}
                  >
                    <img
                      src={url}
                      alt="Media item"
                      className={cn(
                        "h-full w-full object-cover transition-transform duration-300 group-hover:scale-105",
                        isSelected && "opacity-90"
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
                        {url.split('/').pop()}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          </ScrollArea>
        )}

        <div className="mt-4 pt-4 border-t flex flex-col gap-3">
          {mode === "multiple" ? (
            <div className="flex items-center justify-between gap-3">
              <Button
                variant="outline"
                onClick={() => setLocalSelectedSet(new Set())}
                disabled={localSelectedSet.size === 0}
              >
                Clear Selection
              </Button>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  onClick={() => onOpenChange(false)}
                >
                  Close
                </Button>
                <Button
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
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Close
              </Button>
            </div>
          )}

          {hasMore && (
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
      </DialogContent>
    </Dialog>
  );
}
