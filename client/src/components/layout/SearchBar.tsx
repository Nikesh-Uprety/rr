import { useState, useEffect, useRef } from "react";
import { Search, X, Loader2, ArrowRight } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Link, useLocation } from "wouter";
import { fetchProducts, type ProductApi } from "@/lib/api";
import { formatPrice } from "@/lib/format";
import { useClickAway } from "react-use";

export default function SearchBar() {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState<ProductApi[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const [_, setLocation] = useLocation();
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useClickAway(containerRef, () => {
    if (isOpen && !query) {
      setIsOpen(false);
    }
  });

  useEffect(() => {
    const delayDebounceFn = setTimeout(async () => {
      if (query.trim().length > 1) {
        setIsLoading(true);
        try {
          const results = await fetchProducts({ search: query, limit: 5 });
          setSuggestions(results);
        } catch (error) {
          console.error("Search error:", error);
        } finally {
          setIsLoading(false);
        }
      } else {
        setSuggestions([]);
      }
    }, 300);

    return () => clearTimeout(delayDebounceFn);
  }, [query]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) {
      setLocation(`/products?search=${encodeURIComponent(query.trim())}`);
      setIsOpen(false);
      setQuery("");
    }
  };

  const toggleSearch = () => {
    setIsOpen(!isOpen);
    if (!isOpen) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  };

  return (
    <div 
      ref={containerRef} 
      className="relative flex items-center"
      onMouseEnter={() => {
        if (!isOpen) setIsOpen(true);
      }}
      onMouseLeave={() => {
        if (isOpen && !query && !isFocused) setIsOpen(false);
      }}
    >
      <motion.div
        initial={false}
        animate={{
          width: isOpen ? (window.innerWidth < 640 ? "calc(100vw - 120px)" : "300px") : "40px",
          backgroundColor: isOpen ? "rgba(var(--background), 0.8)" : "transparent",
        }}
        className={`flex items-center h-10 rounded-full overflow-hidden transition-colors ${
          isOpen ? "bg-gray-50 dark:bg-muted/50 border border-gray-100 dark:border-white/10 px-3 shadow-inner" : ""
        }`}
      >
        <button
          onClick={toggleSearch}
          className="flex-shrink-0 w-10 h-10 flex items-center justify-center text-muted-foreground hover:text-primary transition-colors"
          aria-label="Toggle search"
        >
          <Search className="w-5 h-5" />
        </button>

        <form onSubmit={handleSearch} className="flex-1 flex items-center overflow-hidden">
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setIsFocused(false)}
            placeholder="Search products..."
            className="w-full bg-transparent border-none focus:ring-0 text-sm placeholder:text-muted-foreground/60 px-2"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery("")}
              className="p-1 text-muted-foreground hover:text-primary"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </form>
      </motion.div>

      <AnimatePresence>
        {isOpen && (query.trim().length > 1 || isLoading) && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.98 }}
            className="absolute top-full right-0 mt-3 w-[300px] sm:w-[400px] bg-white dark:bg-neutral-950 rounded-2xl shadow-2xl border border-gray-100 dark:border-white/10 overflow-hidden z-[100]"
          >
            <div className="p-2">
              {isLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                </div>
              ) : suggestions.length > 0 ? (
                <div className="space-y-1">
                  <div className="px-3 py-2 text-[10px] uppercase tracking-widest font-bold text-muted-foreground opacity-60">
                    Suggestions
                  </div>
                  {suggestions.map((product) => (
                    <Link
                      key={product.id}
                      href={`/product/${product.id}`}
                      onClick={() => {
                        setIsOpen(false);
                        setQuery("");
                      }}
                      className="flex items-center gap-3 p-2 rounded-xl hover:bg-gray-50 dark:hover:bg-white/5 transition-colors group"
                    >
                      <div className="w-12 h-12 rounded-lg overflow-hidden bg-gray-100 flex-shrink-0">
                        <img
                          src={product.imageUrl || "/placeholder.png"}
                          alt={product.name}
                          className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                        />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className="text-sm font-bold truncate tracking-tight">{product.name}</h4>
                        <p className="text-[10px] text-muted-foreground uppercase tracking-wider">
                          {product.category || "Uncategorized"}
                        </p>
                      </div>
                      <div className="text-xs font-medium text-muted-foreground">
                        {formatPrice(product.price)}
                      </div>
                    </Link>
                  ))}
                  <Link
                    href={`/products?search=${encodeURIComponent(query)}`}
                    onClick={() => {
                      setIsOpen(false);
                      setQuery("");
                    }}
                    className="flex items-center justify-between px-3 py-3 mt-1 hover:bg-primary/5 rounded-xl transition-colors group"
                  >
                    <span className="text-xs font-bold uppercase tracking-widest text-primary">View all results</span>
                    <ArrowRight className="w-4 h-4 text-primary group-hover:translate-x-1 transition-transform" />
                  </Link>
                </div>
              ) : (
                <div className="py-8 text-center text-sm text-muted-foreground">
                  No products found for "{query}"
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
