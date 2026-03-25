import { describe, expect, it, vi, beforeEach } from "vitest";
import {
  createLoginHandler,
  createStoreUserHandler,
  createVerify2FAHandler,
} from "../../server/authHandlers";

function createResponse() {
  const res = {
    status: vi.fn(),
    json: vi.fn(),
  };

  res.status.mockReturnValue(res);
  res.json.mockReturnValue(res);
  return res;
}

describe("auth route handlers", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("returns a 2FA challenge without leaking the OTP code on first login", async () => {
    const createOtpToken = vi.fn().mockResolvedValue(undefined);
    const getUserById = vi.fn().mockResolvedValue({
      id: "user-1",
      username: "staff@example.com",
      role: "staff",
      status: "active",
      twoFactorEnabled: 0,
      requires2FASetup: true,
    });
    const sendOTPEmail = vi.fn().mockResolvedValue(undefined);
    const authenticate = vi.fn((_: string, callback: any) => () =>
      callback(null, {
        id: "user-1",
        email: "staff@example.com",
        role: "staff",
        name: "Staff User",
      }),
    );

    const req = {
      body: { email: "staff@example.com", password: "Secret123" },
      logIn: vi.fn(),
    } as any;
    const res = createResponse();
    const next = vi.fn();

    await createLoginHandler({
      storage: {
        getUserById,
        createOtpToken,
      } as any,
      passport: { authenticate } as any,
      sendOTPEmail,
    })(req, res as any, next);
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(createOtpToken).toHaveBeenCalledOnce();
    expect(sendOTPEmail).toHaveBeenCalledOnce();
    expect(req.logIn).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: true,
        requires2FA: true,
        requires2FASetup: true,
        tempToken: expect.any(String),
      }),
    );
    expect(res.json).not.toHaveBeenCalledWith(
      expect.objectContaining({
        code: expect.any(String),
      }),
    );
  });

  it("returns a logged-in user payload when 2FA is not required", async () => {
    const getUserById = vi.fn().mockResolvedValue({
      id: "user-1",
      username: "admin@example.com",
      role: "admin",
      status: "active",
      twoFactorEnabled: 0,
      requires2FASetup: false,
    });
    const updateLastLoginAt = vi.fn().mockResolvedValue(undefined);
    const authenticate = vi.fn((_: string, callback: any) => () =>
      callback(null, {
        id: "user-1",
        email: "admin@example.com",
        role: "admin",
        name: "Admin User",
      }),
    );

    const req = {
      body: { email: "admin@example.com", password: "Secret123" },
      logIn: vi.fn((_user, callback) => callback(null)),
    } as any;
    const res = createResponse();
    const next = vi.fn();

    await createLoginHandler({
      storage: {
        getUserById,
        updateLastLoginAt,
      } as any,
      passport: { authenticate } as any,
    })(req, res as any, next);
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(req.logIn).toHaveBeenCalledOnce();
    expect(updateLastLoginAt).toHaveBeenCalledWith("user-1");
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      success: true,
      data: {
        id: "user-1",
        email: "admin@example.com",
        name: "Admin User",
        role: "admin",
        twoFactorEnabled: false,
        requires2FASetup: false,
      },
    });
  });

  it("returns field-specific login failures from passport info", async () => {
    const authenticate = vi.fn((_: string, callback: any) => () =>
      callback(null, false, {
        message: "Email not found",
        field: "email",
      }),
    );

    const req = {
      body: { email: "missing@example.com", password: "Secret123" },
      logIn: vi.fn(),
    } as any;
    const res = createResponse();
    const next = vi.fn();

    await createLoginHandler({
      passport: { authenticate } as any,
    })(req, res as any, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      error: "Email not found",
      field: "email",
    });
  });

  it("enables 2FA and clears the setup flag after OTP verification", async () => {
    const consumeOtpToken = vi.fn().mockResolvedValue({
      id: "otp-1",
      userId: "user-1",
      token: "123456",
      expiresAt: new Date(Date.now() + 60_000),
    });
    const getUserById = vi.fn().mockResolvedValue({
      id: "user-1",
      username: "staff@example.com",
      role: "staff",
      status: "active",
      twoFactorEnabled: 0,
      requires2FASetup: true,
    });
    const updateUserTwoFactor = vi.fn().mockResolvedValue(undefined);
    const updateLastLoginAt = vi.fn().mockResolvedValue(undefined);

    const req = {
      body: { tempToken: "otp-1", code: "123456" },
      logIn: vi.fn((_user, callback) => callback(null)),
    } as any;
    const res = createResponse();
    const next = vi.fn();

    await createVerify2FAHandler({
      storage: {
        consumeOtpToken,
        getUserById,
        updateUserTwoFactor,
        updateLastLoginAt,
      } as any,
    })(req, res as any, next);

    expect(updateUserTwoFactor).toHaveBeenCalledWith("user-1", true);
    expect(updateLastLoginAt).toHaveBeenCalledWith("user-1");
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      success: true,
      data: {
        id: "user-1",
        email: "staff@example.com",
        name: "staff@example.com",
        role: "staff",
        twoFactorEnabled: true,
        requires2FASetup: false,
      },
    });
  });

  it("hashes store-user passwords and rejects duplicate emails", async () => {
    const duplicateRes = createResponse();
    await createStoreUserHandler({
      storage: {
        getUserByEmail: vi.fn().mockResolvedValue({ id: "existing-user" }),
      } as any,
      sendStoreUserWelcomeEmail: vi.fn(),
    })(
      {
        body: {
          name: "Store User",
          email: "staff@example.com",
          password: "Secret123",
          role: "staff",
        },
      } as any,
      duplicateRes as any,
    );

    expect(duplicateRes.status).toHaveBeenCalledWith(400);
    expect(duplicateRes.json).toHaveBeenCalledWith({
      success: false,
      error: "Email already in use",
    });

    const createStoreUser = vi.fn().mockResolvedValue({
      id: "user-2",
      email: "newstaff@example.com",
      name: "New Staff",
      role: "staff",
      profileImageUrl: null,
      emailNotifications: true,
      createdAt: new Date(),
    });
    const sendStoreUserWelcomeEmail = vi.fn().mockResolvedValue(undefined);
    const res = createResponse();

    await createStoreUserHandler({
      storage: {
        getUserByEmail: vi.fn().mockResolvedValue(null),
        createStoreUser,
      } as any,
      sendStoreUserWelcomeEmail,
    })(
      {
        body: {
          name: "New Staff",
          email: "newstaff@example.com",
          password: "Secret123",
          role: "staff",
        },
        user: {
          name: "Admin User",
          email: "admin@example.com",
        },
      } as any,
      res as any,
    );

    expect(createStoreUser).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "New Staff",
        email: "newstaff@example.com",
        role: "staff",
        passwordHash: expect.stringMatching(/^\$2[aby]\$/),
      }),
    );
    expect(sendStoreUserWelcomeEmail).toHaveBeenCalledWith(
      "newstaff@example.com",
      "New Staff",
      "Admin User",
    );
    expect(res.status).toHaveBeenCalledWith(201);
  });

  it("rejects invalid store-user payloads before insert", async () => {
    const createStoreUser = vi.fn();
    const res = createResponse();

    await createStoreUserHandler({
      storage: {
        getUserByEmail: vi.fn(),
        createStoreUser,
      } as any,
      sendStoreUserWelcomeEmail: vi.fn(),
    })(
      {
        body: {
          name: "Bad User",
          email: "not-an-email",
          password: "123",
          role: "staff",
        },
      } as any,
      res as any,
    );

    expect(createStoreUser).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      error: "Invalid request body",
    });
  });
});
