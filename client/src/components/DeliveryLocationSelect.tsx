import { useEffect, useMemo, useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { MapPin } from "lucide-react";

// Used by checkout to restrict delivery location choices.
// Keep this array exactly as provided in the task.
export const NEPAL_LOCATIONS = [
  "Kathmandu Inside Ring Road",
  "Kathmandu Outside Ring Road",
  "Pokhara",
  "Biratnagar",
  "Dharan",
  "Itahari",
  "Butwal",
  "Achham",
  "Arghakhanchi",
  "Baglung",
  "Baitadi",
  "Bajhang",
  "Bajura",
  "Banke",
  "Bara",
  "Bardiya",
  "Bhaktapur",
  "Bhojpur",
  "Chitwan",
  "Dadeldhura",
  "Dailekh",
  "Dang",
  "Darchula",
  "Dhading",
  "Dhankuta",
  "Dhanusha",
  "Dolakha",
  "Dolpa",
  "Doti",
  "Gorkha",
  "Gulmi",
  "Humla",
  "Ilam",
  "Jajarkot",
  "Jhapa",
  "Jumla",
  "Kailali",
  "Kalikot",
  "Kanchanpur",
  "Kapilvastu",
  "Kaski",
  "Kavrepalanchok",
  "Khotang",
  "Lalitpur",
  "Lamjung",
  "Mahottari",
  "Makwanpur",
  "Manang",
  "Morang",
  "Mugu",
  "Mustang",
  "Myagdi",
  "Nawalpur",
  "Nuwakot",
  "Okhaldhunga",
  "Palpa",
  "Panchthar",
  "Parasi",
  "Parbat",
  "Parsa",
  "Pyuthan",
  "Ramechhap",
  "Rasuwa",
  "Rautahat",
  "Rolpa",
  "Rukum East",
  "Rukum West",
  "Rupandehi",
  "Salyan",
  "Sankhuwasabha",
  "Saptari",
  "Sarlahi",
  "Sindhuli",
  "Sindhupalchok",
  "Siraha",
  "Solukhumbu",
  "Sunsari",
  "Surkhet",
  "Syangja",
  "Tanahun",
  "Taplejung",
  "Terhathum",
  "Udayapur",
];

type DeliveryLocationSelectProps = {
  value: string;
  onChange: (next: string) => void;
  error?: boolean;
};

export function DeliveryLocationSelect({
  value,
  onChange,
  error,
}: DeliveryLocationSelectProps) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Search text (what the user types). This resets the selected value unless it matches exactly.
  const [searchText, setSearchText] = useState<string>(value);
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    setSearchText(value);
  }, [value]);

  useEffect(() => {
    if (!open) return;
    const onMouseDown = (e: MouseEvent) => {
      const target = e.target as Node;
      if (!wrapperRef.current?.contains(target)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onMouseDown);
    return () => document.removeEventListener("mousedown", onMouseDown);
  }, [open]);

  const pinned = useMemo(() => NEPAL_LOCATIONS.slice(0, 2), []);

  const filtered = useMemo(() => {
    const term = searchText.trim().toLowerCase();
    const matches = (loc: string) => (term ? loc.toLowerCase().includes(term) : true);

    const pinnedMatches = pinned.filter(matches);
    const otherMatches = NEPAL_LOCATIONS.filter(
      (loc) => !pinned.includes(loc) && matches(loc),
    );

    // Pinned are always at the top when they match, per requirement.
    return [...pinnedMatches, ...otherMatches];
  }, [searchText, pinned]);

  useEffect(() => {
    if (!open) return;
    setActiveIndex(0);
  }, [open, searchText]);

  const selectValue = (next: string) => {
    onChange(next);
    setSearchText(next);
    setOpen(false);
    inputRef.current?.blur();
  };

  const onInputChange = (next: string) => {
    setSearchText(next);

    // Reset selection if user clears or changes after selecting.
    if (value && next !== value) onChange("");
    if (!next) onChange("");

    setOpen(true);
  };

  const onKeyDown: React.KeyboardEventHandler<HTMLInputElement> = (e) => {
    if (e.key === "Escape") {
      e.preventDefault();
      setOpen(false);
      return;
    }

    if (!open && (e.key === "ArrowDown" || e.key === "ArrowUp")) {
      setOpen(true);
      return;
    }

    if (!open) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, Math.max(0, filtered.length - 1)));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const next = filtered[activeIndex];
      if (next) selectValue(next);
    }
  };

  return (
    <div ref={wrapperRef} className="space-y-1 relative">
      <div className="relative">
        <MapPin
          className={cn(
            "absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground transition-opacity pointer-events-none",
            value ? "opacity-100" : "opacity-0",
          )}
        />
        <Input
          ref={inputRef}
          value={searchText}
          placeholder="Search your district or city..."
          className={cn(
            "h-14 rounded-none transition-colors pl-10 pr-3 bg-background border-gray-200",
            error ? "border-red-500 border-2" : "",
            "dark:border-zinc-300 dark:text-zinc-100",
          )}
          onFocus={() => setOpen(true)}
          onClick={() => setOpen(true)}
          onChange={(e) => onInputChange(e.target.value)}
          onKeyDown={onKeyDown}
          autoComplete="off"
          spellCheck={false}
          inputMode="text"
        />
      </div>

      {open && (
        <div
          className={cn(
            "absolute z-50 left-0 top-full mt-1 w-full max-w-full border border-gray-200 dark:border-zinc-300",
            "bg-white dark:bg-zinc-900",
            "shadow-lg",
          )}
        >
          <div className="max-h-[220px] overflow-y-auto">
            {filtered.length === 0 ? (
              <div className="p-4 text-sm text-muted-foreground">No results</div>
            ) : (
              filtered.map((loc, idx) => {
                const isActive = idx === activeIndex;
                const isSelected = value === loc;
                return (
                  <button
                    key={loc}
                    type="button"
                    onMouseEnter={() => setActiveIndex(idx)}
                    onClick={() => selectValue(loc)}
                    className={cn(
                      "min-h-[44px] w-full text-left px-4 flex items-center gap-2",
                      "text-sm",
                      isActive
                        ? "bg-primary/10 dark:bg-primary/15"
                        : "hover:bg-primary/10 dark:hover:bg-primary/15",
                      isSelected ? "font-bold text-zinc-900 dark:text-zinc-100" : "text-zinc-900 dark:text-zinc-100",
                    )}
                  >
                    {loc}
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}

      {error && (
        <p className="text-[10px] text-red-500 mt-1" role="alert">
          Please select a delivery location.
        </p>
      )}
    </div>
  );
}

