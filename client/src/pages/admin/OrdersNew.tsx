import { useMemo, useState } from "react";
import { useLocation } from "wouter";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { PriceInput } from "@/components/ui/price-input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { fetchProducts, type ProductApi } from "@/lib/api";
import { createAdminOrder, type AdminCreateOrderInput } from "@/lib/adminApi";
import { useToast } from "@/hooks/use-toast";
import { formatPrice } from "@/lib/format";
import { getErrorMessage } from "@/lib/queryClient";

type OrderItemDraft = {
  productId: string;
  color?: string;
  size?: string;
  quantity: number;
  priceAtTime: number;
};

function parseJsonArray(input: string | null | undefined): string[] {
  if (!input) return [];
  try {
    const parsed = JSON.parse(input);
    return Array.isArray(parsed) ? parsed.filter((v) => typeof v === "string") : [];
  } catch {
    return [];
  }
}

export default function AdminOrdersNew() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [items, setItems] = useState<OrderItemDraft[]>([
    { productId: "", quantity: 1, priceAtTime: 0 },
  ]);
  const [paymentMethod, setPaymentMethod] = useState("cash_on_delivery");
  const [deliveryRequired, setDeliveryRequired] = useState(true);
  const [deliveryProvider, setDeliveryProvider] = useState("");
  const [deliveryAddress, setDeliveryAddress] = useState("");
  const [status, setStatus] = useState<AdminCreateOrderInput["status"]>("pending");
  const [shipping, setShipping] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    address: "",
    city: "",
    zip: "",
    country: "Nepal",
    deliveryLocation: "",
    locationCoordinates: "",
  });

  const { data: productsData } = useQuery<{ products: ProductApi[]; total: number }>({
    queryKey: ["admin", "orders", "products"],
    queryFn: () => fetchProducts({ limit: 200 }),
    staleTime: 60_000,
  });
  const products = productsData?.products ?? [];
  const productById = useMemo(
    () => new Map(products.map((product) => [product.id, product])),
    [products],
  );

  const subtotal = items.reduce((sum, item) => sum + item.priceAtTime * item.quantity, 0);

  const updateItem = (index: number, patch: Partial<OrderItemDraft>) => {
    setItems((prev) =>
      prev.map((item, i) => (i === index ? { ...item, ...patch } : item)),
    );
  };

  const addRow = () => {
    setItems((prev) => [...prev, { productId: "", quantity: 1, priceAtTime: 0 }]);
  };

  const removeRow = (index: number) => {
    setItems((prev) => prev.filter((_, i) => i !== index));
  };

  const mutation = useMutation({
    mutationFn: (payload: AdminCreateOrderInput) => createAdminOrder(payload),
    onSuccess: (data) => {
      toast({
        title: "Order created",
        description: data?.orderNumber ? `Order ${data.orderNumber} is ready.` : "Order created successfully.",
      });
      setLocation("/admin/orders");
    },
    onError: (error) => {
      toast({
        title: "Failed to create order",
        description: getErrorMessage(error, "Please review the order details and try again."),
        variant: "destructive",
      });
    },
  });

  const handleSubmit = () => {
    const filteredItems = items
      .filter((item) => item.productId)
      .map((item) => ({
        ...item,
        quantity: Number(item.quantity) || 1,
        priceAtTime: Number(item.priceAtTime) || 0,
      }));

    if (!filteredItems.length) {
      toast({ title: "Add at least one product", variant: "destructive" });
      return;
    }

    mutation.mutate({
      items: filteredItems,
      shipping: {
        ...shipping,
        phone: shipping.phone || undefined,
        locationCoordinates: shipping.locationCoordinates || undefined,
      },
      paymentMethod,
      deliveryRequired,
      deliveryProvider: deliveryProvider || null,
      deliveryAddress: deliveryAddress || null,
      source: "admin",
      status: status || undefined,
    });
  };

  return (
    <div className="space-y-8 p-4 sm:p-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-serif font-medium text-[#2C3E2D] dark:text-foreground">
          Create Order
        </h1>
        <p className="text-muted-foreground">
          Capture customer, delivery, and product details for a new order.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <div className="space-y-6">
          <div className="rounded-2xl border border-border bg-white/90 p-6 shadow-sm dark:bg-card">
            <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Customer</h2>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <div className="space-y-1">
                <label htmlFor="order-first-name" className="text-[11px] font-semibold text-muted-foreground">
                  First name
                </label>
                <Input
                  id="order-first-name"
                  name="firstName"
                  autoComplete="given-name"
                  placeholder="First name…"
                  value={shipping.firstName}
                  onChange={(e) => setShipping((s) => ({ ...s, firstName: e.target.value }))}
                />
              </div>
              <div className="space-y-1">
                <label htmlFor="order-last-name" className="text-[11px] font-semibold text-muted-foreground">
                  Last name
                </label>
                <Input
                  id="order-last-name"
                  name="lastName"
                  autoComplete="family-name"
                  placeholder="Last name…"
                  value={shipping.lastName}
                  onChange={(e) => setShipping((s) => ({ ...s, lastName: e.target.value }))}
                />
              </div>
              <div className="space-y-1">
                <label htmlFor="order-email" className="text-[11px] font-semibold text-muted-foreground">
                  Email
                </label>
                <Input
                  id="order-email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  placeholder="Email…"
                  value={shipping.email}
                  onChange={(e) => setShipping((s) => ({ ...s, email: e.target.value }))}
                />
              </div>
              <div className="space-y-1">
                <label htmlFor="order-phone" className="text-[11px] font-semibold text-muted-foreground">
                  Phone
                </label>
                <Input
                  id="order-phone"
                  name="phone"
                  type="tel"
                  autoComplete="tel"
                  placeholder="Phone…"
                  value={shipping.phone}
                  onChange={(e) => setShipping((s) => ({ ...s, phone: e.target.value }))}
                />
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-border bg-white/90 p-6 shadow-sm dark:bg-card">
            <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Delivery</h2>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <div className="space-y-1">
                <label htmlFor="order-address" className="text-[11px] font-semibold text-muted-foreground">
                  Address
                </label>
                <Input
                  id="order-address"
                  name="address"
                  autoComplete="street-address"
                  placeholder="Address…"
                  value={shipping.address}
                  onChange={(e) => setShipping((s) => ({ ...s, address: e.target.value }))}
                />
              </div>
              <div className="space-y-1">
                <label htmlFor="order-city" className="text-[11px] font-semibold text-muted-foreground">
                  City
                </label>
                <Input
                  id="order-city"
                  name="city"
                  autoComplete="address-level2"
                  placeholder="City…"
                  value={shipping.city}
                  onChange={(e) => setShipping((s) => ({ ...s, city: e.target.value }))}
                />
              </div>
              <div className="space-y-1">
                <label htmlFor="order-postal" className="text-[11px] font-semibold text-muted-foreground">
                  ZIP / Postal
                </label>
                <Input
                  id="order-postal"
                  name="postalCode"
                  autoComplete="postal-code"
                  placeholder="ZIP / Postal…"
                  value={shipping.zip}
                  onChange={(e) => setShipping((s) => ({ ...s, zip: e.target.value }))}
                />
              </div>
              <div className="space-y-1">
                <label htmlFor="order-country" className="text-[11px] font-semibold text-muted-foreground">
                  Country
                </label>
                <Input
                  id="order-country"
                  name="country"
                  autoComplete="country-name"
                  placeholder="Country…"
                  value={shipping.country}
                  onChange={(e) => setShipping((s) => ({ ...s, country: e.target.value }))}
                />
              </div>
              <div className="space-y-1">
                <label htmlFor="order-delivery-location" className="text-[11px] font-semibold text-muted-foreground">
                  Delivery location
                </label>
                <Input
                  id="order-delivery-location"
                  name="deliveryLocation"
                  autoComplete="address-line2"
                  placeholder="Delivery location…"
                  value={shipping.deliveryLocation}
                  onChange={(e) => setShipping((s) => ({ ...s, deliveryLocation: e.target.value }))}
                />
              </div>
              <div className="space-y-1">
                <label htmlFor="order-location-coordinates" className="text-[11px] font-semibold text-muted-foreground">
                  Location coordinates
                </label>
                <Input
                  id="order-location-coordinates"
                  name="locationCoordinates"
                  autoComplete="off"
                  placeholder="Location coordinates…"
                  value={shipping.locationCoordinates}
                  onChange={(e) => setShipping((s) => ({ ...s, locationCoordinates: e.target.value }))}
                />
              </div>
            </div>
            <div className="mt-4 flex items-center justify-between rounded-xl border border-border/60 bg-muted/30 p-3">
              <div>
                <p className="text-xs font-semibold text-muted-foreground">Delivery required</p>
                <p className="text-[11px] text-muted-foreground">Toggle for pickup or delivery</p>
              </div>
              <Switch checked={deliveryRequired} onCheckedChange={setDeliveryRequired} />
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <label htmlFor="order-delivery-provider" className="text-[11px] font-semibold text-muted-foreground">
                  Delivery provider
                </label>
                <Input
                  id="order-delivery-provider"
                  name="deliveryProvider"
                  autoComplete="off"
                  placeholder="Delivery provider…"
                  value={deliveryProvider}
                  onChange={(e) => setDeliveryProvider(e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <label htmlFor="order-delivery-note" className="text-[11px] font-semibold text-muted-foreground">
                  Delivery address note
                </label>
                <Input
                  id="order-delivery-note"
                  name="deliveryAddressNote"
                  autoComplete="off"
                  placeholder="Delivery address note…"
                  value={deliveryAddress}
                  onChange={(e) => setDeliveryAddress(e.target.value)}
                />
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-border bg-white/90 p-6 shadow-sm dark:bg-card">
            <div className="flex items-center justify-between">
              <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Products</h2>
              <Button type="button" variant="outline" size="sm" onClick={addRow}>
                <Plus className="mr-2 h-4 w-4" /> Add product
              </Button>
            </div>
            <div className="mt-4 space-y-4">
              {items.map((item, index) => {
                const product = item.productId ? productById.get(item.productId) : null;
                const availableColors = parseJsonArray(product?.colorOptions);
                const availableSizes = parseJsonArray(product?.sizeOptions);
                return (
                  <div key={`${item.productId}-${index}`} className="rounded-xl border border-border/60 p-4">
                    <div className="grid gap-4 md:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_auto]">
                      <div className="space-y-3">
                        <Select
                          value={item.productId}
                          onValueChange={(value) => {
                            const selected = productById.get(value);
                            updateItem(index, {
                              productId: value,
                              priceAtTime: Number(selected?.price ?? 0),
                              color: "",
                              size: "",
                            });
                          }}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select product" />
                          </SelectTrigger>
                          <SelectContent>
                            {products.map((p) => (
                              <SelectItem key={p.id} value={p.id}>
                                {p.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <div className="grid gap-3 sm:grid-cols-2">
                          <Select
                            value={item.color ?? ""}
                            onValueChange={(value) => updateItem(index, { color: value })}
                            disabled={!availableColors.length}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Color" />
                            </SelectTrigger>
                            <SelectContent>
                              {availableColors.map((color) => (
                                <SelectItem key={color} value={color}>
                                  {color}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <Select
                            value={item.size ?? ""}
                            onValueChange={(value) => updateItem(index, { size: value })}
                            disabled={!availableSizes.length}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Size" />
                            </SelectTrigger>
                            <SelectContent>
                              {availableSizes.map((size) => (
                                <SelectItem key={size} value={size}>
                                  {size}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                      <div className="space-y-3">
                        <PriceInput
                          aria-label="Item price"
                          min={0}
                          value={item.priceAtTime}
                          onChange={(val) => updateItem(index, { priceAtTime: val })}
                          placeholder="Price"
                        />
                        <Input
                          type="number"
                          min={1}
                          name={`items.${index}.quantity`}
                          inputMode="numeric"
                          autoComplete="off"
                          aria-label="Item quantity"
                          value={item.quantity}
                          onChange={(e) => updateItem(index, { quantity: Math.max(1, Number(e.target.value)) })}
                        />
                      </div>
                      <div className="flex items-center justify-end">
                        <Button
                          type="button"
                          variant="ghost"
                          onClick={() => removeRow(index)}
                          disabled={items.length === 1}
                          aria-label="Remove item"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                    {product?.imageUrl ? (
                      <div className="mt-4 flex items-center gap-3 text-xs text-muted-foreground">
                        <img src={product.imageUrl} alt="" className="h-10 w-10 rounded-md object-cover" />
                        <span>{product.name}</span>
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="rounded-2xl border border-border bg-white/90 p-6 shadow-sm dark:bg-card">
            <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Payment</h2>
            <div className="mt-4 space-y-3">
              <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                <SelectTrigger>
                  <SelectValue placeholder="Payment method" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="cash_on_delivery">Cash on delivery</SelectItem>
                  <SelectItem value="esewa">Esewa</SelectItem>
                  <SelectItem value="khalti">Khalti</SelectItem>
                  <SelectItem value="fonepay">Fonepay</SelectItem>
                  <SelectItem value="bank_transfer">Bank transfer</SelectItem>
                  <SelectItem value="stripe">Stripe</SelectItem>
                </SelectContent>
              </Select>
              <Select value={status ?? "pending"} onValueChange={(value) => setStatus(value as AdminCreateOrderInput["status"])}>
                <SelectTrigger>
                  <SelectValue placeholder="Order status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="processing">Processing</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                </SelectContent>
              </Select>
              <div className="rounded-xl border border-border/60 bg-muted/30 p-3">
                <p className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">Subtotal</p>
                <p className="mt-2 text-lg font-semibold text-foreground">{formatPrice(subtotal)}</p>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-border bg-white/90 p-6 shadow-sm dark:bg-card">
            <Button
              type="button"
              className="w-full"
              loading={mutation.isPending}
              loadingText="Creating..."
              onClick={handleSubmit}
            >
              Create Order
            </Button>
            <Button
              type="button"
              variant="outline"
              className="mt-3 w-full"
              onClick={() => setLocation("/admin/orders")}
            >
              Cancel
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
