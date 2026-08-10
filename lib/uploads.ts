import type { UploadApiResponse } from "cloudinary";
import { randomUUID } from "crypto";
import { mkdir, unlink, writeFile } from "fs/promises";
import path from "path";
import {
  cloudinaryNotConfiguredMessage,
  configureCloudinary,
  deleteCloudinaryImage,
  hasCloudinaryConfig,
  type CloudinaryUploadResult
} from "@/lib/cloudinary";
import {
  albumCoverMaxBytes,
  albumImageMaxBytes,
  albumUploadMaxBytes,
  avatarImageMaxBytes,
  formatMegabytes
} from "@/lib/upload-limits";

export {
  albumCoverMaxBytes,
  albumImageMaxBytes,
  albumUploadMaxBytes,
  avatarImageMaxBytes
} from "@/lib/upload-limits";

const allowedTypes = ["image/jpeg", "image/png", "image/webp"];
const maxBytes = 5 * 1024 * 1024;

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
      error: `Размер изображения не должен превышать ${formatMegabytes(sizeLimit)} МБ.`
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

  if (hasCloudinaryConfig()) {
    return uploadToCloudinary(file, folder);
  }

  throw new Error(cloudinaryNotConfiguredMessage);
}

async function uploadToCloudinary(
  file: File,
  folder: string
): Promise<CloudinaryUploadResult> {
  const client = configureCloudinary();
  const buffer = Buffer.from(await file.arrayBuffer());
  const result = await new Promise<UploadApiResponse>((resolve, reject) => {
    const stream = client.uploader.upload_stream(
      {
        folder,
        resource_type: "image",
        use_filename: true,
        unique_filename: true,
        overwrite: false,
        format: "webp",
        transformation: [
          {
            width: 1920,
            height: 1920,
            crop: "limit",
            quality: "auto:good"
          }
        ]
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
    bytes: result.bytes,
    originalBytes: file.size,
    provider: "CLOUDINARY",
    mediaType: "IMAGE"
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

  if (publicId.startsWith("supabase:")) {
    await deleteFromSupabaseStorage(publicId.slice("supabase:".length));
    return;
  }

  if (publicId.startsWith("cloudinary:video:")) {
    await deleteCloudinaryImage(
      publicId.slice("cloudinary:video:".length),
      "video"
    );
    return;
  }

  if (publicId.startsWith("cloudinary:image:")) {
    await deleteCloudinaryImage(publicId.slice("cloudinary:image:".length));
    return;
  }

  await deleteCloudinaryImage(publicId);
}

function hasSupabaseStorageConfig() {
  return Boolean(
    process.env.SUPABASE_STORAGE_ENDPOINT &&
      process.env.SUPABASE_STORAGE_SECRET
  );
}

async function uploadToSupabaseStorage(
  file: File,
  folder: string
): Promise<CloudinaryUploadResult> {
  const extensionByType: Record<string, string> = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp"
  };
  const extension = extensionByType[file.type] ?? "jpg";
  const filePath = `${sanitizeFolder(folder)}/${randomUUID()}.${extension}`;
  const response = await fetch(process.env.SUPABASE_STORAGE_ENDPOINT!, {
    method: "POST",
    headers: {
      "content-type": file.type,
      "x-file-path": filePath,
      "x-framely-upload-secret": process.env.SUPABASE_STORAGE_SECRET!
    },
    body: await file.arrayBuffer()
  });
  const result = (await response.json()) as CloudinaryUploadResult & {
    error?: string;
  };

  if (!response.ok) {
    throw new Error(result.error ?? "Не удалось загрузить изображение в Supabase Storage.");
  }

  return {
    secureUrl: result.secureUrl,
    publicId: result.publicId,
    width: result.width ?? 0,
    height: result.height ?? 0,
    format: result.format ?? extension,
    bytes: result.bytes ?? file.size,
    originalBytes: result.originalBytes ?? file.size,
    provider: "SUPABASE",
    mediaType: "IMAGE"
  };
}

async function deleteFromSupabaseStorage(filePath: string) {
  if (!hasSupabaseStorageConfig()) return;

  const response = await fetch(process.env.SUPABASE_STORAGE_ENDPOINT!, {
    method: "DELETE",
    headers: {
      "x-file-path": filePath,
      "x-framely-upload-secret": process.env.SUPABASE_STORAGE_SECRET!
    }
  });

  if (!response.ok) {
    const result = (await response.json()) as { error?: string };
    throw new Error(result.error ?? "Не удалось удалить изображение из Supabase Storage.");
  }
}

async function saveImageLocally(file: File, folder: string): Promise<CloudinaryUploadResult> {
  const extensionByType: Record<string, string> = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp"
  };
  const safeFolder = sanitizeFolder(folder);
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
    bytes: buffer.length,
    originalBytes: file.size,
    provider: "LOCAL",
    mediaType: "IMAGE"
  };
}

function sanitizeFolder(folder: string) {
  return folder
    .split("/")
    .map((part) => part.replace(/[^a-z0-9-]/gi, ""))
    .filter(Boolean)
    .join("/");
}
