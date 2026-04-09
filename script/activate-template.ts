import { db } from "../server/db";
import { pageTemplates, siteSettings } from "../shared/schema";
import { eq } from "drizzle-orm";

async function main() {
  const slug = process.argv[2];
  if (!slug) {
    console.error("Usage: tsx script/activate-template.ts <template-slug>");
    process.exit(1);
  }

  const [template] = await db.select().from(pageTemplates).where(eq(pageTemplates.slug, slug)).limit(1);
  if (!template) {
    console.error(`Template not found for slug: ${slug}`);
    process.exit(1);
  }

  const existing = await db.select().from(siteSettings).limit(1);
  if (existing.length > 0) {
    await db
      .update(siteSettings)
      .set({
        activeTemplateId: template.id,
        publishedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(siteSettings.id, existing[0].id));
  } else {
    await db.insert(siteSettings).values({ activeTemplateId: template.id, publishedAt: new Date() });
  }

  console.log(`Activated template: ${template.name} (${template.slug}) id=${template.id}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
