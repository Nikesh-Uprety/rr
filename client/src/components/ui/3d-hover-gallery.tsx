import React, { useEffect, useMemo, useRef, useState } from "react";
import { cn } from "@/lib/utils";

export interface ThreeDHoverGalleryProps {
  images?: string[];
  itemWidth?: number; // vw units (inactive)
  itemHeight?: number; // vh units (height)
  gap?: number; // rem units
  perspective?: number; // vw/vh units
  hoverScale?: number; // scale intensity
  transitionDuration?: number; // seconds
  backgroundColor?: string;
  grayscaleStrength?: number; // 0..1
  brightnessLevel?: number; // 0..1
  activeWidth?: number; // vw units
  rotationAngle?: number; // degrees
  zDepth?: number; // vh units
  enableKeyboardNavigation?: boolean;
  autoPlay?: boolean;
  autoPlayDelay?: number;
  className?: string;
  style?: React.CSSProperties;
  onImageClick?: (index: number, image: string) => void;
  onImageHover?: (index: number, image: string) => void;
  onImageFocus?: (index: number, image: string) => void;
}

const DEFAULT_IMAGES = [
  "/images/feature1.webp",
  "/images/feature2.webp",
  "/images/feature3.webp",
  "/images/landingpage3.webp",
  "/images/landingpage4.webp",
].filter(Boolean);

export default function ThreeDHoverGallery({
  images = DEFAULT_IMAGES,
  itemWidth = 12,
  itemHeight = 22,
  gap = 0.4,
  perspective = 35,
  hoverScale = 10,
  transitionDuration = 1.25,
  backgroundColor,
  grayscaleStrength = 1,
  brightnessLevel = 0.5,
  activeWidth = 28,
  rotationAngle = 35,
  zDepth = 8.5,
  enableKeyboardNavigation = true,
  autoPlay = false,
  autoPlayDelay = 3000,
  className,
  style,
  onImageClick,
  onImageHover,
  onImageFocus,
}: ThreeDHoverGalleryProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const [focusedIndex, setFocusedIndex] = useState<number | null>(null);
  const intervalRef = useRef<number | null>(null);

  const safeImages = useMemo(() => (Array.isArray(images) ? images.filter(Boolean) : []), [images]);

  useEffect(() => {
    if (!autoPlay) {
      if (intervalRef.current) clearInterval(intervalRef.current);
      intervalRef.current = null;
      return;
    }
    if (safeImages.length === 0) return;

    if (intervalRef.current) clearInterval(intervalRef.current);
    intervalRef.current = window.setInterval(() => {
      setActiveIndex((prev) => {
        const next = prev === null ? 0 : (prev + 1) % safeImages.length;
        return next;
      });
    }, autoPlayDelay);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      intervalRef.current = null;
    };
  }, [autoPlay, autoPlayDelay, safeImages.length]);

  const handleKeyDown = (e: React.KeyboardEvent, index: number) => {
    if (!enableKeyboardNavigation) return;

    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      const img = safeImages[index];
      if (!img) return;
      setActiveIndex(index);
      onImageClick?.(index, img);
      return;
    }

    if (e.key === "ArrowLeft") {
      e.preventDefault();
      const prev = index > 0 ? index - 1 : safeImages.length - 1;
      (containerRef.current?.children[prev] as HTMLElement | undefined)?.focus?.();
      return;
    }

    if (e.key === "ArrowRight") {
      e.preventDefault();
      const next = index < safeImages.length - 1 ? index + 1 : 0;
      (containerRef.current?.children[next] as HTMLElement | undefined)?.focus?.();
      return;
    }
  };

  const getItemStyle = (index: number): React.CSSProperties => {
    const isActive = activeIndex === index;
    const isFocused = focusedIndex === index;

    // Clamp prevents vw/vh from exploding on extremely small/large screens.
    const inactiveW = `clamp(76px, ${itemWidth}vw, 220px)`;
    const activeW = `clamp(140px, ${activeWidth}vw, 420px)`;
    const h = `clamp(220px, ${itemHeight}vh, 520px)`;

    const z = `translateZ(${zDepth}vh)`;
    const scale = `scale(${1 + hoverScale / 250})`;
    const rotateY = `rotateY(${rotationAngle}deg)`;

    return {
      width: isActive ? activeW : inactiveW,
      height: h,
      borderRadius: "0.5rem",
      backgroundImage: safeImages[index] ? `url(${safeImages[index]})` : undefined,
      backgroundSize: "cover",
      backgroundPosition: "center",
      backgroundColor: backgroundColor ?? "transparent",
      cursor: "pointer",
      filter:
        isActive || isFocused
          ? "none"
          : `grayscale(${grayscaleStrength}) brightness(${brightnessLevel})`,
      transform: isActive ? `${z} ${rotateY} ${scale}` : "translateZ(0px)",
      transition: `transform ${transitionDuration}s cubic-bezier(.1,.7,0,1), filter ${transitionDuration}s cubic-bezier(.1,.7,0,1), width ${transitionDuration}s cubic-bezier(.1,.7,0,1)`,
      willChange: "transform, filter, width",
      outline: isFocused ? "2px solid #3b82f6" : "none",
      outlineOffset: "2px",
    };
  };

  return (
    <div
      className={cn("relative w-full h-full overflow-hidden", className)}
      style={backgroundColor ? { backgroundColor, ...style } : style}
    >
      {safeImages.length === 0 ? null : (
        <div
          ref={containerRef}
          className="h-full w-full flex items-center justify-center"
          style={{
            perspective: `calc(${perspective}vw + ${perspective}vh)`,
            gap: `${gap}rem`,
          }}
        >
          {safeImages.map((image, index) => {
            const isActive = activeIndex === index;
            return (
              <div
                key={image + index}
                tabIndex={enableKeyboardNavigation ? 0 : -1}
                role="button"
                aria-label={`Image ${index + 1} of ${safeImages.length}`}
                aria-pressed={isActive}
                style={getItemStyle(index)}
                onClick={() => {
                  setActiveIndex(index);
                  onImageClick?.(index, image);
                }}
                onMouseEnter={() => {
                  if (!autoPlay) setActiveIndex(index);
                  onImageHover?.(index, image);
                }}
                onMouseLeave={() => {
                  if (!autoPlay) setActiveIndex(null);
                }}
                onFocus={() => {
                  setFocusedIndex(index);
                  onImageFocus?.(index, image);
                }}
                onBlur={() => setFocusedIndex(null)}
                onKeyDown={(e) => handleKeyDown(e, index)}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}

