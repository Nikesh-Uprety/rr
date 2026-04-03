export const STOREFRONT_FONT_OPTIONS = [
  { id: "inter", label: "Inter", description: "Clean sans for fast UI validation." },
  { id: "roboto-slab", label: "Roboto Slab", description: "Editorial serif weight for hierarchy testing." },
  { id: "space-grotesk", label: "Space Grotesk", description: "Sharper modern product feel." },
  { id: "ibm-plex-sans", label: "IBM Plex Sans", description: "Structured SaaS-style reading rhythm." },
] as const;

export type StorefrontFontPreset = (typeof STOREFRONT_FONT_OPTIONS)[number]["id"];

export const STOREFRONT_FONT_FAMILIES: Record<
  StorefrontFontPreset,
  { display: string; body: string; mono: string; preview: string }
> = {
  inter: {
    display: "'Playfair Display', Georgia, serif",
    body: "'Inter', sans-serif",
    mono: "'DM Mono', monospace",
    preview: "'Inter', ui-sans-serif, system-ui, sans-serif",
  },
  "roboto-slab": {
    display: "'Roboto Slab', 'Playfair Display', serif",
    body: "'Roboto Slab', Georgia, serif",
    mono: "'DM Mono', monospace",
    preview: "'Roboto Slab', ui-serif, Georgia, serif",
  },
  "space-grotesk": {
    display: "'Playfair Display', Georgia, serif",
    body: "'Space Grotesk', 'DM Sans', sans-serif",
    mono: "'DM Mono', monospace",
    preview: "'Space Grotesk', 'Inter', ui-sans-serif, sans-serif",
  },
  "ibm-plex-sans": {
    display: "'Playfair Display', Georgia, serif",
    body: "'IBM Plex Sans', 'DM Sans', sans-serif",
    mono: "'DM Mono', monospace",
    preview: "'IBM Plex Sans', 'Inter', ui-sans-serif, sans-serif",
  },
};

export function isStorefrontFontPreset(value: unknown): value is StorefrontFontPreset {
  return typeof value === "string" && value in STOREFRONT_FONT_FAMILIES;
}

export function applyStorefrontFontPreset(preset: StorefrontFontPreset | null): void {
  if (typeof document === "undefined") return;

  const root = document.documentElement;
  if (!preset) {
    root.style.removeProperty("--font-display");
    root.style.removeProperty("--font-body");
    root.style.removeProperty("--font-mono");
    return;
  }

  const families = STOREFRONT_FONT_FAMILIES[preset];
  root.style.setProperty("--font-display", families.display);
  root.style.setProperty("--font-body", families.body);
  root.style.setProperty("--font-mono", families.mono);
}
