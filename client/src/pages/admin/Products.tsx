import { Link } from "wouter";
import { useEffect, useMemo, useRef, useState } from "react";
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
  MoreHorizontal, ImageIcon, ArrowLeft, Upload, ExternalLink, ShoppingCart, TrendingUp, Calendar
} from "lucide-react";
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
  ProductAttribute 
} from "@/lib/adminApi";
import { fetchCategories, type ProductApi, type CategoryApi } from "@/lib/api";
import { createCategory } from "@/lib/adminApi"; // if it's there
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
      const matchesSearch =
        p.name.toLowerCase().includes(search.toLowerCase()) ||
        (p.category ?? "").toLowerCase().includes(search.toLowerCase());
      const matchesCategory =
        categoryFilter === "all" || (p.category ?? "").toLowerCase() ===
          categoryFilter.toLowerCase();
      return matchesSearch && matchesCategory;
    });
  }, [products, search, categoryFilter]);

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-serif font-medium text-[#2C3E2D] dark:text-foreground">Products</h1>
          <p className="text-muted-foreground mt-1">
            {filteredProducts.length} products • All
          </p>
        </div>
        <div className="flex items-center gap-3">
          {selectedProductIds.size > 0 && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="border-destructive text-destructive hover:bg-destructive/10">
                  Bulk Actions ({selectedProductIds.size})
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuItem 
                  className="text-destructive"
                  onClick={() => {
                    if (confirm(`Are you sure you want to delete ${selectedProductIds.size} products?`)) {
                      selectedProductIds.forEach(id => deleteMutation.mutate(id));
                      setSelectedProductIds(new Set());
                    }
                  }}
                >
                  Delete Selected
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
          <Sheet open={attrSheetOpen} onOpenChange={setAttrSheetOpen}>
            <SheetTrigger asChild>
              <Button
                variant="outline"
                className="border-[#2C3E2D] text-[#2C3E2D] hover:bg-[#2C3E2D]/5"
              >
                <Tags className="w-4 h-4 mr-2" /> Attributes
              </Button>
            </SheetTrigger>
            <SheetContent className="sm:max-w-xl md:max-w-2xl overflow-y-auto w-full p-0 border-none bg-[#FDFDFB] dark:bg-card">
              <AttributesManager onClose={() => setAttrSheetOpen(false)} />
            </SheetContent>
          </Sheet>
          <Button
            className="bg-[#2C3E2D] hover:bg-[#1A251B] text-white dark:bg-primary dark:text-primary-foreground"
            onClick={() => setAddOpen(true)}
          >
            <Plus className="w-4 h-4 mr-2" /> Add Product
          </Button>
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
                      <Button type="submit" form="add-product-form" disabled={addMutation.isPending}>
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
                                className={`min-w-[2rem] h-8 px-3 border text-xs font-medium transition-all rounded-sm ${
                                  isSelected
                                    ? "border-primary bg-primary text-primary-foreground"
                                    : "border-border hover:border-foreground/50 text-muted-foreground hover:text-foreground"
                                }`}
                              >
                                {c}
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
                                className={`w-12 h-10 border text-xs font-medium transition-all rounded-sm ${
                                  isSelected
                                    ? "border-primary bg-primary text-primary-foreground"
                                    : "border-border hover:border-foreground/50 text-muted-foreground hover:text-foreground"
                                }`}
                              >
                                {s}
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      <div className="pt-8 space-y-4 border-t border-gray-100">
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

      <div className="flex flex-col sm:flex-row gap-4 items-center justify-between">
        {/* Premium Admin Search Engine */}
        <div className="relative w-full max-w-md group">
          <motion.div
            initial={false}
            animate={{
              scale: search.length > 0 ? 1.02 : 1,
              boxShadow: search.length > 0 ? "0 10px 25px -5px rgba(0, 0, 0, 0.1)" : "0 1px 2px 0 rgba(0, 0, 0, 0.05)"
            }}
            className="flex items-center bg-white dark:bg-card border-[#E5E5E0] dark:border-border rounded-full h-12 px-4 transition-all duration-300 focus-within:border-primary/50"
          >
            <Search className={`h-5 w-5 transition-colors ${search.length > 0 ? 'text-primary' : 'text-muted-foreground'}`} />
            <Input 
              placeholder="Search product name, category, or status..." 
              className="border-none focus-visible:ring-0 bg-transparent h-full text-base placeholder:text-muted-foreground/50"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            {search && (
              <Button 
                variant="ghost" 
                size="icon" 
                className="h-8 w-8 rounded-full hover:bg-muted"
                onClick={() => setSearch("")}
              >
                <X className="h-4 w-4" />
              </Button>
            )}
          </motion.div>

          <AnimatePresence>
            {search.length > 1 && (
              <motion.div
                initial={{ opacity: 0, y: 10, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 10, scale: 0.95 }}
                className="absolute top-full left-0 right-0 mt-3 p-2 bg-white dark:bg-card border border-[#E5E5E0] dark:border-border rounded-2xl shadow-2xl z-[50] max-h-[400px] overflow-auto"
              >
                <div className="px-3 py-2 text-[10px] uppercase font-bold tracking-[0.2em] text-muted-foreground/60 border-b border-muted/30 mb-2">
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
                    <img src={p.imageUrl || "/placeholder.png"} className="w-10 h-10 rounded-lg object-cover" alt="" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold truncate">{p.name}</p>
                      <p className="text-[10px] text-muted-foreground uppercase">{p.category}</p>
                    </div>
                    <div className="text-right">
                       <p className="text-xs font-bold">{formatPrice(p.price)}</p>
                       <p className={`text-[9px] font-bold ${p.stock > 0 ? 'text-green-600' : 'text-red-600'}`}>{p.stock} in stock</p>
                    </div>
                   </div>
                ))}
                {filteredProducts.length === 0 && (
                  <div className="py-8 text-center text-muted-foreground text-sm italic">
                    No matches found for "{search}"
                  </div>
                )}
                {filteredProducts.length > 5 && (
                   <div className="p-2 mt-2 border-t text-center">
                      <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">
                        + {filteredProducts.length - 5} more matches
                      </p>
                   </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
        
        <div className="flex items-center gap-2 overflow-x-auto pb-2 sm:pb-0 w-full sm:w-auto">
          {[
            { label: "All", value: "all" },
            ...categories.map((c) => ({ label: c.name, value: c.slug })),
          ].map((cat) => (
            <Button
              key={cat.value}
              variant={categoryFilter === cat.value ? "default" : "outline"}
              className={`rounded-full ${categoryFilter === cat.value ? "bg-[#2C3E2D] text-white dark:bg-primary" : "bg-white dark:bg-card border-[#E5E5E0] dark:border-border"}`}
              onClick={() => setCategoryFilter(cat.value)}
            >
              {cat.label}
            </Button>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-2 mb-4">
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
        <Label htmlFor="select-all" className="text-sm cursor-pointer">
          Select All
        </Label>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
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
                className={`bg-white dark:bg-card rounded-xl border overflow-hidden hover:shadow-xl hover:-translate-y-1 transition-all duration-300 group relative ${
                  selectedProductIds.has(product.id) ? "border-primary ring-1 ring-primary" : "border-[#E5E5E0] dark:border-border"
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
                    className="bg-white/90 dark:bg-background/90 shadow-sm"
                  />
                </div>

                {/* Image & Hover Overlays */}
                <div className="aspect-[4/3] bg-muted relative overflow-hidden">
                  <img
                    src={product.imageUrl ?? ""}
                    alt={product.name}
                    className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                  />
                  
                  {/* Hover Edit Icon (Center) */}
                  <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer z-10"
                    onClick={() => {
                      setEditProduct(product);
                      setEditOpen(true);
                    }}
                  >
                    <div className="bg-white/20 backdrop-blur-md p-3 rounded-full border border-white/30 transform scale-75 group-hover:scale-100 transition-transform duration-300">
                      <Pencil className="h-6 w-6 text-white" />
                    </div>
                  </div>

                  {/* Top-Right Quick Actions (Visible on Hover) */}
                  <div className="absolute top-3 right-3 z-20 flex flex-col gap-2 opacity-0 group-hover:opacity-100 transition-opacity translate-x-4 group-hover:translate-x-0 duration-300">
                    <Button
                      size="icon"
                      variant="destructive"
                      className="h-9 w-9 rounded-full shadow-lg"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (confirm("Are you sure you want to delete this product?")) {
                          deleteMutation.mutate(product.id);
                        }
                      }}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                    <Button
                      size="icon"
                      className="h-9 w-9 rounded-full shadow-lg bg-white text-foreground hover:bg-gray-100 dark:bg-muted dark:text-foreground"
                      onClick={(e) => {
                        e.stopPropagation();
                        window.open(`/product/${product.id}`, "_blank");
                      }}
                    >
                      <ExternalLink className="h-4 w-4" />
                    </Button>
                  </div>

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
                  <div className="mt-6 pt-4 border-t flex gap-2">
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="flex-1 text-xs font-bold uppercase tracking-wider h-9"
                      onClick={() => {
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
                      onClick={() => {
                        if (confirm("Are you sure?")) deleteMutation.mutate(product.id);
                      }}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>
              </div>
            ))}
      </div>

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
                        <Button type="submit" form="edit-product-form" disabled={editMutation.isPending}>
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
                                className={`min-w-[2rem] h-8 px-3 border text-xs font-medium transition-all rounded-sm ${
                                  isSelected
                                    ? "border-primary bg-primary text-primary-foreground"
                                    : "border-border hover:border-foreground/50 text-muted-foreground hover:text-foreground"
                                }`}
                              >
                                {c}
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
                                className={`w-12 h-10 border text-xs font-medium transition-all rounded-sm ${
                                  isSelected
                                    ? "border-primary bg-primary text-primary-foreground"
                                    : "border-border hover:border-foreground/50 text-muted-foreground hover:text-foreground"
                                }`}
                              >
                                {s}
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      <div className="pt-8 space-y-4 border-t border-gray-100">
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
            <DialogTitle>Add new category</DialogTitle>
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
                createCategoryMutation.mutate({ name: newCategoryName.trim(), slug: newCategorySlug.trim() });
              }}
              disabled={createCategoryMutation.isPending}
            >
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}