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
    <section className="py-24 container mx-auto px-6 max-w-7xl">
      <h2 className="text-[11px] font-bold uppercase tracking-[0.34em] text-center text-zinc-500 dark:text-zinc-400 mb-3">
        Latest Drops
      </h2>
      <h3 className="text-4xl md:text-5xl font-black uppercase tracking-[-0.02em] text-center text-zinc-900 dark:text-zinc-100 mb-4">
        New Arrivals
      </h3>
      <p className="mx-auto mb-14 max-w-2xl text-center text-[11px] font-semibold uppercase tracking-[0.2em] text-zinc-500 dark:text-zinc-400">
        Curated originals from Rare Atelier, crafted to elevate everyday wear.
      </p>
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-x-6 gap-y-10">
        {newArrivals.map((product) => (
          <div key={product.id}>
            <NewArrivalCard product={product} imageAspectClass="aspect-[4/5]" />
          </div>
        ))}
      </div>
    </section>
  );
}
