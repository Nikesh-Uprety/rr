import { test, expect } from "@playwright/test";

const adminPages = [
  { path: "/admin", heading: "Dashboard" },
  { path: "/admin/customers", heading: "Customers" },
  { path: "/admin/bills", heading: "Bills" },
  { path: "/admin/promo-codes", heading: "Promo Codes" },
  { path: "/admin/marketing", heading: "Marketing" },
  { path: "/admin/notifications", heading: "Notifications" },
  { path: "/admin/profile", heading: "Profile" },
];

for (const adminPage of adminPages) {
  test(`admin page smoke: ${adminPage.path}`, async ({ page }) => {
    await page.goto(adminPage.path);
    if (adminPage.path === "/admin/marketing") {
      await expect(page.getByRole("heading", { name: adminPage.heading })).toBeVisible({ timeout: 15_000 });
      return;
    }

    await expect(page.getByRole("heading", { name: adminPage.heading })).toBeVisible();
  });
}
