import type { Request, Response, NextFunction } from "express";
import { canAccessAdminPage, canAccessAdminPanel, type AdminPageKey } from "@shared/auth-policy";

export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  const user = req.user as Express.User | undefined;
  if (!user || !canAccessAdminPanel(user.role)) {
    return res.status(403).json({ success: false, error: "Forbidden" });
  }
  next();
}

export function requireAdminPageAccess(page: AdminPageKey | AdminPageKey[]) {
  const allowedPages = Array.isArray(page) ? page : [page];

  return (req: Request, res: Response, next: NextFunction) => {
    const user = req.user as Express.User | undefined;
    if (
      !user ||
      !allowedPages.some((pageKey) => canAccessAdminPage(user.role, pageKey, user.adminPageAccess))
    ) {
      return res.status(403).json({ success: false, error: "Forbidden" });
    }
    next();
  };
}

