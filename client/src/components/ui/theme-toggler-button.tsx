import { AnimatePresence, motion } from "framer-motion";
import { Moon, Sun } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ButtonHTMLAttributes } from "react";

type ThemeMode = "light" | "dark" | "warm";

interface ThemeTogglerButtonProps
  extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "onToggle"> {
  theme: ThemeMode;
  onToggle: () => void;
  iconClassName?: string;
}

export function ThemeTogglerButton({
  theme,
  onToggle,
  className,
  iconClassName,
  type = "button",
  ...props
}: ThemeTogglerButtonProps) {
  const isDark = theme === "dark";

  return (
    <button
      type={type}
      onClick={onToggle}
      aria-label={isDark ? "Switch to Light Mode" : "Switch to Dark Mode"}
      className={cn("relative overflow-hidden", className)}
      {...props}
    >
      <motion.span
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 rounded-[inherit]"
        animate={{
          opacity: isDark ? [0.12, 0.24, 0.12] : [0.08, 0.18, 0.08],
          scale: [1, 1.03, 1],
        }}
        transition={{ duration: 0.65, ease: "easeInOut" }}
      />

      <AnimatePresence mode="wait" initial={false}>
        <motion.span
          key={isDark ? "moon" : "sun"}
          initial={{ y: 8, opacity: 0, rotate: -45, scale: 0.78 }}
          animate={{ y: 0, opacity: 1, rotate: 0, scale: 1 }}
          exit={{ y: -8, opacity: 0, rotate: 45, scale: 0.78 }}
          transition={{ duration: 0.2, ease: "easeOut" }}
          className="relative z-10 flex items-center justify-center"
        >
          {isDark ? (
            <Moon className={cn("h-5 w-5", iconClassName)} />
          ) : (
            <Sun className={cn("h-5 w-5", iconClassName)} />
          )}
        </motion.span>
      </AnimatePresence>
    </button>
  );
}
