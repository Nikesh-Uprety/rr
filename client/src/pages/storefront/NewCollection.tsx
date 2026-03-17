import { useState, useEffect, useRef, useMemo } from "react";
import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { fetchProducts, fetchCategories, type ProductApi } from "@/lib/api";
import { ArrowUpRight } from "lucide-react";
import { BrandedLoader } from "@/components/ui/BrandedLoader";
import { motion } from "framer-motion";
import { apiRequest } from "@/lib/queryClient";

type SiteAsset = {
  id: string;
  imageUrl: string | null;
  videoUrl: string | null;
  altText: string | null;
  sortOrder: number | null;
  active: boolean | null;
};

// Scroll-reveal hook using IntersectionObserver
function useScrollReveal() {
  const ref = useRef<HTMLDivElement>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.1, rootMargin: "0px 0px -40px 0px" }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return { ref, isVisible };
}

// Masonry aspect ratio patterns
const ASPECT_PATTERNS = [
  "aspect-[3/4]",
  "aspect-[4/5]",
  "aspect-square",
  "aspect-[3/4]",
  "aspect-[4/5]",
  "aspect-[3/4]",
  "aspect-square",
  "aspect-[4/5]",
];

function getAspect(index: number) {
  return ASPECT_PATTERNS[index % ASPECT_PATTERNS.length];
}

function RevealImage({
  product,
  index,
}: {
  product: ProductApi;
  index: number;
}) {
  const { ref, isVisible } = useScrollReveal();
  const aspect = getAspect(index);
  const [isHovered, setIsHovered] = useState(false);

  const gallery = useMemo(() => {
    try {
      return product.galleryUrls ? JSON.parse(product.galleryUrls) : [];
    } catch (e) {
      return [];
    }
  }, [product.galleryUrls]);

  const secondaryImage = gallery.length > 1 ? gallery[1] : null;

  const salePercentage = useMemo(() => {
    if (!product.originalPrice || Number(product.originalPrice) <= product.price) return null;
    const orig = Number(product.originalPrice);
    const curr = product.price;
    return Math.round(((orig - curr) / orig) * 100);
  }, [product.originalPrice, product.price]);

  return (
    <div
      ref={ref}
      className={`transition-all duration-700 ease-out ${
        isVisible
          ? "opacity-100 translate-y-0"
          : "opacity-0 translate-y-8"
      }`}
      style={{ transitionDelay: `${(index % 4) * 80}ms` }}
    >
      <Link 
        href={`/product/${product.id}`} 
        className="group block relative overflow-hidden rounded-sm"
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        <div className={`${aspect} overflow-hidden bg-neutral-100 dark:bg-neutral-800 relative`}>
          <img
            src={product.imageUrl ?? ""}
            alt={product.name}
            className={`w-full h-full object-cover transition-all duration-1000 ease-out ${
              isHovered && secondaryImage ? "opacity-0 scale-110" : "opacity-100 scale-100"
            }`}
          />
          
          {secondaryImage && (
            <img
              src={secondaryImage}
              alt={`${product.name} alternate view`}
              className={`absolute inset-0 w-full h-full object-cover transition-all duration-1000 ease-out ${
                isHovered ? "opacity-100 scale-110" : "opacity-0 scale-100"
              }`}
            />
          )}

          {salePercentage && (
            <div className="absolute top-3 left-3 px-3 py-1.5 bg-red-600 border border-red-500 rounded-sm z-10 shadow-lg shadow-red-900/40">
              <span className="text-xs font-black tracking-widest text-white uppercase italic">
                -{salePercentage}% OFF
              </span>
            </div>
          )}

          <div className={`absolute inset-0 bg-gradient-to-t from-black/90 via-black/30 to-transparent w-full h-full transition-all duration-700 ${isHovered ? "opacity-100" : "opacity-0"}`}>
            <div className="absolute bottom-0 left-0 right-0 p-8 translate-y-4 group-hover:translate-y-0 transition-transform duration-500">
                <div className="flex flex-col gap-2">
                    <span className="text-xs uppercase tracking-[0.4em] text-white/90 font-bold drop-shadow-md">View Collection</span>
                    <h3 className="text-xl font-bold text-white tracking-tight leading-tight drop-shadow-lg">{product.name}</h3>
                </div>
            </div>
            
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/95 backdrop-blur-sm flex items-center justify-center opacity-0 group-hover:opacity-100 scale-75 group-hover:scale-100 transition-all duration-500 shadow-xl">
              <ArrowUpRight className="w-4 h-4 text-black" />
            </div>
          </div>
        </div>
      </Link>
    </div>
  );
}

function GallerySkeleton() {
  return (
    <div className="columns-2 md:columns-3 xl:columns-4 gap-4 space-y-4">
      {Array.from({ length: 12 }).map((_, i) => (
        <div
          key={i}
          className={`${getAspect(i)} bg-neutral-200 dark:bg-neutral-800 rounded-sm animate-pulse break-inside-avoid`}
        />
      ))}
    </div>
  );
}

export default function NewCollection() {
  const { data: products, isLoading } = useQuery<ProductApi[]>({
    queryKey: ["products", "all-collection"],
    queryFn: () => fetchProducts(),
  });

  const { data: bannerAssets = [] } = useQuery<SiteAsset[]>({
    queryKey: ["site-assets", "collection_page"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/site-assets/collection_page");
      const json = await res.json();
      return json.data ?? [];
    },
  });

  const { data: categories = [] } = useQuery({
    queryKey: ["categories"],
    queryFn: fetchCategories,
  });

  const sortedProducts = useMemo(() => {
    if (!products) return [];
    return [...products]
      .filter((p) => !!p.imageUrl)
      .sort((a, b) => {
        const rankA = a.ranking ?? 999;
        const rankB = b.ranking ?? 999;
        if (rankA !== rankB) return rankA - rankB;
        return a.name.localeCompare(b.name);
      });
  }, [products]);

  const bannerUrl = useMemo(() => {
    const first = bannerAssets?.find((a) => !!a?.imageUrl)?.imageUrl ?? undefined;
    return first || "/images/collection-banner.png";
  }, [bannerAssets]);

  return (
    <div className="flex flex-col min-h-screen pt-20">
      {/* Hero Banner — Full-bleed background image + Text */}
      <section className="relative w-full overflow-hidden bg-neutral-950">
        <div className="relative w-full min-h-[46vh] md:min-h-[62vh] lg:min-h-[70vh]">
          <img
            src={bannerUrl}
            alt="Collection banner"
            className="absolute inset-0 w-full h-full object-cover object-top"
            loading="eager"
            fetchPriority="high"
          />

          {/* Dark overlays for legibility (dark mode only) */}
          <div className="absolute inset-0 hidden dark:block bg-black/35" />
          <div className="absolute inset-0 hidden dark:block bg-gradient-to-b from-black/55 via-black/25 to-black/60" />
          <div
            className="absolute inset-0 hidden dark:block pointer-events-none"
            style={{
              background:
                "radial-gradient(ellipse at center, transparent 40%, rgba(0,0,0,0.55) 100%)",
            }}
          />

          <div className="relative z-10 container mx-auto px-4 md:px-6 h-full flex items-center">
            <div className="w-full flex flex-col items-center text-center py-16 md:py-24">
              <motion.p
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 0.85, y: 0 }}
                transition={{ duration: 0.7, delay: 0.15 }}
                className="text-[10px] md:text-xs uppercase tracking-[0.55em] text-white/90 font-bold mb-4 md:mb-6 drop-shadow-[0_10px_25px_rgba(0,0,0,0.45)] dark:drop-shadow-[0_10px_25px_rgba(0,0,0,0.55)]"
              >
                Curated Pieces, Captured in Detail
              </motion.p>

              <motion.h1
                initial={{ opacity: 0, y: 22 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 1, delay: 0.3, ease: [0.22, 1, 0.36, 1] }}
                className="font-serif text-5xl sm:text-7xl md:text-8xl lg:text-9xl font-bold text-white tracking-tight leading-none drop-shadow-[0_14px_40px_rgba(0,0,0,0.55)]"
              >
                The Collection
              </motion.h1>

              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.8, delay: 0.75 }}
                className="mt-6 md:mt-8 flex items-center gap-3"
              >
                <div className="h-px w-12 md:w-16 bg-white/35" />
                <span className="text-[10px] md:text-xs uppercase tracking-[0.4em] text-white/70 font-medium">
                  {products ? products.length : "—"} Pieces
                </span>
                <div className="h-px w-12 md:w-16 bg-white/35" />
              </motion.div>
            </div>
          </div>
        </div>
      </section>

      {/* Gallery */}
      <section className="py-16 md:py-24 container mx-auto px-4 md:px-6 max-w-7xl">
        {isLoading ? (
          <div className="py-20 flex items-center justify-center">
            <BrandedLoader />
          </div>
        ) : (
          <div className="columns-2 md:columns-3 xl:columns-4 gap-3 md:gap-4">
            {sortedProducts.map((product, i) => (
              <div key={product.id} className="break-inside-avoid mb-3 md:mb-4">
                <RevealImage product={product} index={i} />
              </div>
            ))}
          </div>
        )}

        {!isLoading && products && products.length === 0 && (
          <div className="py-20 text-center">
            <p className="uppercase text-[10px] tracking-widest font-bold text-neutral-400">
              No products found.
            </p>
          </div>
        )}
      </section>
    </div>
  );
}
