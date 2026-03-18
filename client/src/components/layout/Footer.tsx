import { useState } from "react";
import { Link } from "wouter";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

export default function Footer() {
  const { toast } = useToast();
  const [newsletterEmail, setNewsletterEmail] = useState("");

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

  return (
    <>
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
              <h4 className="font-bold mb-8 uppercase tracking-[0.2em] text-[10px] text-gray-400">
                Legals
              </h4>
              <ul className="space-y-4 text-xs tracking-widest">
                <li><Link href="/shipping" className="hover:text-gray-400 transition-colors">Shipping Policy</Link></li>
                <li><Link href="/refund" className="hover:text-gray-400 transition-colors">Refund Policy</Link></li>
                <li><Link href="/privacy" className="hover:text-gray-400 transition-colors">Privacy Policy</Link></li>
                <li><Link href="/terms" className="hover:text-gray-400 transition-colors">Terms of service</Link></li>
                <li className="pt-4">
                  <a 
                    href="https://www.nikeshuprety.com.np/" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="inline-block text-[10px] uppercase tracking-[0.3em] font-black"
                    style={{
                      background: 'linear-gradient(90deg, rgba(255,255,255,0.3), rgba(255,255,255,0.9), rgba(255,255,255,0.3))',
                      WebkitBackgroundClip: 'text',
                      WebkitTextFillColor: 'transparent',
                      backgroundSize: '200% auto',
                      animation: 'shimmer-footer 3s ease-in-out infinite',
                    }}
                  >
                    designed & dev by : 0xn1ku-hacks
                  </a>
                  <style>{`
                    @keyframes shimmer-footer {
                      0%, 100% { background-position: -200% center; opacity: 0.4; }
                      50% { background-position: 200% center; opacity: 1; }
                    }
                  `}</style>
                </li>
              </ul>
            </div>
            <div>
              <h4 className="font-bold mb-8 uppercase tracking-[0.2em] text-[10px] text-gray-400">
                Social
              </h4>
              <ul className="space-y-4 text-xs tracking-widest">
                <li>
                  <a href="https://www.facebook.com/rarenp" target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 hover:text-gray-400 transition-colors">
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>
                    Facebook
                  </a>
                </li>
                <li>
                  <a href="https://www.instagram.com/rare.np/" target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 hover:text-gray-400 transition-colors">
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M12.315 2c2.43 0 2.784.013 3.808.06 1.064.049 1.791.218 2.427.465a4.902 4.902 0 011.772 1.153 4.902 4.902 0 011.153 1.772c.247.636.416 1.363.465 2.427.048 1.067.06 1.407.06 4.123v.08c0 2.643-.012 2.987-.06 4.043-.049 1.064-.218 1.791-.465 2.427a4.902 4.902 0 01-1.153 1.772 4.902 4.902 0 01-1.772 1.153c-.636.247-1.363.416-2.427.465-1.067.048-1.407.06-4.123.06h-.08c-2.643 0-2.987-.012-4.043-.06-1.064-.049-1.791-.218-2.427-.465a4.902 4.902 0 01-1.772-1.153 4.902 4.902 0 01-1.153-1.772c-.247-.636-.416-1.363-.465-2.427-.047-1.024-.06-1.379-.06-3.808v-.63c0-2.43.013-2.784.06-3.808.049-1.064.218-1.791.465-2.427a4.902 4.902 0 011.153-1.772A4.902 4.902 0 015.45 2.525c.636-.247 1.363-.416 2.427-.465C8.901 2.013 9.256 2 11.685 2h.63zm-.081 1.802h-.468c-2.456 0-2.784.011-3.807.058-.975.045-1.504.207-1.857.344-.467.182-.8.398-1.15.748-.35.35-.566.683-.748 1.15-.137.353-.3.882-.344 1.857-.047 1.023-.058 1.351-.058 3.807v.468c0 2.456.011 2.784.058 3.807.045.975.207 1.504.344 1.857.182.466.399.8.748 1.15.35.35.683.566 1.15.748.353.137.882.3 1.857.344 1.054.048 1.37.058 4.041.058h.08c2.597 0 2.917-.01 3.96-.058.976-.045 1.505-.207 1.858-.344.466-.182.8-.398 1.15-.748.35-.35.566-.683.748-1.15.137-.353.3-.882.344-1.857.048-1.055.058-1.37.058-4.041v-.08c0-2.597-.01-2.917-.058-3.96-.045-.976-.207-1.505-.344-1.858a3.097 3.097 0 00-.748-1.15 3.098 3.098 0 00-1.15-.748c-.353-.137-.882-.3-1.857-.344-1.023-.047-1.351-.058-3.807-.058zM12 6.865a5.135 5.135 0 110 10.27 5.135 5.135 0 010-10.27zm0 1.802a3.333 3.333 0 100 6.666 3.333 3.333 0 000-6.666zm5.338-3.205a1.2 1.2 0 110 2.4 1.2 1.2 0 010-2.4z"/></svg>
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
          <div className="pt-8 border-t border-gray-900" />
        </div>
      </footer>
      <footer className="py-12 border-t bg-white">
        <div className="container mx-auto px-4 text-center text-gray-500 text-sm">
          &copy; 2025 Rare Atelier. All rights reserved.
        </div>
      </footer>
    </>
  );
}
