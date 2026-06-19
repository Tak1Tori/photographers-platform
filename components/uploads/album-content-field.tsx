"use client";

import Image from "next/image";
import { Images, Trash2, UploadCloud, X } from "lucide-react";
import { DragEvent, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { PortfolioAlbumImage } from "@/lib/types";

const accept = "image/jpeg,image/png,image/webp";
const maxBytes = 25 * 1024 * 1024;
const maxUploadBytes = 2.5 * 1024 * 1024;
const maxFiles = 20;
const maxDimension = 1920;

interface SelectedImage {
  file: File;
  previewUrl: string;
}

export function AlbumContentField({
  name,
  existingImages = []
}: {
  name: string;
  existingImages?: PortfolioAlbumImage[];
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const selectedImagesRef = useRef<SelectedImage[]>([]);
  const [selectedImages, setSelectedImages] = useState<SelectedImage[]>([]);
  const [removedIds, setRemovedIds] = useState<string[]>([]);
  const [error, setError] = useState("");
  const [isDragging, setIsDragging] = useState(false);
  const [isOptimizing, setIsOptimizing] = useState(false);

  useEffect(() => {
    return () => {
      selectedImagesRef.current.forEach((image) =>
        URL.revokeObjectURL(image.previewUrl)
      );
    };
  }, []);

  const visibleExistingImages = existingImages.filter(
    (image) => !removedIds.includes(image.id)
  );

  async function addFiles(fileList: FileList | File[]) {
    setError("");
    const incoming = Array.from(fileList);
    const acceptedFiles: File[] = [];

    for (const file of incoming) {
      if (!accept.split(",").includes(file.type)) {
        setError("Поддерживаются только JPEG, PNG и WebP.");
        continue;
      }
      if (file.size > maxBytes) {
        setError("Один файл не должен превышать 25 МБ.");
        continue;
      }
      acceptedFiles.push(file);
    }

    const availableSlots =
      maxFiles - visibleExistingImages.length - selectedImages.length;
    if (acceptedFiles.length > availableSlots) {
      setError(`В одном альбоме может быть не более ${maxFiles} изображений.`);
    }

    const nextFiles = acceptedFiles.slice(0, Math.max(availableSlots, 0));
    if (!nextFiles.length) return;

    setIsOptimizing(true);
    let optimizedFiles: File[];

    try {
      optimizedFiles = await optimizeAlbumFiles([
        ...selectedImages.map((image) => image.file),
        ...nextFiles
      ]);
    } catch {
      setError(
        "Не удалось подготовить фотографии к загрузке. Попробуйте уменьшить их количество."
      );
      setIsOptimizing(false);
      return;
    }

    selectedImagesRef.current.forEach((image) =>
      URL.revokeObjectURL(image.previewUrl)
    );
    const nextImages = [
      ...optimizedFiles.map((file) => ({
        file,
        previewUrl: URL.createObjectURL(file)
      }))
    ];
    selectedImagesRef.current = nextImages;
    setSelectedImages(nextImages);
    syncInput(nextImages.map((image) => image.file));
    setIsOptimizing(false);
  }

  function syncInput(files: File[]) {
    const transfer = new DataTransfer();
    files.forEach((file) => transfer.items.add(file));
    if (inputRef.current) {
      inputRef.current.files = transfer.files;
    }
  }

  function handleDrop(event: DragEvent<HTMLLabelElement>) {
    event.preventDefault();
    setIsDragging(false);
    void addFiles(event.dataTransfer.files);
  }

  function removeSelected(index: number) {
    const image = selectedImages[index];
    URL.revokeObjectURL(image.previewUrl);
    const nextImages = selectedImages.filter((_, imageIndex) => imageIndex !== index);
    selectedImagesRef.current = nextImages;
    setSelectedImages(nextImages);
    syncInput(nextImages.map((item) => item.file));
  }

  return (
    <div className="grid gap-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-medium">Содержимое альбома</p>
          <p className="text-xs text-muted-foreground">
            До {maxFiles} изображений, исходный файл до 25 МБ
          </p>
        </div>
        <span className="text-xs text-muted-foreground">
          {visibleExistingImages.length + selectedImages.length}/{maxFiles}
        </span>
      </div>

      {visibleExistingImages.length || selectedImages.length ? (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {visibleExistingImages.map((image) => (
            <div
              key={image.id}
              className="group relative aspect-square overflow-hidden rounded-md border border-border"
            >
              <Image src={image.imageUrl} alt="Кадр альбома" fill className="object-cover" />
              <Button
                type="button"
                size="sm"
                variant="secondary"
                className="absolute right-1 top-1 size-8"
                aria-label="Удалить кадр из альбома"
                onClick={() => setRemovedIds((ids) => [...ids, image.id])}
              >
                <Trash2 className="size-4" aria-hidden="true" />
              </Button>
            </div>
          ))}
          {selectedImages.map((image, index) => (
            <div
              key={`${image.file.name}-${image.file.lastModified}-${index}`}
              className="relative aspect-square overflow-hidden rounded-md border border-primary/40"
            >
              <Image src={image.previewUrl} alt={image.file.name} fill className="object-cover" />
              <Button
                type="button"
                size="sm"
                variant="secondary"
                className="absolute right-1 top-1 size-8"
                aria-label="Убрать выбранный файл"
                onClick={() => removeSelected(index)}
              >
                <X className="size-4" aria-hidden="true" />
              </Button>
            </div>
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
        <UploadCloud className="size-6 text-primary" aria-hidden="true" />
        <span className="text-sm font-medium">Добавить фотографии в альбом</span>
        <span className="text-xs text-muted-foreground">
          Перетащите сразу несколько файлов или нажмите для выбора
        </span>
        <span className="text-xs text-muted-foreground">
          {isOptimizing
            ? "Оптимизируем изображения..."
            : "Перед отправкой фотографии автоматически оптимизируются"}
        </span>
        <input
          ref={inputRef}
          type="file"
          name={name}
          accept={accept}
          multiple
          className="sr-only"
          onChange={(event) => {
            if (event.target.files) {
              void addFiles(event.target.files);
            }
          }}
        />
      </label>

      {removedIds.map((id) => (
        <input key={id} type="hidden" name="removeAlbumImageIds" value={id} />
      ))}
      {error ? <p className="text-sm font-medium text-rose-700">{error}</p> : null}
    </div>
  );
}

async function optimizeAlbumFiles(files: File[]) {
  const targetBytesPerFile = Math.max(
    90 * 1024,
    Math.floor(maxUploadBytes / Math.max(files.length, 1))
  );

  return Promise.all(
    files.map((file, index) => optimizeAlbumImage(file, targetBytesPerFile, index))
  );
}

async function optimizeAlbumImage(file: File, targetBytes: number, index: number) {
  const bitmap = await createImageBitmap(file);
  const initialScale = Math.min(1, maxDimension / Math.max(bitmap.width, bitmap.height));
  let width = Math.max(1, Math.round(bitmap.width * initialScale));
  let height = Math.max(1, Math.round(bitmap.height * initialScale));

  try {
    for (const dimensionScale of [1, 0.85, 0.7, 0.55]) {
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(width * dimensionScale));
      canvas.height = Math.max(1, Math.round(height * dimensionScale));
      const context = canvas.getContext("2d");
      if (!context) throw new Error("Canvas is unavailable");

      context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);

      for (const quality of [0.86, 0.74, 0.62, 0.5, 0.4, 0.32]) {
        const blob = await canvasToBlob(canvas, quality);
        if (blob.size <= targetBytes) {
          return new File([blob], albumFileName(file.name, index), {
            type: "image/webp",
            lastModified: Date.now()
          });
        }
      }
    }
  } finally {
    bitmap.close();
  }

  throw new Error("Image cannot fit the upload budget");
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

function albumFileName(fileName: string, index: number) {
  const baseName = fileName.replace(/\.[^.]+$/, "") || `album-photo-${index + 1}`;
  return `${baseName}.webp`;
}
