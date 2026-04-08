import { NewArrivalCard } from "@/components/home/NewArrivalCard";

interface NewArrivalsSectionProps {
  newArrivals: any[];
  isNewArrivalsSuccess: boolean;
  config?: Record<string, any>;
}

export default function NewArrivalsSection({
  newArrivals,
  isNewArrivalsSuccess,
  config,
}: NewArrivalsSectionProps) {
  void isNewArrivalsSuccess;
  void config;

  return (
    <section className="py-7 sm:py-10 lg:py-12">
      <div className="w-full px-2 sm:px-3 lg:px-4 xl:px-6">
        <h2 className="mb-1.5 text-left text-[10px] font-bold uppercase tracking-[0.34em] text-zinc-500 dark:text-zinc-400 sm:mb-2">
          Latest Drops
        </h2>
        <h3 className="mb-2 text-left text-3xl font-black uppercase tracking-[-0.02em] text-zinc-900 dark:text-zinc-100 sm:text-4xl md:mb-3 md:text-5xl">
          New Arrivals
        </h3>
        <p className="mb-6 max-w-2xl text-left text-[10px] font-semibold uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-400 sm:text-[11px] md:mb-8 lg:mb-9">
          Curated originals from Rare Atelier, crafted to elevate everyday wear.
        </p>
        <div className="grid grid-cols-2 items-start content-start justify-items-start gap-x-3 gap-y-4 sm:grid-cols-2 sm:gap-x-4 sm:gap-y-6 md:grid-cols-3 md:gap-x-5 md:gap-y-7 lg:grid-cols-4 lg:gap-x-6 lg:gap-y-8">
          {newArrivals.map((product) => (
            <div key={product.id} className="w-full">
              <NewArrivalCard product={product} imageAspectClass="aspect-[3/4]" />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
