import { useThemeStore } from "@/store/theme";
import { ThemeTogglerButton } from "@/components/ui/theme-toggler-button";

export function ThemeToggle() {
  const { theme, setTheme } = useThemeStore();

  return (
    <ThemeTogglerButton
      theme={theme}
      onToggle={() => setTheme(theme === "dark" ? "light" : "dark")}
      className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-muted"
      iconClassName="h-4 w-4"
      title={theme === "dark" ? "Switch to Light Mode" : "Switch to Dark Mode"}
    />
  );
}
