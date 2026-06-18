import type { UploadApiResponse } from "cloudinary";
import {
  configureCloudinary,
  deleteCloudinaryImage,
  type CloudinaryUploadResult
} from "@/lib/cloudinary";

const allowedTypes = ["image/jpeg", "image/png", "image/webp"];
const maxBytes = 5 * 1024 * 1024;

export function validateImageFile(file: File | null | undefined) {
  if (!file || file.size === 0) {
    return { valid: false, error: "Выберите изображение." };
  }

  if (!allowedTypes.includes(file.type)) {
    return { valid: false, error: "Можно загружать только JPEG, PNG или WebP." };
  }

  if (file.size > maxBytes) {
    return { valid: false, error: "Размер изображения не должен превышать 5MB." };
  }

  return { valid: true };
}

export async function uploadImageToCloudinary(
  file: File,
  folder: string
): Promise<CloudinaryUploadResult> {
  const validation = validateImageFile(file);

  if (!validation.valid) {
    throw new Error(validation.error);
  }

  const client = configureCloudinary();
  const buffer = Buffer.from(await file.arrayBuffer());
  const result = await new Promise<UploadApiResponse>((resolve, reject) => {
    const stream = client.uploader.upload_stream(
      {
        folder,
        resource_type: "image",
        use_filename: true,
        unique_filename: true,
        overwrite: false
      },
      (error, uploaded) => {
        if (error || !uploaded) {
          reject(error ?? new Error("Cloudinary upload failed."));
          return;
        }
        resolve(uploaded);
      }
    );

    stream.end(buffer);
  });

  return {
    secureUrl: result.secure_url,
    publicId: result.public_id,
    width: result.width,
    height: result.height,
    format: result.format,
    bytes: result.bytes
  };
}

export { deleteCloudinaryImage as deleteImageFromCloudinary };
