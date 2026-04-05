import { test, expect } from "@playwright/test";

async function gotoProfile(page: import("@playwright/test").Page) {
  await page.goto("/admin/profile");
  await expect(page.getByRole("heading", { name: "Profile" })).toBeVisible();
  await expect(page.getByTestId("profile-stat-orders")).toBeVisible();
}

test("1. loads /profile and renders hero stats", async ({ page }) => {
  await gotoProfile(page);
  await expect(page.getByTestId("profile-stat-orders")).toContainText(/\d+/);
  await expect(page.getByTestId("profile-stat-products")).toContainText(/\d+/);
  await expect(page.getByTestId("profile-stat-actions")).toContainText(/\d+/);
});

test("2. edit first and last name, save, and show success toast", async ({ page }) => {
  await gotoProfile(page);

  const patchPromise = page.waitForResponse(
    (response) => response.url().includes("/api/admin/profile") && response.request().method() === "PATCH",
  );

  await page.getByTestId("profile-first-name-input").fill(`Nikesh${Date.now().toString().slice(-4)}`);
  await page.getByTestId("profile-last-name-input").fill("Uprety");
  await page.getByTestId("profile-save").click();

  const patchResponse = await patchPromise;
  expect(patchResponse.ok(), await patchResponse.text()).toBeTruthy();
  await expect(page.getByText("Profile saved")).toBeVisible();
});

test("3. password mismatch shows inline error and blocks API call", async ({ page }) => {
  await gotoProfile(page);

  let apiCallCount = 0;
  await page.route("**/api/admin/change-password", async (route) => {
    apiCallCount += 1;
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ success: true }) });
  });

  await page.getByTestId("profile-password-current").fill("old-pass");
  await page.getByTestId("profile-password-new").fill("newpassword123");
  await page.getByTestId("profile-password-confirm").fill("does-not-match");
  await page.getByTestId("profile-password-save").click();

  await expect(page.getByTestId("profile-password-error")).toContainText("does not match");
  expect(apiCallCount).toBe(0);
});

test("4. valid password calls API and shows success toast", async ({ page }) => {
  await gotoProfile(page);

  let apiCalled = false;
  await page.route("**/api/admin/change-password", async (route) => {
    apiCalled = true;
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ success: true }) });
  });

  await page.getByTestId("profile-password-current").fill("old-pass");
  await page.getByTestId("profile-password-new").fill("newpassword123");
  await page.getByTestId("profile-password-confirm").fill("newpassword123");
  await page.getByTestId("profile-password-save").click();

  await expect(page.getByText("Password changed")).toBeVisible();
  expect(apiCalled).toBeTruthy();
});

test("5. notification toggle persists after reload", async ({ page }) => {
  await gotoProfile(page);

  const target = page.getByTestId("profile-notification-newOrders");
  const before = await target.getAttribute("aria-checked");
  await target.click();

  const patchPromise = page.waitForResponse(
    (response) => response.url().includes("/api/admin/profile") && response.request().method() === "PATCH",
  );
  await page.getByTestId("profile-save").click();
  await patchPromise;

  await page.reload();
  await expect(page.getByTestId("profile-notification-newOrders")).toBeVisible();
  const after = await page.getByTestId("profile-notification-newOrders").getAttribute("aria-checked");
  expect(after).not.toBe(before);
});

test("6. revoke all other sessions with confirmation", async ({ page }) => {
  await gotoProfile(page);

  const deletePromise = page.waitForResponse(
    (response) => response.url().includes("/api/admin/sessions") && response.request().method() === "DELETE",
  );

  await page.getByTestId("profile-revoke-others").click();
  await page.getByTestId("profile-revoke-confirm").click();

  const deleteResponse = await deletePromise;
  expect(deleteResponse.ok(), await deleteResponse.text()).toBeTruthy();
  await expect(page.getByText("Other sessions revoked")).toBeVisible();
});

test("7. deactivate account cancel does nothing", async ({ page }) => {
  await gotoProfile(page);

  let deactivateCalls = 0;
  await page.route("**/api/admin/profile/deactivate", async (route) => {
    deactivateCalls += 1;
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ success: true }) });
  });

  await page.getByTestId("profile-danger-deactivate").click();
  await page.getByTestId("profile-danger-cancel").click();
  await expect(page.getByText("Confirm action")).toHaveCount(0);
  expect(deactivateCalls).toBe(0);
});

test("8. avatar upload calls API and updates avatar src", async ({ page }) => {
  let uploaded = false;
  let useMockAvatar = false;

  await page.route("**/api/admin/profile/upload-avatar", async (route) => {
    uploaded = true;
    useMockAvatar = true;
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ success: true, url: "/uploads/avatars/test-avatar.webp" }),
    });
  });

  await page.route("**/api/admin/profile/overview", async (route) => {
    const response = await route.fetch();
    const json = (await response.json()) as { success: boolean; data: any };
    if (useMockAvatar && json?.data?.profile) {
      json.data.profile.avatarUrl = "/uploads/avatars/test-avatar.webp";
    }
    await route.fulfill({ response, body: JSON.stringify(json), contentType: "application/json" });
  });

  await gotoProfile(page);

  await page.getByTestId("profile-avatar-input").setInputFiles({
    name: "avatar.png",
    mimeType: "image/png",
    buffer: Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wn4s1sAAAAASUVORK5CYII=",
      "base64",
    ),
  });

  await expect.poll(() => uploaded).toBeTruthy();
  await page.reload();
  await expect(page.getByTestId("profile-avatar-image")).toHaveAttribute("src", /test-avatar\.webp/);
});

test("9. saving with empty required email shows validation error", async ({ page }) => {
  await gotoProfile(page);

  await page.getByTestId("profile-email-input").fill("");
  await page.getByTestId("profile-save").click();
  await expect(page.getByText("Email is required")).toBeVisible();
});

test("10. permissions grid shows role modules as read-only", async ({ page }) => {
  await gotoProfile(page);

  const grid = page.getByTestId("profile-permissions-grid");
  await expect(grid).toBeVisible();
  const permissionItems = page.locator("[data-testid^='profile-permission-']");
  expect(await permissionItems.count()).toBeGreaterThan(5);
  await expect(page.getByText("Read-only scope mapping").first()).toBeVisible();
});
