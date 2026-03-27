import { useMemo, useState } from "react";
import { Link, useLocation } from "wouter";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

export default function Footer() {
  const { toast } = useToast();
  const [newsletterEmail, setNewsletterEmail] = useState("");
  const [location] = useLocation();
  const previewTemplateId = useMemo(() => {
    if (typeof window === "undefined") return null;
    const rawValue = new URLSearchParams(window.location.search).get("canvasPreviewTemplateId");
    return rawValue && /^\d+$/.test(rawValue) ? rawValue : null;
  }, []);
  const { data: pageConfig } = useQuery({
    queryKey: ["page-config", previewTemplateId],
    queryFn: () => {
      const params = new URLSearchParams();
      if (previewTemplateId) {
        params.set("templateId", previewTemplateId);
      }
      const url = params.toString()
        ? `/api/public/page-config?${params.toString()}`
        : "/api/public/page-config";
      return fetch(url).then((r) => r.json());
    },
    staleTime: 30 * 1000,
  });

  const newsletterMutation = useMutation({
    mutationFn: async (email: string) => {
      const res = await apiRequest("POST", "/api/newsletter/subscribe", { email });
      return res.json();
    },
    onSuccess: () => {
      toast({
        title: "Subscribed!",
        description: "You've successfully joined our newsletter.",
      });
      setNewsletterEmail("");
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to subscribe. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleNewsletterSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newsletterEmail) return;
    newsletterMutation.mutate(newsletterEmail);
  };

  const isHomePage = location === "/";
  const isMaisonNocturne = pageConfig?.template?.slug === "maison-nocturne";
  const isNikeshDesign = pageConfig?.template?.slug === "nikeshdesign";
  const TIKTOK_URL = "#";

  if (isNikeshDesign) {
    return (
      <footer className="px-6 py-16 sm:px-8 lg:px-10" style={{ background: "var(--bg)", color: "var(--fg)" }}>
        <div className="footer-inner mx-auto grid max-w-[1440px] gap-10 border-t pt-14 md:grid-cols-[1.3fr_1fr_1fr]" style={{ borderColor: "var(--border)" }}>
          <div className="footer-logo-block">
            <Link href="/" className="inline-block">
              <span
                className="f-logo block text-2xl uppercase"
                style={{ fontFamily: "var(--font-display)", letterSpacing: "0.24em" }}
              >
                Rare Atelier
              </span>
              <span
                className="f-sub mt-2 block text-[9px] uppercase"
                style={{ fontFamily: "var(--font-mono)", letterSpacing: "0.26em", color: "var(--gold)" }}
              >
                Kathmandu · Est. 2022
              </span>
            </Link>
          </div>

          <div className="footer-col">
            <h4 className="mb-5 text-[10px] uppercase" style={{ fontFamily: "var(--font-mono)", letterSpacing: "0.22em", color: "var(--gold)" }}>
              Shop
            </h4>
            <ul className="space-y-3 text-sm" style={{ fontFamily: "var(--font-body)", color: "var(--fg-dim)" }}>
              <li><Link href="/products" className="hover:text-[var(--fg)]">New Arrivals</Link></li>
              <li><Link href="/products" className="hover:text-[var(--fg)]">Men</Link></li>
              <li><Link href="/products" className="hover:text-[var(--fg)]">Women</Link></li>
              <li><Link href="/products?category=footwear" className="hover:text-[var(--fg)]">Footwear</Link></li>
              <li><Link href="/products" className="hover:text-[var(--fg)]">Accessories</Link></li>
            </ul>
          </div>

          <div className="footer-col">
            <h4 className="mb-5 text-[10px] uppercase" style={{ fontFamily: "var(--font-mono)", letterSpacing: "0.22em", color: "var(--gold)" }}>
              Atelier
            </h4>
            <ul className="space-y-3 text-sm" style={{ fontFamily: "var(--font-body)", color: "var(--fg-dim)" }}>
              <li><Link href="/atelier" className="hover:text-[var(--fg)]">About</Link></li>
              <li><Link href="/new-collection" className="hover:text-[var(--fg)]">Lookbook</Link></li>
              <li><Link href="/shipping" className="hover:text-[var(--fg)]">Stockists</Link></li>
              <li><Link href="/refund" className="hover:text-[var(--fg)]">Care Guide</Link></li>
              <li><Link href="/contact" className="hover:text-[var(--fg)]">Contact</Link></li>
            </ul>
          </div>
        </div>
        <div className="footer-bottom footer-inner mx-auto mt-10 flex max-w-[1440px] flex-col gap-4 border-t pt-6 text-[10px] uppercase sm:flex-row sm:items-center sm:justify-between" style={{ borderColor: "var(--border)", fontFamily: "var(--font-mono)", letterSpacing: "0.2em", color: "var(--fg-dim)" }}>
          <p className="footer-copy">© 2026 Rare Atelier. All rights reserved.</p>
          <div className="footer-socials flex gap-5">
            <a href="https://www.instagram.com/rare.np/" target="_blank" rel="noopener noreferrer" className="hover:text-[var(--fg)]">Instagram</a>
            <a href={TIKTOK_URL} target="_blank" rel="noopener noreferrer" className="hover:text-[var(--fg)]">TikTok</a>
            <a href="https://www.facebook.com/rarenp" target="_blank" rel="noopener noreferrer" className="hover:text-[var(--fg)]">Facebook</a>
          </div>
        </div>
      </footer>
    );
  }

  if (isMaisonNocturne) {
    return (
      <footer className="bg-[#0A0A0A] text-white pt-32 pb-12">
        <div className="container mx-auto px-6 max-w-7xl">
          <div className="grid grid-cols-1 gap-16 mb-20 md:grid-cols-4">
            <div className="col-span-1">
              <Link href="/" className="inline-block">
                <img
                  src="/images/logo.webp"
                  alt="Rare Atelier"
                  className="h-12 w-auto mb-8 object-contain brightness-0 invert"
                />
              </Link>
              <p className="text-gray-500 text-sm leading-relaxed tracking-wide">
                Khusibu, Nayabazar, Kathmandu
                <br />
                (+977)-9705208960
                <br />
                rarenepal999@gmail.com
              </p>
            </div>

            <div>
              <h4 className="mb-8 text-[10px] font-bold uppercase tracking-[0.2em] text-gray-400">Legals</h4>
              <ul className="space-y-4 text-xs tracking-widest">
                <li><Link href="/shipping" className="transition-colors hover:text-gray-400">Shipping Policy</Link></li>
                <li><Link href="/refund" className="transition-colors hover:text-gray-400">Refund Policy</Link></li>
                <li><Link href="/privacy" className="transition-colors hover:text-gray-400">Privacy Policy</Link></li>
                <li><Link href="/terms" className="transition-colors hover:text-gray-400">Terms of service</Link></li>
              </ul>
            </div>

            <div>
              <h4 className="mb-8 text-[10px] font-bold uppercase tracking-[0.2em] text-gray-400">Social</h4>
              <ul className="space-y-4 text-xs tracking-widest">
                <li><a href="https://www.instagram.com/rare.np/" target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 transition-colors hover:text-gray-400">Instagram</a></li>
                <li><a href={TIKTOK_URL} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 transition-colors hover:text-gray-400">TikTok</a></li>
                <li><a href="https://www.facebook.com/rarenp" target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 transition-colors hover:text-gray-400">Facebook</a></li>
              </ul>
            </div>

            <div>
              <h4 className="mb-8 text-[10px] font-bold uppercase tracking-[0.2em] text-gray-400">Newsletter</h4>
              <p className="mb-6 text-xs leading-relaxed tracking-wide text-gray-500">
                Sign up for early access to drops and exclusive stories.
              </p>
              <form onSubmit={handleNewsletterSubmit} className="group flex border-b border-gray-800 pb-2 transition-colors focus-within:border-white">
                <input
                  type="email"
                  required
                  value={newsletterEmail}
                  onChange={(e) => setNewsletterEmail(e.target.value)}
                  className="flex-1 bg-transparent py-2 text-sm placeholder:text-gray-700 focus:outline-none"
                  placeholder="Email Address"
                />
                <button
                  disabled={newsletterMutation.isPending}
                  className="ml-4 text-[10px] font-bold uppercase tracking-widest transition-opacity hover:opacity-60 disabled:opacity-50"
                >
                  {newsletterMutation.isPending ? "..." : "Join"}
                </button>
              </form>
            </div>
          </div>
        </div>
        <div className="container mx-auto max-w-7xl px-6">
          <div className="flex flex-col gap-4 border-t border-gray-900 pt-6 text-[10px] uppercase tracking-[0.2em] text-gray-500 sm:flex-row sm:items-center sm:justify-between">
            <span>© 2026 Rare Atelier. All rights reserved.</span>
            <div className="flex flex-wrap gap-5">
              <span>Built by 0xnikuhacks</span>
              <a href="https://www.instagram.com/rare.np/" target="_blank" rel="noopener noreferrer" className="transition-colors hover:text-gray-400">Instagram</a>
              <a href={TIKTOK_URL} target="_blank" rel="noopener noreferrer" className="transition-colors hover:text-gray-400">TikTok</a>
              <a href="https://www.facebook.com/rarenp" target="_blank" rel="noopener noreferrer" className="transition-colors hover:text-gray-400">Facebook</a>
            </div>
          </div>
        </div>
      </footer>
    );
  }

  return (
    <>
      {isHomePage && (
        <footer className="bg-[#0A0A0A] text-white pt-32 pb-12">
          <div className="container mx-auto px-6 max-w-7xl">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-16 mb-20">
              <div className="col-span-1">
                <img
                  src="https://cdn2.blanxer.com/brand_logo/67cd36dcf133882caba612b4/67d00c07ef86879da12106aa.webp"
                  alt="RARE"
                  className="h-12 w-auto mb-8 object-contain brightness-0 invert"
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
                <h4 className="font-bold mb-8 uppercase tracking-[0.2em] text-[10px] text-gray-400">Legals</h4>
                <ul className="space-y-4 text-xs tracking-widest">
                  <li><Link href="/shipping" className="hover:text-gray-400 transition-colors">Shipping Policy</Link></li>
                  <li><Link href="/refund" className="hover:text-gray-400 transition-colors">Refund Policy</Link></li>
                  <li><Link href="/privacy" className="hover:text-gray-400 transition-colors">Privacy Policy</Link></li>
                  <li><Link href="/terms" className="hover:text-gray-400 transition-colors">Terms of service</Link></li>
                </ul>
              </div>
              <div>
                <h4 className="font-bold mb-8 uppercase tracking-[0.2em] text-[10px] text-gray-400">Social</h4>
                <ul className="space-y-4 text-xs tracking-widest">
                  <li><a href="https://www.instagram.com/rare.np/" target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 hover:text-gray-400 transition-colors">Instagram</a></li>
                  <li><a href={TIKTOK_URL} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 hover:text-gray-400 transition-colors">TikTok</a></li>
                  <li><a href="https://www.facebook.com/rarenp" target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 hover:text-gray-400 transition-colors">Facebook</a></li>
                </ul>
              </div>
              <div>
                <h4 className="font-bold mb-8 uppercase tracking-[0.2em] text-[10px] text-gray-400">Newsletter</h4>
                <p className="text-xs text-gray-500 mb-6 tracking-wide leading-relaxed">
                  Sign up for early access to drops and exclusive stories.
                </p>
                <form onSubmit={handleNewsletterSubmit} className="flex group border-b border-gray-800 focus-within:border-white transition-colors pb-2">
                  <input
                    type="email"
                    required
                    value={newsletterEmail}
                    onChange={(e) => setNewsletterEmail(e.target.value)}
                    className="bg-transparent py-2 flex-1 focus:outline-none text-sm placeholder:text-gray-700"
                    placeholder="Email Address"
                  />
                  <button
                    disabled={newsletterMutation.isPending}
                    className="text-[10px] font-bold uppercase tracking-widest ml-4 hover:opacity-60 transition-opacity disabled:opacity-50"
                  >
                    {newsletterMutation.isPending ? "..." : "Join"}
                  </button>
                </form>
              </div>
            </div>
          </div>
        </footer>
      )}
      <footer className="py-12 border-t bg-white">
        <div className="container mx-auto px-4 text-center text-gray-500 text-sm">
          &copy; 2025 Rare Atelier. All rights reserved.
        </div>
      </footer>
    </>
  );
}
