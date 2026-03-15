import { Link } from "wouter";
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
  Loader2, Plus, Trash2, Palette, Ruler, Tags, Pipette, 
  Share2, FileText, Download, Check, X, Pencil, Search, Table as TableIcon,
  ChevronRight, FileSpreadsheet, Eye, EyeOff, LayoutTemplate, Shirt, Footprints, Tag,
  MoreHorizontal, ImageIcon, ArrowLeft, Upload, ExternalLink, ShoppingCart, TrendingUp, Calendar, Percent,
  FolderInput, Box, CheckCircle2
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
  deleteAdminProduct, 
  uploadProductImage, 
  fetchAdminAttributes, 
  ProductAttribute,
  createCategory,
  updateCategory,
  deleteCategory,
} from "@/lib/adminApi";
import { fetchCategories, type ProductApi, type CategoryApi } from "@/lib/api";
import { compressImage } from "@/lib/imageUtils";
import { useToast } from "@/hooks/use-toast";
import { formatPrice } from "@/lib/format";
import { Checkbox } from "@/components/ui/checkbox";
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

function slugify(s: string): string {
  return s
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "");
}

const productSchema = z.object({
  name: z.string().min(2, "Name required"),
  shortDetails: z.string().optional(),
  description: z.string().optional(),
  category: z.string().min(1, "Category required"),
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

export default function AdminProducts() {
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [addOpen, setAddOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editProduct, setEditProduct] = useState<ProductApi | null>(null);
  const [newCategoryOpen, setNewCategoryOpen] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [selectedProductIds, setSelectedProductIds] = useState<Set<string>>(new Set());
  const [attrSheetOpen, setAttrSheetOpen] = useState(false);
  const [moveMode, setMoveMode] = useState(false);
  const [moveTargetCategory, setMoveTargetCategory] = useState<string>('');
  const [moveNewCategoryName, setMoveNewCategoryName] = useState('');

  const { data: attributes } = useQuery<ProductAttribute[]>({
    queryKey: ["admin", "attributes"],
    queryFn: () => fetchAdminAttributes(),
  });

  const dynamicColors = useMemo(() => 
    attributes?.filter(a => a.type === "color").map(a => a.value) || [], 
    [attributes]
  );
  const dynamicSizes = useMemo(() => 
    attributes?.filter(a => a.type === "size").map(a => a.value) || [], 
    [attributes]
  );
  const [newCategorySlug, setNewCategorySlug] = useState("");
  const [pendingCategoryForm, setPendingCategoryForm] = useState<"add" | "edit" | null>(null);
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);
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

  useEffect(() => {
    if (editProduct) {
      const galleryUrls = parseJsonArray(editProduct.galleryUrls);
      const colorOptions = parseJsonArray(editProduct.colorOptions);
      const sizeOptions = parseJsonArray(editProduct.sizeOptions);
      editForm.reset({
        name: editProduct.name,
        shortDetails: editProduct.shortDetails ?? "",
        description: editProduct.description ?? "",
        category: editProduct.category ?? "",
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
  }, [editProduct, editForm]);

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
      const galleryUrls = values.galleryUrlsText
        ? values.galleryUrlsText.split(/\n/).map((u) => u.trim()).filter(Boolean)
        : [];
      const stock = values.stockStatus === "out_of_stock" ? 0 : values.stock;
      return createAdminProduct({
        name: values.name,
        shortDetails: values.shortDetails || undefined,
        description: values.description ?? "",
        price: values.price,
        imageUrl: values.imageUrl?.trim() || null,
        galleryUrls: galleryUrls.length ? JSON.stringify(galleryUrls) : undefined,
        category: values.category,
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
    },
    onError: () => {
      toast({ title: "Failed to add product" });
    },
  });

  const editMutation = useMutation({
    mutationFn: async (values: ProductFormValues) => {
      if (!editProduct) throw new Error("No product selected");
      const galleryUrls = values.galleryUrlsText
        ? values.galleryUrlsText.split(/\n/).map((u) => u.trim()).filter(Boolean)
        : [];
      const stock = values.stockStatus === "out_of_stock" ? 0 : values.stock;
      return updateAdminProduct(editProduct.id, {
        name: values.name,
        shortDetails: values.shortDetails || undefined,
        description: values.description ?? "",
        price: values.price,
        imageUrl: values.imageUrl?.trim() || null,
        galleryUrls: galleryUrls.length ? JSON.stringify(galleryUrls) : undefined,
        category: values.category,
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

  const filteredProducts = useMemo(() => {
    if (!products) return [];
    return products.filter((p) => {
      const matchesCategory =
        categoryFilter === "all" || (p.category ?? "").toLowerCase() ===
          categoryFilter.toLowerCase();
      return matchesCategory;
    });
  }, [products, categoryFilter]);

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
      </div>


      {/* Full-page Add Product overlay */}
      {addOpen && (
        <div className="fixed inset-0 z-50 bg-background overflow-auto">
          <div className="max-w-[1400px] mx-auto p-4 sm:p-6 pb-20">
            <Button
              type="button"
              variant="ghost"
              className="mb-6 -ml-2"
              onClick={() => { setAddOpen(false); addForm.reset(); }}
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
                              <Input placeholder="Two-Way Zip Hoodie" {...field} />
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
                            <FormLabel>Category *</FormLabel>
                            <div className="flex gap-2 flex-wrap">
                              <Select onValueChange={field.onChange} value={field.value}>
                                <FormControl>
                                  <SelectTrigger className="min-w-[180px]">
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
                              <Input type="number" min={0} step="1" {...field} />
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
                                <Input type="number" min={0} step="1" {...field} />
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
                      <Button type="button" variant="outline" onClick={() => { setAddOpen(false); addForm.reset(); }}>
                        Cancel
                      </Button>
                      <Button type="submit" form="add-product-form" loading={addMutation.isPending} loadingText="Saving...">
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
                       <input
                        ref={galleryInputRef}
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={async (e) => {
                          const file = e.target.files?.[0];
                          if (!file) return;
                          setUploadingImage(true);
                          toast({ title: "Uploading gallery image..." });
                          try {
                            const dataUrl = await compressImage(file);
                            const url = await uploadProductImage(dataUrl);
                            
                            // Append to galleryUrlsText
                            const current = addForm.getValues("galleryUrlsText") || "";
                            const next = current ? `${current}\n${url}` : url;
                            addForm.setValue("galleryUrlsText", next, { shouldValidate: true, shouldDirty: true });
                            toast({ title: "Gallery image added" });
                          } catch {
                            toast({ title: "Upload failed", variant: "destructive" });
                          } finally {
                            setUploadingImage(false);
                            e.target.value = "";
                          }
                        }}
                      />
                      
                      <Button 
                        type="button" 
                        variant="outline" 
                        className="w-full border-dashed"
                        onClick={() => galleryInputRef.current?.click()}
                        disabled={uploadingImage}
                      >
                        <Plus className="w-4 h-4 mr-2" /> Add More Pictures
                      </Button>

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
                          <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground font-bold italic">Colors</p>
                          <Link href="/admin/attributes" className="text-[10px] text-primary hover:underline font-medium">Manage</Link>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {dynamicColors.map((c) => {
                            const [name, hex] = c.split("|");
                            const selectedColors = addForm.watch("colorOptions") || [];
                            const isSelected = selectedColors.includes(c);
                            return (
                              <button
                                key={c}
                                type="button"
                                onClick={() => {
                                  const next = isSelected 
                                    ? selectedColors.filter(x => x !== c)
                                    : [...selectedColors, c];
                                  addForm.setValue("colorOptions", next, { shouldValidate: true, shouldDirty: true });
                                }}
                                className={`flex items-center gap-2 px-3 py-1.5 border text-[11px] font-bold transition-all rounded-full ${
                                  isSelected
                                    ? "border-primary bg-primary text-primary-foreground shadow-md ring-2 ring-primary/20"
                                    : "border-border hover:border-foreground/50 text-muted-foreground hover:text-foreground bg-white/50 dark:bg-card"
                                }`}
                              >
                                <div 
                                  className="w-3 h-3 rounded-full border border-black/10 shadow-sm" 
                                  style={{ backgroundColor: hex || '#ccc' }}
                                />
                                {name}
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      {/* Interactive Sizes */}
                      <div>
                        <div className="flex items-center justify-between mb-3">
                          <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground font-bold italic">Sizes</p>
                          <Link href="/admin/attributes" className="text-[10px] text-primary hover:underline font-medium">Manage</Link>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {dynamicSizes.map((s) => {
                            const selectedSizes = addForm.watch("sizeOptions") || [];
                            const isSelected = selectedSizes.includes(s);
                            return (
                              <button
                                key={s}
                                type="button"
                                onClick={() => {
                                  const next = isSelected 
                                    ? selectedSizes.filter(x => x !== s)
                                    : [...selectedSizes, s];
                                  addForm.setValue("sizeOptions", next, { shouldValidate: true, shouldDirty: true });
                                }}
                                className={`h-11 w-11 flex items-center justify-center border text-[11px] font-black tracking-tighter transition-all rounded-xl ${
                                  isSelected
                                    ? "border-primary bg-primary text-primary-foreground shadow-lg scale-105"
                                    : "border-border hover:border-foreground/50 text-muted-foreground hover:text-foreground bg-white/50 dark:bg-card"
                                }`}
                              >
                                {s}
                              </button>
                            );
                          })}
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

      <div className="flex flex-col gap-6 px-2 pt-4 pb-2 border-b border-border/50">
        {/* Mobile-first: Attributes and Add Product at the top */}
        <div className="flex flex-row justify-between items-center w-full order-1 sm:order-none">
          <Sheet open={attrSheetOpen} onOpenChange={setAttrSheetOpen}>
            <SheetTrigger asChild>
              <Button
                variant="outline"
                className="rounded-full border-[#2C3E2D] text-[#2C3E2D] hover:bg-[#2C3E2D]/5 dark:border-border dark:text-foreground dark:hover:bg-accent font-bold text-xs px-4 h-9 shadow-sm"
              >
                <Tags className="w-4 h-4 mr-2" /> Attributes
              </Button>
            </SheetTrigger>
            <SheetContent className="sm:max-w-xl md:max-w-2xl overflow-y-auto w-full p-0 border-none bg-[#FDFDFB] dark:bg-card">
              <AttributesManager onClose={() => setAttrSheetOpen(false)} />
            </SheetContent>
          </Sheet>

          <Button
            className="rounded-full bg-[#2C3E2D] hover:bg-[#1A251B] text-white dark:bg-primary dark:text-primary-foreground font-bold text-xs px-6 h-10 shadow-md"
            onClick={() => {
              if (categoryFilter !== "all") {
                addForm.setValue("category", categoryFilter);
              } else {
                addForm.setValue("category", "");
              }
              setAddOpen(true);
            }}
          >
            <Plus className="w-4 h-4 mr-2" /> Add Product
          </Button>
        </div>

        {/* Categories: Second on mobile, centered/padded */}
        <div className="flex gap-2 min-w-0 overflow-x-auto pb-2 -mx-2 px-2 scrollbar-none order-2 sm:order-none justify-start sm:justify-center no-scrollbar">
          <Button
            variant={categoryFilter === "all" ? "default" : "outline"}
            onClick={() => setCategoryFilter("all")}
            className={cn(
              "px-4 py-1.5 rounded-full text-xs font-bold border transition-all shadow-sm h-auto flex-shrink-0",
              categoryFilter !== "all" && "bg-background text-muted-foreground border-border hover:border-primary hover:text-foreground"
            )}
          >
            All
          </Button>
          {categories.map((cat) => (
            <Button
              key={cat.id}
              variant={categoryFilter === cat.slug ? "default" : "outline"}
              onClick={() => setCategoryFilter(cat.slug)}
              className={cn(
                "px-4 py-1.5 rounded-full text-xs font-bold border transition-all shadow-sm h-auto flex-shrink-0",
                categoryFilter !== cat.slug && "bg-background text-muted-foreground border-border hover:border-primary hover:text-foreground"
              )}
            >
              {cat.name}
            </Button>
          ))}
        </div>
      </div>

      {/* Move Panel */}
      {moveMode && selectedProductIds.size > 0 && (
        <div className="border border-border rounded-xl p-4 bg-card mt-3">
          <p className="text-xs text-muted-foreground mb-3 font-medium uppercase tracking-wide">
            Moving {selectedProductIds.size} product{selectedProductIds.size > 1 ? 's' : ''}
          </p>
          {/* Product chips */}
          <div className="flex flex-wrap gap-2 mb-4">
            {filteredProducts.filter(p => selectedProductIds.has(p.id)).map(product => (
              <div
                key={product.id}
                className="flex items-center gap-1.5 bg-muted rounded-lg px-2 py-1 text-xs font-medium group cursor-pointer hover:bg-destructive/10 hover:text-destructive transition-colors"
                onClick={() => {
                  const next = new Set(selectedProductIds);
                  next.delete(product.id);
                  setSelectedProductIds(next);
                }}
              >
                {product.name}
                <span className="text-muted-foreground group-hover:text-destructive">×</span>
              </div>
            ))}
          </div>
          {/* Move options */}
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <select
                value={moveTargetCategory}
                onChange={e => setMoveTargetCategory(e.target.value)}
                className="flex-1 bg-background text-foreground border border-border rounded-lg px-3 py-2 text-sm cursor-pointer"
              >
                <option value="">Move to existing category...</option>
                {categories.map(cat => (
                  <option key={cat.id} value={cat.slug}>{cat.name}</option>
                ))}
              </select>
              <button
                onClick={async () => {
                  if (!moveTargetCategory) return;
                  try {
                    await Promise.all(
                      Array.from(selectedProductIds).map(id =>
                        updateAdminProduct(id, { category: moveTargetCategory })
                      )
                    );
                    queryClient.invalidateQueries({ queryKey: ["admin", "products"] });
                    toast({ title: `Moved ${selectedProductIds.size} products` });
                    setSelectedProductIds(new Set());
                    setMoveMode(false);
                    setMoveTargetCategory('');
                  } catch {
                    toast({ title: "Failed to move products", variant: "destructive" });
                  }
                }}
                disabled={!moveTargetCategory}
                className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm disabled:opacity-40"
              >
                Move
              </button>
            </div>
            <div className="flex items-center gap-2">
              <input
                value={moveNewCategoryName}
                onChange={e => setMoveNewCategoryName(e.target.value)}
                placeholder="Or create new category..."
                className="flex-1 bg-background text-foreground border border-border rounded-lg px-3 py-2 text-sm placeholder:text-muted-foreground"
              />
              <button
                onClick={async () => {
                  if (!moveNewCategoryName.trim()) return;
                  try {
                    const slug = slugify(moveNewCategoryName);
                    const newCat = await createCategory({ name: moveNewCategoryName.trim(), slug });
                    await Promise.all(
                      Array.from(selectedProductIds).map(id =>
                        updateAdminProduct(id, { category: newCat.slug })
                      )
                    );
                    queryClient.invalidateQueries({ queryKey: ["admin", "products"] });
                    queryClient.invalidateQueries({ queryKey: ["categories"] });
                    toast({ title: `Created "${newCat.name}" and moved ${selectedProductIds.size} products` });
                    setSelectedProductIds(new Set());
                    setMoveMode(false);
                    setMoveNewCategoryName('');
                  } catch {
                    toast({ title: "Failed to create category & move", variant: "destructive" });
                  }
                }}
                disabled={!moveNewCategoryName.trim()}
                className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm disabled:opacity-40"
              >
                Create & Move
              </button>
            </div>
          </div>
        </div>
      )}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-[#F9FBF9] dark:bg-muted/10 p-4 rounded-xl border border-[#E9EFE9] dark:border-muted/20 shadow-sm overflow-hidden">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4 flex-1 w-full">
          <div className="flex items-center gap-3 shrink-0">
            <Checkbox 
              id="select-all"
              checked={filteredProducts.length > 0 && selectedProductIds.size === filteredProducts.length}
              onCheckedChange={(checked) => {
                if (checked) {
                  setSelectedProductIds(new Set(filteredProducts.map(p => p.id)));
                } else {
                  setSelectedProductIds(new Set());
                }
              }}
            />
            <Label htmlFor="select-all" className="text-sm cursor-pointer font-bold whitespace-nowrap px-1">
              {selectedProductIds.size > 0 ? `${selectedProductIds.size} selected` : 'Select All'}
            </Label>

            {/* Selection actions moved to the left after checkboxes */}
            <AnimatePresence>
              {selectedProductIds.size > 0 && (
                <motion.div 
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  className="flex items-center gap-2 border-l border-border pl-3 ml-1"
                >
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setSelectedProductIds(new Set())}
                    className="h-8 rounded-full text-[10px] font-black uppercase tracking-widest text-muted-foreground hover:text-foreground px-4 shadow-sm"
                  >
                    Deselect
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setMoveMode(prev => !prev)}
                    className={cn(
                      "h-8 rounded-full text-[10px] font-black uppercase tracking-widest px-4 shadow-sm transition-all",
                      moveMode ? "bg-primary text-primary-foreground border-primary" : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    <FolderInput size={12} className="mr-1.5" />
                    Move
                  </Button>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button size="sm" variant="outline" className="h-8 rounded-full text-[10px] font-black uppercase tracking-widest border-destructive/50 text-destructive hover:bg-destructive/10 px-4 shadow-sm">
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

          {/* Search bar inside the section - flexible width */}
          <div className="flex-1 min-w-0 relative group">
            <div className="flex items-center bg-white dark:bg-card border border-[#E5E5E0] dark:border-border rounded-full h-10 px-4 transition-all duration-300 focus-within:border-primary/50 shadow-inner">
              <Search className={`h-4 w-4 shrink-0 transition-colors ${search.length > 0 ? 'text-primary' : 'text-muted-foreground'}`} />
              <Input 
                placeholder="Search products..." 
                className="border-none focus-visible:ring-0 bg-transparent h-full text-sm placeholder:text-muted-foreground/50 px-3 w-full"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              {search && (
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="h-7 w-7 shrink-0 rounded-full hover:bg-muted"
                  onClick={() => setSearch("")}
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
                  className="absolute top-full left-0 right-0 mt-3 p-2 bg-white dark:bg-card border border-[#E5E5E0] dark:border-border rounded-2xl shadow-2xl z-[50] max-h-[300px] overflow-auto"
                >
                  <div className="px-3 py-1.5 text-[9px] uppercase font-bold tracking-[0.2em] text-muted-foreground/60 border-b border-muted/30 mb-2">
                    Quick Results
                  </div>
                  {filteredProducts.slice(0, 5).map(p => (
                     <div 
                      key={p.id} 
                      className="flex items-center gap-3 p-2 rounded-xl hover:bg-muted/50 transition-colors cursor-pointer"
                      onClick={() => {
                        setEditProduct(p);
                        setEditOpen(true);
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
        </div>
        
        <div className="flex items-center gap-4 w-full sm:w-auto justify-between sm:justify-end shrink-0">
          <p className="text-[11px] font-black text-muted-foreground uppercase tracking-widest whitespace-nowrap">
            {filteredProducts.length} Items
          </p>
          <ViewToggle view={viewMode} onViewChange={setViewMode} />
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
                  
                  {/* Always Visible Edit/Delete Buttons (as requested) */}
                  <div className="mt-6 pt-4 border-t border-border flex gap-2">
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="flex-1 text-xs font-bold uppercase tracking-wider h-9"
                      onClick={(e) => {
                        e.stopPropagation();
                        setEditProduct(product);
                        setEditOpen(true);
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
                      <td className="p-4 text-right">
                        <div className="flex justify-end gap-1">
                          <Button 
                            variant="outline" 
                            size="icon" 
                            className="h-8 w-8"
                            onClick={(e) => {
                              e.stopPropagation();
                              setEditProduct(product);
                              setEditOpen(true);
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

      {/* Full-page Edit Product overlay */}
      {editOpen && editProduct && (
        <div className="fixed inset-0 z-50 bg-background overflow-auto">
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
                              <Input placeholder="Two-Way Zip Hoodie" {...field} />
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
                              <Input placeholder="Brief tagline" {...field} />
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
                      <FormField
                        control={editForm.control}
                        name="category"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Category *</FormLabel>
                            <div className="flex gap-2 flex-wrap">
                              <Select onValueChange={field.onChange} value={field.value}>
                                <FormControl>
                                  <SelectTrigger className="min-w-[180px]">
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
                                onClick={() => { setPendingCategoryForm("edit"); setNewCategoryOpen(true); }}
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
                        control={editForm.control}
                        name="price"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Price (NPR) *</FormLabel>
                            <FormControl>
                              <Input type="number" min={0} step="1" {...field} />
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
                                <Input type="number" min={0} step="1" {...field} />
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
                        <Button type="submit" form="edit-product-form" loading={editMutation.isPending} loadingText="Saving...">
                          Save Changes
                        </Button>
                      </div>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button type="button" variant="destructive" className="w-full mt-4">
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
                       <input
                        ref={galleryInputRef}
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={async (e) => {
                          const file = e.target.files?.[0];
                          if (!file) return;
                          setUploadingImage(true);
                          toast({ title: "Uploading gallery image..." });
                          try {
                            const dataUrl = await compressImage(file);
                            const url = await uploadProductImage(dataUrl);
                            
                            // Append to galleryUrlsText
                            const current = editForm.getValues("galleryUrlsText") || "";
                            const next = current ? `${current}\n${url}` : url;
                            editForm.setValue("galleryUrlsText", next, { shouldValidate: true, shouldDirty: true });
                            toast({ title: "Gallery image added" });
                          } catch {
                            toast({ title: "Upload failed", variant: "destructive" });
                          } finally {
                            setUploadingImage(false);
                            e.target.value = "";
                          }
                        }}
                      />
                      
                      <Button 
                        type="button" 
                        variant="outline" 
                        className="w-full border-dashed"
                        onClick={() => galleryInputRef.current?.click()}
                        disabled={uploadingImage}
                      >
                        <Plus className="w-4 h-4 mr-2" /> Add More Pictures
                      </Button>

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
                          <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground font-bold italic">Colors</p>
                          <Link href="/admin/attributes" className="text-[10px] text-primary hover:underline font-medium">Manage</Link>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {dynamicColors.map((c) => {
                            const [name, hex] = c.split("|");
                            const selectedColors = editForm.watch("colorOptions") || [];
                            const isSelected = selectedColors.includes(c);
                            return (
                              <button
                                key={c}
                                type="button"
                                onClick={() => {
                                  const next = isSelected 
                                    ? selectedColors.filter(x => x !== c)
                                    : [...selectedColors, c];
                                  editForm.setValue("colorOptions", next, { shouldValidate: true, shouldDirty: true });
                                }}
                                className={`flex items-center gap-2 px-3 py-1.5 border text-[11px] font-bold transition-all rounded-full ${
                                  isSelected
                                    ? "border-primary bg-primary text-primary-foreground shadow-md ring-2 ring-primary/20"
                                    : "border-border hover:border-foreground/50 text-muted-foreground hover:text-foreground bg-white/50 dark:bg-card"
                                }`}
                              >
                                <div 
                                  className="w-3 h-3 rounded-full border border-black/10 shadow-sm" 
                                  style={{ backgroundColor: hex || '#ccc' }}
                                />
                                {name}
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      {/* Interactive Sizes */}
                      <div>
                        <div className="flex items-center justify-between mb-3">
                          <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground font-bold italic">Sizes</p>
                          <Link href="/admin/attributes" className="text-[10px] text-primary hover:underline font-medium">Manage</Link>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {dynamicSizes.map((s) => {
                            const selectedSizes = editForm.watch("sizeOptions") || [];
                            const isSelected = selectedSizes.includes(s);
                            return (
                              <button
                                key={s}
                                type="button"
                                onClick={() => {
                                  const next = isSelected 
                                    ? selectedSizes.filter(x => x !== s)
                                    : [...selectedSizes, s];
                                  editForm.setValue("sizeOptions", next, { shouldValidate: true, shouldDirty: true });
                                }}
                                className={`h-11 w-11 flex items-center justify-center border text-[11px] font-black tracking-tighter transition-all rounded-xl ${
                                  isSelected
                                    ? "border-primary bg-primary text-primary-foreground shadow-lg scale-105"
                                    : "border-border hover:border-foreground/50 text-muted-foreground hover:text-foreground bg-white/50 dark:bg-card"
                                }`}
                              >
                                {s}
                              </button>
                            );
                          })}
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
    </div>
  );
}