import * as React from "react";
import { Plus, Minus } from "lucide-react";
import { cn } from "@/lib/utils";

interface QuantityInputProps {
  value?: number;
  onChange?: (value: number) => void;
  min?: number;
  step?: number;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  id?: string;
  name?: string;
  "aria-label"?: string;
}

export function QuantityInput({
  value,
  onChange,
  min = 0,
  step = 1,
  placeholder = "0",
  className,
  disabled,
  id,
  name,
  ...props
}: QuantityInputProps) {
  const internalRef = React.useRef<HTMLInputElement>(null);
  const [display, setDisplay] = React.useState(value?.toString() ?? "");

  React.useEffect(() => {
    if (document.activeElement !== internalRef.current) {
      setDisplay(value?.toString() ?? "");
    }
  }, [value]);

  const handleIncrement = () => {
    const current = value ?? min;
    const next = Math.max(min, current + step);
    setDisplay(next.toString());
    onChange?.(next);
  };

  const handleDecrement = () => {
    const current = value ?? min;
    const next = Math.max(min, current - step);
    setDisplay(next.toString());
    onChange?.(next);
  };

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
      <button
        type="button"
        tabIndex={-1}
        onMouseDown={(e) => e.preventDefault()}
        onClick={handleDecrement}
        disabled={disabled || (value ?? min) <= min}
        className={cn(
          "flex h-full w-9 shrink-0 items-center justify-center text-muted-foreground transition-colors",
          "hover:bg-muted hover:text-foreground",
          "active:bg-muted/80 active:scale-95",
          "disabled:pointer-events-none disabled:opacity-30",
        )}
      >
        <Minus className="h-3.5 w-3.5" />
      </button>
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
          "h-full flex-1 border-0 bg-transparent px-2 text-center text-sm font-medium tabular-nums outline-none placeholder:text-muted-foreground/40",
          "[appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none",
        )}
        {...props}
      />
      <button
        type="button"
        tabIndex={-1}
        onMouseDown={(e) => e.preventDefault()}
        onClick={handleIncrement}
        disabled={disabled}
        className={cn(
          "flex h-full w-9 shrink-0 items-center justify-center text-muted-foreground transition-colors",
          "hover:bg-muted hover:text-foreground",
          "active:bg-muted/80 active:scale-95",
          "disabled:pointer-events-none disabled:opacity-30",
        )}
      >
        <Plus className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
