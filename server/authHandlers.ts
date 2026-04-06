import crypto from "node:crypto";
import type { NextFunction, Request, Response } from "express";
import bcrypt from "bcryptjs";
import passportLib from "passport";
import { z } from "zod";
import { requiresTwoFactorChallenge } from "@shared/auth-policy";
import { handleApiError } from "./errorHandler";
import { sendOTPEmail as sendOTPEmailLib, sendStoreUserWelcomeEmail as sendStoreUserWelcomeEmailLib } from "./email";
import { storage as storageLib } from "./storage";

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export const verify2FASchema = z.object({
  tempToken: z.string().min(1),
  code: z.string().min(4).max(6),
});

const storeUserRoleEnum = z.enum(["superadmin", "owner", "manager", "csr", "admin", "staff"]);

export const createStoreUserSchema = z.object({
  name: z.string().min(1).max(100),
  email: z.string().email(),
  password: z.string().min(6),
  role: storeUserRoleEnum,
  phoneNumber: z.string().trim().max(40).optional(),
  profileImageUrl: z.string().trim().url().optional(),
});

type StorageLike = typeof storageLib;
type PassportLike = typeof passportLib;
const PRIVILEGED_ADMIN_ROLES = new Set(["superadmin", "owner", "admin"]);
const isSuperAdminRole = (role: string | null | undefined) => role?.toLowerCase() === "superadmin";
const canManagePrivilegedAdminRoles = (user: Express.User | undefined) =>
  isSuperAdminRole(user?.role);

export function createLoginHandler(deps?: {
  storage?: StorageLike;
  passport?: PassportLike;
  sendOTPEmail?: typeof sendOTPEmailLib;
}) {
  const storage = deps?.storage ?? storageLib;
  const passport = deps?.passport ?? passportLib;
  const sendOTPEmail = deps?.sendOTPEmail ?? sendOTPEmailLib;

  return (req: Request, res: Response, next: NextFunction) => {
    const { email, password } = req.body;

    passport.authenticate(
      "local",
      (
        err: any,
        user: Express.User | false,
        info?: { message?: string; field?: "email" | "password" },
      ) => {
      if (err) {
        console.error("AUTH ERROR:", err);
        return res.status(500).json({
          success: false,
          error: "Authentication failed",
        });
      }

      if (!user) {
        return res.status(401).json({
          success: false,
          error: info?.message ?? "Invalid email or password",
          field: info?.field ?? null,
        });
      }

      (async () => {
        const fullUser = await storage.getUserById(user.id);
        if (!fullUser || fullUser.status === "suspended") {
          return res.status(403).json({
            success: false,
            error: "Account is not active",
          });
        }

        const twoFactorEnabled = !!fullUser.twoFactorEnabled;
        const requires2FASetup = !!fullUser.requires2FASetup;

        if (requiresTwoFactorChallenge({ twoFactorEnabled, requires2FASetup })) {
          const code = Math.floor(100000 + Math.random() * 900000)
            .toString()
            .slice(0, 6);
          const tempToken = crypto.randomUUID();
          const expiresMinutes = Number(process.env.OTP_EXPIRY_MINUTES ?? "10");
          const expiresAt = new Date(Date.now() + expiresMinutes * 60 * 1000);

          await storage.createOtpToken({
            id: tempToken,
            userId: fullUser.id,
            token: code,
            expiresAt,
          });

          await sendOTPEmail(fullUser.username, code, fullUser.username);

          return res.status(200).json({
            success: true,
            requires2FA: true,
            tempToken,
            requires2FASetup,
          });
        }

        req.logIn(
          {
            ...user,
            twoFactorEnabled: false,
            requires2FASetup: false,
          },
          async (loginErr) => {
            if (loginErr) {
              return next(loginErr);
            }

            await storage.updateLastLoginAt(fullUser.id);

            return res.status(200).json({
              success: true,
              data: {
                id: user.id,
                email: user.email,
                name: user.name,
                role: user.role,
                twoFactorEnabled: false,
                requires2FASetup: false,
              },
            });
          },
        );
      })().catch((error) => next(error));
      },
    )(req, res, next);
  };
}

export function createVerify2FAHandler(deps?: {
  storage?: StorageLike;
}) {
  const storage = deps?.storage ?? storageLib;

  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { tempToken, code } = req.body;
      const otp = await storage.consumeOtpToken(tempToken, code);
      if (!otp) {
        return res.status(400).json({ success: false, error: "Invalid or expired code" });
      }

      const fullUser = await storage.getUserById(otp.userId);
      if (!fullUser || fullUser.status === "suspended") {
        return res.status(403).json({ success: false, error: "Account is not active" });
      }

      if (fullUser.requires2FASetup || !fullUser.twoFactorEnabled) {
        await storage.updateUserTwoFactor(fullUser.id, true);
      }

      const expressUser: Express.User = {
        id: fullUser.id,
        email: fullUser.username,
        role: fullUser.role,
        name: fullUser.username,
        twoFactorEnabled: true,
        requires2FASetup: false,
        status: fullUser.status,
      };

      req.logIn(expressUser, async (loginErr) => {
        if (loginErr) {
          return next(loginErr);
        }

        await storage.updateLastLoginAt(fullUser.id);

        return res.status(200).json({
          success: true,
          data: {
            id: expressUser.id,
            email: expressUser.email,
            name: expressUser.name,
            role: expressUser.role,
            twoFactorEnabled: true,
            requires2FASetup: false,
          },
        });
      });
    } catch (err) {
      return next(err);
    }
  };
}

export function createStoreUserHandler(deps?: {
  storage?: StorageLike;
  sendStoreUserWelcomeEmail?: typeof sendStoreUserWelcomeEmailLib;
}) {
  const storage = deps?.storage ?? storageLib;
  const sendStoreUserWelcomeEmail =
    deps?.sendStoreUserWelcomeEmail ?? sendStoreUserWelcomeEmailLib;

  return async (req: Request, res: Response) => {
    try {
      const validation = createStoreUserSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({ success: false, error: "Invalid request body" });
      }

      const { name, email, password, role, phoneNumber, profileImageUrl } = validation.data;
      const actor = req.user as Express.User | undefined;

      if (!canManagePrivilegedAdminRoles(actor) && PRIVILEGED_ADMIN_ROLES.has(role)) {
        return res.status(403).json({
          success: false,
          error: "Only superadmin users can create owner/admin/superadmin users",
        });
      }

      const existing = await storage.getUserByEmail(email);
      if (existing) {
        return res.status(400).json({ success: false, error: "Email already in use" });
      }

      const hashed = await bcrypt.hash(password, 10);

      const created = await storage.createStoreUser({
        name,
        email,
        role,
        passwordHash: hashed,
        phoneNumber: phoneNumber?.trim() || null,
        profileImageUrl: profileImageUrl?.trim() || null,
      });

      const inviter = req.user as Express.User | undefined;
      sendStoreUserWelcomeEmail(
        email,
        name,
        inviter?.name || inviter?.email || "Admin",
      ).catch((e) => {
        console.error("Failed to send store user welcome email:", e);
      });

      return res.status(201).json({ success: true, data: created });
    } catch (err) {
      console.error("Error in POST /api/admin/store-users", err);
      return res.status(500).json({ success: false, error: "Failed to create store user" });
    }
  };
}
