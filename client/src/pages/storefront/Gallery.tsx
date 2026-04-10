import { useMemo } from "react";
import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, Instagram, Play } from "lucide-react";

import { fetchProducts, type ProductApi } from "@/lib/api";
import { BrandedLoader } from "@/components/ui/BrandedLoader";
import { StorefrontSeo } from "@/components/seo/StorefrontSeo";
import ThreeDHoverGallery from "@/components/ui/3d-hover-gallery";
import { useThemeStore } from "@/store/theme";

type SiteAsset = {
  id: string | number;
  imageUrl: string | null;
  videoUrl: string | null;
  altText: string | null;
};

type PublicMediaAsset = {
  id: string | number;
  url: string;
  filename?: string | null;
};

type GalleryPhoto = {
  id: string;
  src: string;
  alt: string;
  eyebrow: string;
};

type GalleryVideo = {
  id: string;
  src: string;
  poster: string | null;
  title: string;
};

function parseJsonArray(value: string | null | undefined): string[] {
  if (!value?.trim()) return [];

  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed)
      ? parsed.filter((item): item is string => typeof item === "string" && item.trim().length > 0)
      : [];
  } catch {
    return [];
  }
}

function prettyCategory(category: string | null | undefined): string {
  if (!category) return "Rare Atelier";

  return category
    .replace(/[-_]+/g, " ")
    .trim()
    .toLowerCase()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function dedupePhotos(items: GalleryPhoto[]): GalleryPhoto[] {
  const seen = new Set<string>();

  return items.filter((item) => {
    if (seen.has(item.src)) return false;
    seen.add(item.src);
    return true;
  });
}

function dedupeVideos(items: GalleryVideo[]): GalleryVideo[] {
  const seen = new Set<string>();

  return items.filter((item) => {
    if (seen.has(item.src)) return false;
    seen.add(item.src);
    return true;
  });
}

function getProductGalleryImages(product: ProductApi): string[] {
  return Array.from(
    new Set(
      [product.imageUrl, ...parseJsonArray(product.galleryUrls)]
        .filter((item): item is string => typeof item === "string" && item.trim().length > 0),
    ),
  );
}

const PHOTO_CARD_ASPECTS = [
  "aspect-[3/4]",
  "aspect-[4/5]",
  "aspect-square",
  "aspect-[4/6]",
  "aspect-[3/4]",
  "aspect-[5/6]",
];

async function fetchJsonArray<T>(url: string): Promise<T[]> {
  const response = await fetch(url);
  if (!response.ok) return [];

  const json = (await response.json()) as { data?: T[] };
  return Array.isArray(json.data) ? json.data : [];
}

export default function Gallery() {
  const theme = useThemeStore((state) => state.theme);
  const isDark = theme === "dark";

  const { data: productsData, isLoading: productsLoading } = useQuery<{ products: ProductApi[]; total: number }>({
    queryKey: ["products", "gallery", { page: 1, limit: 18 }],
    queryFn: () => fetchProducts({ page: 1, limit: 18 }),
    staleTime: 1000 * 60 * 5,
  });

  const { data: mediaData, isLoading: mediaLoading } = useQuery({
    queryKey: ["gallery-media"],
    queryFn: async () => {
      const [collectionAssets, heroAssets, collectionMedia, servicesMedia] = await Promise.all([
        fetchJsonArray<SiteAsset>("/api/site-assets/collection_page"),
        fetchJsonArray<SiteAsset>("/api/site-assets/hero"),
        fetchJsonArray<PublicMediaAsset>("/api/public/media?category=collection_page&limit=12"),
        fetchJsonArray<PublicMediaAsset>("/api/public/media?category=our_services&limit=8"),
      ]);

      return {
        siteAssets: [...collectionAssets, ...heroAssets],
        publicMedia: [...collectionMedia, ...servicesMedia],
      };
    },
    staleTime: 1000 * 60 * 5,
  });

  const products = productsData?.products ?? [];
  const siteAssets = mediaData?.siteAssets ?? [];
  const publicMedia = mediaData?.publicMedia ?? [];

  const heroImages = useMemo(() => {
    const mediaImages = siteAssets
      .map((asset) => asset.imageUrl)
      .filter((item): item is string => typeof item === "string" && item.trim().length > 0);
    const productImages = products.flatMap((product) => getProductGalleryImages(product).slice(0, 1));

    return Array.from(
      new Set([
        ...mediaImages,
        ...publicMedia.map((asset) => asset.url),
        ...productImages,
        "/images/feature1.webp",
        "/images/feature2.webp",
        "/images/feature3.webp",
        "/images/landingpage3.webp",
      ]),
    ).slice(0, 8);
  }, [products, publicMedia, siteAssets]);

  const galleryVideos = useMemo(() => {
    const videos = siteAssets
      .filter((asset) => typeof asset.videoUrl === "string" && asset.videoUrl.trim().length > 0)
      .map((asset, index) => ({
        id: `video-${asset.id}-${index}`,
        src: asset.videoUrl as string,
        poster: asset.imageUrl,
        title: asset.altText?.trim() || `Rare Atelier motion ${index + 1}`,
      }));

    return dedupeVideos(videos).slice(0, 2);
  }, [siteAssets]);

  const galleryPhotos = useMemo(() => {
    const sitePhotos: GalleryPhoto[] = siteAssets
      .map((asset, index) => {
        if (!asset.imageUrl) return null;

        return {
          id: `site-${asset.id}-${index}`,
          src: asset.imageUrl,
          alt: asset.altText?.trim() || `Rare Atelier gallery frame ${index + 1}`,
          eyebrow: asset.videoUrl ? "Campaign still" : "Brand frame",
        };
      })
      .filter((item): item is GalleryPhoto => item !== null);

    const libraryPhotos: GalleryPhoto[] = publicMedia.map((asset, index) => ({
      id: `library-${asset.id}-${index}`,
      src: asset.url,
      alt: asset.filename?.trim() || `Rare Atelier library frame ${index + 1}`,
      eyebrow: "Studio archive",
    }));

    const productPhotos: GalleryPhoto[] = products.flatMap((product) =>
      getProductGalleryImages(product).slice(0, 2).map((image, index) => ({
        id: `product-${product.id}-${index}`,
        src: image,
        alt: product.name,
        eyebrow: prettyCategory(product.category),
      })),
    );

    return dedupePhotos([...sitePhotos, ...libraryPhotos, ...productPhotos]).slice(0, 24);
  }, [products, publicMedia, siteAssets]);

  const selectedProducts = useMemo(() => products.slice(0, 4), [products]);
  const isLoading = productsLoading || mediaLoading;

  return (
    <div className="min-h-screen bg-[#f6f2eb] text-[#111111] dark:bg-[#080808] dark:text-white">
      <StorefrontSeo
        title="Gallery | Rare Atelier"
        description="A professional Rare Atelier gallery of campaign stills, collab media, motion moments, and product imagery."
        canonicalPath="/gallery"
        image={heroImages[0] ?? "/images/feature1.webp"}
        structuredData={{
          "@context": "https://schema.org",
          "@type": "CollectionPage",
          name: "Rare Atelier Gallery",
          url: typeof window !== "undefined" ? `${window.location.origin}/gallery` : "/gallery",
          numberOfItems: galleryPhotos.length + galleryVideos.length,
        }}
      />

      <section className="relative overflow-hidden border-b border-black/10 dark:border-white/10">
        <div className="absolute inset-0">
          <ThreeDHoverGallery
            images={heroImages}
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
            brightnessLevel={isDark ? 0.45 : 0.92}
            enableKeyboardNavigation={true}
            autoPlay={false}
          />
          <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(8,8,8,0.18),rgba(8,8,8,0.58))]" />
        </div>

        <div className="relative z-10 mx-auto flex min-h-[78vh] w-full max-w-[1500px] items-end px-4 py-16 sm:px-6 lg:px-8 lg:py-20">
          <div className="max-w-4xl text-white">
            <p className="text-[10px] font-semibold uppercase tracking-[0.4em] text-white/70">
              Rare Atelier Gallery
            </p>
            <h1 className="mt-4 text-5xl font-semibold tracking-[-0.06em] sm:text-6xl lg:text-8xl">
              Collab frames, campaign motion, and the brand in detail.
            </h1>
            <p className="mt-5 max-w-2xl text-sm leading-7 text-white/78 sm:text-base">
              A dedicated brand gallery built from the storefront&apos;s actual visual library, campaign assets, and
              product imagery so customers can browse the world around Rare Atelier, not just the catalog.
            </p>

            <div className="mt-8 flex flex-wrap items-center gap-4">
              <Link
                href="/products"
                className="inline-flex h-12 items-center gap-2 rounded-full bg-white px-5 text-[11px] font-semibold uppercase tracking-[0.24em] text-[#111111] transition-transform duration-200 hover:-translate-y-0.5"
              >
                Shop Products
                <ArrowRight className="h-4 w-4" />
              </Link>
              <a
                href="https://www.instagram.com/rareofficial.au/"
                target="_blank"
                rel="noreferrer"
                className="inline-flex h-12 items-center gap-2 rounded-full border border-white/20 bg-white/10 px-5 text-[11px] font-semibold uppercase tracking-[0.24em] text-white backdrop-blur transition-transform duration-200 hover:-translate-y-0.5"
              >
                Follow Instagram
                <Instagram className="h-4 w-4" />
              </a>
            </div>

            <div className="mt-10 flex flex-wrap gap-6 text-[11px] uppercase tracking-[0.26em] text-white/70">
              <span>{galleryPhotos.length} Photo Frames</span>
              <span>{galleryVideos.length} Motion Clips</span>
              <span>{products.length} Product Looks</span>
            </div>
          </div>
        </div>
      </section>

      {isLoading ? (
        <div className="flex min-h-[50vh] items-center justify-center">
          <BrandedLoader />
        </div>
      ) : (
        <>
          {galleryVideos.length > 0 ? (
            <section className="mx-auto w-full max-w-[1500px] px-4 py-14 sm:px-6 lg:px-8">
              <div className="mb-8 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.36em] text-neutral-500 dark:text-neutral-400">
                    Motion
                  </p>
                  <h2 className="mt-2 text-3xl font-semibold tracking-[-0.04em] sm:text-4xl">
                    Video moments from the brand world.
                  </h2>
                </div>
                <p className="max-w-xl text-sm leading-6 text-neutral-600 dark:text-neutral-300">
                  These clips surface the moving side of the brand so the gallery feels richer than a static lookbook.
                </p>
              </div>

              <div className="grid gap-5 lg:grid-cols-2">
                {galleryVideos.map((video) => (
                  <article
                    key={video.id}
                    className="overflow-hidden rounded-[28px] border border-black/10 bg-white shadow-[0_24px_60px_rgba(17,17,17,0.08)] dark:border-white/10 dark:bg-white/[0.04]"
                  >
                    <div className="relative aspect-video overflow-hidden bg-black">
                      <video
                        src={video.src}
                        poster={video.poster ?? undefined}
                        className="h-full w-full object-cover"
                        controls
                        playsInline
                        preload="metadata"
                      />
                      <div className="pointer-events-none absolute left-4 top-4 inline-flex items-center gap-2 rounded-full bg-black/55 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.24em] text-white backdrop-blur">
                        <Play className="h-3 w-3" />
                        Motion
                      </div>
                    </div>
                    <div className="px-5 py-5">
                      <p className="text-[10px] font-semibold uppercase tracking-[0.32em] text-neutral-500 dark:text-neutral-400">
                        Rare Atelier
                      </p>
                      <h3 className="mt-2 text-lg font-semibold">{video.title}</h3>
                    </div>
                  </article>
                ))}
              </div>
            </section>
          ) : null}

          <section className="mx-auto w-full max-w-[1500px] px-4 py-2 pb-16 sm:px-6 lg:px-8">
            <div className="mb-8 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.36em] text-neutral-500 dark:text-neutral-400">
                  Photo Gallery
                </p>
                <h2 className="mt-2 text-3xl font-semibold tracking-[-0.04em] sm:text-4xl">
                  Professional stills from the campaign archive.
                </h2>
              </div>
              <p className="max-w-xl text-sm leading-6 text-neutral-600 dark:text-neutral-300">
                A denser editorial wall built from collection assets, public media, and the strongest product imagery in
                the storefront.
              </p>
            </div>

            <div className="columns-1 gap-4 sm:columns-2 lg:columns-3 xl:columns-4">
              {galleryPhotos.map((photo, index) => (
                <article key={photo.id} className="mb-4 break-inside-avoid">
                  <div className="group overflow-hidden rounded-[24px] border border-black/10 bg-white shadow-[0_18px_45px_rgba(17,17,17,0.07)] dark:border-white/10 dark:bg-white/[0.04]">
                    <div className={`overflow-hidden ${PHOTO_CARD_ASPECTS[index % PHOTO_CARD_ASPECTS.length]}`}>
                      <img
                        src={photo.src}
                        alt={photo.alt}
                        loading="lazy"
                        className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.03]"
                      />
                    </div>
                    <div className="space-y-2 px-4 py-4">
                      <p className="text-[10px] font-semibold uppercase tracking-[0.3em] text-neutral-500 dark:text-neutral-400">
                        {photo.eyebrow}
                      </p>
                      <p className="text-sm font-medium leading-6 text-[#111111] dark:text-white">{photo.alt}</p>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </section>

          {selectedProducts.length > 0 ? (
            <section className="border-t border-black/10 bg-white/70 py-14 dark:border-white/10 dark:bg-white/[0.03]">
              <div className="mx-auto w-full max-w-[1500px] px-4 sm:px-6 lg:px-8">
                <div className="mb-8 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-[0.36em] text-neutral-500 dark:text-neutral-400">
                      Selected Looks
                    </p>
                    <h2 className="mt-2 text-3xl font-semibold tracking-[-0.04em] sm:text-4xl">
                      From gallery mood to product detail.
                    </h2>
                  </div>
                  <Link
                    href="/products"
                    className="inline-flex h-11 items-center justify-center rounded-full border border-black/10 bg-white px-5 text-[11px] font-semibold uppercase tracking-[0.24em] text-[#111111] transition-transform duration-200 hover:-translate-y-0.5 dark:border-white/12 dark:bg-white/5 dark:text-white"
                  >
                    Browse Full Shop
                  </Link>
                </div>

                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                  {selectedProducts.map((product) => {
                    const image = getProductGalleryImages(product)[0] ?? "";

                    return (
                      <Link
                        key={product.id}
                        href={`/product/${product.id}`}
                        className="group overflow-hidden rounded-[24px] border border-black/10 bg-[#f5efe7] dark:border-white/10 dark:bg-[#121212]"
                      >
                        <div className="aspect-[4/5] overflow-hidden">
                          <img
                            src={image}
                            alt={product.name}
                            loading="lazy"
                            className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.03]"
                          />
                        </div>
                        <div className="space-y-2 px-4 py-4">
                          <p className="text-[10px] font-semibold uppercase tracking-[0.3em] text-neutral-500 dark:text-neutral-400">
                            {prettyCategory(product.category)}
                          </p>
                          <h3 className="text-base font-semibold">{product.name}</h3>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              </div>
            </section>
          ) : null}
        </>
      )}
    </div>
  );
}
