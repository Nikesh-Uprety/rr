import { useState, useMemo } from "react";
import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Search, ExternalLink, SlidersHorizontal, ChevronDown, ChevronUp } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { fetchProducts, fetchCategories, type ProductApi } from "@/lib/api";
import { formatPrice } from "@/lib/format";
import { BrandedLoader } from "@/components/ui/BrandedLoader";

function ProductsSkeleton() {
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-8">
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="space-y-3">
          <div className="aspect-[3/4] bg-neutral-800 rounded-sm animate-pulse" />
          <div className="h-3 w-3/4 bg-neutral-800 rounded animate-pulse" />
          <div className="h-3 w-1/2 bg-neutral-800 rounded animate-pulse" />
        </div>
      ))}
    </div>
  );
}

export default function Products() {
  const searchParams = new URLSearchParams(window.location.search);
  const initialCategory = searchParams.get("category");

  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<string>(initialCategory || "all");
  const [minPrice, setMinPrice] = useState<number | "">("");
  const [maxPrice, setMaxPrice] = useState<number | "">("");
  const [sortBy, setSortBy] = useState("newest");
  const [isFiltersOpen, setIsFiltersOpen] = useState(false);

  const { data: categories = [] } = useQuery({
    queryKey: ["categories"],
    queryFn: fetchCategories,
  });

  const filters = useMemo(
    () => ({
      category: category === "all" ? undefined : category,
      search: search || undefined,
      minPrice: minPrice !== "" ? Number(minPrice) : undefined,
      maxPrice: maxPrice !== "" ? Number(maxPrice) : undefined,
      sortBy: sortBy,
      page: 1,
    }),
    [category, search, minPrice, maxPrice, sortBy],
  );

  const {
    data: products,
    isLoading,
    isError,
    refetch,
  } = useQuery<ProductApi[]>({
    queryKey: ["products", filters],
    queryFn: () => fetchProducts(filters),
  });

  const filteredProducts = useMemo(() => {
    if (!products) return [];
    let filtered = products.filter((p) => {
      const matchesSearch =
        p.name.toLowerCase().includes(search.toLowerCase()) ||
        (p.category ?? "").toLowerCase().includes(search.toLowerCase());
      const matchesCategory =
        category === "all" || (p.category ?? "") === category;
      
      const price = Number(p.price);
      const matchesMinPrice = minPrice === "" || price >= minPrice;
      const matchesMaxPrice = maxPrice === "" || price <= maxPrice;

      return matchesSearch && matchesCategory && matchesMinPrice && matchesMaxPrice;
    });

    // Apply Sorting
    switch (sortBy) {
      case "price-low":
        filtered.sort((a, b) => Number(a.price) - Number(b.price));
        break;
      case "price-high":
        filtered.sort((a, b) => Number(b.price) - Number(a.price));
        break;
      case "newest":
      default:
        // Assuming higher ID means newer or we just keep default order
        filtered.sort((a, b) => Number(b.id) - Number(a.id));
        break;
    }

    return filtered;
  }, [products, search, category, minPrice, maxPrice, sortBy]);

  const productsByCategory = useMemo(() => {
    const map = new Map<string | null, ProductApi[]>();
    for (const p of filteredProducts) {
      const cat = p.category ?? "uncategorized";
      if (!map.has(cat)) map.set(cat, []);
      map.get(cat)!.push(p);
    }
    return map;
  }, [filteredProducts]);

  const getCategoryDisplayName = (slug: string | null) => {
    if (!slug || slug === "uncategorized") return "Other";
    const c = categories.find((x) => x.slug === slug);
    return c?.name ?? slug.replace(/-/g, " ").replace(/\b\w/g, (w) => w.toUpperCase());
  };

  return (
    <div className="container mx-auto px-4 py-20 mt-20">
      <div className="text-center mb-16">
        <h1 className="text-4xl font-black uppercase tracking-tight mb-2">All Products</h1>
      </div>

      <div className="flex flex-col lg:flex-row gap-8 lg:gap-12">
        {/* Mobile Filter Toggle */}
        <button
          onClick={() => setIsFiltersOpen(!isFiltersOpen)}
          className="lg:hidden flex items-center justify-between w-full px-6 py-4 bg-muted/30 border border-border rounded-xl mb-4 text-sm font-bold uppercase tracking-widest"
        >
          <div className="flex items-center gap-2">
            <SlidersHorizontal className="w-4 h-4" />
            <span>Filters</span>
          </div>
          {isFiltersOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>

        {/* Glassmorphism Sidebar */}
        <aside className={`${isFiltersOpen ? "block" : "hidden"} lg:block w-full lg:w-64`}>
          <div className="rounded-3xl p-6 lg:p-8 backdrop-blur-xl bg-black/[0.03] dark:bg-white/[0.05] border border-black/[0.06] dark:border-white/[0.08] shadow-[0_8px_32px_rgba(0,0,0,0.04)] dark:shadow-[0_8px_32px_rgba(0,0,0,0.3)] sticky top-28 space-y-8">
            <h3 
              style={{ fontFamily: 'Roboto, sans-serif' }}
              className="text-xs font-bold uppercase tracking-[0.2em] pb-3 border-b border-black/[0.06] dark:border-white/[0.08] text-zinc-900 dark:text-zinc-100"
            >
              Filter By:
            </h3>
            
            {/* Price Filter */}
            <div>
              <h4 
                style={{ fontFamily: 'Roboto, sans-serif', fontSize: '12px' }}
                className="font-bold uppercase tracking-widest text-zinc-900 dark:text-zinc-100 mb-4"
              >
                Price
              </h4>
              <div className="flex items-center gap-2">
                <div className="flex-1">
                  <p 
                    style={{ fontFamily: 'Roboto, sans-serif' }}
                    className="text-[9px] uppercase font-bold mb-1 text-zinc-400"
                  >
                    From
                  </p>
                  <input
                    type="number"
                    placeholder="0"
                    style={{ fontFamily: 'Roboto, sans-serif' }}
                    className="w-full h-10 px-3 bg-white/50 dark:bg-white/[0.04] border border-black/[0.06] dark:border-white/[0.08] rounded-lg text-xs text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 backdrop-blur-sm focus:ring-1 focus:ring-black dark:focus:ring-white transition-all"
                    value={minPrice}
                    onChange={(e) => setMinPrice(e.target.value === "" ? "" : Number(e.target.value))}
                  />
                </div>
                <span className="mt-4 text-zinc-300 dark:text-zinc-600">—</span>
                <div className="flex-1">
                  <p 
                    style={{ fontFamily: 'Roboto, sans-serif' }}
                    className="text-[9px] uppercase font-bold mb-1 text-zinc-400"
                  >
                    To
                  </p>
                  <input
                    type="number"
                    placeholder="Max"
                    style={{ fontFamily: 'Roboto, sans-serif' }}
                    className="w-full h-10 px-3 bg-white/50 dark:bg-white/[0.04] border border-black/[0.06] dark:border-white/[0.08] rounded-lg text-xs text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 backdrop-blur-sm focus:ring-1 focus:ring-black dark:focus:ring-white transition-all"
                    value={maxPrice}
                    onChange={(e) => setMaxPrice(e.target.value === "" ? "" : Number(e.target.value))}
                  />
                </div>
              </div>
            </div>

            {/* Category Filter */}
            <div>
              <h4 
                style={{ fontFamily: 'Roboto, sans-serif', fontSize: '12px' }}
                className="font-bold uppercase tracking-widest text-zinc-900 dark:text-zinc-100 mb-4"
              >
                Categories
              </h4>
              <div className="space-y-3">
                {categories.map((cat) => (
                  <button
                    key={cat.id}
                    onClick={() => setCategory(cat.slug)}
                    style={{ fontFamily: 'Roboto, sans-serif' }}
                    className={`block text-xs uppercase tracking-widest transition-all w-full text-left py-1 ${
                      category === cat.slug
                        ? "font-bold text-zinc-900 dark:text-zinc-100 underline underline-offset-4"
                        : "text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100"
                    }`}
                  >
                    {cat.name}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </aside>

        {/* Glassmorphism Products Container */}
        <div className="flex-1 rounded-3xl p-6 md:p-10 backdrop-blur-xl bg-neutral-950/95 dark:bg-neutral-950/95 border border-white/[0.06] shadow-[0_8px_32px_rgba(0,0,0,0.2)] dark:shadow-[0_8px_32px_rgba(0,0,0,0.4)] text-white min-h-[400px]">
          <div className="flex justify-between items-center mb-8 pb-4 border-b border-white/[0.06]">
            <p 
              style={{ fontFamily: 'Roboto, sans-serif' }}
              className="text-[10px] font-bold uppercase tracking-widest text-neutral-400"
            >
              Showing {filteredProducts.length} results
            </p>
            
            <div className="flex items-center gap-3">
              <span 
                style={{ fontFamily: 'Roboto, sans-serif' }}
                className="text-[10px] font-bold uppercase tracking-widest text-neutral-400"
              >
                Sort By
              </span>
              <select 
                style={{ fontFamily: 'Roboto, sans-serif' }}
                className="h-10 pl-4 pr-10 bg-neutral-900 border border-neutral-800 rounded text-[10px] font-bold uppercase tracking-widest focus:ring-1 focus:ring-white appearance-none cursor-pointer text-white"
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
              >
                <option value="newest">Newest</option>
                <option value="price-low">Price: Low to High</option>
                <option value="price-high">Price: High to Low</option>
              </select>
            </div>
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center min-h-[400px] w-full col-span-full">
              <BrandedLoader />
            </div>
          ) : isError ? (
            <div className="py-20 text-center space-y-4">
              <p className="uppercase text-[10px] tracking-widest font-bold text-neutral-400 dark:text-neutral-500">
                Failed to load products. Try again.
              </p>
              <button
                onClick={() => refetch()}
                className="text-[10px] uppercase tracking-widest border border-neutral-600 dark:border-neutral-300 px-4 py-2 rounded-lg hover:bg-neutral-800 dark:hover:bg-neutral-100 transition-colors"
              >
                Retry
              </button>
            </div>
          ) : (
            <>
              {filteredProducts.length > 0 ? (
                <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-8">
                  {filteredProducts.map((product) => (
                    <Link
                      key={product.id}
                      href={`/product/${product.id}`}
                      className="group block"
                    >
                      <div className="aspect-[3/4] overflow-hidden bg-white/[0.04] mb-4 relative rounded-xl border border-white/[0.06] transition-all duration-300 group-hover:border-white/[0.15] group-hover:shadow-[0_8px_24px_rgba(255,255,255,0.06)]">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            window.open(`/product/${product.id}`, "_blank");
                          }}
                          className="absolute top-3 right-3 z-10 flex h-7 w-7 items-center justify-center rounded-full bg-white text-neutral-900 shadow-sm opacity-0 group-hover:opacity-100 transition-opacity"
                          aria-label="Open product in new tab"
                        >
                          <ExternalLink className="h-3.5 w-3.5" />
                        </button>
                        {product.stock === 0 && (
                          <div className="absolute top-3 left-3 z-10 bg-black/80 dark:bg-neutral-800/90 text-white text-[10px] font-bold uppercase tracking-widest px-3 py-1.5 rounded">
                            Out of Stock
                          </div>
                        )}
                        <img
                          src={product.imageUrl ?? ""}
                          alt={product.name}
                          className="object-cover w-full h-full group-hover:scale-105 transition-transform duration-700"
                        />
                      </div>
                      <div className="space-y-1">
                        <h3 
                          className="mb-1 truncate transition-colors group-hover:opacity-80"
                          style={{
                            fontFamily: 'Roboto, ui-sans-serif, system-ui, sans-serif',
                            fontWeight: 700,
                            fontSize: '18px',
                            lineHeight: '27px',
                            color: 'white',
                            textShadow: '0 0 15px rgba(255, 255, 255, 0.3)'
                          }}
                        >
                          {product.name}
                        </h3>
                        <p className="text-neutral-400 text-sm font-bold uppercase tracking-wider">
                          {formatPrice(product.price)}
                        </p>
                      </div>
                    </Link>
                  ))}
                </div>
              ) : (
                <div className="py-20 text-center uppercase text-[10px] tracking-widest font-bold text-neutral-400 dark:text-neutral-500">
                  No products found.
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}