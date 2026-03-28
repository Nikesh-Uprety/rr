import { test, expect } from "@playwright/test";
import { pickSelectItem, placeOnlineOrder } from "./helpers";

test("admin can verify payment and manage a product", async ({ browser, page }) => {
  test.setTimeout(90_000);

  const uniqueEmail = `payment-${Date.now()}@example.com`;
  const guestContext = await browser.newContext();
  const guestPage = await guestContext.newPage();
  const orderId = await placeOnlineOrder(guestPage, uniqueEmail);
  await guestContext.close();

  await page.goto("/admin/orders");
  await expect(page.getByRole("heading", { name: "Orders" })).toBeVisible();
  await page.getByTestId("admin-orders-search").fill(uniqueEmail);
  await page.getByTestId(`admin-order-row-${orderId}`).click();
  await expect(page.getByTestId("admin-order-status-select")).toBeVisible();
  await expect(page.getByText("View screenshot")).toBeVisible();
  await page.getByTestId("admin-order-verify-payment").click();
  await expect(page.getByText("verified")).toBeVisible();
  await pickSelectItem(page.getByTestId("admin-order-status-select"), "✅ Completed");
  await expect(page.getByTestId("admin-order-status-select")).toContainText("Completed");

  const productName = `E2E Product ${Date.now()}`;

  await page.goto("/admin/products");
  await expect(page.getByRole("button", { name: "Add Product" })).toBeVisible({ timeout: 15_000 });
  await page.getByRole("button", { name: "Add Product" }).click();
  await page.getByTestId("admin-product-name").fill(productName);
  await page.getByTestId("admin-product-short-details").fill("End-to-end test product");
  await page.getByTestId("admin-product-price").fill("2500");
  await page.getByTestId("admin-product-stock").fill("8");
  await page.getByTestId("admin-product-save").click();

  await page.getByTestId("admin-products-search").fill(productName);
  await expect(page.getByText(productName).first()).toBeVisible();
  await page.locator("[data-testid^='admin-product-edit-open-']").first().click();
  await page.getByTestId("admin-product-edit-category").click();
  await page.getByRole("option").first().click();
  await page.getByTestId("admin-product-edit-short-details").fill("Updated end-to-end test product");
  await page.getByTestId("admin-product-edit-save").click();
  await expect(page.getByTestId("admin-product-edit-save")).toHaveCount(0);
  await page.getByTestId("admin-products-search").fill(productName);
  await expect(page.getByText(productName).first()).toBeVisible();
  await page.locator("[data-testid^='admin-product-edit-open-']").first().click();
  await page.getByTestId("admin-product-delete").click();
  await page.getByRole("button", { name: "Delete" }).click();
  await page.getByTestId("admin-products-search").fill(productName);
  await expect(page.getByText(productName)).toHaveCount(0);
});
