import { useEffect, useMemo, useRef, useState } from "react";
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
import { Pagination } from "@/components/admin/Pagination";
import { cn } from "@/lib/utils";
import {
  createAdminFolder,
  deleteAdminFolder,
  deleteAdminImage,
  fetchAdminFolders,
  fetchAdminImages,
  fetchAdminImagesPage,
  updateAdminImageMeta,
  uploadAdminImage,
  type AdminImageAsset,
} from "@/lib/adminApi";
import {
  ArrowDownAZ,
  Calendar,
  ChevronDown,
  ChevronRight,
  Clock,
  Copy,
  Eye,
  Folder,
  FolderPlus,
  Grid2X2,
  List,
  MoveRight,
  Search,
  Trash2,
  Upload,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

type ImageCategory =
  | "product"
  | "model"
  | "website"
  | "landing_page"
  | "collection_page"
  | "payment_qr"
  | "our_services";

type ProviderKey = "cloudinary" | "tigris" | "local";
type ViewMode = "grid" | "list";
type ExpiryMode = "none" | "custom";

const CATEGORY_LABELS: Record<ImageCategory, string> = {
  product: "Product images",
  model: "Model images",
  website: "Website assets",
  landing_page: "Landing page",
  collection_page: "Collection page",
  payment_qr: "Payment QR",
  our_services: "Our Services",
};

const PROVIDER_META: Record<
  ProviderKey,
  { label: string; quality: string; description: string }
> = {
  cloudinary: {
    label: "Cloudinary",
    quality: "Medium",
    description: "Balanced compression for daily admin use.",
  },
  tigris: {
    label: "Tigris",
    quality: "High",
    description: "Crisp output for retail and merchandising needs.",
  },
  local: {
    label: "Local",
    quality: "Standard",
    description: "Local workspace storage for quick testing.",
  },
};

const SORT_OPTIONS: Array<{ value: "createdAt" | "name" | "size"; label: string }> = [
  { value: "createdAt", label: "Newest first" },
  { value: "name", label: "Name" },
  { value: "size", label: "File size" },
];

const MAX_IMAGE_SIZE_BYTES = 30 * 1024 * 1024;
const MAX_IMAGE_SIZE_LABEL = "30MB";

type FolderNode = {
  name: string;
  path: string;
  count: number;
  children: FolderNode[];
};

export default function AdminBucketsPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [provider, setProvider] = useState<ProviderKey>("tigris");
  const [category, setCategory] = useState<ImageCategory>("product");
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [viewMode, setViewMode] = useState<ViewMode>("grid");
  const [sortBy, setSortBy] = useState<"createdAt" | "name" | "size">("createdAt");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [showExpired, setShowExpired] = useState(false);
  const [currentFolder, setCurrentFolder] = useState<string | null>(null);
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [selectedAssetId, setSelectedAssetId] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(45);
  const [isDragging, setIsDragging] = useState(false);
  const [isBulkUploading, setIsBulkUploading] = useState(false);
  const [createFolderOpen, setCreateFolderOpen] = useState(false);
  const [folderName, setFolderName] = useState("");
  const [folderParentMode, setFolderParentMode] = useState<"current" | "root">("current");
  const [expiryMode, setExpiryMode] = useState<ExpiryMode>("none");
  const [expiryDate, setExpiryDate] = useState("");
  const [expiryTime, setExpiryTime] = useState("");
  const [bulkMoveTarget, setBulkMoveTarget] = useState<string>("root");

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  type UploadFileStatus = "idle" | "uploading" | "success" | "error" | "skipped";
  type UploadFile = {
    id: string;
    file: File;
    previewUrl: string;
    tooLarge: boolean;
    status: UploadFileStatus;
    error?: string;
    progress: number;
  };

  const [uploadQueue, setUploadQueue] = useState<UploadFile[]>([]);

  useEffect(() => {
    const handle = setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => clearTimeout(handle);
  }, [search]);

  useEffect(() => {
    setPage(1);
  }, [provider, category, debouncedSearch, currentFolder, sortBy, sortDir, showExpired, pageSize]);

  useEffect(() => {
    setSelectedIds(new Set());
    setSelectedAssetId(null);
  }, [provider, category, debouncedSearch, currentFolder, showExpired, page]);

  useEffect(() => {
    return () => {
      uploadQueue.forEach((item) => URL.revokeObjectURL(item.previewUrl));
    };
  }, [uploadQueue]);

  const foldersQuery = useQuery({
    queryKey: ["admin", "folders", provider, category],
    queryFn: () => fetchAdminFolders({ provider, category }),
  });

  const folderMarkersQuery = useQuery({
    queryKey: ["admin", "folder-markers", provider, category],
    queryFn: () =>
      fetchAdminImages({ provider, category, assetType: "folder", limit: 500 }),
  });

  const assetsQuery = useQuery<{ data: AdminImageAsset[]; total: number }>({
    queryKey: [
      "admin",
      "buckets",
      { provider, category, debouncedSearch, currentFolder, sortBy, sortDir, showExpired, page, pageSize },
    ],
    queryFn: () =>
      fetchAdminImagesPage({
        provider,
        category,
        search: debouncedSearch || undefined,
        folderPath: currentFolder ?? undefined,
        assetType: "file",
        expired: showExpired ? undefined : false,
        sortBy,
        sortDir,
        limit: pageSize,
        offset: (page - 1) * pageSize,
      }),
  });

  const assets = assetsQuery.data?.data ?? [];
  const totalAssets = assetsQuery.data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalAssets / pageSize));

  const folderMarkerMap = useMemo(() => {
    const map = new Map<string, AdminImageAsset>();
    (folderMarkersQuery.data ?? []).forEach((asset) => {
      if (asset.folderPath) map.set(asset.folderPath, asset);
    });
    return map;
  }, [folderMarkersQuery.data]);

  const folderTree = useMemo<FolderNode[]>(() => {
    const nodesByPath = new Map<string, FolderNode>();
    const roots: FolderNode[] = [];

    (foldersQuery.data ?? []).forEach((folder) => {
      const normalized = folder.path.trim().replace(/^\/+|\/+$/g, "");
      if (!normalized) return;
      const parts = normalized.split("/");
      let currentPath = "";
      let parent: FolderNode | null = null;
      parts.forEach((part, index) => {
        currentPath = currentPath ? `${currentPath}/${part}` : part;
        let node = nodesByPath.get(currentPath);
        if (!node) {
          node = { name: part, path: currentPath, count: 0, children: [] };
          nodesByPath.set(currentPath, node);
          if (parent) parent.children.push(node);
          else roots.push(node);
        }
        if (index === parts.length - 1) {
          node.count = Math.max(node.count, folder.count);
        }
        parent = node;
      });
    });

    const sortNodes = (nodes: FolderNode[]) => {
      nodes.sort((a, b) => a.name.localeCompare(b.name));
      nodes.forEach((node) => sortNodes(node.children));
    };
    sortNodes(roots);
    return roots;
  }, [foldersQuery.data]);

  const selectedAsset = useMemo(() => {
    if (!selectedAssetId) return null;
    return assets.find((asset) => asset.id === selectedAssetId) ?? null;
  }, [assets, selectedAssetId]);

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

  const formatBytes = (bytes?: number | null) => {
    if (!bytes) return "—";
    const mb = bytes / 1024 / 1024;
    if (mb < 1) return `${Math.round(bytes / 1024)} KB`;
    return `${mb.toFixed(2)} MB`;
  };

  const formatExpiryLabel = (value?: string | null) => {
    if (!value) return "No expiry";
    const expiry = new Date(value);
    const now = new Date();
    if (Number.isNaN(expiry.getTime())) return "Invalid expiry";
    if (expiry <= now) return "Expired";
    const diffMs = expiry.getTime() - now.getTime();
    const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
    if (diffDays === 1) return "Expires in 1 day";
    return `Expires in ${diffDays} days`;
  };

  const serializeExpiry = () => {
    if (expiryMode === "none" || !expiryDate) return null;
    const time = expiryTime || "23:59";
    const dt = new Date(`${expiryDate}T${time}`);
    if (Number.isNaN(dt.getTime())) return null;
    return dt.toISOString();
  };

  const filteredAssets = useMemo(() => {
    const q = normalizeName(debouncedSearch.trim());
    if (!q) return assets;
    return assets.filter((asset) =>
      normalizeName(asset.filename || asset.url || "").includes(q),
    );
  }, [assets, debouncedSearch]);

  const addUploadFiles = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const next: UploadFile[] = [];
    let oversizeCount = 0;
    Array.from(files).forEach((file) => {
      if (!file.type.startsWith("image/")) return;
      const tooLarge = file.size > MAX_IMAGE_SIZE_BYTES;
      const previewUrl = URL.createObjectURL(file);
      if (tooLarge) oversizeCount += 1;
      next.push({
        id: `${file.name}-${file.size}-${file.lastModified}-${Math.random()
          .toString(36)
          .slice(2)}`,
        file,
        previewUrl,
        tooLarge,
        status: tooLarge ? "skipped" : "idle",
        error: tooLarge ? `File exceeds ${MAX_IMAGE_SIZE_LABEL} limit` : undefined,
        progress: 0,
      });
    });

    if (next.length === 0) return;
    setUploadQueue((prev) => [...prev, ...next]);
    if (oversizeCount > 0) {
      toast({
        title: "Large file skipped",
        description: `Files over ${MAX_IMAGE_SIZE_LABEL} are skipped automatically.`,
        variant: "warning",
      });
    }
  };

  const createFolderMutation = useMutation({
    mutationFn: async () => {
      const trimmed = folderName.trim().replace(/\\+/g, "/");
      const cleaned = trimmed.replace(/^\/+|\/+$/g, "").replace(/\/{2,}/g, "/");
      if (!cleaned) throw new Error("Folder name is required.");
      const parent = folderParentMode === "current" ? currentFolder ?? "" : "";
      const fullPath = parent ? `${parent}/${cleaned}` : cleaned;
      return createAdminFolder({ folderPath: fullPath, category, provider });
    },
    onSuccess: () => {
      setFolderName("");
      setCreateFolderOpen(false);
      queryClient.invalidateQueries({ queryKey: ["admin", "folders"] });
      queryClient.invalidateQueries({ queryKey: ["admin", "folder-markers"] });
      toast({ title: "Folder created" });
    },
    onError: (err: any) => {
      toast({
        title: "Could not create folder",
        description: err?.message || "Try again.",
        variant: "destructive",
      });
    },
  });

  const deleteFolderMutation = useMutation({
    mutationFn: async () => {
      if (!currentFolder) throw new Error("Select a folder to delete.");
      const marker = folderMarkerMap.get(currentFolder);
      if (!marker) throw new Error("Folder marker not found.");
      await deleteAdminFolder(marker.id);
    },
    onSuccess: () => {
      setCurrentFolder(null);
      queryClient.invalidateQueries({ queryKey: ["admin", "folders"] });
      queryClient.invalidateQueries({ queryKey: ["admin", "folder-markers"] });
      toast({ title: "Folder deleted" });
    },
    onError: (err: any) => {
      toast({
        title: "Unable to delete folder",
        description: err?.message || "Folder is not empty.",
        variant: "destructive",
      });
    },
  });

  const uploadMutation = useMutation({
    mutationFn: async (file: UploadFile) => {
      const expiry = serializeExpiry();
      const qualityMode =
        provider === "cloudinary"
          ? "medium"
          : provider === "tigris"
            ? "high"
            : undefined;
      return uploadAdminImage({
        file: file.file,
        category,
        provider,
        folderPath: currentFolder ?? undefined,
        expiresAt: expiry ?? undefined,
        qualityMode,
        onProgress: (value) => {
          setUploadQueue((prev) =>
            prev.map((item) =>
              item.id === file.id ? { ...item, progress: value } : item,
            ),
          );
        },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "buckets"] });
      queryClient.invalidateQueries({ queryKey: ["admin", "folders"] });
    },
  });

  const handleUploadQueue = async () => {
    const pending = uploadQueue.filter(
      (item) => !item.tooLarge && (item.status === "idle" || item.status === "error"),
    );
    if (pending.length === 0) return;
    setIsBulkUploading(true);
    for (const item of pending) {
      setUploadQueue((prev) =>
        prev.map((file) =>
          file.id === item.id ? { ...file, status: "uploading" } : file,
        ),
      );
      try {
        await uploadMutation.mutateAsync(item);
        setUploadQueue((prev) =>
          prev.map((file) =>
            file.id === item.id
              ? { ...file, status: "success", progress: 100 }
              : file,
          ),
        );
      } catch (err: any) {
        setUploadQueue((prev) =>
          prev.map((file) =>
            file.id === item.id
              ? {
                  ...file,
                  status: "error",
                  progress: 0,
                  error: err?.message || "Upload failed",
                }
              : file,
          ),
        );
      }
    }
    setIsBulkUploading(false);
    toast({ title: "Uploads complete" });
  };

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteAdminImage(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "buckets"] });
      toast({ title: "Asset deleted" });
    },
    onError: (err: any) => {
      toast({
        title: "Delete failed",
        description: err?.message || "Try again.",
        variant: "destructive",
      });
    },
  });

  const bulkMoveMutation = useMutation({
    mutationFn: async (ids: string[]) => {
      const target = bulkMoveTarget === "root" ? null : bulkMoveTarget;
      await Promise.all(
        ids.map((id) =>
          updateAdminImageMeta({
            id,
            folderPath: target,
          }),
        ),
      );
    },
    onSuccess: (_data, ids) => {
      queryClient.invalidateQueries({ queryKey: ["admin", "buckets"] });
      setSelectedIds((prev) => {
        const next = new Set(prev);
        ids.forEach((id) => next.delete(id));
        return next;
      });
      toast({ title: "Moved assets" });
    },
    onError: (err: any) => {
      toast({
        title: "Move failed",
        description: err?.message || "Try again.",
        variant: "destructive",
      });
    },
  });

  const bulkDeleteMutation = useMutation({
    mutationFn: async (ids: string[]) => {
      await Promise.all(ids.map((id) => deleteAdminImage(id)));
    },
    onSuccess: (_data, ids) => {
      queryClient.invalidateQueries({ queryKey: ["admin", "buckets"] });
      setSelectedIds((prev) => {
        const next = new Set(prev);
        ids.forEach((id) => next.delete(id));
        return next;
      });
      toast({ title: `${ids.length} assets deleted` });
    },
    onError: (err: any) => {
      toast({
        title: "Bulk delete failed",
        description: err?.message || "Try again.",
        variant: "destructive",
      });
    },
  });

  const updateExpiryMutation = useMutation({
    mutationFn: async (input: { id: string; expiresAt: string | null }) =>
      updateAdminImageMeta({ id: input.id, expiresAt: input.expiresAt }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "buckets"] });
      toast({ title: "Expiry updated" });
    },
  });

  const moveSingleMutation = useMutation({
    mutationFn: async (input: { id: string; folderPath: string | null }) =>
      updateAdminImageMeta({ id: input.id, folderPath: input.folderPath }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "buckets"] });
      toast({ title: "Asset moved" });
    },
  });

  const deleteExpired = () => {
    const expiredIds = filteredAssets
      .filter((asset) => asset.expiresAt && new Date(asset.expiresAt) <= new Date())
      .map((asset) => asset.id);
    if (expiredIds.length === 0) {
      toast({ title: "No expired assets found." });
      return;
    }
    if (!window.confirm(`Delete ${expiredIds.length} expired asset(s)?`)) return;
    bulkDeleteMutation.mutate(expiredIds);
  };

  const folderOptions = useMemo(() => {
    const list = (foldersQuery.data ?? []).map((folder) => folder.path);
    list.sort((a, b) => a.localeCompare(b));
    return list;
  }, [foldersQuery.data]);

  const renderFolderNode = (node: FolderNode, depth = 0) => {
    const isExpanded = expandedFolders.has(node.path);
    const hasChildren = node.children.length > 0;
    const isActive = currentFolder === node.path;

    return (
      <div key={node.path}>
        <button
          type="button"
          onClick={() => {
            setCurrentFolder(node.path);
            setSelectedIds(new Set());
            setSelectedAssetId(null);
          }}
          className={cn(
            "w-full flex items-center justify-between rounded-lg px-2 py-2 text-left text-sm transition-colors",
            isActive
              ? "bg-[#1E2F22] text-white"
              : "text-[#243226] hover:bg-muted",
          )}
        >
          <span className="flex items-center gap-2">
            <span
              className="inline-flex h-6 w-6 items-center justify-center rounded-md bg-white/70 text-[#243226]"
              style={{ marginLeft: depth * 8 }}
            >
              <Folder className="h-3.5 w-3.5" />
            </span>
            <span className="truncate">{node.name}</span>
          </span>
          <span className="text-[10px] opacity-70">{node.count}</span>
        </button>
        {hasChildren && (
          <div className="pl-3">
            <button
              type="button"
              onClick={() => {
                setExpandedFolders((prev) => {
                  const next = new Set(prev);
                  if (next.has(node.path)) next.delete(node.path);
                  else next.add(node.path);
                  return next;
                });
              }}
              className="flex items-center gap-1 text-[10px] uppercase tracking-[0.2em] text-muted-foreground"
            >
              {isExpanded ? (
                <ChevronDown className="h-3 w-3" />
              ) : (
                <ChevronRight className="h-3 w-3" />
              )}
              {isExpanded ? "Collapse" : "Expand"}
            </button>
          </div>
        )}
        {hasChildren && isExpanded && (
          <div className="space-y-1">
            {node.children.map((child) => renderFolderNode(child, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div className="rounded-3xl border border-[#DCE8DB] bg-gradient-to-br from-[#F4F8F2] via-white to-[#EEF5F0] p-6 sm:p-8 shadow-[0_18px_40px_rgba(34,63,41,0.14)]">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
          <div>
            <div className="flex items-center gap-3">
              <Folder className="h-7 w-7 text-[#2C3E2D]" />
              <h1 className="text-3xl font-serif font-medium text-[#2C3E2D]">Buckets</h1>
              <span className="rounded-full bg-[#223C2A] px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.35em] text-white">
                New
              </span>
            </div>
            <p className="text-muted-foreground mt-2 max-w-2xl">
              Drive-style media workspace with provider quality controls, folder prefixes, and expiry metadata.
            </p>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="rounded-2xl border border-[#D6E2D6] bg-white/80 px-3 py-2">
              <p className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground">Assets</p>
              <p className="text-lg font-semibold text-[#1E2F22]">{totalAssets}</p>
            </div>
            <div className="rounded-2xl border border-[#D6E2D6] bg-white/80 px-3 py-2">
              <p className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground">Selected</p>
              <p className="text-lg font-semibold text-[#1E2F22]">{selectedIds.size}</p>
            </div>
            <div className="rounded-2xl border border-[#D6E2D6] bg-white/80 px-3 py-2">
              <p className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground">Provider</p>
              <p className="text-sm font-semibold text-[#1E2F22]">{PROVIDER_META[provider].label}</p>
            </div>
            <div className="rounded-2xl border border-[#D6E2D6] bg-white/80 px-3 py-2">
              <p className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground">Folder</p>
              <p className="text-sm font-semibold text-[#1E2F22] truncate">
                {currentFolder ?? "All files"}
              </p>
            </div>
          </div>
        </div>
      </div>
      <div className="grid gap-6 lg:grid-cols-[260px_minmax(0,1fr)_320px]">
        <aside className="rounded-2xl border border-[#E5E5E0] bg-white/90 p-4 shadow-[0_14px_24px_rgba(34,63,41,0.08)]">
          <div className="space-y-4">
            <div className="space-y-2">
              <p className="text-[10px] font-black uppercase tracking-[0.3em] text-muted-foreground">
                Provider
              </p>
              <div className="inline-flex w-full items-center gap-1 rounded-full bg-muted p-1">
                {(["cloudinary", "tigris", "local"] as ProviderKey[]).map((key) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setProvider(key)}
                    className={cn(
                      "flex-1 rounded-full px-3 py-1.5 text-[11px] font-semibold transition-colors",
                      provider === key
                        ? "bg-background text-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {PROVIDER_META[key].label}
                  </button>
                ))}
              </div>
              <div className="rounded-xl border border-[#DCE8DB] bg-[#F6FAF5] px-3 py-2 text-[11px] text-muted-foreground">
                <p className="font-semibold text-[#203123]">
                  {PROVIDER_META[provider].quality} quality
                </p>
                <p>{PROVIDER_META[provider].description}</p>
              </div>
            </div>

            <div className="space-y-2">
              <p className="text-[10px] font-black uppercase tracking-[0.3em] text-muted-foreground">
                Category
              </p>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as ImageCategory)}
                className="h-9 w-full rounded-lg border border-muted bg-background px-3 text-sm"
              >
                {Object.entries(CATEGORY_LABELS).map(([key, label]) => (
                  <option key={key} value={key}>
                    {label}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-[10px] font-black uppercase tracking-[0.3em] text-muted-foreground">
                  Folders
                </p>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setCreateFolderOpen(true)}
                    className="h-7 w-7 rounded-full border border-border bg-white text-[#243226] shadow-sm hover:bg-muted"
                    aria-label="Create folder"
                  >
                    <FolderPlus className="mx-auto h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (!currentFolder) return;
                      if (!window.confirm("Delete this folder? This only works when empty.")) return;
                      deleteFolderMutation.mutate();
                    }}
                    className="h-7 w-7 rounded-full border border-border bg-white text-red-600 shadow-sm hover:bg-red-50"
                    aria-label="Delete folder"
                    disabled={!currentFolder || deleteFolderMutation.isPending}
                  >
                    <Trash2 className="mx-auto h-4 w-4" />
                  </button>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setCurrentFolder(null)}
                className={cn(
                  "w-full flex items-center justify-between rounded-lg px-2 py-2 text-left text-sm transition-colors",
                  currentFolder === null
                    ? "bg-[#1E2F22] text-white"
                    : "text-[#243226] hover:bg-muted",
                )}
              >
                <span className="flex items-center gap-2">
                  <span className="inline-flex h-6 w-6 items-center justify-center rounded-md bg-white/70 text-[#243226]">
                    <Folder className="h-3.5 w-3.5" />
                  </span>
                  All files
                </span>
                <span className="text-[10px] opacity-70">{totalAssets}</span>
              </button>

              <div className="space-y-2">
                {folderTree.length === 0 ? (
                  <p className="text-xs text-muted-foreground">No folders yet.</p>
                ) : (
                  folderTree.map((node) => renderFolderNode(node))
                )}
              </div>
            </div>
          </div>
        </aside>
        <section className="space-y-4">
          <div className="rounded-2xl border border-[#E5E5E0] bg-white/90 p-4 shadow-[0_14px_24px_rgba(34,63,41,0.08)]">
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2">
                <div className="relative w-full sm:w-72">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search assets or filenames"
                    className="h-9 pl-9"
                  />
                </div>
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as "createdAt" | "name" | "size")}
                  className="h-9 rounded-lg border border-muted bg-background px-3 text-sm"
                >
                  {SORT_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
                <Button
                  type="button"
                  variant="outline"
                  className="h-9 px-3"
                  onClick={() => setSortDir((prev) => (prev === "asc" ? "desc" : "asc"))}
                >
                  <ArrowDownAZ className="mr-2 h-4 w-4" />
                  {sortDir === "asc" ? "Ascending" : "Descending"}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className={cn("h-9 px-3", showExpired && "bg-muted")}
                  onClick={() => setShowExpired((prev) => !prev)}
                >
                  <Clock className="mr-2 h-4 w-4" />
                  {showExpired ? "Showing expired" : "Hide expired"}
                </Button>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  className={cn("h-9 px-3", viewMode === "grid" && "bg-muted")}
                  onClick={() => setViewMode("grid")}
                >
                  <Grid2X2 className="mr-2 h-4 w-4" />
                  Grid
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className={cn("h-9 px-3", viewMode === "list" && "bg-muted")}
                  onClick={() => setViewMode("list")}
                >
                  <List className="mr-2 h-4 w-4" />
                  List
                </Button>
              </div>
            </div>

            {selectedIds.size > 0 && (
              <div className="mt-4 rounded-2xl border border-[#E5E5E0] bg-[#F6FAF5] p-3">
                <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
                  <p className="text-sm text-[#243226] font-semibold">
                    {selectedIds.size} asset(s) selected
                  </p>
                  <div className="flex flex-wrap items-center gap-2">
                    <select
                      value={bulkMoveTarget}
                      onChange={(e) => setBulkMoveTarget(e.target.value)}
                      className="h-9 rounded-lg border border-muted bg-background px-3 text-sm"
                    >
                      <option value="root">Move to root</option>
                      {folderOptions.map((path) => (
                        <option key={path} value={path}>
                          {path}
                        </option>
                      ))}
                    </select>
                    <Button
                      type="button"
                      className="h-9 px-4"
                      onClick={() => bulkMoveMutation.mutate(Array.from(selectedIds))}
                      disabled={bulkMoveMutation.isPending}
                    >
                      <MoveRight className="mr-2 h-4 w-4" />
                      Move selected
                    </Button>
                    <Button
                      type="button"
                      variant="destructive"
                      className="h-9 px-4"
                      onClick={() => {
                        if (!window.confirm("Delete selected assets?")) return;
                        bulkDeleteMutation.mutate(Array.from(selectedIds));
                      }}
                      disabled={bulkDeleteMutation.isPending}
                    >
                      <Trash2 className="mr-2 h-4 w-4" />
                      Delete
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </div>
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
              addUploadFiles(e.dataTransfer.files);
            }}
            className={cn(
              "rounded-2xl border-2 border-dashed p-5 text-center transition-all",
              isDragging
                ? "border-primary bg-primary/5"
                : "border-[#E5E5E0] bg-white/80 hover:border-primary/50",
            )}
          >
            <p className="text-[11px] font-black uppercase tracking-[0.25em] text-muted-foreground">
              Drop images here
            </p>
            <p className="text-xs text-muted-foreground">
              Upload to {PROVIDER_META[provider].label}. Max {MAX_IMAGE_SIZE_LABEL} per file.
            </p>
            <div className="mt-3 flex flex-col lg:flex-row lg:items-center lg:justify-center gap-3">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={(e) => {
                  addUploadFiles(e.target.files);
                  e.currentTarget.value = "";
                }}
              />
              <Button
                type="button"
                variant="outline"
                className="h-9 px-4"
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload className="mr-2 h-4 w-4" />
                Select files
              </Button>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Calendar className="h-4 w-4" />
                Expiry:
                <button
                  type="button"
                  className={cn(
                    "rounded-full px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.2em]",
                    expiryMode === "none"
                      ? "bg-[#223C2A] text-white"
                      : "bg-muted text-muted-foreground",
                  )}
                  onClick={() => setExpiryMode("none")}
                >
                  None
                </button>
                <button
                  type="button"
                  className={cn(
                    "rounded-full px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.2em]",
                    expiryMode === "custom"
                      ? "bg-[#223C2A] text-white"
                      : "bg-muted text-muted-foreground",
                  )}
                  onClick={() => setExpiryMode("custom")}
                >
                  Custom
                </button>
              </div>
            </div>
            {expiryMode === "custom" && (
              <div className="mt-3 flex flex-col sm:flex-row items-center justify-center gap-2">
                <input
                  type="date"
                  value={expiryDate}
                  onChange={(e) => setExpiryDate(e.target.value)}
                  className="h-9 rounded-lg border border-muted bg-background px-3 text-sm"
                />
                <input
                  type="time"
                  value={expiryTime}
                  onChange={(e) => setExpiryTime(e.target.value)}
                  className="h-9 rounded-lg border border-muted bg-background px-3 text-sm"
                />
              </div>
            )}
            {uploadQueue.length > 0 && (
              <div className="mt-4 space-y-3 text-left">
                <div className="flex items-center justify-between">
                  <p className="text-xs text-muted-foreground">
                    {uploadQueue.length} file(s) ready
                  </p>
                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-8 text-[10px] font-black uppercase tracking-[0.25em]"
                      onClick={() => setUploadQueue([])}
                      disabled={isBulkUploading}
                    >
                      Clear
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      className="h-8 text-[10px] font-black uppercase tracking-[0.25em]"
                      onClick={handleUploadQueue}
                      disabled={isBulkUploading}
                    >
                      {isBulkUploading ? "Uploading…" : "Upload all"}
                    </Button>
                  </div>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                  {uploadQueue.map((item) => (
                    <div
                      key={item.id}
                      className="rounded-xl border border-border bg-white overflow-hidden"
                    >
                      <div className="aspect-square bg-muted">
                        <img
                          src={item.previewUrl}
                          alt={item.file.name}
                          className="h-full w-full object-cover"
                        />
                      </div>
                      <div className="p-2 space-y-1">
                        <p className="text-[10px] font-medium truncate">{item.file.name}</p>
                        <p className="text-[10px] text-muted-foreground">
                          {(item.file.size / 1024 / 1024).toFixed(2)} MB
                        </p>
                        {(item.status === "uploading" || item.status === "success") && (
                          <UploadProgress
                            value={item.progress}
                            label="Upload progress"
                            className="max-w-none"
                          />
                        )}
                        {item.tooLarge && (
                          <p className="text-[10px] text-red-500">
                            Exceeds {MAX_IMAGE_SIZE_LABEL}
                          </p>
                        )}
                        <p className="text-[10px]">
                          {item.status === "idle" && "Waiting"}
                          {item.status === "uploading" && "Uploading…"}
                          {item.status === "success" && "Done ✓"}
                          {item.status === "error" && (
                            <span className="text-red-500">
                              Failed {item.error ? `— ${item.error}` : ""}
                            </span>
                          )}
                          {item.status === "skipped" && "Skipped"}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
          <div className="rounded-2xl border border-[#E5E5E0] bg-white/90 p-4 shadow-[0_14px_24px_rgba(34,63,41,0.08)]">
            {assetsQuery.isLoading ? (
              <div className="py-12 text-center text-sm text-muted-foreground">
                Loading assets…
              </div>
            ) : filteredAssets.length === 0 ? (
              <div className="py-12 text-center text-sm text-muted-foreground">
                No assets found in this folder.
              </div>
            ) : viewMode === "grid" ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                {filteredAssets.map((asset) => {
                  const isSelected = selectedIds.has(asset.id);
                  const displayName = getDisplayName(asset.filename ?? asset.url);
                  const expiresLabel = formatExpiryLabel(asset.expiresAt);
                  return (
                    <div
                      key={asset.id}
                      className={cn(
                        "group relative rounded-2xl border bg-white overflow-hidden shadow-sm transition-shadow hover:shadow-lg",
                        isSelected
                          ? "border-primary ring-2 ring-primary/40"
                          : "border-muted/40",
                      )}
                      onClick={() => setSelectedAssetId(asset.id)}
                    >
                      <div className="relative aspect-square cursor-pointer">
                        <img
                          src={asset.url ?? ""}
                          alt={displayName}
                          className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                          loading="lazy"
                        />
                        <label className="absolute top-2 left-2 inline-flex items-center justify-center rounded-full bg-black/60 text-white h-7 w-7">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => {
                              setSelectedIds((prev) => {
                                const next = new Set(prev);
                                if (next.has(asset.id)) next.delete(asset.id);
                                else next.add(asset.id);
                                return next;
                              });
                            }}
                            onClick={(e) => e.stopPropagation()}
                            className="h-4 w-4 accent-primary"
                            aria-label={`Select ${displayName}`}
                          />
                        </label>
                      </div>
                      <div className="p-2 space-y-1 bg-background">
                        <p className="text-[11px] text-foreground truncate" title={displayName}>
                          {displayName}
                        </p>
                        <p className="text-[10px] text-muted-foreground truncate">
                          {asset.folderPath ? asset.folderPath : "Root"}
                        </p>
                        <p className="text-[10px] text-muted-foreground">{expiresLabel}</p>
                      </div>
                      <div className="absolute top-2 right-2 flex flex-col gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedAssetId(asset.id);
                          }}
                          className="h-8 w-8 rounded-full bg-black/60 text-white flex items-center justify-center hover:bg-black/80"
                          aria-label="Preview"
                        >
                          <Eye className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            navigator.clipboard.writeText(getAbsoluteAssetUrl(asset.url));
                            toast({ title: "URL copied" });
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
                            if (!window.confirm("Delete this asset?")) return;
                            deleteMutation.mutate(asset.id);
                          }}
                          className="h-8 w-8 rounded-full bg-red-500/80 text-white flex items-center justify-center hover:bg-red-600"
                          aria-label="Delete asset"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="space-y-2">
                {filteredAssets.map((asset) => {
                  const displayName = getDisplayName(asset.filename ?? asset.url);
                  const isSelected = selectedIds.has(asset.id);
                  return (
                    <div
                      key={asset.id}
                      className={cn(
                        "flex items-center justify-between rounded-2xl border bg-white px-4 py-3 transition-shadow",
                        isSelected ? "border-primary ring-2 ring-primary/40" : "border-muted/40",
                      )}
                      onClick={() => setSelectedAssetId(asset.id)}
                    >
                      <div className="flex items-center gap-3">
                        <label className="inline-flex items-center justify-center rounded-full bg-muted h-6 w-6">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => {
                              setSelectedIds((prev) => {
                                const next = new Set(prev);
                                if (next.has(asset.id)) next.delete(asset.id);
                                else next.add(asset.id);
                                return next;
                              });
                            }}
                            onClick={(e) => e.stopPropagation()}
                            className="h-4 w-4 accent-primary"
                            aria-label={`Select ${displayName}`}
                          />
                        </label>
                        <div className="h-12 w-12 overflow-hidden rounded-xl bg-muted">
                          <img
                            src={asset.url ?? ""}
                            alt={displayName}
                            className="h-full w-full object-cover"
                          />
                        </div>
                        <div>
                          <p className="text-sm font-medium">{displayName}</p>
                          <p className="text-xs text-muted-foreground">
                            {asset.folderPath ?? "Root"} • {formatBytes(asset.bytes)}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <span>{formatExpiryLabel(asset.expiresAt)}</span>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            navigator.clipboard.writeText(getAbsoluteAssetUrl(asset.url));
                            toast({ title: "URL copied" });
                          }}
                        >
                          <Copy className="h-4 w-4" />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (!window.confirm("Delete this asset?")) return;
                            deleteMutation.mutate(asset.id);
                          }}
                        >
                          <Trash2 className="h-4 w-4 text-red-500" />
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
          <div className="rounded-xl border border-border overflow-hidden shadow-sm bg-white">
            <Pagination
              currentPage={page}
              totalPages={totalPages}
              onPageChange={(nextPage) => setPage(nextPage)}
              totalItems={totalAssets}
              pageSize={pageSize}
              onPageSizeChange={setPageSize}
            />
          </div>
        </section>
        <aside className="rounded-2xl border border-[#E5E5E0] bg-white/90 p-4 shadow-[0_14px_24px_rgba(34,63,41,0.08)]">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.3em] text-muted-foreground">
                  Inspector
                </p>
                <p className="text-sm font-semibold text-[#1E2F22]">
                  {selectedAsset ? "Asset details" : "No asset selected"}
                </p>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={deleteExpired}
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Delete expired
              </Button>
            </div>

            {!selectedAsset ? (
              <div className="rounded-2xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
                Select an asset to view its metadata and controls.
              </div>
            ) : (
              <div className="space-y-4">
                <div className="overflow-hidden rounded-2xl border border-border bg-muted">
                  <img
                    src={selectedAsset.url ?? ""}
                    alt={selectedAsset.filename ?? "Asset preview"}
                    className="h-48 w-full object-cover"
                  />
                </div>

                <div className="space-y-2 text-sm">
                  <div>
                    <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Name</p>
                    <p className="font-medium">
                      {getDisplayName(selectedAsset.filename ?? selectedAsset.url)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Provider</p>
                    <p className="font-medium capitalize">{selectedAsset.provider}</p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Folder</p>
                    <p className="font-medium">{selectedAsset.folderPath ?? "Root"}</p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Size</p>
                    <p className="font-medium">{formatBytes(selectedAsset.bytes)}</p>
                  </div>
                </div>

                <div className="rounded-2xl border border-border bg-muted/20 p-3 space-y-2">
                  <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">URL</p>
                  <p className="text-xs break-all">{getAbsoluteAssetUrl(selectedAsset.url)}</p>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="w-full"
                    onClick={() => {
                      navigator.clipboard.writeText(getAbsoluteAssetUrl(selectedAsset.url));
                      toast({ title: "URL copied" });
                    }}
                  >
                    <Copy className="mr-2 h-4 w-4" />
                    Copy URL
                  </Button>
                </div>

                <div className="space-y-2">
                  <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                    Move to folder
                  </p>
                  <select
                    value={selectedAsset.folderPath ?? "root"}
                    onChange={(e) => {
                      const value = e.target.value;
                      moveSingleMutation.mutate({
                        id: selectedAsset.id,
                        folderPath: value === "root" ? null : value,
                      });
                    }}
                    className="h-9 w-full rounded-lg border border-muted bg-background px-3 text-sm"
                  >
                    <option value="root">Root</option>
                    {folderOptions.map((path) => (
                      <option key={path} value={path}>
                        {path}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-2">
                  <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Expiry</p>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Clock className="h-4 w-4" />
                    {formatExpiryLabel(selectedAsset.expiresAt)}
                  </div>
                  <div className="flex flex-col gap-2">
                    <input
                      type="datetime-local"
                      value={
                        selectedAsset.expiresAt
                          ? new Date(selectedAsset.expiresAt).toISOString().slice(0, 16)
                          : ""
                      }
                      onChange={(e) =>
                        updateExpiryMutation.mutate({
                          id: selectedAsset.id,
                          expiresAt: e.target.value ? new Date(e.target.value).toISOString() : null,
                        })
                      }
                      className="h-9 rounded-lg border border-muted bg-background px-3 text-sm"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        updateExpiryMutation.mutate({ id: selectedAsset.id, expiresAt: null })
                      }
                    >
                      Clear expiry
                    </Button>
                  </div>
                </div>

                <Button
                  type="button"
                  variant="destructive"
                  className="w-full"
                  onClick={() => {
                    if (!window.confirm("Delete this asset?")) return;
                    deleteMutation.mutate(selectedAsset.id);
                  }}
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete asset
                </Button>
              </div>
            )}
          </div>
        </aside>
      </div>
      <Dialog open={createFolderOpen} onOpenChange={setCreateFolderOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Create Folder</DialogTitle>
            <DialogDescription>
              Create a folder marker to organize uploads in {PROVIDER_META[provider].label}.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Folder name</p>
              <Input
                value={folderName}
                onChange={(e) => setFolderName(e.target.value)}
                placeholder="e.g. summer/catalog"
              />
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Parent</p>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setFolderParentMode("current")}
                  className={cn(
                    "rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em]",
                    folderParentMode === "current"
                      ? "bg-[#223C2A] text-white"
                      : "bg-muted text-muted-foreground",
                  )}
                >
                  Current
                </button>
                <button
                  type="button"
                  onClick={() => setFolderParentMode("root")}
                  className={cn(
                    "rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em]",
                    folderParentMode === "root"
                      ? "bg-[#223C2A] text-white"
                      : "bg-muted text-muted-foreground",
                  )}
                >
                  Root
                </button>
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                Parent folder: {folderParentMode === "current" ? currentFolder ?? "Root" : "Root"}
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateFolderOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => createFolderMutation.mutate()}
              loading={createFolderMutation.isPending}
              loadingText="Creating..."
            >
              Create folder
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
