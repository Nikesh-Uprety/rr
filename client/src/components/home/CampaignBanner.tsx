import { Gem, ArrowRight } from "lucide-react";
import { Link } from "wouter";
import { motion } from "framer-motion";

import { Button } from "@/components/ui/button";

interface CampaignBannerProps {
  exploreCollectionImage: string;
  parallaxOffset: any;
  imageAlt?: string;
  config?: Record<string, any>;
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
      className="px-5 py-24 sm:px-8 lg:px-10"
      style={{ background: "var(--bg)" }}
      data-navbar-trigger="maison-nocturne"
    >
      <div className="mx-auto max-w-[1440px]">
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

        <div className="grid auto-rows-[180px] grid-cols-1 gap-[5px] md:grid-cols-12 md:auto-rows-[200px]">
          {images.slice(0, 8).map((item: any, index: number) => (
            <div
              key={`${item.label}-${index}`}
              className={`ed-cell group relative overflow-hidden ${gridClasses[index] ?? "md:col-span-3"}`}
            >
              <div className="absolute inset-0 overflow-hidden">
                <img
                  src={item.image || exploreCollectionImage}
                  alt={item.label}
                  className="h-full w-full object-cover transition duration-700 group-hover:scale-[1.06]"
                  style={{ filter: "brightness(0.6) grayscale(20%)" }}
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/15" />
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
            </div>
          ))}
        </div>
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
    <section className="px-5 py-24 sm:px-8 lg:px-10" style={{ background: "var(--bg)" }}>
      <div className="mx-auto max-w-[1440px]">
        <div className="editorial-grid grid auto-rows-[180px] grid-cols-1 gap-[5px] md:grid-cols-12 md:auto-rows-[200px]">
          {images.slice(0, 8).map((item: any, index: number) => (
            <div
              key={`${item.label}-${index}`}
              className={`ed-cell group relative overflow-hidden ${gridClasses[index] ?? "md:col-span-3"}`}
            >
              <div className="absolute inset-0 overflow-hidden">
                <img
                  src={item.image || exploreCollectionImage}
                  alt={item.label}
                  className="h-full w-full object-cover transition duration-700 group-hover:scale-[1.06]"
                  style={{ filter: "brightness(0.6) grayscale(20%)" }}
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/15" />
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
            </div>
          ))}
        </div>
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
  const title = config?.title ?? "Explore the journey behind.";
  const text =
    config?.text ?? "Discover the meticulous craftsmanship and story of the Winter '25 collection.";
  const ctaLabel = config?.ctaLabel ?? "Explore Collection";
  const ctaHref = config?.ctaHref ?? "/new-collection";
  if (config?.variant === "nikeshdesign-lookbook") {
    return <NikeshDesignLookbook exploreCollectionImage={exploreCollectionImage} config={config} />;
  }

  if (config?.variant === "maison-nocturne-lookbook") {
    return <MaisonNocturneLookbook exploreCollectionImage={exploreCollectionImage} config={config} />;
  }

  return (
    <section className="relative h-[80vh] w-full overflow-hidden my-32 group/banner">
      <motion.div
        style={{ y: parallaxOffset }}
        className="absolute inset-0 w-full h-[120%] -top-[10%]"
      >
        <img
          alt={imageAlt}
          className="w-full h-full object-cover object-center"
          src={exploreCollectionImage}
        />
      </motion.div>

      <div
        className="absolute inset-0 z-10 pointer-events-none opacity-0 group-hover/banner:opacity-100 transition-opacity duration-1000"
        onMouseMove={(e) => {
          const rect = e.currentTarget.getBoundingClientRect();
          const x = e.clientX - rect.left;
          const y = e.clientY - rect.top;
          e.currentTarget.style.setProperty("--mouse-x", `${x}px`);
          e.currentTarget.style.setProperty("--mouse-y", `${y}px`);
        }}
        style={{
          background:
            "radial-gradient(circle at var(--mouse-x) var(--mouse-y), rgba(255,255,255,0.08) 0%, transparent 40%)",
        }}
      />

      <div className="absolute inset-0 bg-black/0 dark:bg-black/40 transition-colors duration-700" />

      <div className="absolute inset-0 flex items-center justify-center p-6 sm:p-12 z-20">
        <motion.div
          initial={{ opacity: 0, y: 50 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 1, ease: "easeOut" }}
          className="max-w-xl w-full backdrop-blur-[2px] bg-transparent border border-white/10 p-6 md:p-10 text-center text-white rounded-3xl shadow-2xl overflow-hidden relative"
        >
          <div className="absolute top-0 right-0 p-4">
            <Gem className="w-4 h-4 text-white/10 animate-revolve" />
          </div>

          <h2 className="text-[14px] md:text-lg font-black mb-4 tracking-[0.4em] uppercase leading-tight italic">
            {title.split(" ").slice(0, Math.ceil(title.split(" ").length / 2)).join(" ")} <br />
            <span className="not-italic text-outline-white">{title.split(" ").slice(Math.ceil(title.split(" ").length / 2)).join(" ")}</span>
          </h2>
          <p className="text-[10px] md:text-xs opacity-60 font-bold tracking-[0.3em] uppercase max-w-sm mx-auto mb-8 leading-relaxed">
            {text}
          </p>
          <Button
            variant="outline"
            className="rounded-full px-8 h-12 border-white/20 text-white hover:bg-white hover:text-black transition-all uppercase text-[8px] tracking-[0.4em] font-black group/btn shadow-xl hover:shadow-white/20 active:scale-95"
            asChild
          >
            <Link href={ctaHref} className="flex items-center gap-3">
              {ctaLabel}{" "}
              <ArrowRight className="w-3 h-3 group-hover/btn:translate-x-1.5 transition-transform" />
            </Link>
          </Button>
        </motion.div>
      </div>
    </section>
  );
}
