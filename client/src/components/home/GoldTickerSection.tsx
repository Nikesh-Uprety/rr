interface GoldTickerSectionProps {
  config?: Record<string, any>;
}

const DEFAULT_ITEMS = [
  "New Arrivals — SS 2025",
  "Free Shipping NPR 5,000+",
  "Dragon Hoodie — Back in Stock",
  "New Footwear Drop",
  "Basics Collar Jacket · Limited",
  "Authenticity in Motion",
];

export default function GoldTickerSection({ config }: GoldTickerSectionProps) {
  const sourceItems =
    Array.isArray(config?.items) && config.items.length > 0
      ? config.items.filter((item: unknown): item is string => typeof item === "string" && item.trim().length > 0)
      : DEFAULT_ITEMS;

  const items = [...sourceItems, ...sourceItems, ...sourceItems, ...sourceItems];

  return (
    <section
      className="overflow-hidden border-y"
      style={{
        background: "var(--gold)",
        borderColor: "rgba(12,11,9,0.08)",
      }}
    >
      <div className="rare-ticker-track flex w-max items-center py-3 hover:[animation-play-state:paused]">
        {items.map((item, index) => (
          <div
            key={`${item}-${index}`}
            className="flex shrink-0 items-center"
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: "9.5px",
              fontWeight: 500,
              letterSpacing: "0.18em",
              textTransform: "uppercase",
              color: "var(--bg)",
            }}
          >
            <span className="px-5">{item}</span>
            <span className="h-1.5 w-1.5 rounded-full bg-black/65" />
          </div>
        ))}
      </div>
    </section>
  );
}
