import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

interface TopLoadingBarProps {
  isLoading: boolean;
  className?: string;
}

export function TopLoadingBar({ isLoading, className }: TopLoadingBarProps) {
  const [visible, setVisible] = useState(false);
  const [progress, setProgress] = useState(0);
  const intervalRef = useRef<number | null>(null);
  const hideTimeoutRef = useRef<number | null>(null);
   const startTimeRef = useRef<number | null>(null);

  useEffect(() => {
    if (isLoading) {
      if (hideTimeoutRef.current) {
        window.clearTimeout(hideTimeoutRef.current);
        hideTimeoutRef.current = null;
      }

      setVisible(true);
      setProgress((prev) => (prev === 0 ? 8 : prev));

      if (startTimeRef.current === null) {
        startTimeRef.current = performance.now();
      }

      if (intervalRef.current === null) {
        intervalRef.current = window.setInterval(() => {
          setProgress((prev) => {
            const now = performance.now();
            const elapsed = startTimeRef.current ? now - startTimeRef.current : 0;

            // Target curve: reach ~70–80% around 400–600ms, then ease toward 95%.
            const target =
              elapsed <= 150
                ? 40 // very fast initial ramp so quick loads complete fast
                : elapsed <= 400
                  ? 70
                  : 80 + Math.min(15, (elapsed - 400) / 80); // inch toward ~95

            const next = prev + (target - prev) * 0.25;
            return Math.min(next, 95);
          });
        }, 100);
      }
    } else {
      if (intervalRef.current !== null) {
        window.clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      startTimeRef.current = null;

      if (visible) {
        setProgress(100);
        hideTimeoutRef.current = window.setTimeout(() => {
          setVisible(false);
          setProgress(0);
        }, 80);
      }
    }

    return () => {
      if (intervalRef.current !== null) {
        window.clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      if (hideTimeoutRef.current !== null) {
        window.clearTimeout(hideTimeoutRef.current);
        hideTimeoutRef.current = null;
      }
    };
  }, [isLoading, visible]);

  const clampedProgress = Math.min(progress, 99);

  return (
    <div
      className={cn(
        "fixed inset-x-0 top-0 z-[9999] h-0.5 bg-transparent transition-opacity duration-100",
        visible ? "opacity-100" : "opacity-0 pointer-events-none",
        className,
      )}
    >
      <div className="relative h-full overflow-hidden">
        <div
          className="absolute left-0 top-0 h-full bg-primary shadow-[0_0_8px_rgba(34,197,94,0.35)] transition-[width] duration-150 ease-out"
          style={{ width: `${clampedProgress}%` }}
        />
      </div>
    </div>
  );
}
