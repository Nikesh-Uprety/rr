import { describe, expect, it } from "vitest";
import {
  canAccessAdminPage,
  canAccessAdminPanel,
  getAdminAllowedPages,
  requiresTwoFactorChallenge,
} from "@shared/auth-policy";

describe("auth policy", () => {
  it("allows the intended admin panel roles", () => {
    expect(canAccessAdminPanel("admin")).toBe(true);
    expect(canAccessAdminPanel("owner")).toBe(true);
    expect(canAccessAdminPanel("manager")).toBe(true);
    expect(canAccessAdminPanel("staff")).toBe(true);
    expect(canAccessAdminPanel("csr")).toBe(true);
    expect(canAccessAdminPanel("sales")).toBe(true);
    expect(canAccessAdminPanel("marketing")).toBe(true);
    expect(canAccessAdminPanel("cook")).toBe(true);
    expect(canAccessAdminPanel("ADMIN")).toBe(true);
    expect(canAccessAdminPanel("customer")).toBe(false);
    expect(canAccessAdminPanel(undefined)).toBe(false);
  });

  it("enforces the admin page matrix per role", () => {
    expect(canAccessAdminPage("owner", "analytics")).toBe(true);
    expect(canAccessAdminPage("admin", "store-users")).toBe(true);
    expect(canAccessAdminPage("manager", "marketing")).toBe(true);
    expect(canAccessAdminPage("manager", "analytics")).toBe(false);
    expect(canAccessAdminPage("staff", "pos")).toBe(true);
    expect(canAccessAdminPage("staff", "marketing")).toBe(false);
    expect(canAccessAdminPage("csr", "customers")).toBe(true);
    expect(canAccessAdminPage("csr", "products")).toBe(false);
    expect(canAccessAdminPage("sales", "orders")).toBe(true);
    expect(canAccessAdminPage("marketing", "analytics")).toBe(true);
    expect(canAccessAdminPage("cook", "orders")).toBe(true);
    expect(getAdminAllowedPages("csr")).toEqual([
      "dashboard",
      "profile",
      "messages",
      "notifications",
      "orders",
      "customers",
      "bills",
    ]);
  });

  it("does not allow page overrides to escalate restricted roles", () => {
    expect(getAdminAllowedPages("staff", ["store-users", "marketing"]).includes("store-users")).toBe(false);
    expect(getAdminAllowedPages("staff", ["marketing"]).includes("marketing")).toBe(true);
    expect(getAdminAllowedPages("admin", ["store-users"]).includes("store-users")).toBe(true);
    expect(getAdminAllowedPages("customer", ["dashboard"]).length).toBe(0);
  });

  it("requires a two-factor challenge for first-time setup or enabled 2FA", () => {
    expect(requiresTwoFactorChallenge({ twoFactorEnabled: true, requires2FASetup: false })).toBe(true);
    expect(requiresTwoFactorChallenge({ twoFactorEnabled: false, requires2FASetup: true })).toBe(true);
    expect(requiresTwoFactorChallenge({ twoFactorEnabled: 1, requires2FASetup: false })).toBe(true);
    expect(requiresTwoFactorChallenge({ twoFactorEnabled: 0, requires2FASetup: false })).toBe(false);
  });
});
