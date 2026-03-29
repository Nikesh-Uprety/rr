import { motion } from "framer-motion";

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
  if (config?.variant === "nikeshdesign-lookbook") {
    return <NikeshDesignLookbook exploreCollectionImage={exploreCollectionImage} config={config} />;
  }

  if (config?.variant === "maison-nocturne-lookbook") {
    return <MaisonNocturneLookbook exploreCollectionImage={exploreCollectionImage} config={config} />;
  }

  return (
    <section className="relative h-[72vh] min-h-[420px] w-full overflow-hidden md:h-[100svh] md:min-h-[100svh]">
      <motion.div
        style={{ y: parallaxOffset }}
        className="absolute inset-x-0 -top-[6%] h-[112%] w-full md:-top-[8%] md:h-[116%]"
      >
        <img
          alt={imageAlt}
          className="w-full h-full object-cover object-center"
          src={exploreCollectionImage}
        />
      </motion.div>
    </section>
  );
}
