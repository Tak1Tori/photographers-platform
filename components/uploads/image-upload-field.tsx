"use client";

import { ImagePlus, UploadCloud } from "lucide-react";
import { DragEvent, useEffect, useRef, useState } from "react";
import { ImagePreview } from "@/components/uploads/image-preview";
import { cn } from "@/lib/utils";

const accept = "image/jpeg,image/png,image/webp";

export function ImageUploadField({
  name = "image",
  label = "Image file",
  currentUrl,
  previewAlt = "Selected image",
  required = false
}: {
  name?: string;
  label?: string;
  currentUrl?: string;
  previewAlt?: string;
  required?: boolean;
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

  function setFile(file?: File) {
    setError("");

    if (!file) {
      setPreviewUrl(currentUrl ?? "");
      return;
    }
    if (!accept.split(",").includes(file.type)) {
      setError("Поддерживаются JPEG, PNG и WebP.");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setError("Размер файла не должен превышать 5 МБ.");
      return;
    }

    const transfer = new DataTransfer();
    transfer.items.add(file);
    if (inputRef.current) {
      inputRef.current.files = transfer.files;
    }
    setPreviewUrl(URL.createObjectURL(file));
  }

  function handleDrop(event: DragEvent<HTMLLabelElement>) {
    event.preventDefault();
    setIsDragging(false);
    setFile(event.dataTransfer.files?.[0]);
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
        <span className="text-xs text-muted-foreground">JPEG, PNG или WebP, до 5 МБ</span>
        <input
          ref={inputRef}
          type="file"
          name={name}
          accept={accept}
          required={required}
          className="sr-only"
          onChange={(event) => setFile(event.target.files?.[0])}
        />
      </label>
      {error ? <p className="text-sm font-medium text-rose-700">{error}</p> : null}
    </div>
  );
}
