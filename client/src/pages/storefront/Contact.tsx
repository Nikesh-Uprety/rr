import { useEffect } from "react";
import { Helmet } from "react-helmet-async";
import { Link } from "wouter";
import { ArrowRight } from "lucide-react";
import { useThemeStore } from "@/store/theme";
import ContactInfo from "@/components/home/ContactSection";
import OurServices from "@/components/home/OurServices";

const ATELIER_HERO_IMAGE = "/images/about.webp";

export default function Contact() {
  const { theme } = useThemeStore();
  const isDark = theme === "dark";

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
    <div className={`flex-1 ${isDark ? "bg-[#050505] text-white" : "bg-white text-neutral-950"}`}>
      <Helmet>
        <title>ATELIER | Rare Atelier</title>
      </Helmet>

      <section className="relative min-h-[100svh] overflow-hidden">
        <img
          src={ATELIER_HERO_IMAGE}
          alt="Rare Atelier services"
          className="absolute inset-0 h-full w-full object-cover object-center"
        />
        <div
          className="absolute inset-0"
          style={{
            background: isDark
              ? "linear-gradient(180deg, rgba(0,0,0,0.38) 0%, rgba(0,0,0,0.62) 100%)"
              : "linear-gradient(180deg, rgba(12,12,12,0.22) 0%, rgba(12,12,12,0.48) 100%)",
          }}
        />

        <div className="relative z-10 flex min-h-[100svh] items-end px-4 pb-16 pt-32 sm:px-6 sm:pb-20 lg:px-10 lg:pb-24">
          <div className="max-w-[760px]">
            <p
              className={`mb-5 text-[10px] font-semibold uppercase tracking-[0.34em] ${
                isDark ? "text-white/70" : "text-white/80"
              }`}
            >
              Our Services
            </p>
            <h1 className="text-5xl font-black uppercase leading-none tracking-tight text-white sm:text-6xl lg:text-8xl">
              Rare Atelier
            </h1>
            <p className="mt-5 max-w-2xl text-sm leading-7 text-white/85 sm:text-base">
              A simple atelier page for service, support, and direct communication. Explore our core
              services below, then get in touch for fit help, exchanges, or order support.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                href="#services"
                className="inline-flex items-center gap-2 rounded-full bg-white px-6 py-3 text-[11px] font-bold uppercase tracking-[0.22em] text-black transition-transform hover:-translate-y-0.5"
                onClick={(event) => {
                  event.preventDefault();
                  document.getElementById("services")?.scrollIntoView({ behavior: "smooth", block: "start" });
                }}
              >
                Explore Services
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                href="#contact"
                className="inline-flex items-center gap-2 rounded-full border border-white/30 bg-white/10 px-6 py-3 text-[11px] font-bold uppercase tracking-[0.22em] text-white backdrop-blur-sm transition-transform hover:-translate-y-0.5"
                onClick={(event) => {
                  event.preventDefault();
                  document.getElementById("contact")?.scrollIntoView({ behavior: "smooth", block: "start" });
                }}
              >
                Get In Touch
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section
        id="services"
        className={`border-y ${
          isDark ? "border-white/10 bg-[#050505]" : "border-black/10 bg-white"
        }`}
      >
        <OurServices />
      </section>

      <section
        id="contact"
        className={`px-4 py-20 sm:px-6 lg:px-10 lg:py-24 ${
          isDark ? "bg-[#050505]" : "bg-white"
        }`}
      >
        <div className="mx-auto max-w-6xl">
          <ContactInfo showMap />
        </div>
      </section>
    </div>
  );
}
