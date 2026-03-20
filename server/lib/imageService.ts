import sharp from "sharp";
import path from "path";
import fs from "fs";
import { storage } from "../storage";
import { type NewMediaAsset } from "@shared/schema";

const UPLOADS_DIR = process.env.UPLOADS_DIR
  ? path.resolve(process.env.UPLOADS_DIR)
  : path.join(process.cwd(), "uploads");
const MEDIA_DIR = path.join(UPLOADS_DIR, "media");

/**
 * Unified service for processing images to WebP and storing them locally.
 * Every upload is registered in the mediaAssets table for centralized management.
 */
export async function processAndStoreImage(
  buffer: Buffer,
  category: string,
  originalName: string
) {
  // Ensure target directory exists: uploads/media/[category]
  const targetDir = path.join(MEDIA_DIR, category);
  if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir, { recursive: true });
  }

  // Generate unique WebP filename
  const timestamp = Date.now();
  const safeName = originalName.replace(/[^a-zA-Z0-9.-]/g, "_");
  const baseName = path.parse(safeName).name;
  const filename = `${timestamp}_${baseName}.webp`;
  const relativePath = `media/${category}/${filename}`;
  const absolutePath = path.join(MEDIA_DIR, category, filename);

  // Process image with sharp: convert to WebP with reasonable quality
  const image = sharp(buffer);
  const metadata = await image.metadata();

  await image
    .webp({ quality: 85, effort: 4 }) // Balanced quality and compression speed
    .toFile(absolutePath);

  const stats = fs.statSync(absolutePath);

  // Register entry in mediaAssets table for centralized management
  const assetData: NewMediaAsset = {
    url: `/uploads/${relativePath}`,
    provider: "local",
    category,
    filename: originalName,
    bytes: stats.size,
    width: metadata.width || null,
    height: metadata.height || null,
  };

  const asset = await storage.createMediaAsset(assetData);
  return asset;
}

/**
 * Deletes a local image file given its local relative path or full URL.
 */
export async function deleteLocalImage(url: string) {
  try {
    if (!url.startsWith("/uploads/")) return;
    
    const rel = url.replace(/^\/uploads\//, "");
    const abs = path.join(UPLOADS_DIR, rel);
    
    if (fs.existsSync(abs)) {
      await fs.promises.unlink(abs);
    }
  } catch (err) {
    console.error(`Failed to delete local image: ${url}`, err);
  }
}
