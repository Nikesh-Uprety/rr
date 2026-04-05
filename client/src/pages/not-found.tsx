import { StarsBackground } from "@/components/backgrounds/StarsBackground";
import { ArrowLeft, House, Search } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  const handleGoBack = () => {
    if (typeof window !== "undefined" && window.history.length > 1) {
      window.history.back();
      return;
    }
    window.location.href = "/";
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#f6f3ec] text-[#1f2e22] dark:bg-[#0d1410] dark:text-[#e8efe8]">
      <StarsBackground />

      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -left-24 top-16 h-72 w-72 rounded-full bg-[#6d8a6f]/20 blur-3xl dark:bg-[#87a88a]/15" />
        <div className="absolute -right-20 bottom-8 h-80 w-80 rounded-full bg-[#2c3e2d]/20 blur-3xl dark:bg-[#aac5ac]/10" />
      </div>

      <div className="relative z-10 mx-auto flex min-h-screen w-full max-w-6xl items-center px-4 py-10 sm:px-6">
        <div className="w-full rounded-3xl border border-black/10 bg-white/75 p-6 shadow-[0_24px_80px_rgba(31,46,34,0.12)] backdrop-blur md:p-10 dark:border-white/10 dark:bg-[#121b15]/75 dark:shadow-[0_24px_80px_rgba(0,0,0,0.45)]">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-black/10 bg-white/70 px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.18em] dark:border-white/15 dark:bg-white/5">
            <Search className="h-3.5 w-3.5" />
            Error 404
          </div>

          <div className="grid gap-8 lg:grid-cols-[1.1fr_0.9fr] lg:items-end">
            <div>
              <h1 className="text-6xl font-semibold leading-none tracking-tight sm:text-7xl md:text-8xl">
                404
              </h1>
              <h2 className="mt-4 text-2xl font-medium sm:text-3xl">
                Page Not Found
              </h2>
              <p className="mt-3 max-w-xl text-sm text-[#425748] sm:text-base dark:text-[#9eb29f]">
                The page you requested is unavailable right now. It may have been moved, deleted, or the link may be incorrect.
              </p>

              <div className="mt-7 flex flex-wrap items-center gap-3">
                <a href="/">
                  <Button className="h-10 rounded-full bg-[#243427] px-5 text-white hover:bg-[#1b281d] dark:bg-[#edf4ee] dark:text-[#142016] dark:hover:bg-white">
                    <House className="mr-2 h-4 w-4" />
                    Go To Home
                  </Button>
                </a>
                <Button
                  type="button"
                  variant="outline"
                  className="h-10 rounded-full border-[#2b3d2e]/30 bg-transparent px-5 text-[#1f2e22] hover:bg-[#e8efe9] dark:border-white/20 dark:text-[#d7e4d8] dark:hover:bg-white/10"
                  onClick={handleGoBack}
                >
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Go Back
                </Button>
              </div>
            </div>

            <div className="rounded-2xl border border-black/10 bg-[#f0efe8] p-5 dark:border-white/10 dark:bg-[#0f1712]">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#5f7662] dark:text-[#8ea391]">
                Need Help
              </p>
              <p className="mt-3 text-sm text-[#3f5545] dark:text-[#a5b7a6]">
                Try navigating from the main menu or return to the storefront homepage to continue browsing.
              </p>
              <div className="mt-4 text-xs text-[#5f7662] dark:text-[#8ea391]">
                Rare Atelier Official
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
