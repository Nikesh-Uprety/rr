import { ArrowUp } from "lucide-react";

interface BackToTopSectionProps {
  imageUrl: string;
  imageAlt?: string;
}

export default function BackToTopSection({
  imageUrl,
  imageAlt = "Rare Atelier editorial",
}: BackToTopSectionProps) {
  return (
    <section className="relative overflow-hidden" data-testid="home-back-to-top-section">
      <div className="relative h-[320px] w-full md:h-[420px] lg:h-[520px]">
        <img
          src={imageUrl}
          alt={imageAlt}
          className="h-full w-full object-cover object-center lg:object-[center_32%]"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-black/10 via-black/30 to-black/55" />
      </div>

      <div className="absolute inset-x-0 bottom-8 z-10 flex justify-center px-4 md:bottom-10">
        <button
          type="button"
          onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
          className="group inline-flex items-center gap-3 rounded-full border border-white/20 bg-black/80 px-7 py-3 text-white shadow-xl backdrop-blur-sm transition-all duration-300 hover:-translate-y-0.5 hover:bg-black/90"
          aria-label="Back to top"
        >
          <ArrowUp className="h-4 w-4 transition-transform duration-300 group-hover:-translate-y-1" />
          <span className="text-[11px] font-semibold uppercase tracking-[0.24em]">Back to Top</span>
        </button>
      </div>
    </section>
  );
}
