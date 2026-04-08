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

function normalizeCloudinaryError(error: unknown, fallbackMessage: string): Error {
  if (error instanceof Error) return error;
  if (typeof error === "string") return new Error(error);
  if (error && typeof error === "object") {
    const message =
      typeof (error as { message?: unknown }).message === "string"
        ? (error as { message: string }).message
        : typeof (error as { error?: unknown }).error === "string"
          ? (error as { error: string }).error
          : fallbackMessage;
    return new Error(message);
  }
  return new Error(fallbackMessage);
}

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
    collection_page: 2400,
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
            // Prefer better delivery quality for hero/campaign assets.
            // Cloudinary will still optimize format/bytes automatically.
            quality: "auto:best",
            dpr: "auto",
            fetch_format: "auto",
          },
        ],
        // Generate a clean unique public ID
        public_id: `${section}-${Date.now()}`,
        overwrite: false,
      },
      (error, result) => {
        if (error || !result) {
          return reject(
            normalizeCloudinaryError(error, "Cloudinary upload failed for site asset."),
          );
        }
        resolve({
          url: result.secure_url,
          publicId: result.public_id,
        });
      },
    );
    uploadStream.end(buffer);
  });
}

export async function uploadMediaToCloudinary(
  buffer: Buffer,
  category: string,
  options?: {
    qualityMode?: "medium" | "high";
    folderPath?: string | null;
  },
): Promise<{ url: string; publicId: string }> {
  const maxWidths: Record<string, number> = {
    product: 2000,
    model: 2400,
    website: 2400,
    landing_page: 2400,
    collection_page: 2400,
  };

  const width = maxWidths[category] ?? 2000;
  const quality =
    options?.qualityMode === "medium"
      ? "auto:good"
      : "auto:best";
  const normalizedFolder =
    options?.folderPath
      ? options.folderPath.replace(/^\/+|\/+$/g, "")
      : "";
  const folderSuffix = normalizedFolder ? `/${normalizedFolder}` : "";

  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder: `rare-np/media/${category}${folderSuffix}`,
        format: "webp",
        transformation: [
          {
            width,
            crop: "limit",
            quality,
            dpr: "auto",
            fetch_format: "auto",
          },
        ],
        public_id: `${category}-${Date.now()}`,
        overwrite: false,
      },
      (error, result) => {
        if (error || !result) {
          return reject(
            normalizeCloudinaryError(error, "Cloudinary upload failed for admin media asset."),
          );
        }
        resolve({
          url: result.secure_url,
          publicId: result.public_id,
        });
      },
    );
    uploadStream.end(buffer);
  });
}

export async function uploadPaymentProofToCloudinary(
  buffer: Buffer,
  orderId: string,
): Promise<{ url: string; publicId: string }> {
  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder: "rare-np/payment-proofs",
        resource_type: "image",
        public_id: `order-${orderId}-${Date.now()}`,
        overwrite: false,
      },
      (error, result) => {
        if (error || !result) {
          return reject(
            normalizeCloudinaryError(error, "Cloudinary upload failed for payment proof."),
          );
        }
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

