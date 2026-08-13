"use client";

import { albumImageMaxBytes, albumVideoMaxBytes, formatMegabytes } from "@/lib/upload-limits";

const maxDimension = 1920;
const optimizedImageQuality = 0.82;

export type AlbumMediaDraft = {
  key: string;
  file: File;
  mediaType: "IMAGE" | "VIDEO";
  fileName: string;
  previewUrl: string;
};

type UploadedAlbumMedia = {
  imageUrl: string;
  imagePublicId: string;
  mediaType: "IMAGE" | "VIDEO";
  provider: "CLOUDINARY";
  bytes: number;
  originalBytes: number;
  width?: number;
  height?: number;
  format?: string;
};

type SignedCloudinaryImageUpload = {
  cloudName: string;
  apiKey: string;
  folder: string;
  format: string;
  timestamp: number;
  transformation: string;
  signature: string;
  error?: string;
};

type SignedCloudinaryVideoUpload = {
  cloudName: string;
  apiKey: string;
  folder: string;
  timestamp: number;
  signature: string;
  error?: string;
};

type CloudinaryUploadResponse = {
  secure_url?: string;
  public_id?: string;
  bytes?: number;
  width?: number;
  height?: number;
  format?: string;
  error?: { message?: string };
};

type DraftRegistration = {
  getDrafts: () => AlbumMediaDraft[];
  clearDrafts: () => void;
};

const draftRegistry = new Map<string, Map<string, DraftRegistration>>();

export function registerAlbumMediaDrafts(
  scope: string,
  fieldName: string,
  getDrafts: () => AlbumMediaDraft[],
  clearDrafts: () => void
) {
  const fields = draftRegistry.get(scope) ?? new Map<string, DraftRegistration>();
  fields.set(fieldName, { getDrafts, clearDrafts });
  draftRegistry.set(scope, fields);

  return () => {
    const current = draftRegistry.get(scope);
    if (!current) return;

    current.delete(fieldName);
    if (current.size === 0) draftRegistry.delete(scope);
  };
}

export function clearAlbumMediaDrafts(scope: string) {
  draftRegistry.get(scope)?.forEach(({ clearDrafts }) => clearDrafts());
}

export async function uploadAlbumMediaForSubmission(
  formData: FormData,
  scope: string,
  onProgress?: (completed: number, total: number) => void
) {
  const fields = draftRegistry.get(scope);
  if (!fields?.size) return { uploadedPublicIds: [] as string[] };

  const draftsByField = Array.from(fields.entries()).map(([fieldName, { getDrafts }]) => ({
    fieldName,
    drafts: getDrafts()
  }));
  const total = draftsByField.reduce((count, entry) => count + entry.drafts.length, 0);
  const uploadedPublicIds: string[] = [];
  const replacements = new Map<string, string>();
  let completed = 0;

  try {
    for (const { fieldName, drafts } of draftsByField) {
      for (const draft of drafts) {
        const uploaded =
          draft.mediaType === "VIDEO"
            ? await uploadVideoToCloudinary(draft.file)
            : await uploadImageToCloudinary(draft.file);

        uploadedPublicIds.push(uploaded.imagePublicId);
        replacements.set(draft.key, uploaded.imagePublicId);
        formData.append(`uploadedMedia:${fieldName}`, JSON.stringify(uploaded));
        completed += 1;
        onProgress?.(completed, total);
      }
    }

    for (const { fieldName } of draftsByField) {
      replaceDraftKeysInFormData(formData, `mediaOrder:${fieldName}`, replacements);
      replaceSingleDraftKey(formData, `coverMedia:${fieldName}`, replacements);
      replaceCropDraftKey(formData, `coverCrop:${fieldName}`, replacements);
    }

    return { uploadedPublicIds };
  } catch (error) {
    await cleanupUploadedAlbumMedia(uploadedPublicIds);
    throw error;
  }
}

export async function cleanupUploadedAlbumMedia(publicIds: string[]) {
  const results = await Promise.allSettled(
    Array.from(new Set(publicIds.filter(Boolean))).map(async (publicId) => {
      const response = await fetch("/api/uploads/delete", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ publicId })
      });

      if (!response.ok) {
        const result = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(result?.error ?? "Не удалось удалить временно загруженный файл.");
      }
    })
  );

  const failed = results.filter(
    (result): result is PromiseRejectedResult => result.status === "rejected"
  );
  if (failed.length) {
    console.error("Не удалось удалить временные album media:", failed);
  }
}

function replaceDraftKeysInFormData(
  formData: FormData,
  name: string,
  replacements: Map<string, string>
) {
  const value = String(formData.get(name) ?? "");
  if (!value) return;

  try {
    const parsed = JSON.parse(value) as unknown;
    if (!Array.isArray(parsed)) return;

    formData.set(
      name,
      JSON.stringify(parsed.map((key) => (typeof key === "string" ? replacements.get(key) ?? key : key)))
    );
  } catch {
    // The server action will handle malformed ordering data as it did before.
  }
}

function replaceSingleDraftKey(
  formData: FormData,
  name: string,
  replacements: Map<string, string>
) {
  const value = String(formData.get(name) ?? "");
  const replacement = replacements.get(value);
  if (replacement) formData.set(name, replacement);
}

function replaceCropDraftKey(
  formData: FormData,
  name: string,
  replacements: Map<string, string>
) {
  const value = String(formData.get(name) ?? "");
  if (!value) return;

  try {
    const parsed = JSON.parse(value) as { key?: unknown };
    if (typeof parsed.key !== "string") return;

    const replacement = replacements.get(parsed.key);
    if (replacement) formData.set(name, JSON.stringify({ ...parsed, key: replacement }));
  } catch {
    // The server action will handle malformed crop data as it did before.
  }
}

async function uploadImageToCloudinary(original: File): Promise<UploadedAlbumMedia> {
  const optimized = await optimizeAlbumImage(original);
  const signed = await getSignedImageUpload(optimized);
  const formData = createCloudinaryFormData(optimized, signed);
  formData.append("format", signed.format);
  formData.append("transformation", signed.transformation);

  const result = await sendCloudinaryUpload(signed.cloudName, "image", formData);
  return {
    imageUrl: result.secure_url!,
    imagePublicId: `cloudinary:image:${result.public_id!}`,
    mediaType: "IMAGE",
    provider: "CLOUDINARY",
    bytes: result.bytes ?? optimized.size,
    originalBytes: original.size,
    width: result.width,
    height: result.height,
    format: result.format ?? "webp"
  };
}

async function uploadVideoToCloudinary(file: File): Promise<UploadedAlbumMedia> {
  const signed = await getSignedVideoUpload(file);
  const formData = createCloudinaryFormData(file, signed);
  const result = await sendCloudinaryUpload(signed.cloudName, "video", formData);
  return {
    imageUrl: result.secure_url!,
    imagePublicId: `cloudinary:video:${result.public_id!}`,
    mediaType: "VIDEO",
    provider: "CLOUDINARY",
    bytes: result.bytes ?? file.size,
    originalBytes: file.size,
    width: result.width,
    height: result.height,
    format: result.format
  };
}

function createCloudinaryFormData(
  file: File,
  signed: SignedCloudinaryImageUpload | SignedCloudinaryVideoUpload
) {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("api_key", signed.apiKey);
  formData.append("timestamp", String(signed.timestamp));
  formData.append("folder", signed.folder);
  formData.append("signature", signed.signature);
  return formData;
}

async function sendCloudinaryUpload(
  cloudName: string,
  resourceType: "image" | "video",
  formData: FormData
) {
  const response = await fetch(
    `https://api.cloudinary.com/v1_1/${cloudName}/${resourceType}/upload`,
    { method: "POST", body: formData }
  );
  const result = (await response.json()) as CloudinaryUploadResponse;

  if (!response.ok || !result.secure_url || !result.public_id) {
    throw new Error(result.error?.message ?? "Не удалось загрузить медиафайл в Cloudinary.");
  }

  return result;
}

async function getSignedImageUpload(file: File) {
  return getSignedUpload<SignedCloudinaryImageUpload>("/api/uploads/album-image-sign", file);
}

async function getSignedVideoUpload(file: File) {
  return getSignedUpload<SignedCloudinaryVideoUpload>("/api/uploads/album-video-sign", file);
}

async function getSignedUpload<T extends { error?: string }>(url: string, file: File): Promise<T> {
  const response = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ fileName: file.name, contentType: file.type, size: file.size })
  });
  const result = (await response.json()) as T;

  if (!response.ok) {
    throw new Error(result.error ?? "Не удалось подготовить загрузку.");
  }

  return result;
}

async function optimizeAlbumImage(file: File) {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxDimension / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(bitmap.width * scale));
  canvas.height = Math.max(1, Math.round(bitmap.height * scale));
  const context = canvas.getContext("2d");

  if (!context) {
    bitmap.close();
    throw new Error("Не удалось обработать изображение.");
  }

  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();

  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (value) => (value ? resolve(value) : reject(new Error("Ошибка кодирования изображения."))),
      "image/webp",
      optimizedImageQuality
    );
  });

  return new File([blob], replaceExtension(file.name, "webp"), {
    type: "image/webp",
    lastModified: Date.now()
  });
}

function replaceExtension(fileName: string, extension: string) {
  const baseName = fileName.replace(/\.[^.]+$/, "") || "album-photo";
  return `${baseName}.${extension}`;
}

export function getReadableAlbumUploadError(error: unknown) {
  const message = error instanceof Error ? error.message : "Не удалось загрузить медиафайл.";

  if (/maximum|exceed|size|слишком|превыш/i.test(message)) {
    return `Файл превышает лимит загрузки. Фото до ${formatMegabytes(albumImageMaxBytes)} МБ, видео до ${formatMegabytes(albumVideoMaxBytes)} МБ.`;
  }

  return message;
}
