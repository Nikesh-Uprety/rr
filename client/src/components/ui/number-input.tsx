import * as React from "react";
import { NumberField } from "@base-ui/react/number-field";
import { Minus, Plus } from "lucide-react";
import { cn } from "@/lib/utils";

interface NumberInputProps {
  value?: number | null;
  onChange?: (event: React.FocusEvent<HTMLInputElement> | React.PointerEvent | React.KeyboardEvent, value: number | undefined) => void;
  onValueChange?: (value: number | null) => void;
  min?: number;
  max?: number;
  step?: number;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  autoFocus?: boolean;
  id?: string;
  name?: string;
  "aria-label"?: string;
}

export function NumberInput({
  value,
  onChange,
  onValueChange,
  min = 0,
  max,
  step = 1,
  placeholder,
  className,
  disabled,
  autoFocus,
  id,
  name,
  ...props
}: NumberInputProps) {
  return (
    <NumberField.Root
      value={value ?? undefined}
      onValueChange={(val) => {
        if (onValueChange) {
          onValueChange(val);
        }
      }}
      min={min}
      max={max}
      step={step}
      disabled={disabled}
      {...props}
    >
      <NumberField.Group
        className={cn(
          "group flex h-10 w-full items-center gap-0 overflow-hidden rounded-lg border border-input bg-background transition-colors",
          "focus-within:border-primary focus-within:ring-1 focus-within:ring-primary",
          "hover:border-foreground/30",
          disabled && "cursor-not-allowed opacity-50",
          className,
        )}
      >
        <NumberField.Decrement
          className={cn(
            "flex h-full w-8 shrink-0 cursor-pointer items-center justify-center border-r border-input text-muted-foreground transition-colors",
            "hover:bg-muted hover:text-foreground",
            "active:bg-muted/80",
            "data-[disabled]:pointer-events-none data-[disabled]:opacity-30",
          )}
        >
          <Minus className="h-3.5 w-3.5" />
        </NumberField.Decrement>
        <NumberField.Input
          className={cn(
            "h-full flex-1 border-0 bg-transparent px-3 text-center text-sm tabular-nums outline-none placeholder:text-muted-foreground/50",
            "[appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none",
          )}
          placeholder={placeholder}
          autoFocus={autoFocus}
          id={id}
          name={name}
        />
        <NumberField.Increment
          className={cn(
            "flex h-full w-8 shrink-0 cursor-pointer items-center justify-center border-l border-input text-muted-foreground transition-colors",
            "hover:bg-muted hover:text-foreground",
            "active:bg-muted/80",
            "data-[disabled]:pointer-events-none data-[disabled]:opacity-30",
          )}
        >
          <Plus className="h-3.5 w-3.5" />
        </NumberField.Increment>
      </NumberField.Group>
    </NumberField.Root>
  );
}
