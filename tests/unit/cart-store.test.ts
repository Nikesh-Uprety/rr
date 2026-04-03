import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Product } from "@/lib/mockData";
import { getOrCreateGuestId, initializeGuestCart, useCartStore } from "@/store/cart";

const { apiRequestMock } = vi.hoisted(() => ({
  apiRequestMock: vi.fn(() => Promise.resolve(new Response(null, { status: 204 }))),
}));

vi.mock("@/lib/queryClient", () => ({
  apiRequest: apiRequestMock,
}));

const product: Product = {
  id: "prod-1",
  name: "Test Hoodie",
  sku: "SKU-1",
  price: 3200,
  stock: 5,
  category: "hoodies",
  images: ["/hoodie.webp"],
  variants: [{ size: "M", color: "Black" }],
};

describe("useCartStore", () => {
  beforeEach(() => {
    localStorage.clear();
    document.cookie = "ra_guest_id=; Max-Age=0; Path=/";
    useCartStore.setState({ items: [], hasHydrated: false });
    apiRequestMock.mockClear();
    apiRequestMock.mockImplementation((method) => {
      if (method === "GET") {
        return Promise.resolve(
          new Response(JSON.stringify({ success: true, found: false, items: [] }), { status: 200 }),
        );
      }
      return Promise.resolve(new Response(JSON.stringify({ success: true }), { status: 200 }));
    });
  });

  it("adds a new item and computes subtotal", async () => {
    useCartStore.getState().addItem(product, { size: "M", color: "Black" }, 2);

    expect(useCartStore.getState().items).toHaveLength(1);
    expect(useCartStore.getState().items[0]).toMatchObject({
      id: "prod-1-M-Black",
      quantity: 2,
    });
    const subtotal = useCartStore
      .getState()
      .items.reduce((total, item) => total + item.product.price * item.quantity, 0);
    expect(subtotal).toBe(6400);
    expect(apiRequestMock).toHaveBeenCalledWith(
      "POST",
      "/api/cart/guest/sync",
      expect.objectContaining({
        guestId: expect.any(String),
        items: expect.arrayContaining([
          expect.objectContaining({
            id: "prod-1-M-Black",
            quantity: 2,
          }),
        ]),
      }),
    );
    expect(apiRequestMock).toHaveBeenCalledWith(
      "POST",
      "/api/user-activity/cart",
      expect.objectContaining({
        action: "add",
        productName: "Test Hoodie",
        quantity: 2,
      }),
    );
  });

  it("merges duplicate variants into the same cart line", () => {
    const store = useCartStore.getState();

    store.addItem(product, { size: "M", color: "Black" }, 1);
    store.addItem(product, { size: "M", color: "Black" }, 3);

    expect(useCartStore.getState().items).toHaveLength(1);
    expect(useCartStore.getState().items[0]?.quantity).toBe(4);
  });

  it("clamps quantity updates to a minimum of one", () => {
    const store = useCartStore.getState();

    store.addItem(product, { size: "M", color: "Black" }, 2);
    store.updateQuantity("prod-1-M-Black", 0);

    expect(useCartStore.getState().items[0]?.quantity).toBe(1);
  });

  it("removes items and clears the cart", () => {
    const store = useCartStore.getState();

    store.addItem(product, { size: "M", color: "Black" }, 1);
    store.removeItem("prod-1-M-Black");

    expect(useCartStore.getState().items).toHaveLength(0);

    store.addItem(product, { size: "M", color: "Black" }, 1);
    store.clearCart();

    expect(useCartStore.getState().items).toHaveLength(0);
  });

  it("swallows cart activity notification failures", async () => {
    apiRequestMock.mockRejectedValueOnce(new Error("network down"));

    expect(() => {
      useCartStore.getState().addItem(product, { size: "M", color: "Black" }, 1);
    }).not.toThrow();

    await Promise.resolve();
  });

  it("creates and reuses a stable guest id", () => {
    const firstGuestId = getOrCreateGuestId();
    const secondGuestId = getOrCreateGuestId();

    expect(firstGuestId).toBeTruthy();
    expect(secondGuestId).toBe(firstGuestId);
    expect(localStorage.getItem("ra-guest-id")).toBe(firstGuestId);
    expect(document.cookie).toContain(`ra_guest_id=${firstGuestId}`);
  });

  it("restores the guest id from the cookie when local storage is empty", () => {
    document.cookie = "ra_guest_id=guest-cookie-id; Path=/";

    const restoredGuestId = getOrCreateGuestId();

    expect(restoredGuestId).toBe("guest-cookie-id");
    expect(localStorage.getItem("ra-guest-id")).toBe("guest-cookie-id");
  });

  it("hydrates from the server cart on load", async () => {
    const guestId = getOrCreateGuestId();
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            success: true,
            found: true,
            items: [
              {
                id: "prod-1-M-Black",
                product,
                variant: { size: "M", color: "Black" },
                quantity: 3,
              },
            ],
          }),
          { status: 200 },
        ),
      );

    await initializeGuestCart();

    expect(fetchMock).toHaveBeenCalledWith(`/api/cart/guest/${guestId}`, expect.objectContaining({
      method: "GET",
      cache: "no-store",
    }));
    expect(useCartStore.getState().hasHydrated).toBe(true);
    expect(useCartStore.getState().items[0]?.quantity).toBe(3);
    fetchMock.mockRestore();
  });

  it("falls back to local storage when redis cart is empty", async () => {
    getOrCreateGuestId();
    localStorage.setItem(
      "ra-guest-cart-items",
      JSON.stringify([
        {
          id: "prod-1-M-Black",
          product,
          variant: { size: "M", color: "Black" },
          quantity: 2,
        },
      ]),
    );

    await initializeGuestCart();

    expect(useCartStore.getState().hasHydrated).toBe(true);
    expect(useCartStore.getState().items[0]?.quantity).toBe(2);
    expect(apiRequestMock).toHaveBeenCalledWith(
      "POST",
      "/api/cart/guest/sync",
      expect.objectContaining({
        items: expect.arrayContaining([expect.objectContaining({ quantity: 2 })]),
      }),
    );
  });
});
