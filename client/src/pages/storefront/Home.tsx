import { Link } from "wouter";
import { Button } from "@/components/ui/button";

export default function Home() {
  return (
    <div className="flex flex-col min-h-screen">
      {/* Hero Section */}
      <section className="relative h-[85vh] flex items-center justify-center overflow-hidden">
        <div className="absolute inset-0 z-0 bg-muted">
          <div className="absolute inset-0 bg-gradient-to-r from-background/90 via-background/50 to-background/10 mix-blend-multiply" />
        </div>
        
        <div className="container relative z-10 mx-auto px-4 flex flex-col items-start text-left max-w-6xl">
          <span className="text-sm font-medium tracking-widest uppercase mb-4 text-muted-foreground animate-in slide-in-from-bottom-4 duration-700 fade-in">
            New Arrival
          </span>
          <h1 className="text-5xl md:text-7xl lg:text-8xl font-serif font-medium tracking-tight mb-6 animate-in slide-in-from-bottom-8 duration-700 delay-100 fade-in fill-mode-both max-w-3xl">
            Elevate Your <br /> Everyday
          </h1>
          <p className="text-lg md:text-xl text-muted-foreground max-w-md mb-10 animate-in slide-in-from-bottom-10 duration-700 delay-200 fade-in fill-mode-both leading-relaxed">
            Discover our new collection of minimalist essentials designed for the modern wardrobe.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 animate-in slide-in-from-bottom-12 duration-700 delay-300 fade-in fill-mode-both">
            <Button size="lg" className="rounded-full px-8 text-base h-12" asChild data-testid="button-shop-collection">
              <Link href="/products">Shop Collection</Link>
            </Button>
            <Button size="lg" variant="outline" className="rounded-full px-8 text-base h-12" asChild data-testid="button-view-lookbook">
              <Link href="/lookbook">View Lookbook</Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Categories */}
      <section className="py-24 container mx-auto px-4 max-w-6xl">
        <div className="flex justify-between items-end mb-12">
          <h2 className="text-3xl font-serif font-medium tracking-tight">Curated Categories</h2>
          <Link href="/products" className="text-sm font-medium hover:text-primary/80 transition-colors" data-testid="link-view-all-categories">View All &rarr;</Link>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {['Tops', 'Bottoms', 'Accessories'].map((category) => (
            <Link key={category} href={`/products?category=${category.toLowerCase()}`} className="group relative aspect-[3/4] overflow-hidden bg-muted flex items-end p-8 rounded-lg" data-testid={`link-category-${category.toLowerCase()}`}>
              <div className="absolute inset-0 bg-black/10 group-hover:bg-black/20 transition-colors duration-500 z-10" />
              <h3 className="relative z-20 text-2xl font-serif font-medium text-white translate-y-4 group-hover:translate-y-0 opacity-80 group-hover:opacity-100 transition-all duration-500">
                {category}
              </h3>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}