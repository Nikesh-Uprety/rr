import { Helmet } from "react-helmet-async";
import { Link, useLocation } from "wouter";
import { ArrowRight } from "lucide-react";
import { useThemeStore } from "@/store/theme";
import ContactInfo from "@/components/home/ContactSection";

const PAGE_HERO_IMAGE = "/images/about.webp";

const FAQ_ITEMS = [
  {
    question: "How long does delivery take?",
    answer: "Most orders across Nepal arrive within 2 to 5 business days depending on your location and stock availability.",
  },
  {
    question: "Can I exchange a size after ordering?",
    answer: "Yes. If the requested size is available, our team can help arrange an exchange after delivery confirmation.",
  },
  {
    question: "Are your products made in Nepal?",
    answer: "Yes. Rare Atelier pieces are produced in Nepal in limited runs with a focus on quality and strong finishing.",
  },
  {
    question: "How can I contact support quickly?",
    answer: "Use the contact section below to message the team directly for order updates, exchanges, fit help, or delivery support.",
  },
];

export default function LegalPlaceholder() {
  const [location] = useLocation();
  const { theme } = useThemeStore();
  const isDark = theme === "dark";
  const isFaqPage = location === "/shipping";
  const isCustomerCarePage = location === "/refund";
  const isPrivacyPage = location === "/privacy";
  const isTermsPage = location === "/terms";

  const pageTitle = isFaqPage
    ? "FAQ"
    : isCustomerCarePage
      ? "Customer Care"
      : isPrivacyPage
        ? "Privacy"
        : "Terms";

  const pageDescription = isFaqPage
    ? "Common delivery, exchange, sizing, and support questions in one simple place."
    : isCustomerCarePage
      ? "Direct support for orders, exchanges, delivery questions, and fit guidance."
      : isPrivacyPage
        ? "We are preparing the final privacy details for this section."
        : "We are preparing the final terms details for this section.";

  return (
    <div className={`min-h-screen ${isDark ? "bg-[#050505] text-white" : "bg-white text-neutral-950"}`}>
      <Helmet>
        <title>{pageTitle} | Rare Atelier</title>
      </Helmet>

      <section className="relative min-h-[72svh] overflow-hidden">
        <img
          src={PAGE_HERO_IMAGE}
          alt={pageTitle}
          className="absolute inset-0 h-full w-full object-cover object-center"
        />
        <div
          className="absolute inset-0"
          style={{
            background: isDark
              ? "linear-gradient(180deg, rgba(0,0,0,0.46) 0%, rgba(0,0,0,0.66) 100%)"
              : "linear-gradient(180deg, rgba(15,15,15,0.22) 0%, rgba(15,15,15,0.52) 100%)",
          }}
        />

        <div className="relative z-10 flex min-h-[72svh] items-end px-4 pb-16 pt-32 sm:px-6 lg:px-10 lg:pb-20">
          <div className="max-w-[760px]">
            <p className="mb-5 text-[10px] font-semibold uppercase tracking-[0.34em] text-white/78">
              Rare Atelier
            </p>
            <h1 className="text-5xl font-black uppercase leading-none tracking-tight text-white sm:text-6xl lg:text-8xl">
              {pageTitle}
            </h1>
            <p className="mt-5 max-w-2xl text-sm leading-7 text-white/88 sm:text-base">
              {pageDescription}
            </p>
            {isFaqPage || isCustomerCarePage ? (
              <div className="mt-8 flex flex-wrap gap-3">
                <Link
                  href={isFaqPage ? "#faq-list" : "#contact"}
                  className="inline-flex items-center gap-2 rounded-full bg-white px-6 py-3 text-[11px] font-bold uppercase tracking-[0.22em] text-black transition-transform hover:-translate-y-0.5"
                  onClick={(event) => {
                    event.preventDefault();
                    document.getElementById(isFaqPage ? "faq-list" : "contact")?.scrollIntoView({
                      behavior: "smooth",
                      block: "start",
                    });
                  }}
                >
                  {isFaqPage ? "Read FAQs" : "Get In Touch"}
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
            ) : null}
          </div>
        </div>
      </section>

      {isFaqPage ? (
        <section
          id="faq-list"
          className={`px-4 py-16 sm:px-6 lg:px-10 lg:py-20 ${isDark ? "bg-[#050505]" : "bg-white"}`}
        >
          <div className="mx-auto max-w-5xl">
            <div className="mb-10 max-w-2xl">
              <p className={`mb-4 text-[10px] font-semibold uppercase tracking-[0.34em] ${isDark ? "text-white/55" : "text-neutral-500"}`}>
                Help
              </p>
              <h2 className={`text-3xl font-black uppercase tracking-tight sm:text-5xl ${isDark ? "text-white" : "text-neutral-950"}`}>
                Frequently Asked Questions
              </h2>
            </div>
            <div className="space-y-4">
              {FAQ_ITEMS.map((item) => (
                <details
                  key={item.question}
                  className={`rounded-2xl border px-5 py-4 ${isDark ? "border-white/10 bg-white/5" : "border-black/10 bg-black/[0.02]"}`}
                >
                  <summary className={`cursor-pointer list-none text-base font-bold uppercase tracking-[0.08em] ${isDark ? "text-white" : "text-black"}`}>
                    {item.question}
                  </summary>
                  <p className={`pt-4 text-sm leading-7 ${isDark ? "text-white/74" : "text-neutral-600"}`}>
                    {item.answer}
                  </p>
                </details>
              ))}
            </div>
          </div>
        </section>
      ) : null}

      {isCustomerCarePage ? (
        <section
          id="contact"
          className={`px-4 py-16 sm:px-6 lg:px-10 lg:py-20 ${isDark ? "bg-[#050505]" : "bg-white"}`}
        >
          <div className="mx-auto max-w-6xl">
            <ContactInfo showMap />
          </div>
        </section>
      ) : null}

      {isPrivacyPage || isTermsPage ? (
        <section
          className={`px-4 py-16 text-center sm:px-6 lg:px-10 lg:py-20 ${isDark ? "bg-[#050505]" : "bg-white"}`}
        >
          <div className="mx-auto max-w-3xl">
            <p className={`text-sm leading-7 ${isDark ? "text-white/75" : "text-neutral-600"}`}>
              This page is being prepared and will be updated soon with the final details.
            </p>
          </div>
        </section>
      ) : null}
    </div>
  );
}
