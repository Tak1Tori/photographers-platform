"use client";

import Image from "next/image";
import { ImagePlus, UploadCloud } from "lucide-react";
import { DragEvent, useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

const accept = "image/jpeg,image/png,image/webp";
const optimizedUploadMaxBytes = 1.2 * 1024 * 1024;
const optimizedImageMaxDimension = 2560;

type SelectedPreview = {
  id: string;
  url: string;
};

export function MultiImageUploadField({
  name = "images",
  label = "Фотографии",
  maxFiles = 7,
  maxSizeMb = 25
}: {
  name?: string;
  label?: string;
  maxFiles?: number;
  maxSizeMb?: number;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [previews, setPreviews] = useState<SelectedPreview[]>([]);
  const [error, setError] = useState("");
  const [isDragging, setIsDragging] = useState(false);

  useEffect(() => {
    return () => {
      previews.forEach((preview) => URL.revokeObjectURL(preview.url));
    };
  }, [previews]);

  async function setFiles(fileList?: FileList | File[]) {
    setError("");

    const incoming = Array.from(fileList ?? []);
    if (incoming.length === 0) {
      setPreviews([]);
      if (inputRef.current) inputRef.current.value = "";
      return;
    }

    if (incoming.length > maxFiles) {
      setError(`Можно загрузить максимум ${maxFiles} фото.`);
      return;
    }

    const transfer = new DataTransfer();
    const nextPreviews: SelectedPreview[] = [];

    for (const file of incoming) {
      if (!accept.split(",").includes(file.type)) {
        setError("Поддерживаются JPEG, PNG и WebP.");
        return;
      }
      if (file.size > maxSizeMb * 1024 * 1024) {
        setError(`Каждый файл должен быть не больше ${maxSizeMb} МБ.`);
        return;
      }

      let uploadFile = file;
      if (maxSizeMb > 5 && file.size > optimizedUploadMaxBytes) {
        try {
          uploadFile = await optimizeImage(file);
        } catch {
          setError("Не удалось оптимизировать одно из изображений. Попробуйте другой файл.");
          return;
        }
      }

      transfer.items.add(uploadFile);
      nextPreviews.push({
        id: `${uploadFile.name}-${uploadFile.lastModified}-${uploadFile.size}`,
        url: URL.createObjectURL(uploadFile)
      });
    }

    previews.forEach((preview) => URL.revokeObjectURL(preview.url));
    if (inputRef.current) inputRef.current.files = transfer.files;
    setPreviews(nextPreviews);
  }

  function handleDrop(event: DragEvent<HTMLLabelElement>) {
    event.preventDefault();
    setIsDragging(false);
    void setFiles(event.dataTransfer.files);
  }

  return (
    <div className="grid gap-3">
      <label
        className={cn(
          "flex min-h-32 cursor-pointer flex-col items-center justify-center gap-2 rounded-md border border-dashed border-border bg-secondary/30 px-4 py-5 text-center transition-colors hover:border-primary/60 hover:bg-secondary/60",
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
        {previews.length > 0 ? (
          <ImagePlus className="size-5 text-primary" aria-hidden="true" />
        ) : (
          <UploadCloud className="size-5 text-primary" aria-hidden="true" />
        )}
        <span className="text-sm font-medium">{label}</span>
        <span className="text-xs text-muted-foreground">
          Перетащите фото сюда или нажмите для выбора
        </span>
        <span className="text-xs text-muted-foreground">
          JPEG, PNG или WebP, до {maxSizeMb} МБ каждое
        </span>
        <input
          ref={inputRef}
          type="file"
          name={name}
          accept={accept}
          multiple
          className="sr-only"
          onChange={(event) => void setFiles(event.target.files ?? undefined)}
        />
      </label>
      {previews.length > 0 ? (
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
          {previews.map((preview) => (
            <div key={preview.id} className="relative aspect-square overflow-hidden rounded-md border border-border">
              <Image src={preview.url} alt="Новое фото галереи" fill className="object-cover" />
            </div>
          ))}
        </div>
      ) : null}
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
  const baseName = fileName.replace(/\.[^.]+$/, "") || "hall-gallery";
  return `${baseName}.${extension}`;
}
