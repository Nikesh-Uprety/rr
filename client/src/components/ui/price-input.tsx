import * as React from "react";
import { cn } from "@/lib/utils";

interface PriceInputProps {
  value?: number;
  onChange?: (value: number) => void;
  min?: number;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  id?: string;
  name?: string;
  prefix?: string;
  "aria-label"?: string;
}

export function PriceInput({
  value,
  onChange,
  min = 0,
  placeholder = "0",
  className,
  disabled,
  id,
  name,
  prefix = "NPR",
  ...props
}: PriceInputProps) {
  const internalRef = React.useRef<HTMLInputElement>(null);
  const [display, setDisplay] = React.useState(value?.toString() ?? "");

  React.useEffect(() => {
    if (document.activeElement !== internalRef.current) {
      setDisplay(value?.toString() ?? "");
    }
  }, [value]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    setDisplay(raw);
    const parsed = parseInt(raw.replace(/[^0-9-]/g, ""), 10);
    if (!isNaN(parsed) && parsed >= min) {
      onChange?.(parsed);
    }
  };

  const handleBlur = () => {
    const parsed = parseInt(display, 10);
    if (isNaN(parsed) || parsed < min) {
      setDisplay((value ?? min).toString());
      onChange?.(value ?? min);
    }
  };

  return (
    <div
      className={cn(
        "group flex h-10 w-full items-center gap-0 overflow-hidden rounded-xl border border-input bg-background transition-all",
        "focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/20",
        "hover:border-foreground/20",
        disabled && "cursor-not-allowed opacity-50",
        className,
      )}
    >
      <span className="flex h-full items-center px-3 text-xs font-bold uppercase tracking-wider text-muted-foreground border-r border-border/50 shrink-0">
        {prefix}
      </span>
      <input
        ref={internalRef}
        type="text"
        inputMode="numeric"
        value={display}
        onChange={handleInputChange}
        onBlur={handleBlur}
        placeholder={placeholder}
        disabled={disabled}
        id={id}
        name={name}
        className={cn(
          "h-full flex-1 border-0 bg-transparent px-3 text-sm font-medium tabular-nums outline-none placeholder:text-muted-foreground/40",
          "[appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none",
        )}
        {...props}
      />
    </div>
  );
}
