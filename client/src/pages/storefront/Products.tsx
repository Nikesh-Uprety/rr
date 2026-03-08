import { useState, useMemo } from "react";
import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Search, ExternalLink } from "lucide-react";
import { fetchProducts, fetchCategories, type ProductApi } from "@/lib/api";
import { formatPrice } from "@/lib/format";

function ProductsSkeleton() {
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-8">
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="space-y-3">
          <div className="aspect-[3/4] bg-neutral-800 dark:bg-neutral-200 rounded-sm animate-pulse" />
          <div className="h-3 w-3/4 bg-neutral-800 dark:bg-neutral-200 rounded animate-pulse" />
          <div className="h-3 w-1/2 bg-neutral-800 dark:bg-neutral-200 rounded animate-pulse" />
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

  const { data: categories = [] } = useQuery({
    queryKey: ["categories"],
    queryFn: fetchCategories,
  });

  const filters = useMemo(
    () => ({
      category: category === "all" ? undefined : category,
      search: search || undefined,
      page: 1,
    }),
    [category, search],
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
    return products.filter((p) => {
      const matchesSearch =
        p.name.toLowerCase().includes(search.toLowerCase()) ||
        (p.category ?? "").toLowerCase().includes(search.toLowerCase());
      const matchesCategory =
        category === "all" || (p.category ?? "") === category;
      return matchesSearch && matchesCategory;
    });
  }, [products, search, category]);

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
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-12 gap-4">
        <div>
          <h1 className="text-4xl font-black uppercase tracking-tighter mb-2">Collection</h1>
          <p className="text-muted-foreground uppercase text-[10px] tracking-widest font-bold">Explore our latest drops</p>
        </div>
        
        <div className="flex items-center gap-3 w-full md:w-auto">
          <div className="relative flex-1 md:w-80 group">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground group-focus-within:text-foreground transition-colors" />
            <input 
              placeholder="Search products..." 
              className="w-full pl-11 pr-4 h-12 bg-gray-50 dark:bg-muted/30 border border-gray-200 dark:border-border rounded-xl text-sm focus:bg-white dark:focus:bg-background focus:ring-2 focus:ring-black dark:focus:ring-white transition-all placeholder:text-muted-foreground/60 dark:placeholder:text-muted-foreground"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>
      </div>

      <div className="flex gap-8">
        <aside className="hidden lg:block w-48 space-y-10">
          <div>
            <h3 className="text-[10px] font-bold uppercase tracking-[0.2em] mb-6">
              Categories
            </h3>
            <div className="space-y-4">
              <button
                onClick={() => setCategory("all")}
                className={`block text-xs uppercase tracking-widest transition-colors w-full text-left ${
                  category === "all"
                    ? "font-bold text-foreground"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                All
              </button>
              {categories.map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => setCategory(cat.slug)}
                  className={`block text-xs uppercase tracking-widest transition-colors w-full text-left ${
                    category === cat.slug
                      ? "font-bold text-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {cat.name}
                </button>
              ))}
            </div>
          </div>
        </aside>

        <div className="flex-1 bg-neutral-950 text-white dark:bg-white dark:text-neutral-950 rounded-xl p-8 md:p-10 border border-neutral-800/50 dark:border-neutral-200 min-h-[400px]">
          {isLoading ? (
            <ProductsSkeleton />
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
              {Array.from(productsByCategory.entries()).map(([catSlug, prods]) => (
                <div key={catSlug ?? "other"} className="mb-16 last:mb-0">
                  <h2 className="text-sm font-bold uppercase tracking-[0.3em] text-neutral-400 dark:text-neutral-500 mb-6 pb-3 border-b border-neutral-800 dark:border-neutral-200">
                    {getCategoryDisplayName(catSlug)}
                  </h2>
                  <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-8">
                    {prods.map((product) => (
                      <Link
                        key={product.id}
                        href={`/product/${product.id}`}
                        className="group block"
                      >
                        <div className="aspect-[3/4] overflow-hidden bg-neutral-900 dark:bg-neutral-100 mb-4 relative rounded-sm">
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
                          <h3 className="mb-2 font-semibold text-base text-white dark:text-neutral-900 truncate group-hover:text-neutral-300 dark:group-hover:text-neutral-600 transition-colors">
                            {product.name}
                          </h3>
                          <p className="text-neutral-400 dark:text-neutral-500 text-[10px] font-medium uppercase tracking-wider">
                            {formatPrice(product.price)}
                          </p>
                        </div>
                      </Link>
                    ))}
                  </div>
                </div>
              ))}

              {filteredProducts.length === 0 && !isLoading && !isError && (
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