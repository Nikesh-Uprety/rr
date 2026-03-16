import { v2 as cloudinary } from "cloudinary";

// Parse CLOUDINARY_URL (format: cloudinary://api_key:api_secret@cloud_name)
// or fall back to individual env vars
const cloudinaryUrl = process.env.CLOUDINARY_URL;
if (cloudinaryUrl) {
  const match = cloudinaryUrl.match(
    /cloudinary:\/\/(\d+):([^@]+)@(.+)/,
  );
  if (match) {
    cloudinary.config({
      api_key: match[1],
      api_secret: match[2],
      cloud_name: match[3],
    });
  } else {
    console.error("[Cloudinary] CLOUDINARY_URL format invalid. Expected: cloudinary://api_key:api_secret@cloud_name");
  }
} else if (process.env.CLOUDINARY_CLOUD_NAME) {
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
  });
} else {
  console.warn("[Cloudinary] No Cloudinary credentials found. Image uploads will fail.");
}

export { cloudinary };

// Upload a buffer to Cloudinary
// Returns { url, publicId }
export async function uploadToCloudinary(
  buffer: Buffer,
  section: string,
): Promise<{ url: string; publicId: string }> {
  const maxWidths: Record<string, number> = {
    hero: 1920,
    featured_collection: 1200,
    new_collection: 1200,
  };

  const width = maxWidths[section] ?? 1200;

  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder: `rare-np/site-assets/${section}`,
        // Cloudinary auto-converts to WebP for browsers
        // that support it — no Sharp needed
        format: "webp",
        transformation: [
          {
            width,
            crop: "limit", // never upscale, maintain ratio
            quality: 85, // matches Sharp quality target
            fetch_format: "auto",
          },
        ],
        // Generate a clean unique public ID
        public_id: `${section}-${Date.now()}`,
        overwrite: false,
      },
      (error, result) => {
        if (error || !result) return reject(error);
        resolve({
          url: result.secure_url,
          publicId: result.public_id,
        });
      },
    );
    uploadStream.end(buffer);
  });
}

// Delete an image from Cloudinary
export async function deleteFromCloudinary(publicId: string): Promise<void> {
  await cloudinary.uploader.destroy(publicId);
}

