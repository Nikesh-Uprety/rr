import { useEffect, useRef, useState } from "react";

type ScrollDirection = "up" | "down" | null;

interface UseScrollDirectionOptions {
  threshold?: number;
  initialHide?: boolean;
}

export function useScrollDirection({
  threshold = 80,
  initialHide = false,
}: UseScrollDirectionOptions = {}): {
  direction: ScrollDirection;
  isVisible: boolean;
  scrollY: number;
} {
  const lastScrollYRef = useRef(0);
  const tickingRef = useRef(false);
  const [direction, setDirection] = useState<ScrollDirection>(null);
  const [isVisible, setIsVisible] = useState(!initialHide);
  const [scrollY, setScrollY] = useState(0);

  useEffect(() => {
    const onScroll = () => {
      const currentY = window.scrollY;

      if (tickingRef.current) return;

      tickingRef.current = true;

      requestAnimationFrame(() => {
        const delta = currentY - lastScrollYRef.current;
        const nearTop = currentY <= threshold;

        if (nearTop) {
          setIsVisible(true);
          setDirection(null);
        } else if (delta > 4) {
          setDirection("down");
          setIsVisible(false);
        } else if (delta < -4) {
          setDirection("up");
          setIsVisible(true);
        }

        setScrollY(currentY);
        lastScrollYRef.current = currentY;
        tickingRef.current = false;
      });
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
    };
  }, [threshold]);

  return { direction, isVisible, scrollY };
}
