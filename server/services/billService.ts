import { db } from "../db";
import { bills, orders, orderItems, products } from "../../shared/schema";
import { eq, sql } from "drizzle-orm";
import type { Bill } from "../../shared/schema";

// Generates next bill number: RARE-INV-000123
async function generateBillNumber(): Promise<string> {
  const result = await db.execute(
    sql`SELECT COUNT(*) as count FROM bills`
  );
  const count = parseInt((result.rows[0] as any).count, 10) + 1;
  return `RARE-INV-${String(count).padStart(6, "0")}`;
}

// Auto-called when order status changes to "completed"
export async function generateBillFromOrder(
  orderId: string,
  processedById: string,
  processedByName: string
): Promise<Bill> {
  // Fetch order with all items
  const [order] = await db
    .select({
      id: orders.id,
      userId: orders.userId,
      email: orders.email,
      fullName: orders.fullName,
      total: orders.total,
      paymentMethod: orders.paymentMethod,
    })
    .from(orders)
    .where(eq(orders.id, orderId))
    .limit(1);

  if (!order) throw new Error(`Order ${orderId} not found`);

  // Check if bill already exists for this order
  const [existing] = await db
    .select()
    .from(bills)
    .where(eq(bills.orderId, orderId))
    .limit(1);

  if (existing) return existing;

  // Fetch order items
  const items = await db
    .select()
    .from(orderItems)
    .where(eq(orderItems.orderId, orderId));

  // Build bill items from order items
  const billItems = await Promise.all(
    items.map(async (item) => {
      const [product] = await db
        .select()
        .from(products)
        .where(eq(products.id, item.productId))
        .limit(1);

      return {
        productId: item.productId,
        productName: product?.name ?? "Unknown Product",
        variantColor: "",
        size: "",
        sku: "",
        quantity: item.quantity,
        unitPrice: Number(item.unitPrice),
        lineTotal: item.quantity * Number(item.unitPrice),
      };
    })
  );

  const subtotal = billItems.reduce((s, i) => s + i.lineTotal, 0);
  const taxRate = 13;
  const taxAmount = Math.round(subtotal * 0.13);
  const totalAmount = Number(order.total);
  const discountAmount = Math.max(0, subtotal + taxAmount - totalAmount);

  const customerName = order.fullName || "Walk-in Customer";

  const billNumber = await generateBillNumber();

  const [newBill] = await db.insert(bills).values({
    id: crypto.randomUUID(),
    billNumber,
    orderId,
    customerId: order.userId ?? null,
    customerName,
    customerEmail: order.email ?? null,
    customerPhone: null,
    items: billItems,
    subtotal: String(subtotal),
    taxRate: String(taxRate),
    taxAmount: String(taxAmount),
    discountAmount: String(discountAmount),
    totalAmount: String(totalAmount),
    paymentMethod: order.paymentMethod ?? "card",
    processedBy: processedByName,
    processedById,
    billType: "sale",
    status: "issued",
  }).returning();

  return newBill;
}

export { generateBillNumber };
