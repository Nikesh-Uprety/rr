import { Button } from "@/components/ui/button";
import { formatPrice } from "@/lib/format";
import { MOCK_PRODUCTS } from "@/lib/mockData";
import { Link } from "wouter";
import { ExternalLink } from "lucide-react";

export default function Home() {
  const featuredProducts = MOCK_PRODUCTS.slice(0, 2);
  const newArrivals = MOCK_PRODUCTS.slice(2, 6);

  return (
    <div className="flex flex-col min-h-screen pt-20">
      {/* Hero Section */}
      <section className="relative h-[90vh] w-full overflow-hidden">
        <img
          alt="Luxury street style campaign"
          className="w-full h-full object-cover"
          src="https://i.ibb.co/67cBG904/landing-page.png"
          // src="https://i.ibb.co/DDcQv54D/landingpage1.png"
        />
        <div className="absolute inset-0 bg-black/10 dark:bg-black/30" />
        <div className="absolute inset-0 flex items-center justify-start container mx-auto px-6 sm:px-12">
          <div className="animate-in fade-in slide-in-from-left-8 duration-1000 max-w-4xl text-white">
            <h1 className="font-serif text-6xl md:text-8xl lg:text-9xl font-bold leading-none tracking-tighter mb-8">
              Beyond Trends.
              <br />
              Beyond Time.
            </h1>
            <p className="text-lg md:text-xl tracking-[0.4em] uppercase opacity-90 font-light mb-12">
              Authenticity In Motion
            </p>
            <Button
              size="lg"
              asChild
              className="rounded-none bg-white text-black hover:bg-white/90 px-12 h-16 text-sm uppercase tracking-widest font-bold"
            >
              <Link href="/products">Explore Shop</Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Quote Section */}
      <section className="py-32 md:py-48 bg-background">
        <div className="max-w-4xl mx-auto px-6 text-center">
          <p className="text-3xl md:text-5xl italic font-serif text-foreground/90 leading-tight">
            "Products are made in a factory but brands are created in the mind."
          </p>
          <p className="mt-12 text-xs tracking-[0.3em] uppercase text-muted-foreground font-bold">
            — Walter Landor
          </p>
        </div>
      </section>

      {/* Featured Collection */}
      <section className="py-24 container mx-auto px-6 max-w-7xl">
        <div className="flex justify-between items-end mb-16">
          <div>
            <h2 className="text-sm font-bold uppercase tracking-[0.3em] text-muted-foreground mb-2">
              Editor's Choice
            </h2>
            <h3 className="text-4xl font-black uppercase tracking-tighter">
              Featured Collection
            </h3>
          </div>
          <Link
            href="/products"
            className="text-xs font-bold uppercase tracking-widest border-b border-black pb-1 hover:opacity-60 transition-opacity"
          >
            View All
          </Link>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-16">
          {featuredProducts.map((product) => (
            <Link
              key={product.id}
              href={`/product/${product.id}`}
              className="group cursor-pointer"
            >
              <div className="relative overflow-hidden bg-gray-50 dark:bg-muted/30 aspect-[4/5]">
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    window.open(`/product/${product.id}`, "_blank");
                  }}
                  className="absolute top-3 right-3 z-10 flex h-7 w-7 items-center justify-center rounded-full bg-white text-neutral-900 shadow-sm opacity-0 group-hover:opacity-100 transition-opacity"
                  aria-label="Open product in new tab"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                </button>
                <img
                  src={product.images[0]}
                  alt={product.name}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-1000"
                />
              </div>
              <div className="mt-8">
                <h3 className="text-xl font-bold uppercase tracking-tighter mb-1">
                  {product.name}
                </h3>
                <p className="font-medium text-lg text-muted-foreground">
                  {formatPrice(product.price)}
                </p>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* Campaign Banner */}
      <section className="relative h-[80vh] w-full overflow-hidden my-24">
        <img
          alt="Campaign story"
          className="w-full h-full object-cover"
          src="https://i.ibb.co/DPgdPLtS/Chat-GPT-Image-Mar-6-2026-08-28-46-PM.png?auto=format&fit=crop&q=80&w=2000"
        />
        <div className="absolute inset-0 bg-black/40" />
        <div className="absolute inset-0 flex items-center justify-center text-center text-white p-4">
          <div className="max-w-2xl animate-in zoom-in duration-1000">
            <h2 className="font-serif text-5xl md:text-7xl font-bold mb-6 tracking-tight">
              Explore the journey behind
            </h2>
            <p className="text-xl opacity-90 font-light tracking-wide">
              our Winter '25 collection.
            </p>
            <Button
              variant="outline"
              className="mt-12 rounded-none px-12 h-14 border-white text-white hover:bg-white hover:text-black transition-all uppercase text-xs tracking-widest font-bold"
            >
              Read Story
            </Button>
          </div>
        </div>
      </section>

      {/* New Arrivals */}
      <section className="py-24 container mx-auto px-6 max-w-7xl">
        <h2 className="text-sm font-bold uppercase tracking-[0.3em] text-center text-muted-foreground mb-4">
          Latest Drops
        </h2>
        <h3 className="text-4xl font-black uppercase tracking-tighter text-center mb-20">
          New Arrivals
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-x-8 gap-y-16">
          {newArrivals.map((product) => (
            <Link
              key={product.id}
              href={`/product/${product.id}`}
              className="group cursor-pointer"
            >
              <div className="relative overflow-hidden bg-gray-50 dark:bg-muted/30 aspect-[3/4] mb-6">
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    window.open(`/product/${product.id}`, "_blank");
                  }}
                  className="absolute top-3 right-3 z-10 flex h-7 w-7 items-center justify-center rounded-full bg-white text-neutral-900 shadow-sm opacity-0 group-hover:opacity-100 transition-opacity"
                  aria-label="Open product in new tab"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                </button>
                <img
                  src={product.images[0]}
                  alt={product.name}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-1000"
                />
              </div>
              <div>
                <h3 className="text-xs font-bold uppercase tracking-widest truncate mb-1">
                  {product.name}
                </h3>
                <p className="text-muted-foreground text-xs font-medium">
                  {formatPrice(product.price)}
                </p>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* Footer / Newsletter */}
      <footer className="bg-[#0A0A0A] text-white pt-32 pb-12">
        <div className="container mx-auto px-6 max-w-7xl">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-16 mb-32">
            <div className="col-span-1">
              <img
                src="https://cdn2.blanxer.com/brand_logo/67cd36dcf133882caba612b4/67d00c07ef86879da12106aa.webp"
                alt="RARE"
                className="h-12 w-auto mb-8 object-contain"
              />
              <p className="text-gray-500 text-sm leading-relaxed tracking-wide">
                Khusibu, Nayabazar, Kathmandu
                <br />
                (+977)-9705208960
                <br />
                rarenepal999@gmail.com
              </p>
            </div>
            <div>
              <h4 className="font-bold mb-8 uppercase tracking-[0.2em] text-[10px] text-gray-400">
                Legals
              </h4>
              <ul className="space-y-4 text-xs tracking-widest">
                <li>
                  <Link
                    href="/shipping"
                    className="hover:text-gray-400 transition-colors"
                  >
                    Shipping Policy
                  </Link>
                </li>
                <li>
                  <Link
                    href="/refund"
                    className="hover:text-gray-400 transition-colors"
                  >
                    Refund Policy
                  </Link>
                </li>
                <li>
                  <Link
                    href="/privacy"
                    className="hover:text-gray-400 transition-colors"
                  >
                    Privacy Policy
                  </Link>
                </li>
                <li>
                  <Link
                    href="/terms"
                    className="hover:text-gray-400 transition-colors"
                  >
                    Terms of service
                  </Link>
                </li>
              </ul>
            </div>
            <div>
              <h4 className="font-bold mb-8 uppercase tracking-[0.2em] text-[10px] text-gray-400">
                Social
              </h4>
              <ul className="space-y-4 text-xs tracking-widest">
                <li>
                  <a href="#" className="hover:text-gray-400 transition-colors">
                    Facebook
                  </a>
                </li>
                <li>
                  <a href="#" className="hover:text-gray-400 transition-colors">
                    Instagram
                  </a>
                </li>
              </ul>
            </div>
            <div>
              <h4 className="font-bold mb-8 uppercase tracking-[0.2em] text-[10px] text-gray-400">
                Newsletter
              </h4>
              <p className="text-xs text-gray-500 mb-6 tracking-wide leading-relaxed">
                Sign up for early access to drops and exclusive stories.
              </p>
              <form className="flex group border-b border-gray-800 focus-within:border-white transition-colors pb-2">
                <input
                  className="bg-transparent py-2 flex-1 focus:outline-none text-sm placeholder:text-gray-700"
                  placeholder="Email Address"
                />
                <button className="text-[10px] font-bold uppercase tracking-widest ml-4 hover:opacity-60 transition-opacity">
                  Join
                </button>
              </form>
            </div>
          </div>
          <div className="pt-8 border-t border-gray-900 flex flex-col md:flex-row justify-between items-center gap-6 text-[9px] uppercase tracking-[0.3em] text-gray-600 font-bold">
            <p>© 2025 Rare Nepal. Handcrafted Excellence.</p>
            <div className="flex gap-8">
              <span>Visa</span>
              <span>Mastercard</span>
              <span>Esewa</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
