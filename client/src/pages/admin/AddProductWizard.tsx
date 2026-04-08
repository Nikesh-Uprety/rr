import { useState, useMemo, useCallback, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { useForm } from "react-hook-form";
import { useQuery } from "@tanstack/react-query";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft, ArrowRight, Check, Upload, X, Plus, Palette, Ruler,
  FolderInput, ImageIcon, FileText, Tag, Percent, Cloud, HardDrive,
} from "lucide-react";
import { Legend, Pie, PieChart as RechartsPieChart, ResponsiveContainer, Cell, Tooltip } from "recharts";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { cn } from "@/lib/utils";
import { formatPrice } from "@/lib/format";
import { compressImageFile } from "@/lib/imageUtils";
import { uploadProductImageFile, uploadAdminImage, fetchAdminAttributes, type ProductAttribute } from "@/lib/adminApi";
import { QuantityInput } from "@/components/ui/quantity-input";
import { PriceInput } from "@/components/ui/price-input";
import { UploadProgress } from "@/components/ui/upload-progress";
import type { CategoryApi } from "@/lib/api";
import { apiRequest, getErrorMessage } from "@/lib/queryClient";
import { syncStockBySizeToSizes } from "./productStock";

const productSchema = z.object({
  name: z.string().min(2, "Name required"),
  shortDetails: z.string().optional(),
  description: z.string().optional(),
  category: z.string().optional(),
  price: z.coerce.number().min(1, "Price required"),
  stockStatus: z.enum(["in_stock", "out_of_stock"]),
  stock: z.coerce.number().min(0).default(0),
  stockBySize: z.record(z.string(), z.coerce.number().min(0)).default({}),
  imageUrl: z.string().optional(),
  galleryUrlsText: z.string().optional(),
  colorOptions: z.array(z.string()),
  sizeOptions: z.array(z.string()),
  salePercentage: z.coerce.number().min(0).max(100).default(0),
  saleActive: z.boolean().default(false),
});

type ProductFormValues = z.infer<typeof productSchema>;

const DEFAULT_SIZES = ["S", "M", "L", "XL"];
const DEFAULT_COLORS = ["Black", "White", "Red", "Navy", "Olive", "Sand", "Charcoal"];
const IMAGE_CATEGORIES = [
  { value: "product", label: "Product Images" },
  { value: "website", label: "Website Assets" },
  { value: "model", label: "Model Shots" },
  { value: "landing_page", label: "Landing Pages" },
  { value: "collection_page", label: "Collection Pages" },
];

interface AddProductWizardProps {
  categories: CategoryApi[];
  onCategoryCreated?: (category: CategoryApi) => void;
  addForm: any;
  addMutation: any;
  onClose: () => void;
  imageInputRef: React.RefObject<HTMLInputElement | null>;
  galleryInputRef: React.RefObject<HTMLInputElement | null>;
  pendingGalleryImages: Array<{ id: string; file: File; previewUrl: string }>;
  setPendingGalleryImages: React.Dispatch<React.SetStateAction<Array<{ id: string; file: File; previewUrl: string }>>>;
  setUploadingImage: (v: boolean) => void;
  toast: any;
  onMediaLibraryOpen: (target: string) => void;
  galleryUploadStatus?: {
    mode: "add" | "edit";
    completed: number;
    total: number;
    progress: number;
  } | null;
}

export default function AddProductWizard({
  categories,
  onCategoryCreated,
  addForm,
  addMutation,
  onClose,
  imageInputRef,
  galleryInputRef,
  pendingGalleryImages,
  setPendingGalleryImages,
  setUploadingImage,
  toast,
  onMediaLibraryOpen,
  galleryUploadStatus,
}: AddProductWizardProps) {
  const [step, setStep] = useState(1);
  const [customColors, setCustomColors] = useState<string[]>([]);
  const [customSizes, setCustomSizes] = useState<string[]>([]);
  const [newColorHex, setNewColorHex] = useState("#000000");
  const [newColorName, setNewColorName] = useState("");
  const [newSizeInput, setNewSizeInput] = useState("");
  const [showNewCategoryInput, setShowNewCategoryInput] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [creatingCategory, setCreatingCategory] = useState(false);
  const portalContainerRef = useRef<HTMLDivElement | null>(null);
  if (!portalContainerRef.current && typeof document !== "undefined") {
    portalContainerRef.current = document.createElement("div");
  }

  // Image upload state
  const [uploadMode, setUploadMode] = useState<"cloudinary" | "tigris" | "local">("cloudinary");
  const [imageCategory, setImageCategory] = useState("product");
  const [mainUploading, setMainUploading] = useState(false);
  const [galleryUploading, setGalleryUploading] = useState(false);
  const [mainUploadProgress, setMainUploadProgress] = useState(0);
  const [galleryUploadProgress, setGalleryUploadProgress] = useState(0);
  const [galleryUploadMode, setGalleryUploadMode] = useState<"cloudinary" | "tigris" | "local">("cloudinary");
  const [galleryImageCategory, setGalleryImageCategory] = useState("product");

  // Attributes from DB
  const { data: attributes } = useQuery<ProductAttribute[]>({
    queryKey: ["admin", "attributes"],
    queryFn: () => fetchAdminAttributes(),
  });

  const attributeColors = useMemo(() => {
    const colors: string[] = [];
    (attributes ?? []).filter(a => a.type === "color").forEach(a => {
      const [label, hex] = a.value.split("|");
      if (label?.trim()) colors.push(`${label.trim()} (${hex?.trim() || "#000000"})`);
    });
    return colors;
  }, [attributes]);

  const availableColors = useMemo(() => {
    return [...DEFAULT_COLORS, ...attributeColors, ...customColors];
  }, [attributeColors, customColors]);

  const availableSizes = useMemo(() => {
    return [...DEFAULT_SIZES, ...customSizes];
  }, [customSizes]);

  const selectedColors = addForm.watch("colorOptions") || [];
  const selectedSizes = addForm.watch("sizeOptions") || [];

  // Initialize default sizes on mount
  useEffect(() => {
    const current = addForm.getValues("sizeOptions") || [];
    if (current.length === 0) {
      addForm.setValue("sizeOptions", [...DEFAULT_SIZES], { shouldValidate: false, shouldDirty: false });
    }
  }, []);

  useEffect(() => {
    if (!categories.length) return;
    const current = addForm.getValues("category");
    const exists = categories.some((c) => c.slug === current);
    if (!current || !exists) {
      addForm.setValue("category", categories[0].slug, { shouldValidate: true, shouldDirty: false });
    }
  }, [categories, addForm]);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    const previousOverscroll = document.body.style.overscrollBehavior;
    document.body.style.overflow = "hidden";
    document.body.style.overscrollBehavior = "none";

    const container = portalContainerRef.current;
    if (container) {
      container.className = "fixed inset-0 z-[100] overflow-hidden bg-[#eef4ea] dark:bg-[#0e1511]";
      document.body.appendChild(container);
    }

    return () => {
      document.body.style.overflow = previousOverflow;
      document.body.style.overscrollBehavior = previousOverscroll;
      if (container && container.parentNode) {
        container.parentNode.removeChild(container);
      }
    };
  }, []);

  const toggleColor = useCallback((color: string) => {
    const currentColors = addForm.getValues("colorOptions") || [];
    const next = currentColors.includes(color)
      ? currentColors.filter((c: string) => c !== color)
      : [...currentColors, color];
    addForm.setValue("colorOptions", next, { shouldValidate: false, shouldDirty: false });
  }, [addForm]);

  const toggleSize = useCallback((size: string) => {
    const currentSizes = addForm.getValues("sizeOptions") || [];
    const next = currentSizes.includes(size)
      ? currentSizes.filter((s: string) => s !== size)
      : [...currentSizes, size];
    addForm.setValue("sizeOptions", next, { shouldValidate: false, shouldDirty: true });
    addForm.setValue("stockBySize", syncStockBySizeToSizes(addForm.getValues("stockBySize"), next), {
      shouldValidate: false,
      shouldDirty: true,
    });
  }, [addForm]);

  const addCustomColor = () => {
    if (!newColorName.trim()) return;
    const label = `${newColorName.trim()} (${newColorHex})`;
    if (!customColors.includes(label)) {
      setCustomColors((prev) => [...prev, label]);
    }
    setNewColorName("");
  };

  const addCustomSize = () => {
    const trimmed = newSizeInput.trim().toUpperCase();
    if (!trimmed || availableSizes.includes(trimmed)) return;
    setCustomSizes((prev) => [...prev, trimmed]);
    // Also add to form
    const currentSizes = addForm.getValues("sizeOptions") || [];
    if (!currentSizes.includes(trimmed)) {
      const nextSizes = [...currentSizes, trimmed];
      addForm.setValue("sizeOptions", nextSizes, { shouldValidate: false, shouldDirty: true });
      addForm.setValue("stockBySize", syncStockBySizeToSizes(addForm.getValues("stockBySize"), nextSizes), {
        shouldValidate: false,
        shouldDirty: true,
      });
    }
    setNewSizeInput("");
  };

  const handleCreateCategory = async () => {
    if (!newCategoryName.trim()) return;
    setCreatingCategory(true);
    try {
      const slug = newCategoryName.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
      const res = await apiRequest("POST", "/api/admin/categories", {
        name: newCategoryName.trim(),
        slug,
      });
      const data = await res.json();
      const newCat = data.data || data;
      if (onCategoryCreated) onCategoryCreated(newCat);
      addForm.setValue("category", newCat.slug, { shouldValidate: true });
      setNewCategoryName("");
      setShowNewCategoryInput(false);
      toast({ title: "Category created", description: `"${newCat.name}" added and selected` });
    } catch (error) {
      toast({
        title: "Failed to create category",
        description: getErrorMessage(error, "Please choose a different category name."),
        variant: "destructive",
      });
    } finally {
      setCreatingCategory(false);
    }
  };

  const canProceedStep1 = addForm.watch("name")?.length >= 2 && addForm.watch("price") >= 1;
  const canProceedStep2 = true;
  const stockBySizeValues = addForm.watch("stockBySize") || {};
  const productName = addForm.watch("name") || "Untitled product";
  const productTagline = addForm.watch("shortDetails") || "A polished new product waiting for its final story.";
  const productDescription =
    addForm.watch("description") || "Use this space to frame the fit, material, and energy of the piece before it goes live.";
  const productPrice = Number(addForm.watch("price")) || 0;
  const galleryUrls = ((addForm.watch("galleryUrlsText") || "") as string)
    .split(/\n/)
    .map((u: string) => u.trim())
    .filter(Boolean);
  const mainImageUrl = addForm.watch("imageUrl") || galleryUrls[0] || null;
  const saleIsActive = !!addForm.watch("saleActive");
  const salePercentage = Number(addForm.watch("salePercentage")) || 0;
  const discountedPrice =
    saleIsActive && productPrice > 0
      ? Math.max(0, Math.round(productPrice * (1 - salePercentage / 100)))
      : productPrice;
  const totalStock = selectedSizes.reduce((total: number, size: string) => {
    return total + (stockBySizeValues[size] ?? 0);
  }, 0);

  const steps = [
    { num: 1, label: "Details", icon: FileText },
    { num: 2, label: "Attributes", icon: Tag },
    { num: 3, label: "Media", icon: ImageIcon },
  ];

  const getProviderLabel = (provider: "cloudinary" | "tigris" | "local") => {
    if (provider === "cloudinary") return "Cloudinary";
    if (provider === "tigris") return "Tigris";
    return "Local";
  };

  // Remote provider upload handler (Cloudinary/Tigris)
  const handleRemoteUpload = async (
    provider: "cloudinary" | "tigris",
    file: File,
    target: "main" | "gallery",
  ) => {
    if (target === "main") {
      setMainUploading(true);
      setMainUploadProgress(0);
    } else {
      setGalleryUploading(true);
      setGalleryUploadProgress(0);
    }
    try {
      const result = await uploadAdminImage({
        file,
        category: target === "main" ? imageCategory : galleryImageCategory,
        provider,
        onProgress: (value) => {
          if (target === "main") {
            setMainUploadProgress(value);
          } else {
            setGalleryUploadProgress(value);
          }
        },
      });
      if (!result.url) {
        throw new Error("Upload did not return a valid URL");
      }
      if (target === "main") {
        addForm.setValue("imageUrl", result.url, { shouldValidate: true, shouldDirty: true });
      } else {
        const currentText = addForm.getValues("galleryUrlsText") || "";
        const current = currentText.split(/\n/).map((u: string) => u.trim()).filter(Boolean);
        addForm.setValue("galleryUrlsText", [...current, result.url].join("\n"), { shouldValidate: true, shouldDirty: true });
      }
      toast({ title: `Image uploaded to ${getProviderLabel(provider)}` });
    } catch {
      toast({ title: `${getProviderLabel(provider)} upload failed`, variant: "destructive" });
    } finally {
      if (target === "main") {
        setMainUploadProgress(100);
        setTimeout(() => setMainUploadProgress(0), 600);
        setMainUploading(false);
      } else {
        setGalleryUploadProgress(100);
        setTimeout(() => setGalleryUploadProgress(0), 600);
        setGalleryUploading(false);
      }
    }
  };

  // Local upload handler
  const handleLocalUpload = async (file: File, target: "main" | "gallery") => {
    setUploadingImage(true);
    if (target === "main") {
      setMainUploading(true);
      setMainUploadProgress(0);
    } else {
      setGalleryUploading(true);
      setGalleryUploadProgress(0);
    }
    try {
      const compressedFile = await compressImageFile(file);
      const url = await uploadProductImageFile(compressedFile, (value) => {
        if (target === "main") {
          setMainUploadProgress(value);
        } else {
          setGalleryUploadProgress(value);
        }
      });
      if (target === "main") {
        addForm.setValue("imageUrl", url, { shouldValidate: true, shouldDirty: true });
      } else {
        const currentText = addForm.getValues("galleryUrlsText") || "";
        const current = currentText.split(/\n/).map((u: string) => u.trim()).filter(Boolean);
        addForm.setValue("galleryUrlsText", [...current, url].join("\n"), { shouldValidate: true, shouldDirty: true });
      }
      toast({ title: "Image uploaded locally" });
    } catch {
      toast({ title: "Upload failed", variant: "destructive" });
    } finally {
      setUploadingImage(false);
      if (target === "main") {
        setMainUploadProgress(100);
        setTimeout(() => setMainUploadProgress(0), 600);
        setMainUploading(false);
      } else {
        setGalleryUploadProgress(100);
        setTimeout(() => setGalleryUploadProgress(0), 600);
        setGalleryUploading(false);
      }
    }
  };

  const pieChartData = useMemo(() => {
    const data: { name: string; value: number; fill: string }[] = [];
    if (selectedColors.length > 0) {
      const colorPalette = ["#81a074", "#b33a2f", "#223227", "#d4c5a9", "#6b7c62", "#a89f8f", "#4a5d4e", "#c9b99a"];
      selectedColors.forEach((color: string, i: number) => {
        const hexMatch = color.match(/\((#[0-9a-fA-F]{6})\)/);
        data.push({
          name: color.replace(/\s*\(#[0-9a-fA-F]{6}\)/, ""),
          value: 1,
          fill: hexMatch ? hexMatch[1] : colorPalette[i % colorPalette.length],
        });
      });
    }
    if (data.length === 0) {
      data.push({ name: "No colors", value: 1, fill: "#d1d5db" });
    }
    return data;
  }, [selectedColors]);

  const sizeStockData = useMemo(() => {
    if (selectedSizes.length === 0 || totalStock === 0) return [];
    const maxStock = Math.max(...selectedSizes.map((s: string) => stockBySizeValues[s] ?? 0), 1);
    return selectedSizes.map((size: string) => ({
      size,
      stock: stockBySizeValues[size] ?? 0,
      pct: Math.round(((stockBySizeValues[size] ?? 0) / maxStock) * 100),
    }));
  }, [selectedSizes, stockBySizeValues, totalStock]);

  const CustomTooltipContent = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="rounded-xl border border-black/10 bg-white/95 px-3 py-2 shadow-lg dark:border-white/10 dark:bg-[#1a211c]">
          <p className="text-xs font-semibold text-[#223227] dark:text-white">{payload[0].name}</p>
          <p className="text-[10px] text-muted-foreground">
            {payload[0].payload.name.startsWith("Size") ? `${payload[0].value} units` : "Selected"}
          </p>
        </div>
      );
    }
    return null;
  };

  const renderLivePreview = (variant: "details" | "attributes" | "media") => (
    <div className="xl:sticky xl:top-[9.5rem] xl:max-h-[calc(100vh-12rem)] xl:overflow-y-auto xl:pr-1 space-y-6 pb-2">
      <div className="rounded-[32px] border border-black/5 bg-white/90 p-6 shadow-[0_24px_70px_rgba(34,63,41,0.08)] dark:border-white/10 dark:bg-white/[0.04] dark:shadow-none">
        <div className="mb-5 flex items-center justify-between">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-muted-foreground">Live Preview</p>
            <h3 className="mt-2 text-lg font-semibold text-[#223227] dark:text-white">Product Storyboard</h3>
          </div>
          <Badge variant="outline" className="rounded-full">{variant === "details" ? "Analytics" : variant === "attributes" ? "Merch" : "Media"}</Badge>
        </div>

        <div className="relative overflow-hidden rounded-[28px] border border-black/10 bg-[#f8f5ef] dark:border-white/10 dark:bg-[#171d18]">
          <div className="relative aspect-square overflow-hidden">
            {mainImageUrl ? (
              <img src={mainImageUrl} alt={productName} className="h-full w-full object-cover opacity-20 blur-[2px]" />
            ) : (
              <div className="flex h-full items-center justify-center bg-[radial-gradient(circle_at_top,rgba(129,160,116,0.22),transparent_32%),linear-gradient(180deg,#efe9dd_0%,#ddd4c2_100%)] dark:bg-[radial-gradient(circle_at_top,rgba(129,160,116,0.18),transparent_28%),linear-gradient(180deg,#1b211d_0%,#131814_100%)]" />
            )}

            <div className="absolute inset-0 flex items-center justify-center">
              <div className="relative flex h-[85%] w-[85%] items-center justify-center">
                <ResponsiveContainer width="100%" height="100%">
                  <RechartsPieChart>
                    <Pie
                      isAnimationActive
                      animationDuration={600}
                      startAngle={90}
                      endAngle={-270}
                      stroke="none"
                      data={pieChartData}
                      dataKey="value"
                      nameKey="name"
                      innerRadius="55%"
                      outerRadius="85%"
                      paddingAngle={2}
                    >
                      {pieChartData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.fill} />
                      ))}
                    </Pie>
                    <Tooltip content={<CustomTooltipContent />} />
                  </RechartsPieChart>
                </ResponsiveContainer>

                <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                  {mainImageUrl ? (
                    <img src={mainImageUrl} alt={productName} className="h-16 w-16 rounded-full border-2 border-white/80 object-cover shadow-md dark:border-white/20" />
                  ) : (
                    <div className="flex h-16 w-16 items-center justify-center rounded-full border-2 border-black/10 bg-white/60 dark:border-white/10 dark:bg-white/5">
                      <ImageIcon className="h-6 w-6 opacity-40" />
                    </div>
                  )}
                  <h4 className="mt-2 max-w-[12ch] truncate text-sm font-bold text-[#223227] dark:text-white">{productName}</h4>
                  <p className="text-[10px] text-muted-foreground">{addForm.watch("category") || "Category"}</p>
                </div>
              </div>
            </div>

            <div className="absolute inset-x-0 top-3 flex items-start justify-between px-4">
              {saleIsActive ? (
                <Badge className="rounded-full bg-[#b33a2f] text-white hover:bg-[#b33a2f]">
                  {salePercentage}% OFF
                </Badge>
              ) : <div />}
              <div className="rounded-full bg-white/80 px-3 py-1.5 text-xs font-black text-[#223227] backdrop-blur dark:bg-black/40 dark:text-white">
                {productPrice ? formatPrice(discountedPrice) : "NPR —"}
                {saleIsActive && productPrice > 0 && (
                  <span className="ml-1 text-[10px] font-normal text-muted-foreground line-through">{formatPrice(productPrice)}</span>
                )}
              </div>
            </div>
          </div>

          <div className="border-t border-black/5 bg-white/60 px-4 py-3 dark:border-white/10 dark:bg-white/[0.02]">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1.5">
                  <div className="h-2 w-2 rounded-full bg-[#81a074]" />
                  <span className="text-[10px] font-medium text-muted-foreground">{selectedColors.length} colors</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="h-2 w-2 rounded-full bg-[#223227]" />
                  <span className="text-[10px] font-medium text-muted-foreground">{selectedSizes.length} sizes</span>
                </div>
              </div>
              <div className="rounded-full bg-[#eff4eb] px-3 py-1 text-xs font-bold text-[#223227] dark:bg-white/[0.04] dark:text-white">
                {addForm.watch("stockStatus") === "out_of_stock" ? "Out of Stock" : `${totalStock || "—"} stock`}
              </div>
            </div>
          </div>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-3">
          <div className="rounded-2xl border border-black/5 bg-[#fbfaf7] p-3 dark:border-white/10 dark:bg-white/[0.02]">
            <p className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground">Overview</p>
            <p className="mt-1.5 text-xs leading-5 text-[#425246] dark:text-white/78 line-clamp-3">{productDescription}</p>
          </div>
          <div className="space-y-3">
            <div className="rounded-2xl border border-black/5 bg-[#fbfaf7] p-3 dark:border-white/10 dark:bg-white/[0.02]">
              <p className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground">Colors</p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {selectedColors.length ? selectedColors.slice(0, 3).map((color: string) => (
                  <Badge key={color} variant="outline" className="rounded-full text-[10px] px-2 py-0">{color.replace(/\s*\(#[0-9a-fA-F]{6}\)/, "")}</Badge>
                )) : <span className="text-[10px] text-muted-foreground">None</span>}
              </div>
            </div>
            <div className="rounded-2xl border border-black/5 bg-[#fbfaf7] p-3 dark:border-white/10 dark:bg-white/[0.02]">
              <p className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground">Gallery</p>
              <p className="mt-1 text-xs font-bold text-[#223227] dark:text-white">{galleryUrls.length} images</p>
            </div>
          </div>
        </div>

        {/* Size Stock Visualization */}
        {sizeStockData.length > 0 && (
          <div className="mt-3 rounded-2xl border border-black/5 bg-[#fbfaf7] p-4 dark:border-white/10 dark:bg-white/[0.02]">
            <div className="flex items-center justify-between mb-3">
              <p className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground">Stock by Size</p>
              <Badge className="rounded-full bg-[#81a074]/10 text-[#223227] hover:bg-[#81a074]/10 dark:bg-[#81a074]/20 dark:text-white text-[10px]">{totalStock} total</Badge>
            </div>
            <div className="space-y-2.5 pb-1">
              {sizeStockData.map((item: { size: string; stock: number; pct: number }) => (
                <div key={item.size} className="flex min-h-6 items-center gap-3">
                  <span className="text-[11px] font-bold text-[#223227] dark:text-white w-6 text-center">{item.size}</span>
                  <div className="flex-1 h-6 bg-black/5 dark:bg-white/5 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-500 ease-out"
                      style={{
                        width: `${item.pct}%`,
                        background: item.pct > 60
                          ? "linear-gradient(90deg, #81a074, #4a5d4e)"
                          : item.pct > 30
                            ? "linear-gradient(90deg, #d4c5a9, #a89f8f)"
                            : "linear-gradient(90deg, #b33a2f, #8a2e25)",
                      }}
                    />
                  </div>
                  <span className="text-[11px] font-bold text-[#425246] dark:text-white/70 w-8 text-right">{item.stock}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );

  const wizardContent = (
    <div className="absolute inset-0 h-[100dvh] overflow-y-auto overscroll-contain bg-[#eef4ea] dark:bg-[#0e1511]">
      <div className="min-h-[100dvh] bg-[radial-gradient(circle_at_top,rgba(129,160,116,0.12),transparent_28%),linear-gradient(180deg,#f7faf4_0%,#eff4eb_100%)] dark:bg-[radial-gradient(circle_at_top,rgba(81,111,73,0.18),transparent_26%),linear-gradient(180deg,#0f1411_0%,#111914_100%)]">
        <div className="mx-auto flex min-h-[100dvh] max-w-7xl flex-col px-4 pb-12 pt-4 sm:px-6 lg:px-8">
          <div className="sticky top-0 z-20 -mx-4 mb-6 border-b border-black/5 bg-[#f7faf4] px-4 py-4 shadow-[0_8px_24px_rgba(34,63,41,0.05)] sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8 dark:border-white/10 dark:bg-[#101611] dark:shadow-none">
            <div className="mx-auto flex max-w-7xl items-center justify-between gap-4">
              <Button
                type="button"
                variant="ghost"
                className="-ml-2 rounded-2xl hover:bg-black/5 dark:hover:bg-white/5"
                onClick={onClose}
              >
                <ArrowLeft className="mr-2 h-4 w-4" /> Back to products
              </Button>
              <div className="text-center">
                <h2 className="text-2xl font-serif font-medium text-[#223227] dark:text-white">Add New Product</h2>
                <p className="text-sm text-muted-foreground">Create a cleaner product page with organized attributes, pricing, and media.</p>
              </div>
              <div className="w-28" />
            </div>
          </div>

            <div className="mb-8 flex items-center justify-center gap-0">
          {steps.map((s, i) => (
            <div key={s.num} className="flex items-center">
              <button
                type="button"
                onClick={() => {
                  if (s.num < step) setStep(s.num);
                  else if (s.num === step + 1) {
                    if (step === 1 && canProceedStep1) setStep(2);
                    else if (step === 2 && canProceedStep2) setStep(3);
                  }
                }}
                className={cn(
                  "flex items-center gap-2 px-4 py-2 rounded-full text-xs font-bold uppercase tracking-wider transition-all",
                  step === s.num
                    ? "bg-primary text-primary-foreground"
                    : step > s.num
                      ? "bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300"
                      : "bg-muted text-muted-foreground"
                )}
              >
                <s.icon className="w-3.5 h-3.5" />
                {s.label}
                {step > s.num && <Check className="w-3 h-3 ml-1" />}
              </button>
              {i < steps.length - 1 && (
                <div className={cn("w-8 h-0.5 mx-2", step > s.num ? "bg-green-400" : "bg-muted")} />
              )}
            </div>
          ))}
            </div>

            <Form {...addForm}>
              <form
                id="add-product-form"
                onSubmit={addForm.handleSubmit((values: ProductFormValues) => addMutation.mutate(values))}
                className="flex flex-1 flex-col"
              >
                <AnimatePresence mode="wait">
                  {step === 1 && (
                    <motion.div
                      key="step1"
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -20 }}
                      className="grid gap-6 xl:grid-cols-[minmax(0,1.35fr)_minmax(320px,0.65fr)]"
                    >
                      <div className="space-y-6">
                        <div className="rounded-[28px] border border-black/5 bg-white/90 p-6 shadow-[0_24px_70px_rgba(34,63,41,0.08)] dark:border-white/10 dark:bg-white/[0.04] dark:shadow-none">
                          <div className="mb-5 flex items-center justify-between gap-3">
                            <div>
                              <h3 className="text-sm font-bold uppercase tracking-[0.22em] text-muted-foreground">Basic Information</h3>
                              <p className="mt-1 text-sm text-muted-foreground">Set the product name, category, messaging, and core price.</p>
                            </div>
                            <Badge variant="outline" className="rounded-full">Step 1</Badge>
                          </div>
                    <FormField
                      control={addForm.control}
                      name="name"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Product Name *</FormLabel>
                          <FormControl>
                            <Input placeholder="e.g. Two-Way Zip Hoodie" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={addForm.control}
                      name="shortDetails"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Short tagline</FormLabel>
                          <FormControl>
                            <Input placeholder="Brief tagline or key features" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={addForm.control}
                      name="description"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Full description</FormLabel>
                          <FormControl>
                            <Textarea rows={4} placeholder="Full product description..." {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={addForm.control}
                      name="category"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Category</FormLabel>
                          <div className="flex gap-2">
                            <Select onValueChange={field.onChange} value={field.value || categories[0]?.slug || ""}>
                              <FormControl>
                                <SelectTrigger className="flex-1">
                                  <SelectValue placeholder="Select category" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                {!categories.length ? (
                                  <SelectItem value="__no_category_available" disabled>
                                    No categories yet
                                  </SelectItem>
                                ) : null}
                                {categories.map((c) => (
                                  <SelectItem key={c.id} value={c.slug}>{c.name}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="shrink-0"
                              onClick={() => setShowNewCategoryInput((v) => !v)}
                            >
                              <Plus className="w-3.5 h-3.5" />
                            </Button>
                          </div>
                          <AnimatePresence>
                            {showNewCategoryInput && (
                              <motion.div
                                initial={{ opacity: 0, height: 0 }}
                                animate={{ opacity: 1, height: "auto" }}
                                exit={{ opacity: 0, height: 0 }}
                                className="overflow-hidden"
                              >
                                <div className="flex gap-2 pt-2">
                                  <Input
                                    value={newCategoryName}
                                    onChange={(e) => setNewCategoryName(e.target.value)}
                                    placeholder="New category name"
                                    className="text-xs h-8"
                                    onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), handleCreateCategory())}
                                  />
                                  <Button
                                    type="button"
                                    size="sm"
                                    className="h-8 text-xs"
                                    onClick={handleCreateCategory}
                                    disabled={creatingCategory || !newCategoryName.trim()}
                                  >
                                    {creatingCategory ? "Creating..." : "Create"}
                                  </Button>
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    className="h-8 w-8 p-0"
                                    onClick={() => { setShowNewCategoryInput(false); setNewCategoryName(""); }}
                                  >
                                    <X className="w-3.5 h-3.5" />
                                  </Button>
                                </div>
                              </motion.div>
                            )}
                          </AnimatePresence>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                        </div>

                        <div className="rounded-[28px] border border-black/5 bg-white/90 p-6 shadow-[0_24px_70px_rgba(34,63,41,0.08)] dark:border-white/10 dark:bg-white/[0.04] dark:shadow-none">
                          <div className="mb-5">
                            <h3 className="text-sm font-bold uppercase tracking-[0.22em] text-muted-foreground">Pricing</h3>
                            <p className="mt-1 text-sm text-muted-foreground">Keep the essentials here. Discounting moves to the next attributes step.</p>
                          </div>
                    <FormField
                      control={addForm.control}
                      name="price"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Price (NPR) *</FormLabel>
                          <FormControl>
                            <PriceInput
                              min={1}
                              value={field.value}
                              onChange={(val) => field.onChange(val)}
                              placeholder="0"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                        </div>
                      </div>

                      {renderLivePreview("details")}

                  <input type="hidden" {...addForm.register("imageUrl")} />
                  <input type="hidden" {...addForm.register("galleryUrlsText")} />

                      <div className="sticky bottom-0 mt-8 border-t border-black/5 bg-[#eff4eb] px-1 py-4 shadow-[0_-10px_24px_rgba(34,63,41,0.05)] dark:border-white/10 dark:bg-[#101611] dark:shadow-none">
                        <div className="flex justify-end gap-3">
                          <Button type="button" variant="outline" className="rounded-2xl" onClick={onClose}>
                            Cancel
                          </Button>
                          <Button
                            type="button"
                            className="rounded-2xl"
                            disabled={!canProceedStep1}
                            onClick={() => setStep(2)}
                          >
                            Next: Attributes <ArrowRight className="ml-2 h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </motion.div>
                  )}

                  {step === 2 && (
                    <motion.div
                      key="step2"
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -20 }}
                      className="grid gap-6 xl:grid-cols-[minmax(0,1.2fr)_minmax(320px,0.8fr)]"
                    >
                      <div className="space-y-6">
                        <div className="rounded-[28px] border border-black/5 bg-white/90 p-6 shadow-[0_24px_70px_rgba(34,63,41,0.08)] dark:border-white/10 dark:bg-white/[0.04] dark:shadow-none">
                          <div className="mb-5 flex items-center gap-2">
                            <Palette className="h-4 w-4" />
                            <div>
                              <h3 className="text-sm font-bold uppercase tracking-[0.22em] text-muted-foreground">Colors</h3>
                              <p className="mt-1 text-sm text-muted-foreground">{selectedColors.length} selected</p>
                            </div>
                          </div>

                    {/* Default colors */}
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-2">Default Colors</p>
                      <div className="flex flex-wrap gap-2">
                        {DEFAULT_COLORS.map((color) => {
                          const isSelected = selectedColors.includes(color);
                          return (
                            <button
                              key={color}
                              type="button"
                              onClick={() => toggleColor(color)}
                              className={cn(
                                "flex items-center gap-2 px-3 py-2 rounded-full text-xs font-bold border transition-all",
                                isSelected
                                  ? "bg-primary text-primary-foreground border-primary"
                                  : "bg-background text-muted-foreground border-border hover:border-foreground"
                              )}
                            >
                              {color}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Attribute colors from DB */}
                    {attributeColors.length > 0 && (
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-2">Attribute Colors</p>
                        <div className="flex flex-wrap gap-2">
                          {attributeColors.map((color) => {
                            const isSelected = selectedColors.includes(color);
                            const hexMatch = color.match(/\((#[0-9a-fA-F]{6})\)/);
                            const hex = hexMatch ? hexMatch[1] : undefined;
                            const displayName = color.replace(/\s*\(#[0-9a-fA-F]{6}\)/, "");
                            return (
                              <button
                                key={color}
                                type="button"
                                onClick={() => toggleColor(color)}
                                className={cn(
                                  "flex items-center gap-2 px-3 py-2 rounded-full text-xs font-bold border transition-all",
                                  isSelected
                                    ? "bg-primary text-primary-foreground border-primary"
                                    : "bg-background text-muted-foreground border-border hover:border-foreground"
                                )}
                              >
                                {hex && (
                                  <span className="w-3 h-3 rounded-full border border-border" style={{ backgroundColor: hex }} />
                                )}
                                {displayName}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Custom colors */}
                    {customColors.length > 0 && (
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-2">Custom Colors</p>
                        <div className="flex flex-wrap gap-2">
                          {customColors.map((color) => {
                            const isSelected = selectedColors.includes(color);
                            const hexMatch = color.match(/\((#[0-9a-fA-F]{6})\)/);
                            const hex = hexMatch ? hexMatch[1] : undefined;
                            const displayName = color.replace(/\s*\(#[0-9a-fA-F]{6}\)/, "");
                            return (
                              <button
                                key={color}
                                type="button"
                                onClick={() => toggleColor(color)}
                                className={cn(
                                  "flex items-center gap-2 px-3 py-2 rounded-full text-xs font-bold border transition-all",
                                  isSelected
                                    ? "bg-primary text-primary-foreground border-primary"
                                    : "bg-background text-muted-foreground border-border hover:border-foreground"
                                )}
                              >
                                {hex && (
                                  <span className="w-3 h-3 rounded-full border border-border" style={{ backgroundColor: hex }} />
                                )}
                                {displayName}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Add custom color */}
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={newColorHex}
                        onChange={(e) => setNewColorHex(e.target.value)}
                        className="w-8 h-8 rounded cursor-pointer border border-border"
                      />
                      <Input
                        value={newColorName}
                        onChange={(e) => setNewColorName(e.target.value)}
                        placeholder="Color name (e.g. Burgundy)"
                        className="w-40 text-xs h-8"
                        onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addCustomColor())}
                      />
                      <Button type="button" variant="outline" size="sm" className="h-8 text-xs" onClick={addCustomColor} disabled={!newColorName.trim()}>
                        <Plus className="w-3 h-3 mr-1" /> Add Color
                      </Button>
                    </div>
                        </div>

                        <div className="rounded-[28px] border border-black/5 bg-white/90 p-6 shadow-[0_24px_70px_rgba(34,63,41,0.08)] dark:border-white/10 dark:bg-white/[0.04] dark:shadow-none">
                          <div className="mb-5 flex items-center gap-2">
                            <Ruler className="h-4 w-4" />
                            <div>
                              <h3 className="text-sm font-bold uppercase tracking-[0.22em] text-muted-foreground">Attributes</h3>
                              <p className="mt-1 text-sm text-muted-foreground">Configure sizes and inventory in one cleaner section.</p>
                            </div>
                          </div>

                          <FormField
                            control={addForm.control}
                            name="stockStatus"
                            render={({ field }) => (
                              <FormItem>
                                <FormControl>
                                  <RadioGroup value={field.value} onValueChange={field.onChange} className="flex flex-wrap gap-4">
                                    <div className="flex items-center space-x-2">
                                      <RadioGroupItem value="in_stock" id="add-in-stock" />
                                      <Label htmlFor="add-in-stock">In Stock</Label>
                                    </div>
                                    <div className="flex items-center space-x-2">
                                      <RadioGroupItem value="out_of_stock" id="add-out-of-stock" />
                                      <Label htmlFor="add-out-of-stock">Out of Stock</Label>
                                    </div>
                                  </RadioGroup>
                                </FormControl>
                              </FormItem>
                            )}
                          />

                          <div className="mt-5">
                            <Label className="text-xs font-bold uppercase tracking-wider">Available Sizes</Label>
                            <div className="mt-3 flex flex-wrap gap-2">
                              {availableSizes.map((size) => {
                                const isSelected = selectedSizes.includes(size);
                                return (
                                  <button
                                    key={size}
                                    type="button"
                                    onClick={() => toggleSize(size)}
                                    className={cn(
                                      "rounded-full border px-3 py-1.5 text-xs font-bold uppercase transition-all",
                                      isSelected
                                        ? "border-primary bg-primary text-primary-foreground"
                                        : "border-border bg-background text-muted-foreground hover:border-foreground",
                                    )}
                                  >
                                    {size}
                                  </button>
                                );
                              })}
                            </div>
                            <div className="mt-3 flex items-center gap-2">
                              <Input
                                value={newSizeInput}
                                onChange={(e) => setNewSizeInput(e.target.value)}
                                placeholder="New size (e.g. XXL)"
                                className="h-8 w-32 text-xs"
                                onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addCustomSize())}
                              />
                              <Button type="button" variant="outline" size="sm" className="h-8 text-xs" onClick={addCustomSize} disabled={!newSizeInput.trim()}>
                                <Plus className="mr-1 h-3 w-3" /> Add Size
                              </Button>
                            </div>
                          </div>

                          {addForm.watch("stockStatus") === "in_stock" && selectedSizes.length > 0 ? (
                            <div className="mt-6 rounded-2xl border border-border/60 bg-gradient-to-br from-muted/40 to-muted/20 p-5">
                              <div className="mb-4 flex items-center justify-between">
                                <Label className="text-xs font-bold uppercase tracking-wider">Stock By Size</Label>
                                <Badge className="rounded-full bg-primary/10 text-primary hover:bg-primary/10">{totalStock} total</Badge>
                              </div>
                              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
                                {selectedSizes.map((size: string) => {
                                  const currentStock = stockBySizeValues[size] ?? undefined;
                                  return (
                                    <div
                                      key={size}
                                      className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-border/50 bg-background/70 p-4 text-center"
                                    >
                                      <Label className="text-sm font-bold">{size}</Label>
                                      <QuantityInput
                                        min={0}
                                        step={1}
                                        value={currentStock}
                                        className="h-11 w-full max-w-[120px] justify-center"
                                        onChange={(newValue) => {
                                          const current = addForm.getValues("stockBySize") || {};
                                          addForm.setValue(
                                            "stockBySize",
                                            {
                                              ...syncStockBySizeToSizes(current, selectedSizes),
                                              [size]: newValue,
                                            },
                                            { shouldValidate: false, shouldDirty: true },
                                          );
                                        }}
                                        placeholder="—"
                                      />
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          ) : null}
                        </div>

                        <div className="rounded-[28px] border border-black/5 bg-white/90 p-6 shadow-[0_24px_70px_rgba(34,63,41,0.08)] dark:border-white/10 dark:bg-white/[0.04] dark:shadow-none">
                          <div className="mb-5 flex items-center gap-2">
                            <Percent className="h-4 w-4" />
                            <div>
                              <h3 className="text-sm font-bold uppercase tracking-[0.22em] text-muted-foreground">Features & Merchandising</h3>
                              <p className="mt-1 text-sm text-muted-foreground">Configure discount behavior here instead of mixing it into base pricing.</p>
                            </div>
                          </div>

                          <div className="rounded-2xl border border-border bg-muted/40 p-4">
                            <div className="flex items-center justify-between">
                              <div className="space-y-0.5">
                                <Label className="flex items-center gap-2 text-sm font-bold">
                                  <Percent className="h-4 w-4" /> Sale Discount
                                </Label>
                                <p className="text-[10px] text-muted-foreground">Turn on discount pricing for this product.</p>
                              </div>
                              <FormField
                                control={addForm.control}
                                name="saleActive"
                                render={({ field }) => (
                                  <FormItem>
                                    <FormControl>
                                      <Switch checked={field.value} onCheckedChange={field.onChange} />
                                    </FormControl>
                                  </FormItem>
                                )}
                              />
                            </div>
                            <AnimatePresence>
                              {addForm.watch("saleActive") ? (
                                <motion.div
                                  initial={{ opacity: 0, height: 0 }}
                                  animate={{ opacity: 1, height: "auto" }}
                                  exit={{ opacity: 0, height: 0 }}
                                  className="overflow-hidden"
                                >
                                  <div className="mt-4 border-t border-border pt-4">
                                    <FormField
                                      control={addForm.control}
                                      name="salePercentage"
                                      render={({ field }) => (
                                        <FormItem>
                                          <div className="mb-2 flex items-center justify-between">
                                            <FormLabel className="text-[11px] font-bold uppercase">Discount</FormLabel>
                                            <span className="text-lg font-bold text-primary">{field.value}% OFF</span>
                                          </div>
                                          <FormControl>
                                            <Input type="range" min="0" max="90" step="5" {...field} />
                                          </FormControl>
                                        </FormItem>
                                      )}
                                    />
                                  </div>
                                </motion.div>
                              ) : null}
                            </AnimatePresence>
                          </div>
                        </div>
                      </div>

                      {renderLivePreview("attributes")}

                      <div className="sticky bottom-0 mt-8 border-t border-black/5 bg-[#eff4eb] px-1 py-4 shadow-[0_-10px_24px_rgba(34,63,41,0.05)] dark:border-white/10 dark:bg-[#101611] dark:shadow-none xl:col-span-2">
                        <div className="flex justify-between gap-3">
                          <Button type="button" variant="outline" className="rounded-2xl" onClick={() => setStep(1)}>
                            <ArrowLeft className="mr-2 h-4 w-4" /> Back
                          </Button>
                          <Button
                            type="button"
                            className="rounded-2xl"
                            disabled={!canProceedStep2}
                            onClick={() => setStep(3)}
                          >
                            Next: Media <ArrowRight className="ml-2 h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </motion.div>
                  )}

                  {step === 3 && (
                    <motion.div
                      key="step3"
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -20 }}
                      className="grid gap-6 xl:grid-cols-[minmax(0,1.15fr)_minmax(320px,0.85fr)]"
                    >
                      <div className="space-y-6">
                        <div className="rounded-[28px] border border-black/5 bg-white/90 p-6 shadow-[0_24px_70px_rgba(34,63,41,0.08)] dark:border-white/10 dark:bg-white/[0.04] dark:shadow-none">
                          <h3 className="flex items-center gap-2 text-sm font-bold uppercase tracking-[0.22em] text-muted-foreground">
                            <ImageIcon className="h-4 w-4" /> Main Product Image
                          </h3>

                    {/* Upload mode toggle */}
                    <div className="flex items-center gap-2 p-3 rounded-xl bg-muted/30 border border-border">
                      <button
                        type="button"
                        onClick={() => setUploadMode("cloudinary")}
                        className={cn(
                          "flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all",
                          uploadMode === "cloudinary"
                            ? "bg-primary text-primary-foreground"
                            : "bg-background text-muted-foreground hover:text-foreground"
                        )}
                      >
                        <Cloud className="w-4 h-4" /> Cloudinary
                      </button>
                      <button
                        type="button"
                        onClick={() => setUploadMode("tigris")}
                        className={cn(
                          "flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all",
                          uploadMode === "tigris"
                            ? "bg-primary text-primary-foreground"
                            : "bg-background text-muted-foreground hover:text-foreground"
                        )}
                      >
                        <Cloud className="w-4 h-4" /> Tigris
                      </button>
                      <button
                        type="button"
                        onClick={() => setUploadMode("local")}
                        className={cn(
                          "flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all",
                          uploadMode === "local"
                            ? "bg-primary text-primary-foreground"
                            : "bg-background text-muted-foreground hover:text-foreground"
                        )}
                      >
                        <HardDrive className="w-4 h-4" /> Local
                      </button>
                    </div>

                    {/* Category selector for cloud */}
                    {uploadMode !== "local" && (
                      <div className="flex items-center gap-2">
                        <Label className="text-xs font-bold uppercase tracking-wider">Category</Label>
                        <Select value={imageCategory} onValueChange={setImageCategory}>
                          <SelectTrigger className="h-9 flex-1">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {IMAGE_CATEGORIES.map(cat => (
                              <SelectItem key={cat.value} value={cat.value}>{cat.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )}

                    <div
                      className="aspect-[4/5] max-w-xs bg-muted/30 hover:bg-muted/50 transition-colors overflow-hidden rounded-xl relative group cursor-pointer border-2 border-dashed border-border flex items-center justify-center p-4 text-center mx-auto"
                      onClick={() => imageInputRef.current?.click()}
                    >
                      {addForm.watch("imageUrl") ? (
                        <img
                          src={addForm.watch("imageUrl")}
                          alt="Preview"
                          className="w-full h-full object-cover absolute inset-0"
                        />
                      ) : (
                        <div className="text-muted-foreground flex flex-col items-center">
                          <ImageIcon className="w-10 h-10 mb-2 opacity-30" />
                          <span className="text-sm font-medium">Click to upload main image</span>
                        </div>
                      )}
                      <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                        <span className="text-white text-sm font-medium px-4 py-2 bg-black/60 rounded-full">Change Image</span>
                      </div>
                    </div>
                    <div className="flex gap-2 justify-center">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => onMediaLibraryOpen("add-main")}
                      >
                        <FolderInput className="w-3.5 h-3.5 mr-1.5" /> From Library
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => imageInputRef.current?.click()}
                        loading={mainUploading}
                      >
                        <Upload className="w-3.5 h-3.5 mr-1.5" /> Upload to {getProviderLabel(uploadMode)}
                      </Button>
                    </div>
                    {mainUploading && (
                      <div className="mt-4 flex justify-center">
                        <UploadProgress value={mainUploadProgress} label="Upload progress" />
                      </div>
                    )}
                    <input
                      ref={imageInputRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        if (uploadMode === "local") {
                          await handleLocalUpload(file, "main");
                        } else {
                          await handleRemoteUpload(uploadMode, file, "main");
                        }
                        e.target.value = "";
                      }}
                    />
                        </div>

                        <div className="rounded-[28px] border border-black/5 bg-white/90 p-6 shadow-[0_24px_70px_rgba(34,63,41,0.08)] dark:border-white/10 dark:bg-white/[0.04] dark:shadow-none">
                          <h3 className="flex items-center gap-2 text-sm font-bold uppercase tracking-[0.22em] text-muted-foreground">
                            <FolderInput className="h-4 w-4" /> Gallery Images
                          </h3>

                    {/* Upload mode toggle for gallery */}
                    <div className="flex items-center gap-2 p-3 rounded-xl bg-muted/30 border border-border">
                      <button
                        type="button"
                        onClick={() => setGalleryUploadMode("cloudinary")}
                        className={cn(
                          "flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all",
                          galleryUploadMode === "cloudinary"
                            ? "bg-primary text-primary-foreground"
                            : "bg-background text-muted-foreground hover:text-foreground"
                        )}
                      >
                        <Cloud className="w-4 h-4" /> Cloudinary
                      </button>
                      <button
                        type="button"
                        onClick={() => setGalleryUploadMode("tigris")}
                        className={cn(
                          "flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all",
                          galleryUploadMode === "tigris"
                            ? "bg-primary text-primary-foreground"
                            : "bg-background text-muted-foreground hover:text-foreground"
                        )}
                      >
                        <Cloud className="w-4 h-4" /> Tigris
                      </button>
                      <button
                        type="button"
                        onClick={() => setGalleryUploadMode("local")}
                        className={cn(
                          "flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all",
                          galleryUploadMode === "local"
                            ? "bg-primary text-primary-foreground"
                            : "bg-background text-muted-foreground hover:text-foreground"
                        )}
                      >
                        <HardDrive className="w-4 h-4" /> Local
                      </button>
                    </div>

                    {/* Category selector for gallery cloud */}
                    {galleryUploadMode !== "local" && (
                      <div className="flex items-center gap-2">
                        <Label className="text-xs font-bold uppercase tracking-wider">Category</Label>
                        <Select value={galleryImageCategory} onValueChange={setGalleryImageCategory}>
                          <SelectTrigger className="h-9 flex-1">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {IMAGE_CATEGORIES.map(cat => (
                              <SelectItem key={cat.value} value={cat.value}>{cat.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )}

                    <div className="flex gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="flex-1"
                        onClick={() => onMediaLibraryOpen("add-gallery")}
                      >
                        <FolderInput className="w-3.5 h-3.5 mr-1.5" /> From Library
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="flex-1 border-dashed"
                        onClick={() => galleryInputRef.current?.click()}
                        loading={galleryUploading}
                      >
                        <Upload className="w-3.5 h-3.5 mr-1.5" /> Upload to {getProviderLabel(galleryUploadMode)}
                      </Button>
                    </div>
                    {galleryUploading && (
                      <div className="mt-4 flex justify-center">
                        <UploadProgress value={galleryUploadProgress} label="Upload progress" />
                      </div>
                    )}
                    <input
                      ref={galleryInputRef}
                      type="file"
                      accept="image/*"
                      multiple
                      className="hidden"
                      onChange={async (e) => {
                        const files = Array.from(e.target.files ?? []);
                        if (!files.length) return;
                        for (const file of files) {
                          if (galleryUploadMode === "local") {
                            await handleLocalUpload(file, "gallery");
                          } else {
                            await handleRemoteUpload(galleryUploadMode, file, "gallery");
                          }
                        }
                        e.target.value = "";
                      }}
                    />

                    <div className="grid grid-cols-4 sm:grid-cols-5 gap-3">
                      {addForm.watch("galleryUrlsText") &&
                        addForm.watch("galleryUrlsText")!.split(/\n/).map((u: string) => u.trim()).filter(Boolean).map((url: string, i: number) => (
                          <div key={i} className="aspect-square bg-muted rounded-lg border border-border overflow-hidden relative group">
                            <img src={url} alt="" className="w-full h-full object-cover" />
                            <button
                              type="button"
                              className="absolute top-1 right-1 bg-red-500 text-white p-0.5 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                              onClick={() => {
                                const urls = addForm.getValues("galleryUrlsText")!.split(/\n/).map((u: string) => u.trim()).filter(Boolean);
                                urls.splice(i, 1);
                                addForm.setValue("galleryUrlsText", urls.join("\n"), { shouldValidate: true });
                              }}
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </div>
                        ))}
                      {pendingGalleryImages.map((img) => (
                        <div key={img.id} className="aspect-square bg-muted rounded-lg border border-border overflow-hidden relative group">
                          <img src={img.previewUrl} alt="" className="w-full h-full object-cover" />
                          <button
                            type="button"
                            className="absolute top-1 right-1 bg-red-500 text-white p-0.5 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                            onClick={() => {
                              setPendingGalleryImages((prev) => prev.filter((p) => p.id !== img.id));
                              URL.revokeObjectURL(img.previewUrl);
                            }}
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                        ))}
                    </div>
                    {galleryUploadStatus && galleryUploadStatus.mode === "add" && (
                      <div className="mt-4 flex justify-center">
                        <UploadProgress
                          value={galleryUploadStatus.progress}
                          label={`Uploading ${galleryUploadStatus.completed}/${galleryUploadStatus.total}`}
                        />
                      </div>
                    )}
                        </div>
                      </div>

                      {renderLivePreview("media")}

                      <div className="sticky bottom-0 mt-8 border-t border-black/5 bg-[#eff4eb] px-1 py-4 shadow-[0_-10px_24px_rgba(34,63,41,0.05)] dark:border-white/10 dark:bg-[#101611] dark:shadow-none xl:col-span-2">
                        <div className="flex justify-between gap-3">
                          <Button type="button" variant="outline" className="rounded-2xl" onClick={() => setStep(2)}>
                            <ArrowLeft className="mr-2 h-4 w-4" /> Back
                          </Button>
                          <Button
                            type="submit"
                            form="add-product-form"
                            loading={addMutation.isPending}
                            loadingText="Saving..."
                            className="rounded-2xl"
                          >
                            <Check className="mr-2 h-4 w-4" /> Save Product
                          </Button>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </form>
            </Form>
          </div>
        </div>
      </div>
  );

  return portalContainerRef.current ? createPortal(wizardContent, portalContainerRef.current) : null;
}
