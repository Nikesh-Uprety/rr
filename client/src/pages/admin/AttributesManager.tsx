import { useState, useRef, useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { 
  Loader2, Plus, Trash2, Palette, Ruler, Tags, Pipette, 
  Share2, FileText, Download, X, Eye, EyeOff, FileSpreadsheet, Tag, Shirt, Footprints, LayoutTemplate
} from "lucide-react";
import { 
  fetchAdminAttributes, 
  createAdminAttribute, 
  deleteAdminAttribute, 
  createCategory, 
  updateCategory, 
  deleteCategory, 
  fetchAdminProducts,
  ProductAttribute 
} from "@/lib/adminApi";
import { fetchCategories, type CategoryApi } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { formatPrice } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
} from "@/components/ui/card";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  PreviewLinkCard,
  PreviewLinkCardContent,
  PreviewLinkCardImage,
  PreviewLinkCardTrigger,
} from "@/components/ui/preview-link-card";
import { extractAttributeLabel, normalizeAttributeLabel } from "@shared/productAttributes";

// Helper for color contrast
function getContrastColor(hex: string): string {
  if (!hex || hex === "transparent") return "black";
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const yiq = (r * 299 + g * 587 + b * 114) / 1000;
  return yiq >= 128 ? "black" : "white";
}

function slugify(s: string): string {
  return s
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "");
}

function rgbaToHex(rgba: string): string {
  const parts = rgba.substring(rgba.indexOf("(")+1, rgba.lastIndexOf(")")).split(/,\s*/);
  const r = parseInt(parts[0]);
  const g = parseInt(parts[1]);
  const b = parseInt(parts[2]);
  const a = parts[3] ? parseFloat(parts[3]) : 1;
  
  // Mix with white if alpha < 1 to get a solid hex
  const mix = (c: number) => Math.round(c * a + 255 * (1 - a));
  const toHex = (c: number) => mix(c).toString(16).padStart(2, '0');
  
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`.toUpperCase();
}

const CATEGORY_ICONS: Record<string, any> = {
  HOODIE: Shirt,
  TSHIRTS: Shirt,
  TROUSER: Footprints,
  WINTER_25: LayoutTemplate,
  DEFAULT: Tag
};

export function AttributesManager({ onClose }: { onClose: () => void }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [newValue, setNewValue] = useState("");
  const [selectedColor, setSelectedColor] = useState("#000000");
  const [activeTab, setActiveTab] = useState("color");
  const [editingCategory, setEditingCategory] = useState<CategoryApi | null>(null);
  const [viewCategoryProducts, setViewCategoryProducts] = useState<string | null>(null);
  const [showSizeChart, setShowSizeChart] = useState(false);
  const sizeChartRef = useRef<HTMLDivElement>(null);

  // Queries
  const { data: attributes, isLoading: attrsLoading } = useQuery<ProductAttribute[]>({
    queryKey: ["admin", "attributes"],
    queryFn: () => fetchAdminAttributes(),
  });

  const { data: categories, isLoading: catsLoading } = useQuery<CategoryApi[]>({
    queryKey: ["admin", "categories"],
    queryFn: () => fetchCategories(),
  });

  const { data: catProducts, isLoading: productsLoading } = useQuery({
    queryKey: ["admin", "products", { category: viewCategoryProducts }],
    queryFn: () => fetchAdminProducts({ category: viewCategoryProducts! }),
    enabled: !!viewCategoryProducts,
  });

  // Mutations
  const createAttrMutation = useMutation({
    mutationFn: (data: { type: string; value: string }) => {
      const [name, hex] = data.value.split('|');
      const normalizedName = normalizeAttributeLabel(name);
      const isDuplicateName = attributes?.some(
        (a) => a.type === data.type && normalizeAttributeLabel(a.value) === normalizedName,
      );
      const finalValue = isDuplicateName && data.type === 'color' 
        ? `${name} (${hex})|${hex}` 
        : data.value;
      
      return createAdminAttribute({ type: data.type, value: finalValue });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "attributes"] });
      setNewValue("");
      toast({ title: "Attribute added successfully" });
    },
  });

  const deleteAttrMutation = useMutation({
    mutationFn: (id: string) => deleteAdminAttribute(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "attributes"] });
      toast({ title: "Attribute removed" });
    },
  });

  const catMutation = useMutation({
    mutationFn: (data: { name: string; slug: string; id?: string }) => 
      data.id ? updateCategory(data.id, data) : createCategory(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "categories"] });
      queryClient.invalidateQueries({ queryKey: ["categories"] });
      setNewValue("");
      setEditingCategory(null);
      toast({ title: "Category updated" });
    },
  });

  const deleteCatMutation = useMutation({
    mutationFn: (id: string) => deleteCategory(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "categories"] });
      queryClient.invalidateQueries({ queryKey: ["categories"] });
      toast({ title: "Category deleted" });
    },
  });

  // Color logic
  const handleEyeDropper = async () => {
    // @ts-ignore
    if (!window.EyeDropper) {
      toast({ title: "EyeDropper not supported", variant: "destructive" });
      return;
    }
    // @ts-ignore
    const dropper = new window.EyeDropper();
    try {
      const result = await dropper.open();
      setSelectedColor(result.sRGBHex);
    } catch (e) {}
  };

  const shareSizeChart = async (type: 'whatsapp' | 'image' | 'pdf') => {
    if (!sizeChartRef.current) return;
    if (type === 'whatsapp') {
      const text = "RARE ATELIER Size Chart Guidelines\nCheck our latest sizing for a perfect fit!";
      window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
    } else {
      const html2canvas = (await import("html2canvas")).default;
      const canvas = await html2canvas(sizeChartRef.current);
      if (type === 'image') {
        const link = document.createElement('a');
        link.download = 'size-chart.png';
        link.href = canvas.toDataURL();
        link.click();
      } else {
        const jsPDF = (await import("jspdf")).default;
        const imgData = canvas.toDataURL('image/png');
        const pdf = new jsPDF();
        pdf.addImage(imgData, 'PNG', 10, 10, 190, 0);
        pdf.save('size-chart.pdf');
      }
    }
  };

  const exportCategoryToExcel = () => {
    if (!catProducts || catProducts.length === 0) return;
    const headers = ["Product Name", "Price (NPR)", "Stock Level", "Category"];
    const rows = catProducts.map(p => [p.name, p.price, p.stock, p.category]);
    const csvContent = [headers, ...rows].map(e => e.join(",")).join("\n");
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `${viewCategoryProducts || 'category'}_products.csv`;
    link.click();
    toast({ title: "Inventory exported to CSV/Excel" });
  };

  const colorShades = useMemo(() => {
    const shades = [];
    const r = parseInt(selectedColor.slice(1, 3), 16);
    const g = parseInt(selectedColor.slice(3, 5), 16);
    const b = parseInt(selectedColor.slice(5, 7), 16);
    
    for (let i = 1; i <= 9; i++) {
        const factor = i * 0.1;
        // Lighten by mixing with white
        const mix = (c: number) => Math.round(c + (255 - c) * (1 - factor));
        const toHex = (c: number) => mix(c).toString(16).padStart(2, '0');
        shades.push(`#${toHex(r)}${toHex(g)}${toHex(b)}`.toUpperCase());
    }
    return shades;
  }, [selectedColor]);

  if (attrsLoading || catsLoading) return <div className="p-12 flex justify-center"><Loader2 className="animate-spin" /></div>;

  return (
    <div className="flex h-full min-h-0 flex-col animate-in slide-in-from-right duration-300 bg-gradient-to-b from-[#FBFDFB] to-[#F2F7F2] dark:from-card dark:to-card/80">
      <SheetHeader className="shrink-0 border-b border-[#DDE7DB] bg-white/90 p-6 backdrop-blur dark:border-border dark:bg-card/95">
        <SheetTitle className="text-2xl font-serif">Store Attributes</SheetTitle>
        <SheetDescription>Manage product variants, sizes, and categories in one place.</SheetDescription>
      </SheetHeader>

      <div className="flex-1 min-h-0 overflow-y-auto px-5 py-5 sm:px-6">
        <Tabs defaultValue="color" onValueChange={setActiveTab} className="w-full">
          <TabsList className="mb-6 w-full rounded-2xl border border-[#DDE7DB] bg-white/85 p-1 shadow-sm backdrop-blur dark:border-border dark:bg-muted/40">
            <TabsTrigger value="color" className="flex-1 rounded-xl data-[state=active]:bg-[#2F5A39] data-[state=active]:text-white"><Palette className="w-4 h-4 mr-2" /> Product Variants</TabsTrigger>
            <TabsTrigger value="size" className="flex-1 rounded-xl data-[state=active]:bg-[#2F5A39] data-[state=active]:text-white"><Ruler className="w-4 h-4 mr-2" /> Product Sizes</TabsTrigger>
            <TabsTrigger value="category" className="flex-1 rounded-xl data-[state=active]:bg-[#2F5A39] data-[state=active]:text-white"><Tags className="w-4 h-4 mr-2" /> Category</TabsTrigger>
          </TabsList>

          <TabsContent value="color" className="mt-0 space-y-6 pb-6">
            <Card className="border-none shadow-none bg-transparent">
               <CardContent className="p-0">
                  <div className="flex gap-3 items-end mb-8 bg-white dark:bg-muted/20 p-4 rounded-2xl border">
                    <div className="space-y-2 flex-1">
                      <Label className="text-[10px] uppercase font-bold tracking-widest opacity-50">Color Name</Label>
                      <Input 
                        placeholder="e.g. Deep Forest" 
                        value={newValue} 
                        onChange={(e) => setNewValue(e.target.value)}
                        className="h-11 rounded-xl"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-[10px] uppercase font-bold tracking-widest opacity-50">Picker</Label>
                      <div className="flex gap-2">
                        <div className="relative w-11 h-11 rounded-xl border overflow-hidden shadow-inner shrink-0" style={{ backgroundColor: selectedColor }}>
                          <Input type="color" value={selectedColor} onChange={(e) => setSelectedColor(e.target.value)} className="absolute inset-0 opacity-0 cursor-pointer" />
                        </div>
                        <Button variant="outline" className="h-11 rounded-xl" onClick={handleEyeDropper}><Pipette className="w-4 h-4" /></Button>
                      </div>
                    </div>
                    <Button 
                      className="h-11 px-6 rounded-xl bg-primary text-primary-foreground" 
                      onClick={() => createAttrMutation.mutate({ type: "color", value: `${newValue}|${selectedColor}` })}
                      disabled={!newValue}
                    >
                      <Plus className="w-4 h-4 mr-2" /> Add
                    </Button>
                  </div>

                  <div className="grid grid-cols-2 xs:grid-cols-3 sm:grid-cols-4 gap-4 pb-6">
                    {attributes?.filter(a => a.type === 'color').map(attr => {
                      const [name, hex] = attr.value.split('|');
                      const contrast = getContrastColor(hex);
                      return (
                        <div key={attr.id} className="group relative">
                          <div 
                            className="h-24 rounded-2xl flex flex-col items-center justify-center p-2 shadow-sm border border-black/5 transition-all hover:scale-[1.05] hover:shadow-xl"
                            style={{ backgroundColor: hex }}
                          >
                            <span className="text-[10px] font-bold uppercase tracking-tighter text-center line-clamp-2 px-1" style={{ color: contrast }}>{name}</span>
                            <span className="text-[9px] font-mono opacity-60 font-bold" style={{ color: contrast }}>{hex}</span>
                          </div>
                          <Button 
                            variant="destructive" 
                            size="icon" 
                            className="absolute -top-1 -right-1 h-6 w-6 rounded-full opacity-0 group-hover:opacity-100 transition-opacity shadow-lg"
                            onClick={() => deleteAttrMutation.mutate(attr.id)}
                          >
                            <X className="w-3 h-3" />
                          </Button>
                        </div>
                      );
                    })}
                  </div>

                  <div className="pt-8 border-t border-dashed">
                    <h4 className="text-[11px] font-bold uppercase tracking-widest mb-4 opacity-40">Discovery Spectrum</h4>
                    <div className="flex h-12 rounded-xl border overflow-hidden">
                       {colorShades.map((shade, i) => (
                          <div 
                            key={i} 
                            className="flex-1 transition-all hover:flex-[2] cursor-pointer" 
                            style={{ backgroundColor: shade }} 
                            onClick={() => {
                              setSelectedColor(shade);
                              setNewValue(newValue || "New Variation");
                            }}
                          />
                       ))}
                    </div>
                    <p className="text-[10px] mt-2 text-muted-foreground italic">Click a segment to explore variants of {selectedColor}</p>
                  </div>
               </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="size" className="mt-0 space-y-6 pb-6">
            <div className="flex gap-2">
              <Input placeholder="Size (e.g. m, xl, xxl)" value={newValue} onChange={(e) => setNewValue(e.target.value)} className="h-11 rounded-xl" />
              <Button className="h-11 rounded-xl" onClick={() => createAttrMutation.mutate({ type: "size", value: newValue })}><Plus className="w-4 h-4" /></Button>
            </div>
            
            <div className="grid grid-cols-4 gap-3">
              {attributes?.filter(a => a.type === 'size').map(attr => (
                <div key={attr.id} className="relative group p-4 border rounded-xl bg-white dark:bg-muted/10 text-center font-bold tracking-widest hover:border-primary transition-colors">
                   {extractAttributeLabel(attr.value)}
                   <Button 
                    variant="ghost" 
                    size="icon" 
                    className="absolute top-0 right-0 h-5 w-5 opacity-0 group-hover:opacity-100 text-destructive" 
                    onClick={() => { if(confirm("Remove?")) deleteAttrMutation.mutate(attr.id); }}
                   >
                     <Trash2 className="w-3 h-3" />
                   </Button>
                </div>
              ))}
            </div>

            <div className="pt-12">
               <Button 
                variant="outline" 
                className="w-full h-14 border-dashed rounded-2xl flex justify-between px-6"
                onClick={() => setShowSizeChart(!showSizeChart)}
               >
                 <span className="flex items-center gap-2 font-medium"><FileText className="w-4 h-4 text-primary" /> Global Sizing Guide</span>
                 {showSizeChart ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
               </Button>

               {showSizeChart && (
                 <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="mt-6 space-y-4">
                    <Card className="overflow-hidden border-none shadow-2xl">
                       <div className="p-4 bg-[#2C3E2D] text-white flex justify-between items-center">
                          <p className="text-[10px] font-bold uppercase tracking-widest">Measurement Protocol</p>
                          <div className="flex gap-2">
                             <Button variant="secondary" size="icon" className="h-8 w-8 rounded-full" onClick={() => shareSizeChart('whatsapp')}><Share2 className="h-3 w-3" /></Button>
                             <Button variant="secondary" size="icon" className="h-8 w-8 rounded-full" onClick={() => shareSizeChart('pdf')}><Download className="h-3 w-3" /></Button>
                          </div>
                       </div>
                       <div ref={sizeChartRef} className="p-8 bg-white text-black font-sans">
                          <div className="text-center font-serif text-xl mb-6 font-black uppercase tracking-tighter">Rare Atelier Nepal</div>
                          <Table className="border border-black">
                             <TableHeader className="bg-black text-white hover:bg-black">
                                <TableRow>
                                  <TableHead className="text-white border-r border-white">Label</TableHead>
                                  <TableHead className="text-white">Chest (in)</TableHead>
                                  <TableHead className="text-white">Length (in)</TableHead>
                                </TableRow>
                             </TableHeader>
                             <TableBody>
                                {['S', 'M', 'L', 'XL', 'XXL'].map((s, i) => (
                                  <TableRow key={s} className={i % 2 === 0 ? 'bg-muted/10' : ''}>
                                    <TableCell className="font-bold border-r border-black">{s}</TableCell>
                                    <TableCell className="text-center">{34 + (i * 2)}"</TableCell>
                                    <TableCell className="text-center">{26 + (i * 0.5)}"</TableCell>
                                  </TableRow>
                                ))}
                             </TableBody>
                          </Table>
                       </div>
                    </Card>
                 </motion.div>
               )}
            </div>
          </TabsContent>

          <TabsContent value="category" className="mt-0 space-y-6 pb-6">
            <div className="flex gap-2">
              <Input placeholder="New Category Name" value={newValue} onChange={(e) => setNewValue(e.target.value)} className="h-11 rounded-xl" />
              <Button className="h-11 rounded-xl" onClick={() => catMutation.mutate({ name: newValue, slug: slugify(newValue) })}><Plus className="w-4 h-4" /></Button>
            </div>

            <div className="space-y-3 pb-6">
               {categories?.map(cat => {
                 const Icon = CATEGORY_ICONS[cat.slug] || CATEGORY_ICONS.DEFAULT;
                 const categoryHref = `/admin/products?category=${encodeURIComponent(cat.slug)}`;
                 const categoryPreviewSrc =
                   (cat as CategoryApi & {
                     coverImage?: string | null;
                     coverImageUrl?: string | null;
                     imageUrl?: string | null;
                   }).coverImage ??
                   (cat as CategoryApi & { coverImageUrl?: string | null }).coverImageUrl ??
                   (cat as CategoryApi & { imageUrl?: string | null }).imageUrl ??
                   undefined;
                 return (
                   <div key={cat.id} className="flex items-center justify-between p-4 rounded-2xl bg-white dark:bg-muted/10 border hover:shadow-md transition-all group">
                     <PreviewLinkCard
                       href={categoryHref}
                       followCursor
                       src={categoryPreviewSrc}
                       openDelay={80}
                       closeDelay={80}
                     >
                       <PreviewLinkCardTrigger asChild>
                         <a
                           href={categoryHref}
                           className="flex items-center gap-4 min-w-0 flex-1"
                         >
                           <div className="w-10 h-10 rounded-xl bg-primary/5 flex items-center justify-center text-primary group-hover:bg-primary group-hover:text-white transition-colors shrink-0">
                              <Icon className="w-5 h-5" />
                           </div>
                           <div className="min-w-0">
                              <p className="font-serif text-lg leading-none truncate">{cat.name}</p>
                              <p className="text-[10px] uppercase font-bold tracking-widest opacity-40 truncate">{cat.slug}</p>
                           </div>
                         </a>
                       </PreviewLinkCardTrigger>
                       <PreviewLinkCardContent className="w-[260px] rounded-xl border bg-popover p-0 shadow-xl">
                         <PreviewLinkCardImage
                           alt={`${cat.name} preview`}
                           className="h-[150px] w-[260px] object-cover"
                         />
                       </PreviewLinkCardContent>
                     </PreviewLinkCard>
                      <div className="flex items-center gap-2">
                         <Button variant="ghost" size="sm" className="rounded-full text-[10px] font-bold uppercase tracking-widest" onClick={() => setViewCategoryProducts(cat.slug)}>View</Button>
                         <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive opacity-0 group-hover:opacity-100 transition-opacity" onClick={() => { if(confirm("Confirm deletion?")) deleteCatMutation.mutate(cat.id); }}>
                           <Trash2 className="w-4 h-4" />
                         </Button>
                      </div>
                   </div>
                 );
               })}
            </div>

            <Dialog open={!!viewCategoryProducts} onOpenChange={(o) => { if(!o) setViewCategoryProducts(null); }}>
               <DialogContent className="max-w-3xl rounded-3xl p-0 overflow-hidden border-none shadow-2xl">
                  <div className="bg-[#2C3E2D] p-6 text-white flex justify-between items-center">
                     <div>
                       <DialogTitle className="text-xl font-serif">Inventory: {viewCategoryProducts}</DialogTitle>
                       <p className="text-xs text-white/60">Comprehensive spreadsheet of all assigned products.</p>
                     </div>
                     <Button variant="secondary" size="sm" className="rounded-full gap-2" onClick={exportCategoryToExcel}>
                        <FileSpreadsheet className="w-4 h-4" /> Export Excel
                     </Button>
                  </div>
                  <div className="p-6 max-h-[60vh] overflow-y-auto bg-white dark:bg-card">
                     {productsLoading ? <div className="flex justify-center p-8"><Loader2 className="animate-spin" /></div> : (
                        <Table>
                           <TableHeader>
                              <TableRow className="bg-muted hover:bg-muted">
                                 <TableHead className="font-bold text-black uppercase text-[10px]">Product Name</TableHead>
                                 <TableHead className="font-bold text-black uppercase text-[10px]">Price (NPR)</TableHead>
                                 <TableHead className="font-bold text-black uppercase text-[10px]">Stock</TableHead>
                              </TableRow>
                           </TableHeader>
                           <TableBody>
                              {catProducts?.map(p => (
                                <TableRow key={p.id}>
                                   <TableCell className="font-medium">{p.name}</TableCell>
                                   <TableCell>{formatPrice(p.price)}</TableCell>
                                   <TableCell>
                                      <Badge variant={p.stock > 10 ? "secondary" : "destructive"} className="rounded-md">
                                        {p.stock} units
                                      </Badge>
                                   </TableCell>
                                </TableRow>
                              ))}
                           </TableBody>
                        </Table>
                     )}
                  </div>
               </DialogContent>
            </Dialog>
          </TabsContent>
        </Tabs>
      </div>
      
      <div className="shrink-0 border-t border-[#DDE7DB] bg-white/85 p-5 backdrop-blur dark:border-border dark:bg-card/80">
         <Button variant="outline" className="w-full rounded-2xl border-[#CFE0CD] bg-gradient-to-r from-white to-[#F2F7F2] font-semibold hover:-translate-y-0.5 hover:shadow-[0_12px_22px_rgba(34,63,41,0.16)] transition-all duration-300" onClick={onClose}>Close Manager</Button>
      </div>
    </div>
  );
}
