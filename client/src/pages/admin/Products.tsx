import { useLocation } from "wouter";
import { useEffect, useMemo, useRef, useState } from "react";
import { ViewToggle } from "@/components/admin/ViewToggle";
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
  FolderInput, Box, CheckCircle2, ChevronDown
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
  fetchAdminProducts, 
  createAdminProduct, 
  updateAdminProduct, 
  updateAdminProductHomeFeatured,
  deleteAdminProduct, 
  uploadProductImage, 
  fetchAdminAttributes, 
  ProductAttribute,
  createCategory,
  updateCategory,
  deleteCategory,
  bulkCategorizeProducts,
} from "@/lib/adminApi";
import { fetchCategories, type ProductApi, type CategoryApi } from "@/lib/api";
import { compressImage } from "@/lib/imageUtils";
import { useToast } from "@/hooks/use-toast";
import { formatPrice } from "@/lib/format";
import { Checkbox } from "@/components/ui/checkbox";
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
import { AttributesManager } from "./AttributesManager";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
  DEFAULT_PRODUCT_SIZES,
  DEFAULT_PRODUCT_VARIANTS,
  DEFAULT_PRODUCT_VARIANT_SWATCHES,
  extractAttributeLabel,
  normalizeAttributeLabel,
  uniqueNormalizedValues,
} from "@shared/productAttributes";

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
  const productCategoryRaw = (productCategory ?? "").trim();
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
  imageUrl: z.string().optional(),
  galleryUrlsText: z.string().optional(),
  colorOptions: z.array(z.string()),
  sizeOptions: z.array(z.string()),
  salePercentage: z.coerce.number().min(0).max(100).default(0),
  saleActive: z.boolean().default(false),
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
  const imageInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);
  const [galleryTarget, setGalleryTarget] = useState<"add" | "edit" | null>(null);
  const [addPendingGalleryImages, setAddPendingGalleryImages] = useState<PendingGalleryImage[]>([]);
  const [editPendingGalleryImages, setEditPendingGalleryImages] = useState<PendingGalleryImage[]>([]);
  const [galleryUploadStatus, setGalleryUploadStatus] = useState<{
    mode: "add" | "edit";
    completed: number;
    total: number;
  } | null>(null);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: categories = [] } = useQuery({
    queryKey: ["categories"],
    queryFn: fetchCategories,
  });

  const filters = useMemo(
    () => ({
      search: search || undefined,
      category: categoryFilter === "all" ? undefined : categoryFilter,
      limit: 2000,
    }),
    [search, categoryFilter],
  );

  const {
    data: products,
    isLoading,
    isError,
  } = useQuery<ProductApi[]>({
    queryKey: ["admin", "products", filters],
    queryFn: () => fetchAdminProducts(filters),
  });

  const { data: allAdminProducts = [] } = useQuery<ProductApi[]>({
    queryKey: ["admin", "products", "all-counts"],
    queryFn: () => fetchAdminProducts({ limit: 2000 }),
  });

  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = { all: allAdminProducts.length };
    allAdminProducts.forEach(p => {
      if (p.category) {
        const slug = p.category.toLowerCase();
        counts[slug] = (counts[slug] || 0) + 1;
      }
    });
    return counts;
  }, [allAdminProducts]);

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
      imageUrl: "",
      galleryUrlsText: "",
      colorOptions: [],
      sizeOptions: [],
      salePercentage: 0,
      saleActive: false,
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
      imageUrl: "",
      galleryUrlsText: "",
      colorOptions: [],
      sizeOptions: [],
      salePercentage: 0,
      saleActive: false,
    },
  });

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
        imageUrl: editProduct.imageUrl ?? "",
        galleryUrlsText: galleryUrls.join("\n"),
        colorOptions,
        sizeOptions,
        salePercentage: editProduct.salePercentage ?? 0,
        saleActive: editProduct.saleActive ?? false,
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
      const stock = values.stockStatus === "out_of_stock" ? 0 : values.stock;

      let uploadedUrls: string[] = [];
      let failedCount = 0;

      if (addPendingGalleryImages.length) {
        const files = addPendingGalleryImages.map((p) => p.file);
        const total = files.length;
        let completed = 0;

        setGalleryUploadStatus({ mode: "add", completed, total });

        for (let i = 0; i < files.length; i += 3) {
          const batch = files.slice(i, i + 3);
          const results = await Promise.allSettled(
            batch.map(async (file) => {
              const dataUrl = await compressImage(file);
              return uploadProductImage(dataUrl);
            }),
          );

          results.forEach((result) => {
            completed += 1;
            if (result.status === "fulfilled") {
              uploadedUrls.push(result.value);
            } else {
              failedCount += 1;
            }
            setGalleryUploadStatus({ mode: "add", completed, total });
          });
        }

        setGalleryUploadStatus(null);
      }

      const galleryUrls = [...existingGalleryUrls, ...uploadedUrls];

      return createAdminProduct({
        name: values.name,
        shortDetails: values.shortDetails || undefined,
        description: values.description ?? "",
        price: values.price,
        imageUrl: values.imageUrl?.trim() || null,
        galleryUrls: galleryUrls.length ? JSON.stringify(galleryUrls) : undefined,
        category: values.category || categories[0]?.slug || "",
        stock,
        colorOptions: values.colorOptions.length ? JSON.stringify(values.colorOptions) : undefined,
        sizeOptions: values.sizeOptions.length ? JSON.stringify(values.sizeOptions) : undefined,
        salePercentage: values.salePercentage,
        saleActive: values.saleActive,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "products"] });
      toast({ title: "Product added" });
      setAddOpen(false);
      resetAddProductDraft();
      if (isAddProductRoute) {
        setLocation("/admin/products");
      }
    },
    onError: () => {
      toast({ title: "Failed to add product" });
    },
  });

  const editMutation = useMutation({
    mutationFn: async (values: ProductFormValues) => {
      if (!editProduct) throw new Error("No product selected");
      const existingGalleryUrls = values.galleryUrlsText
        ? values.galleryUrlsText.split(/\n/).map((u) => u.trim()).filter(Boolean)
        : [];
      const stock = values.stockStatus === "out_of_stock" ? 0 : values.stock;

      let uploadedUrls: string[] = [];
      let failedCount = 0;

      if (editPendingGalleryImages.length) {
        const files = editPendingGalleryImages.map((p) => p.file);
        const total = files.length;
        let completed = 0;

        setGalleryUploadStatus({ mode: "edit", completed, total });

        for (let i = 0; i < files.length; i += 3) {
          const batch = files.slice(i, i + 3);
          const results = await Promise.allSettled(
            batch.map(async (file) => {
              const dataUrl = await compressImage(file);
              return uploadProductImage(dataUrl);
            }),
          );

          results.forEach((result) => {
            completed += 1;
            if (result.status === "fulfilled") {
              uploadedUrls.push(result.value);
            } else {
              failedCount += 1;
            }
            setGalleryUploadStatus({ mode: "edit", completed, total });
          });
        }

        setGalleryUploadStatus(null);
      }

      const galleryUrls = [...existingGalleryUrls, ...uploadedUrls];

      return updateAdminProduct(editProduct.id, {
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
        colorOptions: values.colorOptions.length ? JSON.stringify(values.colorOptions) : undefined,
        sizeOptions: values.sizeOptions.length ? JSON.stringify(values.sizeOptions) : undefined,
        salePercentage: values.salePercentage,
        saleActive: values.saleActive,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "products"] });
      toast({ title: "Product updated" });
      setEditOpen(false);
      setEditProduct(null);
      setEditPendingGalleryImages([]);
    },
    onError: () => {
      toast({ title: "Failed to update product" });
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
    onError: () => toast({ title: "Failed to create category", variant: "destructive" }),
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
    onError: () => toast({ title: "Failed to update category", variant: "destructive" }),
  });

  const deleteCategoryMutation = useMutation({
    mutationFn: (id: string) => deleteCategory(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["categories"] });
      toast({ title: "Category deleted" });
      if (categoryFilter !== "all") setCategoryFilter("all");
    },
    onError: () => toast({ title: "Failed to delete category", variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteAdminProduct(id),
    onMutate: async (id: string) => {
      await queryClient.cancelQueries({ queryKey: ["admin", "products"] });
      const previous = queryClient.getQueryData<ProductApi[]>([
        "admin",
        "products",
        filters,
      ]);
      if (previous) {
        queryClient.setQueryData<ProductApi[]>(
          ["admin", "products", filters],
          previous.filter((p) => p.id !== id),
        );
      }
      return { previous };
    },
    onError: (_err, _id, context) => {
      if (context?.previous) {
        queryClient.setQueryData(
          ["admin", "products", filters],
          context.previous,
        );
      }
      toast({ title: "Failed to delete product" });
    },
    onSuccess: () => {
      toast({ title: "Product deleted" });
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "products"] });
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
    },
    onError: () => {
      toast({ title: "Failed to update home featured product", variant: "destructive" });
    },
  });

  const filteredProducts = useMemo(() => {
    if (!products) return [];
    return products.filter((p) => {
      const matchesCategory =
        categoryFilter === "all" || (p.category ?? "").toLowerCase() ===
          categoryFilter.toLowerCase();
      return matchesCategory;
    });
  }, [products, categoryFilter]);
  const featuredCount = useMemo(
    () => allAdminProducts.filter((p) => p.homeFeatured).length,
    [allAdminProducts],
  );
  const categoryTabs = useMemo(
    () => [{ id: "all", slug: "all", name: "All" }, ...categories],
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

  const [viewMode, setViewMode] = useState<"grid" | "list">(() => {
    if (typeof window !== 'undefined') {
      return window.innerWidth < 640 ? "list" : "grid";
    }
    return "grid";
  });

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


      {/* Full-page Add Product overlay */}
      {addOpen && (
        <div className="fixed inset-0 z-40 bg-background overflow-auto">
          <div className="max-w-[1400px] mx-auto p-4 sm:p-6 pb-20">
            <Button
              type="button"
              variant="ghost"
              className="mb-6 -ml-2 rounded-2xl hover:bg-[#EEF4EE]"
              onClick={closeAddOverlay}
            >
              <ArrowLeft className="w-4 h-4 mr-2" /> Back to products
            </Button>
            
            <div className="flex flex-col lg:flex-row gap-8 lg:gap-16">
              {/* LEFT COLUMN: Data Form */}
              <div className="flex-1 lg:max-w-[500px]">
                <h2 className="text-2xl font-serif font-medium mb-8">Add New Product</h2>
                <Form {...addForm}>
                  <form
                    id="add-product-form"
                    onSubmit={addForm.handleSubmit((values) => addMutation.mutate(values))}
                    className="space-y-8"
                  >
                    <div className="space-y-4">
                      <h3 className="text-xs font-semibold tracking-widest uppercase text-muted-foreground">Product Details</h3>
                      <FormField
                        control={addForm.control}
                        name="name"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Product Name *</FormLabel>
                            <FormControl>
                              <Input data-testid="admin-product-name" placeholder="Two-Way Zip Hoodie" {...field} />
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
                            <FormLabel>Short details</FormLabel>
                            <FormControl>
                              <Input data-testid="admin-product-short-details" placeholder="Brief tagline or key features" {...field} />
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
                            <FormLabel>Category *</FormLabel>
                            <div className="flex gap-2 flex-wrap">
                              <Select onValueChange={field.onChange} value={field.value}>
                                <FormControl>
                                  <SelectTrigger data-testid="admin-product-category" className="min-w-[180px]">
                                    <SelectValue placeholder="Select category" />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  {categories.map((c) => (
                                    <SelectItem key={c.id} value={c.slug}>{c.name}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              <Button
                                type="button"
                                variant="outline"
                                onClick={() => { setPendingCategoryForm("add"); setNewCategoryOpen(true); }}
                              >
                                Add new
                              </Button>
                            </div>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                    <div className="space-y-4">
                      <h3 className="text-xs font-semibold tracking-widest uppercase text-muted-foreground">Pricing &amp; Stock</h3>
                      <FormField
                        control={addForm.control}
                        name="price"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Price (NPR) *</FormLabel>
                            <FormControl>
                              <Input data-testid="admin-product-price" type="number" min={0} step="1" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      
                      {/* Sale Section */}
                      <div className="p-4 rounded-2xl bg-primary/5 border border-primary/10 space-y-4">
                        <div className="flex items-center justify-between">
                          <div className="space-y-0.5">
                            <Label className="text-sm font-bold flex items-center gap-2">
                              <Percent className="w-4 h-4 text-primary" /> Active Sale
                            </Label>
                            <p className="text-[10px] text-muted-foreground">Apply a discount to this product</p>
                          </div>
                          <FormField
                            control={addForm.control}
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
                          {addForm.watch("saleActive") && (
                            <motion.div
                              initial={{ opacity: 0, height: 0 }}
                              animate={{ opacity: 1, height: "auto" }}
                              exit={{ opacity: 0, height: 0 }}
                              className="pt-2 border-t border-primary/10"
                            >
                              <FormField
                                control={addForm.control}
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
                        control={addForm.control}
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
                                  <RadioGroupItem value="in_stock" id="add-in-stock" />
                                  <Label htmlFor="add-in-stock">In Stock</Label>
                                </div>
                                <div className="flex items-center space-x-2">
                                  <RadioGroupItem value="out_of_stock" id="add-out-of-stock" />
                                  <Label htmlFor="add-out-of-stock">Out of Stock</Label>
                                </div>
                              </RadioGroup>
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      {addForm.watch("stockStatus") === "in_stock" && (
                        <FormField
                          control={addForm.control}
                          name="stock"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Quantity</FormLabel>
                              <FormControl>
                                <Input data-testid="admin-product-stock" type="number" min={0} step="1" {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      )}
                    </div>
                    
                    {/* Hidden inputs to keep form state intact but UI on the right */}
                    <input type="hidden" {...addForm.register("imageUrl")} />
                    <input type="hidden" {...addForm.register("galleryUrlsText")} />
                    
                    <div className="flex justify-end gap-3 pt-8 border-t">
                      <Button
                        type="button"
                        variant="outline"
                        className="rounded-2xl border-[#CDD7C8] bg-gradient-to-br from-white to-[#F3F7F1] hover:-translate-y-0.5 hover:shadow-[0_10px_20px_rgba(34,63,41,0.15)] transition-all duration-300"
                        onClick={closeAddOverlay}
                      >
                        Cancel
                      </Button>
                      <Button
                        data-testid="admin-product-save"
                        type="submit"
                        form="add-product-form"
                        loading={addMutation.isPending}
                        loadingText="Saving..."
                        className="rounded-2xl bg-gradient-to-r from-[#2C5234] to-[#3A6A45] text-white hover:brightness-110 shadow-[0_12px_24px_rgba(34,63,41,0.2)] transition-all duration-300"
                      >
                        Save Product
                      </Button>
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
                      {addForm.watch("imageUrl") ? (
                        <img
                          src={addForm.watch("imageUrl")}
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
                          setMediaLibraryTarget('add-main');
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
                        toast({ title: "Uploading main image..." });
                        try {
                          const dataUrl = await compressImage(file);
                          const url = await uploadProductImage(dataUrl);
                          addForm.setValue("imageUrl", url, { shouldValidate: true, shouldDirty: true });
                          toast({ title: "Image uploaded successfully" });
                        } catch {
                          toast({ title: "Upload failed", variant: "destructive" });
                        } finally {
                          setUploadingImage(false);
                          e.target.value = "";
                        }
                      }}
                    />

                    {/* Gallery Preview & Upload */}
                    <div className="space-y-2 pt-2">
                      <div className="flex gap-2">
                        <Button 
                          type="button" 
                          variant="outline" 
                          className="flex-1 border-dashed text-xs h-9"
                          onClick={() => {
                            setMediaLibraryTarget('add-gallery');
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
                            setGalleryTarget("add");
                            galleryInputRef.current?.click();
                          }}
                          disabled={uploadingImage}
                        >
                          Add More Pictures
                        </Button>
                      </div>

                      {addForm.watch("galleryUrlsText") && (
                        <div className="grid grid-cols-4 gap-2 pt-2">
                          {addForm.watch("galleryUrlsText")!.split(/\n/).map(u => u.trim()).filter(Boolean).map((url, i) => (
                            <div key={i} className="aspect-square bg-muted rounded-sm border border-[#E5E5E0] overflow-hidden relative group">
                               <img src={url} alt="" className="w-full h-full object-cover" />
                               <button 
                                 type="button"
                                 className="absolute top-1 right-1 bg-red-500 text-white p-0.5 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                                 onClick={() => {
                                    const urls = addForm.getValues("galleryUrlsText")!.split(/\n/).map(u => u.trim()).filter(Boolean);
                                    urls.splice(i, 1);
                                    addForm.setValue("galleryUrlsText", urls.join("\n"), { shouldValidate: true });
                                 }}
                               >
                                 <X className="w-3 h-3" />
                               </button>
                            </div>
                          ))}
                          {addPendingGalleryImages.map((img) => (
                            <div key={img.id} className="aspect-square bg-muted rounded-sm border border-[#E5E5E0] overflow-hidden relative group">
                              <img src={img.previewUrl} alt="" className="w-full h-full object-cover" />
                              <button
                                type="button"
                                className="absolute top-1 right-1 bg-red-500 text-white p-0.5 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                                onClick={() => {
                                  setAddPendingGalleryImages((prev) => prev.filter((p) => p.id !== img.id));
                                  URL.revokeObjectURL(img.previewUrl);
                                }}
                              >
                                <X className="w-3 h-3" />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                      {galleryUploadStatus && galleryUploadStatus.mode === "add" && (
                        <p className="text-[11px] text-muted-foreground pt-1">
                          Uploading {galleryUploadStatus.completed}/{galleryUploadStatus.total}...
                        </p>
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
                      {addForm.watch("name") || "Product Name"}
                    </h1>
                    
                    <p className="text-sm text-muted-foreground mb-4">
                      {addForm.watch("shortDetails") || "Brief tagline will appear here"}
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
                      {formatPrice(addForm.watch("price") || 0)}
                    </p>

                    <div className="space-y-6">
                      {/* Interactive Colors */}
                      <div>
                        <div className="flex items-center justify-between mb-3">
                          <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground font-bold italic">Product Variants</p>
                          <button
                            type="button"
                            className="text-[10px] text-primary hover:underline font-medium"
                            onClick={() => {
                              const current = addForm.getValues("colorOptions") || [];
                              if (!current.length && dynamicColors.length) {
                                addForm.setValue("colorOptions", [dynamicColors[0]], {
                                  shouldValidate: true,
                                  shouldDirty: true,
                                });
                              }
                            }}
                          >
                            Manage
                          </button>
                        </div>
                        <div className="flex flex-wrap gap-2 mb-3">
                          {dynamicColors.map((c) => {
                            const selectedColors = addForm.watch("colorOptions") || [];
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
                                  addForm.setValue("colorOptions", next, {
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
                            Product Variants
                          </p>
                          <div className="flex flex-wrap gap-2">
                            {(addForm.watch("colorOptions") || []).map((c) => {
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
                                      const current = addForm.getValues("colorOptions") || [];
                                      addForm.setValue(
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
                            {(!addForm.watch("colorOptions") ||
                              addForm.watch("colorOptions")!.length === 0) && (
                              <p className="text-[11px] text-muted-foreground">
                                No colors added for this product yet.
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
                            onClick={() => {
                              const current = addForm.getValues("sizeOptions") || [];
                              if (!current.length && dynamicSizes.length) {
                                addForm.setValue("sizeOptions", [dynamicSizes[0]], {
                                  shouldValidate: true,
                                  shouldDirty: true,
                                });
                              }
                            }}
                          >
                            Manage
                          </button>
                        </div>
                        <div className="flex flex-wrap gap-2 mb-3">
                          {dynamicSizes.map((s) => {
                            const selectedSizes = addForm.watch("sizeOptions") || [];
                            const isSelected = selectedSizes.includes(s);
                            return (
                              <button
                                key={s}
                                type="button"
                                onClick={() => {
                                  const next = isSelected
                                    ? selectedSizes.filter((x) => x !== s)
                                    : [...selectedSizes, s];
                                  addForm.setValue("sizeOptions", next, {
                                    shouldValidate: true,
                                    shouldDirty: true,
                                  });
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
                            Product Sizes
                          </p>
                          <div className="flex flex-wrap gap-2">
                            {(addForm.watch("sizeOptions") || []).map((s) => (
                              <div
                                key={s}
                                className="flex items-center gap-2 px-2 py-1 rounded-full border bg-background text-xs"
                              >
                                <span>{extractAttributeLabel(s)}</span>
                                <button
                                  type="button"
                                  className="ml-1 text-[10px] text-muted-foreground hover:text-red-500"
                                  onClick={() => {
                                    const current = addForm.getValues("sizeOptions") || [];
                                    addForm.setValue(
                                      "sizeOptions",
                                      current.filter((x) => x !== s),
                                      { shouldValidate: true, shouldDirty: true },
                                    );
                                  }}
                                >
                                  ×
                                </button>
                              </div>
                            ))}
                            {(!addForm.watch("sizeOptions") ||
                              addForm.watch("sizeOptions")!.length === 0) && (
                              <p className="text-[11px] text-muted-foreground">
                                No sizes added for this product yet.
                              </p>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="pt-8 space-y-4 border-t border-border">
                        <h4 className="text-[10px] uppercase tracking-[0.2em] font-bold text-muted-foreground">
                          Product Details
                        </h4>
                        <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">
                          {addForm.watch("description") || "Full description preview..."}
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

      {/* Fixed Filter & Category Section with Search Bar */}
      <div className="fixed left-0 right-0 z-30 backdrop-blur-[6px]" style={{ top: '64px', width: '100%' }}>
        <div className="space-y-3 px-1 pb-2 max-w-[calc(100%-8px)] mx-auto">
          <div className="flex flex-col gap-4 bg-gradient-to-r from-[#F8FCF8] to-white dark:from-[#151E17] dark:to-[#111915] p-4 rounded-2xl border border-[#DCE8DB] dark:border-[#2E3B32] shadow-[0_8px_20px_rgba(34,63,41,0.08)] dark:shadow-[0_10px_22px_rgba(0,0,0,0.35)] overflow-hidden">
            {/* Top row: Select All + Search Bar + Items Count */}
            <div className="flex flex-col xl:flex-row items-center gap-4 w-full">
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
                              if (confirm(`Are you sure you want to delete ${selectedProductIds.size} products?`)) {
                                selectedProductIds.forEach(id => deleteMutation.mutate(id));
                                setSelectedProductIds(new Set());
                              }
                            }}
                          >
                            <Trash2 className="w-3.5 h-3.5 mr-2" /> Delete ({selectedProductIds.size})
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

              {/* Search Bar - Centered and Full Width on XL */}
              <div className="w-full max-w-sm relative group flex-1 xl:flex-none">
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
                      {filteredProducts.slice(0, 5).map(p => (
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
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Items Count and View Toggle */}
              <div className="flex items-center gap-4 shrink-0">
                <p className="text-[11px] font-black text-muted-foreground uppercase tracking-widest whitespace-nowrap dark:text-[#CFE0D1]">
                  {filteredProducts.length} Items
                </p>
                <ViewToggle view={viewMode} onViewChange={setViewMode} />
              </div>
            </div>
          </div>

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
        </div>
      </div>

      {/* Spacer for fixed header - adjust based on visible content */}
      <div className="h-32 xl:h-24" />


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
          : filteredProducts.map((product) => (
              <div
                key={product.id}
                onClick={() => {
                  const next = new Set(selectedProductIds);
                  if (next.has(product.id)) next.delete(product.id);
                  else next.add(product.id);
                  setSelectedProductIds(next);
                }}
                className={`bg-white dark:bg-card rounded-xl border overflow-hidden hover:shadow-xl hover:-translate-y-1 transition-all duration-300 group relative cursor-pointer ${
                  selectedProductIds.has(product.id) ? "border-primary ring-2 ring-primary dark:bg-primary/10" : "border-[#E5E5E0] dark:border-border"
                }`}
              >
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
                      {product.category || "General"}
                    </Badge>
                  </div>
                  
                  <h3 className="font-serif font-medium text-lg mb-1 truncate group-hover:text-primary transition-colors">
                    {product.name}
                  </h3>
                  
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

                  <div
                    className="mt-4 space-y-2"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="flex items-center justify-between rounded-md border border-border/60 px-2 py-1.5">
                      <span className="text-[10px] font-bold uppercase tracking-wider">
                        ⭐ Feature on Home
                      </span>
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span>
                              <Switch
                                checked={Boolean(product.homeFeatured)}
                                disabled={
                                  homeFeaturedMutation.isPending ||
                                  (!product.homeFeatured && featuredCount >= 8)
                                }
                                onCheckedChange={(checked) =>
                                  homeFeaturedMutation.mutate({
                                    id: product.id,
                                    homeFeatured: checked,
                                    homeFeaturedImageIndex: product.homeFeaturedImageIndex ?? 2,
                                  })
                                }
                              />
                            </span>
                          </TooltipTrigger>
                          {!product.homeFeatured && featuredCount >= 8 && (
                            <TooltipContent>
                              Max 8 products allowed in New Arrivals.
                            </TooltipContent>
                          )}
                        </Tooltip>
                      </TooltipProvider>
                    </div>
                    {product.homeFeatured && (
                      <div className="flex items-center justify-between rounded-md border border-border/60 px-2 py-1.5">
                        <span className="text-[10px] font-bold uppercase tracking-wider">
                          Display Image
                        </span>
                        <Select
                          value={String(product.homeFeaturedImageIndex ?? 2)}
                          onValueChange={(value) =>
                            homeFeaturedMutation.mutate({
                              id: product.id,
                              homeFeatured: true,
                              homeFeaturedImageIndex: Number(value),
                            })
                          }
                        >
                          <SelectTrigger className="h-7 w-[120px] text-xs">
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
                  
                  {/* Always Visible Edit/Delete Buttons (as requested) */}
                  <div className="mt-6 pt-4 border-t border-border flex gap-2">
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
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="flex-none w-9 h-9 border-destructive/30 text-destructive hover:bg-destructive/10"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (confirm("Are you sure?")) deleteMutation.mutate(product.id);
                      }}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>
              </div>
            ))}
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
                    <th className="p-4 font-medium text-xs uppercase tracking-wider text-muted-foreground">Home</th>
                    <th className="p-4 font-medium text-xs uppercase tracking-wider text-muted-foreground">Display Image</th>
                    <th className="p-4 font-medium text-xs uppercase tracking-wider text-muted-foreground text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredProducts.map((product) => (
                    <tr 
                      key={product.id} 
                      onClick={() => {
                        const next = new Set(selectedProductIds);
                        if (next.has(product.id)) next.delete(product.id);
                        else next.add(product.id);
                        setSelectedProductIds(next);
                      }}
                      className={cn(
                        "border-b border-border hover:bg-muted/10 transition-colors group cursor-pointer",
                        selectedProductIds.has(product.id) && "bg-primary/5"
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
                          {product.category || "General"}
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
                      <td className="p-4" onClick={(e) => e.stopPropagation()}>
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span>
                                <Switch
                                  checked={Boolean(product.homeFeatured)}
                                  disabled={
                                    homeFeaturedMutation.isPending ||
                                    (!product.homeFeatured && featuredCount >= 8)
                                  }
                                  onCheckedChange={(checked) =>
                                    homeFeaturedMutation.mutate({
                                      id: product.id,
                                      homeFeatured: checked,
                                      homeFeaturedImageIndex: product.homeFeaturedImageIndex ?? 2,
                                    })
                                  }
                                />
                              </span>
                            </TooltipTrigger>
                            {!product.homeFeatured && featuredCount >= 8 && (
                              <TooltipContent>
                                Max 8 products allowed in New Arrivals.
                              </TooltipContent>
                            )}
                          </Tooltip>
                        </TooltipProvider>
                      </td>
                      <td className="p-4" onClick={(e) => e.stopPropagation()}>
                        <Select
                          value={String(product.homeFeaturedImageIndex ?? 2)}
                          disabled={!product.homeFeatured}
                          onValueChange={(value) =>
                            homeFeaturedMutation.mutate({
                              id: product.id,
                              homeFeatured: true,
                              homeFeaturedImageIndex: Number(value),
                            })
                          }
                        >
                          <SelectTrigger className="h-8 w-[110px] text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="0">Image 1</SelectItem>
                            <SelectItem value="1">Image 2</SelectItem>
                            <SelectItem value="2">Image 3</SelectItem>
                            <SelectItem value="3">Image 4</SelectItem>
                          </SelectContent>
                        </Select>
                      </td>
                      <td className="p-4 text-right">
                        <div className="flex justify-end gap-1">
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
                          <Button 
                            variant="outline" 
                            size="icon" 
                            className="h-8 w-8 border-destructive/30 text-destructive hover:bg-destructive/10 dark:text-red-500 dark:border-red-500/30 dark:hover:bg-red-500/10"
                            onClick={(e) => {
                              e.stopPropagation();
                              if (confirm("Are you sure?")) deleteMutation.mutate(product.id);
                            }}
                            loading={deleteMutation.isPending}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
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
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="text-[10px] sm:text-xs font-black uppercase tracking-[0.2em]"
                  onClick={clearSelection}
                >
                  Clear Selection
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
                <h2 className="text-2xl font-serif font-medium mb-8">Edit — {editProduct.name}</h2>
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
                              <Input data-testid="admin-product-edit-price" type="number" min={0} step="1" {...field} />
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
                        <FormField
                          control={editForm.control}
                          name="stock"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Quantity</FormLabel>
                              <FormControl>
                                <Input data-testid="admin-product-edit-stock" type="number" min={0} step="1" {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      )}
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
                            Delete Product
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Delete this product?</AlertDialogTitle>
                            <AlertDialogDescription>
                              This cannot be undone. All variant and image data will be removed.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => {
                                deleteMutation.mutate(editProduct.id, {
                                  onSuccess: () => { setEditOpen(false); setEditProduct(null); },
                                });
                              }}
                            >
                              Delete
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
                        toast({ title: "Uploading main image..." });
                        try {
                          const dataUrl = await compressImage(file);
                          const url = await uploadProductImage(dataUrl);
                          editForm.setValue("imageUrl", url, { shouldValidate: true, shouldDirty: true });
                          toast({ title: "Image uploaded successfully" });
                        } catch {
                          toast({ title: "Upload failed", variant: "destructive" });
                        } finally {
                          setUploadingImage(false);
                          e.target.value = "";
                        }
                      }}
                    />

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
                        <p className="text-[11px] text-muted-foreground pt-1">
                          Uploading {galleryUploadStatus.completed}/{galleryUploadStatus.total}...
                        </p>
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
                            onClick={() => {
                              const current = editForm.getValues("colorOptions") || [];
                              if (!current.length && dynamicColors.length) {
                                editForm.setValue("colorOptions", [dynamicColors[0]], {
                                  shouldValidate: true,
                                  shouldDirty: true,
                                });
                              }
                            }}
                          >
                            Manage
                          </button>
                        </div>
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
                            Product Variants
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
                                No colors added for this product yet.
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
                            onClick={() => {
                              const current = editForm.getValues("sizeOptions") || [];
                              if (!current.length && dynamicSizes.length) {
                                editForm.setValue("sizeOptions", [dynamicSizes[0]], {
                                  shouldValidate: true,
                                  shouldDirty: true,
                                });
                              }
                            }}
                          >
                            Manage
                          </button>
                        </div>
                        <div className="flex flex-wrap gap-2 mb-3">
                          {dynamicSizes.map((s) => {
                            const selectedSizes = editForm.watch("sizeOptions") || [];
                            const isSelected = selectedSizes.includes(s);
                            return (
                              <button
                                key={s}
                                type="button"
                                onClick={() => {
                                  const next = isSelected
                                    ? selectedSizes.filter((x) => x !== s)
                                    : [...selectedSizes, s];
                                  editForm.setValue("sizeOptions", next, {
                                    shouldValidate: true,
                                    shouldDirty: true,
                                  });
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
                            Product Sizes
                          </p>
                          <div className="flex flex-wrap gap-2">
                            {(editForm.watch("sizeOptions") || []).map((s) => (
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
                                    editForm.setValue(
                                      "sizeOptions",
                                      current.filter((x) => x !== s),
                                      { shouldValidate: true, shouldDirty: true },
                                    );
                                  }}
                                >
                                  ×
                                </button>
                              </div>
                            ))}
                            {(!editForm.watch("sizeOptions") ||
                              editForm.watch("sizeOptions")!.length === 0) && (
                              <p className="text-[11px] text-muted-foreground">
                                No sizes added for this product yet.
                              </p>
                            )}
                          </div>
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
          <AttributesManager onClose={() => setAttrSheetOpen(false)} />
        </SheetContent>
      </Sheet>
    </div>
  );
}
