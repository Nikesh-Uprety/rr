import { memo, useState, useMemo, useCallback, useEffect, useRef } from "react";
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
import { Checkbox } from "@/components/ui/checkbox";
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

const variantRowSchema = z.object({
  id: z.string(),
  color: z.string(),
  size: z.string(),
  crossedPrice: z.coerce.number().min(0).default(0),
  sellingPrice: z.coerce.number().min(0).default(0),
  costPrice: z.coerce.number().min(0).default(0),
  weight: z.coerce.number().min(0).default(0),
  quantity: z.coerce.number().min(0).default(0),
  sku: z.string().min(1, "SKU required"),
});

const productSchema = z.object({
  name: z.string().min(2, "Name required"),
  shortDetails: z.string().optional(),
  description: z.string().optional(),
  category: z.string().optional(),
  price: z.coerce.number().min(1, "Price required"),
  costPrice: z.coerce.number().min(0).default(0),
  stockStatus: z.enum(["in_stock", "out_of_stock"]),
  stock: z.coerce.number().min(0).default(0),
  stockBySize: z.record(z.string(), z.coerce.number().min(0)).default({}),
  imageUrl: z.string().optional(),
  galleryUrlsText: z.string().optional(),
  colorOptions: z.array(z.string()).default([]),
  sizeOptions: z.array(z.string()).default([]),
  variantsEnabled: z.boolean().default(false),
  variantColorHexMap: z.record(z.string(), z.string()).default({}),
  variants: z.array(variantRowSchema).default([]),
  continueSellingOutOfStock: z.boolean().default(false),
  salePercentage: z.coerce.number().min(0).max(100).default(0),
  saleActive: z.boolean().default(false),
  colorImageMap: z.record(z.string(), z.array(z.string())).optional().default({}),
});

type ProductVariantRow = z.infer<typeof variantRowSchema>;
type ProductFormValues = z.infer<typeof productSchema>;
type ColorDetail = { name: string; hex: string };

const DEFAULT_SIZES = ["S", "M", "L", "XL"];
const DEFAULT_COLORS = ["Black", "White", "Red", "Navy", "Olive", "Sand", "Charcoal"];
const IMAGE_CATEGORIES = [
  { value: "product", label: "Product Images" },
  { value: "website", label: "Website Assets" },
  { value: "model", label: "Model Shots" },
  { value: "landing_page", label: "Landing Pages" },
  { value: "collection_page", label: "Collection Pages" },
];

const DEFAULT_COLOR_SWATCHES: Record<string, string> = {
  Black: "#1c1b1b",
  White: "#ffffff",
  Red: "#b42318",
  Navy: "#182b56",
  Olive: "#4d5d38",
  Sand: "#d9c8a8",
  Charcoal: "#36454f",
};

const slugifyVariantToken = (value: string): string =>
  value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

const normalizeVariantColor = (value: string): string => {
  const trimmed = value.trim();
  if (!trimmed) return "";
  return trimmed
    .split(/\s+/)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(" ");
};

const normalizeHex = (value: string | undefined): string => {
  const trimmed = (value ?? "").trim();
  if (/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(trimmed)) {
    return trimmed.length === 4
      ? `#${trimmed[1]}${trimmed[1]}${trimmed[2]}${trimmed[2]}${trimmed[3]}${trimmed[3]}`.toLowerCase()
      : trimmed.toLowerCase();
  }
  return "#000000";
};

const buildVariantKey = (color: string, size: string) => `${color}:::${size}`;

const buildVariantSku = (productName: string, color: string, size: string): string => {
  const productSlug = slugifyVariantToken(productName) || "product";
  const colorSlug = slugifyVariantToken(color) || "default";
  const sizeSlug = slugifyVariantToken(size) || "one";
  return `${productSlug}-${colorSlug}-${sizeSlug}`;
};

const sanitizeVariantNumber = (value: number | string | undefined): number => {
  const numeric = typeof value === "number" ? value : Number(value ?? 0);
  if (!Number.isFinite(numeric)) return 0;
  return Math.max(0, numeric);
};

const preserveExistingVariantsOnUpdate = ({
  productName,
  colors,
  sizes,
  existingVariants,
  basePrice,
  baseCostPrice,
}: {
  productName: string;
  colors: string[];
  sizes: string[];
  existingVariants: ProductVariantRow[];
  basePrice: number;
  baseCostPrice: number;
}): ProductVariantRow[] => {
  const existingByKey = new Map(existingVariants.map((variant) => [buildVariantKey(variant.color, variant.size), variant]));

  return colors.flatMap((color) =>
    sizes.map((size) => {
      const existing = existingByKey.get(buildVariantKey(color, size));
      return {
        id: existing?.id ?? buildVariantKey(color, size),
        color,
        size,
        crossedPrice: sanitizeVariantNumber(existing?.crossedPrice ?? 0),
        sellingPrice: sanitizeVariantNumber(existing?.sellingPrice ?? basePrice),
        costPrice: sanitizeVariantNumber(existing?.costPrice ?? baseCostPrice),
        weight: sanitizeVariantNumber(existing?.weight ?? 0),
        quantity: sanitizeVariantNumber(existing?.quantity ?? 0),
        sku: existing?.sku?.trim() || buildVariantSku(productName, color, size),
      };
    }),
  );
};

const generateVariants = (colors: string[], sizes: string[]) =>
  colors.flatMap((color) => sizes.map((size) => ({ color, size })));

const buildStockBySizeFromVariants = (variants: ProductVariantRow[]) =>
  variants.reduce<Record<string, number>>((draft, variant) => {
    draft[variant.size] = (draft[variant.size] ?? 0) + Math.trunc(sanitizeVariantNumber(variant.quantity));
    return draft;
  }, {});

const VariantMatrixRow = memo(function VariantMatrixRow({
  row,
  duplicateSku,
  onFieldChange,
  onCopySellingPrice,
}: {
  row: ProductVariantRow;
  duplicateSku: boolean;
  onFieldChange: (id: string, field: keyof ProductVariantRow, value: number | string) => void;
  onCopySellingPrice: (row: ProductVariantRow) => void;
}) {
  return (
    <tr className="border-b border-black/5 align-top last:border-none dark:border-white/10">
      <td className="whitespace-nowrap px-3 py-3 text-sm font-semibold text-[#223227] dark:text-white">{row.color}/{row.size}</td>
      <td className="min-w-[110px] px-2 py-3"><Input type="number" min={0} value={row.crossedPrice} onChange={(event) => onFieldChange(row.id, "crossedPrice", event.target.value)} className="h-10 rounded-xl" /></td>
      <td className="min-w-[110px] px-2 py-3"><Input type="number" min={0} value={row.sellingPrice} onChange={(event) => onFieldChange(row.id, "sellingPrice", event.target.value)} className="h-10 rounded-xl font-semibold" /></td>
      <td className="min-w-[110px] px-2 py-3"><Input type="number" min={0} value={row.costPrice} onChange={(event) => onFieldChange(row.id, "costPrice", event.target.value)} className="h-10 rounded-xl" /></td>
      <td className="min-w-[100px] px-2 py-3"><Input type="number" min={0} value={row.weight} onChange={(event) => onFieldChange(row.id, "weight", event.target.value)} className="h-10 rounded-xl" /></td>
      <td className="min-w-[100px] px-2 py-3"><Input type="number" min={0} value={row.quantity} onChange={(event) => onFieldChange(row.id, "quantity", event.target.value)} className="h-10 rounded-xl" /></td>
      <td className="min-w-[210px] px-2 py-3">
        <Input
          value={row.sku}
          onChange={(event) => onFieldChange(row.id, "sku", event.target.value)}
          className={cn("h-10 rounded-xl", duplicateSku && "border-red-500 text-red-600 focus-visible:ring-red-500 dark:border-red-400 dark:text-red-300")}
        />
        <div className="mt-1 flex items-center justify-between gap-2 text-[10px]">
          <span className={duplicateSku ? "text-red-600 dark:text-red-300" : "text-muted-foreground"}>
            {duplicateSku ? "SKU must be unique" : "Editable auto-generated SKU"}
          </span>
          <button type="button" className="font-semibold text-[#223227] underline decoration-dotted underline-offset-4 dark:text-white" onClick={() => onCopySellingPrice(row)}>
            Copy price down
          </button>
        </div>
      </td>
    </tr>
  );
});

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
  const [customColors, setCustomColors] = useState<Array<{ name: string; hex: string }>>([]);
  const [customSizes, setCustomSizes] = useState<string[]>([]);
  const [newColorHex, setNewColorHex] = useState("#000000");
  const [newColorName, setNewColorName] = useState("");
  const [newSizeInput, setNewSizeInput] = useState("");
  const [bulkSellingPrice, setBulkSellingPrice] = useState("");
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

  const attributeColors = useMemo(
    () =>
      (attributes ?? [])
        .filter((attribute) => attribute.type === "color")
        .flatMap((attribute) => {
          const [rawName, rawHex] = attribute.value.split("|");
          const name = normalizeVariantColor(rawName ?? "");
          if (!name) return [];
          return [{ name, hex: normalizeHex(rawHex) }];
        }),
    [attributes],
  );

  const availableColors = useMemo(() => {
    const merged = new Map<string, { name: string; hex: string }>();
    [...DEFAULT_COLORS.map((name) => ({ name, hex: DEFAULT_COLOR_SWATCHES[name] ?? "#000000" })), ...attributeColors, ...customColors].forEach((color) => {
      const name = normalizeVariantColor(color.name);
      if (!name) return;
      merged.set(name, { name, hex: normalizeHex(color.hex) });
    });
    return Array.from(merged.values());
  }, [attributeColors, customColors]);

  const availableSizes = useMemo(() => [...DEFAULT_SIZES, ...customSizes], [customSizes]);

  const selectedColors = addForm.watch("colorOptions") || [];
  const selectedSizes = addForm.watch("sizeOptions") || [];
  const variantsEnabled = addForm.watch("variantsEnabled") ?? false;
  const variantRows = addForm.watch("variants") || [];
  const variantColorHexMap = addForm.watch("variantColorHexMap") || {};

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

  const upsertColorSelection = useCallback(
    (rawColor: string, rawHex?: string) => {
      const color = normalizeVariantColor(rawColor);
      if (!color) return;
      const currentColors = addForm.getValues("colorOptions") || [];
      const exists = currentColors.includes(color);
      const nextColors = exists ? currentColors.filter((item: string) => item !== color) : [...currentColors, color];
      addForm.setValue("colorOptions", nextColors, { shouldValidate: false, shouldDirty: true });
      const nextHexMap = {
        ...(addForm.getValues("variantColorHexMap") || {}),
        [color]: normalizeHex(rawHex ?? variantColorHexMap[color] ?? DEFAULT_COLOR_SWATCHES[color] ?? "#000000"),
      };
      addForm.setValue("variantColorHexMap", nextHexMap, { shouldValidate: false, shouldDirty: true });
    },
    [addForm, variantColorHexMap],
  );

  const removeColorSelection = useCallback(
    (color: string) => {
      const currentColors = addForm.getValues("colorOptions") || [];
      addForm.setValue(
        "colorOptions",
        currentColors.filter((item: string) => item !== color),
        { shouldValidate: false, shouldDirty: true },
      );
    },
    [addForm],
  );

  const updateColorHex = useCallback(
    (color: string, value: string) => {
      addForm.setValue(
        "variantColorHexMap",
        {
          ...(addForm.getValues("variantColorHexMap") || {}),
          [color]: normalizeHex(value),
        },
        { shouldValidate: false, shouldDirty: true },
      );
    },
    [addForm],
  );

  const toggleSize = useCallback(
    (size: string) => {
      const normalizedSize = size.trim().toUpperCase();
      if (!normalizedSize) return;
      const currentSizes = addForm.getValues("sizeOptions") || [];
      const next = currentSizes.includes(normalizedSize)
        ? currentSizes.filter((item: string) => item !== normalizedSize)
        : [...currentSizes, normalizedSize];
      addForm.setValue("sizeOptions", next, { shouldValidate: false, shouldDirty: true });
      addForm.setValue("stockBySize", syncStockBySizeToSizes(addForm.getValues("stockBySize"), next), {
        shouldValidate: false,
        shouldDirty: true,
      });
    },
    [addForm],
  );

  const addCustomColor = () => {
    const name = normalizeVariantColor(newColorName);
    if (!name) return;
    const hex = normalizeHex(newColorHex);
    setCustomColors((prev) => (prev.some((entry) => entry.name === name) ? prev : [...prev, { name, hex }]));
    upsertColorSelection(name, hex);
    setNewColorName("");
  };

  const addCustomSize = () => {
    const trimmed = newSizeInput.trim().toUpperCase();
    if (!trimmed || availableSizes.includes(trimmed)) return;
    setCustomSizes((prev) => [...prev, trimmed]);
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

  const productName = addForm.watch("name") || "Untitled product";
  const productTagline = addForm.watch("shortDetails") || "A polished new product waiting for its final story.";
  const productDescription =
    addForm.watch("description") || "Use this space to frame the fit, material, and energy of the piece before it goes live.";
  const productPrice = Number(addForm.watch("price")) || 0;
  const productCostPrice = Number(addForm.watch("costPrice")) || 0;
  const galleryUrls = ((addForm.watch("galleryUrlsText") || "") as string)
    .split(/\n/)
    .map((u: string) => u.trim())
    .filter(Boolean);
  const mainImageUrl = addForm.watch("imageUrl") || galleryUrls[0] || null;
  const colorImageMap = addForm.watch("colorImageMap") || {};
  const saleIsActive = !!addForm.watch("saleActive");
  const salePercentage = Number(addForm.watch("salePercentage")) || 0;

  useEffect(() => {
    if (!variantsEnabled) return;
    const nextVariants = preserveExistingVariantsOnUpdate({
      productName,
      colors: selectedColors,
      sizes: selectedSizes,
      existingVariants: variantRows,
      basePrice: productPrice,
      baseCostPrice: productCostPrice,
    });
    if (JSON.stringify(nextVariants) !== JSON.stringify(variantRows)) {
      addForm.setValue("variants", nextVariants, { shouldValidate: false, shouldDirty: true });
    }
  }, [addForm, productCostPrice, productName, productPrice, selectedColors, selectedSizes, variantRows, variantsEnabled]);

  useEffect(() => {
    if (!variantsEnabled) return;
    const timer = window.setTimeout(() => {
      const nextStockBySize = buildStockBySizeFromVariants(variantRows);
      addForm.setValue("stockBySize", syncStockBySizeToSizes(nextStockBySize, selectedSizes), {
        shouldValidate: false,
        shouldDirty: true,
      });
      addForm.setValue(
        "stock",
        variantRows.reduce((sum: number, variant: ProductVariantRow) => sum + Math.trunc(sanitizeVariantNumber(variant.quantity)), 0),
        { shouldValidate: false, shouldDirty: true },
      );
    }, 160);
    return () => window.clearTimeout(timer);
  }, [addForm, selectedSizes, variantRows, variantsEnabled]);

  const updateVariantField = useCallback(
    (id: string, field: keyof ProductVariantRow, value: number | string) => {
      const currentVariants = addForm.getValues("variants") || [];
      addForm.setValue(
        "variants",
        currentVariants.map((variant: ProductVariantRow) =>
          variant.id === id
            ? {
                ...variant,
                [field]: field === "sku" || field === "color" || field === "size" || field === "id"
                  ? String(value)
                  : sanitizeVariantNumber(value as number | string),
              }
            : variant,
        ),
        { shouldValidate: false, shouldDirty: true },
      );
    },
    [addForm],
  );

  const handleBulkApplySellingPrice = useCallback(() => {
    const price = sanitizeVariantNumber(bulkSellingPrice);
    if (!variantRows.length) return;
    addForm.setValue(
      "variants",
      variantRows.map((variant: ProductVariantRow) => ({ ...variant, sellingPrice: price })),
      { shouldValidate: false, shouldDirty: true },
    );
  }, [addForm, bulkSellingPrice, variantRows]);

  const handleCopySellingPrice = useCallback(
    (sourceRow: ProductVariantRow) => {
      addForm.setValue(
        "variants",
        variantRows.map((variant: ProductVariantRow) =>
          variant.id === sourceRow.id ? variant : { ...variant, sellingPrice: sourceRow.sellingPrice },
        ),
        { shouldValidate: false, shouldDirty: true },
      );
    },
    [addForm, variantRows],
  );

  const duplicateSkuIds = useMemo(() => {
    const counts = new Map<string, number>();
    variantRows.forEach((variant: ProductVariantRow) => {
      const sku = variant.sku.trim().toLowerCase();
      if (!sku) return;
      counts.set(sku, (counts.get(sku) ?? 0) + 1);
    });
    return new Set(
      variantRows
        .filter((variant: ProductVariantRow) => {
          const sku = variant.sku.trim().toLowerCase();
          return sku.length > 0 && (counts.get(sku) ?? 0) > 1;
        })
        .map((variant: ProductVariantRow) => variant.id),
    );
  }, [variantRows]);

  const selectedColorDetails = useMemo<ColorDetail[]>(
    () =>
      selectedColors.map((color: string) => ({
        name: color,
        hex: normalizeHex(variantColorHexMap[color] ?? DEFAULT_COLOR_SWATCHES[color] ?? "#000000"),
      })),
    [selectedColors, variantColorHexMap],
  );

  const stockBySizeValues = addForm.watch("stockBySize") || {};
  const discountedPrice =
    saleIsActive && productPrice > 0
      ? Math.max(0, Math.round(productPrice * (1 - salePercentage / 100)))
      : productPrice;
  const totalStock = variantsEnabled
    ? variantRows.reduce((sum: number, variant: ProductVariantRow) => sum + Math.trunc(sanitizeVariantNumber(variant.quantity)), 0)
    : selectedSizes.reduce((total: number, size: string) => total + (stockBySizeValues[size] ?? 0), 0);

  const hasVariantRequirements = !variantsEnabled || (
    selectedColors.length > 0 &&
    selectedSizes.length > 0 &&
    variantRows.length === generateVariants(selectedColors, selectedSizes).length &&
    variantRows.every((variant: ProductVariantRow) => variant.sellingPrice > 0 && variant.sku.trim().length > 0) &&
    duplicateSkuIds.size === 0
  );

  const canProceedStep1 = addForm.watch("name")?.length >= 2 && addForm.watch("price") >= 1 && Boolean(addForm.watch("category"));
  const canProceedStep2 = hasVariantRequirements;
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
    } catch (error) {
      toast({
        title: `${getProviderLabel(provider)} upload failed`,
        description: getErrorMessage(error, "Please try a different image or upload provider."),
        variant: "destructive",
      });
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
    } catch (error) {
      toast({
        title: "Upload failed",
        description: getErrorMessage(error, "Please try a different image or upload again."),
        variant: "destructive",
      });
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
    if (selectedColorDetails.length > 0) {
      selectedColorDetails.forEach((color: ColorDetail) => {
        data.push({
          name: color.name,
          value: 1,
          fill: color.hex,
        });
      });
    }
    if (data.length === 0) {
      data.push({ name: "No colors", value: 1, fill: "#d1d5db" });
    }
    return data;
  }, [selectedColorDetails]);

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
                    <img src={mainImageUrl} alt={productName} className="h-16 w-16 rounded-full border-2 border-white/80 object-cover shadow-md opacity-100 dark:border-white/20" />
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
                {selectedColorDetails.length ? selectedColorDetails.slice(0, 3).map((color: ColorDetail) => (
                  <Badge key={color.name} variant="outline" className="rounded-full text-[10px] px-2 py-0">{color.name}</Badge>
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
            <div className="max-h-40 overflow-y-auto space-y-2.5 pb-1 pr-1">
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
                    <FormField
                      control={addForm.control}
                      name="costPrice"
                      render={({ field }) => (
                        <FormItem className="mt-4">
                          <FormLabel>Cost Price (NPR)</FormLabel>
                          <FormControl>
                            <PriceInput
                              min={0}
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
                          <div className="mb-5 flex items-start justify-between gap-4">
                            <div>
                              <h3 className="text-sm font-bold uppercase tracking-[0.22em] text-muted-foreground">Product Variants</h3>
                              <p className="mt-1 text-sm text-muted-foreground">Define colors and sizes, then auto-generate editable child variants without losing row edits.</p>
                            </div>
                            <div className="flex items-center gap-3 rounded-full border border-black/5 bg-[#f7faf4] px-4 py-2 dark:border-white/10 dark:bg-white/[0.04]">
                              <Label htmlFor="add-variants-enabled" className="text-xs font-bold uppercase tracking-[0.18em] text-[#223227] dark:text-white">Enable variants</Label>
                              <Switch
                                id="add-variants-enabled"
                                checked={variantsEnabled}
                                onCheckedChange={(checked) => addForm.setValue("variantsEnabled", checked, { shouldValidate: false, shouldDirty: true })}
                              />
                            </div>
                          </div>

                          <div className="grid gap-5 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
                            <div className="rounded-2xl border border-black/5 bg-[#fbfaf7] p-5 dark:border-white/10 dark:bg-white/[0.02]">
                              <div className="mb-4 flex items-center gap-2">
                                <Palette className="h-4 w-4" />
                                <div>
                                  <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#223227] dark:text-white">Color values</p>
                                  <p className="text-xs text-muted-foreground">Add tags, set hex codes, and preview each swatch visually.</p>
                                </div>
                              </div>

                              <div className="flex flex-wrap gap-2">
                                {availableColors.map((color) => {
                                  const isSelected = selectedColors.includes(color.name);
                                  return (
                                    <button
                                      key={color.name}
                                      type="button"
                                      onClick={() => upsertColorSelection(color.name, color.hex)}
                                      className={cn(
                                        "flex items-center gap-2 rounded-full border px-3 py-2 text-xs font-bold transition-all",
                                        isSelected
                                          ? "border-[#223227] bg-[#223227] text-white dark:border-white dark:bg-white dark:text-[#101611]"
                                          : "border-black/10 bg-white text-[#223227] hover:border-[#223227] dark:border-white/10 dark:bg-[#111914] dark:text-white",
                                      )}
                                    >
                                      <span className="h-3 w-3 rounded-full border border-black/10" style={{ backgroundColor: color.hex }} />
                                      {color.name}
                                    </button>
                                  );
                                })}
                              </div>

                              <div className="mt-4 flex flex-wrap items-center gap-2">
                                <input
                                  type="color"
                                  value={newColorHex}
                                  onChange={(event) => setNewColorHex(event.target.value)}
                                  className="h-10 w-10 cursor-pointer rounded-xl border border-black/10 bg-white p-1 dark:border-white/10 dark:bg-[#101611]"
                                />
                                <Input
                                  value={newColorName}
                                  onChange={(event) => setNewColorName(event.target.value)}
                                  placeholder="Add custom color"
                                  className="h-10 min-w-[180px] flex-1 rounded-xl"
                                  onKeyDown={(event) => event.key === "Enter" && (event.preventDefault(), addCustomColor())}
                                />
                                <Button type="button" variant="outline" className="rounded-xl" onClick={addCustomColor} disabled={!newColorName.trim()}>
                                  <Plus className="mr-2 h-4 w-4" /> Add color
                                </Button>
                              </div>

                              <div className="mt-4 space-y-3">
                                {selectedColorDetails.length ? selectedColorDetails.map((color: ColorDetail) => (
                                  <div key={color.name} className="flex flex-wrap items-center gap-3 rounded-2xl border border-black/5 bg-white p-3 dark:border-white/10 dark:bg-[#101611]">
                                    <span className="h-5 w-5 rounded-full border border-black/10" style={{ backgroundColor: color.hex }} />
                                    <div className="min-w-0 flex-1">
                                      <p className="text-sm font-semibold text-[#223227] dark:text-white">{color.name}</p>
                                      <p className="text-[11px] text-muted-foreground">Color code for {color.name}</p>
                                    </div>
                                    <Input
                                      value={color.hex}
                                      onChange={(event) => updateColorHex(color.name, event.target.value)}
                                      className="h-10 w-[140px] rounded-xl"
                                      placeholder="#1c1b1b"
                                    />
                                    <Button type="button" variant="ghost" size="icon" className="rounded-full" onClick={() => removeColorSelection(color.name)}>
                                      <X className="h-4 w-4" />
                                    </Button>
                                  </div>
                                )) : (
                                  <div className="rounded-2xl border border-dashed border-black/10 px-4 py-5 text-sm text-muted-foreground dark:border-white/10">
                                    Add at least one color to start building variants.
                                  </div>
                                )}
                              </div>
                            </div>

                            <div className="rounded-2xl border border-black/5 bg-[#fbfaf7] p-5 dark:border-white/10 dark:bg-white/[0.02]">
                              <div className="mb-4 flex items-center gap-2">
                                <Ruler className="h-4 w-4" />
                                <div>
                                  <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#223227] dark:text-white">Choose size</p>
                                  <p className="text-xs text-muted-foreground">Pick the active size buttons or add custom sizes like XXL.</p>
                                </div>
                              </div>

                              <div className="flex flex-wrap gap-2">
                                {availableSizes.map((size) => {
                                  const isSelected = selectedSizes.includes(size);
                                  return (
                                    <button
                                      key={size}
                                      type="button"
                                      onClick={() => toggleSize(size)}
                                      className={cn(
                                        "rounded-full border px-3 py-2 text-xs font-bold uppercase transition-all",
                                        isSelected
                                          ? "border-[#223227] bg-[#223227] text-white dark:border-white dark:bg-white dark:text-[#101611]"
                                          : "border-black/10 bg-white text-[#223227] hover:border-[#223227] dark:border-white/10 dark:bg-[#111914] dark:text-white",
                                      )}
                                    >
                                      {size}
                                    </button>
                                  );
                                })}
                              </div>

                              <div className="mt-4 flex flex-wrap items-center gap-2">
                                <Input
                                  value={newSizeInput}
                                  onChange={(event) => setNewSizeInput(event.target.value)}
                                  placeholder="Add size"
                                  className="h-10 min-w-[140px] flex-1 rounded-xl"
                                  onKeyDown={(event) => event.key === "Enter" && (event.preventDefault(), addCustomSize())}
                                />
                                <Button type="button" variant="outline" className="rounded-xl" onClick={addCustomSize} disabled={!newSizeInput.trim()}>
                                  <Plus className="mr-2 h-4 w-4" /> Add size
                                </Button>
                              </div>

                              <div className="mt-4 rounded-2xl border border-black/5 bg-white/80 px-4 py-4 dark:border-white/10 dark:bg-[#101611]">
                                <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#223227] dark:text-white">Readiness</p>
                                <ul className="mt-3 space-y-2 text-xs text-muted-foreground">
                                  <li className={cn(selectedColors.length > 0 && "text-[#223227] dark:text-white")}>1. Add at least one color</li>
                                  <li className={cn(selectedSizes.length > 0 && "text-[#223227] dark:text-white")}>2. Add at least one size</li>
                                  <li className={cn(hasVariantRequirements && "text-[#223227] dark:text-white")}>3. Make sure each generated row has price + unique SKU</li>
                                </ul>
                              </div>
                            </div>
                          </div>

                          <div className="mt-5 rounded-2xl border border-black/5 bg-[#fbfaf7] p-5 dark:border-white/10 dark:bg-white/[0.02]">
                            <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
                              <div>
                                <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#223227] dark:text-white">Inventory setup</p>
                                <p className="mt-1 text-xs text-muted-foreground">
                                  {variantsEnabled
                                    ? `${variantRows.length} variants generated from ${selectedColors.length || 0} colors × ${selectedSizes.length || 0} sizes.`
                                    : "You can still manage simple stock by size if variants stay off."}
                                </p>
                              </div>
                              <div className="flex items-center gap-2 rounded-full border border-black/5 bg-white px-3 py-1.5 text-xs font-semibold text-[#223227] dark:border-white/10 dark:bg-[#101611] dark:text-white">
                                <span>{totalStock} total qty</span>
                                {duplicateSkuIds.size > 0 ? <Badge variant="destructive" className="rounded-full">Duplicate SKU</Badge> : null}
                              </div>
                            </div>

                            {variantsEnabled ? (
                              <>
                                <div className="mb-4 flex flex-wrap items-center gap-2 rounded-2xl border border-black/5 bg-white p-3 dark:border-white/10 dark:bg-[#101611]">
                                  <Input
                                    type="number"
                                    min={0}
                                    value={bulkSellingPrice}
                                    onChange={(event) => setBulkSellingPrice(event.target.value)}
                                    placeholder="Bulk selling price"
                                    className="h-10 w-[180px] rounded-xl"
                                  />
                                  <Button type="button" variant="outline" className="rounded-xl" onClick={handleBulkApplySellingPrice} disabled={!variantRows.length}>
                                    Apply to all variants
                                  </Button>
                                  <div className="text-xs text-muted-foreground">SKU format: {`${slugifyVariantToken(productName) || "product"}-color-size`}</div>
                                </div>

                                <div className="overflow-x-auto rounded-2xl border border-black/5 bg-white dark:border-white/10 dark:bg-[#101611]">
                                  <table className="min-w-full border-collapse">
                                    <thead className="sticky top-0 bg-[#f7faf4] dark:bg-[#141c16]">
                                      <tr className="text-left text-[11px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
                                        <th className="px-3 py-3">Variant</th>
                                        <th className="px-2 py-3">Crossed Price</th>
                                        <th className="px-2 py-3">Selling Price</th>
                                        <th className="px-2 py-3">Cost Price</th>
                                        <th className="px-2 py-3">Weight</th>
                                        <th className="px-2 py-3">Quantity</th>
                                        <th className="px-2 py-3">SKU</th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {variantRows.length ? variantRows.map((row: ProductVariantRow) => (
                                        <VariantMatrixRow
                                          key={row.id}
                                          row={row}
                                          duplicateSku={duplicateSkuIds.has(row.id)}
                                          onFieldChange={updateVariantField}
                                          onCopySellingPrice={handleCopySellingPrice}
                                        />
                                      )) : (
                                        <tr>
                                          <td colSpan={7} className="px-4 py-8 text-center text-sm text-muted-foreground">
                                            Add colors and sizes to generate your variant combinations.
                                          </td>
                                        </tr>
                                      )}
                                    </tbody>
                                  </table>
                                </div>

                                <div className="mt-4 flex items-center gap-3 rounded-2xl border border-black/5 bg-white px-4 py-3 dark:border-white/10 dark:bg-[#101611]">
                                  <Checkbox
                                    id="continue-selling-out-of-stock"
                                    checked={addForm.watch("continueSellingOutOfStock") === true}
                                    onCheckedChange={(checked) => addForm.setValue("continueSellingOutOfStock", checked === true, { shouldDirty: true })}
                                  />
                                  <Label htmlFor="continue-selling-out-of-stock" className="text-sm font-medium text-[#223227] dark:text-white">
                                    Continue selling even when product is out of stock
                                  </Label>
                                </div>
                              </>
                            ) : (
                              <div className="space-y-4">
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
                                {addForm.watch("stockStatus") === "in_stock" && selectedSizes.length > 0 ? (
                                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
                                    {selectedSizes.map((size: string) => {
                                      const currentStock = stockBySizeValues[size] ?? undefined;
                                      return (
                                        <div key={size} className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-border/50 bg-background/70 p-4 text-center">
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
                                ) : null}
                              </div>
                            )}
                          </div>
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

                        {selectedColors.length > 0 && (
                          <div className="rounded-[28px] border border-black/5 bg-white/90 p-6 shadow-[0_24px_70px_rgba(34,63,41,0.08)] dark:border-white/10 dark:bg-white/[0.04] dark:shadow-none">
                            <h3 className="flex items-center gap-2 text-sm font-bold uppercase tracking-[0.22em] text-muted-foreground">
                              <Palette className="h-4 w-4" /> Color-Specific Images
                            </h3>
                            <p className="mt-2 text-xs text-muted-foreground">
                              Attach images that match each selected color so the storefront can swap visuals on hover or click.
                            </p>
                            <div className="mt-4 space-y-4">
                              {selectedColors.map((color: string) => {
                                const urls = (colorImageMap[color] || []) as string[];
                                return (
                                  <div key={color} className="rounded-2xl border border-border/60 bg-white/80 p-4 dark:bg-white/[0.03]">
                                    <div className="flex items-center justify-between">
                                      <div>
                                        <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-muted-foreground">
                                          {color.replace(/\s*\(#[0-9a-fA-F]{6}\)/, "")}
                                        </p>
                                        <p className="text-xs text-muted-foreground">{urls.length} images</p>
                                      </div>
                                      <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        onClick={() => onMediaLibraryOpen(`add-color:${color}`)}
                                      >
                                        <FolderInput className="mr-1.5 h-3.5 w-3.5" /> From Library
                                      </Button>
                                    </div>
                                    <Textarea
                                      rows={3}
                                      className="mt-3 text-xs"
                                      placeholder="Paste image URLs (one per line)"
                                      value={urls.join("\n")}
                                      onChange={(event) => {
                                        const nextUrls = event.target.value
                                          .split(/\n/)
                                          .map((u) => u.trim())
                                          .filter(Boolean);
                                        const nextMap = { ...(colorImageMap as Record<string, string[]>) };
                                        if (nextUrls.length) {
                                          nextMap[color] = nextUrls;
                                        } else {
                                          delete nextMap[color];
                                        }
                                        addForm.setValue("colorImageMap", nextMap, { shouldDirty: true });
                                      }}
                                    />
                                    {urls.length > 0 ? (
                                      <div className="mt-3 grid grid-cols-4 gap-3">
                                        {urls.map((url, index) => (
                                          <div key={`${color}-${index}`} className="group relative aspect-square overflow-hidden rounded-lg border border-border">
                                            <img src={url} alt="" className="h-full w-full object-cover" />
                                            <button
                                              type="button"
                                              className="absolute right-1 top-1 rounded-full bg-black/70 p-0.5 text-white opacity-0 transition-opacity group-hover:opacity-100"
                                              onClick={() => {
                                                const nextUrls = urls.filter((_, i) => i !== index);
                                                const nextMap = { ...(colorImageMap as Record<string, string[]>) };
                                                if (nextUrls.length) {
                                                  nextMap[color] = nextUrls;
                                                } else {
                                                  delete nextMap[color];
                                                }
                                                addForm.setValue("colorImageMap", nextMap, { shouldDirty: true });
                                              }}
                                            >
                                              <X className="h-3 w-3" />
                                            </button>
                                          </div>
                                        ))}
                                      </div>
                                    ) : null}
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}
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
