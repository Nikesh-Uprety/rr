import { useState, useRef, useMemo } from "react";
import { Link } from "wouter";
import { ArrowUpRight } from "lucide-react";
import { type ProductApi } from "@/lib/api";

type SiteAsset = {
  id: string;
  imageUrl: string | null;
  videoUrl: string | null;
  altText: string | null;
  sortOrder: number | null;
  active: boolean | null;
};

function useScrollReveal() {
  const ref = useRef<HTMLDivElement>(null);
  const [isVisible, setIsVisible] = useState(false);

  const observer = useRef<IntersectionObserver | null>(null);

  if (ref.current && !observer.current) {
    observer.current = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.current?.disconnect();
        }
      },
      { threshold: 0.1, rootMargin: "0px 0px -40px 0px" }
    );
    observer.current.observe(ref.current);
  }

  return { ref, isVisible };
}

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
  isDark,
}: {
  product: ProductApi;
  index: number;
  isDark: boolean;
}) {
  const { ref, isVisible } = useScrollReveal();
  const aspect = getAspect(index);
  const [isHovered, setIsHovered] = useState(false);

  const gallery = useMemo(() => {
    try {
      return product.galleryUrls ? JSON.parse(product.galleryUrls) : [];
    } catch {
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
            style={{
              filter: isDark ? "saturate(0.96) contrast(1.02)" : "saturate(1.14) contrast(1.06) brightness(1.02)",
            }}
          />

          {secondaryImage && (
            <img
              src={secondaryImage}
              alt={`${product.name} alternate view`}
              className={`absolute inset-0 w-full h-full object-cover transition-all duration-1000 ease-out ${
                isHovered ? "opacity-100 scale-110" : "opacity-0 scale-100"
              }`}
              style={{
                filter: isDark ? "saturate(0.96) contrast(1.02)" : "saturate(1.14) contrast(1.06) brightness(1.02)",
              }}
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
    <div className="py-20 md:py-24 container mx-auto px-4 md:px-6 max-w-7xl">
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3 md:gap-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <div
            key={i}
            className={`${getAspect(i)} bg-neutral-100 dark:bg-neutral-800 rounded-sm animate-pulse break-inside-avoid`}
          />
        ))}
      </div>
    </div>
  );
}

interface CollectionV1SectionProps {
  sortedProducts: ProductApi[];
  isLoading: boolean;
  isDark: boolean;
  bannerAssets: SiteAsset[];
  products: ProductApi[];
}

export default function CollectionV1Section({
  sortedProducts,
  isLoading,
  isDark,
  products,
}: CollectionV1SectionProps) {
  return (
    <section className="pb-16 pt-0 md:pb-24 container mx-auto px-4 md:px-6 max-w-7xl">
      {isLoading ? (
        <div className="py-20 flex items-center justify-center">
          <GallerySkeleton />
        </div>
      ) : (
        <div className="columns-2 md:columns-3 xl:columns-4 gap-3 md:gap-4">
          {sortedProducts.map((product, i) => (
            <div key={product.id} className="break-inside-avoid mb-3 md:mb-4">
              <RevealImage product={product} index={i} isDark={isDark} />
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
  );
}

export { GallerySkeleton };
