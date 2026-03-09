import { useState, useEffect, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { formatPrice } from "@/lib/format";
import { MOCK_PRODUCTS } from "@/lib/mockData";
import { Link } from "wouter";
import { ExternalLink, Sparkles, Star, Gem, Diamond, ChevronLeft, ChevronRight } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { fetchProducts, type ProductApi } from "@/lib/api";
import { motion, AnimatePresence } from "framer-motion";
import { OptimizedImage } from "@/components/ui/OptimizedImage";

const HERO_IMAGES = [
  "/images/landingpage3.webp",
  "/images/landingpage4.webp"
];

const LIFESTYLE_IMAGES = [
  "/images/feature1.webp",
  "/images/feature2.webp",
  "/images/feature3.webp",
];


export default function Home() {
  const [carouselIndex, setCarouselIndex] = useState(0);
  const [heroIndex, setHeroIndex] = useState(0);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const autoPlayRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const touchStartX = useRef(0);
  const touchEndX = useRef(0);
  const dragStartX = useRef(0);
  const isDragging = useRef(false);
  const interactionTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { data: featuredProducts = [] } = useQuery({
    queryKey: ["products", "featured", { limit: 2 }],
    queryFn: () => fetchProducts({ limit: 2 }),
  });

  const { data: newArrivals = [] } = useQuery({
    queryKey: ["products", "new-arrivals", { limit: 4 }],
    queryFn: () => fetchProducts({ limit: 4 }),
  });

  // Preload static campaign images
  useEffect(() => {
    HERO_IMAGES.forEach((src) => {
      const img = new Image();
      img.src = src;
    });
    LIFESTYLE_IMAGES.forEach((src) => {
      if (!src.startsWith('http')) {
        const img = new Image();
        img.src = src;
      }
    });
  }, []);

  const goToSlide = useCallback((index: number) => {
    if (isTransitioning) return;
    setIsTransitioning(true);
    setCarouselIndex(index);
    setTimeout(() => setIsTransitioning(false), 600);
  }, [isTransitioning]);

  const goNext = useCallback(() => {
    goToSlide((carouselIndex + 1) % LIFESTYLE_IMAGES.length);
  }, [carouselIndex, goToSlide]);

  const goPrev = useCallback(() => {
    goToSlide((carouselIndex - 1 + LIFESTYLE_IMAGES.length) % LIFESTYLE_IMAGES.length);
  }, [carouselIndex, goToSlide]);

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
        setCarouselIndex((i) => (i + 1) % LIFESTYLE_IMAGES.length);
      }, 5000);
    }, 5000);
  }, []);

  // Auto-scroll effect
  useEffect(() => {
    autoPlayRef.current = setInterval(() => {
      setCarouselIndex((i) => (i + 1) % LIFESTYLE_IMAGES.length);
    }, 5000);
    
    const heroTimer = setInterval(() => {
      setHeroIndex((prev) => (prev + 1) % HERO_IMAGES.length);
    }, 8000);

    return () => {
      if (autoPlayRef.current) clearInterval(autoPlayRef.current);
      if (interactionTimeoutRef.current) clearTimeout(interactionTimeoutRef.current);
      clearInterval(heroTimer);
    };
  }, []);

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
      {/* Hero Section */}
      <section className="relative h-[90vh] w-full overflow-hidden bg-neutral-900">
        <AnimatePresence mode="popLayout">
          <motion.div
            key={heroIndex}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ 
              duration: 1.5,
              ease: "easeInOut"
            }}
            className="absolute inset-0 w-full h-full"
          >
            <OptimizedImage
              src={HERO_IMAGES[heroIndex]}
              alt="Luxury street style campaign"
              className="w-full h-full object-cover"
              priority={true}
            />
          </motion.div>
        </AnimatePresence>
        <div className="absolute inset-0 bg-black/40 dark:bg-luminous-glow transition-colors duration-700 pointer-events-none" />

        <div className="absolute inset-0 flex items-center justify-center container mx-auto px-6">
          <div className="animate-in fade-in zoom-in duration-1000 max-w-4xl w-full text-white text-center flex flex-col items-center gap-y-6 md:gap-y-8 mx-auto">
            <h1 className="font-serif text-4xl sm:text-6xl md:text-7xl lg:text-8xl font-bold leading-[1.1] tracking-tighter drop-shadow-xl">
              Beyond Trends.
              <br />
              Beyond Time.
            </h1>
            <p className="text-xs md:text-sm tracking-[0.6em] uppercase opacity-80 font-light">
              Authenticity In Motion
            </p>
            <div className="mt-4 md:mt-8">
              <Button
                size="lg"
                asChild
                className="rounded-none bg-white text-black hover:bg-white/90 px-12 h-14 md:h-16 text-sm uppercase tracking-widest font-bold transition-all hover:scale-105 active:scale-95 shadow-xl"
              >
                <Link href="/products">Explore Shop</Link>
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Quote Section */}
      <section className="py-16 md:py-20 bg-neutral-950 text-white relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-neutral-900 via-neutral-950 to-neutral-950" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full bg-white/5 blur-3xl" />
        
        {/* Floating/revolving animated icons */}
        <div className="absolute inset-0 pointer-events-none">
          <Sparkles className="absolute top-[15%] left-[10%] w-5 h-5 text-white/20 animate-float" />
          <Star className="absolute top-[20%] right-[12%] w-4 h-4 text-white/15 animate-float-delayed" />
          <Gem className="absolute bottom-[20%] left-[8%] w-4 h-4 text-white/15 animate-float-delayed" style={{ animationDelay: '1s' }} />
          <Diamond className="absolute bottom-[25%] right-[15%] w-5 h-5 text-white/20 animate-float" style={{ animationDelay: '2s' }} />
          <Sparkles className="absolute top-[50%] left-[5%] w-3 h-3 text-white/10 animate-sparkle" style={{ animationDelay: '0.5s' }} />
          <Star className="absolute top-[40%] right-[6%] w-3 h-3 text-white/10 animate-sparkle" style={{ animationDelay: '1.5s' }} />
          {/* Revolving icon around quote center */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
            <Diamond className="w-3 h-3 text-white/15 animate-revolve" />
          </div>
        </div>

        <div className="relative max-w-4xl mx-auto px-6">
          <div className="flex flex-col md:flex-row items-center gap-8 md:gap-12">
            <div className="flex items-center gap-4 shrink-0 relative">
              {/* Fading image with organic shape */}
              <div className="relative w-20 h-20 md:w-24 md:h-24">
                <div 
                  className="w-full h-full animate-in fade-in zoom-in duration-700"
                  style={{
                    clipPath: 'polygon(50% 0%, 93% 25%, 93% 75%, 50% 100%, 7% 75%, 7% 25%)',
                  }}
                >
                  <OptimizedImage
                    src="/images/walter-landor.webp"
                    alt="Walter Landor"
                    className="w-full h-full object-cover"
                    fallbackExt="png"
                  />

                </div>
                {/* Fading glow around the shape */}
                <div 
                  className="absolute inset-[-4px] bg-gradient-to-br from-white/20 via-transparent to-white/10 blur-sm -z-10"
                  style={{
                    clipPath: 'polygon(50% 0%, 93% 25%, 93% 75%, 50% 100%, 7% 75%, 7% 25%)',
                  }}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <div className="flex gap-2 items-center">
                  <Sparkles className="w-3 h-3 text-white/50 animate-sparkle" />
                  <Gem className="w-3 h-3 text-white/30 animate-sparkle" style={{ animationDelay: '1s' }} />
                  <Star className="w-3 h-3 text-white/20 animate-sparkle" style={{ animationDelay: '2s' }} />
                </div>
              </div>
            </div>
            <div className="text-center md:text-left">
              <p className="text-2xl md:text-4xl italic font-serif text-white/95 leading-snug animate-in fade-in slide-in-from-bottom-4 duration-700">
                &ldquo;Products are made in a factory but brands are created in the mind.&rdquo;
              </p>
              <div className="mt-6 flex items-center justify-center md:justify-start gap-4">
                <div className="h-px flex-1 max-w-12 bg-white/30" />
                <p className="text-xs tracking-[0.3em] uppercase text-neutral-400 font-bold">
                  Walter Landor
                </p>
                <div className="h-px flex-1 max-w-12 bg-white/30" />
              </div>
            </div>
          </div>
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
            {LIFESTYLE_IMAGES.map((src, i) => (
              <img
                key={src}
                src={src}
                alt={`Featured collection image ${i + 1}`}
                className="w-full h-full object-cover flex-shrink-0"
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
            {LIFESTYLE_IMAGES.map((_, i) => (
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

        <div className="grid grid-cols-1 md:grid-cols-2 gap-16">
          {featuredProducts.map((product) => (
            <Link
              key={product.id}
              href={`/product/${product.id}`}
              className="group cursor-pointer"
            >
              <div className="relative overflow-hidden bg-gray-50 dark:bg-muted/30 aspect-[4/5]">
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
                <img
                  src={product.imageUrl ?? ""}
                  alt={product.name}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-1000"
                />
              </div>
              <div className="mt-8">
                <h3 className="text-xl font-bold uppercase tracking-tighter mb-1">
                  {product.name}
                </h3>
                <p className="font-medium text-lg text-muted-foreground">
                  {formatPrice(product.price)}
                </p>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* Campaign Banner */}
      <section className="relative h-[80vh] w-full overflow-hidden my-24">
        <img
          alt="Campaign story"
          className="w-full h-full object-cover"
          src="https://i.ibb.co/DPgdPLtS/Chat-GPT-Image-Mar-6-2026-08-28-46-PM.png?auto=format&fit=crop&q=80&w=2000"
        />
        <div className="absolute inset-0 bg-black/30 dark:bg-luminous-glow transition-colors duration-700" />
        <div className="absolute inset-0 flex items-center justify-center text-center text-white p-4">
          <div className="max-w-2xl animate-in zoom-in duration-1000">
            <h2 className="font-serif text-4xl md:text-7xl font-bold mb-6 tracking-tight">
              Explore the journey behind
            </h2>
            <p className="text-xl opacity-90 font-light tracking-wide">
              our Winter '25 collection.
            </p>
            <Button
              variant="outline"
              className="mt-12 rounded-none px-12 h-14 border-white text-white hover:bg-white hover:text-black transition-all uppercase text-xs tracking-widest font-bold"
              asChild
            >
              <Link href="/products?category=WINTER_25">Read Story</Link>
            </Button>
          </div>
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
              <div className="relative overflow-hidden bg-gray-50 dark:bg-muted/30 aspect-[3/4] mb-6">
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
                <img
                  src={product.imageUrl ?? ""}
                  alt={product.name}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-1000"
                />
              </div>
              <div>
                <h3 className="text-xs font-bold uppercase tracking-widest truncate mb-1">
                  {product.name}
                </h3>
                <p className="text-muted-foreground text-xs font-medium">
                  {formatPrice(product.price)}
                </p>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* Footer / Newsletter */}
      <footer className="bg-[#0A0A0A] text-white pt-32 pb-12">
        <div className="container mx-auto px-6 max-w-7xl">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-16 mb-32">
            <div className="col-span-1">
              <img
                src="https://cdn2.blanxer.com/brand_logo/67cd36dcf133882caba612b4/67d00c07ef86879da12106aa.webp"
                alt="RARE"
                className="h-12 w-auto mb-8 object-contain brightness-0 invert"
              />
              <p className="text-gray-500 text-sm leading-relaxed tracking-wide">
                Khusibu, Nayabazar, Kathmandu
                <br />
                (+977)-9705208960
                <br />
                rarenepal999@gmail.com
              </p>
            </div>
            <div>
              <h4 className="font-bold mb-8 uppercase tracking-[0.2em] text-[10px] text-gray-400">
                Legals
              </h4>
              <ul className="space-y-4 text-xs tracking-widest">
                <li>
                  <Link
                    href="/shipping"
                    className="hover:text-gray-400 transition-colors"
                  >
                    Shipping Policy
                  </Link>
                </li>
                <li>
                  <Link
                    href="/refund"
                    className="hover:text-gray-400 transition-colors"
                  >
                    Refund Policy
                  </Link>
                </li>
                <li>
                  <Link
                    href="/privacy"
                    className="hover:text-gray-400 transition-colors"
                  >
                    Privacy Policy
                  </Link>
                </li>
                <li>
                  <Link
                    href="/terms"
                    className="hover:text-gray-400 transition-colors"
                  >
                    Terms of service
                  </Link>
                </li>
              </ul>
            </div>
            <div>
              <h4 className="font-bold mb-8 uppercase tracking-[0.2em] text-[10px] text-gray-400">
                Social
              </h4>
              <ul className="space-y-4 text-xs tracking-widest">
                <li>
                  <a href="https://www.facebook.com/rarenp" target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 hover:text-gray-400 transition-colors">
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                      <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
                    </svg>
                    Facebook
                  </a>
                </li>
                <li>
                  <a href="https://www.instagram.com/rare.np/" target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 hover:text-gray-400 transition-colors">
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                      <path d="M12.315 2c2.43 0 2.784.013 3.808.06 1.064.049 1.791.218 2.427.465a4.902 4.902 0 011.772 1.153 4.902 4.902 0 011.153 1.772c.247.636.416 1.363.465 2.427.048 1.067.06 1.407.06 4.123v.08c0 2.643-.012 2.987-.06 4.043-.049 1.064-.218 1.791-.465 2.427a4.902 4.902 0 01-1.153 1.772 4.902 4.902 0 01-1.772 1.153c-.636.247-1.363.416-2.427.465-1.067.048-1.407.06-4.123.06h-.08c-2.643 0-2.987-.012-4.043-.06-1.064-.049-1.791-.218-2.427-.465a4.902 4.902 0 01-1.772-1.153 4.902 4.902 0 01-1.153-1.772c-.247-.636-.416-1.363-.465-2.427-.047-1.024-.06-1.379-.06-3.808v-.63c0-2.43.013-2.784.06-3.808.049-1.064.218-1.791.465-2.427a4.902 4.902 0 011.153-1.772A4.902 4.902 0 015.45 2.525c.636-.247 1.363-.416 2.427-.465C8.901 2.013 9.256 2 11.685 2h.63zm-.081 1.802h-.468c-2.456 0-2.784.011-3.807.058-.975.045-1.504.207-1.857.344-.467.182-.8.398-1.15.748-.35.35-.566.683-.748 1.15-.137.353-.3.882-.344 1.857-.047 1.023-.058 1.351-.058 3.807v.468c0 2.456.011 2.784.058 3.807.045.975.207 1.504.344 1.857.182.466.399.8.748 1.15.35.35.683.566 1.15.748.353.137.882.3 1.857.344 1.054.048 1.37.058 4.041.058h.08c2.597 0 2.917-.01 3.96-.058.976-.045 1.505-.207 1.858-.344.466-.182.8-.398 1.15-.748.35-.35.566-.683.748-1.15.137-.353.3-.882.344-1.857.048-1.055.058-1.37.058-4.041v-.08c0-2.597-.01-2.917-.058-3.96-.045-.976-.207-1.505-.344-1.858a3.097 3.097 0 00-.748-1.15 3.098 3.098 0 00-1.15-.748c-.353-.137-.882-.3-1.857-.344-1.023-.047-1.351-.058-3.807-.058zM12 6.865a5.135 5.135 0 110 10.27 5.135 5.135 0 010-10.27zm0 1.802a3.333 3.333 0 100 6.666 3.333 3.333 0 000-6.666zm5.338-3.205a1.2 1.2 0 110 2.4 1.2 1.2 0 010-2.4z"/>
                    </svg>
                    Instagram
                  </a>
                </li>
              </ul>
            </div>
            <div>
              <h4 className="font-bold mb-8 uppercase tracking-[0.2em] text-[10px] text-gray-400">
                Newsletter
              </h4>
              <p className="text-xs text-gray-500 mb-6 tracking-wide leading-relaxed">
                Sign up for early access to drops and exclusive stories.
              </p>
              <form className="flex group border-b border-gray-800 focus-within:border-white transition-colors pb-2">
                <input
                  className="bg-transparent py-2 flex-1 focus:outline-none text-sm placeholder:text-gray-700"
                  placeholder="Email Address"
                />
                <button className="text-[10px] font-bold uppercase tracking-widest ml-4 hover:opacity-60 transition-opacity">
                  Join
                </button>
              </form>
            </div>
          </div>
          <div className="pt-8 border-t border-gray-900 flex flex-col md:flex-row justify-between items-center gap-6 text-[9px] uppercase tracking-[0.3em] text-gray-600 font-bold">
          </div>
        </div>
      </footer>
    </div>
  );
}
