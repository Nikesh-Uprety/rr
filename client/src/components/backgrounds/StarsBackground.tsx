import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";

type Star = {
  x: number;
  y: number;
  radius: number;
  speed: number;
  twinkleSeed: number;
  twinkleSpeed: number;
};

interface StarsBackgroundProps {
  className?: string;
}

export function StarsBackground({ className }: StarsBackgroundProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let width = 0;
    let height = 0;
    let animationFrame = 0;
    let stars: Star[] = [];
    let time = 0;

    const createStar = (): Star => ({
      x: Math.random() * width,
      y: Math.random() * height,
      radius: 0.35 + Math.random() * 1.4,
      speed: 0.03 + Math.random() * 0.12,
      twinkleSeed: Math.random() * Math.PI * 2,
      twinkleSpeed: 0.5 + Math.random() * 1.4,
    });

    const resize = () => {
      width = window.innerWidth;
      height = window.innerHeight;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      const density = Math.min(170, Math.max(70, Math.floor((width * height) / 17000)));
      stars = Array.from({ length: density }, createStar);
    };

    const render = () => {
      time += 0.016;
      ctx.clearRect(0, 0, width, height);

      for (const star of stars) {
        star.y += star.speed;
        if (star.y > height + 2) {
          star.y = -2;
          star.x = Math.random() * width;
        }

        const twinkle = 0.4 + Math.sin(time * star.twinkleSpeed + star.twinkleSeed) * 0.35;
        ctx.beginPath();
        ctx.arc(star.x, star.y, star.radius, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255,255,255,${Math.max(0.1, twinkle)})`;
        ctx.fill();
      }

      animationFrame = window.requestAnimationFrame(render);
    };

    resize();
    render();
    window.addEventListener("resize", resize);

    return () => {
      window.removeEventListener("resize", resize);
      window.cancelAnimationFrame(animationFrame);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className={cn("pointer-events-none absolute inset-0", className)}
    />
  );
}
