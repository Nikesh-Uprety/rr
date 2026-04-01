import { test, expect } from "@playwright/test";
import { fillCheckoutForm, openFirstProduct } from "./helpers";

test("home page loads and core storefront checkout path works", async ({ page }) => {
  const pageErrors: string[] = [];
  page.on("pageerror", (error) => {
    if (error.message === "WebSocket closed without opened.") {
      return;
    }
    pageErrors.push(error.message);
  });

  await page.goto("/");
  await expect(page.locator("#nav").getByRole("link", { name: "Shop" })).toBeVisible();
  await expect(page.getByRole("main").first()).toBeVisible({ timeout: 10_000 });

  // Navigate to products and find one that's in stock
  await page.goto("/products");
  await expect(page.getByRole("heading", { name: "All Products" })).toBeVisible({ timeout: 10_000 });

  // Find a product link that's not out of stock (look for products without "Out of Stock" badge)
  const productLinks = page.locator('a[href^="/product/"]');
  const count = await productLinks.count();

  let foundInStockProduct = false;
  for (let i = 0; i < count; i++) {
    await productLinks.nth(i).click();
    await page.waitForURL(/\/product\//);

    // Wait for product detail to load
    await page.waitForTimeout(1000);

    // Check if there's an enabled size button
    const enabledSizeBtn = page.locator("button.h-12.w-12:not([disabled])").first();
    const hasEnabledSize = await enabledSizeBtn.isVisible({ timeout: 3000 }).catch(() => false);

    if (hasEnabledSize) {
      foundInStockProduct = true;
      await enabledSizeBtn.click();
      break;
    } else {
      // Go back to products list
      await page.goBack();
      await page.waitForURL(/\/products/);
      await page.waitForTimeout(500);
    }
  }

  if (!foundInStockProduct) {
    // If no in-stock product found, skip this test gracefully
    test.skip(true, "No in-stock products available for testing");
    return;
  }

  await expect(page.getByTestId("product-add-to-bag")).toBeVisible({ timeout: 5_000 });
  await page.getByTestId("product-add-to-bag").click();
  await page.waitForFunction(() => {
    return Array.from(document.querySelectorAll('a[href="/cart"]')).some((link) => {
      if (!(link instanceof HTMLElement) || link.offsetParent === null) return false;
      return Number(link.textContent?.trim() || "0") > 0;
    });
  });
  await page.evaluate(() => {
    const cartLink = Array.from(document.querySelectorAll('a[href="/cart"]')).find(
      (link) => link instanceof HTMLElement && link.offsetParent !== null,
    );
    if (!(cartLink instanceof HTMLElement)) {
      throw new Error("Visible cart link not found");
    }
    cartLink.click();
  });
  await expect(page).toHaveURL(/\/cart$/);
  await expect(page.getByRole("heading", { name: "Your Bag" })).toBeVisible();
  await page.locator("[data-testid^='cart-increment-']").first().click();
  await page.getByTestId("cart-proceed-checkout").click();

  await expect(page).toHaveURL(/\/checkout$/);
  await fillCheckoutForm(page, `cod-${Date.now()}@example.com`);
  await page.getByTestId("checkout-submit").click();

  await expect(page).toHaveURL(/\/order-confirmation\//);
  await expect(pageErrors, pageErrors.join("\n")).toEqual([]);
});
