"use client";

import { ImagePlus, UploadCloud } from "lucide-react";
import { DragEvent, useEffect, useRef, useState } from "react";
import { ImagePreview } from "@/components/uploads/image-preview";
import { cn } from "@/lib/utils";

const accept = "image/jpeg,image/png,image/webp";
const optimizedUploadMaxBytes = 3.5 * 1024 * 1024;
const optimizedImageMaxDimension = 2560;

export function ImageUploadField({
  name = "image",
  label = "Image file",
  currentUrl,
  previewAlt = "Selected image",
  required = false,
  maxSizeMb = 5
}: {
  name?: string;
  label?: string;
  currentUrl?: string;
  previewAlt?: string;
  required?: boolean;
  maxSizeMb?: number;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [previewUrl, setPreviewUrl] = useState(currentUrl ?? "");
  const [error, setError] = useState("");
  const [isDragging, setIsDragging] = useState(false);

  useEffect(() => {
    setPreviewUrl(currentUrl ?? "");
  }, [currentUrl]);

  useEffect(() => {
    return () => {
      if (previewUrl.startsWith("blob:")) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

  async function setFile(file?: File) {
    setError("");

    if (!file) {
      setPreviewUrl(currentUrl ?? "");
      return;
    }
    if (!accept.split(",").includes(file.type)) {
      setError("Поддерживаются JPEG, PNG и WebP.");
      return;
    }
    if (file.size > maxSizeMb * 1024 * 1024) {
      setError(`Размер файла не должен превышать ${maxSizeMb} МБ.`);
      return;
    }

    let uploadFile = file;
    if (maxSizeMb > 5 && file.size > optimizedUploadMaxBytes) {
      try {
        uploadFile = await optimizeImage(file);
      } catch {
        setError("Не удалось оптимизировать изображение. Попробуйте другой файл.");
        return;
      }
    }

    const transfer = new DataTransfer();
    transfer.items.add(uploadFile);
    if (inputRef.current) {
      inputRef.current.files = transfer.files;
    }
    setPreviewUrl(URL.createObjectURL(uploadFile));
  }

  function handleDrop(event: DragEvent<HTMLLabelElement>) {
    event.preventDefault();
    setIsDragging(false);
    void setFile(event.dataTransfer.files?.[0]);
  }

  return (
    <div className="grid gap-3">
      <ImagePreview src={previewUrl || currentUrl} alt={previewAlt} />
      <label
        className={cn(
          "flex min-h-28 cursor-pointer flex-col items-center justify-center gap-2 rounded-md border border-dashed border-border bg-secondary/30 px-4 py-5 text-center transition-colors hover:border-primary/60 hover:bg-secondary/60",
          isDragging && "border-primary bg-primary/10"
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
        {previewUrl ? (
          <ImagePlus className="size-5 text-primary" aria-hidden="true" />
        ) : (
          <UploadCloud className="size-5 text-primary" aria-hidden="true" />
        )}
        <span className="text-sm font-medium">{label}</span>
        <span className="text-xs text-muted-foreground">
          Перетащите изображение сюда или нажмите для выбора
        </span>
        <span className="text-xs text-muted-foreground">
          JPEG, PNG или WebP, до {maxSizeMb} МБ
        </span>
        {maxSizeMb > 5 ? (
          <span className="text-xs text-muted-foreground">
            Большие файлы автоматически оптимизируются перед загрузкой
          </span>
        ) : null}
        <input
          ref={inputRef}
          type="file"
          name={name}
          accept={accept}
          required={required}
          className="sr-only"
          onChange={(event) => void setFile(event.target.files?.[0])}
        />
      </label>
      {error ? <p className="text-sm font-medium text-rose-700">{error}</p> : null}
    </div>
  );
}

async function optimizeImage(file: File) {
  const bitmap = await createImageBitmap(file);
  let width = bitmap.width;
  let height = bitmap.height;
  const scale = Math.min(1, optimizedImageMaxDimension / Math.max(width, height));
  width = Math.max(1, Math.round(width * scale));
  height = Math.max(1, Math.round(height * scale));

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");

  if (!context) {
    bitmap.close();
    throw new Error("Canvas is unavailable");
  }

  context.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  for (const quality of [0.9, 0.82, 0.74, 0.66, 0.58, 0.5]) {
    const blob = await canvasToBlob(canvas, quality);
    if (blob.size <= optimizedUploadMaxBytes) {
      return new File([blob], replaceExtension(file.name, "webp"), {
        type: "image/webp",
        lastModified: Date.now()
      });
    }
  }

  throw new Error("Optimized image is still too large");
}

function canvasToBlob(canvas: HTMLCanvasElement, quality: number) {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("Image encoding failed"))),
      "image/webp",
      quality
    );
  });
}

function replaceExtension(fileName: string, extension: string) {
  const baseName = fileName.replace(/\.[^.]+$/, "") || "album-cover";
  return `${baseName}.${extension}`;
}
