import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import bcrypt from "bcryptjs";
import { storage } from "./storage";
import { getEffectiveAdminPageAccess } from "./adminPageAccess";
import type { AdminPageKey } from "@shared/auth-policy";

declare global {
  // eslint-disable-next-line no-unused-vars
  namespace Express {
    interface User {
      id: string;
      email: string;
      role: string;
      name?: string;
      profileImageUrl?: string;
      twoFactorEnabled?: boolean;
      requires2FASetup?: boolean;
      status?: string;
      adminPageAccess?: AdminPageKey[];
    }
  }
}

export function configurePassport(): void {
  passport.use(
    new LocalStrategy(
      { usernameField: "email", passwordField: "password" },
      async (email, password, done) => {
        try {
          const user = await storage.getUserByEmail(email);
          if (!user) {
            return done(null, false, {
              message: "Email not found",
              field: "email",
            });
          }

          const matches = await bcrypt.compare(password, user.password);
          if (!matches) {
            return done(null, false, {
              message: "Incorrect password",
              field: "password",
            });
          }

          const adminPageAccess = await getEffectiveAdminPageAccess(user.id, user.role);
          const expressUser: Express.User = {
            id: user.id,
            email: user.username,
            role: user.role,
            name: user.displayName || user.username,
            profileImageUrl: user.profileImageUrl || undefined,
            twoFactorEnabled: !!user.twoFactorEnabled,
            requires2FASetup: !!user.requires2FASetup,
            status: user.status,
            adminPageAccess,
          };

          return done(null, expressUser);
        } catch (err) {
          return done(err as Error);
        }
      },
    ),
  );

  passport.serializeUser((user: Express.User, done) => {
    done(null, user.id);
  });

  passport.deserializeUser(async (id: string, done) => {
    try {
      const user = await storage.getUserById(id);
      if (!user) {
        return done(null, false);
      }
      const adminPageAccess = await getEffectiveAdminPageAccess(user.id, user.role);
      const expressUser: Express.User = {
        id: user.id,
        email: user.username,
        role: user.role,
        name: user.displayName || user.username,
        profileImageUrl: user.profileImageUrl || undefined,
        twoFactorEnabled: !!user.twoFactorEnabled,
        requires2FASetup: !!user.requires2FASetup,
        adminPageAccess,
      };
      return done(null, expressUser);
    } catch (err) {
      return done(err as Error);
    }
  });
}

export { passport };


