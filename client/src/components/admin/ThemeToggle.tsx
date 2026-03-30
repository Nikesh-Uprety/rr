import { useLayoutEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";

export function ThemeToggle() {
  const [theme, setTheme] = useState<"light" | "dark">(() => {
    if (typeof window !== "undefined") {
      const root = window.document.documentElement;
      if (root.classList.contains("dark")) return "dark";
      const saved = localStorage.getItem("theme");
      if (saved === "light" || saved === "dark") return saved;
      const hour = new Date().getHours();
      return hour >= 6 && hour < 18 ? "light" : "dark";
    }
    return "light";
  });

  useLayoutEffect(() => {
    const root = window.document.documentElement;
    root.classList.add("theme-switching");
    root.classList.remove("light", "dark", "warm");
    if (theme === "dark") {
      root.classList.add("dark");
      root.style.colorScheme = "dark";
    } else {
      root.classList.add("light");
      root.style.colorScheme = "light";
    }

    localStorage.setItem("theme", theme);

    const clearSwitchClass = () => {
      root.classList.remove("theme-switching");
    };
    const rafA = window.requestAnimationFrame(() => {
      window.requestAnimationFrame(clearSwitchClass);
    });

    return () => {
      window.cancelAnimationFrame(rafA);
      root.classList.remove("theme-switching");
    };
  }, [theme]);

  return (
    <button
      onClick={() => setTheme(theme === "light" ? "dark" : "light")}
      className="p-1.5 rounded-md hover:bg-muted text-muted-foreground transition-colors"
      title={theme === "light" ? "Switch to Dark Mode" : "Switch to Light Mode"}
    >
      {theme === "light" ? (
        <Moon className="h-4 w-4" />
      ) : (
        <Sun className="h-4 w-4" />
      )}
    </button>
  );
}
