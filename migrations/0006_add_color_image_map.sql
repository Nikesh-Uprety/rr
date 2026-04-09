ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "color_image_map" jsonb NOT NULL DEFAULT '{}'::jsonb;
