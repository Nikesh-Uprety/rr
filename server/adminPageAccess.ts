import { eq, sql } from "drizzle-orm";

import { adminProfileSettings } from "../shared/schema";
import { db } from "./db";
import { getAdminAllowedPages, normalizeAdminPageList, type AdminPageKey } from "@shared/auth-policy";

let adminProfileAccessReady = false;

export async function ensureAdminProfileAccessStorage() {
  if (adminProfileAccessReady) return;

  await db.execute(sql`
    create table if not exists admin_profile_settings (
      user_id varchar primary key references users(id) on delete cascade,
      first_name text,
      last_name text,
      language text not null default 'en',
      timezone text not null default 'Asia/Kathmandu',
      department text,
      compact_sidebar boolean not null default false,
      show_npr_currency boolean not null default true,
      order_alert_sound boolean not null default true,
      login_alerts boolean not null default true,
      notification_prefs jsonb not null default '{}'::jsonb,
      updated_at timestamptz not null default now()
    )
  `);

  await db.execute(sql`
    alter table admin_profile_settings
    add column if not exists page_access_overrides jsonb not null default '[]'::jsonb
  `);

  adminProfileAccessReady = true;
}

export async function getAdminPageAccessOverrides(userId: string): Promise<AdminPageKey[]> {
  await ensureAdminProfileAccessStorage();

  const [settings] = await db
    .select({
      pageAccessOverrides: adminProfileSettings.pageAccessOverrides,
    })
    .from(adminProfileSettings)
    .where(eq(adminProfileSettings.userId, userId))
    .limit(1);

  return normalizeAdminPageList(settings?.pageAccessOverrides);
}

export async function getEffectiveAdminPageAccess(
  userId: string,
  role: string | null | undefined,
): Promise<AdminPageKey[]> {
  const overrides = await getAdminPageAccessOverrides(userId);
  return getAdminAllowedPages(role, overrides);
}
