import { motion } from "framer-motion";
import { useThemeStore } from "@/store/theme";

interface QuoteSectionProps {
  config?: Record<string, any>;
}

export default function QuoteSection({ config }: QuoteSectionProps) {
  if (config?.variant === "nikeshdesign-statement") {
    const theme = useThemeStore((state) => state.theme);
    const isDarkTheme = theme === "dark";
    const quoteText =
      typeof config?.text === "string" && config.text.trim().length > 0
        ? config.text
        : "Craft without compromise. Style without explanation.";
    const attribution =
      typeof config?.attribution === "string" && config.attribution.trim().length > 0
        ? config.attribution
        : "Rare Atelier — Authenticity in Motion";

    return (
      <section
        className="statement relative overflow-hidden px-6 py-28 sm:px-8 lg:px-10"
        style={{
          background: "var(--bg)",
          borderTop: "1px solid var(--border)",
          borderBottom: "1px solid var(--border)",
        }}
      >
        <div
          className="pointer-events-none absolute inset-0 flex items-center justify-center"
          style={{
            fontFamily: "var(--font-display)",
            fontSize: "clamp(120px, 18vw, 220px)",
            color: isDarkTheme ? "rgba(232,228,219,0.025)" : "rgba(24,20,17,0.05)",
          }}
        >
          RARE
        </div>
        <div className="relative mx-auto max-w-4xl text-center">
          <motion.h2
            initial={{ opacity: 0, y: 36 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.3 }}
            transition={{ duration: 0.85, ease: [0.4, 0, 0.2, 1] }}
            className="mx-auto max-w-[700px] text-balance italic"
            style={{
              fontFamily: "var(--font-display)",
              fontSize: "clamp(22px, 4vw, 42px)",
              lineHeight: 1.4,
              color: isDarkTheme ? "var(--fg)" : "#181411",
            }}
          >
            {quoteText}
          </motion.h2>
          <p
            className="mt-8 text-[9px] uppercase tracking-[0.28em]"
            style={{
              fontFamily: "var(--font-mono)",
              color: "var(--gold)",
            }}
          >
            {attribution}
          </p>
        </div>
      </section>
    );
  }

  if (config?.variant === "maison-nocturne-statement") {
    const theme = useThemeStore((state) => state.theme);
    const isDarkTheme = theme === "dark";
    const quoteText =
      typeof config?.text === "string" && config.text.trim().length > 0
        ? config.text
        : "Craft without compromise. Style without explanation.";
    const attribution =
      typeof config?.attribution === "string" && config.attribution.trim().length > 0
        ? config.attribution
        : "Rare Atelier — Authenticity in Motion";

    return (
      <section
        className="relative overflow-hidden bg-background px-6 py-28 sm:px-8 lg:px-10 dark:bg-neutral-950"
        style={{
          borderTop: "1px solid var(--border)",
          borderBottom: "1px solid var(--border)",
        }}
      >
        <div
          className="pointer-events-none absolute inset-0 flex items-center justify-center"
          style={{
            fontFamily: "var(--font-display)",
            fontSize: "clamp(120px, 18vw, 220px)",
            color: isDarkTheme ? "rgba(232,228,219,0.025)" : "rgba(24,20,17,0.05)",
          }}
        >
          <img
            src="/images/newproductpagelogo.png"
            alt=""
            className="h-24 w-auto opacity-[0.08] saturate-0 dark:opacity-[0.12] dark:brightness-0 dark:invert sm:h-32 md:h-40 lg:h-48"
            aria-hidden
          />
        </div>
        <div className="relative mx-auto max-w-4xl text-center">
          <motion.h2
            initial={{ opacity: 0, y: 36 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.3 }}
            transition={{ duration: 0.85, ease: [0.4, 0, 0.2, 1] }}
            className="mx-auto max-w-[700px] text-balance italic"
            style={{
              fontFamily: "var(--font-display)",
              fontSize: "clamp(22px, 4vw, 42px)",
              lineHeight: 1.4,
              color: isDarkTheme ? "var(--fg)" : "#181411",
            }}
          >
            {quoteText}
          </motion.h2>
          <p
            className="mt-8 text-[9px] uppercase tracking-[0.28em]"
            style={{
              fontFamily: "var(--font-mono)",
              color: "var(--gold)",
            }}
          >
            {attribution}
          </p>
        </div>
      </section>
    );
  }

  const quoteText =
    typeof config?.text === "string" && config.text.trim().length > 0
      ? config.text
      : "The best way to predict the future is to create it.";

  return (
    <section
      className="py-16 md:py-24 relative overflow-hidden transition-colors duration-500
        bg-gradient-to-br from-[#faf8f5] via-[#f5f2eb] to-[#f0ebe3]
        dark:bg-neutral-950"
    >
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div
          className="quote-glow-orb absolute top-[-10%] left-[10%] w-[480px] h-[480px] rounded-full dark:hidden"
          style={{ background: "rgba(220, 170, 80, 0.55)" }}
          aria-hidden
        />
        <div
          className="quote-glow-orb-alt absolute bottom-[-10%] right-[10%] w-[420px] h-[420px] rounded-full dark:hidden"
          style={{ background: "rgba(185, 125, 150, 0.5)" }}
          aria-hidden
        />
        <div
          className="quote-glow-orb absolute top-[-10%] left-[10%] w-[480px] h-[480px] rounded-full hidden dark:block"
          style={{ background: "rgba(120, 180, 255, 0.45)" }}
          aria-hidden
        />
        <div
          className="quote-glow-orb-alt absolute bottom-[-10%] right-[10%] w-[420px] h-[420px] rounded-full hidden dark:block"
          style={{ background: "rgba(160, 120, 220, 0.4)" }}
          aria-hidden
        />
      </div>

      <div className="relative max-w-5xl mx-auto px-6 z-10">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 1, ease: [0.22, 1, 0.36, 1] }}
          className="relative p-8 md:p-16 rounded-[2rem] overflow-hidden
              border border-amber-300/50 dark:border-white/20
              bg-white/70 dark:bg-neutral-900/80
              backdrop-blur-2xl
              shadow-[0_8px_40px_0_rgba(120,90,60,0.12)] dark:shadow-[0_8px_40px_0_rgba(0,0,0,0.5)]"
        >
          <div className="absolute inset-0 bg-gradient-to-br from-amber-200/15 via-transparent to-amber-100/10 dark:from-white/10 dark:via-transparent dark:to-white/5 pointer-events-none" />

          <div className="relative flex flex-col items-center text-center">
            <div className="h-px w-10 bg-amber-600/60 dark:bg-white/50 mb-8" />

            <h2 className="text-2xl md:text-5xl lg:text-5xl font-serif italic leading-tight tracking-tight max-w-3xl text-neutral-900 dark:text-white mb-10">
              {quoteText.split(" ").map((word, i) => (
                <motion.span
                  key={i}
                  initial={{ opacity: 0, y: 15 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{
                    duration: 0.6,
                    delay: i * 0.08,
                    ease: [0.22, 1, 0.36, 1],
                  }}
                  className="inline-block mr-[0.3em] last:mr-0"
                >
                  {word}
                </motion.span>
              ))}
            </h2>

            <motion.div
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 1, delay: 1 }}
              className="flex items-center gap-4"
            >
              <div className="h-px w-6 bg-amber-600/50 dark:bg-white/40" />
              <span className="text-[10px] md:text-xs tracking-[0.4em] uppercase font-black text-neutral-700 dark:text-white/90">
                Alan Kay
              </span>
              <div className="h-px w-6 bg-amber-600/50 dark:bg-white/40" />
            </motion.div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
