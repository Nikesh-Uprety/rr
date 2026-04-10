import { Eye, Paintbrush2 } from "lucide-react";

import { BrandingManager } from "@/pages/admin/CanvasPage";

export default function BrandingStudioPage() {
  return (
    <div className="min-h-[calc(100vh-4rem)] overflow-hidden bg-[linear-gradient(180deg,#fbfcff_0%,#eef3ff_48%,#f7f8fc_100%)]">
      <div className="border-b border-[#d8e2ff] bg-white/88 px-6 py-6 backdrop-blur-sm">
        <div className="mx-auto flex max-w-7xl flex-wrap items-start justify-between gap-6">
          <div className="max-w-3xl">
            <p className="text-[11px] font-black uppercase tracking-[0.24em] text-[#4565d0]">
              Branding Studio
            </p>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight text-slate-950">
              Manage the active storefront identity in one focused workspace.
            </h1>
            <p className="mt-3 text-sm leading-7 text-slate-600">
              Update the live logo, favicon, footer branding, and active template assets here. Changes
              flow straight into the storefront so the navigation and shared brand surfaces stay in sync.
            </p>
          </div>
          <div className="grid min-w-[280px] gap-3 rounded-[28px] border border-[#d6e0ff] bg-[#f8fbff] p-5 shadow-[0_20px_50px_rgba(15,23,42,0.06)]">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#4565d0] text-white">
                <Paintbrush2 className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-950">Live storefront sync</p>
                <p className="text-xs text-slate-500">Logo changes update the current active storefront branding.</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white text-[#4565d0] shadow-[inset_0_0_0_1px_rgba(69,101,208,0.18)]">
                <Eye className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-950">Preview before saving</p>
                <p className="text-xs text-slate-500">Compare presets and uploads before committing the active look.</p>
              </div>
            </div>
          </div>
        </div>
      </div>
      <BrandingManager />
    </div>
  );
}
