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
  selectedUrl?: string;
  category?: string;
}

export function MediaLibrary({
  open,
  onOpenChange,
  onSelect,
  selectedUrl,
  category = "product",
}: MediaLibraryProps) {
  const { data: assets = [], isLoading } = useQuery<AdminImageAsset[]>({
    queryKey: ["admin", "images", { category }],
    queryFn: () => fetchAdminImages({ category, limit: 120 }),
    enabled: open,
  });

  const images = assets.map((a) => a.url);

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
                const isSelected = selectedUrl === url;
                return (
                  <button
                    key={url}
                    onClick={() => {
                      onSelect(url);
                      onOpenChange(false);
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

        <div className="mt-6 flex justify-end pt-4 border-t">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
