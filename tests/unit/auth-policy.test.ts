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
    expect(getAdminAllowedPages("csr")).toEqual([
      "dashboard",
      "profile",
      "notifications",
      "orders",
      "customers",
      "bills",
    ]);
  });

  it("requires a two-factor challenge for first-time setup or enabled 2FA", () => {
    expect(requiresTwoFactorChallenge({ twoFactorEnabled: true, requires2FASetup: false })).toBe(true);
    expect(requiresTwoFactorChallenge({ twoFactorEnabled: false, requires2FASetup: true })).toBe(true);
    expect(requiresTwoFactorChallenge({ twoFactorEnabled: 1, requires2FASetup: false })).toBe(true);
    expect(requiresTwoFactorChallenge({ twoFactorEnabled: 0, requires2FASetup: false })).toBe(false);
  });
});
