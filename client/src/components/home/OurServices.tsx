import { useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
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

function SectionMountainSilhouette() {
  return (
    <svg
      className="pointer-events-none absolute bottom-0 left-0 right-0 z-[1] h-[260px] w-full opacity-[0.18]"
      viewBox="0 0 1200 260"
      preserveAspectRatio="none"
      aria-hidden
    >
      {/* Back range */}
      <polygon
        points="0,260 0,120 180,95 320,140 480,80 620,115 780,55 920,100 1100,70 1200,90 1200,260"
        fill="#6a6058"
      />
      {/* Front range */}
      <polygon
        points="0,260 0,155 140,175 260,130 400,165 560,125 720,155 880,110 1040,145 1200,125 1200,260"
        fill="#8a8070"
      />
      {/* Snow caps */}
      <polygon points="480,80 500,95 460,100" fill="rgba(255,255,255,0.6)" />
      <polygon points="780,55 802,72 758,78" fill="rgba(255,255,255,0.6)" />
      <polygon points="1100,70 1120,88 1080,92" fill="rgba(255,255,255,0.6)" />
    </svg>
  );
}

function Card1TruckArt() {
  return (
    <div className="relative flex h-[240px] lg:h-[280px] items-center justify-center overflow-hidden bg-gradient-to-br from-[#050505] via-[#0b0b0b] to-[#141414]">
      <div className="our-services-truck-wrap relative flex items-center">
        {/* Speed lines */}
        <div className="absolute right-full mr-1 flex flex-col gap-1.5">
          <div className="our-services-speed-line h-0.5 w-8 rounded-full bg-white/50" />
          <div className="our-services-speed-line h-0.5 w-10 rounded-full bg-white/45" />
          <div className="our-services-speed-line h-0.5 w-7 rounded-full bg-white/40" />
        </div>
        <svg width="200" height="100" viewBox="0 0 200 100" aria-hidden>
          {/* Wheels */}
          <circle cx="52" cy="78" r="14" fill="#111" />
          <circle cx="52" cy="78" r="6" fill="#888" />
          <circle cx="128" cy="78" r="14" fill="#111" />
          <circle cx="128" cy="78" r="6" fill="#888" />
          {/* Trailer / body */}
          <rect x="35" y="38" width="95" height="32" rx="3" fill="#e03020" />
          <text x="52" y="58" fill="#fff" fontSize="11" fontWeight="700" fontFamily="system-ui,sans-serif">
            RARE.NP
          </text>
          {/* Cab */}
          <rect x="125" y="28" width="38" height="42" rx="2" fill="#c82010" />
          <rect x="130" y="34" width="22" height="18" rx="1" fill="#a0d4f0" />
          <circle cx="158" cy="52" r="4" fill="#f5e080" />
        </svg>
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

function Card2Art() {
  return (
    <div className="relative flex h-[240px] lg:h-[280px] items-center justify-center overflow-hidden bg-gradient-to-br from-[#050505] via-[#0b0b0b] to-[#141414]">
      <Card2MountainBg />
      <div className="our-services-flag-wrap relative z-[2] flex justify-center">
        <img
          src="/nepal-flag-icon.svg"
          alt=""
          width={72}
          height={88}
          className="h-[88px] w-[72px] object-contain select-none"
          draggable={false}
        />
      </div>
    </div>
  );
}

function Card3ExchangeArt() {
  return (
    <div className="relative flex h-[240px] lg:h-[280px] items-center justify-center overflow-hidden bg-gradient-to-br from-[#050505] via-[#0b0b0b] to-[#141414]">
      <div className="our-services-box-exchange relative flex items-center justify-center">
        <img
          src={`${import.meta.env.BASE_URL}easyexchange.svg`}
          alt=""
          width={180}
          height={194}
          decoding="async"
          className="block h-[118px] w-[118px] shrink-0 object-contain object-center opacity-[0.9] select-none"
          draggable={false}
        />
      </div>
    </div>
  );
}

export default function OurServices({ config: _config = {} }: OurServicesProps) {
  const [, setLocation] = useLocation();
  const sectionRef = useRef<HTMLElement>(null);
  const [cardsVisible, setCardsVisible] = useState(false);
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
          text: "Nationwide door-to-door shipping so your Rare pieces arrive quickly and safely, from Kathmandu to your doorstep.",
          buttonLabel: "Shop Now",
          target: "/shop",
        },
        {
          title: "Made In Nepal",
          text: "Designed and produced with Himalayan craft value small runs, honest materials, and a story stitched into every garment.",
          buttonLabel: "See Products",
          target: "/new-collection",
        },
        {
          title: "Easy Exchange",
          text: "Need a different size? Our exchange process is straightforward reach out and we will help you swap with confidence.",
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

  return (
    <section
      ref={sectionRef}
      className="relative min-h-[680px] overflow-hidden px-6 sm:px-10 lg:px-16 py-[80px] pb-[96px]"
      style={{
        background: "linear-gradient(to bottom, #050505, #0b0b0b 45%, #111111)",
      }}
    >
      <SectionMountainSilhouette />

      {/* Grain */}
      <div
        className="pointer-events-none absolute inset-0 z-[2] opacity-[0.04]"
        style={{
          backgroundImage: GRAIN_DATA_URI,
          backgroundSize: "180px",
        }}
      />

      <div
        className="pointer-events-none absolute bottom-0 left-0 top-0 z-[3] w-[200px]"
        style={{
          background: "linear-gradient(to right, rgba(255,255,255,.06), transparent)",
        }}
      />
      <div
        className="pointer-events-none absolute bottom-0 right-0 top-0 z-[3] w-[180px]"
        style={{
          background: "linear-gradient(to left, rgba(255,255,255,.05), transparent)",
        }}
      />

      <div className="relative z-10 mx-auto max-w-[1400px]">
        <h2
          className="our-services-heading mb-3 text-center font-extrabold text-white"
          style={{
            fontSize: "clamp(36px, 5vw, 64px)",
          }}
        >
          {sectionTitle}
        </h2>
        <p
          className="mb-14 text-center text-white/72"
          style={{ fontSize: "clamp(16px, 1.8vw, 22px)" }}
        >
          {sectionText}
        </p>

        <div className="grid max-w-[1400px] grid-cols-1 gap-6 md:grid-cols-3 md:gap-6 lg:gap-8">
          {serviceCards.slice(0, 3).map((card, index) => {
            const art = index === 0 ? <Card1TruckArt /> : index === 1 ? <Card2Art /> : <Card3ExchangeArt />;
            return (
              <article
                key={`${card.title}-${index}`}
                className={`our-services-card flex flex-col overflow-hidden rounded-[20px] border border-white/10 bg-[#0b0b0b] shadow-[0_12px_38px_rgba(0,0,0,0.28)] transition-[transform,box-shadow] duration-300 ease-in-out ${
                  cardsVisible ? "visible" : ""
                }`}
              >
                {art}
                <div className="flex flex-1 flex-col items-center bg-[#0b0b0b] px-6 pb-8 pt-7 text-center">
                  <h3 className="our-services-card-title mb-3 text-[22px] lg:text-[26px] font-bold text-white">{card.title}</h3>
                  <p className="mb-6 flex-1 text-[14px] lg:text-[15px] leading-[1.75] text-white/72">
                    {card.text}
                  </p>
                  <button
                    type="button"
                    onClick={() => handleTarget(card.target)}
                    className="our-services-btn cursor-pointer rounded-md border border-white/14 bg-[#161616] px-10 py-[13px] text-[14px] font-medium tracking-[0.06em] text-white transition-[background,transform,border-color] duration-200 hover:scale-[1.02] hover:bg-[#202020] hover:border-white/22"
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
