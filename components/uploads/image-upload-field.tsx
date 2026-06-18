"use client";

import { useEffect, useState } from "react";
import { ImagePreview } from "@/components/uploads/image-preview";

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
  const [previewUrl, setPreviewUrl] = useState(currentUrl ?? "");
  const [error, setError] = useState("");

  useEffect(() => {
    setPreviewUrl(currentUrl ?? "");
  }, [currentUrl]);

  return (
    <div className="grid gap-3">
      <ImagePreview src={previewUrl || currentUrl} alt={previewAlt} />
      <label className="grid gap-2 text-sm font-medium">
        {label}
        <input
          type="file"
          name={name}
          accept={accept}
          required={required}
          className="block w-full rounded-md border border-input bg-background px-3 py-2 text-sm file:mr-3 file:rounded-md file:border-0 file:bg-secondary file:px-3 file:py-1.5 file:text-sm file:font-medium"
          onChange={(event) => {
            setError("");
            const file = event.target.files?.[0];
            if (!file) {
              setPreviewUrl(currentUrl ?? "");
              return;
            }
            if (!accept.split(",").includes(file.type)) {
              setError("JPEG, PNG или WebP.");
              setPreviewUrl(currentUrl ?? "");
              return;
            }
            if (file.size > 5 * 1024 * 1024) {
              setError("Максимум 5MB.");
              setPreviewUrl(currentUrl ?? "");
              return;
            }
            setPreviewUrl(URL.createObjectURL(file));
          }}
        />
      </label>
      {error ? <p className="text-sm font-medium text-rose-700">{error}</p> : null}
    </div>
  );
}
