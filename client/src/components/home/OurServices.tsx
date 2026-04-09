import { useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import { useThemeStore } from "@/store/theme";
import "./OurServices.css";

interface OurServicesProps {
  config?: Record<string, any>;
}

type ServiceCardConfig = {
  title: string;
  text: string;
  buttonLabel: string;
  target: string;
};

const GRAIN_DATA_URI = `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.07'/%3E%3C/svg%3E")`;
const EASY_EXCHANGE_IMAGE_URL = "/images/easy-exchange-final.png?v=1";
const MADE_IN_NEPAL_IMAGE_URL = "/images/made-in-nepal-badge.jpg";

function Card1TruckArt() {
  return (
    <div className="relative flex h-[228px] items-center justify-center overflow-hidden bg-gradient-to-br from-[#91a8bf] via-[#a6b8cb] to-[#b6c4d4] lg:h-[268px]">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_35%,rgba(255,255,255,0.55),transparent_52%),radial-gradient(circle_at_80%_70%,rgba(255,255,255,0.32),transparent_58%)]" />
      <div className="relative z-[1] flex items-end justify-center">
        <div className="our-services-truck-wrap relative flex scale-[0.9] items-center sm:scale-[0.98]">
          <div className="absolute right-full mr-1 flex flex-col gap-1.5">
            <div className="our-services-speed-line h-0.5 w-8 rounded-full bg-white/80" />
            <div className="our-services-speed-line h-0.5 w-10 rounded-full bg-white/70" />
            <div className="our-services-speed-line h-0.5 w-7 rounded-full bg-white/60" />
          </div>
          <svg width="200" height="100" viewBox="0 0 200 100" aria-hidden>
            <circle cx="52" cy="78" r="14" fill="#111" />
            <circle cx="52" cy="78" r="6" fill="#888" />
            <circle cx="128" cy="78" r="14" fill="#111" />
            <circle cx="128" cy="78" r="6" fill="#888" />
            <rect x="35" y="38" width="95" height="32" rx="3" fill="#e03020" />
            <text x="52" y="58" fill="#fff" fontSize="11" fontWeight="700" fontFamily="system-ui,sans-serif">
              RARE.NP
            </text>
            <rect x="125" y="28" width="38" height="42" rx="2" fill="#c82010" />
            <rect x="130" y="34" width="22" height="18" rx="1" fill="#a0d4f0" />
            <circle cx="158" cy="52" r="4" fill="#f5e080" />
          </svg>
        </div>
      </div>
    </div>
  );
}

function Card2MountainBg() {
  return (
    <svg className="absolute inset-0 h-full w-full" viewBox="0 0 400 200" preserveAspectRatio="none" aria-hidden>
      <polygon points="0,200 0,120 80,90 160,130 240,70 320,110 400,85 400,200" fill="#6a8a9a" opacity="0.5" />
      <polygon points="0,200 0,145 100,160 200,115 300,150 400,125 400,200" fill="#8aacbc" opacity="0.55" />
      <polygon points="240,70 255,88 225,92" fill="rgba(255,255,255,0.55)" />
      <polygon points="160,115 175,128 148,132" fill="rgba(255,255,255,0.5)" />
    </svg>
  );
}

function Card2Art({ imageUrl }: { imageUrl?: string }) {
  return (
    <div className="relative flex h-[228px] items-center justify-center overflow-hidden bg-[#d8e1ea] lg:h-[268px]">
      <Card2MountainBg />
      <div className="relative z-[1] flex items-center justify-center p-6">
        <img
          src={imageUrl ?? MADE_IN_NEPAL_IMAGE_URL}
          alt="Made in Nepal visual"
          width={220}
          height={220}
          decoding="async"
          className="block h-[144px] w-[144px] shrink-0 rounded-full border border-white/50 bg-white p-3 object-cover object-center shadow-lg shadow-black/15 select-none"
          draggable={false}
        />
      </div>
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-white/12 via-transparent to-black/8" />
    </div>
  );
}

function Card3ExchangeArt({ imageUrl }: { imageUrl?: string }) {
  return (
    <div className="relative flex h-[228px] items-center justify-center overflow-hidden bg-gradient-to-br from-[#9daec2] via-[#b8c6d3] to-[#c9d5df] lg:h-[268px]">
      <div className="our-services-box-exchange relative flex items-center justify-center">
        <img
          src={imageUrl ?? EASY_EXCHANGE_IMAGE_URL}
          alt="Easy exchange icon"
          width={220}
          height={220}
          decoding="async"
          className="block h-[140px] w-[140px] shrink-0 scale-[1.04] rounded-full border border-white/25 object-cover object-[center_36%] opacity-[0.95] shadow-lg shadow-black/20 select-none"
          draggable={false}
        />
      </div>
    </div>
  );
}

export default function OurServices({ config: _config = {} }: OurServicesProps) {
  const [, setLocation] = useLocation();
  const { theme } = useThemeStore();
  const sectionRef = useRef<HTMLElement>(null);
  const [cardsVisible, setCardsVisible] = useState(false);
  const [libraryImages, setLibraryImages] = useState<string[]>([]);
  const config = (_config ?? {}) as Record<string, any>;

  useEffect(() => {
    const el = sectionRef.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const hit = entries[0];
        if (hit?.isIntersecting) {
          setCardsVisible(true);
          observer.unobserve(el);
        }
      },
      { threshold: 0.15 },
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    let active = true;
    fetch("/api/public/media?category=our_services&limit=4")
      .then((res) => res.json())
      .then((json) => {
        if (!active) return;
        const urls = Array.isArray(json?.data)
          ? json.data
              .map((item: any) => (typeof item?.url === "string" ? item.url : ""))
              .filter(Boolean)
          : [];
        setLibraryImages(urls);
      })
      .catch(() => {
        if (active) setLibraryImages([]);
      });
    return () => {
      active = false;
    };
  }, []);

  const goShop = () => setLocation("/shop");
  const goNewCollection = () => setLocation("/new-collection");
  const goAtelierContact = () => {
    setLocation("/atelier");
    queueMicrotask(() => {
      window.location.hash = "contact";
    });
  };

  const handleTarget = (target?: string) => {
    switch (target) {
      case "/shop":
      case "shop":
        goShop();
        return;
      case "/new-collection":
      case "new-collection":
        goNewCollection();
        return;
      case "atelier-contact":
      case "/atelier#contact":
      case "contact":
        goAtelierContact();
        return;
      case "/atelier":
      case "atelier":
        setLocation("/atelier");
        return;
      default:
        if (typeof target === "string" && target.trim()) {
          setLocation(target);
          return;
        }
        goShop();
    }
  };

  const serviceCards: ServiceCardConfig[] = Array.isArray(config.cards) && config.cards.length
    ? config.cards
        .filter((card): card is Record<string, unknown> => !!card && typeof card === "object")
        .map((card) => ({
          title: typeof card.title === "string" ? card.title : "",
          text: typeof card.text === "string" ? card.text : "",
          buttonLabel: typeof card.buttonLabel === "string" ? card.buttonLabel : "",
          target: typeof card.target === "string" ? card.target : "",
        }))
        .filter((card) => card.title || card.text || card.buttonLabel || card.target)
      : [
        {
          title: "Fast Delivery",
          text: "We deliver directly to your doorstep anywhere throughout Nepal",
          buttonLabel: "Shop Now",
          target: "/shop",
        },
        {
          title: "Made In Nepal",
          text: "All our products are handmade locally, supporting Nepali creators",
          buttonLabel: "See Products",
          target: "/new-collection",
        },
        {
          title: "Easy Exchange",
          text: "Hassle-free exchange or return if your item arrives damaged.",
          buttonLabel: "Contact Us",
          target: "atelier-contact",
        },
      ];
  const sectionTitle = typeof config.title === "string" && config.title.trim()
    ? config.title
    : "Our Services";
  const sectionText = typeof config.text === "string" && config.text.trim()
    ? config.text
    : "Door-to-Door Delivery Across Nepal 🇳🇵";
  const cardImages = libraryImages.slice(1, 4);
  const isDark = theme === "dark";

  return (
    <section
      ref={sectionRef}
      className={`relative overflow-hidden px-4 py-10 sm:px-6 sm:py-12 lg:px-10 lg:py-14 ${
        isDark ? "text-white" : "text-[#15171b]"
      }`}
      style={{
        background: isDark
          ? "linear-gradient(180deg, #0b1118 0%, #111a24 100%)"
          : "linear-gradient(180deg, #edf3f8 0%, #e4ecf3 100%)",
      }}
    >
      <div
        className="absolute inset-0"
        style={{
          background: isDark
            ? "radial-gradient(circle at 50% 0%, rgba(255,255,255,0.1), transparent 56%)"
            : "radial-gradient(circle at 50% 0%, rgba(255,255,255,0.75), transparent 58%)",
        }}
      />

      <div
        className="pointer-events-none absolute inset-0 z-[2] opacity-[0.05]"
        style={{
          backgroundImage: GRAIN_DATA_URI,
          backgroundSize: "180px",
        }}
      />

      <div
        className={`relative z-10 mx-auto max-w-[1500px] rounded-[28px] border p-4 shadow-[0_26px_70px_rgba(0,0,0,0.16)] sm:p-6 lg:p-8 ${
          isDark ? "border-white/12 bg-white/[0.04]" : "border-black/8 bg-white/70"
        }`}
      >
        <h2
          className={`our-services-heading mb-2 text-center font-extrabold ${isDark ? "text-white" : "text-[#15171b]"}`}
          style={{
            fontFamily: "var(--font-display, 'Playfair Display', serif)",
            fontSize: "clamp(34px, 4.6vw, 58px)",
          }}
        >
          {sectionTitle}
        </h2>
        <p
          className={`mb-7 text-center font-medium lg:mb-9 ${isDark ? "text-white/85" : "text-[#4d5a68]"}`}
          style={{
            fontFamily: "var(--font-body, 'DM Sans', sans-serif)",
            fontSize: "clamp(14px, 1.35vw, 18px)",
          }}
        >
          {sectionText}
        </p>

        <div className="grid max-w-[1500px] grid-cols-1 gap-5 md:grid-cols-3 md:gap-5 lg:gap-6">
          {serviceCards.slice(0, 3).map((card, index) => {
            const art =
              index === 1 ? (
                <Card2Art imageUrl={MADE_IN_NEPAL_IMAGE_URL} />
              ) : cardImages[index] ? (
                <div className="relative flex h-[228px] items-center justify-center overflow-hidden bg-gradient-to-br from-[#0f2233] via-[#20364b] to-[#36506a] lg:h-[268px]">
                  <img
                    src={cardImages[index]}
                    alt={`${card.title} visual`}
                    width={1200}
                    height={800}
                    decoding="async"
                    className="h-full w-full object-cover object-center"
                    draggable={false}
                  />
                  <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/10 via-transparent to-black/35" />
                </div>
              ) : index === 0 ? (
                <Card1TruckArt />
              ) : (
                <Card3ExchangeArt imageUrl={cardImages[index]} />
              );
            const buttonClass =
              index === 0
                ? "bg-[#f4c528] text-[#252017] hover:bg-[#e6b91f]"
                : index === 1
                  ? "bg-[#ef4b4b] text-white hover:bg-[#e03f3f]"
                  : "bg-[#4a43a6] text-white hover:bg-[#413a95]";
            return (
              <article
                key={`${card.title}-${index}`}
                className={`our-services-card relative flex flex-col overflow-hidden rounded-[24px] border border-white/16 bg-white/90 shadow-[0_18px_42px_rgba(15,23,42,0.16)] transition-[transform,box-shadow] duration-300 ease-in-out backdrop-blur-[2px] ${
                  cardsVisible ? "visible" : ""
                }`}
              >
                <div className="px-4 pt-4 sm:px-5">
                  <div className="overflow-hidden rounded-[20px] border border-white/65 bg-white shadow-[0_12px_30px_rgba(15,23,42,0.12)] dark:border-white/12 dark:bg-[#141414]">
                    {art}
                  </div>
                </div>
                <div className="flex flex-1 flex-col items-center px-5 pb-6 pt-7 text-center text-[#15171b] sm:px-6">
                  <h3
                    className="our-services-card-title mb-3 mt-1 text-[24px] font-semibold leading-[1.08] tracking-[-0.02em] lg:text-[30px]"
                    style={{ fontFamily: "var(--font-display, 'Playfair Display', serif)" }}
                  >
                    {card.title}
                  </h3>
                  <p
                    className="mb-6 flex-1 max-w-[30ch] text-[14px] leading-[1.6] text-[#5f646f] lg:text-[15px]"
                    style={{ fontFamily: "var(--font-body, 'DM Sans', sans-serif)" }}
                  >
                    {card.text}
                  </p>
                  <button
                    type="button"
                    onClick={() => handleTarget(card.target)}
                    className={`our-services-btn w-full max-w-[220px] cursor-pointer rounded-[12px] border border-black/10 px-6 py-[11px] text-[15px] font-semibold tracking-[0.01em] transition-[background,transform,border-color] duration-200 hover:scale-[1.02] ${buttonClass}`}
                  >
                    {card.buttonLabel || "Learn More"}
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}
