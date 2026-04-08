import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { addDays, addHours, format, isValid, parseISO } from "date-fns";
import { Plus, Tags, Trash2, Edit2, Copy, Check, X } from "lucide-react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { fetchAdminPromoCodes, createAdminPromoCode, updateAdminPromoCode, deleteAdminPromoCode, type PromoCode } from "@/lib/adminApi";
import { fetchProducts, type ProductApi } from "@/lib/api";
import {
  RadioGroup,
  RadioGroupItem,
} from "@/components/ui/radio-group";

const promoSchema = z
  .object({
  code: z.string().min(3, "Code must be at least 3 characters").max(50),
  discountPct: z.coerce.number().min(1, "Discount must be at least 1%").max(100),
  maxUses: z.coerce.number().min(1, "Must allow at least 1 use"),
  active: z.boolean().default(true),
  applyToSpecificProducts: z.boolean().default(false),
  applicableProductIds: z.array(z.string().min(1)).default([]),
  durationPreset: z.enum(["none", "1day", "1week", "custom"]).default("none"),
  customExpiresAt: z.string().optional().nullable(),
  })
  .superRefine((v, ctx) => {
    if (v.applyToSpecificProducts && v.applicableProductIds.length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["applicableProductIds"],
        message: "Select at least one product",
      });
    }

    if (v.durationPreset === "custom") {
      const raw = v.customExpiresAt || "";
      const parsed = raw ? parseISO(raw) : null;
      if (!raw || !parsed || !isValid(parsed)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["customExpiresAt"],
          message: "Pick a valid expiry date",
        });
      }
    }
  });

type PromoFormValues = z.infer<typeof promoSchema>;

function toDatetimeLocalValue(d: Date) {
  // datetime-local expects `YYYY-MM-DDTHH:mm`
  return format(d, "yyyy-MM-dd'T'HH:mm");
}

export default function AdminPromoCodes() {
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [editingPromo, setEditingPromo] = useState<PromoCode | null>(null);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [productPickerOpen, setProductPickerOpen] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: promos = [], isLoading } = useQuery({
    queryKey: ["admin", "promo-codes"],
    queryFn: fetchAdminPromoCodes,
  });

  const { data: products = [] } = useQuery<ProductApi[]>({
    queryKey: ["products", "promo-codes"],
    queryFn: () => fetchProducts({ limit: 2000 }).then(r => r.products),
  });

  const form = useForm<PromoFormValues>({
    resolver: zodResolver(promoSchema),
    defaultValues: {
      code: "",
      discountPct: 10,
      maxUses: 100,
      active: true,
      applyToSpecificProducts: false,
      applicableProductIds: [],
      durationPreset: "none",
      customExpiresAt: null,
    },
  });

  const applyToSpecificProducts = form.watch("applyToSpecificProducts");
  const selectedProductIds = form.watch("applicableProductIds");
  const durationPreset = form.watch("durationPreset");
  const customExpiresAt = form.watch("customExpiresAt");

  const expiryPreview = useMemo(() => {
    if (!durationPreset || durationPreset === "none") return { label: "Never expires", date: null as Date | null };

    const now = new Date();
    if (durationPreset === "1day") {
      const d = addHours(now, 24);
      return { label: `Expires: ${format(d, "EEE dd MMM yyyy 'at' hh:mm a")}`, date: d };
    }

    if (durationPreset === "1week") {
      const d = addDays(now, 7);
      return { label: `Expires: ${format(d, "EEE dd MMM yyyy 'at' hh:mm a")}`, date: d };
    }

    // custom
    if (customExpiresAt) {
      const parsed = parseISO(customExpiresAt);
      if (isValid(parsed)) {
        return { label: `Expires: ${format(parsed, "EEE dd MMM yyyy 'at' hh:mm a")}`, date: parsed };
      }
    }

    return { label: "Expires: (pick a date)", date: null as Date | null };
  }, [customExpiresAt, durationPreset]);

  const productById = useMemo(() => {
    const map = new Map<string, ProductApi>();
    for (const p of products) {
      if (p.id) map.set(String(p.id), p);
    }
    return map;
  }, [products]);

  const handleEditClick = (promo: PromoCode) => {
    const isRestricted = promo.applicableProductIds != null;
    const allowedPresets = ["none", "1day", "1week", "custom"] as const;
    const durationPreset: PromoFormValues["durationPreset"] =
      (promo.durationPreset && allowedPresets.includes(promo.durationPreset as any)
        ? (promo.durationPreset as PromoFormValues["durationPreset"])
        : promo.expiresAt
          ? "custom"
          : "none") as PromoFormValues["durationPreset"];
    const customExpiresAt =
      durationPreset === "custom" && promo.expiresAt
        ? toDatetimeLocalValue(new Date(promo.expiresAt))
        : null;

    form.reset({
      code: promo.code,
      discountPct: promo.discountPct,
      maxUses: promo.maxUses,
      active: promo.active,
      applyToSpecificProducts: isRestricted,
      applicableProductIds: promo.applicableProductIds ?? [],
      durationPreset,
      customExpiresAt,
    });
    setEditingPromo(promo);
    setIsAddOpen(true);
  };

  const handleAddClick = () => {
    form.reset({
      code: "",
      discountPct: 10,
      maxUses: 100,
      active: true,
      applyToSpecificProducts: false,
      applicableProductIds: [],
      durationPreset: "none",
      customExpiresAt: null,
    });
    setEditingPromo(null);
    setIsAddOpen(true);
  };

  const saveMutation = useMutation({
    mutationFn: async (values: PromoFormValues) => {
      const payload = {
        code: values.code,
        discountPct: values.discountPct,
        maxUses: values.maxUses,
        active: values.active,
        applicableProductIds: values.applyToSpecificProducts
          ? values.applicableProductIds
          : null,
        durationPreset: values.durationPreset,
        expiresAt:
          values.durationPreset === "custom" ? values.customExpiresAt : null,
      };

      if (editingPromo) {
        return updateAdminPromoCode(editingPromo.id, payload);
      } else {
        return createAdminPromoCode(payload as any);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "promo-codes"] });
      toast({ title: editingPromo ? "Promo Code Updated" : "Promo Code Created" });
      setIsAddOpen(false);
    },
    onError: (err: any) => {
      toast({ title: "Operation failed", description: err.message || "Failed to save promo code", variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteAdminPromoCode,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "promo-codes"] });
      toast({ title: "Promo Code Deleted" });
    },
    onError: () => {
      toast({ title: "Failed to delete promo code", variant: "destructive" });
    },
  });

  const copyToClipboard = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    toast({ title: "Copied to clipboard" });
    setTimeout(() => setCopiedCode(null), 2000);
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex justify-between items-center px-2">
        <div>
          <h1 className="text-3xl font-serif font-medium text-[#2C3E2D] dark:text-foreground">Promo Codes</h1>
          <p className="text-muted-foreground mt-1">Manage discount codes</p>
        </div>
        <Button onClick={handleAddClick} className="bg-[#2C3E2D] hover:bg-[#1A251B] text-white dark:bg-primary dark:text-primary-foreground">
          <Plus className="w-4 h-4 mr-2" /> Create Promo
        </Button>
      </div>

      <div className="bg-white dark:bg-card rounded-xl border border-[#E5E5E0] dark:border-border overflow-hidden shadow-sm">
        <Table>
          <TableHeader className="bg-muted/50">
            <TableRow>
              <TableHead className="font-semibold px-6">Code</TableHead>
              <TableHead className="font-semibold">Discount</TableHead>
              <TableHead className="font-semibold">Uses</TableHead>
              <TableHead className="font-semibold">Status</TableHead>
              <TableHead className="font-semibold">Products</TableHead>
              <TableHead className="font-semibold">Expires</TableHead>
              <TableHead className="font-semibold">Created</TableHead>
              <TableHead className="text-right px-6 font-semibold">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-10 opacity-60">
                  <div className="flex justify-center mb-2">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#2C3E2D] dark:border-primary"></div>
                  </div>
                  Loading promo codes...
                </TableCell>
              </TableRow>
            ) : promos.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-10 opacity-60">
                  <Tags className="w-8 h-8 md:w-10 md:h-10 mx-auto text-muted-foreground mb-3 opacity-50" />
                  <p className="text-sm">No promo codes found.</p>
                </TableCell>
              </TableRow>
            ) : (
              promos.map((promo) => (
                <TableRow key={promo.id}>
                  <TableCell className="px-6 font-medium">
                    <div className="flex items-center gap-2">
                      <span className="bg-primary/10 text-primary px-2 py-0.5 rounded text-sm uppercase tracking-wider font-bold">
                        {promo.code}
                      </span>
                      <button
                        onClick={() => copyToClipboard(promo.code)}
                        className="text-muted-foreground hover:text-foreground transition-colors"
                      >
                        {copiedCode === promo.code ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
                      </button>
                    </div>
                  </TableCell>
                  <TableCell>
                    <span className="font-bold">{promo.discountPct}%</span>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <div className="h-2 w-16 bg-muted rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-primary" 
                          style={{ width: `${Math.min(100, (promo.usedCount / promo.maxUses) * 100)}%` }}
                        />
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {promo.usedCount} / {promo.maxUses}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      {promo.expiresAt &&
                      new Date(promo.expiresAt) < new Date() ? (
                        <Badge
                          variant="destructive"
                          className="rounded-full px-3 py-1 text-xs"
                        >
                          Expired
                        </Badge>
                      ) : (
                        <>
                          <div
                            className={`w-2 h-2 rounded-full ${
                              promo.active ? "bg-green-500" : "bg-red-500"
                            }`}
                          />
                          <span className="text-sm capitalize">
                            {promo.active ? "Active" : "Inactive"}
                          </span>
                        </>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-sm">
                    {promo.applicableProductIds == null
                      ? "All"
                      : promo.applicableProductIds.length}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {promo.expiresAt
                      ? format(new Date(promo.expiresAt), "MMM d, yyyy")
                      : "Never"}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {format(new Date(promo.createdAt || new Date()), "MMM d, yyyy")}
                  </TableCell>
                  <TableCell className="text-right px-6">
                    <div className="flex justify-end gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-[#2C3E2D] hover:bg-[#2C3E2D]/10 dark:text-gray-300 dark:hover:bg-muted"
                        onClick={() => handleEditClick(promo)}
                      >
                        <Edit2 className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
                        onClick={() => {
                          if (confirm(`Delete promo code ${promo.code}?`)) {
                            deleteMutation.mutate(promo.id!);
                          }
                        }}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
        <DialogContent className="sm:max-w-[720px] w-[92vw] max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingPromo ? "Edit Promo Code" : "Create Promo Code"}</DialogTitle>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit((v) => saveMutation.mutate(v))} className="space-y-6 pt-4">
              <FormField
                control={form.control}
                name="code"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Code</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g. SUMMER25" className="uppercase" {...field} onChange={(e) => field.onChange(e.target.value.toUpperCase())} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="discountPct"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Discount (%)</FormLabel>
                      <FormControl>
                        <Input type="number" min={1} max={100} {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="maxUses"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Max Uses</FormLabel>
                      <FormControl>
                        <Input type="number" min={1} {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <FormField
                control={form.control}
                name="active"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                    <div className="space-y-0.5">
                      <FormLabel className="text-base">Active Status</FormLabel>
                      <p className="text-[10px] text-muted-foreground">
                        Enable or disable this promo code.
                      </p>
                    </div>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />

              <div className="space-y-4 rounded-xl border p-4">
                <h4 className="text-sm font-bold text-foreground">Product Restriction</h4>

                <FormField
                  control={form.control}
                  name="applyToSpecificProducts"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                      <div className="space-y-0.5">
                        <FormLabel className="text-base">Apply to specific products only</FormLabel>
                        <p className="text-[10px] text-muted-foreground">
                          Turn on to restrict this promo code to selected products.
                        </p>
                      </div>
                      <FormControl>
                        <Switch
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />

                {applyToSpecificProducts && (
                  <div className="space-y-3">
                    <FormField
                      control={form.control}
                      name="applicableProductIds"
                      render={() => (
                        <FormItem>
                          <FormLabel>Restricted Products</FormLabel>
                          <Popover
                            open={productPickerOpen}
                            onOpenChange={setProductPickerOpen}
                          >
                            <PopoverTrigger asChild>
                              <Button
                                type="button"
                                variant="outline"
                                className="w-full justify-between"
                              >
                                <span className="text-xs font-bold">
                                  {selectedProductIds.length
                                    ? `${selectedProductIds.length} selected`
                                    : "Select products"}
                                </span>
                              </Button>
                            </PopoverTrigger>
                            <PopoverContent align="start" className="p-0 w-[360px] z-[210]">
                              <Command>
                                <CommandInput placeholder="Search products..." />
                                <CommandList>
                                  <CommandEmpty>No products found.</CommandEmpty>
                                  <CommandGroup heading="Products">
                                    {products
                                      .map((p) => ({
                                        p,
                                        idStr: String(p.id),
                                      }))
                                      .map(({ p, idStr }) => {
                                        const selected = selectedProductIds.includes(idStr);
                                        return (
                                          <CommandItem
                                            key={p.id}
                                            value={`${idStr} ${p.name}`}
                                            onSelect={() => {
                                              const next = selected
                                                ? selectedProductIds.filter(
                                                    (x) => x !== idStr,
                                                  )
                                                : [...selectedProductIds, idStr];
                                              form.setValue(
                                                "applicableProductIds",
                                                next,
                                                { shouldDirty: true, shouldValidate: true },
                                              );
                                            }}
                                          >
                                            <Checkbox
                                              checked={selected}
                                              className="mr-2"
                                            />
                                            <span className="text-sm">{p.name}</span>
                                          </CommandItem>
                                        );
                                      })}
                                  </CommandGroup>
                                </CommandList>
                              </Command>
                            </PopoverContent>
                          </Popover>

                          {form.formState.errors.applicableProductIds && (
                            <FormMessage />
                          )}

                          {selectedProductIds.length > 0 && (
                            <div className="flex flex-wrap gap-2 pt-2">
                              {selectedProductIds.map((idStr) => {
                                const prod = productById.get(idStr);
                                return (
                                  <div
                                    key={idStr}
                                    className="inline-flex items-center gap-2 px-2 py-1 rounded-full border bg-muted/20"
                                  >
                                    <span className="text-xs font-medium">
                                      {prod?.name ?? idStr}
                                    </span>
                                    <button
                                      type="button"
                                      className="text-muted-foreground hover:text-red-500"
                                      onClick={() => {
                                        form.setValue(
                                          "applicableProductIds",
                                          selectedProductIds.filter(
                                            (x) => x !== idStr,
                                          ),
                                          { shouldDirty: true, shouldValidate: true },
                                        );
                                      }}
                                    >
                                      <X className="w-3 h-3" />
                                    </button>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </FormItem>
                      )}
                    />
                  </div>
                )}
              </div>

              <div className="space-y-3 rounded-xl border p-4">
                <h4 className="text-sm font-bold text-foreground">Expiry</h4>

                <RadioGroup
                  value={durationPreset}
                  onValueChange={(v) => {
                    form.setValue("durationPreset", v as any, {
                      shouldDirty: true,
                      shouldValidate: true,
                    });
                    if (v !== "custom") form.setValue("customExpiresAt", null, { shouldDirty: true });
                  }}
                  className="flex flex-col gap-2"
                >
                  <div className="flex items-center gap-2">
                    <RadioGroupItem value="none" id="dur-none" />
                    <Label htmlFor="dur-none">No expiry</Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <RadioGroupItem value="1day" id="dur-1day" />
                    <Label htmlFor="dur-1day">1 Day</Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <RadioGroupItem value="1week" id="dur-1week" />
                    <Label htmlFor="dur-1week">1 Week</Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <RadioGroupItem value="custom" id="dur-custom" />
                    <Label htmlFor="dur-custom">Custom date</Label>
                  </div>
                </RadioGroup>

                {durationPreset === "custom" && (
                  <FormField
                    control={form.control}
                    name="customExpiresAt"
                    render={() => (
                      <FormItem>
                        <FormLabel>Custom expiry date/time</FormLabel>
                        <FormControl>
                          <Input
                            type="datetime-local"
                            value={customExpiresAt ?? ""}
                            onChange={(e) =>
                              form.setValue(
                                "customExpiresAt",
                                e.target.value ? e.target.value : null,
                                { shouldDirty: true, shouldValidate: true },
                              )
                            }
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}

                <p className="text-[12px] text-muted-foreground pt-1">
                  {expiryPreview.label}
                </p>
              </div>

              <div className="flex justify-end gap-3 rounded-none">
                <Button type="button" variant="outline" onClick={() => setIsAddOpen(false)}>
                  Cancel
                </Button>
                <Button 
                  type="submit" 
                  loading={saveMutation.isPending} 
                  loadingText="Saving..."
                  className="bg-[#2C3E2D] text-white hover:bg-[#1A251B] dark:bg-primary dark:text-primary-foreground"
                >
                  Save Code
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
