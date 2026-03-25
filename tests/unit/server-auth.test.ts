import bcrypt from "bcryptjs";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { storageMock } = vi.hoisted(() => ({
  storageMock: {
    getUserByEmail: vi.fn(),
    getUserById: vi.fn(),
  },
}));

vi.mock("../../server/storage", () => ({
  storage: storageMock,
}));

import { configurePassport, passport } from "../../server/auth";

type VerifyResult = {
  user: false | Express.User;
  info?: { message?: string; field?: "email" | "password" };
};

async function verifyCredentials(email: string, password: string): Promise<VerifyResult> {
  const strategy = (passport as any)._strategy("local");

  return await new Promise((resolve, reject) => {
    strategy._verify(
      email,
      password,
      (
        err: Error | null,
        user: false | Express.User,
        info?: { message?: string; field?: "email" | "password" },
      ) => {
        if (err) {
          reject(err);
          return;
        }

        resolve({ user, info });
      },
    );
  });
}

describe("passport local strategy", () => {
  beforeEach(() => {
    storageMock.getUserByEmail.mockReset();
    storageMock.getUserById.mockReset();
    configurePassport();
  });

  it("authenticates against a bcrypt hash and carries the role and setup flags", async () => {
    storageMock.getUserByEmail.mockResolvedValueOnce({
      id: "user-1",
      username: "staff@example.com",
      password: await bcrypt.hash("Secret123", 10),
      role: "staff",
      displayName: "Staff User",
      profileImageUrl: null,
      requires2FASetup: true,
      emailNotifications: true,
      twoFactorEnabled: 0,
      lastLoginAt: null,
      createdAt: new Date(),
      status: "active",
    });

    const result = await verifyCredentials("staff@example.com", "Secret123");

    expect(storageMock.getUserByEmail).toHaveBeenCalledWith("staff@example.com");
    expect(result.user).toMatchObject({
      id: "user-1",
      email: "staff@example.com",
      role: "staff",
      name: "Staff User",
      requires2FASetup: true,
      twoFactorEnabled: false,
    });
  });

  it("rejects an invalid password instead of doing a plain text pass-through", async () => {
    storageMock.getUserByEmail.mockResolvedValueOnce({
      id: "user-1",
      username: "staff@example.com",
      password: await bcrypt.hash("Secret123", 10),
      role: "staff",
      displayName: "Staff User",
      profileImageUrl: null,
      requires2FASetup: false,
      emailNotifications: true,
      twoFactorEnabled: 1,
      lastLoginAt: null,
      createdAt: new Date(),
      status: "active",
    });

    const result = await verifyCredentials("staff@example.com", "WrongPassword");

    expect(result.user).toBe(false);
    expect(result.info).toEqual({
      message: "Incorrect password",
      field: "password",
    });
  });

  it("reports a missing email as an email-field failure", async () => {
    storageMock.getUserByEmail.mockResolvedValueOnce(null);

    const result = await verifyCredentials("missing@example.com", "Secret123");

    expect(result.user).toBe(false);
    expect(result.info).toEqual({
      message: "Email not found",
      field: "email",
    });
  });
});
