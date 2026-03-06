import { useState } from "react";
import { useLocation } from "wouter";
import { Link } from "wouter";
import { MOCK_PRODUCTS } from "@/lib/mockData";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, SlidersHorizontal } from "lucide-react";

export default function Products() {
  const [location] = useLocation();
  const searchParams = new URLSearchParams(window.location.search);
  const initialCategory = searchParams.get('category');
  
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<string>(initialCategory || "all");
  
  const filteredProducts = MOCK_PRODUCTS.filter(p => {
    const matchesSearch = p.name.toLowerCase().includes(search.toLowerCase()) || 
                         p.sku.toLowerCase().includes(search.toLowerCase());
    const matchesCategory = category === "all" || p.category.toLowerCase() === category.toLowerCase();
    
    return matchesSearch && matchesCategory;
  });

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-8 gap-4">
        <div>
          <h1 className="text-4xl font-serif font-medium tracking-tight mb-2">Collection</h1>
          <p className="text-muted-foreground">Discover our latest arrivals and timeless classics.</p>
        </div>
        
        <div className="flex items-center gap-3 w-full md:w-auto">
          <div className="relative flex-1 md:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input 
              placeholder="Search products..." 
              className="pl-9 bg-muted/50 border-transparent focus-visible:bg-background"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              data-testid="input-search-products"
            />
          </div>
          <Button variant="outline" size="icon" className="shrink-0" data-testid="button-filters">
            <SlidersHorizontal className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="flex gap-8">
        {/* Sidebar Filters - Desktop only for now */}
        <aside className="hidden lg:block w-64 space-y-8">
          <div>
            <h3 className="font-medium mb-4">Categories</h3>
            <div className="space-y-2">
              {['All', 'Tops', 'Bottoms', 'Accessories', 'Footwear'].map(cat => (
                <label key={cat} className="flex items-center gap-2 cursor-pointer group">
                  <input 
                    type="radio" 
                    name="category" 
                    value={cat.toLowerCase()}
                    checked={category === cat.toLowerCase()}
                    onChange={(e) => setCategory(e.target.value)}
                    className="accent-primary"
                    data-testid={`radio-category-${cat.toLowerCase()}`}
                  />
                  <span className="text-sm group-hover:text-primary transition-colors">{cat}</span>
                </label>
              ))}
            </div>
          </div>
        </aside>

        {/* Product Grid */}
        <div className="flex-1">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {filteredProducts.map(product => (
              <Link key={product.id} href={`/product/${product.id}`} className="group block" data-testid={`link-product-${product.id}`}>
                <div className="aspect-[3/4] overflow-hidden bg-muted mb-4 relative rounded-md">
                  <img 
                    src={product.images[0]} 
                    alt={product.name}
                    className="object-cover w-full h-full group-hover:scale-105 transition-transform duration-700"
                  />
                  {product.stock < 10 && (
                    <span className="absolute top-2 left-2 bg-background/90 text-foreground text-[10px] uppercase font-bold tracking-wider px-2 py-1 rounded-sm backdrop-blur-sm">
                      Low Stock
                    </span>
                  )}
                </div>
                <div className="space-y-1">
                  <h3 className="font-medium text-sm">{product.name}</h3>
                  <p className="text-muted-foreground text-sm">${product.price.toFixed(2)}</p>
                </div>
              </Link>
            ))}
          </div>
          
          {filteredProducts.length === 0 && (
            <div className="py-20 text-center text-muted-foreground">
              No products found matching your criteria.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}