import { useEffect, useRef } from "react";

export default function CustomCursor() {
  const dotRef = useRef<HTMLDivElement>(null);
  const ringRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const finePointer = window.matchMedia("(pointer: fine)").matches;
    if (!finePointer) return;

    let mx = window.innerWidth / 2;
    let my = window.innerHeight / 2;
    let rx = mx;
    let ry = my;
    let hovered = false;
    let raf = 0;

    document.body.classList.add("rare-home-cursor");

    const setHover = (active: boolean) => {
      hovered = active;
      if (ringRef.current) {
        ringRef.current.style.width = active ? "56px" : "36px";
        ringRef.current.style.height = active ? "56px" : "36px";
        ringRef.current.style.borderColor = active ? "rgba(201,169,110,0.95)" : "rgba(201,169,110,0.6)";
      }
    };

    const handleMove = (event: MouseEvent) => {
      mx = event.clientX;
      my = event.clientY;
    };

    const handleOver = (event: Event) => {
      const target = event.target as HTMLElement | null;
      setHover(Boolean(target?.closest("a, button, input, textarea, [role='button']")));
    };

    const animate = () => {
      rx += (mx - rx) * 0.14;
      ry += (my - ry) * 0.14;

      if (dotRef.current) {
        dotRef.current.style.transform = `translate(${mx}px, ${my}px)`;
      }
      if (ringRef.current) {
        ringRef.current.style.transform = `translate(${rx}px, ${ry}px) translate(-50%, -50%)`;
        ringRef.current.style.opacity = hovered ? "1" : "0.82";
      }

      raf = window.requestAnimationFrame(animate);
    };

    window.addEventListener("mousemove", handleMove, { passive: true });
    document.addEventListener("mouseover", handleOver, { passive: true });
    raf = window.requestAnimationFrame(animate);

    return () => {
      document.body.classList.remove("rare-home-cursor");
      window.removeEventListener("mousemove", handleMove);
      document.removeEventListener("mouseover", handleOver);
      window.cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <>
      <div
        ref={ringRef}
        className="pointer-events-none fixed left-0 top-0 z-[9998] hidden h-9 w-9 rounded-full border md:block"
        style={{
          borderColor: "rgba(201,169,110,0.6)",
          transition: "width 180ms var(--ease), height 180ms var(--ease), border-color 180ms var(--ease)",
        }}
      />
      <div
        ref={dotRef}
        className="pointer-events-none fixed left-0 top-0 z-[9999] hidden h-[5px] w-[5px] -translate-x-1/2 -translate-y-1/2 rounded-full md:block"
        style={{ background: "var(--gold)" }}
      />
    </>
  );
}
