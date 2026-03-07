import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, Plus, MoreHorizontal, Pencil, ImageIcon, ArrowLeft, Upload } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import {
  createAdminProduct,
  createCategory,
  deleteAdminProduct,
  fetchAdminProducts,
  updateAdminProduct,
  uploadProductImage,
} from "@/lib/adminApi";
import { fetchCategories, type ProductApi } from "@/lib/api";
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
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";

const PRESET_COLORS = ["Black", "White", "Navy", "Grey", "Brown", "Beige", "Red", "Blue", "Green", "Pink", "Yellow", "Orange"];
const PRESET_SIZES = ["XS", "S", "M", "L", "XL", "XXL"];

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
        imageUrl: values.imageUrl?.trim() || undefined,
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
        imageUrl: values.imageUrl?.trim() || undefined,
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
          <div className="max-w-2xl mx-auto p-6 pb-20">
            <Button
              type="button"
              variant="ghost"
              className="mb-4 -ml-2"
              onClick={() => { setAddOpen(false); addForm.reset(); }}
            >
              <ArrowLeft className="w-4 h-4 mr-2" /> Back to products
            </Button>
            <h2 className="text-2xl font-serif font-medium mb-8">Add New Product</h2>
            <Form {...addForm}>
              <form
                onSubmit={addForm.handleSubmit((values) => addMutation.mutate(values))}
                className="space-y-8"
              >
                <div className="space-y-4">
                  <h3 className="text-xs font-semibold tracking-widest uppercase text-muted-foreground flex items-center gap-2">
                    <ImageIcon className="h-3.5 w-3.5" /> Product Media
                  </h3>
                  <FormField
                    control={addForm.control}
                    name="imageUrl"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Main image URL</FormLabel>
                        <div className="flex gap-2 flex-wrap">
                          <FormControl>
                            <Input placeholder="https://..." className="font-mono text-sm flex-1 min-w-[200px]" {...field} />
                          </FormControl>
                          <Button
                            type="button"
                            variant="outline"
                            disabled={uploadingImage}
                            onClick={() => imageInputRef.current?.click()}
                          >
                            <Upload className="w-4 h-4 mr-2" /> Upload from device
                          </Button>
                          <input
                            ref={imageInputRef}
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={async (e) => {
                              const file = e.target.files?.[0];
                              if (!file) return;
                              setUploadingImage(true);
                              try {
                                const dataUrl = await compressImage(file);
                                const url = await uploadProductImage(dataUrl);
                                addForm.setValue("imageUrl", url);
                                toast({ title: "Image uploaded" });
                              } catch {
                                toast({ title: "Upload failed", variant: "destructive" });
                              } finally {
                                setUploadingImage(false);
                                e.target.value = "";
                              }
                            }}
                          />
                        </div>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={addForm.control}
                    name="galleryUrlsText"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Gallery images (one URL per line)</FormLabel>
                        <FormControl>
                          <Textarea rows={3} placeholder="One URL per line" className="font-mono text-sm resize-none" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
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
                            Add new category
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
                <div className="space-y-4">
                  <h3 className="text-xs font-semibold tracking-widest uppercase text-muted-foreground">Variations</h3>
                  <FormField
                    control={addForm.control}
                    name="colorOptions"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Colors</FormLabel>
                        <div className="flex flex-wrap gap-3">
                          {PRESET_COLORS.map((color) => (
                            <div key={color} className="flex items-center space-x-2">
                              <Checkbox
                                id={`add-color-${color}`}
                                checked={field.value.includes(color)}
                                onCheckedChange={(checked) => {
                                  const next = checked
                                    ? [...field.value, color]
                                    : field.value.filter((c) => c !== color);
                                  field.onChange(next);
                                }}
                              />
                              <Label htmlFor={`add-color-${color}`} className="font-normal cursor-pointer">{color}</Label>
                            </div>
                          ))}
                        </div>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={addForm.control}
                    name="sizeOptions"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Sizes</FormLabel>
                        <div className="flex flex-wrap gap-3">
                          {PRESET_SIZES.map((size) => (
                            <div key={size} className="flex items-center space-x-2">
                              <Checkbox
                                id={`add-size-${size}`}
                                checked={field.value.includes(size)}
                                onCheckedChange={(checked) => {
                                  const next = checked
                                    ? [...field.value, size]
                                    : field.value.filter((s) => s !== size);
                                  field.onChange(next);
                                }}
                              />
                              <Label htmlFor={`add-size-${size}`} className="font-normal cursor-pointer">{size}</Label>
                            </div>
                          ))}
                        </div>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <div className="flex justify-end gap-3 pt-4 border-t">
                  <Button type="button" variant="outline" onClick={() => { setAddOpen(false); addForm.reset(); }}>
                    Cancel
                  </Button>
                  <Button type="submit" disabled={addMutation.isPending}>
                    Save Product
                  </Button>
                </div>
              </form>
            </Form>
          </div>
        </div>
      )}

      <div className="flex flex-col sm:flex-row gap-4 items-center justify-between">
          <div className="relative w-full max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input 
            placeholder="Search products..." 
            className="pl-9 bg-white dark:bg-card border-[#E5E5E0] dark:border-border rounded-full h-11"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
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
                className="bg-white dark:bg-card rounded-xl border border-[#E5E5E0] dark:border-border overflow-hidden hover:shadow-md transition-shadow group"
              >
                <div className="aspect-[4/3] bg-muted relative">
                  <button
                    type="button"
                    onClick={() => {
                      setEditProduct(product);
                      setEditOpen(true);
                    }}
                    className="absolute top-3 right-3 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-white/80 dark:bg-background/80 text-muted-foreground opacity-0 group-hover:opacity-100 shadow-sm transition-opacity"
                    aria-label="Edit product"
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                  <img
                    src={product.imageUrl ?? ""}
                    alt={product.name}
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/5 transition-colors" />
                </div>
                <div className="p-5">
                  <div className="flex justify-between items-start mb-2">
                    <span className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
                      {product.category}
                    </span>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 -mr-2 -mt-2 text-muted-foreground"
                        >
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          className="text-destructive"
                          onClick={() => deleteMutation.mutate(product.id)}
                        >
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                  <h3 className="font-serif font-medium text-lg mb-1 truncate">
                    {product.name}
                  </h3>
                  <p className="text-sm text-muted-foreground mb-4 truncate">
                    {product.category ?? "Uncategorized"}
                  </p>

                  <div className="flex items-center justify-between mt-auto">
                    <span className="font-medium">
                      {formatPrice(product.price)}
                    </span>
                    <Badge
                      variant="outline"
                      className={`border-none ${
                        product.stock > 10
                          ? "bg-[#E8F3EB] text-[#2C5234] dark:bg-green-950 dark:text-green-300"
                          : product.stock > 0
                            ? "bg-[#FFF4E5] text-[#8C5A14] dark:bg-yellow-950 dark:text-yellow-300"
                            : "bg-[#FDECEC] text-[#9A2D2D] dark:bg-red-950 dark:text-red-300"
                      }`}
                    >
                      {product.stock} in stock
                    </Badge>
                  </div>
                </div>
              </div>
            ))}
      </div>

      {/* Full-page Edit Product overlay */}
      {editOpen && editProduct && (
        <div className="fixed inset-0 z-50 bg-background overflow-auto">
          <div className="max-w-2xl mx-auto p-6 pb-20">
            <Button
              type="button"
              variant="ghost"
              className="mb-4 -ml-2"
              onClick={() => { setEditOpen(false); setEditProduct(null); }}
            >
              <ArrowLeft className="w-4 h-4 mr-2" /> Back to products
            </Button>
            <h2 className="text-2xl font-serif font-medium mb-8">Edit — {editProduct.name}</h2>
            <Form {...editForm}>
              <form
                onSubmit={editForm.handleSubmit((values) => editMutation.mutate(values))}
                className="space-y-8"
              >
                <div className="space-y-4">
                  <h3 className="text-xs font-semibold tracking-widest uppercase text-muted-foreground flex items-center gap-2">
                    <ImageIcon className="h-3.5 w-3.5" /> Product Media
                  </h3>
                  <FormField
                    control={editForm.control}
                    name="imageUrl"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Main image URL</FormLabel>
                        <div className="flex gap-2 flex-wrap">
                          <FormControl>
                            <Input placeholder="https://..." className="font-mono text-sm flex-1 min-w-[200px]" {...field} />
                          </FormControl>
                          <Button
                            type="button"
                            variant="outline"
                            disabled={uploadingImage}
                            onClick={() => imageInputRef.current?.click()}
                          >
                            <Upload className="w-4 h-4 mr-2" /> Upload from device
                          </Button>
                          <input
                            ref={imageInputRef}
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={async (e) => {
                              const file = e.target.files?.[0];
                              if (!file) return;
                              setUploadingImage(true);
                              try {
                                const dataUrl = await compressImage(file);
                                const url = await uploadProductImage(dataUrl);
                                editForm.setValue("imageUrl", url);
                                toast({ title: "Image uploaded" });
                              } catch {
                                toast({ title: "Upload failed", variant: "destructive" });
                              } finally {
                                setUploadingImage(false);
                                e.target.value = "";
                              }
                            }}
                          />
                        </div>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={editForm.control}
                    name="galleryUrlsText"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Gallery images (one per line)</FormLabel>
                        <FormControl>
                          <Textarea rows={3} placeholder="One URL per line" className="font-mono text-sm resize-none" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
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
                            Add new category
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
                <div className="space-y-4">
                  <h3 className="text-xs font-semibold tracking-widest uppercase text-muted-foreground">Variations</h3>
                  <FormField
                    control={editForm.control}
                    name="colorOptions"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Colors</FormLabel>
                        <div className="flex flex-wrap gap-3">
                          {PRESET_COLORS.map((color) => (
                            <div key={color} className="flex items-center space-x-2">
                              <Checkbox
                                id={`edit-color-${color}`}
                                checked={field.value.includes(color)}
                                onCheckedChange={(checked) => {
                                  const next = checked
                                    ? [...field.value, color]
                                    : field.value.filter((c) => c !== color);
                                  field.onChange(next);
                                }}
                              />
                              <Label htmlFor={`edit-color-${color}`} className="font-normal cursor-pointer">{color}</Label>
                            </div>
                          ))}
                        </div>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={editForm.control}
                    name="sizeOptions"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Sizes</FormLabel>
                        <div className="flex flex-wrap gap-3">
                          {PRESET_SIZES.map((size) => (
                            <div key={size} className="flex items-center space-x-2">
                              <Checkbox
                                id={`edit-size-${size}`}
                                checked={field.value.includes(size)}
                                onCheckedChange={(checked) => {
                                  const next = checked
                                    ? [...field.value, size]
                                    : field.value.filter((s) => s !== size);
                                  field.onChange(next);
                                }}
                              />
                              <Label htmlFor={`edit-size-${size}`} className="font-normal cursor-pointer">{size}</Label>
                            </div>
                          ))}
                        </div>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <div className="flex flex-col gap-3 pt-4 border-t">
                  <div className="flex justify-end gap-3">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => { setEditOpen(false); setEditProduct(null); }}
                    >
                      Cancel
                    </Button>
                    <Button type="submit" disabled={editMutation.isPending}>
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