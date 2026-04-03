import { useState, useEffect, useRef, useMemo } from "react";
import { Link } from "wouter";
import { useMutation, useQuery } from "@tanstack/react-query";
import { fetchProducts, fetchCategories, type ProductApi } from "@/lib/api";
import { ArrowRight, ArrowUpRight, Sparkles } from "lucide-react";
import { BrandedLoader } from "@/components/ui/BrandedLoader";
import { motion } from "framer-motion";
import { apiRequest } from "@/lib/queryClient";
import ThreeDHoverGallery from "@/components/ui/3d-hover-gallery";
import { useToast } from "@/hooks/use-toast";
import { useThemeStore } from "@/store/theme";

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
  isDark,
}: {
  product: ProductApi;
  index: number;
  isDark: boolean;
}) {
  const { ref, isVisible } = useScrollReveal();
  const aspect = getAspect(index);
  const [isHovered, setIsHovered] = useState(false);
  const [scrollProgress, setScrollProgress] = useState(0);
  const [autoPlayIndex, setAutoPlayIndex] = useState(0);

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

export default function NewCollection() {
  const { toast } = useToast();
  const { theme } = useThemeStore();
  const [newsletterEmail, setNewsletterEmail] = useState("");
  const isDark = theme === "dark";
  const { data: products, isLoading } = useQuery<ProductApi[]>({
    queryKey: ["products", "all-collection"],
    queryFn: () => fetchProducts(),
    staleTime: 1000 * 60 * 5, // 5 minutes stale time for better performance
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

  const heroGalleryImages = useMemo(() => {
    const imageAssets = (bannerAssets ?? [])
      .filter((a) => a?.active && a?.imageUrl)
      .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
      .map((a) => a.imageUrl as string);

    // Keep the hero snappy and predictable.
    const maxItems = 8;
    
    // If we have banner assets, use them (up to maxItems)
    if (imageAssets.length > 0) {
      return imageAssets.slice(0, maxItems);
    }
    
    // Otherwise, use default images for a beautiful gallery
    return [
      "/images/collection-banner.png",
      "/images/feature1.webp",
      "/images/feature2.webp", 
      "/images/feature3.webp",
      "/images/landingpage3.webp",
      "/images/landingpage4.webp",
      "/images/explore.webp",
      "/images/colllection.webp",
    ].slice(0, maxItems);
  }, [bannerAssets]);

  // Debug: Log gallery images
  useEffect(() => {
    console.log('Hero Gallery Images:', heroGalleryImages);
    console.log('Hero Gallery Length:', heroGalleryImages.length);
  }, [heroGalleryImages]);

  useEffect(() => {
    const scriptId = "instagram-embed-script";
    const existingScript = document.getElementById(scriptId) as HTMLScriptElement | null;

    const processEmbeds = () => {
      const instagram = (window as Window & { instgrm?: { Embeds?: { process?: () => void } } }).instgrm;
      instagram?.Embeds?.process?.();
    };

    if (existingScript) {
      if (existingScript.dataset.loaded === "true") {
        processEmbeds();
      } else {
        existingScript.addEventListener("load", processEmbeds, { once: true });
      }
      return () => {
        existingScript.removeEventListener("load", processEmbeds);
      };
    }

    const script = document.createElement("script");
    script.id = scriptId;
    script.src = "https://www.instagram.com/embed.js";
    script.async = true;
    script.defer = true;
    script.onload = () => {
      script.dataset.loaded = "true";
      processEmbeds();
    };
    document.body.appendChild(script);

    return () => {
      script.onload = null;
      if (script.parentNode) {
        script.parentNode.removeChild(script);
      }
    };
  }, []);

  const newsletterMutation = useMutation({
    mutationFn: async (email: string) => {
      const res = await apiRequest("POST", "/api/newsletter/subscribe", { email });
      return res.json();
    },
    onSuccess: () => {
      toast({
        title: "Subscribed!",
        description: "You’re on the list for new drops and rare updates.",
      });
      setNewsletterEmail("");
    },
    onError: (error: Error) => {
      toast({
        title: "Subscription failed",
        description: error.message || "Please try again in a moment.",
        variant: "destructive",
      });
    },
  });

  const handleNewsletterSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!newsletterEmail.trim()) return;
    newsletterMutation.mutate(newsletterEmail.trim());
  };

  return (
    <div className="flex min-h-screen flex-col bg-[linear-gradient(180deg,#ffffff_0%,#fbfbfa_24%,#f5f1ea_68%,#ffffff_100%)] text-black dark:bg-black dark:text-white">
      {/* Hero Banner — Full-bleed background image + Text */}
      <section className="relative w-full overflow-hidden bg-[radial-gradient(circle_at_top,#fffdf8_0%,#f5efe5_42%,#ece4d7_100%)] dark:bg-black">
        <div className="relative w-full h-screen md:h-screen lg:h-screen">
          <div className="absolute inset-0">
            <ThreeDHoverGallery
              images={heroGalleryImages}
              className="h-full w-full"
              backgroundColor="transparent"
              itemWidth={10}
              itemHeight={18}
              activeWidth={40}
              gap={0.8}
              perspective={50}
              hoverScale={15}
              transitionDuration={0.3}
              rotationAngle={35}
              zDepth={10}
              grayscaleStrength={isDark ? 1 : 0}
              brightnessLevel={isDark ? 0.5 : 0.95}
              enableKeyboardNavigation={true}
              autoPlay={false}
            />
          </div>

          {/* Hero text overlay - no dark overlays */}
          <div className="relative z-10 container mx-auto px-4 md:px-6 h-full flex items-center pointer-events-none">
            <div className="w-full flex flex-col items-center text-center py-16 md:py-24">
              <motion.p
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 0.85, y: 0 }}
                transition={{ duration: 0.7, delay: 0.15 }}
                className="mb-4 text-[10px] font-bold uppercase tracking-[0.55em] text-white/90 md:mb-6 md:text-xs"
                style={{
                  textShadow: isDark ? "0 10px 25px rgba(0,0,0,0.55)" : "0 10px 24px rgba(0,0,0,0.42)",
                }}
              >
                Curated Pieces, Captured in Detail
              </motion.p>

              <motion.h1
                initial={{ opacity: 0, y: 22 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 1, delay: 0.3, ease: [0.22, 1, 0.36, 1] }}
                className="font-serif text-5xl font-bold leading-none tracking-tight text-white sm:text-7xl md:text-8xl lg:text-9xl"
                style={{
                  textShadow: "0 14px 40px rgba(0,0,0,0.55)",
                }}
              >
                The Collection
              </motion.h1>

              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.8, delay: 0.75 }}
                className="mt-6 md:mt-8 flex items-center gap-3"
              >
                <div className="h-px w-12 bg-white/35 md:w-16" />
                <span className="text-[10px] font-medium uppercase tracking-[0.4em] text-white/70 md:text-xs">
                  {products ? products.length : "—"} Pieces
                </span>
                <div className="h-px w-12 bg-white/35 md:w-16" />
              </motion.div>
            </div>
          </div>
        </div>
      </section>

      {/* Gallery */}
      <section className="pb-16 pt-0 md:pb-24 container mx-auto px-4 md:px-6 max-w-7xl">
        {isLoading ? (
          <div className="py-20 flex items-center justify-center">
            <BrandedLoader />
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

      {/* Instagram + Newsletter */}
      <section className="border-t border-border/40 py-16 md:py-24">
        <div className="container mx-auto max-w-7xl px-4 md:px-6">
          <div className="grid gap-10 lg:grid-cols-[1.05fr_0.95fr] lg:items-start">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.25 }}
              transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
              className="flex flex-col items-start"
            >
              <p className="mb-4 text-[10px] font-bold uppercase tracking-[0.5em] text-muted-foreground md:text-xs">
                Follow Us
              </p>
              <div className="mt-2 w-full max-w-[540px] overflow-hidden rounded-[28px] border border-border/60 bg-white shadow-[0_24px_80px_rgba(0,0,0,0.10)] dark:bg-neutral-950">
          <div
            dangerouslySetInnerHTML={{
              __html: `<blockquote class="instagram-media" data-instgrm-permalink="https://www.instagram.com/p/DVvoWouDbQN/?utm_source=ig_embed&amp;utm_campaign=loading" data-instgrm-version="14" style=" background:#FFF; border:0; border-radius:3px; box-shadow:0 0 1px 0 rgba(0,0,0,0.5),0 1px 10px 0 rgba(0,0,0,0.15); margin: 1px; max-width:540px; min-width:326px; padding:0; width:99.375%; width:-webkit-calc(100% - 2px); width:calc(100% - 2px);"><div style="padding:16px;"> <a href="https://www.instagram.com/p/DVvoWouDbQN/?utm_source=ig_embed&amp;utm_campaign=loading" style=" background:#FFFFFF; line-height:0; padding:0 0; text-align:center; text-decoration:none; width:100%;" target="_blank"> <div style=" display: flex; flex-direction: row; align-items: center;"> <div style="background-color: #F4F4F4; border-radius: 50%; flex-grow: 0; height: 40px; margin-right: 14px; width: 40px;"></div> <div style="display: flex; flex-direction: column; flex-grow: 1; justify-content: center;"> <div style=" background-color: #F4F4F4; border-radius: 4px; flex-grow: 0; height: 14px; margin-bottom: 6px; width: 100px;"></div> <div style=" background-color: #F4F4F4; border-radius: 4px; flex-grow: 0; height: 14px; width: 60px;"></div></div></div><div style="padding: 19% 0;"></div> <div style="display:block; height:50px; margin:0 auto 12px; width:50px;"><svg width="50px" height="50px" viewBox="0 0 60 60" version="1.1" xmlns="https://www.w3.org/2000/svg" xmlns:xlink="https://www.w3.org/1999/xlink"><g stroke="none" stroke-width="1" fill="none" fill-rule="evenodd"><g transform="translate(-511.000000, -20.000000)" fill="#000000"><g><path d="M556.869,30.41 C554.814,30.41 553.148,32.076 553.148,34.131 C553.148,36.186 554.814,37.852 556.869,37.852 C558.924,37.852 560.59,36.186 560.59,34.131 C560.59,32.076 558.924,30.41 556.869,30.41 M541,60.657 C535.114,60.657 530.342,55.887 530.342,50 C530.342,44.114 535.114,39.342 541,39.342 C546.887,39.342 551.658,44.114 551.658,50 C551.658,55.887 546.887,60.657 541,60.657 M541,33.886 C532.1,33.886 524.886,41.1 524.886,50 C524.886,58.899 532.1,66.113 541,66.113 C549.9,66.113 557.115,58.899 557.115,50 C557.115,41.1 549.9,33.886 541,33.886 M565.378,62.101 C565.244,65.022 564.756,66.606 564.346,67.663 C563.803,69.06 563.154,70.057 562.106,71.106 C561.058,72.155 560.06,72.803 558.662,73.347 C557.607,73.757 556.021,74.244 553.102,74.378 C549.944,74.521 548.997,74.552 541,74.552 C533.003,74.552 532.056,74.521 528.898,74.378 C525.979,74.244 524.393,73.757 523.338,73.347 C521.94,72.803 520.942,72.155 519.894,71.106 C518.846,70.057 518.197,69.06 517.654,67.663 C517.244,66.606 516.755,65.022 516.623,62.101 C516.479,58.943 516.448,57.996 516.448,50 C516.448,42.003 516.479,41.056 516.623,37.899 C516.755,34.978 517.244,33.391 517.654,32.338 C518.197,30.938 518.846,29.942 519.894,28.894 C520.942,27.846 521.94,27.196 523.338,26.654 C524.393,26.244 525.979,25.756 528.898,25.623 C532.057,25.479 533.004,25.448 541,25.448 C548.997,25.448 549.943,25.479 553.102,25.623 C556.021,25.756 557.607,26.244 558.662,26.654 C560.06,27.196 561.058,27.846 562.106,28.894 C563.154,29.942 563.803,30.938 564.346,32.338 C564.756,33.391 565.244,34.978 565.378,37.899 C565.522,41.056 565.552,42.003 565.552,50 C565.552,57.996 565.522,58.943 565.378,62.101 M570.82,37.631 C570.674,34.438 570.167,32.258 569.425,30.349 C568.659,28.377 567.633,26.702 565.965,25.035 C564.297,23.368 562.623,22.342 560.652,21.575 C558.743,20.834 556.562,20.326 553.369,20.18 C550.169,20.033 549.148,20 541,20 C532.853,20 531.831,20.033 528.631,20.18 C525.438,20.326 523.257,20.834 521.349,21.575 C519.376,22.342 517.703,23.368 516.035,25.035 C514.368,26.702 513.342,28.377 512.574,30.349 C511.834,32.258 511.326,34.438 511.181,37.631 C511.035,40.831 511,41.851 511,50 C511,58.147 511.035,59.17 511.181,62.369 C511.326,65.562 511.834,67.743 512.574,69.651 C513.342,71.625 514.368,73.296 516.035,74.965 C517.703,76.634 519.376,77.658 521.349,78.425 C523.257,79.167 525.438,79.673 528.631,79.82 C531.831,79.965 532.853,80.001 541,80.001 C549.148,80.001 550.169,79.965 553.369,79.82 C556.562,79.673 558.743,79.167 560.652,78.425 C562.623,77.658 564.297,76.634 565.965,74.965 C567.633,73.296 568.659,71.625 569.425,69.651 C570.167,67.743 570.674,65.562 570.82,62.369 C570.966,59.17 571,58.147 571,50 C571,41.851 570.966,40.831 570.82,37.631"></path></g></g></g></svg></div><div style="padding-top: 8px;"> <div style=" color:#3897f0; font-family:Arial,sans-serif; font-size:14px; font-style:normal; font-weight:550; line-height:18px;">View this post on Instagram</div></div><div style="padding: 12.5% 0;"></div> <div style="display: flex; flex-direction: row; margin-bottom: 14px; align-items: center;"><div> <div style="background-color: #F4F4F4; border-radius: 50%; height: 12.5px; width: 12.5px; transform: translateX(0px) translateY(7px);"></div> <div style="background-color: #F4F4F4; height: 12.5px; transform: rotate(-45deg) translateX(3px) translateY(1px); width: 12.5px; flex-grow: 0; margin-right: 14px; margin-left: 2px;"></div> <div style="background-color: #F4F4F4; border-radius: 50%; height: 12.5px; width: 12.5px; transform: translateX(9px) translateY(-18px);"></div></div><div style="margin-left: 8px;"> <div style=" background-color: #F4F4F4; border-radius: 50%; flex-grow: 0; height: 20px; width: 20px;"></div> <div style=" width: 0; height: 0; border-top: 2px solid transparent; border-left: 6px solid #f4f4f4; border-bottom: 2px solid transparent; transform: translateX(16px) translateY(-4px) rotate(30deg)"></div></div><div style="margin-left: auto;"> <div style=" width: 0px; border-top: 8px solid #F4F4F4; border-right: 8px solid transparent; transform: translateY(16px);"></div> <div style=" background-color: #F4F4F4; flex-grow: 0; height: 12px; width: 16px; transform: translateY(-4px);"></div> <div style=" width: 0; height: 0; border-top: 8px solid #F4F4F4; border-left: 8px solid transparent; transform: translateY(-4px) translateX(8px);"></div></div></div> <div style="display: flex; flex-direction: column; flex-grow: 1; justify-content: center; margin-bottom: 24px;"> <div style=" background-color: #F4F4F4; border-radius: 4px; flex-grow: 0; height: 14px; margin-bottom: 6px; width: 224px;"></div> <div style=" background-color: #F4F4F4; border-radius: 4px; flex-grow: 0; height: 14px; width: 144px;"></div></div></a><p style=" color:#c9c8cd; font-family:Arial,sans-serif; font-size:14px; line-height:17px; margin-bottom:0; margin-top:8px; overflow:hidden; padding:8px 0 7px; text-align:center; text-overflow:ellipsis; white-space:nowrap;"><a href="https://www.instagram.com/p/DVvoWouDbQN/?utm_source=ig_embed&amp;utm_campaign=loading" style=" color:#c9c8cd; font-family:Arial,sans-serif; font-size:14px; font-style:normal; font-weight:normal; line-height:17px; text-decoration:none;" target="_blank">A post shared by H U B A (@huba.official)</a></p></div></blockquote>`,
            }}
          />
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 24, scale: 0.98 }}
              whileInView={{ opacity: 1, y: 0, scale: 1 }}
              viewport={{ once: true, amount: 0.2 }}
              transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1], delay: 0.08 }}
              className="relative overflow-hidden rounded-[32px] border border-border/60 bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.92),rgba(244,240,234,0.88)_35%,rgba(234,228,220,0.92)_100%)] p-7 shadow-[0_30px_90px_rgba(0,0,0,0.10)] dark:bg-[radial-gradient(circle_at_top_left,rgba(34,34,34,0.95),rgba(18,18,18,0.98)_48%,rgba(10,10,10,1)_100%)] sm:p-9"
            >
              <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(135deg,rgba(255,255,255,0.22),transparent_40%,rgba(185,147,86,0.14))]" />
              <div className="pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full bg-[rgba(185,147,86,0.18)] blur-3xl" />
              <div className="pointer-events-none absolute -bottom-12 left-8 h-28 w-28 rounded-full bg-black/8 blur-3xl dark:bg-white/10" />

              <div className="relative">
                <div className="inline-flex items-center gap-2 rounded-full border border-border/60 bg-background/70 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.24em] text-muted-foreground backdrop-blur">
                  <Sparkles className="h-3.5 w-3.5" />
                  Newsletter
                </div>
                <h3 className="mt-6 text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
                  Subscribe for early access.
                </h3>
                <p className="mt-4 max-w-md text-sm leading-7 text-muted-foreground">
                  Get new-collection previews, atelier stories, and drop alerts before everyone else.
                </p>

                <form onSubmit={handleNewsletterSubmit} className="mt-8 space-y-4">
                  <div className="group flex items-center gap-3 rounded-2xl border border-border/70 bg-background/80 p-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.35)] backdrop-blur dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]">
                    <input
                      type="email"
                      required
                      value={newsletterEmail}
                      onChange={(event) => setNewsletterEmail(event.target.value)}
                      placeholder="Enter your email"
                      className="h-12 flex-1 bg-transparent px-4 text-sm text-foreground outline-none placeholder:text-muted-foreground/60"
                    />
                    <button
                      type="submit"
                      disabled={newsletterMutation.isPending}
                      className="inline-flex h-12 items-center gap-2 rounded-[18px] bg-black px-5 text-[11px] font-semibold uppercase tracking-[0.22em] text-white transition-all duration-300 hover:translate-x-0.5 hover:bg-neutral-800 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-white dark:text-black dark:hover:bg-neutral-200"
                    >
                      {newsletterMutation.isPending ? "Joining" : "Join"}
                      <ArrowRight className="h-4 w-4" />
                    </button>
                  </div>
                  <div className="flex items-center justify-between gap-4 text-[11px] text-muted-foreground">
                    <span>Thoughtful updates only. No spam.</span>
                    <span className="uppercase tracking-[0.2em]">Rare Atelier</span>
                  </div>
                </form>
              </div>
            </motion.div>
          </div>
        </div>
      </section>
      
    </div>
  );
}
