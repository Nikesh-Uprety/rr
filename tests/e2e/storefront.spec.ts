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
  await expect(page.getByRole("link", { name: "Shop", exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Beyond Trends." })).toBeVisible();

  await openFirstProduct(page);
  await expect(page.getByTestId("product-add-to-bag")).toBeVisible({ timeout: 15_000 });
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
