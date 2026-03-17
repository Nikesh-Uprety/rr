import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from "@/components/ui/tabs";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import {
  GripVertical,
  Image as ImageIcon,
  Loader2,
  Trash2,
  ExternalLink,
  Video,
  PlusCircle,
  Monitor,
  Smartphone,
  Layout,
} from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type SiteAsset = {
  id: string;
  section: string;
  imageUrl: string;
  cloudinaryPublicId: string;
  altText: string | null;
  deviceTarget: string;
  assetType: "image" | "video";
  videoUrl: string | null;
  sortOrder: number;
  active: boolean;
  uploadedBy: string | null;
  createdAt: string;
};

type SectionKey = "hero" | "featured_collection" | "new_collection" | "collection_page";

type UploadState = {
  file: File | null;
  previewUrl: string | null;
  altText: string;
  deviceTarget: string;
};

type VideoUploadState = {
  videoUrl: string;
  posterUrl: string;
  altText: string;
  deviceTarget: string;
};

function SectionHelperText({ section }: { section: SectionKey }) {
  if (section === "hero") {
    return (
      <p className="text-xs text-muted-foreground mt-1">
        Recommended 1920×800px. Max 5 images. Images are stored on Cloudinary
        and automatically optimized for web delivery.
      </p>
    );
  }

  return (
    <p className="text-xs text-muted-foreground mt-1">
      Recommended 1200×600px. Max 3 images.
    </p>
  );
}

function SectionManager({ section }: { section: SectionKey }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [assetsOrder, setAssetsOrder] = useState<SiteAsset[] | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [uploadState, setUploadState] = useState<UploadState>({
    file: null,
    previewUrl: null,
    altText: "",
    deviceTarget: "all",
  });
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const {
    data: assets = [],
    isLoading,
    isFetching,
  } = useQuery<SiteAsset[]>({
    queryKey: ["admin", "siteAssets", section],
    queryFn: async () => {
      const res = await apiRequest(
        "GET",
        `/api/admin/site-assets?section=${section}`,
      );
      const json = await res.json();
      return json.data ?? [];
    },
  });

  const orderedAssets = assetsOrder ?? assets;

  const hasReorderChanges = useMemo(() => {
    if (!assetsOrder) return false;
    if (assetsOrder.length !== assets.length) return true;
    return assetsOrder.some((a, idx) => a.id !== assets[idx]?.id);
  }, [assetsOrder, assets]);

  const maxItems = section === "hero" ? 5 : 3;
  const isAtMax = orderedAssets.length >= maxItems;

  const updateMutation = useMutation({
    mutationFn: async (payload: {
      id: string;
      data: Partial<Pick<SiteAsset, "altText" | "active" | "deviceTarget" | "videoUrl" | "imageUrl">>;
    }) => {
      const res = await apiRequest(
        "PATCH",
        `/api/admin/site-assets/${payload.id}`,
        payload.data,
      );
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "siteAssets", section] });
    },
    onError: (err: Error) => {
      toast({
        title: "Failed to update image",
        description: err.message,
        variant: "destructive",
      });
    },
  });

  const reorderMutation = useMutation({
    mutationFn: async (orderedIds: string[]) => {
      const res = await apiRequest(
        "PATCH",
        "/api/admin/site-assets/reorder",
        { section, orderedIds },
      );
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "siteAssets", section] });
      setAssetsOrder(null);
      toast({
        title: "Order saved",
        description: "Landing page images have been reordered.",
      });
    },
    onError: (err: Error) => {
      toast({
        title: "Failed to save order",
        description: err.message,
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest(
        "DELETE",
        `/api/admin/site-assets/${id}`,
      );
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "siteAssets", section] });
      setDeleteId(null);
      toast({
        title: "Image deleted",
        description: "Removed from both Cloudinary and the storefront.",
      });
    },
    onError: (err: Error) => {
      toast({
        title: "Failed to delete image",
        description: err.message,
        variant: "destructive",
      });
    },
  });

  const [videoUploadState, setVideoUploadState] = useState<VideoUploadState>({
    videoUrl: "",
    posterUrl: "",
    altText: "",
    deviceTarget: "mobile",
  });

  const videoMutation = useMutation({
    mutationFn: async () => {
      if (!videoUploadState.videoUrl) {
        throw new Error("No video URL provided");
      }
      
      const res = await apiRequest("POST", "/api/admin/site-assets/video", {
        section,
        videoUrl: videoUploadState.videoUrl,
        imageUrl: videoUploadState.posterUrl,
        altText: videoUploadState.altText,
        deviceTarget: videoUploadState.deviceTarget,
      });
      
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || "Failed to add video");
      }
      
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "siteAssets", section] });
      setVideoUploadState({ videoUrl: "", posterUrl: "", altText: "", deviceTarget: "mobile" });
      toast({
        title: "Video added",
        description: "Video asset has been saved.",
      });
    },
    onError: (err: Error) => {
      toast({
        title: "Failed to add video",
        description: err.message,
        variant: "destructive",
      });
    },
  });

  const uploadMutation = useMutation({
    mutationFn: async () => {
      if (!uploadState.file) {
        throw new Error("No file selected");
      }
      const formData = new FormData();
      formData.append("image", uploadState.file);
      formData.append("section", section);
      formData.append("deviceTarget", uploadState.deviceTarget);
      if (uploadState.altText) {
        formData.append("altText", uploadState.altText);
      }

      const res = await fetch("/api/admin/site-assets/upload", {
        method: "POST",
        body: formData,
        credentials: "include",
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || "Failed to upload image");
      }

      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "siteAssets", section] });
      setAssetsOrder(null); // Fix: Clear local order state to ensure fresh data is fetched
      setUploadState({ file: null, previewUrl: null, altText: "", deviceTarget: "all" });
      toast({
        title: "Uploaded",
        description: "Uploaded and saved to Cloudinary.",
      });
    },
    onError: (err: Error) => {
      toast({
        title: "Upload failed",
        description: err.message,
        variant: "destructive",
      });
    },
  });

  const handleDragStart = useCallback((id: string) => {
    setDraggingId(id);
  }, []);

  const handleDragOver = useCallback(
    (e: React.DragEvent<HTMLDivElement>, overId: string) => {
      e.preventDefault();
      if (!draggingId || draggingId === overId) return;

      const current = assetsOrder ?? assets;
      const fromIndex = current.findIndex((a) => a.id === draggingId);
      const toIndex = current.findIndex((a) => a.id === overId);
      if (fromIndex === -1 || toIndex === -1) return;

      const next = [...current];
      const [moved] = next.splice(fromIndex, 1);
      next.splice(toIndex, 0, moved);
      setAssetsOrder(next);
    },
    [draggingId, assetsOrder, assets],
  );

  const handleDragEnd = useCallback(() => {
    setDraggingId(null);
  }, []);

  const onFileSelected = (file: File | null) => {
    if (!file) {
      setUploadState({ file: null, previewUrl: null, altText: "", deviceTarget: "all" });
      return;
    }

    const previewUrl = URL.createObjectURL(file);
    setUploadState((prev) => ({
      ...prev,
      file,
      previewUrl,
      deviceTarget: prev.deviceTarget || "all",
    }));
  };

  const emptyState = !isLoading && orderedAssets.length === 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold tracking-[0.18em] uppercase text-muted-foreground flex items-center gap-2">
            <ImageIcon className="h-4 w-4" />
            {section === "hero"
              ? "Hero Banner"
              : section === "featured_collection"
                ? "Featured Collection"
                : "New Collection"}
          </h2>
          <SectionHelperText section={section} />
        </div>
        {(isFetching || updateMutation.isPending) && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Loader2 className="h-3 w-3 animate-spin" />
            Saving…
          </div>
        )}
      </div>

      {emptyState ? (
        <div className="border border-dashed rounded-xl p-8 text-center text-sm text-muted-foreground bg-muted/40">
          <p className="font-medium mb-1">No images yet</p>
          <p className="text-xs">
            Upload a new image below to start customizing this section.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {orderedAssets.map((asset) => (
            <div
              key={asset.id}
              className="group relative rounded-xl border bg-card overflow-hidden flex flex-col"
              draggable
              onDragStart={() => handleDragStart(asset.id)}
              onDragOver={(e) => handleDragOver(e, asset.id)}
              onDragEnd={handleDragEnd}
            >
              <div className="flex items-center justify-between px-3 py-2 text-xs text-muted-foreground bg-muted/40">
                <div className="flex items-center gap-2">
                  <GripVertical className="h-3 w-3 cursor-grab" />
                  <span className="font-mono text-[10px]">
                    #{asset.sortOrder + 1}
                  </span>
                </div>
                <span className="text-[10px]">
                  {new Date(asset.createdAt).toLocaleDateString()}
                </span>
              </div>
              <div className="h-40 w-full bg-muted overflow-hidden relative">
                {asset.assetType === "video" ? (
                  <div className="h-full w-full flex items-center justify-center bg-black">
                    <Video className="h-12 w-12 text-white/50" />
                    <div className="absolute top-2 right-2 bg-primary text-primary-foreground px-2 py-0.5 rounded text-[10px] font-bold uppercase">
                      Video
                    </div>
                  </div>
                ) : (
                  <img
                    src={asset.imageUrl}
                    alt={asset.altText || ""}
                    className="h-full w-full object-cover"
                    draggable={false}
                  />
                )}
              </div>
              <div className="p-3 space-y-2 border-t bg-background/60">
                <div className="space-y-1">
                  <label className="text-[10px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
                    Alt text
                  </label>
                  <Input
                    defaultValue={asset.altText ?? ""}
                    className="h-8 text-xs"
                    onBlur={(e) => {
                      const value = e.target.value.trim();
                      if (value === (asset.altText ?? "")) return;
                      updateMutation.mutate({
                        id: asset.id,
                        data: { altText: value },
                      });
                    }}
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <label className="text-[10px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
                      Target
                    </label>
                    <Select
                      defaultValue={asset.deviceTarget || "all"}
                      onValueChange={(value) => 
                        updateMutation.mutate({
                          id: asset.id,
                          data: { deviceTarget: value }
                        })
                      }
                    >
                      <SelectTrigger className="h-8 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All</SelectItem>
                        <SelectItem value="desktop">Desktop</SelectItem>
                        <SelectItem value="mobile">Mobile</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  {asset.assetType === "video" && (
                     <div className="space-y-1">
                      <label className="text-[10px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
                        Poster URL
                      </label>
                      <Input
                        defaultValue={asset.imageUrl ?? ""}
                        className="h-8 text-xs"
                        onBlur={(e) => {
                          const value = e.target.value.trim();
                          if (value === (asset.imageUrl ?? "")) return;
                          updateMutation.mutate({
                            id: asset.id,
                            data: { imageUrl: value },
                          });
                        }}
                      />
                    </div>
                  )}
                </div>
                {asset.assetType === "video" && (
                  <div className="space-y-1">
                    <label className="text-[10px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
                      Video URL / Embed
                    </label>
                    <Input
                      defaultValue={asset.videoUrl ?? ""}
                      className="h-8 text-xs"
                      onBlur={(e) => {
                        const value = e.target.value.trim();
                        if (value === (asset.videoUrl ?? "")) return;
                        updateMutation.mutate({
                          id: asset.id,
                          data: { videoUrl: value },
                        });
                      }}
                    />
                  </div>
                )}
                <div className="flex items-center justify-between pt-1">
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={asset.active}
                      onCheckedChange={(checked) =>
                        updateMutation.mutate({
                          id: asset.id,
                          data: { active: checked },
                        })
                      }
                    />
                    <span className="text-[11px] text-muted-foreground">
                      {asset.active ? "Active" : "Hidden"}
                    </span>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-red-500 hover:text-red-600 hover:bg-red-50"
                    onClick={() => setDeleteId(asset.id)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {hasReorderChanges && (
        <div className="flex justify-end">
          <Button
            size="sm"
            className="text-xs"
            onClick={() =>
              reorderMutation.mutate(
                (assetsOrder ?? assets).map((a) => a.id),
              )
            }
            disabled={reorderMutation.isPending}
          >
            {reorderMutation.isPending && (
              <Loader2 className="mr-2 h-3 w-3 animate-spin" />
            )}
            Save Order
          </Button>
        </div>
      )}

      {/* Upload zone */}
      <div className="mt-4 border border-dashed rounded-xl p-4 bg-muted/40">
        <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
          <div className="flex-1 space-y-2">
            <p className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">
              Upload New Image
            </p>
            <div
              className="flex flex-col md:flex-row gap-3 items-center"
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                const file = e.dataTransfer.files?.[0];
                if (file) onFileSelected(file);
              }}
            >
              <div className="flex flex-col gap-3 flex-1 min-w-[200px]">
                <label className="flex items-center justify-center border rounded-lg px-4 py-2 text-xs cursor-pointer bg-background hover:bg-muted transition-colors w-full h-8">
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    className="hidden"
                    onChange={(e) => onFileSelected(e.target.files?.[0] ?? null)}
                  />
                  <ImageIcon className="h-3 w-3 mr-2" />
                  Select Image
                </label>
                <div className="flex gap-2">
                  <Select
                    value={uploadState.deviceTarget || "all"}
                    onValueChange={(val) => setUploadState(p => ({ ...p, deviceTarget: val }))}
                  >
                    <SelectTrigger className="h-8 text-xs flex-1">
                      <SelectValue placeholder="Target" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Devices</SelectItem>
                      <SelectItem value="desktop">Desktop Only</SelectItem>
                      <SelectItem value="mobile">Mobile Only</SelectItem>
                    </SelectContent>
                  </Select>
                  <Input
                    placeholder="Alt text"
                    className="h-8 text-xs flex-[2]"
                    value={uploadState.altText}
                    onChange={(e) =>
                      setUploadState((prev) => ({
                        ...prev,
                        altText: e.target.value,
                      }))
                    }
                  />
                </div>
              </div>
            </div>
          </div>

          {uploadState.previewUrl && (
            <div className="flex items-center gap-3">
              <div className="h-20 w-32 rounded-md overflow-hidden border bg-muted">
                <img
                  src={uploadState.previewUrl}
                  alt="Preview"
                  className="h-full w-full object-cover"
                />
              </div>
            </div>
          )}
        </div>
        <div className="mt-3 flex justify-end">
          <Button
            size="sm"
            disabled={!uploadState.file || uploadMutation.isPending || isAtMax}
            onClick={() => uploadMutation.mutate()}
          >
            {uploadMutation.isPending && (
              <Loader2 className="mr-2 h-3 w-3 animate-spin" />
            )}
            {isAtMax ? "Section is full" : "Upload"}
          </Button>
        </div>
      </div>

      {/* Video upload zone (Hero only) */}
      {section === "hero" && (
        <div className="mt-4 border border-dashed rounded-xl p-4 bg-muted/40">
          <div className="flex items-center gap-2 mb-3">
            <Video className="h-4 w-4 text-primary" />
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
              Add Hero Video (Mobile)
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="space-y-1">
              <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <ExternalLink className="w-3 h-3" /> Video URL / Iframe
              </label>
              <Input
                placeholder="Paste Cloudinary player src..."
                className="h-8 text-xs bg-background"
                value={videoUploadState.videoUrl}
                onChange={(e) => setVideoUploadState(p => ({ ...p, videoUrl: e.target.value }))}
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <ImageIcon className="w-3 h-3" /> Poster/Thumbnail URL
              </label>
              <Input
                placeholder="Optional poster image..."
                className="h-8 text-xs bg-background"
                value={videoUploadState.posterUrl}
                onChange={(e) => setVideoUploadState(p => ({ ...p, posterUrl: e.target.value }))}
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <Monitor className="w-3 h-3" /> Target Device
              </label>
              <Select
                value={videoUploadState.deviceTarget}
                onValueChange={(val) => setVideoUploadState(p => ({ ...p, deviceTarget: val }))}
              >
                <SelectTrigger className="h-8 text-xs bg-background">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Devices</SelectItem>
                  <SelectItem value="desktop">Desktop Only</SelectItem>
                  <SelectItem value="mobile">Mobile Only</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-end gap-2">
               <div className="flex-1 space-y-1">
                <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Alt Text</label>
                <Input
                  placeholder="Video description..."
                  className="h-8 text-xs bg-background"
                  value={videoUploadState.altText}
                  onChange={(e) => setVideoUploadState(p => ({ ...p, altText: e.target.value }))}
                />
               </div>
              <Button
                size="sm"
                className="h-8 text-xs px-4"
                disabled={!videoUploadState.videoUrl || videoMutation.isPending}
                onClick={() => videoMutation.mutate()}
              >
                {videoMutation.isPending ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <PlusCircle className="h-3.5 w-3.5 mr-2" />
                )}
                Add Video
              </Button>
            </div>
          </div>
          <p className="text-[10px] text-muted-foreground mt-3 leading-relaxed opacity-70">
            <strong>Tip:</strong> You can paste the full Cloudinary embed iframe or just the <code>src</code> URL. We'll extract the player automatically.
          </p>
        </div>
      )}

      <AlertDialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete image?</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove the image from both Cloudinary and the storefront
              landing page. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700"
              onClick={() => {
                if (deleteId) deleteMutation.mutate(deleteId);
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

export default function LandingPageManager() {
  const [location] = useLocation();
  const validTabs = useMemo(
    () =>
      ["hero", "featured_collection", "new_collection", "collection_page"] as const,
    [],
  );

  const getInitialTab = useCallback(() => {
    const params = new URLSearchParams(window.location.search);
    const section = params.get("section");
    if (section && (validTabs as readonly string[]).includes(section)) {
      return section as (typeof validTabs)[number];
    }
    return "hero" as const;
  }, [validTabs]);

  const [tab, setTab] = useState<(typeof validTabs)[number]>(getInitialTab);

  useEffect(() => {
    const handler = () => setTab(getInitialTab());
    window.addEventListener("popstate", handler);
    return () => window.removeEventListener("popstate", handler);
  }, [getInitialTab]);

  useEffect(() => {
    // Wouter navigation updates location via pushState (no popstate),
    // so re-sync the selected tab whenever the URL changes.
    setTab(getInitialTab());
  }, [location, getInitialTab]);

  const handleTabChange = (next: string) => {
    if (!(validTabs as readonly string[]).includes(next)) return;
    setTab(next as (typeof validTabs)[number]);
    const params = new URLSearchParams(window.location.search);
    params.set("section", next);
    window.history.replaceState(
      null,
      "",
      `${window.location.pathname}?${params.toString()}`,
    );
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-serif font-medium text-[#2C3E2D] dark:text-foreground">
            Landing Page
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manage hero banners and campaign imagery for the storefront.
          </p>
        </div>
        <Button 
          variant="outline"
          className="rounded-full shadow-sm"
          onClick={() => window.open('/', '_blank')}
        >
          <ExternalLink className="w-4 h-4 mr-2" />
          View Storefront
        </Button>
      </div>

      <Tabs value={tab} onValueChange={handleTabChange} className="space-y-6">
        <TabsList>
          <TabsTrigger value="hero">Hero Banner</TabsTrigger>
          <TabsTrigger value="featured_collection">Featured Collection</TabsTrigger>
          <TabsTrigger value="new_collection">Home Campaign</TabsTrigger>
          <TabsTrigger value="collection_page">Collection Page</TabsTrigger>
        </TabsList>
        <TabsContent value="hero">
          <SectionManager section="hero" />
        </TabsContent>
        <TabsContent value="featured_collection">
          <SectionManager section="featured_collection" />
        </TabsContent>
        <TabsContent value="new_collection">
          <SectionManager section="new_collection" />
        </TabsContent>
        <TabsContent value="collection_page">
          <SectionManager section="collection_page" />
        </TabsContent>
      </Tabs>
    </div>
  );
}

