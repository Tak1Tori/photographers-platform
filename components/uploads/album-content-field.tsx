"use client";

import Image from "next/image";
import { Images, Trash2, UploadCloud, X } from "lucide-react";
import { DragEvent, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { PortfolioAlbumImage } from "@/lib/types";

const accept = "image/jpeg,image/png,image/webp";
const maxBytes = 25 * 1024 * 1024;
const maxTotalBytes = 120 * 1024 * 1024;
const maxFiles = 20;

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

  function addFiles(fileList: FileList | File[]) {
    setError("");
    const incoming = Array.from(fileList);
    const acceptedFiles: File[] = [];
    const currentBytes = selectedImages.reduce(
      (total, image) => total + image.file.size,
      0
    );

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

    let nextTotalBytes = currentBytes;
    const filesWithinTotalLimit = acceptedFiles.filter((file) => {
      if (nextTotalBytes + file.size > maxTotalBytes) {
        setError("За одно сохранение можно добавить не более 120 МБ.");
        return false;
      }
      nextTotalBytes += file.size;
      return true;
    });

    const availableSlots =
      maxFiles - visibleExistingImages.length - selectedImages.length;
    if (filesWithinTotalLimit.length > availableSlots) {
      setError(`В одном альбоме может быть не более ${maxFiles} изображений.`);
    }

    const nextFiles = filesWithinTotalLimit.slice(0, Math.max(availableSlots, 0));
    const nextImages = [
      ...selectedImages,
      ...nextFiles.map((file) => ({
        file,
        previewUrl: URL.createObjectURL(file)
      }))
    ];
    selectedImagesRef.current = nextImages;
    setSelectedImages(nextImages);
    syncInput(nextImages.map((image) => image.file));
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
    addFiles(event.dataTransfer.files);
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
            До {maxFiles} изображений, каждое до 25 МБ, загрузка до 120 МБ
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
        <input
          ref={inputRef}
          type="file"
          name={name}
          accept={accept}
          multiple
          className="sr-only"
          onChange={(event) => {
            if (event.target.files) {
              addFiles(event.target.files);
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
