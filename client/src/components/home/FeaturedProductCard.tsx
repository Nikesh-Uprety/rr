import { useCallback, useEffect, useRef, useState } from "react";
import { ExternalLink, ArrowRight } from "lucide-react";
import { Link } from "wouter";
import { AnimatePresence, motion } from "framer-motion";

import { formatPrice } from "@/lib/format";
import { type ProductApi } from "@/lib/api";
import { OptimizedImage } from "@/components/ui/OptimizedImage";

const FEATURED_STATIC_IMAGES = [
  "https://cdn2.blanxer.com/uploads/67cd36dcf133882caba612b4/product_image-dsc03423-6408.webp",
  "https://cdn2.blanxer.com/uploads/67cd36dcf133882caba612b4/product_image-dsc02288-edit-2-8008.webp",
];

const DUMMY_NEW_ARRIVAL_IMAGES = [
  "https://placehold.co/900x1200/0b1020/ffffff?text=RARE+ALT+1",
  "https://placehold.co/900x1200/111827/ffffff?text=RARE+ALT+2",
  "https://placehold.co/900x1200/0f172a/ffffff?text=RARE+ALT+3",
];

function getGalleryImagesForCard(
  product: ProductApi,
  { addDummyFallback }: { addDummyFallback: boolean },
) {
  const main = product.imageUrl ?? "";
  const parsed = (() => {
    try {
      const urls = product.galleryUrls ? JSON.parse(product.galleryUrls) : [];
      return Array.isArray(urls) ? urls.filter((u) => typeof u === "string") : [];
    } catch {
      return [];
    }
  })();

  const all = [main, ...parsed].filter(Boolean);
  if (!addDummyFallback) return all.length > 0 ? all : [main].filter(Boolean);

  if (all.length >= 2) return all;
  return [...all, ...DUMMY_NEW_ARRIVAL_IMAGES].filter(Boolean);
}

function FeaturedProductCard({
  product,
  index,
}: {
  product: ProductApi;
  index: number;
}) {
  const [mobileImageIndex, setMobileImageIndex] = useState(0);
  const touchStartX = useRef(0);
  const autoCycleRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const didSwipeRef = useRef(false);

  const galleryImages = (() => {
    try {
      const urls = product.galleryUrls ? JSON.parse(product.galleryUrls) : [];
      const mainImg = product.imageUrl ?? "";
      const all = mainImg ? [mainImg, ...urls] : [...urls];
      return all.length > 0 ? all : [mainImg];
    } catch {
      return [product.imageUrl ?? ""];
    }
  })();

  const startAutoCycle = useCallback(() => {
    if (galleryImages.length <= 1) return;
    if (autoCycleRef.current) clearInterval(autoCycleRef.current);
    autoCycleRef.current = setInterval(() => {
      setMobileImageIndex((prev) => (prev + 1) % galleryImages.length);
    }, 2000);
  }, [galleryImages.length]);

  useEffect(() => {
    startAutoCycle();
    return () => {
      if (autoCycleRef.current) clearInterval(autoCycleRef.current);
    };
  }, [startAutoCycle]);

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
    if (autoCycleRef.current) {
      clearInterval(autoCycleRef.current);
      autoCycleRef.current = null;
    }
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    const deltaX = e.changedTouches[0].clientX - touchStartX.current;
    if (galleryImages.length <= 1) {
      startAutoCycle();
      return;
    }
    if (Math.abs(deltaX) > 50) {
      didSwipeRef.current = true;
      setMobileImageIndex((prev) => {
        if (deltaX < 0) return (prev + 1) % galleryImages.length;
        return (prev - 1 + galleryImages.length) % galleryImages.length;
      });
      setTimeout(() => {
        didSwipeRef.current = false;
      }, 400);
    }
    startAutoCycle();
  };

  const handleGalleryClick = (e: React.MouseEvent) => {
    if (didSwipeRef.current) {
      e.preventDefault();
      e.stopPropagation();
    }
  };

  const staticImage =
    FEATURED_STATIC_IMAGES[index] ??
    (product.galleryUrls ? JSON.parse(product.galleryUrls)[0] : product.imageUrl ?? "");

  return (
    <Link href={`/product/${product.id}`} className="group cursor-pointer relative">
      <div className="relative overflow-hidden bg-gray-50 dark:bg-muted/30 aspect-[4/5] rounded-xl shadow-2xl transition-all duration-300 hover:shadow-white/5">
        <div className="hidden lg:block absolute inset-0 z-0">
          <AnimatePresence mode="wait">
            <motion.div
              className="absolute inset-0 z-0"
              whileHover={{ scale: 1.1 }}
              transition={{ duration: 0.4, ease: [0.33, 1, 0.68, 1] }}
            >
              <OptimizedImage
                src={staticImage}
                alt={`${product.name} lifestyle`}
                className="w-full h-full object-cover transition-opacity duration-1000 ease-in-out group-hover:opacity-0"
                priority={index < 2}
              />
              <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-1000 ease-in-out">
                <OptimizedImage
                  src={product.imageUrl ?? ""}
                  alt={product.name}
                  className="w-full h-full object-cover"
                />
              </div>
            </motion.div>
          </AnimatePresence>
        </div>

        <div
          className="lg:hidden absolute inset-0 z-0 touch-pan-y"
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
          onClick={handleGalleryClick}
        >
          {galleryImages.map((src: string, imgIdx: number) => (
            <div
              key={imgIdx}
              className="absolute inset-0 transition-opacity duration-700 ease-in-out"
              style={{ opacity: imgIdx === mobileImageIndex ? 1 : 0 }}
            >
              <img
                src={src}
                alt={`${product.name} view ${imgIdx + 1}`}
                className="w-full h-full object-cover"
              />
            </div>
          ))}
          {galleryImages.length > 1 && (
            <div className="absolute top-3 left-1/2 -translate-x-1/2 z-20 flex gap-1.5">
              {galleryImages.map((_: string, dotIdx: number) => (
                <div
                  key={dotIdx}
                  className={`h-1 rounded-full transition-all duration-500 ${
                    dotIdx === mobileImageIndex ? "w-5 bg-white shadow-lg" : "w-1.5 bg-white/40"
                  }`}
                />
              ))}
            </div>
          )}
        </div>

        <div className="hidden lg:block absolute inset-0 bg-gradient-to-t from-black/90 via-black/30 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none z-10" />

        <div className="lg:hidden absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent pointer-events-none z-10" />

        <div className="hidden lg:flex absolute inset-x-4 bottom-4 z-20 p-6 backdrop-blur-xl bg-black/40 border border-white/10 rounded-2xl shadow-xl justify-between items-center opacity-0 translate-y-4 group-hover:opacity-100 group-hover:translate-y-0 transition-all duration-700 ease-out">
          <div>
            <h3 className="text-white text-xl font-black uppercase tracking-tighter mb-1">
              {product.name}
            </h3>
            {product.saleActive && Number(product.salePercentage) > 0 ? (
              <div className="flex items-center gap-2">
                <p className="text-white font-black text-lg">
                  {formatPrice(Number(product.price) * (1 - Number(product.salePercentage) / 100))}
                </p>
                <p className="text-white/50 font-medium text-sm line-through">
                  {formatPrice(product.price)}
                </p>
                <span className="bg-white text-black text-[9px] font-black uppercase tracking-[0.1em] px-2 py-0.5 rounded-sm">
                  {product.salePercentage}% OFF
                </span>
              </div>
            ) : (
              <p className="text-white/70 font-medium text-lg">{formatPrice(product.price)}</p>
            )}
          </div>
          <div className="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center border border-white/30 text-white">
            <ArrowRight className="w-5 h-5" />
          </div>
        </div>

        <div className="lg:hidden absolute inset-x-3 bottom-3 z-20 p-4 backdrop-blur-xl bg-black/40 border border-white/10 rounded-xl shadow-xl">
          <div className="flex justify-between items-center">
            <div>
              <h3 className="text-white text-base font-black uppercase tracking-tighter mb-0.5 animate-in fade-in slide-in-from-bottom-2 duration-500">
                {product.name}
              </h3>
              {product.saleActive && Number(product.salePercentage) > 0 ? (
                <div className="flex items-center gap-2 animate-in fade-in slide-in-from-bottom-2 duration-700">
                  <p className="text-white font-black text-sm">
                    {formatPrice(Number(product.price) * (1 - Number(product.salePercentage) / 100))}
                  </p>
                  <p className="text-white/50 font-medium text-xs line-through">
                    {formatPrice(product.price)}
                  </p>
                  <span className="bg-white text-black text-[8px] font-black uppercase tracking-[0.1em] px-1.5 py-0.5 rounded-sm">
                    {product.salePercentage}% OFF
                  </span>
                </div>
              ) : (
                <p className="text-white/70 font-medium text-sm animate-in fade-in slide-in-from-bottom-2 duration-700">
                  {formatPrice(product.price)}
                </p>
              )}
            </div>
            <div className="w-9 h-9 rounded-full bg-white/20 flex items-center justify-center border border-white/30 text-white">
              <ArrowRight className="w-4 h-4" />
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            window.open(`/product/${product.id}`, "_blank");
          }}
          className="absolute top-4 right-4 z-30 hidden lg:flex h-10 w-10 items-center justify-center rounded-full bg-black/50 text-white backdrop-blur-md border border-white/10 opacity-0 group-hover:opacity-100 transition-all duration-300 hover:bg-white hover:text-black"
        >
          <ExternalLink className="h-4 w-4" />
        </button>
      </div>
    </Link>
  );
}

export { getGalleryImagesForCard, FeaturedProductCard };
