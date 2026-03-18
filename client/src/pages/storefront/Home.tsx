import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { formatPrice } from "@/lib/format";
import { MOCK_PRODUCTS } from "@/lib/mockData";
import { Link } from "wouter";
import { ExternalLink, Sparkles, Star, Gem, Diamond, ChevronLeft, ChevronRight, ArrowRight } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { fetchProducts, type ProductApi } from "@/lib/api";
import { motion, AnimatePresence, useScroll, useTransform } from "framer-motion";
import { OptimizedImage } from "@/components/ui/OptimizedImage";
import { Helmet } from "react-helmet-async";

type SiteAsset = {
  id: string;
  section: string;
  imageUrl: string;
  altText: string | null;
  deviceTarget: string;
  assetType: "image" | "video";
  videoUrl: string | null;
  sortOrder: number;
  active: boolean;
};

const HERO_IMAGES_FALLBACK = [
  "https://placehold.co/1920x800/0a0e1a/6366f1?text=RARE.NP",
];

const LIFESTYLE_IMAGES_FALLBACK = [
  "https://instagram.fktm8-1.fna.fbcdn.net/v/t51.82787-15/631740212_17994330563913773_2587884432133361953_n.jpg?stp=dst-jpegr_e35_tt6&_nc_cat=100&ig_cache_key=MzgzMDk2Nzc4NDI1NjQ2MTc0OA%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6InhwaWRzLjE0NDB4MTkyMC5oZHIuQzMifQ%3D%3D&_nc_ohc=WHAtzLrmUw0Q7kNvwGZrMhY&_nc_oc=AdkqVNju-2AEOO-fn-AAnUa0TPWgAGyG6Rki48MU9gwLm4w0V1IiaidBIpz8Zd0A4P0&_nc_ad=z-m&_nc_cid=5011&_nc_zt=23&_nc_ht=instagram.fktm8-1.fna&_nc_gid=291tdQM7tKQUnIlBz26x5g&_nc_ss=8&oh=00_AfxPGSDL-niDxVGt9ePHCQRPO21x9E_0NDNSrJUZGMF2LQ&oe=69BDA11A",
  "https://instagram.fktm8-1.fna.fbcdn.net/v/t51.82787-15/601064673_17988135542913773_395755096348511217_n.jpg?stp=dst-jpg_e35_tt6&_nc_cat=103&ig_cache_key=Mzc4OTUwOTgwMzg0NTQ5NDg5MA%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6InhwaWRzLjE0NDB4MTc5NS5zZHIuQzMifQ%3D%3D&_nc_ohc=MtEtHv7NcAgQ7kNvwHwy6sz&_nc_oc=Adk6Llzm6Ews4P_r2brHfIZkHXcWlljxFVulZ6urWQfATyMefNIIcH--KNV4K3wKeic&_nc_ad=z-m&_nc_cid=5011&_nc_zt=23&_nc_ht=instagram.fktm8-1.fna&_nc_gid=KLgY0WiWUz90hQ3-kU0wjQ&_nc_ss=8&oh=00_Afx0cuyYIHwRuTfg-fnqVA4Vb34Sq-t3VFdoTDT2eFosJQ&oe=69BD72BA",
  "https://instagram.fktm8-1.fna.fbcdn.net/v/t51.82787-15/589049070_17986476560913773_350565688129391821_n.jpg?stp=dst-jpg_e35_tt6&_nc_cat=102&ig_cache_key=Mzc3ODU3ODg0MjAwNTY0NTU5Nw%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6InhwaWRzLjE0NDB4MTc5NS5zZHIuQzMifQ%3D%3D&_nc_ohc=xHR20j7rQNoQ7kNvwFO9t2s&_nc_oc=AdkrxPNMtgOtY3GmtQghJriONkvXttDjhc9pUDC7HWn0AJ9XWcEIc9u-2t9GjH5P49Y&_nc_ad=z-m&_nc_cid=5011&_nc_zt=23&_nc_ht=instagram.fktm8-1.fna&_nc_gid=KLgY0WiWUz90hQ3-kU0wjQ&_nc_ss=8&oh=00_AfykWLe3XijJQFThpyjPobnr0u1kWg-W6_FOpPeJUKu8tw&oe=69BD7C79",
  "https://instagram.fktm8-1.fna.fbcdn.net/v/t51.82787-15/575594259_17984209781913773_7313822284254687486_n.jpg?stp=dst-jpg_e35_tt6&_nc_cat=103&ig_cache_key=Mzc2MTk2MjA2MjM5NTM4MDg3NQ%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6InhwaWRzLjE0NDB4MTgwMC5zZHIuQzMifQ%3D%3D&_nc_ohc=T1IjMD62vJ8Q7kNvwGnWT7G&_nc_oc=Adlo703DNg6YfjJOHEClflyLa1KUFDsIe6BF8UY8c_j-h5Gh5WWTKd6r1LJZOTQmMCs&_nc_ad=z-m&_nc_cid=5011&_nc_zt=23&_nc_ht=instagram.fktm8-1.fna&_nc_gid=WcwdBNgmsQH2FyyZK7KI_A&_nc_ss=8&oh=00_AfzGvCdkiyzlTeSs6sqFWTFyQBWQHdmxlrdGxpHsMEj5JA&oe=69BD8D26"
];

const FEATURED_STATIC_IMAGES = [
  "https://cdn2.blanxer.com/uploads/67cd36dcf133882caba612b4/product_image-dsc03423-6408.webp", // Lifestyle for Two-Way Zip
  "https://cdn2.blanxer.com/uploads/67cd36dcf133882caba612b4/product_image-dsc02288-edit-2-8008.webp", // Lifestyle for Essential Hoodie
];

function FeaturedProductCard({ product, index }: { product: ProductApi; index: number }) {
  const [mobileImageIndex, setMobileImageIndex] = useState(0);

  // Parse gallery images for mobile slideshow
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

  // Auto-cycle images on mobile
  useEffect(() => {
    if (galleryImages.length <= 1) return;
    const timer = setInterval(() => {
      setMobileImageIndex((prev) => (prev + 1) % galleryImages.length);
    }, 2000);
    return () => clearInterval(timer);
  }, [galleryImages.length]);

  const staticImage = FEATURED_STATIC_IMAGES[index] ?? (product.galleryUrls ? JSON.parse(product.galleryUrls)[0] : product.imageUrl ?? "");

  return (
    <Link
      href={`/product/${product.id}`}
      className="group cursor-pointer relative"
    >
      <div className="relative overflow-hidden bg-gray-50 dark:bg-muted/30 aspect-[4/5] rounded-xl shadow-2xl transition-all duration-300 hover:shadow-white/5">
        {/* Desktop view — hover swap (hidden on mobile) */}
        <div className="hidden md:block absolute inset-0 z-0">
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

        {/* Mobile view — auto-sliding gallery (hidden on desktop) */}
        <div className="md:hidden absolute inset-0 z-0">
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
          {/* Slide indicators */}
          {galleryImages.length > 1 && (
            <div className="absolute top-3 left-1/2 -translate-x-1/2 z-20 flex gap-1.5">
              {galleryImages.map((_: string, dotIdx: number) => (
                <div
                  key={dotIdx}
                  className={`h-1 rounded-full transition-all duration-500 ${
                    dotIdx === mobileImageIndex
                      ? "w-5 bg-white shadow-lg"
                      : "w-1.5 bg-white/40"
                  }`}
                />
              ))}
            </div>
          )}
        </div>

        {/* Desktop: Dark Gradient Overlay on Hover */}
        <div className="hidden md:block absolute inset-0 bg-gradient-to-t from-black/90 via-black/30 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none z-10" />

        {/* Mobile: Always-visible gradient overlay */}
        <div className="md:hidden absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent pointer-events-none z-10" />

        {/* Desktop: Glassmorphism Detail Reveal on Hover */}
        <div 
          className="hidden md:flex absolute inset-x-4 bottom-4 z-20 p-6 backdrop-blur-xl bg-black/40 border border-white/10 rounded-2xl shadow-xl justify-between items-center opacity-0 translate-y-4 group-hover:opacity-100 group-hover:translate-y-0 transition-all duration-700 ease-out"
        >
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
              <p className="text-white/70 font-medium text-lg">
                {formatPrice(product.price)}
              </p>
            )}
          </div>
          <div className="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center border border-white/30 text-white">
            <ArrowRight className="w-5 h-5" />
          </div>
        </div>

        {/* Mobile: Always-visible product info */}
        <div className="md:hidden absolute inset-x-3 bottom-3 z-20 p-4 backdrop-blur-xl bg-black/40 border border-white/10 rounded-xl shadow-xl">
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

        {/* Desktop: External link button on hover */}
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            window.open(`/product/${product.id}`, "_blank");
          }}
          className="absolute top-4 right-4 z-30 hidden md:flex h-10 w-10 items-center justify-center rounded-full bg-black/50 text-white backdrop-blur-md border border-white/10 opacity-0 group-hover:opacity-100 transition-all duration-300 hover:bg-white hover:text-black"
        >
          <ExternalLink className="h-4 w-4" />
        </button>
      </div>
    </Link>
  );
}

export default function Home() {
  const [carouselIndex, setCarouselIndex] = useState(0);
  const [isMobile, setIsMobile] = useState(false);
  const [heroIndex, setHeroIndex] = useState(0);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [videoFailed, setVideoFailed] = useState(false);
  const heroVideoRef = useRef<HTMLVideoElement>(null);
  const autoPlayRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const touchStartX = useRef(0);
  const touchEndX = useRef(0);
  const dragStartX = useRef(0);
  const isDragging = useRef(false);
  const interactionTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { scrollYProgress } = useScroll();
  const yParallax = useTransform(scrollYProgress, [0, 1], [0, -200]);

  const { data: featuredProducts = [], isSuccess: isFeaturedSuccess } = useQuery({
    queryKey: ["products", "featured", { limit: 2 }],
    queryFn: () => fetchProducts({ limit: 2 }),
  });

  const { data: newArrivals = [], isSuccess: isNewArrivalsSuccess } = useQuery({
    queryKey: ["products", "new-arrivals", { limit: 4 }],
    queryFn: () => fetchProducts({ limit: 4 }),
  });

  const {
    data: heroAssets = [],
    isLoading: heroLoading,
  } = useQuery<SiteAsset[]>({
    queryKey: ["siteAssets", "hero"],
    queryFn: () =>
      fetch("/api/site-assets/hero")
        .then((r) => r.json())
        .then((r) => r.data ?? []),
    staleTime: 5 * 60 * 1000,
  });

  const { data: featuredAssets = [] } = useQuery<SiteAsset[]>({
    queryKey: ["siteAssets", "featured_collection"],
    queryFn: () =>
      fetch("/api/site-assets/featured_collection")
        .then((r) => r.json())
        .then((r) => r.data ?? []),
    staleTime: 5 * 60 * 1000,
  });

  const { data: campaignAssets = [] } = useQuery<SiteAsset[]>({
    queryKey: ["siteAssets", "new_collection"],
    queryFn: () =>
      fetch("/api/site-assets/new_collection")
        .then((r) => r.json())
        .then((r) => r.data ?? []),
    staleTime: 5 * 60 * 1000,
  });

  // Device detection
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 1024);
    };
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  const showHeroVideo = isMobile && !videoFailed;

  // Hero images from CMS assets (fallback to placeholder)
  const heroImages = useMemo(() => {
    const images = heroAssets
      .filter(a => a.active && a.assetType === "image")
      .map(a => a.imageUrl);
    return images.length > 0 ? images : HERO_IMAGES_FALLBACK;
  }, [heroAssets]);

  const lifestyleImages = featuredAssets.length > 0
    ? featuredAssets.map((a) => a.imageUrl)
    : LIFESTYLE_IMAGES_FALLBACK;

  const campaignBannerImage = campaignAssets.length > 0
    ? campaignAssets[0].imageUrl
    : "/images/landingpage3.webp";

  // Finish pre-loader only when data is ready (Hydration-First)
  useEffect(() => {
    if (isFeaturedSuccess && isNewArrivalsSuccess) {
      // Small delay to ensure browser paint
      const timer = setTimeout(() => {
        if (typeof (window as any).finishLoading === 'function') {
          (window as any).finishLoading();
        }
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [isFeaturedSuccess, isNewArrivalsSuccess]);

  // Preload static campaign images
  useEffect(() => {
    heroImages.forEach((src: string) => {
      const img = new Image();
      img.src = src;
    });
    lifestyleImages.forEach((src) => {
      if (!src.startsWith('http')) {
        const img = new Image();
        img.src = src;
      }
    });
  }, [heroImages, lifestyleImages]);

  const goToSlide = useCallback((index: number) => {
    if (isTransitioning) return;
    setIsTransitioning(true);
    setCarouselIndex(index);
    setTimeout(() => setIsTransitioning(false), 600);
  }, [isTransitioning]);

  const goNext = useCallback(() => {
    goToSlide((carouselIndex + 1) % lifestyleImages.length);
  }, [carouselIndex, goToSlide, lifestyleImages.length]);

  const goPrev = useCallback(() => {
    goToSlide((carouselIndex - 1 + lifestyleImages.length) % lifestyleImages.length);
  }, [carouselIndex, goToSlide, lifestyleImages.length]);

  // Pause auto-scroll on interaction, resume after 5s
  const pauseAutoScroll = useCallback(() => {
    if (autoPlayRef.current) {
      clearInterval(autoPlayRef.current);
      autoPlayRef.current = null;
    }
    if (interactionTimeoutRef.current) {
      clearTimeout(interactionTimeoutRef.current);
    }
    interactionTimeoutRef.current = setTimeout(() => {
      autoPlayRef.current = setInterval(() => {
        setCarouselIndex((i) => (i + 1) % lifestyleImages.length);
      }, 5000);
    }, 5000);
  }, [lifestyleImages.length]);

  // Auto-scroll effect for lifestyle carousel + hero image fallback cycling
  useEffect(() => {
    autoPlayRef.current = setInterval(() => {
      setCarouselIndex((i) => (i + 1) % lifestyleImages.length);
    }, 5000);

    // Cycle hero images when video isn't used (desktop) or video failed.
    let heroInterval: ReturnType<typeof setInterval> | null = null;
    if ((!showHeroVideo || videoFailed) && heroImages.length > 1) {
      heroInterval = setInterval(() => {
        setHeroIndex((prev) => (prev + 1) % heroImages.length);
      }, 6000);
    }

    return () => {
      if (autoPlayRef.current) clearInterval(autoPlayRef.current);
      if (interactionTimeoutRef.current) clearTimeout(interactionTimeoutRef.current);
      if (heroInterval) clearInterval(heroInterval);
    };
  }, [lifestyleImages.length, heroImages.length, videoFailed, showHeroVideo]);


  // Touch handlers
  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
    touchEndX.current = e.touches[0].clientX;
    pauseAutoScroll();
  };
  const handleTouchMove = (e: React.TouchEvent) => {
    touchEndX.current = e.touches[0].clientX;
  };
  const handleTouchEnd = () => {
    const diff = touchStartX.current - touchEndX.current;
    if (Math.abs(diff) > 50) {
      if (diff > 0) goNext();
      else goPrev();
    }
  };

  // Mouse drag handlers
  const handleMouseDown = (e: React.MouseEvent) => {
    isDragging.current = true;
    dragStartX.current = e.clientX;
    pauseAutoScroll();
    e.preventDefault();
  };
  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging.current) return;
    e.preventDefault();
  };
  const handleMouseUp = (e: React.MouseEvent) => {
    if (!isDragging.current) return;
    isDragging.current = false;
    const diff = dragStartX.current - e.clientX;
    if (Math.abs(diff) > 50) {
      if (diff > 0) goNext();
      else goPrev();
    }
  };
  const handleMouseLeave = () => {
    if (isDragging.current) {
      isDragging.current = false;
    }
  };

  return (
    <div className="flex flex-col min-h-screen pt-20">
      <Helmet>
        <title>Rare Atelier | Home - Premium Streetwear</title>
        <meta name="description" content="Welcome to Rare Atelier. Explore our premium streetwear and minimal luxury collection. Authentic style, timeless designs." />
        <meta property="og:title" content="Rare Atelier | Premium Streetwear" />
        <meta property="og:url" content={window.location.origin} />
      </Helmet>
      {/* Hero Section */}
      <section className="relative h-[90vh] min-h-[650px] md:min-h-[750px] lg:min-h-[850px] w-full overflow-hidden bg-neutral-900">
        {/* Native Video Background – autoplay, loop, muted */}
        {showHeroVideo ? (
          <motion.div
            key="hero-video"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 1.5, ease: "easeInOut" }}
            className="absolute inset-0 w-full h-full"
          >
            <video
              ref={heroVideoRef}
              autoPlay
              loop
              muted
              playsInline
              preload="auto"
              poster={heroImages[0] || undefined}
              onError={() => setVideoFailed(true)}
              className="w-full h-full object-cover"
            >
              <source src="/videos/videorare.mp4" type="video/mp4" />
            </video>
          </motion.div>
        ) : heroLoading ? (
          <div
            className="absolute inset-0 w-full h-full animate-pulse bg-muted"
            style={{ aspectRatio: "1920/800" }}
          />
        ) : (
          <AnimatePresence mode="popLayout">
            <motion.div
              key={`hero-image-${heroIndex}`}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 1.5, ease: "easeInOut" }}
              className="absolute inset-0 w-full h-full"
            >
              {heroImages[heroIndex] ? (
                <OptimizedImage
                  src={heroImages[heroIndex]}
                  alt="Luxury street style campaign"
                  className="w-full h-full object-cover object-center"
                  priority
                  loading="eager"
                />
              ) : (
                <div className="w-full h-full bg-neutral-900" />
              )}
            </motion.div>
          </AnimatePresence>
        )}
        <div className="absolute inset-0 bg-black/40 dark:bg-luminous-glow transition-colors duration-700 pointer-events-none" />

        {/* Editorial Left Text Section */}
        <div className="absolute inset-0 flex items-start md:items-center container mx-auto px-6 sm:px-12 md:px-16 pt-32 sm:pt-40 md:pt-0 pointer-events-none z-10">
          <div className="flex items-center gap-6 md:gap-12 pl-2">
            {/* Elegant Vertical Line */}
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "clamp(120px, 20vh, 180px)", opacity: 0.4 }}
              transition={{ duration: 1.2, ease: [0.22, 1, 0.36, 1], delay: 0.2 }}
              className="w-px bg-white hidden md:block"
            />
            
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 1, ease: [0.22, 1, 0.36, 1] }}
              className="text-white flex flex-col items-start w-full"
            >
              {/* Premium Archival Detail */}
              <span className="text-[9px] md:text-xs tracking-[0.4em] md:tracking-[0.5em] opacity-40 font-bold mb-4 md:mb-6 block uppercase">
                [W'25/ARCHIVE]
              </span>
              
              <h1 className="font-serif text-6xl sm:text-7xl md:text-8xl lg:text-9xl font-semibold leading-[0.9] tracking-tighter shadow-black/20 text-shadow-sm">
                Beyond
                <br />
                Trends.
              </h1>
              
              <p className="mt-4 md:mt-8 text-xl sm:text-3xl md:text-4xl font-serif italic opacity-70 tracking-wide text-shadow-sm">
                Beyond Time.
              </p>
            </motion.div>
          </div>
        </div>

        {/* Center CTA group with stagger animation */}
        <div className="absolute inset-0 flex items-end justify-center pb-24 sm:pb-32 md:pb-20 md:items-end pt-0 md:pt-0 pointer-events-none z-20">
          <div className="flex flex-col items-center gap-4 md:gap-5 pointer-events-auto">
            {/* Animated reveal line */}
            <motion.div
              initial={{ scaleX: 0 }}
              animate={{ scaleX: 1 }}
              transition={{ duration: 0.7, delay: 0.3, ease: [0.22, 1, 0.36, 1] }}
              className="w-12 md:w-16 h-px bg-white/50 origin-center hidden md:block"
            />

            {/* CTA Button */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.6, ease: [0.22, 1, 0.36, 1] }}
            >
              <Button
                size="lg"
                asChild
                className="rounded-none bg-white text-black hover:bg-white/90 px-8 sm:px-12 md:px-16 h-12 sm:h-14 md:h-15 text-[9px] md:text-xs uppercase tracking-[0.3em] md:tracking-[0.4em] font-black transition-all duration-300 hover:scale-105 active:scale-95 shadow-2xl hero-btn-glow group"
              >
                <Link href="/products" className="flex items-center gap-3">
                  Explore Shop
                  <ArrowRight className="w-4 h-4 group-hover:translate-x-2 transition-transform duration-300" />
                </Link>
              </Button>
            </motion.div>

            {/* Tagline below button */}
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.6 }}
              transition={{ duration: 0.8, delay: 1.0, ease: "easeOut" }}
              className="text-[8px] md:text-[11px] tracking-[0.5em] md:tracking-[0.7em] uppercase text-white font-bold text-shadow-sm mt-1 md:mt-0"
            >
              Authenticity In Motion
            </motion.p>
          </div>
        </div>
      </section>

      {/* Quote Section */}
      {/* Quote Section - Glassmorphism & Aurora Effect */}
      <section className="py-16 md:py-24 bg-white dark:bg-neutral-950 relative overflow-hidden transition-colors duration-500">
        {/* Subtle Aurora Background */}
        <div className="absolute inset-0 pointer-events-none opacity-40 dark:opacity-30">
          <motion.div 
            animate={{ 
              x: [0, 50, -50, 0],
              y: [0, -30, 30, 0],
              scale: [1, 1.2, 0.9, 1]
            }}
            transition={{ duration: 15, repeat: Infinity, ease: "linear" }}
            className="absolute top-[-10%] left-[10%] w-[500px] h-[500px] bg-primary/20 blur-[120px] rounded-full"
          />
          <motion.div 
            animate={{ 
              x: [0, -60, 40, 0],
              y: [0, 40, -40, 0],
              scale: [1, 0.8, 1.1, 1]
            }}
            transition={{ duration: 18, repeat: Infinity, ease: "linear" }}
            className="absolute bottom-[-10%] right-[10%] w-[450px] h-[450px] bg-primary/10 blur-[120px] rounded-full"
          />
        </div>
        
        <div className="relative max-w-5xl mx-auto px-6">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 1, ease: [0.22, 1, 0.36, 1] }}
            className="relative p-8 md:p-16 rounded-[2rem] border border-white/20 dark:border-white/10 bg-white/40 dark:bg-white/5 backdrop-blur-2xl shadow-[0_8px_32px_0_rgba(0,0,0,0.05)] dark:shadow-[0_8px_32px_0_rgba(0,0,0,0.3)] overflow-hidden group"
          >
            {/* Iridescent border glow */}
            <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-transparent to-primary/5 opacity-0 group-hover:opacity-100 transition-opacity duration-700 pointer-events-none" />
            
            <div className="relative flex flex-col items-center text-center">
              <div className="h-px w-10 bg-primary/40 mb-8" />
              
              <h2 className="text-2xl md:text-5xl lg:text-5xl font-serif italic leading-tight tracking-tight max-w-3xl text-neutral-900 dark:text-neutral-50 mb-10">
                {"The best way to predict the future is to create it.".split(" ").map((word, i) => (
                  <motion.span
                    key={i}
                    initial={{ opacity: 0, y: 15 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ 
                      duration: 0.6, 
                      delay: i * 0.08,
                      ease: [0.22, 1, 0.36, 1]
                    }}
                    className="inline-block mr-[0.3em] last:mr-0"
                  >
                    {word}
                  </motion.span>
                ))}
              </h2>

              <motion.div
                initial={{ opacity: 0 }}
                whileInView={{ opacity: 0.7 }}
                viewport={{ once: true }}
                transition={{ duration: 1, delay: 1 }}
                className="flex items-center gap-4"
              >
                <div className="h-px w-6 bg-primary/30" />
                <span className="text-[10px] md:text-xs tracking-[0.4em] uppercase font-black text-primary/80 dark:text-primary/90">
                  Alan Kay
                </span>
                <div className="h-px w-6 bg-primary/30" />
              </motion.div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Featured Collection */}
      <section className="py-24 container mx-auto px-6 max-w-7xl">
        <div className="flex justify-between items-end mb-16">
          <div>
            <h2 className="text-sm font-bold uppercase tracking-[0.3em] text-muted-foreground mb-2">
              Editor's Choice
            </h2>
            <h3 className="text-4xl font-black uppercase tracking-tighter">
              Featured Collection
            </h3>
          </div>
          <Link
            href="/products"
            className="text-xs font-bold uppercase tracking-widest border-b border-black pb-1 hover:opacity-60 transition-opacity"
          >
            View All
          </Link>
        </div>

        {/* Lifestyle carousel — swipeable with slide transitions */}
        <div
          className="relative aspect-video md:aspect-[21/9] overflow-hidden rounded-sm mb-16 bg-neutral-100 dark:bg-neutral-900 cursor-grab active:cursor-grabbing select-none group/carousel"
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseLeave}
        >
          {/* Sliding images container */}
          <div
            className="flex h-full transition-transform duration-600 ease-in-out"
            style={{ transform: `translateX(-${carouselIndex * 100}%)` }}
          >
            {lifestyleImages.map((src, i) => (
              <img
                key={src}
                src={src}
                alt={`Featured collection image ${i + 1}`}
                className="w-full h-full object-cover object-center flex-shrink-0"
                draggable={false}
              />
            ))}
          </div>

          {/* Left arrow */}
          <button
            onClick={(e) => { e.stopPropagation(); pauseAutoScroll(); goPrev(); }}
            className="absolute left-3 top-1/2 -translate-y-1/2 z-20 flex h-10 w-10 items-center justify-center rounded-full bg-black/40 text-white backdrop-blur-sm opacity-0 group-hover/carousel:opacity-100 transition-all duration-300 hover:bg-black/60 hover:scale-110"
            aria-label="Previous slide"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>

          {/* Right arrow */}
          <button
            onClick={(e) => { e.stopPropagation(); pauseAutoScroll(); goNext(); }}
            className="absolute right-3 top-1/2 -translate-y-1/2 z-20 flex h-10 w-10 items-center justify-center rounded-full bg-black/40 text-white backdrop-blur-sm opacity-0 group-hover/carousel:opacity-100 transition-all duration-300 hover:bg-black/60 hover:scale-110"
            aria-label="Next slide"
          >
            <ChevronRight className="h-5 w-5" />
          </button>

          {/* Dynamic dot indicators */}
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-20 flex gap-2.5 items-center bg-black/20 backdrop-blur-sm rounded-full px-3 py-2">
            {lifestyleImages.map((_, i) => (
              <button
                key={i}
                onClick={(e) => { e.stopPropagation(); pauseAutoScroll(); goToSlide(i); }}
                className={`rounded-full transition-all duration-500 ease-out ${
                  i === carouselIndex
                    ? "w-7 h-2.5 bg-white shadow-lg shadow-white/30"
                    : "w-2.5 h-2.5 bg-white/40 hover:bg-white/70 hover:scale-125"
                }`}
                aria-label={`Go to slide ${i + 1}`}
              />
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {featuredProducts.map((product, i) => (
            <FeaturedProductCard key={product.id} product={product} index={i} />
          ))}
        </div>
      </section>

      {/* Campaign Banner - Final Refined Transparency & Logo Sizing */}
      <section className="relative h-[80vh] w-full overflow-hidden my-32 group/banner">
        <motion.div 
          style={{ y: yParallax }}
          className="absolute inset-0 w-full h-[120%] -top-[10%]"
        >
          <img
            alt={campaignAssets[0]?.altText || "Campaign story"}
            className="w-full h-full object-cover object-center"
            src={campaignBannerImage}
          />
        </motion.div>
        
        <div 
          className="absolute inset-0 z-10 pointer-events-none opacity-0 group-hover/banner:opacity-100 transition-opacity duration-1000"
          onMouseMove={(e) => {
            const rect = e.currentTarget.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;
            e.currentTarget.style.setProperty('--mouse-x', `${x}px`);
            e.currentTarget.style.setProperty('--mouse-y', `${y}px`);
          }}
          style={{
            background: 'radial-gradient(circle at var(--mouse-x) var(--mouse-y), rgba(255,255,255,0.08) 0%, transparent 40%)'
          } as any}
        />

        <div className="absolute inset-0 bg-black/40 dark:bg-luminous-glow transition-colors duration-700" />
        
        <div className="absolute inset-0 flex items-center justify-center p-6 sm:p-12 z-20">
          <motion.div 
            initial={{ opacity: 0, y: 50 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 1, ease: "easeOut" }}
            className="max-w-xl w-full backdrop-blur-[2px] bg-transparent border border-white/10 p-6 md:p-10 text-center text-white rounded-3xl shadow-2xl overflow-hidden relative"
          >
            {/* Ambient revolving background elements inside glass */}
            <div className="absolute top-0 right-0 p-4">
               <Gem className="w-4 h-4 text-white/10 animate-revolve" />
            </div>
            
            <h2 className="text-[14px] md:text-lg font-black mb-4 tracking-[0.4em] uppercase leading-tight italic">
              Explore the <br/><span className="not-italic text-outline-white">journey behind.</span>
            </h2>
            <p className="text-[10px] md:text-xs opacity-60 font-bold tracking-[0.3em] uppercase max-w-sm mx-auto mb-8 leading-relaxed">
              Discover the meticulous craftsmanship and story of the Winter '25 collection.
            </p>
            <Button
              variant="outline"
              className="rounded-full px-8 h-12 border-white/20 text-white hover:bg-white hover:text-black transition-all uppercase text-[8px] tracking-[0.4em] font-black group/btn shadow-xl hover:shadow-white/20 active:scale-95"
              asChild
            >
              <Link href="/new-collection" className="flex items-center gap-3">
                Explore Collection <ArrowRight className="w-3 h-3 group-hover/btn:translate-x-1.5 transition-transform" />
              </Link>
            </Button>
          </motion.div>
        </div>
      </section>

      {/* New Arrivals */}
      <section className="py-24 container mx-auto px-6 max-w-7xl">
        <h2 className="text-sm font-bold uppercase tracking-[0.3em] text-center text-muted-foreground mb-4">
          Latest Drops
        </h2>
        <h3 className="text-4xl font-black uppercase tracking-tighter text-center mb-20">
          New Arrivals
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-x-8 gap-y-16">
          {newArrivals.map((product) => (
            <Link
              key={product.id}
              href={`/product/${product.id}`}
              className="group cursor-pointer"
            >
              <div className="relative overflow-hidden bg-gray-50 dark:bg-muted/30 aspect-[3/4] mb-6 rounded-lg group-hover:shadow-xl transition-all duration-500">
                <motion.div
                  className="w-full h-full"
                  whileHover={{ scale: 1.05 }}
                  transition={{ duration: 0.8 }}
                >
                  <OptimizedImage
                    src={product.imageUrl ?? ""}
                    alt={product.name}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-1000"
                  />
                  {/* Hover Secondary View */}
                  <div className="absolute inset-0 opacity-0 group-hover:opacity-30 mix-blend-overlay transition-opacity duration-700 bg-white" />
                </motion.div>

                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    window.open(`/product/${product.id}`, "_blank");
                  }}
                  className="absolute top-3 right-3 z-10 flex h-7 w-7 items-center justify-center rounded-full bg-white/20 text-white backdrop-blur-md opacity-0 group-hover:opacity-100 transition-opacity border border-white/30"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                </button>

                {/* Dynamic Price floating on hover */}
                <div className="absolute bottom-2 left-2 truncate opacity-0 group-hover:opacity-100 transform translate-y-2 group-hover:translate-y-0 transition-all duration-300 pointer-events-none flex flex-col gap-1 items-start">
                   {product.saleActive && Number(product.salePercentage) > 0 && (
                     <span className="bg-primary text-primary-foreground text-[8px] font-black uppercase tracking-[0.2em] px-2 py-1 rounded shadow-xl animate-pulse">
                        {product.salePercentage}% OFF
                     </span>
                   )}
                   <span className="bg-white/90 dark:bg-black/80 text-zinc-900 dark:text-white text-[10px] px-2 py-1 rounded-full backdrop-blur-sm font-bold tracking-widest uppercase flex items-center gap-2 border border-black/5 dark:border-white/5">
                    {product.saleActive && Number(product.salePercentage) > 0 ? (
                      <>
                        <span className="text-primary">
                          {formatPrice(Number(product.price) * (1 - Number(product.salePercentage) / 100))}
                        </span>
                        <span className="text-zinc-500/50 dark:text-white/50 line-through text-[8px]">
                          {formatPrice(product.price)}
                        </span>
                      </>
                    ) : (
                      formatPrice(product.price)
                    )}
                   </span>
                </div>
              </div>
              <div className="px-1">
                <h3 className="text-xs font-black uppercase tracking-widest truncate mb-1 text-foreground/80 group-hover:text-primary transition-colors">
                  {product.name}
                </h3>
              </div>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
