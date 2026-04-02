import { useState, useMemo, useCallback, useEffect } from "react";
import { useForm } from "react-hook-form";
import { useQuery } from "@tanstack/react-query";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft, ArrowRight, Check, Upload, X, Plus, Palette, Ruler,
  FolderInput, ImageIcon, FileText, Tag, Percent, Cloud, HardDrive,
} from "lucide-react";
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
import { compressImage } from "@/lib/imageUtils";
import { uploadProductImage, uploadAdminImage, fetchAdminAttributes, type ProductAttribute } from "@/lib/adminApi";
import { QuantityInput } from "@/components/ui/quantity-input";
import { PriceInput } from "@/components/ui/price-input";
import type { CategoryApi } from "@/lib/api";

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

  // Image upload state
  const [uploadMode, setUploadMode] = useState<"cloud" | "local">("cloud");
  const [imageCategory, setImageCategory] = useState("product");
  const [uploadingCloud, setUploadingCloud] = useState(false);
  const [galleryUploadMode, setGalleryUploadMode] = useState<"cloud" | "local">("cloud");
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
    addForm.setValue("sizeOptions", next, { shouldValidate: false, shouldDirty: false });
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
      addForm.setValue("sizeOptions", [...currentSizes, trimmed], { shouldValidate: false, shouldDirty: false });
    }
    setNewSizeInput("");
  };

  const handleCreateCategory = async () => {
    if (!newCategoryName.trim()) return;
    setCreatingCategory(true);
    try {
      const slug = newCategoryName.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
      const res = await fetch("/api/admin/categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ name: newCategoryName.trim(), slug }),
      });
      if (!res.ok) throw new Error("Failed to create category");
      const data = await res.json();
      const newCat = data.data || data;
      if (onCategoryCreated) onCategoryCreated(newCat);
      addForm.setValue("category", newCat.slug, { shouldValidate: true });
      setNewCategoryName("");
      setShowNewCategoryInput(false);
      toast({ title: "Category created", description: `"${newCat.name}" added and selected` });
    } catch {
      toast({ title: "Failed to create category", variant: "destructive" });
    } finally {
      setCreatingCategory(false);
    }
  };

  const canProceedStep1 = addForm.watch("name")?.length >= 2 && addForm.watch("price") >= 1;
  const canProceedStep2 = true;

  const steps = [
    { num: 1, label: "Details", icon: FileText },
    { num: 2, label: "Colors", icon: Palette },
    { num: 3, label: "Photos", icon: ImageIcon },
  ];

  // Cloud upload handler
  const handleCloudUpload = async (file: File, target: "main" | "gallery") => {
    setUploadingCloud(true);
    try {
      const result = await uploadAdminImage({
        file,
        category: target === "main" ? imageCategory : galleryImageCategory,
        provider: "cloudinary",
      });
      if (target === "main") {
        addForm.setValue("imageUrl", result.url, { shouldValidate: true, shouldDirty: true });
      } else {
        const currentText = addForm.getValues("galleryUrlsText") || "";
        const current = currentText.split(/\n/).map((u: string) => u.trim()).filter(Boolean);
        addForm.setValue("galleryUrlsText", [...current, result.url].join("\n"), { shouldValidate: true, shouldDirty: true });
      }
      toast({ title: "Image uploaded to cloud" });
    } catch {
      toast({ title: "Cloud upload failed", variant: "destructive" });
    } finally {
      setUploadingCloud(false);
    }
  };

  // Local upload handler
  const handleLocalUpload = async (file: File, target: "main" | "gallery") => {
    setUploadingImage(true);
    try {
      const dataUrl = await compressImage(file);
      const url = await uploadProductImage(dataUrl);
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
    }
  };

  return (
    <div className="fixed inset-0 z-40 bg-background overflow-auto">
      <div className="min-h-screen max-w-7xl mx-auto p-4 sm:p-6 lg:p-8 pb-24">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <Button
            type="button"
            variant="ghost"
            className="-ml-2 rounded-2xl hover:bg-muted"
            onClick={onClose}
          >
            <ArrowLeft className="w-4 h-4 mr-2" /> Back to products
          </Button>
          <h2 className="text-2xl font-serif font-medium">Add New Product</h2>
          <div className="w-28" />
        </div>

        {/* Step indicator */}
        <div className="flex items-center justify-center gap-0 mb-10">
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
          >
            <AnimatePresence mode="wait">
              {/* STEP 1: Product Details + Stock */}
              {step === 1 && (
                <motion.div
                  key="step1"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="space-y-6"
                >
                  <div className="space-y-4">
                    <h3 className="text-xs font-semibold tracking-widest uppercase text-muted-foreground">Basic Information</h3>
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
                            <Select onValueChange={field.onChange} value={field.value}>
                              <FormControl>
                                <SelectTrigger className="flex-1">
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

                  <div className="space-y-4">
                    <h3 className="text-xs font-semibold tracking-widest uppercase text-muted-foreground">Pricing</h3>
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

                    <div className="p-4 rounded-2xl bg-muted/50 border border-border space-y-4">
                      <div className="flex items-center justify-between">
                        <div className="space-y-0.5">
                          <Label className="text-sm font-bold flex items-center gap-2">
                            <Percent className="w-4 h-4" /> Sale Discount
                          </Label>
                          <p className="text-[10px] text-muted-foreground">Apply a discount</p>
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
                        {addForm.watch("saleActive") && (
                          <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: "auto" }}
                            exit={{ opacity: 0, height: 0 }}
                            className="pt-2 border-t border-border"
                          >
                            <FormField
                              control={addForm.control}
                              name="salePercentage"
                              render={({ field }) => (
                                <FormItem>
                                  <div className="flex items-center justify-between mb-2">
                                    <FormLabel className="text-[11px] font-bold uppercase">Discount</FormLabel>
                                    <span className="text-lg font-bold text-primary">{field.value}% OFF</span>
                                  </div>
                                  <FormControl>
                                    <Input type="range" min="0" max="90" step="5" {...field} />
                                  </FormControl>
                                </FormItem>
                              )}
                            />
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  </div>

                  {/* Stock Section with per-size inputs */}
                  <div className="space-y-4">
                    <h3 className="text-xs font-semibold tracking-widest uppercase text-muted-foreground">Stock</h3>
                    <FormField
                      control={addForm.control}
                      name="stockStatus"
                      render={({ field }) => (
                        <FormItem>
                          <FormControl>
                            <RadioGroup value={field.value} onValueChange={field.onChange} className="flex gap-4">
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

                    {addForm.watch("stockStatus") === "in_stock" && (
                      <div className="space-y-3">
                        {/* Size selection for stock */}
                        <div>
                          <Label className="text-xs font-bold uppercase tracking-wider">Select Sizes</Label>
                          <div className="flex flex-wrap gap-2 mt-2">
                            {availableSizes.map((size) => {
                              const isSelected = selectedSizes.includes(size);
                              return (
                                <button
                                  key={size}
                                  type="button"
                                  onClick={() => toggleSize(size)}
                                  className={cn(
                                    "px-3 py-1.5 rounded-full text-xs font-bold uppercase border transition-all",
                                    isSelected
                                      ? "bg-primary text-primary-foreground border-primary"
                                      : "bg-background text-muted-foreground border-border hover:border-foreground"
                                  )}
                                >
                                  {size}
                                </button>
                              );
                            })}
                          </div>
                          <div className="flex items-center gap-2 mt-2">
                            <Input
                              value={newSizeInput}
                              onChange={(e) => setNewSizeInput(e.target.value)}
                              placeholder="New size (e.g. XXL)"
                              className="w-32 text-xs h-8"
                              onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addCustomSize())}
                            />
                            <Button type="button" variant="outline" size="sm" className="h-8 text-xs" onClick={addCustomSize} disabled={!newSizeInput.trim()}>
                              <Plus className="w-3 h-3 mr-1" /> Add Size
                            </Button>
                          </div>
                        </div>

                        {/* Stock per size inputs */}
                        {selectedSizes.length > 0 && (
                          <div className="p-5 rounded-2xl bg-gradient-to-br from-muted/40 to-muted/20 border border-border/60">
                            <Label className="text-xs font-bold uppercase tracking-wider mb-4 block">Stock by Size</Label>
                            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                              {selectedSizes.map((size: string) => {
                                const stockBySize = addForm.watch("stockBySize") || {};
                                const currentStock = stockBySize[size] ?? undefined;
                                return (
                                  <div key={size} className="space-y-2">
                                    <div className="flex items-center justify-between">
                                      <Label className="text-sm font-bold">{size}</Label>
                                      {currentStock !== undefined && currentStock > 0 && (
                                        <span className="text-[10px] font-bold text-primary">{currentStock}</span>
                                      )}
                                    </div>
                                    <QuantityInput
                                      min={0}
                                      step={1}
                                      value={currentStock}
                                      onChange={(newValue) => {
                                        const current = addForm.getValues("stockBySize") || {};
                                        addForm.setValue("stockBySize", { ...current, [size]: newValue }, { shouldValidate: false, shouldDirty: false });
                                      }}
                                      placeholder="—"
                                    />
                                  </div>
                                );
                              })}
                            </div>
                            <div className="mt-4 pt-3 border-t border-border/60 flex justify-between items-center">
                              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Total Stock</span>
                              <span className="text-xl font-black tabular-nums">
                                {selectedSizes.reduce((total: number, size: string) => {
                                  const stockBySize = addForm.watch("stockBySize") || {};
                                  return total + (stockBySize[size] ?? 0);
                                }, 0)}
                              </span>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  <input type="hidden" {...addForm.register("imageUrl")} />
                  <input type="hidden" {...addForm.register("galleryUrlsText")} />

                  <div className="flex justify-end gap-3 pt-6 border-t">
                    <Button type="button" variant="outline" className="rounded-2xl" onClick={onClose}>
                      Cancel
                    </Button>
                    <Button
                      type="button"
                      className="rounded-2xl"
                      disabled={!canProceedStep1}
                      onClick={() => setStep(2)}
                    >
                      Next: Variants <ArrowRight className="w-4 h-4 ml-2" />
                    </Button>
                  </div>
                </motion.div>
              )}

              {/* STEP 2: Colors */}
              {step === 2 && (
                <motion.div
                  key="step2"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="space-y-6"
                >
                  {/* Colors - including attribute colors */}
                  <div className="space-y-4">
                    <div className="flex items-center gap-2">
                      <Palette className="w-4 h-4" />
                      <h3 className="text-sm font-bold">Colors</h3>
                      <span className="text-xs text-muted-foreground">({selectedColors.length} selected)</span>
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

                  <div className="flex justify-between gap-3 pt-6 border-t">
                    <Button type="button" variant="outline" className="rounded-2xl" onClick={() => setStep(1)}>
                      <ArrowLeft className="w-4 h-4 mr-2" /> Back
                    </Button>
                    <Button
                      type="button"
                      className="rounded-2xl"
                      disabled={!canProceedStep2}
                      onClick={() => setStep(3)}
                    >
                      Next: Photos <ArrowRight className="w-4 h-4 ml-2" />
                    </Button>
                  </div>
                </motion.div>
              )}

              {/* STEP 3: Photos with Cloud/Local upload */}
              {step === 3 && (
                <motion.div
                  key="step3"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="space-y-6"
                >
                  {/* Main Image */}
                  <div className="space-y-4">
                    <h3 className="text-sm font-bold flex items-center gap-2">
                      <ImageIcon className="w-4 h-4" /> Main Product Image
                    </h3>

                    {/* Upload mode toggle */}
                    <div className="flex items-center gap-2 p-3 rounded-xl bg-muted/30 border border-border">
                      <button
                        type="button"
                        onClick={() => setUploadMode("cloud")}
                        className={cn(
                          "flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all",
                          uploadMode === "cloud"
                            ? "bg-primary text-primary-foreground"
                            : "bg-background text-muted-foreground hover:text-foreground"
                        )}
                      >
                        <Cloud className="w-4 h-4" /> Cloud
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
                    {uploadMode === "cloud" && (
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
                        loading={uploadingCloud}
                      >
                        <Upload className="w-3.5 h-3.5 mr-1.5" /> Upload {uploadMode === "cloud" ? "to Cloud" : "Local"}
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
                        if (uploadMode === "cloud") {
                          await handleCloudUpload(file, "main");
                        } else {
                          await handleLocalUpload(file, "main");
                        }
                        e.target.value = "";
                      }}
                    />
                  </div>

                  {/* Gallery Images */}
                  <div className="space-y-4">
                    <h3 className="text-sm font-bold flex items-center gap-2">
                      <FolderInput className="w-4 h-4" /> Gallery Images
                    </h3>

                    {/* Upload mode toggle for gallery */}
                    <div className="flex items-center gap-2 p-3 rounded-xl bg-muted/30 border border-border">
                      <button
                        type="button"
                        onClick={() => setGalleryUploadMode("cloud")}
                        className={cn(
                          "flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all",
                          galleryUploadMode === "cloud"
                            ? "bg-primary text-primary-foreground"
                            : "bg-background text-muted-foreground hover:text-foreground"
                        )}
                      >
                        <Cloud className="w-4 h-4" /> Cloud
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
                    {galleryUploadMode === "cloud" && (
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
                        loading={uploadingCloud}
                      >
                        <Upload className="w-3.5 h-3.5 mr-1.5" /> Upload {galleryUploadMode === "cloud" ? "to Cloud" : "Local"}
                      </Button>
                    </div>
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
                          if (galleryUploadMode === "cloud") {
                            await handleCloudUpload(file, "gallery");
                          } else {
                            await handleLocalUpload(file, "gallery");
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
                  </div>

                  {/* Summary */}
                  <div className="p-4 rounded-xl bg-muted/50 border border-border space-y-2">
                    <h4 className="text-xs font-bold uppercase tracking-wider">Summary</h4>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <span className="text-muted-foreground">Name:</span>
                      <span className="font-medium">{addForm.watch("name") || "—"}</span>
                      <span className="text-muted-foreground">Price:</span>
                      <span className="font-medium">{addForm.watch("price") ? formatPrice(addForm.watch("price")) : "—"}</span>
                      <span className="text-muted-foreground">Category:</span>
                      <span className="font-medium">{addForm.watch("category") || "—"}</span>
                      <span className="text-muted-foreground">Sizes:</span>
                      <span className="font-medium">{selectedSizes.join(", ") || "—"}</span>
                      <span className="text-muted-foreground">Colors:</span>
                      <span className="font-medium">{selectedColors.length} selected</span>
                    </div>
                  </div>

                  <div className="flex justify-between gap-3 pt-6 border-t">
                    <Button type="button" variant="outline" className="rounded-2xl" onClick={() => setStep(2)}>
                      <ArrowLeft className="w-4 h-4 mr-2" /> Back
                    </Button>
                    <Button
                      type="submit"
                      form="add-product-form"
                      loading={addMutation.isPending}
                      loadingText="Saving..."
                      className="rounded-2xl"
                    >
                      <Check className="w-4 h-4 mr-2" /> Save Product
                    </Button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </form>
        </Form>
      </div>
    </div>
  );
}
