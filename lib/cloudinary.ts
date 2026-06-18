import { v2 as cloudinary } from "cloudinary";

export interface CloudinaryUploadResult {
  secureUrl: string;
  publicId: string;
  width: number;
  height: number;
  format: string;
  bytes: number;
}

export function hasCloudinaryConfig() {
  return Boolean(
    process.env.CLOUDINARY_CLOUD_NAME &&
      process.env.CLOUDINARY_API_KEY &&
      process.env.CLOUDINARY_API_SECRET
  );
}

export function configureCloudinary() {
  if (!hasCloudinaryConfig()) {
    throw new Error("Cloudinary env variables are not configured.");
  }

  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
    secure: true
  });

  return cloudinary;
}

export async function deleteCloudinaryImage(publicId?: string | null) {
  if (!publicId || !hasCloudinaryConfig()) {
    return;
  }

  const client = configureCloudinary();
  await client.uploader.destroy(publicId, { resource_type: "image" });
}
