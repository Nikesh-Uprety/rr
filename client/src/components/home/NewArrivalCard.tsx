import { useMemo } from "react";
import { ExternalLink } from "lucide-react";
import { Link } from "wouter";

import { formatPrice } from "@/lib/format";
import { type ProductApi } from "@/lib/api";
import { OptimizedImage } from "@/components/ui/OptimizedImage";
import { getGalleryImagesForCard } from "@/components/home/FeaturedProductCard";

function NewArrivalCard({
  product,
  imageAspectClass = "aspect-[4/5] sm:aspect-[3/4]",
}: {
  product: ProductApi;
  imageAspectClass?: string;
}) {
  const preferredIndex = Number.isInteger(product.homeFeaturedImageIndex)
    ? Number(product.homeFeaturedImageIndex)
    : 0;
  const images = useMemo(() => {
    const all = getGalleryImagesForCard(product, { addDummyFallback: true });
    if (all.length <= 1) return all;
    const clamped = Math.max(0, Math.min(preferredIndex, all.length - 1));
    const preferred = all[clamped] ?? all[0];
    const rest = all.filter((_, idx) => idx !== clamped);
    return [preferred, ...rest];
  }, [preferredIndex, product]);
  return (
    <Link href={`/product/${product.id}`} className="group block cursor-pointer">
      <div
        className={`relative overflow-hidden rounded-xl border border-zinc-200/70 bg-zinc-100/70 dark:border-zinc-800/80 dark:bg-zinc-900/40 ${imageAspectClass} mb-4 shadow-[0_12px_40px_-30px_rgba(0,0,0,0.85)] transition-all duration-500 group-hover:-translate-y-1 group-hover:shadow-[0_24px_60px_-30px_rgba(0,0,0,0.9)]`}
      >
        <div className="absolute inset-0">
          <OptimizedImage
            src={images[0] ?? "/placeholder.svg"}
            alt={product.name}
            className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-[1.035]"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/25 via-transparent to-transparent opacity-60 z-[2]" />
          <div className="absolute inset-0 z-[3] border border-white/30 opacity-0 transition-opacity duration-500 group-hover:opacity-100" />
        </div>

        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            window.open(`/product/${product.id}`, "_blank");
          }}
          className="absolute right-3 top-3 z-10 hidden h-8 w-8 items-center justify-center rounded-full border border-white/30 bg-black/35 text-white opacity-0 backdrop-blur-md transition-all duration-300 group-hover:opacity-100 lg:flex"
        >
          <ExternalLink className="h-3.5 w-3.5" />
        </button>

        <div className="absolute left-3 top-3 z-[5]">
          {product.saleActive && Number(product.salePercentage) > 0 && (
            <span className="rounded-full border border-white/30 bg-black/45 px-2.5 py-1 text-[9px] font-black uppercase tracking-[0.2em] text-white backdrop-blur-md">
              {product.salePercentage}% OFF
            </span>
          )}
        </div>
      </div>

      <div className="px-0.5">
        <div className="mb-1.5 flex items-center gap-2 text-[9px] font-bold uppercase tracking-[0.26em] text-zinc-500 dark:text-zinc-400">
          <span className="inline-block h-[1px] w-5 bg-zinc-400/70 dark:bg-zinc-600/80" />
          Crafted Quality
        </div>
        <h3 className="mb-1 truncate text-[11px] font-black uppercase tracking-[0.14em] text-zinc-900 transition-colors duration-300 group-hover:text-black dark:text-zinc-100 dark:group-hover:text-white">
          {product.name}
        </h3>
        <div className="flex items-center gap-2 text-[11px] font-bold tracking-[0.08em] text-zinc-700 dark:text-zinc-300">
          {product.saleActive && Number(product.salePercentage) > 0 ? (
            <>
              <span className="text-primary">
                {formatPrice(Number(product.price) * (1 - Number(product.salePercentage) / 100))}
              </span>
              <span className="text-[10px] text-zinc-500 line-through dark:text-zinc-500">
                {formatPrice(product.price)}
              </span>
            </>
          ) : (
            <span>{formatPrice(product.price)}</span>
          )}
        </div>
      </div>
    </Link>
  );
}

export { NewArrivalCard };
