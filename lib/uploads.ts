import type { UploadApiResponse } from "cloudinary";
import { randomUUID } from "crypto";
import { mkdir, unlink, writeFile } from "fs/promises";
import path from "path";
import {
  configureCloudinary,
  deleteCloudinaryImage,
  hasCloudinaryConfig,
  type CloudinaryUploadResult
} from "@/lib/cloudinary";

const allowedTypes = ["image/jpeg", "image/png", "image/webp"];
const maxBytes = 5 * 1024 * 1024;
export const albumCoverMaxBytes = 4 * 1024 * 1024;
export const albumImageMaxBytes = 25 * 1024 * 1024;
export const albumUploadMaxBytes = 120 * 1024 * 1024;

export function validateImageFile(
  file: File | null | undefined,
  sizeLimit = maxBytes
) {
  if (!file || file.size === 0) {
    return { valid: false, error: "Выберите изображение." };
  }

  if (!allowedTypes.includes(file.type)) {
    return { valid: false, error: "Можно загружать только JPEG, PNG или WebP." };
  }

  if (file.size > sizeLimit) {
    return {
      valid: false,
      error: `Размер изображения не должен превышать ${Math.round(sizeLimit / 1024 / 1024)} МБ.`
    };
  }

  return { valid: true };
}

export async function uploadImageToCloudinary(
  file: File,
  folder: string,
  sizeLimit = maxBytes
): Promise<CloudinaryUploadResult> {
  const validation = validateImageFile(file, sizeLimit);

  if (!validation.valid) {
    throw new Error(validation.error);
  }

  if (!hasCloudinaryConfig()) {
    return saveImageLocally(file, folder);
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

export async function deleteImageFromCloudinary(publicId?: string | null) {
  if (!publicId) {
    return;
  }

  if (publicId.startsWith("local:")) {
    const relativePath = publicId.slice("local:".length);
    const uploadsRoot = path.join(process.cwd(), "public", "uploads");
    const absolutePath = path.resolve(uploadsRoot, relativePath);

    if (!absolutePath.startsWith(`${uploadsRoot}${path.sep}`)) {
      return;
    }

    try {
      await unlink(absolutePath);
    } catch {
      // The file may already be gone; database cleanup should still succeed.
    }
    return;
  }

  await deleteCloudinaryImage(publicId);
}

async function saveImageLocally(file: File, folder: string): Promise<CloudinaryUploadResult> {
  const extensionByType: Record<string, string> = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp"
  };
  const safeFolder = folder
    .split("/")
    .map((part) => part.replace(/[^a-z0-9-]/gi, ""))
    .filter(Boolean)
    .join("/");
  const extension = extensionByType[file.type] ?? "jpg";
  const fileName = `${randomUUID()}.${extension}`;
  const relativePath = path.posix.join(safeFolder, fileName);
  const directory = path.join(process.cwd(), "public", "uploads", safeFolder);
  const absolutePath = path.join(directory, fileName);
  const buffer = Buffer.from(await file.arrayBuffer());

  await mkdir(directory, { recursive: true });
  await writeFile(absolutePath, buffer);

  return {
    secureUrl: `/uploads/${relativePath}`,
    publicId: `local:${relativePath}`,
    width: 0,
    height: 0,
    format: extension,
    bytes: buffer.length
  };
}
