import { useState, useMemo } from "react";
import { useRoute, Link, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { useCartStore } from "@/store/cart";
import { Button } from "@/components/ui/button";
import { Minus, Plus, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { fetchProductById, fetchProducts, type ProductApi } from "@/lib/api";
import { formatPrice } from "@/lib/format";
import useEmblaCarousel from "embla-carousel-react";
import { TransformWrapper, TransformComponent } from "react-zoom-pan-pinch";
import { BrandedLoader } from "@/components/ui/BrandedLoader";
import { Helmet } from "react-helmet-async";

function parseJsonArray(s: string | null | undefined): string[] {
  if (!s || !s.trim()) return [];
  try {
    const a = JSON.parse(s);
    return Array.isArray(a) ? a.filter((x): x is string => typeof x === "string") : [];
  } catch {
    return [];
  }
}

export default function ProductDetail() {
  const [, params] = useRoute<{ id: string }>("/product/:id");
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const addItem = useCartStore((state) => state.addItem);

  const productId = params?.id ?? "";

  const { data: product, isLoading } = useQuery<ProductApi | null>({
    queryKey: ["products", productId],
    queryFn: () => fetchProductById(productId),
    enabled: !!productId,
  });

  const { data: relatedProductsRaw = [] } = useQuery<ProductApi[]>({
    queryKey: ["products", { category: product?.category, limit: 5 }],
    queryFn: () => fetchProducts({ category: product?.category || undefined, limit: 5 }),
    enabled: !!product?.category,
  });

  const relatedProducts = useMemo(() => {
    return (relatedProductsRaw || []).filter(p => p.id !== product?.id).slice(0, 4);
  }, [relatedProductsRaw, product?.id]);

  const [quantity, setQuantity] = useState(1);
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  const [selectedColor, setSelectedColor] = useState<string | null>(null);
  const [selectedSize, setSelectedSize] = useState<string | null>(null);
  const [isLightboxOpen, setIsLightboxOpen] = useState(false);

  const [emblaRef, emblaApi] = useEmblaCarousel({ loop: true });

  const colors = useMemo(() => parseJsonArray(product?.colorOptions ?? undefined), [product?.colorOptions]);
  const sizes = useMemo(() => parseJsonArray(product?.sizeOptions ?? undefined), [product?.sizeOptions]);
  const galleryUrls = useMemo(() => parseJsonArray(product?.galleryUrls ?? undefined), [product?.galleryUrls]);
  const mainImageUrl = product?.imageUrl ?? "";
  const allImages = useMemo(() => {
    const list = mainImageUrl ? [mainImageUrl, ...galleryUrls] : [...galleryUrls];
    return list.length ? list : [""];
  }, [mainImageUrl, galleryUrls]);
  const displayImage = allImages[selectedImageIndex] ?? allImages[0];

  if (isLoading || !product) {
    if (isLoading) {
      return (
        <div className="min-h-[80vh] flex items-center justify-center">
          <BrandedLoader />
        </div>
      );
    }
    return (
      <div className="container mx-auto px-4 py-32 max-w-6xl text-center">
        <p className="uppercase text-[10px] tracking-widest font-bold text-muted-foreground">
          Product not found.
        </p>
        <Button asChild className="mt-6 rounded-none px-10">
          <Link href="/products">Back to collection</Link>
        </Button>
      </div>
    );
  }

  const effectiveColor = selectedColor ?? (colors[0] ?? null);
  const effectiveSize = selectedSize ?? (sizes[0] ?? null);

  const handleAddToCart = () => {
    addItem(
      {
        id: product.id,
        name: product.name,
        price: Number(product.price),
        stock: product.stock,
        category: product.category ?? "",
        sku: "",
        images: allImages.filter(Boolean),
        variants: [],
      },
      { size: effectiveSize ?? "One Size", color: effectiveColor ?? "Default" },
      quantity,
    );
    toast({ title: "Added to bag" });
  };

  const handleBuyNow = () => {
    handleAddToCart();
    setLocation("/checkout");
  };

  const structuredData = {
    "@context": "https://schema.org/",
    "@type": "Product",
    "name": product.name,
    "image": allImages.filter(Boolean),
    "description": product.description || product.shortDetails || "",
    "brand": {
      "@type": "Brand",
      "name": "Rare Atelier"
    },
    "offers": {
      "@type": "Offer",
      "url": window.location.href,
      "priceCurrency": "NPR",
      "price": product.price,
      "availability": product.stock > 0 ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
      "itemCondition": "https://schema.org/NewCondition"
    }
  };

  return (
    <div className="container mx-auto px-4 py-24 max-w-6xl mt-10">
      <Helmet>
        <title>{`${product.name} | Rare Atelier`}</title>
        <meta name="description" content={product.shortDetails || product.description?.substring(0, 160) || `Buy ${product.name} at Rare Atelier.`} />
        <meta property="og:title" content={`${product.name} | Rare Atelier`} />
        <meta property="og:description" content={product.shortDetails || `Rare Atelier: ${product.name}`} />
        <meta property="og:image" content={mainImageUrl} />
        <meta property="og:type" content="product" />
        <meta property="og:url" content={window.location.href} />
        <script type="application/ld+json">
          {JSON.stringify(structuredData)}
        </script>
      </Helmet>
      <div className="flex flex-col lg:flex-row gap-12 lg:gap-16">
        {/* Media Gallery: Mobile Carousel + Desktop Thumbnail Sidebar */}
        <div className="lg:flex lg:w-3/5 lg:gap-6">
          {/* Mobile Embla Carousel */}
          <div className="lg:hidden w-full relative mb-6">
            <div className="overflow-hidden rounded-sm" ref={emblaRef}>
              <div className="flex">
                {allImages.map((url, idx) => (
                  <div className="flex-[0_0_100%] min-w-0" key={idx}>
                    <div className="aspect-[4/5] bg-muted relative">
                      {product.stock === 0 && (
                        <div className="absolute top-3 left-3 z-10 bg-black/80 text-white text-[10px] font-bold uppercase tracking-widest px-3 py-1.5">
                          Out of Stock
                        </div>
                      )}
                      <img
                        src={url || ""}
                        alt={`${product.name} - view ${idx + 1}`}
                        className="w-full h-full object-cover select-none"
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
            {allImages.length > 1 && (
              <div className="flex justify-center gap-2 mt-4">
                {allImages.map((_, idx) => (
                  <button
                    key={idx}
                    onClick={() => emblaApi?.scrollTo(idx)}
                    className={`w-2 h-2 rounded-full transition-all ${
                      idx === selectedImageIndex ? "bg-black w-6" : "bg-gray-300"
                    }`}
                    aria-label={`Go to slide ${idx + 1}`}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Desktop Thumbnail Sidebar */}
          {allImages.length > 1 && (
            <div className="hidden lg:flex flex-col gap-3 w-20 flex-shrink-0">
              {allImages.map((url, i) => (
                <button
                  key={i}
                  type="button"
                  onMouseEnter={() => setSelectedImageIndex(i)}
                  onClick={() => setSelectedImageIndex(i)}
                  className={`aspect-[4/5] w-full bg-muted overflow-hidden rounded-sm border-2 transition-all ${
                    selectedImageIndex === i ? "border-black border-opacity-100" : "border-transparent opacity-60 hover:opacity-100"
                  }`}
                >
                  <img src={url || ""} alt="" className="w-full h-full object-cover" />
                </button>
              ))}
            </div>
          )}

          {/* Desktop Main Zoom Image */}
          <div className="hidden lg:block flex-1">
             <div className="aspect-[4/5] bg-muted overflow-hidden rounded-sm relative cursor-zoom-in group">
                {product.stock === 0 && (
                  <div className="absolute top-4 left-4 z-10 bg-black/80 text-white text-[10px] font-bold uppercase tracking-widest px-4 py-2">
                    Out of Stock
                  </div>
                )}
                <TransformWrapper 
                  initialScale={1} 
                  initialPositionX={0} 
                  initialPositionY={0}
                  doubleClick={{ disabled: false }}
                  panning={{ disabled: false }}
                >
                  <TransformComponent wrapperClass="w-full h-full" contentClass="w-full h-full cursor-zoom-in">
                    <img
                      src={displayImage || ""}
                      alt={product.name}
                      onClick={() => setIsLightboxOpen(true)}
                      className="w-full h-full object-cover transition-transform duration-500"
                    />
                  </TransformComponent>
                </TransformWrapper>
             </div>
          </div>
        </div>

        {/* Product Details right column */}
        <div className="flex-1 min-w-0 lg:max-w-[400px] lg:pl-6 lg:pt-4">
          <h1 
            style={{
              fontFamily: 'Roboto, ui-sans-serif, system-ui, sans-serif',
              fontWeight: 600,
              fontSize: '24px',
              lineHeight: '36px',
              color: 'var(--brand-product-detail)'
            }}
            className="uppercase tracking-tight mb-2"
          >
            {product.name}
          </h1>
          {product.shortDetails && (
            <p className="text-sm text-muted-foreground mb-4">
              {product.shortDetails}
            </p>
          )}
          <p 
            style={{
              fontFamily: 'Roboto, ui-sans-serif, system-ui, sans-serif',
              fontWeight: 600,
              fontSize: '24px',
              lineHeight: '36px',
              color: 'var(--brand-product-detail)'
            }}
            className="mb-8"
          >
            {formatPrice(product.price)}
          </p>

          <div className="space-y-6">
            {colors.length > 0 && (
              <div>
                <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground mb-3 font-bold">
                  Color
                </p>
                <div className="flex flex-wrap gap-2">
                  {colors.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setSelectedColor(c)}
                      className={`min-w-[2rem] h-8 px-3 border text-xs font-medium transition-all rounded-sm ${
                        effectiveColor === c
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-border hover:border-foreground/50 text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      {c}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {sizes.length > 0 && (
              <div>
                <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground mb-3 font-bold">
                  Size
                </p>
                <div className="flex flex-wrap gap-2">
                  {sizes.map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setSelectedSize(s)}
                      className={`w-12 h-10 border text-xs font-medium transition-all rounded-sm ${
                        effectiveSize === s
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-border hover:border-foreground/50 text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div>
              <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground mb-3 font-bold">
                Quantity
              </p>
              <div className="flex items-center border border-gray-200 w-fit rounded-sm">
                <button
                  type="button"
                  onClick={() => setQuantity(Math.max(1, quantity - 1))}
                  className="w-10 h-10 flex items-center justify-center hover:bg-gray-50"
                >
                  <Minus className="w-3 h-3" />
                </button>
                <span className="w-10 text-center text-sm">{quantity}</span>
                <button
                  type="button"
                  onClick={() => setQuantity(quantity + 1)}
                  className="w-10 h-10 flex items-center justify-center hover:bg-gray-50"
                >
                  <Plus className="w-3 h-3" />
                </button>
              </div>
            </div>

            <div className="flex flex-col gap-3 pt-2">
              <Button
                onClick={handleAddToCart}
                disabled={product.stock === 0}
                className="w-full h-14 bg-black text-white hover:bg-gray-900 rounded-none uppercase tracking-[0.2em] text-xs font-bold disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {product.stock === 0 ? "Out of Stock" : "Add to Bag"}
              </Button>
              <Button
                variant="outline"
                onClick={handleBuyNow}
                disabled={product.stock === 0}
                className="w-full h-14 border-zinc-900 dark:border-zinc-100 text-zinc-900 dark:text-zinc-100 hover:bg-zinc-900 hover:text-white dark:hover:bg-zinc-100 dark:hover:text-zinc-900 rounded-none uppercase tracking-[0.2em] text-xs font-bold transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Buy Now
              </Button>
            </div>

            <div className="pt-8 space-y-4 border-t border-gray-100">
              <h4 className="text-[10px] uppercase tracking-[0.2em] font-bold text-muted-foreground">
                Product Details
              </h4>
              {product.description && (
                <p className="text-sm text-foreground leading-relaxed">
                  {product.description}
                </p>
              )}
              <ul className="text-xs space-y-2 text-muted-foreground list-disc pl-4">
                <li>Fit: Regular fit, designed for comfort and style.</li>
                <li>Material: 100% premium combed cotton.</li>
                <li>Construction: Double-needle hems for durability.</li>
              </ul>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-24 pt-16 border-t border-gray-100">
        <h2 className="text-xl font-black uppercase tracking-tighter text-center mb-12">
          You May Also Like
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
          {relatedProducts.map((p) => (
            <Link
              key={p.id}
              href={`/product/${p.id}`}
              className="group block"
              onClick={() => {
                window.scrollTo(0, 0);
              }}
            >
              <div className="aspect-[3/4] overflow-hidden bg-neutral-100 dark:bg-neutral-900 mb-4 relative rounded-sm">
                <img
                  src={p.imageUrl ?? ""}
                  alt={p.name}
                  className="object-cover w-full h-full group-hover:scale-105 transition-transform duration-700"
                />
              </div>
              <div className="space-y-1">
                <h3 className="text-sm font-bold truncate uppercase tracking-tight">{p.name}</h3>
                <p className="text-xs text-muted-foreground uppercase tracking-widest">
                  {formatPrice(p.price)}
                </p>
              </div>
            </Link>
          ))}
        </div>
      </div>

      {/* Fullscreen Lightbox */}
      {isLightboxOpen && (
        <div 
          className="fixed inset-0 z-50 bg-background/95 backdrop-blur-sm flex items-center justify-center p-4 lg:p-12 animate-in fade-in duration-200"
          onClick={() => setIsLightboxOpen(false)}
        >
          <button 
            type="button" 
            className="absolute top-6 right-6 lg:top-10 lg:right-10 w-12 h-12 flex items-center justify-center bg-black hover:bg-gray-800 text-white rounded-full transition-transform hover:scale-105 z-50"
            onClick={(e) => {
              e.stopPropagation();
              setIsLightboxOpen(false);
            }}
          >
            <X className="w-6 h-6" />
          </button>
          
          <div 
            className="relative w-full h-full max-w-6xl max-h-[90vh] flex items-center justify-center"
            onClick={(e) => e.stopPropagation()}
          >
            <TransformWrapper 
              initialScale={1} 
              initialPositionX={0} 
              initialPositionY={0}
            >
              <TransformComponent wrapperClass="w-full h-full flex items-center justify-center" contentClass="max-w-full max-h-full">
                <img
                  src={displayImage || ""}
                  alt={`${product.name} fullscreen view`}
                  className="max-w-full max-h-[90vh] object-contain rounded-md shadow-2xl"
                />
              </TransformComponent>
            </TransformWrapper>
            
            {/* Lightbox Thumbnails */}
            {allImages.length > 1 && (
              <div className="absolute bottom-4 left-1/2 -translate-x-1/2 hidden lg:flex gap-3 bg-white/90 backdrop-blur-md p-3 rounded-full shadow-lg border border-gray-200/50">
                {allImages.map((url, i) => (
                  <button
                    key={i}
                    onClick={() => setSelectedImageIndex(i)}
                    className={`w-12 h-12 rounded-full overflow-hidden border-2 transition-all ${
                      selectedImageIndex === i ? "border-black scale-110" : "border-transparent opacity-50 hover:opacity-100 hover:scale-105"
                    }`}
                  >
                    <img src={url || ""} alt="" className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
