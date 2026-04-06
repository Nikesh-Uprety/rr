import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { StatusBadge, StockInSheet } from "../../client/src/pages/admin/inventoryComponents";
import { groupMovementsByDate } from "../../client/src/pages/admin/inventoryUtils";
import type {
  InventoryListItem,
  InventoryMovement,
} from "../../client/src/pages/admin/inventoryTypes";

const sampleProducts: InventoryListItem[] = [
  {
    id: "p1:v1",
    productId: "p1",
    variantId: 1,
    name: "Choco Truffle Cake",
    thumbnail: null,
    batch: 1,
    outlet: "Main Outlet",
    channel: "Website",
    status: "low_stock",
    units: 3,
    avgCost: 500,
    totalValue: 1500,
    variant: "Standard",
    sku: "RR-P1",
    category: "Cake",
    currentQty: 3,
    size: "M",
  },
  {
    id: "p2:v2",
    productId: "p2",
    variantId: 2,
    name: "Red Velvet Cake",
    thumbnail: null,
    batch: 1,
    outlet: "Main Outlet",
    channel: "POS",
    status: "in_stock",
    units: 20,
    avgCost: 300,
    totalValue: 6000,
    variant: "Standard",
    sku: "RR-P2",
    category: "Cake",
    currentQty: 20,
    size: "L",
  },
];

describe("StatusBadge", () => {
  it("renders labels for every inventory status", () => {
    render(
      <div>
        <StatusBadge status="in_stock" />
        <StatusBadge status="low_stock" />
        <StatusBadge status="out_of_stock" />
      </div>,
    );

    expect(screen.getByText("In stock")).toBeInTheDocument();
    expect(screen.getByText("Low stock")).toBeInTheDocument();
    expect(screen.getByText("Out of stock")).toBeInTheDocument();
  });
});

describe("StockInSheet", () => {
  it("auto-selects, increments, decrements, and confirms selections", async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();

    Object.defineProperty(window, "matchMedia", {
      writable: true,
      value: vi.fn().mockImplementation((query: string) => ({
        matches: query.includes("max-width") ? false : false,
        media: query,
        onchange: null,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        addListener: vi.fn(),
        removeListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    });

    render(
      <StockInSheet
        isOpen
        products={sampleProducts}
        onConfirm={onConfirm}
        onClose={vi.fn()}
      />,
    );

    await user.click(screen.getByLabelText("Select Choco Truffle Cake"));
    expect(screen.getByText("1 products selected · Qty: 1")).toBeInTheDocument();

    await user.click(screen.getByLabelText("Increase Choco Truffle Cake"));
    expect(screen.getByText("1 products selected · Qty: 2")).toBeInTheDocument();

    await user.click(screen.getByLabelText("Decrease Choco Truffle Cake"));
    await user.click(screen.getByLabelText("Decrease Choco Truffle Cake"));
    expect(screen.getByText("0 products selected · Qty: 0")).toBeInTheDocument();

    await user.click(screen.getByLabelText("Select Choco Truffle Cake"));
    await user.click(screen.getByRole("button", { name: "Confirm stock in" }));

    expect(onConfirm).toHaveBeenCalledWith([
      {
        id: "p1:v1",
        productId: "p1",
        variantId: 1,
        qty: 1,
      },
    ]);
  });
});

describe("groupMovementsByDate", () => {
  it("groups movement cards under shared date labels", () => {
    const movements: InventoryMovement[] = [
      {
        id: "m1",
        occurredAt: "2026-03-16T06:55:00.000Z",
        outlet: "Main Outlet",
        ref: "ORD-1",
        type: "stock_out",
        quantity: 2,
        value: 400,
        skuCount: 1,
        channel: "Website",
      },
      {
        id: "m2",
        occurredAt: "2026-03-16T08:15:00.000Z",
        outlet: "Main Outlet",
        ref: "ORD-2",
        type: "stock_in",
        quantity: 5,
        value: 1000,
        skuCount: 2,
        channel: "Admin",
      },
      {
        id: "m3",
        occurredAt: "2026-03-15T08:15:00.000Z",
        outlet: "Main Outlet",
        ref: "ORD-3",
        type: "stock_out",
        quantity: 1,
        value: 200,
        skuCount: 1,
        channel: "Website",
      },
    ];

    const grouped = groupMovementsByDate(movements);

    expect(grouped).toHaveLength(2);
    expect(grouped[0].items).toHaveLength(2);
    expect(grouped[1].items).toHaveLength(1);
  });
});
