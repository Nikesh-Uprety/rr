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
    <section className="py-12 sm:py-20">
      <div className="w-full px-2 sm:px-3 lg:px-4 xl:px-6">
        <h2 className="mb-3 text-center text-[11px] font-bold uppercase tracking-[0.34em] text-zinc-500 dark:text-zinc-400">
          Latest Drops
        </h2>
        <h3 className="mb-4 text-center text-4xl font-black uppercase tracking-[-0.02em] text-zinc-900 dark:text-zinc-100 md:text-5xl">
          New Arrivals
        </h3>
        <p className="mx-auto mb-8 max-w-2xl text-center text-[11px] font-semibold uppercase tracking-[0.2em] text-zinc-500 dark:text-zinc-400 md:mb-14">
          Curated originals from Rare Atelier, crafted to elevate everyday wear.
        </p>
        <div className="grid grid-cols-2 gap-x-3 gap-y-5 sm:grid-cols-2 sm:gap-x-6 sm:gap-y-10 lg:grid-cols-3 2xl:grid-cols-4">
          {newArrivals.map((product) => (
            <div key={product.id}>
              <NewArrivalCard product={product} imageAspectClass="aspect-[3/4]" />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
