import { useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowUp, ChevronLeft, ChevronRight, X, ZoomIn } from "lucide-react";

interface CampaignBannerProps {
  exploreCollectionImage: string;
  parallaxOffset: any;
  imageAlt?: string;
  config?: Record<string, any>;
}

const CAMPAIGN_IMAGE_HARD_FALLBACK = "/images/home-campaign-editorial.webp";

function handleCampaignImageError(
  event: React.SyntheticEvent<HTMLImageElement>,
  preferredFallback: string,
) {
  const image = event.currentTarget;
  const current = image.getAttribute("src") ?? "";
  const fallback = preferredFallback || CAMPAIGN_IMAGE_HARD_FALLBACK;

  if (current !== fallback) {
    image.setAttribute("src", fallback);
    return;
  }

  if (current !== CAMPAIGN_IMAGE_HARD_FALLBACK) {
    image.setAttribute("src", CAMPAIGN_IMAGE_HARD_FALLBACK);
  }
}

const DEFAULT_LOOKBOOK_LABELS = [
  "Vol. I — Essentials",
  "Outerwear",
  "Street",
  "The Silhouette",
  "Footwear",
  "Archive",
  "Editorial",
  "Lookbook IV",
];

function LookbookGalleryModal({
  images,
  initialIndex,
  onClose,
}: {
  images: Array<{ image: string; label: string; index?: string }>;
  initialIndex: number;
  onClose: () => void;
}) {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const touchStartX = useRef(0);

  const goNext = () => setCurrentIndex((index) => (index + 1) % images.length);
  const goPrev = () => setCurrentIndex((index) => (index - 1 + images.length) % images.length);
  const activeImage = images[currentIndex];

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[120] bg-black/95 backdrop-blur-2xl"
        onClick={onClose}
      >
        <div
          className="absolute inset-0"
          onTouchStart={(event) => {
            touchStartX.current = event.touches[0].clientX;
          }}
          onTouchEnd={(event) => {
            const deltaX = touchStartX.current - event.changedTouches[0].clientX;
            if (Math.abs(deltaX) < 48) return;
            if (deltaX > 0) goNext();
            else goPrev();
          }}
        />

        <button
          onClick={onClose}
          className="absolute right-5 top-5 z-30 flex h-11 w-11 items-center justify-center rounded-full border border-white/10 bg-white/10 text-white transition-all hover:bg-white/20"
          aria-label="Close gallery"
        >
          <X className="h-5 w-5" />
        </button>

        <div className="absolute left-1/2 top-5 z-30 flex -translate-x-1/2 items-center gap-2 rounded-full border border-white/10 bg-white/10 px-4 py-2 backdrop-blur-xl">
          <ZoomIn className="h-4 w-4 text-white/70" />
          <span className="text-[10px] font-semibold uppercase tracking-[0.26em] text-white/70">
            Editorial Viewer
          </span>
        </div>

        <button
          onClick={(event) => {
            event.stopPropagation();
            goPrev();
          }}
          className="absolute left-5 top-1/2 z-30 hidden h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full border border-white/10 bg-white/10 text-white transition-all hover:scale-110 hover:bg-white/20 md:flex"
          aria-label="Previous image"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>

        <button
          onClick={(event) => {
            event.stopPropagation();
            goNext();
          }}
          className="absolute right-5 top-1/2 z-30 hidden h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full border border-white/10 bg-white/10 text-white transition-all hover:scale-110 hover:bg-white/20 md:flex"
          aria-label="Next image"
        >
          <ChevronRight className="h-5 w-5" />
        </button>

        <div className="flex min-h-screen flex-col items-center justify-center px-5 py-24">
          <AnimatePresence mode="wait">
            <motion.img
              key={`${activeImage.image}-${currentIndex}`}
              src={activeImage.image}
              alt={activeImage.label}
              initial={{ opacity: 0, scale: 0.97 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.97 }}
              transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
              className="max-h-[72vh] w-auto max-w-[92vw] rounded-[24px] object-contain shadow-[0_24px_80px_rgba(0,0,0,0.45)]"
              onClick={(event) => event.stopPropagation()}
            />
          </AnimatePresence>

          <div className="mt-6 flex items-center gap-3 rounded-full border border-white/10 bg-white/10 px-4 py-2 backdrop-blur-xl">
            <button
              onClick={(event) => {
                event.stopPropagation();
                goPrev();
              }}
              className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-white transition-all hover:bg-white/20 md:hidden"
              aria-label="Previous image"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="text-[10px] font-mono uppercase tracking-[0.28em] text-white/70">
              {currentIndex + 1} / {images.length}
            </span>
            <button
              onClick={(event) => {
                event.stopPropagation();
                goNext();
              }}
              className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-white transition-all hover:bg-white/20 md:hidden"
              aria-label="Next image"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>

          <div className="mt-4 flex max-w-full gap-3 overflow-x-auto px-2 pb-1 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
            {images.map((item, index) => (
              <button
                key={`${item.image}-${index}`}
                onClick={(event) => {
                  event.stopPropagation();
                  setCurrentIndex(index);
                }}
                className={`relative h-16 w-12 shrink-0 overflow-hidden rounded-2xl border transition-all duration-300 sm:h-20 sm:w-14 ${
                  index === currentIndex
                    ? "scale-100 border-white/70 shadow-[0_12px_30px_rgba(255,255,255,0.14)]"
                    : "scale-95 border-white/10 opacity-65 hover:opacity-100"
                }`}
                aria-label={`Go to image ${index + 1}`}
              >
                <img src={item.image} alt={item.label} className="h-full w-full object-cover" />
                <div className={`absolute inset-0 transition-colors ${index === currentIndex ? "bg-transparent" : "bg-black/30"}`} />
              </button>
            ))}
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}

function getLookbookGridClasses(layoutPreset?: string) {
  if (layoutPreset === "balanced") {
    return [
      "md:col-span-4 md:row-span-2",
      "md:col-span-4",
      "md:col-span-4",
      "md:col-span-3",
      "md:col-span-3",
      "md:col-span-3",
      "md:col-span-3",
      "md:col-span-4",
    ];
  }

  if (layoutPreset === "stacked") {
    return [
      "md:col-span-6 md:row-span-2",
      "md:col-span-3",
      "md:col-span-3",
      "md:col-span-6",
      "md:col-span-3",
      "md:col-span-3",
      "md:col-span-6",
      "md:col-span-6",
    ];
  }

  return [
    "md:col-span-5 md:row-span-2",
    "md:col-span-3",
    "md:col-span-4",
    "md:col-span-4",
    "md:col-span-3",
    "md:col-span-3",
    "md:col-span-4",
    "md:col-span-5",
  ];
}

function MaisonNocturneLookbook({
  exploreCollectionImage,
  config,
}: {
  exploreCollectionImage: string;
  config?: Record<string, any>;
}) {
  const [galleryOpen, setGalleryOpen] = useState(false);
  const [galleryIndex, setGalleryIndex] = useState(0);
  const images =
    Array.isArray(config?.images) && config.images.length > 0
      ? config.images
      : Array.from({ length: 8 }, (_, index) => ({
          image: config?.fallbackImage ?? exploreCollectionImage,
          label: DEFAULT_LOOKBOOK_LABELS[index],
          index: `0${index + 1}`,
        }));
  const gridClasses = getLookbookGridClasses(config?.layoutPreset);
  const eyebrow = config?.eyebrow ?? "Editorial / Lookbook";
  const title = config?.title ?? "Frames from the atelier.";
  const text =
    config?.text ??
    "A magazine-style grid of campaign stills, silhouettes, and styling cues built from the current Rare visual language.";

  return (
    <section
      className="py-20 sm:py-24"
      style={{ background: "var(--bg)" }}
      data-navbar-trigger="maison-nocturne"
    >
      <div className="w-full px-2 sm:px-3 lg:px-4 xl:px-6">
        <div className="reveal mb-10 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <p
              className="text-[10px] uppercase tracking-[0.28em] text-[var(--gold)]"
              style={{ fontFamily: "var(--font-mono)" }}
            >
              {eyebrow}
            </p>
            <h2
              className="mt-4 text-balance leading-[0.98]"
              style={{
                fontFamily: "var(--font-display)",
                fontSize: "clamp(34px, 5vw, 64px)",
                color: "var(--fg)",
              }}
            >
              {title}
            </h2>
          </div>
          <p
            className="max-w-md text-sm leading-6 text-[var(--fg-dim)]"
            style={{ fontFamily: "var(--font-body)" }}
          >
            {text}
          </p>
        </div>

        <div className="grid auto-rows-[230px] grid-cols-1 gap-[6px] md:grid-cols-12 md:auto-rows-[300px] xl:auto-rows-[340px]">
          {images.slice(0, 8).map((item: any, index: number) => (
            <button
              key={`${item.label}-${index}`}
              type="button"
              onClick={() => {
                setGalleryIndex(index);
                setGalleryOpen(true);
              }}
              className={`ed-cell group relative overflow-hidden text-left ${gridClasses[index] ?? "md:col-span-3"}`}
            >
              <div className="absolute inset-0 overflow-hidden">
                <img
                  src={item.image || exploreCollectionImage}
                  alt={item.label}
                  className="h-full w-full object-cover brightness-[0.96] saturate-[1.22] contrast-[1.03] dark:brightness-[0.6] dark:saturate-[0.95] dark:contrast-[1] transition duration-700 group-hover:scale-[1.06]"
                  onError={(event) =>
                    handleCampaignImageError(event, exploreCollectionImage)
                  }
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/42 via-black/6 to-transparent dark:from-black/80 dark:via-black/30 dark:to-black/15" />
              </div>
              <span
                className="absolute right-4 top-4 text-[9px] uppercase tracking-[0.24em] text-[rgba(232,228,219,0.32)]"
                style={{ fontFamily: "var(--font-mono)" }}
              >
                {item.index ?? `0${index + 1}`}
              </span>
              <div className="absolute inset-x-0 bottom-0 translate-y-4 px-5 pb-5 opacity-0 transition duration-500 group-hover:translate-y-0 group-hover:opacity-100">
                <p
                  className="text-[9px] uppercase tracking-[0.22em] text-[var(--fg)]"
                  style={{ fontFamily: "var(--font-mono)" }}
                >
                  {item.label}
                </p>
              </div>
            </button>
          ))}
        </div>

        {galleryOpen ? (
          <LookbookGalleryModal
            images={images.slice(0, 8)}
            initialIndex={galleryIndex}
            onClose={() => setGalleryOpen(false)}
          />
        ) : null}
      </div>
    </section>
  );
}

function NikeshDesignLookbook({
  exploreCollectionImage,
  config,
}: {
  exploreCollectionImage: string;
  config?: Record<string, any>;
}) {
  const [galleryOpen, setGalleryOpen] = useState(false);
  const [galleryIndex, setGalleryIndex] = useState(0);
  const images =
    Array.isArray(config?.images) && config.images.length > 0
      ? config.images
      : Array.from({ length: 8 }, (_, index) => ({
          image: config?.fallbackImage ?? exploreCollectionImage,
          label: DEFAULT_LOOKBOOK_LABELS[index],
          index: `0${index + 1}`,
        }));
  const gridClasses = getLookbookGridClasses(config?.layoutPreset);

  return (
    <section className="py-20 sm:py-24" style={{ background: "var(--bg)" }}>
      <div className="w-full px-2 sm:px-3 lg:px-4 xl:px-6">
        <div className="editorial-grid grid auto-rows-[230px] grid-cols-1 gap-[6px] md:grid-cols-12 md:auto-rows-[300px] xl:auto-rows-[340px]">
          {images.slice(0, 8).map((item: any, index: number) => (
            <button
              key={`${item.label}-${index}`}
              type="button"
              onClick={() => {
                setGalleryIndex(index);
                setGalleryOpen(true);
              }}
              className={`ed-cell group relative overflow-hidden text-left ${gridClasses[index] ?? "md:col-span-3"}`}
            >
              <div className="absolute inset-0 overflow-hidden">
                <img
                  src={item.image || exploreCollectionImage}
                  alt={item.label}
                  className="h-full w-full object-cover brightness-[0.96] saturate-[1.22] contrast-[1.03] dark:brightness-[0.6] dark:saturate-[0.95] dark:contrast-[1] transition duration-700 group-hover:scale-[1.06]"
                  onError={(event) =>
                    handleCampaignImageError(event, exploreCollectionImage)
                  }
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/42 via-black/6 to-transparent dark:from-black/80 dark:via-black/30 dark:to-black/15" />
              </div>
              <span
                className="absolute right-4 top-4 text-[9px] uppercase tracking-[0.24em] text-[rgba(232,228,219,0.32)]"
                style={{ fontFamily: "var(--font-mono)" }}
              >
                {item.index ?? `0${index + 1}`}
              </span>
              <div className="absolute inset-x-0 bottom-0 translate-y-4 px-5 pb-5 opacity-0 transition duration-500 group-hover:translate-y-0 group-hover:opacity-100">
                <p
                  className="text-[9px] uppercase tracking-[0.22em] text-[var(--fg)]"
                  style={{ fontFamily: "var(--font-mono)" }}
                >
                  {item.label}
                </p>
              </div>
            </button>
          ))}
        </div>

        {galleryOpen ? (
          <LookbookGalleryModal
            images={images.slice(0, 8)}
            initialIndex={galleryIndex}
            onClose={() => setGalleryOpen(false)}
          />
        ) : null}
      </div>
    </section>
  );
}

export default function CampaignBanner({
  exploreCollectionImage,
  parallaxOffset,
  imageAlt = "Campaign story",
  config,
}: CampaignBannerProps) {
  if (config?.variant === "nikeshdesign-lookbook") {
    return <NikeshDesignLookbook exploreCollectionImage={exploreCollectionImage} config={config} />;
  }

  if (config?.variant === "maison-nocturne-lookbook") {
    return <MaisonNocturneLookbook exploreCollectionImage={exploreCollectionImage} config={config} />;
  }

  return (
    <section
      className="relative w-full overflow-hidden"
      style={{ aspectRatio: "1960 / 1176" }}
    >
      <motion.div className="absolute inset-0 h-full w-full">
        <img
          alt={imageAlt}
          className="w-full h-full object-cover object-center"
          src={exploreCollectionImage}
          onError={(event) =>
            handleCampaignImageError(event, CAMPAIGN_IMAGE_HARD_FALLBACK)
          }
        />
      </motion.div>
      <div className="absolute bottom-8 left-0 right-0 flex justify-center z-10">
        <button
          onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
          className="group flex items-center gap-3 px-7 py-3.5 rounded-full bg-black/85 hover:bg-black text-white transition-all duration-300 shadow-xl hover:shadow-2xl backdrop-blur-sm border border-white/10"
          aria-label="Go to top"
        >
          <ArrowUp className="w-4 h-4 transition-transform group-hover:-translate-y-1" />
          <span className="text-[11px] font-semibold uppercase tracking-[0.25em]">Back to Top</span>
        </button>
      </div>
    </section>
  );
}
