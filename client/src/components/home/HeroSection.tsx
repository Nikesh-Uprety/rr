import { type RefObject, useEffect, useMemo, useRef, useState } from "react";
import { ArrowRight } from "lucide-react";
import { Link } from "wouter";
import { AnimatePresence, motion } from "framer-motion";

import { Button } from "@/components/ui/button";
import { OptimizedImage } from "@/components/ui/OptimizedImage";
import { MAISON_NOCTURNE_DEFAULT_HERO_SLIDES } from "@shared/canvasDefaults";

interface HeroSectionProps {
  heroImages: string[];
  heroIndex: number;
  heroLoading: boolean;
  videoFailed: boolean;
  isMobile: boolean;
  isTransitioning: boolean;
  onVideoError: () => void;
  heroVideoRef?: RefObject<HTMLVideoElement | null>;
  config?: Record<string, any>;
}

const DEFAULT_MAISON_SLIDES = MAISON_NOCTURNE_DEFAULT_HERO_SLIDES;

const DEFAULT_MAISON_HERO_IMAGES = DEFAULT_MAISON_SLIDES.map((slide) => slide.image);

const DEFAULT_NIKESH_SLIDES = [
  {
    tag: "W'25 / Archive",
    headline: "Beyond Trends.",
    eyebrow: "Authenticity in Motion",
    body: "Authenticity in Motion",
    ctaLabel: "Explore Shop",
    ctaHref: "/products",
  },
  {
    tag: "New Arrival · SS25",
    headline: "Basics Collar Jacket",
    eyebrow: "Unisex · Limited Edition",
    body: "Unisex · Limited Edition",
    ctaLabel: "Shop Now",
    ctaHref: "/products",
  },
  {
    tag: "Lookbook",
    headline: "Street Atelier",
    eyebrow: "Where craft meets the city",
    body: "Where craft meets the city",
    ctaLabel: "View Collection",
    ctaHref: "/new-collection",
  },
  {
    tag: "Footwear",
    headline: "Ground Work.",
    eyebrow: "Every step — considered",
    body: "Every step — considered",
    ctaLabel: "Shop Footwear",
    ctaHref: "/products?category=footwear",
  },
];

function MaisonNocturneHero({ heroImages, config }: { heroImages: string[]; config?: Record<string, any> }) {
  const slides = useMemo(() => {
    const visualImageSet = DEFAULT_MAISON_HERO_IMAGES.length > 0 ? DEFAULT_MAISON_HERO_IMAGES : heroImages;
    const sourceSlides = Array.isArray(config?.slides) && config.slides.length > 0
      ? config.slides
      : DEFAULT_MAISON_SLIDES;

    return sourceSlides.map((slide: any, index: number) => ({
      ...DEFAULT_MAISON_SLIDES[index % DEFAULT_MAISON_SLIDES.length],
      ...slide,
      image: typeof slide?.image === "string" && slide.image
        ? slide.image
        : visualImageSet[index % Math.max(visualImageSet.length, 1)] ?? visualImageSet[0],
    }));
  }, [config?.slides, heroImages]);
  const secondaryCtaLabel = config?.secondaryCtaLabel ?? "Discover Atelier";
  const secondaryCtaHref = config?.secondaryCtaHref ?? "/atelier";

  const durations = useMemo(
    () => slides.map((slide: any, index: number) => {
      const duration = Number(slide?.duration);
      return Number.isFinite(duration) && duration > 0 ? duration : ([7000, 6000, 6000, 5500][index] ?? 6000);
    }),
    [slides],
  );
  const [activeIndex, setActiveIndex] = useState(0);
  const touchStartX = useRef(0);
  const primaryButtonStyle = {
    background: "#ffffff",
    color: "#111111",
    border: "1px solid rgba(255,255,255,0.92)",
    boxShadow: "0 14px 36px rgba(0,0,0,0.24)",
  };
  const secondaryButtonStyle = {
    background: "rgba(255,255,255,0.06)",
    color: "#ffffff",
    border: "1px solid rgba(255,255,255,0.22)",
  };

  useEffect(() => {
    if (slides.length <= 1) return;
    const timer = window.setTimeout(() => {
      setActiveIndex((prev) => (prev + 1) % slides.length);
    }, durations[activeIndex] ?? 3000); // Reduced from 6000ms for faster loading
    return () => window.clearTimeout(timer);
  }, [activeIndex, durations, slides.length]);

  const goTo = (index: number) => setActiveIndex((index + slides.length) % slides.length);
  const goNext = () => goTo(activeIndex + 1);
  const goPrev = () => goTo(activeIndex - 1);

  return (
    <section
      className="relative w-full overflow-hidden"
      style={{
        minHeight: "100dvh",
        background: "#0b0b0c",
      }}
    >
      <div
        className="absolute inset-0 z-10"
        onTouchStart={(event) => {
          touchStartX.current = event.touches[0].clientX;
        }}
        onTouchEnd={(event) => {
          const diff = touchStartX.current - event.changedTouches[0].clientX;
          if (Math.abs(diff) < 48) return;
          if (diff > 0) goNext();
          else goPrev();
        }}
      >
        <button
          type="button"
          className="absolute inset-y-0 left-0 z-20 hidden w-[28%] lg:block"
          aria-label="Previous slide"
          onClick={goPrev}
        />
        <button
          type="button"
          className="absolute inset-y-0 right-0 z-20 hidden w-[28%] lg:block"
          aria-label="Next slide"
          onClick={goNext}
        />

        {slides.map((slide, index) => {
          const isActive = index === activeIndex;
          return (
            <div
              key={`${slide.headline}-${index}`}
              className={`absolute inset-0 transition-opacity duration-200 ${isActive ? "opacity-100" : "opacity-0 pointer-events-none"}`}
            >
              <div className="absolute inset-0 overflow-hidden">
                <div
                  className={`absolute inset-0 transition-transform duration-[2400ms] ease-out ${isActive ? "scale-100" : "scale-[1.02]"}`}
                  style={{ filter: "none" }}
                >
                  <OptimizedImage
                    src={slide.image}
                    alt={slide.headline}
                    className="h-full w-full object-cover object-center"
                    priority={index === 0}
                  />
                </div>
                <div
                  className="absolute inset-0"
                  style={{
                    background:
                      "linear-gradient(180deg, rgba(14,12,10,0.08) 0%, rgba(14,12,10,0.3) 100%), linear-gradient(90deg, rgba(14,12,10,0.28) 0%, rgba(14,12,10,0.1) 35%, rgba(14,12,10,0.0) 100%), linear-gradient(135deg, rgba(201,169,110,0.08) 0%, transparent 48%)",
                  }}
                />
              </div>

              <div className="relative z-30 flex min-h-[100dvh] items-end px-6 pb-28 pt-40 sm:px-8 md:px-12 lg:px-16">
                <div className="max-w-[720px]">
                  <div
                    className="mb-5 flex items-center gap-3 uppercase"
                    style={{
                      fontFamily: "var(--font-mono)",
                      fontSize: "9px",
                      letterSpacing: "0.28em",
                      color: "var(--gold)",
                    }}
                  >
                    <span className="block h-px w-7 bg-[var(--gold)]" />
                    {slide.tag}
                  </div>
                  <h1
                    className="max-w-[10ch] text-balance leading-[0.92]"
                    style={{
                      fontFamily: "var(--font-display)",
                      fontWeight: 900,
                      fontSize: "clamp(52px, 11vw, 108px)",
                      color: "#ffffff",
                    }}
                  >
                    {slide.headline}
                  </h1>
                  <p
                    className="mt-5 uppercase"
                    style={{
                      fontFamily: "var(--font-mono)",
                      fontSize: "10.5px",
                      letterSpacing: "0.22em",
                      color: "rgba(232,228,219,0.8)",
                    }}
                  >
                    {slide.eyebrow}
                  </p>
                  <p
                    className="mt-4 max-w-xl text-sm sm:text-base"
                    style={{
                      fontFamily: "var(--font-body)",
                      color: "rgba(232,228,219,0.74)",
                    }}
                  >
                    {slide.body}
                  </p>
                  <div className="mt-8 flex flex-wrap items-center gap-5">
                    <Link
                      href={slide.ctaHref}
                      className="inline-flex items-center gap-3 rounded-full px-6 py-3 text-[11px] uppercase tracking-[0.22em] transition-all duration-300 hover:-translate-y-[1px] hover:scale-[1.01]"
                      style={{ fontFamily: "var(--font-mono)", ...primaryButtonStyle }}
                    >
                      {slide.ctaLabel}
                      <ArrowRight className="h-4 w-4" />
                    </Link>
                    <Link
                      href={secondaryCtaHref}
                      className="inline-flex items-center gap-3 rounded-full px-6 py-3 text-[11px] uppercase tracking-[0.24em] transition-all duration-300 hover:-translate-y-[1px]"
                      style={{ fontFamily: "var(--font-mono)", ...secondaryButtonStyle }}
                    >
                      {secondaryCtaLabel}
                    </Link>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

    </section>
  );
}

function NikeshDesignHero({ heroImages, config }: { heroImages: string[]; config?: Record<string, any> }) {
  const slides = useMemo(() => {
    const sourceSlides = Array.isArray(config?.slides) && config.slides.length > 0
      ? config.slides
      : DEFAULT_NIKESH_SLIDES;

    return sourceSlides.map((slide: any, index: number) => ({
      ...DEFAULT_NIKESH_SLIDES[index % DEFAULT_NIKESH_SLIDES.length],
      ...slide,
      image: typeof slide?.image === "string" && slide.image
        ? slide.image
        : heroImages[index % Math.max(heroImages.length, 1)] ?? heroImages[0],
    }));
  }, [config?.slides, heroImages]);
  const secondaryCtaLabel = config?.secondaryCtaLabel ?? "Discover Atelier";
  const secondaryCtaHref = config?.secondaryCtaHref ?? "/atelier";

  const durations = useMemo(
    () => slides.map((slide: any, index: number) => {
      const duration = Number(slide?.duration);
      return Number.isFinite(duration) && duration > 0 ? duration : ([7000, 6000, 6000, 5500][index] ?? 6000);
    }),
    [slides],
  );
  const [activeIndex, setActiveIndex] = useState(0);
  const touchStartX = useRef(0);

  useEffect(() => {
    if (slides.length <= 1) return;
    const timer = window.setTimeout(() => {
      setActiveIndex((prev) => (prev + 1) % slides.length);
    }, durations[activeIndex] ?? 3000); // Reduced from 6000ms for faster loading
    return () => window.clearTimeout(timer);
  }, [activeIndex, durations, slides.length]);

  const goTo = (index: number) => setActiveIndex((index + slides.length) % slides.length);
  const goNext = () => goTo(activeIndex + 1);
  const goPrev = () => goTo(activeIndex - 1);

  return (
    <section id="hero" className="relative w-full overflow-hidden" style={{ minHeight: "100dvh", background: "var(--bg)" }}>
      <div
        className="absolute inset-0 z-10"
        onTouchStart={(event) => {
          touchStartX.current = event.touches[0].clientX;
        }}
        onTouchEnd={(event) => {
          const diff = touchStartX.current - event.changedTouches[0].clientX;
          if (Math.abs(diff) < 48) return;
          if (diff > 0) goNext();
          else goPrev();
        }}
      >
        <button type="button" className="absolute inset-y-0 left-0 z-20 hidden w-[28%] lg:block" aria-label="Previous slide" onClick={goPrev} />
        <button type="button" className="absolute inset-y-0 right-0 z-20 hidden w-[28%] lg:block" aria-label="Next slide" onClick={goNext} />

        {slides.map((slide, index) => {
          const isActive = index === activeIndex;
          return (
            <div
              key={`${slide.headline}-${index}`}
              className={`absolute inset-0 transition-opacity duration-[700ms] ease-out ${isActive ? "opacity-100" : "pointer-events-none opacity-0"}`}
            >
              <div className="absolute inset-0 overflow-hidden">
                <div
                  className={`absolute inset-0 transition-transform duration-[700ms] ease-out ${isActive ? "scale-100" : "scale-[1.08]"}`} // Reduced from 7000ms
                  style={{ filter: "brightness(0.52) saturate(0.94)" }}
                >
                  <OptimizedImage
                    src={slide.image}
                    alt={slide.headline}
                    className="h-full w-full object-cover object-center"
                    priority={index === 0}
                  />
                </div>
                <div
                  className="absolute inset-0"
                  style={{
                    background:
                      "linear-gradient(180deg, rgba(12,11,9,0.16) 0%, rgba(12,11,9,0.82) 92%), linear-gradient(90deg, rgba(12,11,9,0.72) 0%, rgba(12,11,9,0.24) 45%, rgba(12,11,9,0.08) 100%), linear-gradient(135deg, rgba(201,169,110,0.14) 0%, transparent 45%)",
                  }}
                />
              </div>

              <div className="relative z-10 flex min-h-[100dvh] items-end px-6 pb-28 pt-40 sm:px-8 md:px-12 lg:px-16">
                <div className="max-w-[720px]">
                  <div
                    className="mb-5 flex items-center gap-3 uppercase"
                    style={{
                      fontFamily: "var(--font-mono)",
                      fontSize: "9px",
                      letterSpacing: "0.28em",
                      color: "var(--gold)",
                    }}
                  >
                    <span className="block h-px w-7 bg-[var(--gold)]" />
                    {slide.tag}
                  </div>
                  <h1
                    className="max-w-[10ch] text-balance leading-[0.92]"
                    style={{
                      fontFamily: "var(--font-display)",
                      fontWeight: 900,
                      fontSize: "clamp(52px, 11vw, 108px)",
                      color: "var(--fg)",
                    }}
                  >
                    {slide.headline}
                  </h1>
                  <p
                    className="mt-5 uppercase"
                    style={{
                      fontFamily: "var(--font-mono)",
                      fontSize: "10.5px",
                      letterSpacing: "0.22em",
                      color: "var(--fg-dim)",
                    }}
                  >
                    {slide.body}
                  </p>
                  <div className="mt-8 flex flex-wrap items-center gap-5">
                    <Link
                      href={slide.ctaHref}
                      className="inline-flex items-center gap-3 px-6 py-3 text-[11px] uppercase tracking-[0.22em] transition-transform hover:scale-[1.02]"
                      style={{
                        fontFamily: "var(--font-mono)",
                        background: "var(--gold)",
                        color: "var(--bg)",
                      }}
                    >
                      {slide.ctaLabel}
                    </Link>
                    <Link
                      href={secondaryCtaHref}
                      className="inline-flex items-center gap-3 text-[11px] uppercase tracking-[0.24em] text-[var(--fg)]"
                      style={{ fontFamily: "var(--font-mono)" }}
                    >
                      {secondaryCtaLabel}
                    </Link>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

    </section>
  );
}

export default function HeroSection({
  heroImages,
  heroIndex,
  heroLoading,
  videoFailed,
  isMobile,
  isTransitioning,
  onVideoError,
  heroVideoRef,
  config,
}: HeroSectionProps) {
  const showHeroVideo = isMobile && !videoFailed;

  void isTransitioning;

  if (config?.variant === "nikeshdesign") {
    return <NikeshDesignHero heroImages={heroImages} config={config} />;
  }

  if (config?.variant === "maison-nocturne") {
    return <MaisonNocturneHero heroImages={heroImages} config={config} />;
  }

  return (
    <section className="relative h-[90vh] min-h-[650px] md:min-h-[750px] lg:min-h-[850px] w-full overflow-hidden bg-neutral-900">
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
            onError={onVideoError}
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
      <div className="absolute inset-0 bg-black/24 pointer-events-none" />

      <div className="absolute inset-0 flex items-start md:items-center container mx-auto px-6 sm:px-12 md:px-16 pt-32 sm:pt-40 md:pt-0 pointer-events-none z-10">
        <div className="flex items-center gap-6 md:gap-12 pl-2">
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

      <div className="absolute inset-0 flex items-end justify-center pb-24 sm:pb-32 md:pb-20 md:items-end pt-0 md:pt-0 pointer-events-none z-20">
        <div className="flex flex-col items-center gap-4 md:gap-5 pointer-events-auto">
          <motion.div
            initial={{ scaleX: 0 }}
            animate={{ scaleX: 1 }}
            transition={{ duration: 0.7, delay: 0.3, ease: [0.22, 1, 0.36, 1] }}
            className="w-12 md:w-16 h-px bg-white/50 origin-center hidden md:block"
          />

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
  );
}
