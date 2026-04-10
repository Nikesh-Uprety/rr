import { useEffect, useMemo } from "react";
import { useLocation } from "wouter";
import { LayoutPanelTop } from "lucide-react";

import { PageEditor } from "@/components/canvas/PageEditor";
import { Button } from "@/components/ui/button";
import { useCurrentUser } from "@/hooks/useCurrentUser";

export default function CanvasBuilderPage() {
  const [location] = useLocation();
  const { user } = useCurrentUser();
  const isSuperAdmin = user?.role?.toLowerCase() === "superadmin";

  useEffect(() => {
    if (typeof window === "undefined" || isSuperAdmin) return;
    window.history.replaceState({}, "", "/admin/canvas/branding");
    window.dispatchEvent(new PopStateEvent("popstate"));
  }, [isSuperAdmin]);

  const pageId = useMemo(() => {
    const search = location.split("?")[1] ?? "";
    const params = new URLSearchParams(search);
    const raw = Number(params.get("pageId"));
    return Number.isFinite(raw) && raw > 0 ? raw : null;
  }, [location]);

  if (!isSuperAdmin) {
    return null;
  }

  if (!pageId) {
    return (
      <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center bg-[linear-gradient(180deg,#f7f8fc_0%,#eef3ff_100%)] px-6">
        <div className="max-w-xl rounded-[32px] border border-dashed border-[#bfd1ff] bg-white px-10 py-14 text-center shadow-[0_24px_60px_rgba(69,101,208,0.08)]">
          <p className="text-[11px] font-black uppercase tracking-[0.24em] text-[#4565d0]">
            Builder
          </p>
          <h1 className="mt-4 text-3xl font-semibold text-slate-950">
            Choose a page before opening the builder.
          </h1>
          <p className="mt-4 text-sm leading-7 text-slate-600">
            Head back to the pages studio, select a storefront page, and open the dedicated builder from there.
          </p>
          <Button
            className="mt-8"
            onClick={() => {
              window.history.pushState({}, "", "/admin/canvas?tab=pages&panel=list");
              window.dispatchEvent(new PopStateEvent("popstate"));
            }}
          >
            <LayoutPanelTop className="mr-2 h-4 w-4" />
            Go to Pages Studio
          </Button>
        </div>
      </div>
    );
  }

  return (
    <PageEditor
      pageId={pageId}
      onBack={() => {
        window.history.pushState({}, "", `/admin/canvas?tab=pages&panel=details&pageId=${pageId}`);
        window.dispatchEvent(new PopStateEvent("popstate"));
      }}
    />
  );
}
