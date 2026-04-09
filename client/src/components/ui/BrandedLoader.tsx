import { cn } from "@/lib/utils";

interface BrandedLoaderProps {
  fullScreen?: boolean;
  className?: string;
}

export function BrandedLoader({ fullScreen = false, className }: BrandedLoaderProps) {
  return (
    <div
      className={cn(
        fullScreen
          ? "fixed inset-0 z-50 flex items-center justify-center bg-background p-4"
          : "flex w-full items-center justify-center py-16 p-4",
        className,
      )}
    >
      <div className="flex flex-col items-center gap-3 text-center">
        <div
          className="whitespace-nowrap text-sm font-semibold uppercase tracking-[0.42em] text-foreground md:text-base"
          style={{ fontFamily: '"Archivo Narrow", "Inter", sans-serif' }}
          aria-hidden="true"
        >
          RARE ATELIER
        </div>
        <div className="h-[2px] w-40 overflow-hidden rounded-full bg-foreground/12 md:w-48">
          <div className="loader-official-bar h-full w-full rounded-full bg-foreground/80" />
        </div>
        <div
          className="text-[10px] font-medium uppercase tracking-[0.28em] text-muted-foreground"
          style={{ fontFamily: '"Inter", sans-serif' }}
        >
          Loading
        </div>
      </div>
      <style>{`
        .loader-official-bar {
          transform-origin: left center;
          animation: loader-official-progress 1.25s ease-in-out infinite;
        }

        @keyframes loader-official-progress {
          0% {
            transform: scaleX(0.18);
            opacity: 0.45;
          }
          50% {
            transform: scaleX(0.78);
            opacity: 1;
          }
          100% {
            transform: scaleX(0.28);
            opacity: 0.6;
          }
        }
      `}</style>
    </div>
  );
}
