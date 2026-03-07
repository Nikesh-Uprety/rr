import { useState, useMemo } from "react";
import { useRoute, Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { useCartStore } from "@/store/cart";
import { Button } from "@/components/ui/button";
import { Minus, Plus } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { fetchProductById, type ProductApi } from "@/lib/api";
import { formatPrice } from "@/lib/format";

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
  const { toast } = useToast();
  const addItem = useCartStore((state) => state.addItem);

  const productId = params?.id ?? "";

  const { data: product, isLoading } = useQuery<ProductApi | null>({
    queryKey: ["products", productId],
    queryFn: () => fetchProductById(productId),
    enabled: !!productId,
  });

  const [quantity, setQuantity] = useState(1);
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  const [selectedColor, setSelectedColor] = useState<string | null>(null);
  const [selectedSize, setSelectedSize] = useState<string | null>(null);

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
        <div className="container mx-auto px-4 py-24 max-w-6xl mt-10">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16">
            <div className="aspect-[4/5] max-w-lg bg-muted animate-pulse rounded-sm" />
            <div className="space-y-6">
              <div className="h-8 w-3/4 bg-muted animate-pulse" />
              <div className="h-6 w-1/3 bg-muted animate-pulse" />
              <div className="h-24 w-full bg-muted animate-pulse" />
            </div>
          </div>
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
        images: allImages.filter(Boolean),
        variants: [],
      },
      { size: effectiveSize ?? "One Size", color: effectiveColor ?? "Default" },
      quantity,
    );
    toast({ title: "Added to bag" });
  };

  return (
    <div className="container mx-auto px-4 py-24 max-w-6xl mt-10">
      <div className="flex flex-col lg:flex-row gap-12 lg:gap-16">
        {/* Media: slightly smaller main image + gallery */}
        <div className="lg:max-w-[420px] space-y-4">
          <div className="aspect-[4/5] bg-muted overflow-hidden rounded-sm relative">
            {product.stock === 0 && (
              <div className="absolute top-3 left-3 z-10 bg-black/80 text-white text-[10px] font-bold uppercase tracking-widest px-3 py-1.5">
                Out of Stock
              </div>
            )}
            <img
              src={displayImage || ""}
              alt={product.name}
              className="w-full h-full object-cover"
            />
          </div>
          {allImages.length > 1 && (
            <div className="grid grid-cols-4 gap-2">
              {allImages.map((url, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => setSelectedImageIndex(i)}
                  className={`aspect-square bg-muted overflow-hidden rounded-sm border-2 transition-colors ${
                    selectedImageIndex === i ? "border-black" : "border-transparent hover:border-gray-300"
                  }`}
                >
                  <img src={url || ""} alt="" className="w-full h-full object-cover" />
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="flex-1 min-w-0 lg:max-w-[440px]">
          <h1 className="text-2xl lg:text-3xl font-black uppercase tracking-tighter mb-2">
            {product.name}
          </h1>
          {product.shortDetails && (
            <p className="text-sm text-muted-foreground mb-4">
              {product.shortDetails}
            </p>
          )}
          <p className="text-xl font-light mb-8">
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
                          ? "border-black bg-black text-white"
                          : "border-gray-200 hover:border-gray-400"
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
                          ? "border-black bg-black text-white"
                          : "border-gray-200 hover:border-gray-400"
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
                disabled={product.stock === 0}
                className="w-full h-14 border-black text-black hover:bg-black hover:text-white rounded-none uppercase tracking-[0.2em] text-xs font-bold transition-all disabled:opacity-50 disabled:cursor-not-allowed"
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
          {/* Related products could be fetched here */}
        </div>
      </div>
    </div>
  );
}
