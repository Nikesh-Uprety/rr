import type { ReactNode } from "react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import Checkout from "@/pages/storefront/Checkout";
import { renderWithProviders } from "./test-utils";

const setLocationMock = vi.fn();
const clearCartMock = vi.fn();
const toastMock = vi.fn();
const mockCartState = {
  items: [
    {
      id: "prod-1-M-Black",
      product: {
        id: "prod-1",
        name: "Test Hoodie",
        price: 3200,
        stock: 5,
        category: "hoodies",
        sku: "SKU-1",
        images: ["/hoodie.webp"],
        variants: [{ size: "M", color: "Black" }],
      },
      variant: { size: "M", color: "Black" },
      quantity: 1,
    },
  ],
  clearCart: clearCartMock,
};

const createOrderMock = vi.fn();
const validatePromoCodeMock = vi.fn();
const cacheLatestOrderMock = vi.fn();
const cachePendingCheckoutMock = vi.fn();
const clearPendingCheckoutMock = vi.fn();
const useCartStoreMock = vi.fn(() => mockCartState);

vi.mock("wouter", () => ({
  Link: ({ href, children }: { href: string; children: ReactNode }) => <a href={href}>{children}</a>,
  useLocation: () => ["/checkout", setLocationMock],
}));

vi.mock("@/store/cart", () => ({
  useCartStore: () => useCartStoreMock(),
}));

vi.mock("@/hooks/use-toast", () => ({
  useToast: () => ({ toast: toastMock }),
}));

vi.mock("@/lib/api", () => ({
  createOrder: (...args: unknown[]) => createOrderMock(...args),
  validatePromoCode: (...args: unknown[]) => validatePromoCodeMock(...args),
  cacheLatestOrder: (...args: unknown[]) => cacheLatestOrderMock(...args),
  cachePendingCheckout: (...args: unknown[]) => cachePendingCheckoutMock(...args),
  clearPendingCheckout: (...args: unknown[]) => clearPendingCheckoutMock(...args),
}));

const SAVED_FORM_DATA = {
  email: "buyer@example.com",
  firstName: "Nikesh",
  lastName: "Uprety",
  address: "Lazimpat",
  city: "Kathmandu",
  phone: "9800000000",
  paymentMethod: "cash_on_delivery",
  deliveryLocation: "Kathmandu Inside Ring Road",
  deliveryProvider: "pathao",
  deliveryAddress: "",
  deliveryRequired: true,
};

describe("Checkout", () => {
  beforeEach(() => {
    setLocationMock.mockReset();
    clearCartMock.mockReset();
    toastMock.mockReset();
    createOrderMock.mockReset();
    validatePromoCodeMock.mockReset();
    cacheLatestOrderMock.mockReset();
    cachePendingCheckoutMock.mockReset();
    clearPendingCheckoutMock.mockReset();
    useCartStoreMock.mockImplementation(() => mockCartState);
    localStorage.clear();
    vi.restoreAllMocks();
    Object.defineProperty(window, "location", {
      value: new URL("http://localhost/?returning=1"),
      writable: true,
    });
  });

  it("redirects back to cart when no cart items are present", () => {
    useCartStoreMock.mockImplementation(() => ({ items: [], clearCart: clearCartMock }));

    renderWithProviders(<Checkout />);

    expect(setLocationMock).toHaveBeenCalledWith("/cart");
  });

  it("blocks submission when required fields are missing", async () => {
    const user = userEvent.setup();

    renderWithProviders(<Checkout />);
    await user.click(screen.getByTestId("checkout-submit"));

    expect(await screen.findByText("Please fill in all required fields.")).toBeInTheDocument();
    expect(createOrderMock).not.toHaveBeenCalled();
  });

  it("applies promo codes and shows success feedback", async () => {
    const user = userEvent.setup();
    validatePromoCodeMock.mockResolvedValueOnce({
      valid: true,
      data: { id: "promo-1", code: "RARE10", discountPct: 10 },
    });

    renderWithProviders(<Checkout />);

    await user.type(screen.getByTestId("checkout-promo-input"), "rare10");
    await user.click(screen.getByTestId("checkout-apply-promo"));

    await waitFor(() => {
      expect(validatePromoCodeMock).toHaveBeenCalledWith("RARE10", ["prod-1"]);
    });
    expect(toastMock).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "Promo code applied!",
      }),
    );
  });

  it("creates a cash-on-delivery order and routes to confirmation", async () => {
    const user = userEvent.setup();
    createOrderMock.mockResolvedValueOnce({
      success: true,
      data: {
        orderNumber: "ORD-1",
        total: 3300,
        order: { id: "order-1" },
      },
    });

    localStorage.setItem("ra-checkout-form-data", JSON.stringify(SAVED_FORM_DATA));
    renderWithProviders(<Checkout />);

    await user.click(screen.getByTestId("checkout-submit"));

    await waitFor(() => {
      expect(createOrderMock).toHaveBeenCalled();
      expect(cacheLatestOrderMock).toHaveBeenCalledWith({ id: "order-1" });
      expect(clearPendingCheckoutMock).toHaveBeenCalled();
      expect(clearCartMock).toHaveBeenCalled();
      expect(setLocationMock).toHaveBeenCalledWith("/order-confirmation/order-1");
    });
  });

  it("routes online payment orders to the payment page without creating order", async () => {
    const user = userEvent.setup();

    const esewaData = { ...SAVED_FORM_DATA, paymentMethod: "esewa" };
    localStorage.setItem("ra-checkout-form-data", JSON.stringify(esewaData));
    renderWithProviders(<Checkout />);

    await user.click(screen.getByTestId("checkout-payment-esewa"));
    await user.click(screen.getByTestId("checkout-submit"));

    await waitFor(() => {
      expect(createOrderMock).not.toHaveBeenCalled();
      expect(cachePendingCheckoutMock).toHaveBeenCalled();
      expect(setLocationMock).toHaveBeenCalledWith("/checkout/payment?method=esewa");
    });
  });
});
