import { useState, useMemo } from "react";
import { MOCK_PRODUCTS } from "@/lib/mockData";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, Plus, Filter, MoreHorizontal } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";

export default function AdminProducts() {
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");

  const filteredProducts = useMemo(() => {
    return MOCK_PRODUCTS.filter(p => {
      const matchesSearch = p.name.toLowerCase().includes(search.toLowerCase()) || 
                           p.sku.toLowerCase().includes(search.toLowerCase());
      const matchesCategory = categoryFilter === "all" || p.category.toLowerCase() === categoryFilter.toLowerCase();
      
      return matchesSearch && matchesCategory;
    });
  }, [search, categoryFilter]);

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-serif font-medium text-[#2C3E2D] dark:text-foreground">Products</h1>
          <p className="text-muted-foreground mt-1">{filteredProducts.length} products • All</p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" className="bg-white dark:bg-card border-[#E5E5E0] dark:border-border text-[#2C3E2D] dark:text-foreground">
            Export
          </Button>
          <Button className="bg-[#2C3E2D] hover:bg-[#1A251B] text-white dark:bg-primary dark:text-primary-foreground">
            <Plus className="w-4 h-4 mr-2" /> Add Product
          </Button>
        </div>
      </div>

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
          <Button 
            variant={categoryFilter === "all" ? "default" : "outline"}
            className={`rounded-full ${categoryFilter === "all" ? "bg-[#2C3E2D] text-white dark:bg-primary" : "bg-white dark:bg-card border-[#E5E5E0] dark:border-border"}`}
            onClick={() => setCategoryFilter("all")}
          >
            All
          </Button>
          <Button 
            variant={categoryFilter === "tops" ? "default" : "ghost"}
            className={`rounded-full ${categoryFilter === "tops" ? "bg-[#2C3E2D] text-white dark:bg-primary" : ""}`}
            onClick={() => setCategoryFilter("tops")}
          >
            Tops
          </Button>
          <Button 
            variant={categoryFilter === "bottoms" ? "default" : "ghost"}
            className={`rounded-full ${categoryFilter === "bottoms" ? "bg-[#2C3E2D] text-white dark:bg-primary" : ""}`}
            onClick={() => setCategoryFilter("bottoms")}
          >
            Bottoms
          </Button>
          <Button 
            variant={categoryFilter === "accessories" ? "default" : "ghost"}
            className={`rounded-full ${categoryFilter === "accessories" ? "bg-[#2C3E2D] text-white dark:bg-primary" : ""}`}
            onClick={() => setCategoryFilter("accessories")}
          >
            Accessories
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {filteredProducts.map((product) => (
          <div key={product.id} className="bg-white dark:bg-card rounded-xl border border-[#E5E5E0] dark:border-border overflow-hidden hover:shadow-md transition-shadow group">
            <div className="aspect-[4/3] bg-muted relative">
              <img 
                src={product.images[0]} 
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
                    <Button variant="ghost" size="icon" className="h-6 w-6 -mr-2 -mt-2 text-muted-foreground">
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem>Edit</DropdownMenuItem>
                    <DropdownMenuItem>Duplicate</DropdownMenuItem>
                    <DropdownMenuItem className="text-destructive">Delete</DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
              <h3 className="font-serif font-medium text-lg mb-1 truncate">{product.name}</h3>
              <p className="text-sm text-muted-foreground mb-4 truncate">
                {product.variants.map(v => v.color).join(", ")} • {product.sku}
              </p>
              
              <div className="flex items-center justify-between mt-auto">
                <span className="font-medium">${product.price.toFixed(2)}</span>
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
    </div>
  );
}