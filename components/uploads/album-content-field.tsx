"use client";

import Image from "next/image";
import { Film, Images, LoaderCircle, Play, Trash2, UploadCloud, X } from "lucide-react";
import { DragEvent, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { PortfolioAlbumImage } from "@/lib/types";

const accept =
  "image/jpeg,image/png,image/webp,video/mp4,video/webm,video/quicktime";
const allowedTypes = new Set(accept.split(","));
const imageMaxBytes = 25 * 1024 * 1024;
const videoMaxBytes = 100 * 1024 * 1024;
const optimizedImageMaxBytes = 2 * 1024 * 1024;
const maxFiles = 20;
const maxDimension = 1920;

interface UploadedMedia {
  imageUrl: string;
  imagePublicId: string;
  mediaType: "IMAGE" | "VIDEO";
  fileName: string;
  previewUrl: string;
}

interface SignedUpload {
  path: string;
  token: string;
  publicUrl: string;
  publicId: string;
  supabaseUrl: string;
  publishableKey: string;
  bucket: string;
  error?: string;
}

export function AlbumContentField({
  name,
  existingImages = []
}: {
  name: string;
  existingImages?: PortfolioAlbumImage[];
}) {
  const selectedMediaRef = useRef<UploadedMedia[]>([]);
  const [selectedMedia, setSelectedMedia] = useState<UploadedMedia[]>([]);
  const [removedIds, setRemovedIds] = useState<string[]>([]);
  const [error, setError] = useState("");
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [progress, setProgress] = useState("");

  useEffect(() => {
    return () => {
      selectedMediaRef.current.forEach((media) =>
        URL.revokeObjectURL(media.previewUrl)
      );
    };
  }, []);

  const visibleExistingMedia = existingImages.filter(
    (media) => !removedIds.includes(media.id)
  );

  async function addFiles(fileList: FileList | File[]) {
    setError("");
    const incoming = Array.from(fileList);
    const availableSlots =
      maxFiles - visibleExistingMedia.length - selectedMedia.length;
    const files = incoming.slice(0, Math.max(availableSlots, 0));

    if (incoming.length > availableSlots) {
      setError(`В одном альбоме может быть не более ${maxFiles} файлов.`);
    }
    if (!files.length) return;

    for (const file of files) {
      if (!allowedTypes.has(file.type)) {
        setError("Поддерживаются JPEG, PNG, WebP, MP4, WebM и MOV.");
        return;
      }

      const isVideo = file.type.startsWith("video/");
      const limit = isVideo ? videoMaxBytes : imageMaxBytes;
      if (file.size > limit) {
        setError(
          isVideo
            ? "Размер видео не должен превышать 100 МБ."
            : "Размер изображения не должен превышать 25 МБ."
        );
        return;
      }
    }

    setIsUploading(true);
    const uploaded: UploadedMedia[] = [];

    try {
      for (let index = 0; index < files.length; index += 1) {
        const original = files[index];
        const isVideo = original.type.startsWith("video/");
        setProgress(`Загружаем ${index + 1} из ${files.length}`);
        const file = isVideo ? original : await optimizeAlbumImage(original);
        const signed = await getSignedUpload(file);
        const { createClient } = await import("@supabase/supabase-js");
        const supabase = createClient(signed.supabaseUrl, signed.publishableKey, {
          auth: { persistSession: false, autoRefreshToken: false }
        });
        const { error: uploadError } = await supabase.storage
          .from(signed.bucket)
          .uploadToSignedUrl(signed.path, signed.token, file, {
            contentType: file.type,
            cacheControl: "31536000"
          });

        if (uploadError) throw uploadError;

        uploaded.push({
          imageUrl: signed.publicUrl,
          imagePublicId: signed.publicId,
          mediaType: isVideo ? "VIDEO" : "IMAGE",
          fileName: original.name,
          previewUrl: URL.createObjectURL(file)
        });
      }

      const next = [...selectedMedia, ...uploaded];
      selectedMediaRef.current = next;
      setSelectedMedia(next);
    } catch (uploadError) {
      await Promise.all(
        uploaded.map((media) => deleteUploadedMedia(media.imagePublicId))
      );
      uploaded.forEach((media) => URL.revokeObjectURL(media.previewUrl));
      setError(
        uploadError instanceof Error
          ? uploadError.message
          : "Не удалось загрузить медиафайл."
      );
    } finally {
      setIsUploading(false);
      setProgress("");
    }
  }

  function handleDrop(event: DragEvent<HTMLLabelElement>) {
    event.preventDefault();
    setIsDragging(false);
    void addFiles(event.dataTransfer.files);
  }

  async function removeSelected(index: number) {
    const media = selectedMedia[index];
    const next = selectedMedia.filter((_, mediaIndex) => mediaIndex !== index);
    selectedMediaRef.current = next;
    setSelectedMedia(next);
    URL.revokeObjectURL(media.previewUrl);
    await deleteUploadedMedia(media.imagePublicId);
  }

  return (
    <div className="grid gap-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-medium">Содержимое альбома</p>
          <p className="text-xs text-muted-foreground">
            До {maxFiles} фото и видео · фото до 25 МБ · видео до 100 МБ
          </p>
        </div>
        <span className="text-xs text-muted-foreground">
          {visibleExistingMedia.length + selectedMedia.length}/{maxFiles}
        </span>
      </div>

      {visibleExistingMedia.length || selectedMedia.length ? (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {visibleExistingMedia.map((media) => (
            <MediaPreview
              key={media.id}
              media={media}
              onRemove={() => setRemovedIds((ids) => [...ids, media.id])}
            />
          ))}
          {selectedMedia.map((media, index) => (
            <MediaPreview
              key={media.imagePublicId}
              media={media}
              selected
              onRemove={() => void removeSelected(index)}
            />
          ))}
        </div>
      ) : (
        <div className="flex min-h-24 items-center justify-center rounded-md border border-dashed border-border text-muted-foreground">
          <Images className="mr-2 size-5" aria-hidden="true" />
          <span className="text-sm">Альбом пока пуст</span>
        </div>
      )}

      <label
        className={cn(
          "flex min-h-36 cursor-pointer flex-col items-center justify-center gap-2 rounded-md border border-dashed border-border bg-secondary/30 px-5 py-6 text-center transition-colors hover:border-primary/60 hover:bg-secondary/60",
          isDragging && "border-primary bg-primary/10",
          isUploading && "pointer-events-none opacity-70"
        )}
        onDragEnter={(event) => {
          event.preventDefault();
          setIsDragging(true);
        }}
        onDragOver={(event) => event.preventDefault()}
        onDragLeave={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
            setIsDragging(false);
          }
        }}
        onDrop={handleDrop}
      >
        {isUploading ? (
          <LoaderCircle className="size-6 animate-spin text-primary" aria-hidden="true" />
        ) : (
          <UploadCloud className="size-6 text-primary" aria-hidden="true" />
        )}
        <span className="text-sm font-medium">
          {isUploading ? progress : "Добавить фото или видео"}
        </span>
        <span className="text-xs text-muted-foreground">
          Перетащите несколько файлов или нажмите для выбора
        </span>
        <input
          type="file"
          accept={accept}
          multiple
          disabled={isUploading}
          className="sr-only"
          onChange={(event) => {
            if (event.target.files) void addFiles(event.target.files);
            event.currentTarget.value = "";
          }}
        />
      </label>

      {selectedMedia.map((media) => (
        <input
          key={media.imagePublicId}
          type="hidden"
          name={`uploadedMedia:${name}`}
          value={JSON.stringify({
            imageUrl: media.imageUrl,
            imagePublicId: media.imagePublicId,
            mediaType: media.mediaType
          })}
        />
      ))}
      {removedIds.map((id) => (
        <input key={id} type="hidden" name="removeAlbumImageIds" value={id} />
      ))}
      {error ? <p className="text-sm font-medium text-rose-700">{error}</p> : null}
    </div>
  );
}

function MediaPreview({
  media,
  selected = false,
  onRemove
}: {
  media: Pick<
    PortfolioAlbumImage,
    "imageUrl" | "mediaType"
  > & { previewUrl?: string; fileName?: string };
  selected?: boolean;
  onRemove: () => void;
}) {
  const source = media.previewUrl ?? media.imageUrl;
  const isVideo = media.mediaType === "VIDEO";

  return (
    <div
      className={cn(
        "group relative aspect-square overflow-hidden rounded-md border",
        selected ? "border-primary/40" : "border-border"
      )}
    >
      {isVideo ? (
        <video
          src={source}
          muted
          playsInline
          preload="metadata"
          className="size-full object-cover"
        />
      ) : (
        <Image src={source} alt="Кадр альбома" fill className="object-cover" />
      )}
      {isVideo ? (
        <span className="absolute bottom-1 left-1 flex items-center gap-1 rounded bg-background/85 px-2 py-1 text-xs">
          <Play className="size-3 fill-current" aria-hidden="true" />
          Видео
        </span>
      ) : null}
      <Button
        type="button"
        size="sm"
        variant="secondary"
        className="absolute right-1 top-1 size-8"
        aria-label={selected ? "Убрать выбранный файл" : "Удалить файл из альбома"}
        onClick={onRemove}
      >
        {selected ? (
          <X className="size-4" aria-hidden="true" />
        ) : (
          <Trash2 className="size-4" aria-hidden="true" />
        )}
      </Button>
      {isVideo ? <Film className="sr-only" aria-hidden="true" /> : null}
    </div>
  );
}

async function getSignedUpload(file: File): Promise<SignedUpload> {
  const response = await fetch("/api/uploads/album-sign", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      fileName: file.name,
      contentType: file.type,
      size: file.size
    })
  });
  const result = (await response.json()) as SignedUpload;

  if (!response.ok) {
    throw new Error(result.error ?? "Не удалось подготовить загрузку.");
  }

  return result;
}

async function deleteUploadedMedia(publicId: string) {
  await fetch("/api/uploads/delete", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ publicId })
  });
}

async function optimizeAlbumImage(file: File) {
  if (file.size <= optimizedImageMaxBytes) return file;

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

  for (const quality of [0.86, 0.74, 0.62, 0.5, 0.4]) {
    const blob = await canvasToBlob(canvas, quality);
    if (blob.size <= optimizedImageMaxBytes) {
      return new File([blob], replaceExtension(file.name, "webp"), {
        type: "image/webp",
        lastModified: Date.now()
      });
    }
  }

  throw new Error("Изображение не удалось оптимизировать.");
}

function canvasToBlob(canvas: HTMLCanvasElement, quality: number) {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("Ошибка кодирования"))),
      "image/webp",
      quality
    );
  });
}

function replaceExtension(fileName: string, extension: string) {
  const baseName = fileName.replace(/\.[^.]+$/, "") || "album-photo";
  return `${baseName}.${extension}`;
}
