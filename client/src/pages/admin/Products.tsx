import { useLocation } from "wouter";
import { lazy, Suspense, useEffect, useMemo, useRef, useState } from "react";
import { ViewToggle } from "@/components/admin/ViewToggle";
import { Pagination } from "@/components/admin/Pagination";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { 
  Loader2, Trash2, Palette, Ruler, Tags, Pipette, 
  Share2, FileText, Download, Check, X, Pencil, Search, Table as TableIcon,
  ChevronRight, FileSpreadsheet, Eye, EyeOff, LayoutTemplate, Shirt, Footprints, Tag,
  MoreHorizontal, ImageIcon, ArrowLeft, Upload, ExternalLink, ShoppingCart, TrendingUp, Calendar, Percent,
  FolderInput, Box, CheckCircle2, ChevronDown, Plus, Star, Sparkles, Power, PowerOff
} from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { 
  fetchAdminProductsPage,
  fetchAdminProductStats,
  createAdminProduct, 
  updateAdminProduct, 
  updateAdminProductHomeFeatured,
  deleteAdminProduct, 
  uploadProductImageFile, 
  fetchAdminAttributes, 
  ProductAttribute,
  createCategory,
  updateCategory,
  deleteCategory,
  bulkCategorizeProducts,
  toggleProductActive,
} from "@/lib/adminApi";
import { fetchCategories, type ProductApi, type CategoryApi } from "@/lib/api";
import { compressImageFile } from "@/lib/imageUtils";
import { useToast } from "@/hooks/use-toast";
import { formatPrice } from "@/lib/format";
import { QuantityInput } from "@/components/ui/quantity-input";
import { PriceInput } from "@/components/ui/price-input";
import { Checkbox } from "@/components/ui/checkbox";
import { UploadProgress } from "@/components/ui/upload-progress";
import { MediaLibrary } from "@/components/admin/MediaLibrary";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Textarea } from "@/components/ui/textarea";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { 
  Sheet, 
  SheetContent, 
  SheetDescription, 
  SheetHeader, 
  SheetTitle, 
  SheetTrigger 
} from "@/components/ui/sheet";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import AddProductWizard from "./AddProductWizard";
import {
  DEFAULT_PRODUCT_SIZES,
  DEFAULT_PRODUCT_VARIANTS,
  DEFAULT_PRODUCT_VARIANT_SWATCHES,
  extractAttributeLabel,
  normalizeAttributeLabel,
  uniqueNormalizedValues,
} from "@shared/productAttributes";
import {
  buildInventorySyncPayload,
  buildStockBySizeDraft,
  getTotalStockFromForm,
  parseStoredSizeOptions,
  syncStockBySizeToSizes,
} from "./productStock";
import { getErrorMessage } from "@/lib/queryClient";

const ARCHIVED_PRODUCT_CATEGORY = "__archived__";
const ARCHIVED_PRODUCT_CATEGORY_PREFIX = `${ARCHIVED_PRODUCT_CATEGORY}::`;

const AttributesManager = lazy(() =>
  import("./AttributesManager").then((module) => ({ default: module.AttributesManager })),
);

function slugify(s: string): string {
  return s
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "");
}

function resolveCategorySlug(
  productCategory: string | null | undefined,
  categories: CategoryApi[],
): string {
  const rawCategory = (productCategory ?? "").trim();
  const productCategoryRaw = getArchivedProductOriginalCategory(rawCategory) ?? rawCategory;
  const normalize = (s: string) => s.trim().toLowerCase().replace(/[_\s-]+/g, "");
  const wanted = normalize(productCategoryRaw);
  const matchedCategory = categories.find((c) => {
    const slug = normalize(c.slug);
    const name = normalize(c.name);
    const nameAsSlug = normalize(slugify(c.name));
    return wanted.length > 0 && (slug === wanted || name === wanted || nameAsSlug === wanted);
  });

  return matchedCategory?.slug ?? (productCategoryRaw || categories[0]?.slug || "");
}

function isArchivedProductCategory(category: string | null | undefined): boolean {
  return category === ARCHIVED_PRODUCT_CATEGORY || Boolean(category?.startsWith(ARCHIVED_PRODUCT_CATEGORY_PREFIX));
}

function getArchivedProductOriginalCategory(category: string | null | undefined): string | null {
  if (!category) return null;
  if (category.startsWith(ARCHIVED_PRODUCT_CATEGORY_PREFIX)) {
    const restored = category.slice(ARCHIVED_PRODUCT_CATEGORY_PREFIX.length).trim();
    return restored.length > 0 ? restored : null;
  }
  return null;
}

function getProductCategoryLabel(product: ProductApi): string {
  if (!isArchivedProductCategory(product.category)) {
    return product.category || "General";
  }

  return getArchivedProductOriginalCategory(product.category) || "Archived";
}

function orderByDefaults(values: string[], defaults: readonly string[]): string[] {
  const defaultOrder = new Map(defaults.map((value, index) => [value, index]));

  return [...values].sort((a, b) => {
    const aIndex = defaultOrder.get(normalizeAttributeLabel(a));
    const bIndex = defaultOrder.get(normalizeAttributeLabel(b));

    if (aIndex !== undefined && bIndex !== undefined) return aIndex - bIndex;
    if (aIndex !== undefined) return -1;
    if (bIndex !== undefined) return 1;
    return a.localeCompare(b);
  });
}

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
  homeFeatured: z.boolean().default(false),
  homeFeaturedImageIndex: z.coerce.number().default(2),
  isNewArrival: z.boolean().default(false),
  isNewCollection: z.boolean().default(false),
});

type ProductFormValues = z.infer<typeof productSchema>;

type PendingGalleryImage = {
  id: string;
  file: File;
  previewUrl: string;
};

export default function AdminProducts() {
  const [location, setLocation] = useLocation();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"active" | "draft" | "archived">("active");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [addOpen, setAddOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editProduct, setEditProduct] = useState<ProductApi | null>(null);
  const [newCategoryOpen, setNewCategoryOpen] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [selectedProductIds, setSelectedProductIds] = useState<Set<string>>(new Set());
  const [attrSheetOpen, setAttrSheetOpen] = useState(false);
  const [mediaLibraryOpen, setMediaLibraryOpen] = useState(false);
  const [mediaLibraryTarget, setMediaLibraryTarget] = useState<'add-main' | 'add-gallery' | 'edit-main' | 'edit-gallery' | null>(null);
  const [moveCategoryOpen, setMoveCategoryOpen] = useState(false);
  const [moveSelectionIds, setMoveSelectionIds] = useState<Set<string>>(new Set());
  const [moveMode, setMoveMode] = useState<"existing" | "new">("existing");
  const [moveExistingSlug, setMoveExistingSlug] = useState<string>("");
  const [moveNewCategoryName, setMoveNewCategoryName] = useState<string>("");
  const [productPage, setProductPage] = useState(1);
  const [productPageSize, setProductPageSize] = useState(12);

  const { data: attributes } = useQuery<ProductAttribute[]>({
    queryKey: ["admin", "attributes"],
    queryFn: () => fetchAdminAttributes(),
  });

  const colorSwatches = useMemo(() => {
    const swatches: Record<string, string> = { ...DEFAULT_PRODUCT_VARIANT_SWATCHES };
    (attributes ?? [])
      .filter((attribute) => attribute.type === "color")
      .forEach((attribute) => {
        const [label, hex] = attribute.value.split("|");
        const normalized = normalizeAttributeLabel(label);
        if (normalized && hex?.trim()) swatches[normalized] = hex.trim();
      });
    return swatches;
  }, [attributes]);
  const dynamicColors = useMemo(
    () =>
      orderByDefaults(
        uniqueNormalizedValues([
          ...DEFAULT_PRODUCT_VARIANTS,
          ...((attributes ?? [])
            .filter((attribute) => attribute.type === "color")
            .map((attribute) => attribute.value)),
        ]),
        DEFAULT_PRODUCT_VARIANTS,
      ),
    [attributes],
  );
  const dynamicSizes = useMemo(
    () =>
      orderByDefaults(
        uniqueNormalizedValues([
          ...DEFAULT_PRODUCT_SIZES,
          ...((attributes ?? [])
            .filter((attribute) => attribute.type === "size")
            .map((attribute) => attribute.value)),
        ]),
        DEFAULT_PRODUCT_SIZES,
      ),
    [attributes],
  );
  const [newCategorySlug, setNewCategorySlug] = useState("");
  const [pendingCategoryForm, setPendingCategoryForm] = useState<"add" | "edit" | null>(null);
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [editUploadProgress, setEditUploadProgress] = useState(0);
  const [showEditUploadProgress, setShowEditUploadProgress] = useState(false);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);
  const [galleryTarget, setGalleryTarget] = useState<"add" | "edit" | null>(null);
  const [addPendingGalleryImages, setAddPendingGalleryImages] = useState<PendingGalleryImage[]>([]);
  const [editPendingGalleryImages, setEditPendingGalleryImages] = useState<PendingGalleryImage[]>([]);
  const [galleryUploadStatus, setGalleryUploadStatus] = useState<{
    mode: "add" | "edit";
    completed: number;
    total: number;
    progress: number;
  } | null>(null);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // Edit page managers
  const [showColorManager, setShowColorManager] = useState(false);
  const [showSizeManager, setShowSizeManager] = useState(false);
  const [editNewColorHex, setEditNewColorHex] = useState("#000000");
  const [editNewColorName, setEditNewColorName] = useState("");
  const [editNewSize, setEditNewSize] = useState("");

  const { data: categories = [] } = useQuery({
    queryKey: ["categories"],
    queryFn: fetchCategories,
  });

  useEffect(() => {
    setProductPage(1);
  }, [search, categoryFilter, productPageSize, statusFilter]);

  const filters = useMemo(
    () => ({
      search: search || undefined,
      category:
        statusFilter === "archived"
          ? undefined
          : categoryFilter === "all"
            ? undefined
            : categoryFilter,
      page: productPage,
      limit: productPageSize,
      status: statusFilter,
    }),
    [search, categoryFilter, productPage, productPageSize, statusFilter],
  );

  const {
    data: productPageData,
    isLoading,
    isError,
  } = useQuery<{ data: ProductApi[]; total: number }>({
    queryKey: ["admin", "products", filters],
    queryFn: () => fetchAdminProductsPage(filters),
  });

  const quickSearch = search.trim();
  const { data: quickSearchData, isFetching: quickSearchLoading } = useQuery<{ data: ProductApi[]; total: number }>({
    queryKey: ["admin", "products", "quick-search", quickSearch, statusFilter],
    queryFn: () => fetchAdminProductsPage({ search: quickSearch, page: 1, limit: 5, status: statusFilter }),
    enabled: quickSearch.length > 1,
    staleTime: 30_000,
  });

  const { data: productStats } = useQuery({
    queryKey: ["admin", "products", "stats"],
    queryFn: () => fetchAdminProductStats(),
  });

  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = {
      all: productStats?.total ?? 0,
      ...(productStats?.categoryCounts ?? {}),
    };
    return counts;
  }, [productStats]);

  const products = productPageData?.data ?? [];
  const totalProducts = productPageData?.total ?? 0;
  const quickResults = quickSearchData?.data ?? [];

  const addForm = useForm<ProductFormValues>({
    resolver: zodResolver(productSchema),
    defaultValues: {
      name: "",
      shortDetails: "",
      description: "",
      category: "",
      price: 0,
      stockStatus: "in_stock",
      stock: 0,
      stockBySize: {},
      imageUrl: "",
      galleryUrlsText: "",
      colorOptions: [],
      sizeOptions: [],
      salePercentage: 0,
      saleActive: false,
      homeFeatured: false,
      homeFeaturedImageIndex: 2,
    },
  });

  const editForm = useForm<ProductFormValues>({
    resolver: zodResolver(productSchema),
    defaultValues: {
      name: "",
      shortDetails: "",
      description: "",
      category: "",
      price: 0,
      stockStatus: "in_stock",
      stock: 0,
      stockBySize: {},
      imageUrl: "",
      galleryUrlsText: "",
      colorOptions: [],
      sizeOptions: [],
      salePercentage: 0,
      saleActive: false,
      homeFeatured: false,
      homeFeaturedImageIndex: 2,
    },
  });
  const editSelectedSizes = uniqueNormalizedValues(editForm.watch("sizeOptions") || []);
  const editStockBySize = editForm.watch("stockBySize") || {};

  // Sync default category when categories load
  useEffect(() => {
    if (categories.length && !addForm.getValues("category")) {
      addForm.setValue("category", categories[0].slug);
    }
  }, [categories, addForm]);

  const isAddProductRoute = location.split("?")[0] === "/admin/products/new";

  const resetAddProductDraft = () => {
    const firstSlug = categories[0]?.slug ?? "";
    addForm.reset({
      name: "",
      shortDetails: "",
      description: "",
      category: firstSlug,
      price: 0,
      stockStatus: "in_stock",
      stock: 0,
      stockBySize: {},
      imageUrl: "",
      galleryUrlsText: "",
      colorOptions: [],
      sizeOptions: [],
      salePercentage: 0,
      saleActive: false,
    });
    setAddPendingGalleryImages([]);
    setGalleryUploadStatus(null);
  };

  const closeAddOverlay = () => {
    setAddOpen(false);
    resetAddProductDraft();
    if (isAddProductRoute) {
      setLocation("/admin/products");
    }
  };

  useEffect(() => {
    if (isAddProductRoute) {
      setAddOpen(true);
    }
  }, [isAddProductRoute]);

  useEffect(() => {
    if (editProduct) {
      const galleryUrls = parseJsonArray(editProduct.galleryUrls);
      const colorOptions = uniqueNormalizedValues(parseJsonArray(editProduct.colorOptions));
      const sizeOptions = uniqueNormalizedValues(parseJsonArray(editProduct.sizeOptions));
      const categorySlug = resolveCategorySlug(editProduct.category, categories);

      editForm.reset({
        name: editProduct.name,
        shortDetails: editProduct.shortDetails ?? "",
        description: editProduct.description ?? "",
        category: categorySlug,
        price: Number(editProduct.price),
        stockStatus: editProduct.stock === 0 ? "out_of_stock" : "in_stock",
        stock: editProduct.stock,
        stockBySize: buildStockBySizeDraft(editProduct),
        imageUrl: editProduct.imageUrl ?? "",
        galleryUrlsText: galleryUrls.join("\n"),
        colorOptions,
        sizeOptions,
        salePercentage: editProduct.salePercentage ?? 0,
        saleActive: editProduct.saleActive ?? false,
        homeFeatured: editProduct.homeFeatured ?? false,
        homeFeaturedImageIndex: editProduct.homeFeaturedImageIndex ?? 2,
        isNewArrival: editProduct.isNewArrival ?? false,
        isNewCollection: editProduct.isNewCollection ?? false,
      });
    }
  }, [editProduct, editForm, categories]);

  useEffect(() => {
    if (!editOpen || !editProduct || categories.length === 0) return;
    const currentCategory = editForm.getValues("category");
    if (currentCategory) return;

    const fallbackCategory = resolveCategorySlug(editProduct.category, categories);
    if (!fallbackCategory) return;

    editForm.setValue("category", fallbackCategory, {
      shouldDirty: false,
      shouldTouch: false,
      shouldValidate: true,
    });
  }, [categories, editForm, editOpen, editProduct]);

  function parseJsonArray(s: string | null | undefined): string[] {
    if (!s || !s.trim()) return [];
    try {
      const a = JSON.parse(s);
      return Array.isArray(a) ? a.filter((x): x is string => typeof x === "string") : [];
    } catch {
      return [];
    }
  }

  const addMutation = useMutation({
    mutationFn: async (values: ProductFormValues) => {
      const existingGalleryUrls = values.galleryUrlsText
        ? values.galleryUrlsText.split(/\n/).map((u) => u.trim()).filter(Boolean)
        : [];
      const stock = getTotalStockFromForm(values);

      let uploadedUrls: string[] = [];
      let failedCount = 0;

      if (addPendingGalleryImages.length) {
        const files = addPendingGalleryImages.map((p) => p.file);
        const total = files.length;
        let completed = 0;
        const progressMap = new Map<number, number>();

        const updateGalleryProgress = () => {
          const totalProgress = Array.from(progressMap.values()).reduce((sum, value) => sum + value, 0);
          const progress = total === 0 ? 0 : Math.round(totalProgress / total);
          setGalleryUploadStatus({ mode: "add", completed, total, progress });
        };

        setGalleryUploadStatus({ mode: "add", completed, total, progress: 0 });

        for (let i = 0; i < files.length; i += 3) {
          const batch = files.slice(i, i + 3);
          const results = await Promise.allSettled(
            batch.map(async (file, batchIndex) => {
              const fileIndex = i + batchIndex;
              progressMap.set(fileIndex, 0);
              updateGalleryProgress();
              try {
              const compressedFile = await compressImageFile(file);
              const url = await uploadProductImageFile(compressedFile, (value) => {
                progressMap.set(fileIndex, value);
                updateGalleryProgress();
              });
                return url;
              } finally {
                progressMap.set(fileIndex, 100);
                updateGalleryProgress();
              }
            }),
          );

          results.forEach((result) => {
            completed += 1;
            if (result.status === "fulfilled") {
              uploadedUrls.push(result.value);
            } else {
              failedCount += 1;
            }
            updateGalleryProgress();
          });
        }

        setGalleryUploadStatus(null);
      }

      const galleryUrls = [...existingGalleryUrls, ...uploadedUrls];
      const { sizeStocks } = buildInventorySyncPayload({
        stockStatus: values.stockStatus,
        currentSizes: values.sizeOptions,
        currentStockBySize: values.stockBySize,
      });

      const createdProduct = await createAdminProduct({
        name: values.name,
        shortDetails: values.shortDetails || undefined,
        description: values.description ?? "",
        price: values.price,
        imageUrl: values.imageUrl?.trim() || null,
        galleryUrls: galleryUrls.length ? JSON.stringify(galleryUrls) : undefined,
        category: values.category || categories[0]?.slug || "",
        stock,
        stockBySize: sizeStocks,
        colorOptions: values.colorOptions.length ? JSON.stringify(values.colorOptions) : undefined,
        sizeOptions: values.sizeOptions.length ? JSON.stringify(values.sizeOptions) : undefined,
        salePercentage: values.salePercentage,
        saleActive: values.saleActive,
      });

      return createdProduct;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "products"] });
      queryClient.invalidateQueries({ queryKey: ["inventory-products-v2"] });
      queryClient.invalidateQueries({ queryKey: ["inventory-summary"] });
      queryClient.invalidateQueries({ queryKey: ["inventory-movements"] });
      queryClient.invalidateQueries({ queryKey: ["products"] });
      toast({ title: "Product added" });
      setAddOpen(false);
      resetAddProductDraft();
      if (isAddProductRoute) {
        setLocation("/admin/products");
      }
    },
    onError: (error) => {
      toast({
        title: "Failed to add product",
        description: getErrorMessage(error, "Please choose a different product name."),
        variant: "destructive",
      });
    },
  });

  const editMutation = useMutation({
    mutationFn: async (values: ProductFormValues) => {
      if (!editProduct) throw new Error("No product selected");
      const existingGalleryUrls = values.galleryUrlsText
        ? values.galleryUrlsText.split(/\n/).map((u) => u.trim()).filter(Boolean)
        : [];
      const stock = getTotalStockFromForm(values);

      let uploadedUrls: string[] = [];
      let failedCount = 0;

      if (editPendingGalleryImages.length) {
        const files = editPendingGalleryImages.map((p) => p.file);
        const total = files.length;
        let completed = 0;
        const progressMap = new Map<number, number>();

        const updateGalleryProgress = () => {
          const totalProgress = Array.from(progressMap.values()).reduce((sum, value) => sum + value, 0);
          const progress = total === 0 ? 0 : Math.round(totalProgress / total);
          setGalleryUploadStatus({ mode: "edit", completed, total, progress });
        };

        setGalleryUploadStatus({ mode: "edit", completed, total, progress: 0 });

        for (let i = 0; i < files.length; i += 3) {
          const batch = files.slice(i, i + 3);
          const results = await Promise.allSettled(
            batch.map(async (file, batchIndex) => {
              const fileIndex = i + batchIndex;
              progressMap.set(fileIndex, 0);
              updateGalleryProgress();
              try {
                const compressedFile = await compressImageFile(file);
                const url = await uploadProductImageFile(compressedFile, (value) => {
                  progressMap.set(fileIndex, value);
                  updateGalleryProgress();
                });
                return url;
              } finally {
                progressMap.set(fileIndex, 100);
                updateGalleryProgress();
              }
            }),
          );

          results.forEach((result) => {
            completed += 1;
            if (result.status === "fulfilled") {
              uploadedUrls.push(result.value);
            } else {
              failedCount += 1;
            }
            updateGalleryProgress();
          });
        }

        setGalleryUploadStatus(null);
      }

      const galleryUrls = [...existingGalleryUrls, ...uploadedUrls];
      const { sizeStocks } = buildInventorySyncPayload({
        stockStatus: values.stockStatus,
        currentSizes: values.sizeOptions,
        currentStockBySize: values.stockBySize,
        previousSizes: parseStoredSizeOptions(editProduct.sizeOptions),
        previousStockBySize: editProduct.stockBySize,
      });

      const updatedProduct = await updateAdminProduct(editProduct.id, {
        name: values.name,
        shortDetails: values.shortDetails || undefined,
        description: values.description ?? "",
        price: values.price,
        imageUrl: values.imageUrl?.trim() || null,
        galleryUrls: galleryUrls.length ? JSON.stringify(galleryUrls) : undefined,
        category:
          values.category ||
          resolveCategorySlug(editProduct.category, categories) ||
          editProduct.category ||
          "",
        stock,
        stockBySize: sizeStocks,
        colorOptions: values.colorOptions.length ? JSON.stringify(values.colorOptions) : undefined,
        sizeOptions: values.sizeOptions.length ? JSON.stringify(values.sizeOptions) : undefined,
        salePercentage: values.salePercentage,
        saleActive: values.saleActive,
      });

      return updatedProduct;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "products"] });
      queryClient.invalidateQueries({ queryKey: ["inventory-products-v2"] });
      queryClient.invalidateQueries({ queryKey: ["inventory-summary"] });
      queryClient.invalidateQueries({ queryKey: ["inventory-movements"] });
      queryClient.invalidateQueries({ queryKey: ["products"] });
      if (editProduct?.id) {
        queryClient.invalidateQueries({ queryKey: ["product", editProduct.id] });
      }
      toast({ title: "Product updated" });
      setEditOpen(false);
      setEditProduct(null);
      setEditPendingGalleryImages([]);
    },
    onError: (error) => {
      toast({
        title: "Failed to update product",
        description: getErrorMessage(error, "Please choose a different product name."),
        variant: "destructive",
      });
    },
  });

  const createCategoryMutation = useMutation({
    mutationFn: (data: { name: string; slug: string }) => createCategory(data),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["categories"] });
      toast({ title: "Category created" });
      setNewCategoryOpen(false);
      setNewCategoryName("");
      setNewCategorySlug("");
      if (pendingCategoryForm === "add") addForm.setValue("category", data.slug);
      else if (pendingCategoryForm === "edit") editForm.setValue("category", data.slug);
      setPendingCategoryForm(null);
    },
    onError: (error) =>
      toast({
        title: "Failed to create category",
        description: getErrorMessage(error, "Please choose a different category name."),
        variant: "destructive",
      }),
  });

  const updateCategoryMutation = useMutation({
    mutationFn: (data: { id: string; name: string; slug: string }) => 
      updateCategory(data.id, { name: data.name, slug: data.slug }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["categories"] });
      toast({ title: "Category updated" });
      setNewCategoryOpen(false);
      setNewCategoryName("");
      setNewCategorySlug("");
      setEditingCategoryId(null);
      setPendingCategoryForm(null);
    },
    onError: (error) =>
      toast({
        title: "Failed to update category",
        description: getErrorMessage(error, "Please choose a different category name."),
        variant: "destructive",
      }),
  });

  // Edit page color/size management handlers
  const handleAddEditColor = () => {
    if (!editNewColorName.trim()) return;
    const label = `${editNewColorName.trim()} (${editNewColorHex})`;
    const existing = editForm.getValues("colorOptions") || [];
    if (!existing.includes(label)) {
      editForm.setValue("colorOptions", [...existing, label], { shouldValidate: true, shouldDirty: true });
    }
    setEditNewColorName("");
  };

  const handleRemoveEditColor = (color: string) => {
    const current = editForm.getValues("colorOptions") || [];
    editForm.setValue("colorOptions", current.filter((x: string) => x !== color), { shouldValidate: true, shouldDirty: true });
  };

  const handleAddEditSize = () => {
    const trimmed = editNewSize.trim().toUpperCase();
    if (!trimmed) return;
    const existing = editForm.getValues("sizeOptions") || [];
    if (!existing.includes(trimmed)) {
      const nextSizes = [...existing, trimmed];
      editForm.setValue("sizeOptions", nextSizes, { shouldValidate: true, shouldDirty: true });
      editForm.setValue("stockBySize", syncStockBySizeToSizes(editForm.getValues("stockBySize"), nextSizes), {
        shouldValidate: false,
        shouldDirty: true,
      });
    }
    setEditNewSize("");
  };

  const handleRemoveEditSize = (size: string) => {
    const current = editForm.getValues("sizeOptions") || [];
    const nextSizes = current.filter((x: string) => x !== size);
    editForm.setValue("sizeOptions", nextSizes, { shouldValidate: true, shouldDirty: true });
    editForm.setValue("stockBySize", syncStockBySizeToSizes(editForm.getValues("stockBySize"), nextSizes), {
      shouldValidate: false,
      shouldDirty: true,
    });
  };

  const deleteCategoryMutation = useMutation({
    mutationFn: (id: string) => deleteCategory(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["categories"] });
      toast({ title: "Category deleted" });
      if (categoryFilter !== "all") setCategoryFilter("all");
    },
    onError: (error) =>
      toast({
        title: "Failed to delete category",
        description: getErrorMessage(error, "This category could not be deleted."),
        variant: "destructive",
      }),
  });

  const deleteMutation = useMutation({
    mutationFn: ({ id, permanent = false }: { id: string; permanent?: boolean }) =>
      deleteAdminProduct(id, { permanent }),
    onMutate: async ({ id, permanent }: { id: string; permanent?: boolean }) => {
      await queryClient.cancelQueries({ queryKey: ["admin", "products"] });
      const queryKey = [
        "admin",
        "products",
        filters,
      ] as const;
      const previous = queryClient.getQueryData<{ data: ProductApi[]; total: number }>(queryKey);
      if (previous) {
        queryClient.setQueryData<{ data: ProductApi[]; total: number }>(queryKey, {
          data: previous.data.filter((p) => p.id !== id),
          total: Math.max(0, previous.total - 1),
        });
      }
      return { previous, queryKey, permanent };
    },
    onError: (error, _variables, context) => {
      if (context?.previous && context.queryKey) {
        queryClient.setQueryData(context.queryKey, context.previous);
      }
      toast({
        title: context?.permanent ? "Failed to permanently delete product" : "Failed to archive product",
        description: getErrorMessage(
          error,
          context?.permanent
            ? "This product could not be permanently deleted."
            : "This product could not be moved to archive.",
        ),
        variant: "destructive",
      });
    },
    onSuccess: (_data, variables) => {
      toast({
        title: variables.permanent ? "Product permanently deleted" : "Product moved to archive",
      });
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "products"] });
      queryClient.invalidateQueries({ queryKey: ["admin", "products", "stats"] });
    },
  });

  const [togglingProductId, setTogglingProductId] = useState<string | null>(null);

  const toggleMutation = useMutation({
    mutationFn: (id: string) => {
      setTogglingProductId(id);
      return toggleProductActive(id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "products"] });
      queryClient.invalidateQueries({ queryKey: ["admin", "products", "stats"] });
      toast({ title: "Product status updated" });
    },
    onError: () => {
      toast({ title: "Failed to update product", variant: "destructive" });
    },
    onSettled: () => {
      setTogglingProductId(null);
    },
  });

  const bulkToggleMutation = useMutation({
    mutationFn: async (ids: string[]) => {
      await Promise.all(ids.map(id => toggleProductActive(id)));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "products"] });
      queryClient.invalidateQueries({ queryKey: ["admin", "products", "stats"] });
      clearSelection();
      toast({ title: "Product status updated" });
    },
    onError: () => {
      toast({ title: "Failed to update products", variant: "destructive" });
    },
  });

  const homeFeaturedMutation = useMutation({
    mutationFn: (input: { id: string; homeFeatured: boolean; homeFeaturedImageIndex?: number }) =>
      updateAdminProductHomeFeatured(input.id, {
        homeFeatured: input.homeFeatured,
        homeFeaturedImageIndex: input.homeFeaturedImageIndex,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "products"] });
      toast({ title: "Home feature updated" });
    },
    onError: () => {
      toast({ title: "Failed to update home feature", variant: "destructive" });
    },
  });

  const updateVisibilityMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: { isNewArrival?: boolean; isNewCollection?: boolean } }) =>
      updateAdminProduct(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "products"] });
      toast({ title: "Visibility updated" });
    },
    onError: () => {
      toast({ title: "Failed to update visibility", variant: "destructive" });
    },
  });

  const filteredProducts = products;
  const productTotalPages = Math.max(1, Math.ceil(totalProducts / productPageSize));
  const paginatedProducts = filteredProducts;
  const featuredCount = productStats?.featuredCount ?? 0;
  const statusTabs = useMemo(
    () => [
      { id: "active" as const, label: "Active", count: productStats?.activeCount ?? 0 },
      { id: "draft" as const, label: "Draft", count: productStats?.draftCount ?? 0 },
      { id: "archived" as const, label: "Archived", count: productStats?.archivedCount ?? 0 },
    ],
    [productStats],
  );
  const categoryTabs = useMemo(
    () => [{ id: "all", slug: "all", name: "All" }, ...categories.filter((category) => category.slug !== ARCHIVED_PRODUCT_CATEGORY)],
    [categories],
  );
  const visibleCategoryTabs = categoryTabs.slice(0, 8);
  const moreCategoryTabs = categoryTabs.slice(8);

  const selectedProductsForMove = useMemo(
    () => filteredProducts.filter(p => moveSelectionIds.has(p.id)),
    [filteredProducts, moveSelectionIds],
  );

  const handleOpenMoveDialog = () => {
    if (selectedProductIds.size === 0) return;
    const nextIds = new Set(selectedProductIds);
    setMoveSelectionIds(nextIds);
    setMoveMode("existing");
    setMoveExistingSlug(categoryFilter !== "all" ? categoryFilter : (categories[0]?.slug ?? ""));
    setMoveNewCategoryName("");
    setMoveCategoryOpen(true);
  };

  const clearSelection = () => {
    setSelectedProductIds(new Set());
    setMoveSelectionIds(new Set());
  };

  const clearSearchInput = () => {
    setSearch("");
  };

  const openEditOverlay = (product: ProductApi) => {
    clearSearchInput();
    setEditProduct(product);
    setEditOpen(true);
  };

  const [viewMode, setViewMode] = useState<"grid" | "list">("list");

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 px-2">
        <div>
          <h1 className="text-3xl font-serif font-medium text-[#2C3E2D] dark:text-foreground">
            Products
          </h1>
          <p className="text-muted-foreground mt-1">
            Manage your product catalog and inventory
          </p>
        </div>
        
        <div className="hidden sm:flex items-center gap-2 w-full sm:w-auto justify-end">
          <Button 
            data-testid="admin-products-add-open"
            className="rounded-2xl bg-gradient-to-r from-[#2C5234] to-[#3A6A45] hover:brightness-110 text-white shadow-[0_10px_24px_rgba(34,63,41,0.2)] hover:shadow-[0_14px_30px_rgba(34,63,41,0.25)] transition-all duration-300 flex-1 sm:flex-none"
            onClick={() => setAddOpen(true)}
          >
            Add Product
          </Button>
          <Button 
            variant="outline"
            className="rounded-2xl border-[#CDD7C8] bg-gradient-to-br from-white to-[#F3F7F1] dark:from-card dark:to-card/80 shadow-[0_8px_18px_rgba(34,63,41,0.1)] hover:-translate-y-0.5 hover:shadow-[0_12px_24px_rgba(34,63,41,0.16)] transition-all duration-300 flex-1 sm:flex-none"
            onClick={() => setAttrSheetOpen(true)}
          >
            Attributes
          </Button>
        </div>
      </div>



      {/* Full-page Add Product Wizard */}
      {addOpen && (
        <AddProductWizard
          categories={categories}
          onCategoryCreated={() => {
            queryClient.invalidateQueries({ queryKey: ["categories"] });
          }}
          addForm={addForm}
          addMutation={addMutation}
          onClose={closeAddOverlay}
          imageInputRef={imageInputRef}
          galleryInputRef={galleryInputRef}
          pendingGalleryImages={addPendingGalleryImages}
          setPendingGalleryImages={setAddPendingGalleryImages}
          setUploadingImage={setUploadingImage}
          toast={toast}
          galleryUploadStatus={galleryUploadStatus}
          onMediaLibraryOpen={(target) => {
            setMediaLibraryTarget(target as any);
            setMediaLibraryOpen(true);
          }}
        />
      )}

      <MediaLibrary 
        open={mediaLibraryOpen}
        onOpenChange={setMediaLibraryOpen}
        mode={
          mediaLibraryTarget === "add-gallery" || mediaLibraryTarget === "edit-gallery"
            ? "multiple"
            : "single"
        }
        selectedUrl={
          mediaLibraryTarget === "add-main"
            ? addForm.watch("imageUrl")
            : mediaLibraryTarget === "edit-main"
              ? editForm.watch("imageUrl")
              : undefined
        }
        selectedUrls={
          mediaLibraryTarget === "add-gallery"
            ? (addForm.watch("galleryUrlsText") || "")
                .split(/\n/)
                .map((u) => u.trim())
                .filter(Boolean)
            : mediaLibraryTarget === "edit-gallery"
              ? (editForm.watch("galleryUrlsText") || "")
                  .split(/\n/)
                  .map((u) => u.trim())
                  .filter(Boolean)
              : undefined
        }
        onSelect={(url) => {
          // Only used in "single" mode (main display picture)
          if (mediaLibraryTarget === "add-main") {
            addForm.setValue("imageUrl", url, { shouldValidate: true, shouldDirty: true });
          } else if (mediaLibraryTarget === "edit-main") {
            editForm.setValue("imageUrl", url, { shouldValidate: true, shouldDirty: true });
          }
        }}
        onConfirm={(urls) => {
          // Only used in "multiple" mode (gallery)
          if (!urls.length) return;

          if (mediaLibraryTarget === "add-gallery") {
            const currentText = addForm.getValues("galleryUrlsText") || "";
            const current = currentText
              .split(/\n/)
              .map((u) => u.trim())
              .filter(Boolean);
            const merged = [...current, ...urls.filter((u) => !current.includes(u))];
            addForm.setValue("galleryUrlsText", merged.join("\n"), { shouldValidate: true, shouldDirty: true });
          } else if (mediaLibraryTarget === "edit-gallery") {
            const currentText = editForm.getValues("galleryUrlsText") || "";
            const current = currentText
              .split(/\n/)
              .map((u) => u.trim())
              .filter(Boolean);
            const merged = [...current, ...urls.filter((u) => !current.includes(u))];
            editForm.setValue("galleryUrlsText", merged.join("\n"), { shouldValidate: true, shouldDirty: true });
          }
        }}
      />

      <input
        ref={galleryInputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(e) => {
          const files = Array.from(e.target.files ?? []);
          if (!files.length || !galleryTarget) {
            e.target.value = "";
            return;
          }

          const mapped: PendingGalleryImage[] = files.map((file) => ({
            id: `${file.name}-${file.size}-${file.lastModified}-${Math.random().toString(36).slice(2)}`,
            file,
            previewUrl: URL.createObjectURL(file),
          }));

          if (galleryTarget === "add") {
            setAddPendingGalleryImages((prev) => [...prev, ...mapped]);
          } else if (galleryTarget === "edit") {
            setEditPendingGalleryImages((prev) => [...prev, ...mapped]);
          }

          e.target.value = "";
        }}
      />

      {/* Filter & Category Section with Search Bar */}
      <div className="-mx-1 px-1 pb-2">
        <div className="space-y-3">
          <div className="rounded-2xl border border-[#DCE8DB] bg-white/90 p-2 shadow-[0_8px_20px_rgba(34,63,41,0.08)] dark:border-[#2E3B32] dark:bg-[#151E17]/90 dark:shadow-[0_10px_22px_rgba(0,0,0,0.35)]">
            <div className="flex flex-wrap items-center gap-2">
              {statusTabs.map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => {
                    setStatusFilter(tab.id);
                    setSelectedProductIds(new Set());
                  }}
                  className={cn(
                    "flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition-all",
                    statusFilter === tab.id
                      ? "bg-[#2f3430] text-white shadow-sm dark:bg-[#d9decf] dark:text-[#162117]"
                      : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
                  )}
                >
                  <span>{tab.label}</span>
                  <span
                    className={cn(
                      "rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.18em]",
                      statusFilter === tab.id
                        ? "bg-white/15 text-white dark:bg-[#162117]/10 dark:text-[#162117]"
                        : "bg-muted text-muted-foreground",
                    )}
                  >
                    {tab.count}
                  </span>
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-gradient-to-r from-[#F8FCF8]/95 to-white/95 dark:from-[#151E17]/95 dark:to-[#111915]/95 p-4 rounded-2xl border border-[#DCE8DB] dark:border-[#2E3B32] shadow-[0_8px_20px_rgba(34,63,41,0.08)] dark:shadow-[0_10px_22px_rgba(0,0,0,0.35)] overflow-visible">
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4 flex-1 w-full">
              <div className="flex items-center gap-3 shrink-0">
                <Checkbox 
                  id="select-all"
                  className="h-4 w-4 rounded-sm border-[#6D8A70] data-[state=unchecked]:bg-white dark:border-[#A4C2A8] dark:data-[state=unchecked]:bg-[#1A261E]"
                  checked={filteredProducts.length > 0 && selectedProductIds.size === filteredProducts.length}
                  onCheckedChange={(checked) => {
                    if (checked) {
                      setSelectedProductIds(new Set(filteredProducts.map(p => p.id)));
                    } else {
                      setSelectedProductIds(new Set());
                    }
                  }}
                />
                <Label htmlFor="select-all" className="text-sm cursor-pointer font-bold whitespace-nowrap px-1 text-[#1E2F22] dark:text-[#E7F3E8]">
                  {selectedProductIds.size > 0 ? `${selectedProductIds.size} selected` : 'Select All'}
                </Label>

                {/* Selection actions moved to the left after checkboxes */}
                <AnimatePresence>
                  {selectedProductIds.size > 0 && (
                    <motion.div 
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.9 }}
                      className="flex items-center gap-2 border-l border-[#D0DED0] pl-3 ml-1 dark:border-[#344237]"
                    >
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setSelectedProductIds(new Set())}
                        className="h-8 rounded-full text-[10px] font-black uppercase tracking-widest text-muted-foreground hover:text-foreground px-4 shadow-sm dark:bg-[#1B281F] dark:text-[#D6E7D8] dark:border-[#3A4A3D] dark:hover:bg-[#243428] dark:hover:text-white"
                      >
                        Deselect
                      </Button>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button size="sm" variant="outline" className="h-8 rounded-full text-[10px] font-black uppercase tracking-widest border-destructive/50 text-destructive dark:text-red-400 dark:border-red-400/70 hover:bg-destructive/10 px-4 shadow-sm">
                            Actions
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="start" className="rounded-xl shadow-xl w-48">
                          <DropdownMenuItem 
                            className="text-destructive font-black text-[10px] uppercase tracking-widest p-2.5"
                            onClick={() => {
                              const isPermanentDelete = statusFilter === "archived";
                              if (confirm(
                                isPermanentDelete
                                  ? `Permanently delete ${selectedProductIds.size} archived products?`
                                  : `Move ${selectedProductIds.size} products to archive?`,
                              )) {
                                selectedProductIds.forEach(id =>
                                  deleteMutation.mutate({ id, permanent: isPermanentDelete }),
                                );
                                setSelectedProductIds(new Set());
                              }
                            }}
                          >
                            <Trash2 className="w-3.5 h-3.5 mr-2" />
                            {statusFilter === "archived" ? "Delete Permanently" : "Move to Archive"} ({selectedProductIds.size})
                          </DropdownMenuItem>
                          <DropdownMenuItem 
                            className="font-black text-[10px] uppercase tracking-widest p-2.5 text-orange-600 dark:text-orange-400"
                            onClick={async () => {
                              try {
                                await Promise.all(
                                  Array.from(selectedProductIds).map(id =>
                                    updateAdminProduct(id, { stock: 0 })
                                  )
                                );
                                queryClient.invalidateQueries({ queryKey: ["admin", "products"] });
                                toast({ title: `Marked ${selectedProductIds.size} products as out of stock` });
                                setSelectedProductIds(new Set());
                              } catch {
                                toast({ title: "Failed to update stock", variant: "destructive" });
                              }
                            }}
                          >
                            <Box className="w-3.5 h-3.5 mr-2" /> Mark Out of Stock
                          </DropdownMenuItem>
                          <DropdownMenuItem 
                            className="font-black text-[10px] uppercase tracking-widest p-2.5 text-green-600 dark:text-green-400"
                            onClick={async () => {
                              try {
                                await Promise.all(
                                  Array.from(selectedProductIds).map(id =>
                                    updateAdminProduct(id, { stock: 20 })
                                  )
                                );
                                queryClient.invalidateQueries({ queryKey: ["admin", "products"] });
                                toast({ title: `Marked ${selectedProductIds.size} products as in stock (20)` });
                                setSelectedProductIds(new Set());
                              } catch {
                                toast({ title: "Failed to update stock", variant: "destructive" });
                              }
                            }}
                          >
                            <CheckCircle2 className="w-3.5 h-3.5 mr-2" /> Mark In Stock (20)
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>
            
            {/* Search Bar - Separate row */}
            <div className="w-full max-w-sm relative group">
              <div className="flex items-center bg-white dark:bg-card border border-[#E5E5E0] dark:border-border rounded-full h-10 px-4 transition-all duration-300 focus-within:border-primary/50 shadow-inner">
                <Search className={`h-4 w-4 shrink-0 transition-colors ${search.length > 0 ? 'text-primary' : 'text-muted-foreground'}`} />
                <Input 
                  placeholder="Search products..." 
                  data-testid="admin-products-search"
                  className="border-none focus-visible:ring-0 bg-transparent h-full text-sm placeholder:text-muted-foreground/50 px-3 w-full"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
                {search && (
                  <Button 
                    type="button"
                    variant="ghost" 
                    size="icon" 
                    className="h-7 w-7 shrink-0 rounded-full hover:bg-muted"
                    aria-label="Clear search"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      clearSearchInput();
                    }}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </div>

              <AnimatePresence>
                {search.length > 1 && (
                  <motion.div
                    initial={{ opacity: 0, y: 10, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 10, scale: 0.95 }}
                    className="absolute top-full left-0 right-0 mt-3 p-2 bg-white dark:bg-card border border-[#E5E5E0] dark:border-border rounded-2xl shadow-2xl z-50 max-h-[300px] overflow-auto"
                  >
                    <div className="px-3 py-1.5 text-[9px] uppercase font-bold tracking-[0.2em] text-muted-foreground/60 border-b border-muted/30 mb-2">
                      Quick Results
                    </div>
                    {quickSearchLoading ? (
                      <div className="px-3 py-2 text-xs text-muted-foreground">Searching…</div>
                    ) : quickResults.length === 0 ? (
                      <div className="px-3 py-2 text-xs text-muted-foreground">No matching products.</div>
                    ) : (
                      quickResults.map((p) => (
                        <div
                          key={p.id}
                          className="flex items-center gap-3 p-2 rounded-xl hover:bg-muted/50 transition-colors cursor-pointer"
                          onClick={() => {
                            openEditOverlay(p);
                          }}
                        >
                          <img src={p.imageUrl || "/placeholder.png"} className="w-8 h-8 rounded-lg object-cover" alt="" />
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-bold truncate">{p.name}</p>
                            <p className="text-[9px] text-muted-foreground uppercase">{p.category}</p>
                          </div>
                          <div className="text-right shrink-0">
                            <p className="text-[10px] font-bold">{formatPrice(p.price)}</p>
                          </div>
                        </div>
                      ))
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
            
            <div className="flex items-center gap-4 w-full sm:w-auto justify-between sm:justify-end shrink-0">
              <p className="text-[11px] font-black text-muted-foreground uppercase tracking-widest whitespace-nowrap dark:text-[#CFE0D1]">
                {totalProducts} {statusFilter === "active" ? "Active" : statusFilter === "draft" ? "Draft" : "Archived"} Items
              </p>
              <ViewToggle view={viewMode} onViewChange={setViewMode} />
            </div>
          </div>

          {statusFilter !== "archived" && (
            <div className="rounded-2xl border border-[#DFE9DF] dark:border-[#2E3B32] bg-white/80 dark:bg-[#121A15]/80 p-3 shadow-[0_6px_16px_rgba(34,63,41,0.06)] dark:shadow-[0_10px_20px_rgba(0,0,0,0.25)]">
              <div className="flex flex-wrap items-center gap-2 min-w-0 justify-start">
                {visibleCategoryTabs.map((cat) => (
                  <Button
                    key={cat.id}
                    variant={categoryFilter === cat.slug ? "default" : "outline"}
                    onClick={() => setCategoryFilter(cat.slug)}
                    className={cn(
                      "px-4 py-1.5 rounded-full text-xs font-bold border transition-all shadow-sm h-auto flex-shrink-0",
                      categoryFilter !== cat.slug &&
                        "bg-background text-muted-foreground border-[#CAD9CA] hover:border-primary hover:text-foreground dark:bg-[#19241D] dark:text-[#D5E8D7] dark:border-[#334437] dark:hover:bg-[#223027] dark:hover:text-white",
                    )}
                  >
                    {cat.name}
                  </Button>
                ))}
                {moreCategoryTabs.length > 0 && (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="outline"
                        className="px-4 py-1.5 rounded-full text-xs font-bold border transition-all shadow-sm h-auto flex-shrink-0 dark:bg-[#19241D] dark:text-[#D5E8D7] dark:border-[#334437] dark:hover:bg-[#223027] dark:hover:text-white"
                      >
                        More <ChevronDown className="h-3.5 w-3.5 ml-1" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start" className="max-h-72 overflow-y-auto w-56">
                      {moreCategoryTabs.map((cat) => (
                        <DropdownMenuItem
                          key={cat.id}
                          onClick={() => setCategoryFilter(cat.slug)}
                          className={cn(
                            "cursor-pointer",
                            categoryFilter === cat.slug && "bg-muted font-semibold",
                          )}
                        >
                          {cat.name}
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
              </div>
            </div>
          )}
        </div>
      </div>



      <AnimatePresence mode="wait">
        {viewMode === "grid" ? (
          <motion.div
            key="grid"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
            className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-6"
          >
            {isLoading || isError
          ? Array.from({ length: 8 }).map((_, i) => (
              <div
                key={i}
                className="bg-white dark:bg-card rounded-xl border border-[#E5E5E0] dark:border-border overflow-hidden"
              >
                <div className="aspect-[4/3] bg-muted animate-pulse" />
                <div className="p-5 space-y-3">
                  <div className="h-3 w-20 bg-muted animate-pulse" />
                  <div className="h-4 w-40 bg-muted animate-pulse" />
                  <div className="h-3 w-24 bg-muted animate-pulse" />
                </div>
              </div>
            ))
          : paginatedProducts.map((product) => {
              const isArchivedProduct = isArchivedProductCategory(product.category);
              const isRestoreAction = isArchivedProduct || product.isActive === false;
              return (
              <div
                key={product.id}
                onClick={() => {
                  const next = new Set(selectedProductIds);
                  if (next.has(product.id)) next.delete(product.id);
                  else next.add(product.id);
                  setSelectedProductIds(next);
                }}
                className={cn(
                  "bg-white dark:bg-card rounded-xl border overflow-hidden hover:shadow-xl hover:-translate-y-1 transition-all duration-300 group relative cursor-pointer",
                  selectedProductIds.has(product.id)
                    ? "border-primary ring-2 ring-primary dark:bg-primary/10"
                    : "border-[#E5E5E0] dark:border-border",
                  product.isActive === false && "opacity-50 grayscale",
                )}
                >
                {/* Loading Overlay */}
                {togglingProductId === product.id && (
                  <div className="absolute inset-0 z-50 bg-black/20 dark:bg-black/40 backdrop-blur-[2px] flex items-center justify-center">
                    <div className="bg-white dark:bg-card rounded-xl p-4 shadow-2xl flex flex-col items-center gap-2 border border-border/50">
                      <div className="relative">
                        <div className="w-8 h-8 border-2 border-muted-foreground/20 rounded-full" />
                        <div className="absolute inset-0 w-8 h-8 border-2 border-transparent border-t-amber-500 rounded-full animate-spin" />
                      </div>
                      <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Updating</span>
                    </div>
                  </div>
                )}

                {/* Selection Checkbox */}
                <div className="absolute top-3 left-3 z-30">
                  <Checkbox 
                    checked={selectedProductIds.has(product.id)}
                    onCheckedChange={(checked) => {
                      const next = new Set(selectedProductIds);
                      if (checked) next.add(product.id);
                      else next.delete(product.id);
                      setSelectedProductIds(next);
                    }}
                    onClick={(e) => e.stopPropagation()}
                    className="data-[state=unchecked]:bg-white/90 dark:data-[state=unchecked]:bg-background/90 shadow-sm"
                  />
                </div>

                {/* Image & Hover Overlays */}
                <div className="aspect-[4/3] bg-muted relative overflow-hidden">
                  <img
                    src={product.imageUrl ?? ""}
                    alt={product.name}
                    className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                  />
                  


                  {/* Bottom Stats Overlay (Modern aesthetic) */}
                  <div className="absolute bottom-0 inset-x-0 p-3 bg-gradient-to-t from-black/80 to-transparent translate-y-full group-hover:translate-y-0 transition-transform duration-300 z-20">
                    <div className="flex justify-around items-center text-white text-[10px] uppercase font-bold tracking-wider">
                      <div className="flex flex-col items-center gap-1">
                        <TrendingUp className="h-3 w-3 text-green-400" />
                        <span>Sales: 124</span>
                      </div>
                      <div className="w-px h-6 bg-white/20" />
                      <div className="flex flex-col items-center gap-1">
                        <Calendar className="h-3 w-3 text-blue-400" />
                        <span>NEW</span>
                      </div>
                      <div className="w-px h-6 bg-white/20" />
                      <div className="flex flex-col items-center gap-1">
                        <ShoppingCart className="h-3 w-3 text-orange-400" />
                        <span>Featured</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Content */}
                <div className="p-5">
                  <div className="flex justify-between items-start mb-3">
                    <Badge variant="outline" className="text-[10px] px-2 py-0 font-bold uppercase border-muted-foreground/30 text-muted-foreground">
                      {getProductCategoryLabel(product)}
                    </Badge>
                  </div>
                  
                  <h3 className="font-serif font-medium text-lg mb-1 truncate group-hover:text-primary transition-colors">
                    {product.name}
                  </h3>
                  
                  {(product.isActive === false || isArchivedProduct) && (
                    <Badge className="absolute top-3 right-3 z-20 bg-gray-500 text-white text-[9px] uppercase tracking-wider">
                      {isArchivedProduct ? "Archived" : "Inactive"}
                    </Badge>
                  )}

                  <div className="flex items-center justify-between mt-4">
                    <div className="flex flex-col">
                      <span className="text-xl font-bold tracking-tight">
                        {formatPrice(product.price)}
                      </span>
                    </div>
                    
                    <Badge
                      className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
                        product.stock > 10
                          ? "bg-green-100 text-green-700 border-green-200 dark:bg-green-950/50 dark:text-green-400"
                          : product.stock > 0
                            ? "bg-orange-100 text-orange-700 border-orange-200 dark:bg-orange-950/50 dark:text-orange-400"
                            : "bg-red-100 text-red-700 border-red-200 dark:bg-red-950/50 dark:text-red-400"
                      }`}
                    >
                      {product.stock === 0 ? "OUT OF STOCK" : `${product.stock} IN STOCK`}
                    </Badge>
                  </div>

                  {/* Always Visible Edit/Delete Buttons (as requested) */}
                  <div className="mt-6 pt-4 border-t border-border flex gap-2">
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="flex-none w-9 h-9 border-primary/30 text-primary hover:bg-primary/10"
                      onClick={(e) => {
                        e.stopPropagation();
                        window.open(`/product/${product.id}`, '_blank');
                      }}
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                    </Button>
                    <Button 
                      data-testid={`admin-product-edit-open-${product.id}`}
                      variant="outline" 
                      size="sm" 
                      className="flex-1 text-xs font-bold uppercase tracking-wider h-9"
                      onClick={(e) => {
                        e.stopPropagation();
                        openEditOverlay(product);
                      }}
                    >
                      <Pencil className="w-3.5 h-3.5 mr-2" /> Edit
                    </Button>
                    {!isRestoreAction ? (
                      <Button 
                        variant="outline" 
                        size="sm" 
                        className={cn(
                          "flex-none w-9 h-9 border-amber-300 text-amber-600 hover:bg-amber-50 dark:text-amber-400 dark:border-amber-700 transition-all duration-300",
                          togglingProductId === product.id && "animate-pulse border-amber-500 bg-amber-50 dark:bg-amber-950/30",
                        )}
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleMutation.mutate(product.id);
                        }}
                        title="Mark as inactive"
                        aria-label="Mark as inactive"
                        disabled={togglingProductId === product.id}
                      >
                        {togglingProductId === product.id ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <PowerOff className="w-3.5 h-3.5" />
                        )}
                      </Button>
                    ) : (
                      <Button 
                        variant="outline" 
                        size="sm" 
                        className={cn(
                          "flex-none w-9 h-9 border-green-300 text-green-600 hover:bg-green-50 dark:text-green-400 dark:border-green-700 transition-all duration-300",
                          togglingProductId === product.id && "animate-pulse border-green-500 bg-green-50 dark:bg-green-950/30",
                        )}
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleMutation.mutate(product.id);
                        }}
                        title={isArchivedProduct ? "Move to active" : "Mark as active"}
                        aria-label={isArchivedProduct ? "Move to active" : "Mark as active"}
                        disabled={togglingProductId === product.id}
                      >
                        {togglingProductId === product.id ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Power className="w-3.5 h-3.5" />
                        )}
                      </Button>
                    )}
                      <Button 
                      variant="outline" 
                      size="sm" 
                      className="flex-none w-9 h-9 border-destructive/30 text-destructive hover:bg-destructive/10"
                      onClick={(e) => {
                        e.stopPropagation();
                        const permanent = isArchivedProduct;
                        if (confirm(
                          permanent
                            ? "Are you sure? This permanently deletes the archived product."
                            : "Move this product to archive?",
                        )) {
                          deleteMutation.mutate({ id: product.id, permanent });
                        }
                      }}
                      title={isArchivedProduct ? "Delete permanently" : "Move to archive"}
                      aria-label={isArchivedProduct ? "Delete permanently" : "Move to archive"}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>
              </div>
            )})}
          </motion.div>
        ) : (
          <motion.div
            key="list"
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.98 }}
            transition={{ duration: 0.2 }}
            className="bg-card rounded-xl border border-border overflow-hidden shadow-sm"
          >
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-border bg-muted/20">
                    <th className="p-4 w-12 text-center">
                      <Checkbox 
                        checked={filteredProducts.length > 0 && selectedProductIds.size === filteredProducts.length}
                        onCheckedChange={(checked) => {
                          if (checked) setSelectedProductIds(new Set(filteredProducts.map(p => p.id)));
                          else setSelectedProductIds(new Set());
                        }}
                      />
                    </th>
                    <th className="p-4 font-medium text-xs uppercase tracking-wider text-muted-foreground w-20">Image</th>
                    <th className="p-4 font-medium text-xs uppercase tracking-wider text-muted-foreground">Product</th>
                    <th className="p-4 font-medium text-xs uppercase tracking-wider text-muted-foreground">Category</th>
                    <th className="p-4 font-medium text-xs uppercase tracking-wider text-muted-foreground">Price</th>
                    <th className="p-4 font-medium text-xs uppercase tracking-wider text-muted-foreground">Stock</th>
                    <th className="p-4 font-medium text-xs uppercase tracking-wider text-muted-foreground text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredProducts.map((product) => {
                    const isArchivedProduct = isArchivedProductCategory(product.category);
                    const isRestoreAction = isArchivedProduct || product.isActive === false;
                    return (
                    <tr 
                      key={product.id} 
                      onClick={() => {
                        const next = new Set(selectedProductIds);
                        if (next.has(product.id)) next.delete(product.id);
                        else next.add(product.id);
                        setSelectedProductIds(next);
                      }}
                      className={cn(
                        "border-b border-border hover:bg-muted/10 transition-colors group cursor-pointer relative",
                        selectedProductIds.has(product.id) && "bg-primary/5",
                        product.isActive === false && "opacity-50",
                        togglingProductId === product.id && "before:absolute before:inset-y-0 before:left-0 before:w-1 before:bg-amber-500 before:animate-pulse",
                      )}
                    >
                      <td className="p-4 text-center">
                        <Checkbox 
                          checked={selectedProductIds.has(product.id)}
                          onCheckedChange={(checked) => {
                            const next = new Set(selectedProductIds);
                            if (checked) next.add(product.id);
                            else next.delete(product.id);
                            setSelectedProductIds(next);
                          }}
                          onClick={(e) => e.stopPropagation()}
                        />
                      </td>
                      <td className="p-4">
                        <img
                          src={product.imageUrl ?? ""}
                          alt={product.name}
                          className="w-12 h-12 rounded-lg object-cover bg-muted border border-border/50 shadow-sm"
                        />
                      </td>
                      <td className="p-4">
                        <div className="flex flex-col">
                          <span className="font-serif font-medium text-sm line-clamp-1">{product.name}</span>
                          <span className="text-[10px] text-muted-foreground uppercase tracking-widest">{product.id.substring(0, 8)}</span>
                        </div>
                      </td>
                      <td className="p-4">
                        <Badge variant="outline" className="text-[10px] font-bold uppercase tracking-wider h-5 bg-background border-muted-foreground/30 text-muted-foreground border">
                          {getProductCategoryLabel(product)}
                        </Badge>
                      </td>
                      <td className="p-4">
                        <div className="flex flex-col">
                          <span className="font-bold text-sm">{formatPrice(product.price)}</span>
                          {product.saleActive && (
                            <span className="text-[10px] line-through text-muted-foreground">{formatPrice(product.originalPrice || 0)}</span>
                          )}
                        </div>
                      </td>
                      <td className="p-4">
                        <div className="flex flex-col gap-1 w-24">
                          <span className={cn(
                            "text-[10px] font-bold uppercase tracking-tight",
                            product.stock > 10 ? "text-green-600" : product.stock > 0 ? "text-orange-600" : "text-red-600"
                          )}>
                             {product.stock === 0 ? "OUT OF STOCK" : `${product.stock} IN STOCK`}
                          </span>
                          <div className="h-1 bg-muted rounded-full overflow-hidden">
                            <div 
                              className={cn(
                                "h-full transition-all duration-500",
                                product.stock > 10 ? "bg-green-500" : product.stock > 0 ? "bg-orange-500" : "bg-red-500"
                              )}
                              style={{ width: `${Math.min(100, (product.stock / 20) * 100)}%` }}
                            />
                          </div>
                        </div>
                      </td>
                      <td className="p-4 text-right">
                        <div className="flex justify-end gap-1">
                          <Button 
                            variant="outline" 
                            size="icon" 
                            className="h-8 w-8 border-primary/30 text-primary hover:bg-primary/10"
                            onClick={(e) => {
                              e.stopPropagation();
                              window.open(`/product/${product.id}`, '_blank');
                            }}
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                          </Button>
                          <Button 
                            data-testid={`admin-product-edit-open-${product.id}`}
                            variant="outline" 
                            size="icon" 
                            className="h-8 w-8"
                            onClick={(e) => {
                              e.stopPropagation();
                              openEditOverlay(product);
                            }}
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </Button>
                          {!isRestoreAction ? (
                            <Button 
                              variant="outline" 
                              size="icon" 
                              className={cn(
                                "h-8 w-8 border-amber-300 text-amber-600 hover:bg-amber-50 dark:text-amber-400 dark:border-amber-700 transition-all duration-300",
                                togglingProductId === product.id && "animate-pulse border-amber-500 bg-amber-50 dark:bg-amber-950/30",
                              )}
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleMutation.mutate(product.id);
                              }}
                              title="Mark as inactive"
                              aria-label="Mark as inactive"
                              disabled={togglingProductId === product.id}
                            >
                              {togglingProductId === product.id ? (
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              ) : (
                                <PowerOff className="w-3.5 h-3.5" />
                              )}
                            </Button>
                          ) : (
                            <Button 
                              variant="outline" 
                              size="icon" 
                              className={cn(
                                "h-8 w-8 border-green-300 text-green-600 hover:bg-green-50 dark:text-green-400 dark:border-green-700 transition-all duration-300",
                                togglingProductId === product.id && "animate-pulse border-green-500 bg-green-50 dark:bg-green-950/30",
                              )}
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleMutation.mutate(product.id);
                              }}
                              title={isArchivedProduct ? "Move to active" : "Mark as active"}
                              aria-label={isArchivedProduct ? "Move to active" : "Mark as active"}
                              disabled={togglingProductId === product.id}
                            >
                              {togglingProductId === product.id ? (
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              ) : (
                                <Power className="w-3.5 h-3.5" />
                              )}
                            </Button>
                          )}
                          <Button 
                            variant="outline" 
                            size="icon" 
                            className="h-8 w-8 border-destructive/30 text-destructive hover:bg-destructive/10 dark:text-red-500 dark:border-red-500/30 dark:hover:bg-red-500/10"
                            onClick={(e) => {
                              e.stopPropagation();
                              const permanent = isArchivedProduct;
                              if (confirm(
                                permanent
                                  ? "Are you sure? This permanently deletes the archived product."
                                  : "Move this product to archive?",
                              )) {
                                deleteMutation.mutate({ id: product.id, permanent });
                              }
                            }}
                            title={isArchivedProduct ? "Delete permanently" : "Move to archive"}
                            aria-label={isArchivedProduct ? "Delete permanently" : "Move to archive"}
                            loading={deleteMutation.isPending}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  )})}
                </tbody>
              </table>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Floating selection bar */}
      <AnimatePresence>
        {selectedProductIds.size > 0 && (
          <motion.div
            initial={{ y: 80, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 80, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-x-0 bottom-4 z-40 px-4 sm:px-6 pointer-events-none"
          >
            <div className="max-w-5xl mx-auto pointer-events-auto bg-background/95 dark:bg-neutral-900/95 border border-border shadow-xl rounded-2xl px-4 sm:px-6 py-3 flex flex-col sm:flex-row items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-xs sm:text-sm font-black uppercase tracking-[0.2em] text-muted-foreground">
                <Checkbox
                  checked={true}
                  onCheckedChange={() => clearSelection()}
                  className="mr-1"
                />
                <span>{selectedProductIds.size} products selected</span>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <Button
                  variant="outline"
                  size="sm"
                  className="text-[10px] sm:text-xs font-black uppercase tracking-[0.2em]"
                  onClick={clearSelection}
                >
                  Clear
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="text-[10px] sm:text-xs font-black uppercase tracking-[0.2em] text-amber-600 border-amber-300 hover:bg-amber-50 dark:text-amber-400 dark:border-amber-700"
                  onClick={() => {
                    if (confirm(`Mark ${selectedProductIds.size} products as inactive? They will be hidden from the storefront.`)) {
                      bulkToggleMutation.mutate(Array.from(selectedProductIds));
                    }
                  }}
                  disabled={bulkToggleMutation.isPending}
                >
                  <PowerOff className="w-3.5 h-3.5 mr-1" />
                  Deactivate
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="text-[10px] sm:text-xs font-black uppercase tracking-[0.2em] text-destructive border-destructive/30 hover:bg-destructive/10"
                  onClick={() => {
                    const isPermanentDelete = statusFilter === "archived";
                    if (confirm(
                      isPermanentDelete
                        ? `Permanently delete ${selectedProductIds.size} archived products? This cannot be undone.`
                        : `Move ${selectedProductIds.size} products to archive?`,
                    )) {
                      selectedProductIds.forEach(id =>
                        deleteMutation.mutate({ id, permanent: isPermanentDelete }),
                      );
                    }
                  }}
                >
                  <Trash2 className="w-3.5 h-3.5 mr-1" />
                  {statusFilter === "archived" ? "Delete Permanently" : "Archive"}
                </Button>
                <Button
                  size="sm"
                  className="text-[10px] sm:text-xs font-black uppercase tracking-[0.25em]"
                  onClick={handleOpenMoveDialog}
                >
                  Move to Category
                </Button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Pagination */}
      <div className="bg-white dark:bg-card rounded-xl border border-border overflow-hidden shadow-sm mt-4">
        <Pagination
          currentPage={productPage}
          totalPages={productTotalPages}
          onPageChange={(page) => {
            setProductPage(page);
            setSelectedProductIds(new Set());
          }}
          totalItems={totalProducts}
          pageSize={productPageSize}
          onPageSizeChange={setProductPageSize}
        />
      </div>

      {/* Move to Category Dialog */}
      <Dialog open={moveCategoryOpen} onOpenChange={setMoveCategoryOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle className="text-base sm:text-lg font-black tracking-[0.2em] uppercase">
              Move to Category
            </DialogTitle>
          </DialogHeader>
          <div className="mt-3 space-y-4 max-h-[420px] overflow-y-auto pr-1">
            {selectedProductsForMove.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                No products selected. Close this dialog and select products first.
              </p>
            ) : (
              <div className="space-y-2">
                <p className="text-[11px] uppercase tracking-[0.25em] text-muted-foreground font-bold">
                  {selectedProductsForMove.length} products
                </p>
                <div className="space-y-2">
                  {selectedProductsForMove.map((product) => (
                    <div
                      key={product.id}
                      className="flex items-center gap-3 border border-border rounded-xl px-3 py-2 bg-card/60"
                    >
                      <img
                        src={product.imageUrl ?? ""}
                        alt={product.name}
                        className="w-10 h-10 rounded-md object-cover bg-muted border border-border/50"
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{product.name}</p>
                        <p className="text-[10px] text-muted-foreground uppercase tracking-[0.2em]">
                          {product.category || "General"}
                        </p>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-muted-foreground hover:text-foreground"
                        onClick={() => {
                          const nextIds = new Set(moveSelectionIds);
                          nextIds.delete(product.id);
                          setMoveSelectionIds(nextIds);
                          const nextSelected = new Set(selectedProductIds);
                          nextSelected.delete(product.id);
                          setSelectedProductIds(nextSelected);
                        }}
                      >
                        <X className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="border-t border-border pt-4 space-y-4">
              <RadioGroup
                value={moveMode}
                onValueChange={(v) => setMoveMode(v as "existing" | "new")}
                className="flex flex-col gap-3"
              >
                <div className="flex items-start gap-3">
                  <RadioGroupItem value="existing" id="move-existing" className="mt-1" />
                  <div className="flex-1 space-y-2">
                    <Label htmlFor="move-existing" className="text-xs font-bold uppercase tracking-[0.25em]">
                      Move to existing category
                    </Label>
                    <Select
                      value={moveExistingSlug}
                      onValueChange={setMoveExistingSlug}
                      disabled={moveMode !== "existing" || categories.length === 0}
                    >
                      <SelectTrigger className="h-9 w-full max-w-xs text-xs">
                        <SelectValue placeholder="Select category" />
                      </SelectTrigger>
                      <SelectContent>
                        {categories.map((cat) => (
                          <SelectItem key={cat.id} value={cat.slug}>
                            {cat.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <RadioGroupItem value="new" id="move-new" className="mt-1" />
                  <div className="flex-1 space-y-2">
                    <Label htmlFor="move-new" className="text-xs font-bold uppercase tracking-[0.25em]">
                      Create new category &amp; move
                    </Label>
                    <Input
                      value={moveNewCategoryName}
                      onChange={(e) => setMoveNewCategoryName(e.target.value)}
                      placeholder="New category name"
                      // UX: clicking into the text field should switch the dialog
                      // from "existing" to "new" automatically.
                      onFocus={() => setMoveMode("new")}
                      className="h-9 max-w-xs text-xs"
                    />
                  </div>
                </div>
              </RadioGroup>
            </div>
          </div>
          <DialogFooter className="mt-4 flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3">
            <Button
              type="button"
              variant="ghost"
              onClick={() => setMoveCategoryOpen(false)}
              className="order-2 sm:order-1"
            >
              Cancel
            </Button>
            <Button
              type="button"
              className="order-1 sm:order-2"
              disabled={
                selectedProductsForMove.length === 0 ||
                (moveMode === "existing" && !moveExistingSlug) ||
                (moveMode === "new" && !moveNewCategoryName.trim())
              }
              onClick={async () => {
                const ids = selectedProductsForMove.map((p) => p.id);
                if (ids.length === 0) return;
                try {
                  let targetSlug = moveExistingSlug;
                  let targetName = "";
                  if (moveMode === "existing") {
                    const target = categories.find((c) => c.slug === moveExistingSlug);
                    targetName = target?.name ?? moveExistingSlug;
                  } else {
                    const name = moveNewCategoryName.trim();
                    const slug = slugify(name);
                    const created = await createCategoryMutation.mutateAsync({ name, slug });
                    targetSlug = created.slug;
                    targetName = created.name;
                  }

                  await bulkCategorizeProducts({
                    productIds: ids,
                    categorySlug: targetSlug,
                  });

                  queryClient.invalidateQueries({ queryKey: ["admin", "products"] });
                  toast({
                    title: `Moved ${ids.length} products`,
                    description: targetName ? `Moved to "${targetName}".` : undefined,
                  });
                  clearSelection();
                  setMoveCategoryOpen(false);
                } catch (err: any) {
                  toast({
                    title: "Failed to move products",
                    description: err?.message ?? "Please try again.",
                    variant: "destructive",
                  });
                }
              }}
            >
              Confirm Move
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Full-page Edit Product overlay */}
      {editOpen && editProduct && (
        <div className="fixed inset-0 z-40 bg-background overflow-auto">
          <div className="max-w-[1400px] mx-auto p-4 sm:p-6 pb-20">
            <Button
              type="button"
              variant="ghost"
              className="mb-6 -ml-2"
              onClick={() => { setEditOpen(false); setEditProduct(null); }}
            >
              <ArrowLeft className="w-4 h-4 mr-2" /> Back to products
            </Button>
            
            <div className="flex flex-col lg:flex-row gap-8 lg:gap-16">
              {/* LEFT COLUMN: Data Form */}
              <div className="flex-1 lg:max-w-[500px]">
                <h2 className="text-2xl font-serif font-medium mb-8">Edit: {editProduct.name}</h2>
                <Form {...editForm}>
                  <form
                    id="edit-product-form"
                    onSubmit={editForm.handleSubmit((values) => editMutation.mutate(values))}
                    className="space-y-8"
                  >
                    <div className="space-y-4">
                      <h3 className="text-xs font-semibold tracking-widest uppercase text-muted-foreground">Product Details</h3>
                      <FormField
                        control={editForm.control}
                        name="name"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Product Name *</FormLabel>
                            <FormControl>
                              <Input data-testid="admin-product-edit-name" placeholder="Two-Way Zip Hoodie" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={editForm.control}
                        name="shortDetails"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Short details</FormLabel>
                            <FormControl>
                              <Input data-testid="admin-product-edit-short-details" placeholder="Brief tagline" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={editForm.control}
                        name="description"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Full description</FormLabel>
                            <FormControl>
                              <Textarea rows={4} placeholder="Full description..." {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                    <div className="space-y-4">
                      <h3 className="text-xs font-semibold tracking-widest uppercase text-muted-foreground">Pricing &amp; Stock</h3>
                      <FormField
                        control={editForm.control}
                        name="price"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Price (NPR) *</FormLabel>
                            <FormControl>
                              <PriceInput
                                data-testid="admin-product-edit-price"
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

                      {/* Sale Section for Edit */}
                      <div className="p-4 rounded-2xl bg-primary/5 border border-primary/10 space-y-4">
                        <div className="flex items-center justify-between">
                          <div className="space-y-0.5">
                            <Label className="text-sm font-bold flex items-center gap-2">
                              <Percent className="w-4 h-4 text-primary" /> Active Sale
                            </Label>
                            <p className="text-[10px] text-muted-foreground">Apply a discount to this product</p>
                          </div>
                          <FormField
                            control={editForm.control}
                            name="saleActive"
                            render={({ field }) => (
                              <FormItem>
                                <FormControl>
                                  <Switch
                                    checked={field.value}
                                    onCheckedChange={field.onChange}
                                  />
                                </FormControl>
                              </FormItem>
                            )}
                          />
                        </div>

                        <AnimatePresence>
                          {editForm.watch("saleActive") && (
                            <motion.div
                              initial={{ opacity: 0, height: 0 }}
                              animate={{ opacity: 1, height: "auto" }}
                              exit={{ opacity: 0, height: 0 }}
                              className="pt-2 border-t border-primary/10"
                            >
                              <FormField
                                control={editForm.control}
                                name="salePercentage"
                                render={({ field }) => (
                                  <FormItem>
                                    <div className="flex items-center justify-between mb-2">
                                      <FormLabel className="text-[11px] font-bold uppercase tracking-wider">Discount Percentage</FormLabel>
                                      <span className="text-lg font-serif font-black text-primary">{field.value}% OFF</span>
                                    </div>
                                    <FormControl>
                                      <div className="space-y-2">
                                        <Input 
                                          type="range" 
                                          min="0" 
                                          max="90" 
                                          step="5" 
                                          className="h-2 bg-primary/20 accent-primary"
                                          {...field} 
                                        />
                                        <div className="flex justify-between text-[9px] font-bold text-muted-foreground px-1">
                                          <span>0%</span>
                                          <span>25%</span>
                                          <span>50%</span>
                                          <span>75%</span>
                                          <span>90%</span>
                                        </div>
                                      </div>
                                    </FormControl>
                                    <FormMessage />
                                  </FormItem>
                                )}
                              />
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>

                      <FormField
                        control={editForm.control}
                        name="stockStatus"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Stock status</FormLabel>
                            <FormControl>
                              <RadioGroup
                                value={field.value}
                                onValueChange={field.onChange}
                                className="flex gap-4"
                              >
                                <div className="flex items-center space-x-2">
                                  <RadioGroupItem value="in_stock" id="edit-in-stock" />
                                  <Label htmlFor="edit-in-stock">In Stock</Label>
                                </div>
                                <div className="flex items-center space-x-2">
                                  <RadioGroupItem value="out_of_stock" id="edit-out-of-stock" />
                                  <Label htmlFor="edit-out-of-stock">Out of Stock</Label>
                                </div>
                              </RadioGroup>
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      {editForm.watch("stockStatus") === "in_stock" && (
                        <div className="space-y-3">
                          <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Stock by Size</p>
                          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                            {editSelectedSizes.map((size) => {
                              const currentStock = editStockBySize[size] ?? 0;
                              return (
                                <div key={size} className="flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-2 transition-colors focus-within:border-primary focus-within:ring-1 focus-within:ring-primary/20">
                                  <span className="text-xs font-bold shrink-0 w-6">{size}</span>
                                  <input
                                    type="number"
                                    min={0}
                                    step={1}
                                    value={currentStock}
                                    onChange={(e) => {
                                      const current = editForm.getValues("stockBySize") || {};
                                      editForm.setValue(
                                        "stockBySize",
                                        {
                                          ...syncStockBySizeToSizes(current, editSelectedSizes),
                                          [size]: parseInt(e.target.value, 10) || 0,
                                        },
                                        { shouldValidate: false, shouldDirty: true },
                                      );
                                    }}
                                    className="w-full h-7 border-0 bg-transparent text-sm font-medium tabular-nums outline-none text-right [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none placeholder:text-muted-foreground/40"
                                    placeholder="0"
                                  />
                                </div>
                              );
                            })}
                          </div>
                          <div className="flex justify-between items-center pt-2 border-t border-border/50">
                            <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Total</span>
                            <span className="text-base font-bold tabular-nums">
                              {editSelectedSizes.reduce((total: number, size: string) => {
                                return total + (editStockBySize[size] ?? 0);
                              }, 0)}
                            </span>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Feature on Home */}
                    <div className="space-y-4">
                      <h3 className="text-xs font-semibold tracking-widest uppercase text-muted-foreground">Home Page</h3>
                      <div className="p-4 rounded-2xl bg-muted/30 border border-border space-y-3">
                        <div className="flex items-center justify-between">
                          <div className="space-y-0.5">
                            <Label className="text-sm font-bold flex items-center gap-2">
                              <Star className="w-4 h-4 text-amber-500" /> Feature on Home
                            </Label>
                            <p className="text-[10px] text-muted-foreground">Show this product in the New Arrivals section</p>
                          </div>
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <span>
                                  <Switch
                                    checked={Boolean(editForm.watch("homeFeatured"))}
                                    disabled={
                                      homeFeaturedMutation.isPending ||
                                      (!editForm.watch("homeFeatured") && featuredCount >= 8)
                                    }
                                    onCheckedChange={(checked) => {
                                      editForm.setValue("homeFeatured", checked, { shouldValidate: false });
                                      homeFeaturedMutation.mutate({
                                        id: editProduct.id,
                                        homeFeatured: checked,
                                        homeFeaturedImageIndex: editForm.watch("homeFeaturedImageIndex") ?? 2,
                                      });
                                    }}
                                  />
                                </span>
                              </TooltipTrigger>
                              {!editForm.watch("homeFeatured") && featuredCount >= 8 && (
                                <TooltipContent>Max 8 products allowed in New Arrivals.</TooltipContent>
                              )}
                            </Tooltip>
                          </TooltipProvider>
                        </div>
                        {editForm.watch("homeFeatured") && (
                          <div className="flex items-center justify-between pt-3 border-t border-border">
                            <Label className="text-xs font-bold uppercase tracking-wider">Display Image</Label>
                            <Select
                              value={String(editForm.watch("homeFeaturedImageIndex") ?? 2)}
                              onValueChange={(value) => {
                                editForm.setValue("homeFeaturedImageIndex", Number(value), { shouldValidate: false });
                                homeFeaturedMutation.mutate({
                                  id: editProduct.id,
                                  homeFeatured: true,
                                  homeFeaturedImageIndex: Number(value),
                                });
                              }}
                            >
                              <SelectTrigger className="h-8 w-[120px] text-xs">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="0">Image 1</SelectItem>
                                <SelectItem value="1">Image 2</SelectItem>
                                <SelectItem value="2">Image 3</SelectItem>
                                <SelectItem value="3">Image 4</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Storefront Visibility */}
                    <div className="space-y-4">
                      <h3 className="text-xs font-semibold tracking-widest uppercase text-muted-foreground">Storefront Visibility</h3>
                      <div className="p-4 rounded-2xl bg-muted/30 border border-border space-y-3">
                        <div className="flex items-center justify-between">
                          <div className="space-y-0.5">
                            <Label className="text-sm font-bold flex items-center gap-2">
                              <Sparkles className="w-4 h-4 text-blue-500" /> New Arrivals
                            </Label>
                            <p className="text-[10px] text-muted-foreground">Show in Fresh Releases section</p>
                          </div>
                          <Switch
                            checked={Boolean(editForm.watch("isNewArrival"))}
                            onCheckedChange={(checked) => {
                              editForm.setValue("isNewArrival", checked, { shouldValidate: false });
                              updateVisibilityMutation.mutate({
                                id: editProduct.id,
                                data: { isNewArrival: checked },
                              });
                            }}
                          />
                        </div>
                        <div className="flex items-center justify-between pt-3 border-t border-border">
                          <div className="space-y-0.5">
                            <Label className="text-sm font-bold flex items-center gap-2">
                              <Shirt className="w-4 h-4 text-purple-500" /> New Collection
                            </Label>
                            <p className="text-[10px] text-muted-foreground">Show in New Collection section</p>
                          </div>
                          <Switch
                            checked={Boolean(editForm.watch("isNewCollection"))}
                            onCheckedChange={(checked) => {
                              editForm.setValue("isNewCollection", checked, { shouldValidate: false });
                              updateVisibilityMutation.mutate({
                                id: editProduct.id,
                                data: { isNewCollection: checked },
                              });
                            }}
                          />
                        </div>
                      </div>
                    </div>

                    {/* Hidden inputs to keep form state intact but UI on the right */}
                    <input type="hidden" {...editForm.register("imageUrl")} />
                    <input type="hidden" {...editForm.register("galleryUrlsText")} />

                    <div className="flex flex-col gap-3 pt-8 border-t">
                      <div className="flex justify-end gap-3">
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => { setEditOpen(false); setEditProduct(null); }}
                        >
                          Cancel
                        </Button>
                        <Button data-testid="admin-product-edit-save" type="submit" form="edit-product-form" loading={editMutation.isPending} loadingText="Saving...">
                          Save Changes
                        </Button>
                      </div>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button data-testid="admin-product-delete" type="button" variant="destructive" className="w-full mt-4">
                            {isArchivedProductCategory(editProduct.category) ? "Delete Permanently" : "Move to Archive"}
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>
                              {isArchivedProductCategory(editProduct.category) ? "Delete this archived product?" : "Move this product to archive?"}
                            </AlertDialogTitle>
                            <AlertDialogDescription>
                              {isArchivedProductCategory(editProduct.category)
                                ? "This cannot be undone. All variant and image data will be removed."
                                : "The product will be removed from active products and placed in Archived. You can restore it later."}
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => {
                                deleteMutation.mutate(
                                  {
                                    id: editProduct.id,
                                    permanent: isArchivedProductCategory(editProduct.category),
                                  },
                                  {
                                  onSuccess: () => { setEditOpen(false); setEditProduct(null); },
                                  },
                                );
                              }}
                            >
                              {isArchivedProductCategory(editProduct.category) ? "Delete Permanently" : "Move to Archive"}
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </form>
                </Form>
              </div>

              {/* RIGHT COLUMN: Live Preview */}
              <div className="flex-1 bg-white/50 dark:bg-card/50 p-6 rounded-2xl border border-dashed border-[#E5E5E0] dark:border-border relative">
                <div className="absolute top-4 right-4 bg-yellow-100 text-yellow-800 text-[10px] font-bold uppercase tracking-widest px-2 py-1 rounded-sm z-10">
                  Live Preview
                </div>
                
                <div className="flex flex-col xl:flex-row gap-8">
                  {/* Media Preview Uploads */}
                  <div className="xl:max-w-[320px] space-y-4">
                    <div 
                      className="aspect-[4/5] bg-muted/30 hover:bg-muted/50 transition-colors overflow-hidden rounded-sm relative group cursor-pointer border border-[#E5E5E0] dark:border-border flex items-center justify-center p-4 text-center"
                      onClick={() => imageInputRef.current?.click()}
                    >
                      {editForm.watch("imageUrl") ? (
                        <img
                          src={editForm.watch("imageUrl")}
                          alt="Preview"
                          className="w-full h-full object-cover absolute inset-0 group-hover:opacity-75 transition-opacity"
                        />
                      ) : (
                        <div className="text-muted-foreground flex flex-col items-center">
                          <ImageIcon className="w-8 h-8 mb-2 opacity-20" />
                          <span className="text-sm font-medium">Click to set Main Image</span>
                        </div>
                      )}
                      <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                        <span className="text-white text-sm font-medium px-4 py-2 bg-black/60 rounded-full">Change Image</span>
                      </div>
                    </div>

                    <div className="flex gap-2">
                      <Button 
                        type="button" 
                        variant="outline" 
                        className="flex-1 text-xs h-8"
                        onClick={() => {
                          setMediaLibraryTarget('edit-main');
                          setMediaLibraryOpen(true);
                        }}
                      >
                      <FolderInput className="w-3.5 h-3.5 mr-2" /> Select display picture
                      </Button>
                      <Button 
                        type="button" 
                        variant="outline" 
                        className="flex-1 text-xs h-8"
                        onClick={() => imageInputRef.current?.click()}
                      >
                      <Upload className="w-3.5 h-3.5 mr-2" /> Upload display picture
                      </Button>
                    </div>

                    <input
                      ref={imageInputRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        setUploadingImage(true);
                        setShowEditUploadProgress(true);
                        setEditUploadProgress(0);
                        toast({ title: "Uploading main image..." });
                        try {
                          const compressedFile = await compressImageFile(file);
                          const url = await uploadProductImageFile(compressedFile, (value) => {
                            setEditUploadProgress(value);
                          });
                          editForm.setValue("imageUrl", url, { shouldValidate: true, shouldDirty: true });
                          toast({ title: "Image uploaded successfully" });
                        } catch {
                          toast({ title: "Upload failed", variant: "destructive" });
                        } finally {
                          setEditUploadProgress(100);
                          setTimeout(() => setShowEditUploadProgress(false), 700);
                          setUploadingImage(false);
                          e.target.value = "";
                        }
                      }}
                    />
                    {showEditUploadProgress && (
                      <div className="pt-2">
                        <UploadProgress value={editUploadProgress} label="Upload progress" />
                      </div>
                    )}

                    {/* Gallery Preview & Upload */}
                    <div className="space-y-2 pt-2">
                      <div className="flex gap-2">
                        <Button 
                          type="button" 
                          variant="outline" 
                          className="flex-1 border-dashed text-xs h-9"
                          onClick={() => {
                            setMediaLibraryTarget('edit-gallery');
                            setMediaLibraryOpen(true);
                          }}
                        >
                          <FolderInput className="w-3.5 h-3.5 mr-2" /> Select from Library
                        </Button>
                        <Button 
                          type="button" 
                          variant="outline" 
                          className="flex-1 border-dashed text-xs h-9"
                          onClick={() => {
                            setGalleryTarget("edit");
                            galleryInputRef.current?.click();
                          }}
                          disabled={uploadingImage}
                        >
                          Add More Pictures
                        </Button>
                      </div>

                      {editForm.watch("galleryUrlsText") && (
                        <div className="grid grid-cols-4 gap-2 pt-2">
                          {editForm.watch("galleryUrlsText")!.split(/\n/).map(u => u.trim()).filter(Boolean).map((url, i) => (
                            <div key={i} className="aspect-square bg-muted rounded-sm border border-[#E5E5E0] overflow-hidden relative group">
                               <img src={url} alt="" className="w-full h-full object-cover" />
                               <button 
                                 type="button"
                                 className="absolute top-1 right-1 bg-red-500 text-white p-0.5 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                                 onClick={() => {
                                    const urls = editForm.getValues("galleryUrlsText")!.split(/\n/).map(u => u.trim()).filter(Boolean);
                                    urls.splice(i, 1);
                                    editForm.setValue("galleryUrlsText", urls.join("\n"), { shouldValidate: true });
                                 }}
                               >
                                 <X className="w-3 h-3" />
                               </button>
                            </div>
                          ))}
                          {editPendingGalleryImages.map((img) => (
                            <div key={img.id} className="aspect-square bg-muted rounded-sm border border-[#E5E5E0] overflow-hidden relative group">
                              <img src={img.previewUrl} alt="" className="w-full h-full object-cover" />
                              <button
                                type="button"
                                className="absolute top-1 right-1 bg-red-500 text-white p-0.5 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                                onClick={() => {
                                  setEditPendingGalleryImages((prev) => prev.filter((p) => p.id !== img.id));
                                  URL.revokeObjectURL(img.previewUrl);
                                }}
                              >
                                <X className="w-3 h-3" />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                      {galleryUploadStatus && galleryUploadStatus.mode === "edit" && (
                        <div className="pt-3">
                          <UploadProgress
                            value={galleryUploadStatus.progress}
                            label={`Uploading ${galleryUploadStatus.completed}/${galleryUploadStatus.total}`}
                          />
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Text Details Preview */}
                  <div className="flex-1 min-w-0">
                    <h1 
                      style={{
                        fontFamily: 'Roboto, ui-sans-serif, system-ui, sans-serif',
                        fontWeight: 600,
                        fontSize: '24px',
                        lineHeight: '36px',
                        color: 'var(--brand-product-detail)'
                      }}
                      className="uppercase tracking-tight mb-2 break-words"
                    >
                      {editForm.watch("name") || "Product Name"}
                    </h1>
                    
                    <p className="text-sm text-muted-foreground mb-4">
                      {editForm.watch("shortDetails") || "Brief tagline will appear here"}
                    </p>
                    
                    <p 
                      style={{
                        fontFamily: 'Roboto, ui-sans-serif, system-ui, sans-serif',
                        fontWeight: 600,
                        fontSize: '24px',
                        lineHeight: '36px',
                        color: 'var(--brand-product-detail)'
                      }}
                      className="mb-8"
                    >
                      {formatPrice(editForm.watch("price") || 0)}
                    </p>

                    <div className="space-y-6">
                      {/* Interactive Colors */}
                      <div>
                        <div className="flex items-center justify-between mb-3">
                          <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground font-bold italic">Product Variants</p>
                          <button
                            type="button"
                            className="text-[10px] text-primary hover:underline font-medium"
                            onClick={() => setShowColorManager((v) => !v)}
                          >
                            {showColorManager ? "Close" : "Manage"}
                          </button>
                        </div>

                        {/* Inline color manager */}
                        {showColorManager && (
                          <div className="mb-3 p-3 rounded-lg border border-border bg-muted/30 space-y-3">
                            <div className="flex gap-2">
                              <input
                                type="color"
                                value={editNewColorHex}
                                onChange={(e) => setEditNewColorHex(e.target.value)}
                                className="w-8 h-8 rounded cursor-pointer border border-border"
                              />
                              <Input
                                value={editNewColorName}
                                onChange={(e) => setEditNewColorName(e.target.value)}
                                placeholder="Color name (e.g. Burgundy)"
                                className="text-xs h-8"
                                onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), handleAddEditColor())}
                              />
                              <Button
                                type="button"
                                size="sm"
                                className="h-8 text-xs shrink-0"
                                onClick={handleAddEditColor}
                                disabled={!editNewColorName.trim()}
                              >
                                <Plus className="w-3 h-3 mr-1" /> Add
                              </Button>
                            </div>
                            <div className="flex flex-wrap gap-1.5">
                              {dynamicColors.map((c) => {
                                const colorName = extractAttributeLabel(c);
                                const colorHex = colorSwatches[normalizeAttributeLabel(c)] || "#cccccc";
                                return (
                                  <div key={c} className="flex items-center gap-1.5 px-2 py-1 rounded-full border bg-background text-xs">
                                    <span className="w-3 h-3 rounded-full border border-black/10" style={{ backgroundColor: colorHex }} />
                                    <span>{colorName}</span>
                                    <button type="button" className="ml-1 text-[10px] text-muted-foreground hover:text-red-500" onClick={() => handleRemoveEditColor(c)}>×</button>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}

                        <div className="flex flex-wrap gap-2 mb-3">
                          {dynamicColors.map((c) => {
                            const selectedColors = editForm.watch("colorOptions") || [];
                            const isSelected = selectedColors.includes(c);
                            const colorName = extractAttributeLabel(c);
                            const colorHex =
                              colorSwatches[normalizeAttributeLabel(c)] || "#cccccc";
                            return (
                              <button
                                key={c}
                                type="button"
                                onClick={() => {
                                  const next = isSelected
                                    ? selectedColors.filter((x) => x !== c)
                                    : [...selectedColors, c];
                                  editForm.setValue("colorOptions", next, {
                                    shouldValidate: true,
                                    shouldDirty: true,
                                  });
                                }}
                                className={`flex items-center gap-2 px-3 py-1.5 border text-[11px] font-bold transition-all rounded-full ${
                                  isSelected
                                    ? "border-primary bg-primary text-primary-foreground shadow-md ring-2 ring-primary/20"
                                    : "border-border hover:border-foreground/50 text-muted-foreground hover:text-foreground bg-white/50 dark:bg-card"
                                }`}
                              >
                                <div
                                  className="w-3 h-3 rounded-full border border-black/10 shadow-sm"
                                  style={{ backgroundColor: colorHex }}
                                />
                                {colorName}
                              </button>
                            );
                          })}
                        </div>
                        <div className="rounded-md border border-dashed border-border/70 bg-muted/30 p-3 space-y-3">
                          <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground font-bold">
                            Selected Variants
                          </p>
                          <div className="flex flex-wrap gap-2">
                            {(editForm.watch("colorOptions") || []).map((c) => {
                              const colorName = extractAttributeLabel(c);
                              const colorHex =
                                colorSwatches[normalizeAttributeLabel(c)] || "#cccccc";
                              return (
                                <div
                                  key={c}
                                  className="flex items-center gap-2 px-2 py-1 rounded-full border bg-background text-xs"
                                >
                                  <span
                                    className="w-3 h-3 rounded-full border border-black/10"
                                    style={{ backgroundColor: colorHex }}
                                  />
                                  <span>{colorName}</span>
                                  <button
                                    type="button"
                                    className="ml-1 text-[10px] text-muted-foreground hover:text-red-500"
                                    onClick={() => {
                                      const current = editForm.getValues("colorOptions") || [];
                                      editForm.setValue(
                                        "colorOptions",
                                        current.filter((x) => x !== c),
                                        { shouldValidate: true, shouldDirty: true },
                                      );
                                    }}
                                  >
                                    ×
                                  </button>
                                </div>
                              );
                            })}
                            {(!editForm.watch("colorOptions") ||
                              editForm.watch("colorOptions")!.length === 0) && (
                              <p className="text-[11px] text-muted-foreground">
                                No colors selected for this product.
                              </p>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Interactive Sizes */}
                      <div>
                        <div className="flex items-center justify-between mb-3">
                          <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground font-bold italic">
                            Product Sizes
                          </p>
                          <button
                            type="button"
                            className="text-[10px] text-primary hover:underline font-medium"
                            onClick={() => setShowSizeManager((v) => !v)}
                          >
                            {showSizeManager ? "Close" : "Manage"}
                          </button>
                        </div>

                        {/* Inline size manager */}
                        {showSizeManager && (
                          <div className="mb-3 p-3 rounded-lg border border-border bg-muted/30 space-y-3">
                            <div className="flex gap-2">
                              <Input
                                value={editNewSize}
                                onChange={(e) => setEditNewSize(e.target.value.toUpperCase())}
                                placeholder="Size (e.g. XXL)"
                                className="text-xs h-8 w-32"
                                onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), handleAddEditSize())}
                              />
                              <Button
                                type="button"
                                size="sm"
                                className="h-8 text-xs shrink-0"
                                onClick={handleAddEditSize}
                                disabled={!editNewSize.trim()}
                              >
                                <Plus className="w-3 h-3 mr-1" /> Add
                              </Button>
                            </div>
                            <div className="flex flex-wrap gap-1.5">
                              {dynamicSizes.map((s) => (
                                <div key={s} className="flex items-center gap-1.5 px-2 py-1 rounded-full border bg-background text-xs">
                                  <span>{extractAttributeLabel(s)}</span>
                                  <button type="button" className="ml-1 text-[10px] text-muted-foreground hover:text-red-500" onClick={() => handleRemoveEditSize(s)}>×</button>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        <div className="flex flex-wrap gap-2 mb-3">
                          {dynamicSizes.map((s) => {
                            const isSelected = editSelectedSizes.includes(s);
                            return (
                              <button
                                key={s}
                                type="button"
                                onClick={() => {
                                  const next = isSelected
                                    ? editSelectedSizes.filter((x) => x !== s)
                                    : [...editSelectedSizes, s];
                                  editForm.setValue("sizeOptions", next, {
                                    shouldValidate: true,
                                    shouldDirty: true,
                                  });
                                  editForm.setValue(
                                    "stockBySize",
                                    syncStockBySizeToSizes(editForm.getValues("stockBySize"), next),
                                    {
                                      shouldValidate: false,
                                      shouldDirty: true,
                                    },
                                  );
                                }}
                                className={`h-11 w-11 flex items-center justify-center border text-[11px] font-black tracking-tighter transition-all rounded-xl ${
                                  isSelected
                                    ? "border-primary bg-primary text-primary-foreground shadow-lg scale-105"
                                    : "border-border hover:border-foreground/50 text-muted-foreground hover:text-foreground bg-white/50 dark:bg-card"
                                }`}
                              >
                                {extractAttributeLabel(s)}
                              </button>
                            );
                          })}
                        </div>
                          <div className="rounded-md border border-dashed border-border/70 bg-muted/30 p-3 space-y-3">
                          <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground font-bold">
                            Selected Sizes
                          </p>
                          <div className="flex flex-wrap gap-2">
                            {editSelectedSizes.map((s) => (
                              <div
                                key={s}
                                className="flex items-center gap-2 px-2 py-1 rounded-full border bg-background text-xs"
                              >
                                <span>{extractAttributeLabel(s)}</span>
                                <button
                                  type="button"
                                  className="ml-1 text-[10px] text-muted-foreground hover:text-red-500"
                                  onClick={() => {
                                    const current = editForm.getValues("sizeOptions") || [];
                                    const nextSizes = current.filter((x) => x !== s);
                                    editForm.setValue(
                                      "sizeOptions",
                                      nextSizes,
                                      { shouldValidate: true, shouldDirty: true },
                                    );
                                    editForm.setValue(
                                      "stockBySize",
                                      syncStockBySizeToSizes(editForm.getValues("stockBySize"), nextSizes),
                                      {
                                        shouldValidate: false,
                                        shouldDirty: true,
                                      },
                                    );
                                  }}
                                >
                                  ×
                                </button>
                              </div>
                            ))}
                            {editSelectedSizes.length === 0 && (
                              <p className="text-[11px] text-muted-foreground">
                                No sizes selected for this product.
                              </p>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Category selector */}
                      <div>
                        <div className="flex items-center justify-between mb-3">
                          <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground font-bold italic">Category</p>
                        </div>
                        <div className="flex gap-2">
                          <Select
                            value={editForm.watch("category") || ""}
                            onValueChange={(val) => editForm.setValue("category", val, { shouldValidate: true, shouldDirty: true })}
                          >
                            <SelectTrigger className="flex-1">
                              <SelectValue placeholder="Select category" />
                            </SelectTrigger>
                            <SelectContent>
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
                            onClick={() => { setPendingCategoryForm("add"); setNewCategoryOpen(true); }}
                          >
                            <Plus className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </div>

                      <div className="pt-8 space-y-4 border-t border-border">
                        <h4 className="text-[10px] uppercase tracking-[0.2em] font-bold text-muted-foreground">
                          Product Details
                        </h4>
                        <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">
                          {editForm.watch("description") || "Full description preview..."}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      <Dialog open={newCategoryOpen} onOpenChange={setNewCategoryOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingCategoryId ? "Edit category" : "Add new category"}
            </DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="new-cat-name">Name</Label>
              <Input
                id="new-cat-name"
                value={newCategoryName}
                onChange={(e) => {
                  setNewCategoryName(e.target.value);
                  setNewCategorySlug(slugify(e.target.value));
                }}
                placeholder="e.g. Hoodies"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="new-cat-slug">Slug</Label>
              <Input
                id="new-cat-slug"
                value={newCategorySlug}
                onChange={(e) => setNewCategorySlug(e.target.value)}
                placeholder="e.g. hoodies"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => { setNewCategoryOpen(false); setNewCategoryName(""); setNewCategorySlug(""); setPendingCategoryForm(null); }}
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={() => {
                if (!newCategoryName.trim() || !newCategorySlug.trim()) {
                  toast({ title: "Name and slug required", variant: "destructive" });
                  return;
                }
                if (editingCategoryId) {
                  updateCategoryMutation.mutate({ 
                    id: editingCategoryId, 
                    name: newCategoryName.trim(), 
                    slug: newCategorySlug.trim() 
                  });
                } else {
                  createCategoryMutation.mutate({ 
                    name: newCategoryName.trim(), 
                    slug: newCategorySlug.trim() 
                  });
                }
              }}
              disabled={createCategoryMutation.isPending || updateCategoryMutation.isPending}
            >
              {editingCategoryId ? "Update" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* Attributes Manager Sheet */}
      <Sheet open={attrSheetOpen} onOpenChange={setAttrSheetOpen}>
        <SheetContent side="right" className="w-full sm:max-w-[680px] p-0 overflow-hidden border-l border-[#D4E0D2] shadow-[0_24px_48px_rgba(20,36,25,0.22)]">
          <Suspense fallback={<div className="flex h-full items-center justify-center text-sm text-muted-foreground">Loading attribute tools...</div>}>
            <AttributesManager onClose={() => setAttrSheetOpen(false)} />
          </Suspense>
        </SheetContent>
      </Sheet>
    </div>
  );
}
