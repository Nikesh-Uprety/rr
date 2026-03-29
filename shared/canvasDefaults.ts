export type CanvasHeroSlide = {
  tag: string;
  headline: string;
  eyebrow: string;
  body: string;
  ctaLabel: string;
  ctaHref: string;
  image: string;
  duration?: number;
};

export const MAISON_NOCTURNE_DEFAULT_HERO_SLIDES: CanvasHeroSlide[] = [
  {
    tag: "Maison Nocturne / 01",
    headline: "Monochrome Motion.",
    eyebrow: "Shop the signature essentials",
    body: "Sharp silhouettes, quiet luxury, and black-and-white layering built for the Rare Atelier shop floor.",
    ctaLabel: "Shop",
    ctaHref: "/products",
    image: "/images/maison-nocturne-hero-1.webp",
    duration: 6800,
  },
  {
    tag: "Editorial Drop / 02",
    headline: "New Collection.",
    eyebrow: "Fresh pieces in a clean editorial frame",
    body: "A precise new-season edit with strong tailoring, tactile texture, and a restrained black-and-white mood.",
    ctaLabel: "New Collection",
    ctaHref: "/new-collection",
    image:
      "https://images.unsplash.com/photo-1483985988355-763728e1935b?auto=format&fit=crop&w=1800&q=80",
    duration: 6200,
  },
  {
    tag: "Atelier Story / 03",
    headline: "Inside The Atelier.",
    eyebrow: "Craft, detail, and the Rare point of view",
    body: "Step into the studio language behind the label with a cinematic introduction to the atelier experience.",
    ctaLabel: "Atelier",
    ctaHref: "/atelier",
    image:
      "https://images.unsplash.com/photo-1529139574466-a303027c1d8b?auto=format&fit=crop&w=1800&q=80",
    duration: 6400,
  },
];
