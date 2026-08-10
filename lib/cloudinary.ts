import { v2 as cloudinary } from "cloudinary";

export interface CloudinaryUploadResult {
  secureUrl: string;
  publicId: string;
  width: number;
  height: number;
  format: string;
  bytes: number;
  originalBytes: number;
  provider: "CLOUDINARY" | "SUPABASE" | "LOCAL";
  mediaType: "IMAGE" | "VIDEO";
}

export interface CloudinaryCredentials {
  cloudName: string;
  apiKey: string;
  apiSecret: string;
}

export const cloudinaryNotConfiguredMessage =
  "Cloudinary is not configured. Please set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET.";

export function getCloudinaryCredentials(): CloudinaryCredentials | null {
  if (process.env.CLOUDINARY_URL) {
    try {
      const url = new URL(process.env.CLOUDINARY_URL);

      if (url.protocol !== "cloudinary:") {
        return null;
      }

      const cloudName = url.hostname;
      const apiKey = decodeURIComponent(url.username);
      const apiSecret = decodeURIComponent(url.password);

      if (cloudName && apiKey && apiSecret) {
        return { cloudName, apiKey, apiSecret };
      }
    } catch {
      return null;
    }
  }

  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  const apiKey = process.env.CLOUDINARY_API_KEY;
  const apiSecret = process.env.CLOUDINARY_API_SECRET;

  if (cloudName && apiKey && apiSecret) {
    return { cloudName, apiKey, apiSecret };
  }

  return null;
}

export function hasCloudinaryConfig() {
  return Boolean(getCloudinaryCredentials());
}

export function configureCloudinary() {
  const credentials = getCloudinaryCredentials();

  if (!credentials) {
    throw new Error(cloudinaryNotConfiguredMessage);
  }

  cloudinary.config({
    cloud_name: credentials.cloudName,
    api_key: credentials.apiKey,
    api_secret: credentials.apiSecret,
    secure: true
  });

  return cloudinary;
}

export async function deleteCloudinaryImage(
  publicId?: string | null,
  resourceType: "image" | "video" = "image"
) {
  if (!publicId || !hasCloudinaryConfig()) {
    return;
  }

  const client = configureCloudinary();
  await client.uploader.destroy(publicId, { resource_type: resourceType });
}
