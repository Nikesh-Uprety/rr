import { useEffect, useRef, useState } from "react";
import { Helmet } from "react-helmet-async";
import ContactInfo from "@/components/home/ContactSection";

export default function Contact() {
  const conceptSectionRef = useRef<HTMLElement | null>(null);
  const [isConceptVisible, setIsConceptVisible] = useState(false);

  useEffect(() => {
    const node = conceptSectionRef.current;
    if (!node) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          setIsConceptVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.2 },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const scrollToContact = () => {
      if (window.location.hash !== "#contact") return;
      const el = document.getElementById("contact");
      if (el) {
        setTimeout(() => {
          el.scrollIntoView({ behavior: "smooth", block: "start" });
        }, 100);
      }
    };
    scrollToContact();
    window.addEventListener("hashchange", scrollToContact);
    return () => window.removeEventListener("hashchange", scrollToContact);
  }, []);

  return (
    <div className="flex-1">
      <Helmet>
        <title>ATELIER | Rare Atelier</title>
      </Helmet>

      {/* Hero Section */}
      <section className="relative overflow-hidden border-b border-[var(--border)]">
        <div
          className="absolute inset-0"
          style={{
            backgroundImage: "url('/images/about.webp')",
            backgroundSize: "cover",
            backgroundPosition: "center",
            animation: "atelier-ken-burns 28s ease-in-out infinite alternate",
          }}
        />
        <div className="absolute inset-0 bg-black/45 dark:bg-black/60" />
        <div className="relative h-[72vh] min-h-[520px] md:h-[88vh] md:min-h-[760px]" />
      </section>

      {/* Concept Section with Parallax Background */}
      <section
        ref={conceptSectionRef}
        className="relative overflow-hidden border-b border-[var(--border)]"
      >
        <div
          className="absolute inset-0"
          style={{
            backgroundImage: "url('/images/concept.webp')",
            backgroundSize: "cover",
            backgroundPosition: "center",
            backgroundAttachment: "fixed",
          }}
        />
        <div
          className={`relative z-10 h-[60vh] min-h-[400px] md:h-[70vh] transition-all duration-1000 ${
            isConceptVisible ? "opacity-100" : "opacity-0"
          }`}
        />
      </section>

      {/* Concept Text Section */}
      <section className="py-24 md:py-32 bg-background border-b border-[var(--border)]">
        <div className="container mx-auto px-4 max-w-6xl">
          <div className="max-w-4xl mx-auto text-center">
            <p className="text-[10px] uppercase tracking-[0.35em] text-muted-foreground font-semibold mb-6">
              The Concept
            </p>
            <h2 className="text-4xl md:text-6xl lg:text-7xl font-black tracking-tight uppercase mb-8 leading-tight">
              Rare Atelier
            </h2>
            <p className="text-lg md:text-xl lg:text-2xl text-muted-foreground leading-relaxed max-w-3xl mx-auto font-light">
              Rare Atelier is a luxury streetwear label from Nepal, creating limited pieces where
              local memory meets a modern global silhouette. Each garment is cut with intent,
              built in small runs, and released as an object of meaning as much as design.
            </p>
            <div className="mt-12 w-24 h-1 bg-muted-foreground/30 mx-auto rounded-full" />
          </div>
        </div>
      </section>

      {/* Contact Section */}
      <section id="contact" className="py-24 bg-background">
        <div className="container mx-auto px-4 max-w-6xl">
          <ContactInfo showMap />
        </div>
      </section>

      <style>{`
        @keyframes atelier-ken-burns {
          0% { transform: scale(1.02) translate3d(0, 0, 0); }
          50% { transform: scale(1.08) translate3d(-1.5%, -1.5%, 0); }
          100% { transform: scale(1.12) translate3d(1.5%, 1%, 0); }
        }
      `}</style>
    </div>
  );
}
