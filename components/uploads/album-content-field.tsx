"use client";

import Image from "next/image";
import {
  Film,
  Images,
  LoaderCircle,
  Play,
  Scan,
  Trash2,
  UploadCloud
} from "lucide-react";
import {
  DragEvent,
  PointerEvent,
  useEffect,
  useRef,
  useState
} from "react";
import { Button } from "@/components/ui/button";
import { getCloudinaryVideoPosterUrl } from "@/lib/cloudinary-media";
import { getCoverCropPresentation } from "@/lib/cover-crop";
import {
  albumImageMaxBytes,
  albumMediaMaxFiles,
  albumVideoMaxBytes,
  formatMegabytes
} from "@/lib/upload-limits";
import { cn } from "@/lib/utils";
import type { PortfolioAlbumImage } from "@/lib/types";

const accept =
  "image/jpeg,image/png,image/webp,video/mp4,video/webm,video/quicktime";
const allowedTypes = new Set(accept.split(","));
const maxDimension = 1920;
const optimizedImageQuality = 0.82;

interface UploadedMedia {
  imageUrl: string;
  imagePublicId: string;
  mediaType: "IMAGE" | "VIDEO";
  provider: "CLOUDINARY" | "SUPABASE" | "LOCAL";
  bytes: number;
  originalBytes: number;
  width?: number;
  height?: number;
  format?: string;
  fileName: string;
  previewUrl: string;
}

type MediaSource = "existing" | "uploaded";

type AlbumMediaItem = {
  key: string;
  source: MediaSource;
  id?: string;
  imageUrl: string;
  imagePublicId?: string;
  mediaType: "IMAGE" | "VIDEO";
  fileName?: string;
  previewUrl?: string;
};

type AlbumCoverCrop = {
  key: string;
  x: number;
  y: number;
  width: number;
  height: number;
};

interface SignedCloudinaryImageUpload {
  cloudName: string;
  apiKey: string;
  folder: string;
  format: string;
  timestamp: number;
  transformation: string;
  signature: string;
  error?: string;
}

interface SignedCloudinaryVideoUpload {
  cloudName: string;
  apiKey: string;
  folder: string;
  timestamp: number;
  signature: string;
  error?: string;
}

interface CloudinaryVideoUploadResult {
  secure_url?: string;
  public_id?: string;
  bytes?: number;
  width?: number;
  height?: number;
  format?: string;
  error?: {
    message?: string;
  };
}

interface CloudinaryImageUploadResult extends CloudinaryVideoUploadResult {}

export function AlbumContentField({
  name,
  existingImages = [],
  initialCoverCrop
}: {
  name: string;
  existingImages?: PortfolioAlbumImage[];
  initialCoverCrop?: {
    x?: number | null;
    y?: number | null;
    width?: number | null;
    height?: number | null;
  };
}) {
  const selectedMediaRef = useRef<UploadedMedia[]>([]);
  const [selectedMedia, setSelectedMedia] = useState<UploadedMedia[]>([]);
  const [removedIds, setRemovedIds] = useState<string[]>([]);
  const [error, setError] = useState("");
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [progress, setProgress] = useState("");
  const [draggedMediaKey, setDraggedMediaKey] = useState("");
  const [cropTarget, setCropTarget] = useState<AlbumMediaItem | null>(null);
  const initialCoverMedia = existingImages.find(
    (media) => media.mediaType === "IMAGE"
  );
  const initialCoverMediaKey = initialCoverMedia
    ? getMediaKey(initialCoverMedia)
    : "";
  const [coverCrop, setCoverCrop] = useState<AlbumCoverCrop | null>(() =>
    getInitialCoverCrop(initialCoverMediaKey, initialCoverCrop)
  );
  const [mediaOrder, setMediaOrder] = useState<string[]>(() =>
    existingImages.map(getMediaKey).filter(Boolean)
  );

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
  const mediaItems = [
    ...visibleExistingMedia.map(
      (media): AlbumMediaItem => ({
        key: getMediaKey(media),
        source: "existing",
        id: media.id,
        imageUrl: media.imageUrl,
        imagePublicId: media.imagePublicId,
        mediaType: media.mediaType
      })
    ),
    ...selectedMedia.map(
      (media): AlbumMediaItem => ({
        key: getMediaKey(media),
        source: "uploaded",
        imageUrl: media.imageUrl,
        imagePublicId: media.imagePublicId,
        mediaType: media.mediaType,
        fileName: media.fileName,
        previewUrl: media.previewUrl
      })
    )
  ].filter((media) => Boolean(media.key));
  const orderedMediaItems = orderMediaItems(mediaItems, mediaOrder);
  const imageMediaItems = orderedMediaItems.filter(
    (media) => media.mediaType === "IMAGE"
  );
  const coverMedia = imageMediaItems[0];
  const coverMediaKey = coverMedia?.key ?? "";
  const activeCoverCrop =
    coverMedia && coverCrop?.key === coverMedia.key
      ? coverCrop
      : coverMedia
        ? getDefaultCoverCrop(coverMedia.key)
        : null;

  useEffect(() => {
    if (!coverMediaKey) {
      setCoverCrop(null);
      return;
    }

    setCoverCrop((currentCrop) =>
      currentCrop?.key === coverMediaKey
        ? currentCrop
        : getInitialCoverCrop(
            coverMediaKey,
            coverMediaKey === initialCoverMediaKey ? initialCoverCrop : undefined
          ) ?? getDefaultCoverCrop(coverMediaKey)
    );
  }, [coverMediaKey, initialCoverMediaKey, initialCoverCrop]);

  useEffect(() => {
    setMediaOrder((currentOrder) => {
      const availableKeys = mediaItems.map((media) => media.key);
      const availableKeySet = new Set(availableKeys);
      const nextOrder = [
        ...currentOrder.filter((key) => availableKeySet.has(key)),
        ...availableKeys.filter((key) => !currentOrder.includes(key))
      ];

      return areStringArraysEqual(currentOrder, nextOrder) ? currentOrder : nextOrder;
    });

  }, [mediaItems]);

  async function addFiles(fileList: FileList | File[]) {
    setError("");
    const incoming = Array.from(fileList);
    const availableSlots =
      albumMediaMaxFiles - visibleExistingMedia.length - selectedMedia.length;
    const files = incoming.slice(0, Math.max(availableSlots, 0));

    if (incoming.length > availableSlots) {
      setError(`В одном альбоме может быть не более ${albumMediaMaxFiles} файлов.`);
    }
    if (!files.length) return;

    for (const file of files) {
      if (!allowedTypes.has(file.type)) {
        setError("Поддерживаются JPEG, PNG, WebP, MP4, WebM и MOV.");
        return;
      }

      const isVideo = file.type.startsWith("video/");
      const limit = isVideo ? albumVideoMaxBytes : albumImageMaxBytes;
      if (file.size > limit) {
        setError(
          isVideo
            ? `Размер видео не должен превышать ${formatMegabytes(albumVideoMaxBytes)} МБ.`
            : `Размер изображения не должен превышать ${formatMegabytes(albumImageMaxBytes)} МБ.`
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
        if (isVideo) {
          uploaded.push(await uploadVideoToCloudinary(original));
          continue;
        }

        const optimized = await optimizeAlbumImage(original);
        uploaded.push(await uploadImageToCloudinary(optimized, original));
      }

      const next = [...selectedMedia, ...uploaded];
      selectedMediaRef.current = next;
      setSelectedMedia(next);
      setMediaOrder((currentOrder) => [
        ...currentOrder,
        ...uploaded.map(getMediaKey).filter((key) => !currentOrder.includes(key))
      ]);
    } catch (uploadError) {
      await Promise.all(
        uploaded.map((media) => deleteUploadedMedia(media.imagePublicId))
      );
      uploaded.forEach((media) => URL.revokeObjectURL(media.previewUrl));
      setError(getReadableUploadError(uploadError));
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
    const mediaKey = getMediaKey(media);
    selectedMediaRef.current = next;
    setSelectedMedia(next);
    setMediaOrder((order) => order.filter((key) => key !== mediaKey));
    URL.revokeObjectURL(media.previewUrl);
    await deleteUploadedMedia(media.imagePublicId);
  }

  async function removeMedia(media: AlbumMediaItem) {
    setMediaOrder((order) => order.filter((key) => key !== media.key));

    if (media.source === "existing" && media.id) {
      setRemovedIds((ids) => [...ids, media.id!]);
      return;
    }

    const selectedIndex = selectedMedia.findIndex(
      (item) => getMediaKey(item) === media.key
    );
    if (selectedIndex >= 0) {
      await removeSelected(selectedIndex);
    }
  }

  function moveMediaToTarget(draggedKey: string, targetKey: string) {
    if (!draggedKey || !targetKey || draggedKey === targetKey) return;

    const keys = orderedMediaItems.map((media) => media.key);
    const nextKeys = keys.filter((key) => key !== draggedKey);
    const targetIndex = nextKeys.indexOf(targetKey);

    if (targetIndex < 0) return;

    nextKeys.splice(targetIndex, 0, draggedKey);
    setMediaOrder(nextKeys);
  }

  return (
    <div className="grid gap-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-medium">Содержимое альбома</p>
          <p className="text-xs text-muted-foreground">
            До {albumMediaMaxFiles} фото и видео · фото до{" "}
            {formatMegabytes(albumImageMaxBytes)} МБ · видео до{" "}
            {formatMegabytes(albumVideoMaxBytes)} МБ
          </p>
        </div>
        <span className="text-xs text-muted-foreground">
          {visibleExistingMedia.length + selectedMedia.length}/{albumMediaMaxFiles}
        </span>
      </div>

      {coverMedia ? (
        <AlbumCoverPreview
          media={coverMedia}
          crop={activeCoverCrop}
          onEdit={() => setCropTarget(coverMedia)}
        />
      ) : null}

      {orderedMediaItems.length ? (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
            {orderedMediaItems.map((media) => (
              <MediaPreview
                key={media.key}
                media={media}
                isDragging={draggedMediaKey === media.key}
                isCover={media.key === coverMedia?.key}
                selected={media.source === "uploaded"}
                onDragStart={(event) => {
                  setDraggedMediaKey(media.key);
                  event.dataTransfer.effectAllowed = "move";
                  event.dataTransfer.setData("text/plain", media.key);
                }}
                onDragOver={(event) => {
                  event.preventDefault();
                  event.dataTransfer.dropEffect = "move";
                }}
                onDrop={(event) => {
                  event.preventDefault();
                  moveMediaToTarget(
                    event.dataTransfer.getData("text/plain") || draggedMediaKey,
                    media.key
                  );
                  setDraggedMediaKey("");
                }}
                onDragEnd={() => setDraggedMediaKey("")}
                onRemove={() => void removeMedia(media)}
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
            mediaType: media.mediaType,
            provider: media.provider,
            bytes: media.bytes,
            originalBytes: media.originalBytes,
            width: media.width,
            height: media.height,
            format: media.format
          })}
        />
      ))}
      <input
        type="hidden"
        name={`mediaOrder:${name}`}
        value={JSON.stringify(orderedMediaItems.map((media) => media.key))}
      />
      <input type="hidden" name={`coverMedia:${name}`} value={coverMedia?.key ?? ""} />
      <input
        type="hidden"
        name={`coverCrop:${name}`}
        value={
          coverMedia && coverCrop?.key === coverMedia.key
            ? JSON.stringify(coverCrop)
            : ""
        }
      />
      {removedIds.map((id) => (
        <input key={id} type="hidden" name="removeAlbumImageIds" value={id} />
      ))}
      {error ? <p className="text-sm font-medium text-rose-700">{error}</p> : null}

      {cropTarget ? (
        <CoverCropDialog
          media={cropTarget}
          value={
            coverCrop?.key === cropTarget.key
              ? coverCrop
              : getDefaultCoverCrop(cropTarget.key)
          }
          onChange={setCoverCrop}
          onClose={() => setCropTarget(null)}
        />
      ) : null}
    </div>
  );
}

function AlbumCoverPreview({
  media,
  crop,
  onEdit
}: {
  media: AlbumMediaItem;
  crop: AlbumCoverCrop | null;
  onEdit: () => void;
}) {
  const source = media.previewUrl ?? media.imageUrl;
  const presentation = getCoverCropPresentation(crop ?? {});

  return (
    <div className="group relative aspect-[16/9] overflow-hidden rounded-lg border border-border bg-background">
      <Image
        src={source}
        alt={media.fileName || "Обложка альбома"}
        fill
        unoptimized={Boolean(media.previewUrl)}
        draggable={false}
        className="object-cover transition duration-200"
        sizes="(max-width: 768px) 100vw, 720px"
        style={presentation}
      />
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-background/60 via-transparent to-background/25" />
      <Button
        type="button"
        size="sm"
        variant="secondary"
        className="absolute right-3 top-3 size-10 rounded-md border border-white/25 bg-background/90 text-foreground shadow-md backdrop-blur hover:bg-background"
        aria-label="Выбрать область обложки"
        title="Кадрировать обложку"
        onClick={onEdit}
      >
        <Scan className="size-5" aria-hidden="true" />
      </Button>
      <span className="absolute bottom-3 left-3 rounded-md bg-background/80 px-3 py-1 text-xs text-muted-foreground backdrop-blur">
        Обложка альбома
      </span>
    </div>
  );
}

function MediaPreview({
  media,
  selected = false,
  isCover,
  isDragging,
  onDragStart,
  onDragOver,
  onDrop,
  onDragEnd,
  onRemove
}: {
  media: AlbumMediaItem;
  selected?: boolean;
  isCover: boolean;
  isDragging?: boolean;
  onDragStart: (event: DragEvent<HTMLDivElement>) => void;
  onDragOver: (event: DragEvent<HTMLDivElement>) => void;
  onDrop: (event: DragEvent<HTMLDivElement>) => void;
  onDragEnd: () => void;
  onRemove: () => void;
}) {
  const source = media.previewUrl ?? media.imageUrl;
  const isVideo = media.mediaType === "VIDEO";
  const videoPoster = isVideo ? getCloudinaryVideoPosterUrl(media.imageUrl) : "";

  return (
    <div
      draggable
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDrop={onDrop}
      onDragEnd={onDragEnd}
      className={cn(
        "group relative aspect-[4/5] cursor-grab overflow-hidden rounded-md border bg-secondary/20 transition active:cursor-grabbing",
        selected ? "border-primary/40" : "border-border",
        isCover && "border-primary/70",
        isDragging && "scale-[0.98] opacity-45"
      )}
    >
      {isVideo ? (
        videoPoster ? (
          <img
            src={videoPoster}
            alt="Кадр видео"
            draggable={false}
            className="pointer-events-none size-full object-cover"
          />
        ) : (
          <video
            src={source}
            muted
            playsInline
            preload="metadata"
            className="pointer-events-none size-full object-cover"
          />
        )
      ) : (
        <Image
          src={source}
          alt="Кадр альбома"
          fill
          draggable={false}
          className="pointer-events-none object-cover"
        />
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
        className="absolute right-2 top-2 size-10 bg-background/85 p-0 opacity-90 shadow-sm hover:bg-background hover:opacity-100"
        aria-label={selected ? "Убрать выбранный файл" : "Удалить файл из альбома"}
        onClick={(event) => {
          event.stopPropagation();
          onRemove();
        }}
      >
        <Trash2 className="size-5" aria-hidden="true" />
      </Button>
      {isVideo ? <Film className="sr-only" aria-hidden="true" /> : null}
    </div>
  );
}

function CoverCropDialog({
  media,
  value,
  onChange,
  onClose
}: {
  media: AlbumMediaItem;
  value: AlbumCoverCrop;
  onChange: (crop: AlbumCoverCrop) => void;
  onClose: () => void;
}) {
  const imageRef = useRef<HTMLImageElement | null>(null);
  const [draft, setDraft] = useState(value);

  useEffect(() => {
    setDraft(value);
  }, [value]);

  function handlePointerMove(event: PointerEvent<HTMLDivElement>) {
    if (event.buttons !== 1 || !imageRef.current) return;

    const imageBounds = imageRef.current.getBoundingClientRect();
    const deltaX = (event.movementX / imageBounds.width) * 100;
    const deltaY = (event.movementY / imageBounds.height) * 100;

    setDraft((current) =>
      clampCoverCrop({
        ...current,
        x: current.x + deltaX,
        y: current.y + deltaY
      })
    );
  }

  return (
    <div className="album-crop-dialog fixed inset-0 z-50 flex items-center justify-center bg-background/85 p-4 backdrop-blur-md">
      <div className="w-full max-w-5xl rounded-lg border border-border bg-card p-4 shadow-2xl md:p-5">
        <div className="mb-4 flex items-center justify-between gap-4">
          <div>
            <p className="text-lg font-semibold">Кадр обложки</p>
            <p className="text-sm text-muted-foreground">
              Перетащите прямоугольник по фото.
            </p>
          </div>
          <Button type="button" variant="ghost" className="album-crop-cancel" onClick={onClose}>
            Отмена
          </Button>
        </div>
        <div className="relative flex max-h-[72vh] min-h-[320px] items-center justify-center overflow-hidden rounded-md bg-background">
          <img
            ref={imageRef}
            src={media.previewUrl ?? media.imageUrl}
            alt="Фото для обложки"
            className="max-h-[72vh] max-w-full select-none object-contain"
            draggable={false}
          />
          <div
            role="presentation"
            className="absolute cursor-move border-2 border-white bg-white/5 shadow-[0_0_0_9999px_rgba(0,0,0,0.58)]"
            style={getCropFrameStyle(draft)}
            onPointerDown={(event) => {
              event.currentTarget.setPointerCapture(event.pointerId);
            }}
            onPointerMove={handlePointerMove}
          />
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <Button type="button" variant="outline" className="album-crop-cancel" onClick={onClose}>
            Отмена
          </Button>
          <Button
            type="button"
            onClick={() => {
              onChange(clampCoverCrop(draft));
              onClose();
            }}
          >
            Сохранить кадр
          </Button>
        </div>
      </div>
    </div>
  );
}

function getMediaKey(
  media: Pick<PortfolioAlbumImage, "id" | "imageUrl" | "imagePublicId"> | UploadedMedia
) {
  return media.imagePublicId || media.imageUrl || ("id" in media ? media.id : "");
}

function orderMediaItems(items: AlbumMediaItem[], order: string[]) {
  const itemByKey = new Map(items.map((item) => [item.key, item]));
  const ordered = order
    .map((key) => itemByKey.get(key))
    .filter((item): item is AlbumMediaItem => Boolean(item));
  const orderedKeys = new Set(ordered.map((item) => item.key));

  return [...ordered, ...items.filter((item) => !orderedKeys.has(item.key))];
}

function areStringArraysEqual(first: string[], second: string[]) {
  return first.length === second.length && first.every((value, index) => value === second[index]);
}

function getDefaultCoverCrop(key: string): AlbumCoverCrop {
  return {
    key,
    x: 10,
    y: 27.5,
    width: 80,
    height: 45
  };
}

function getInitialCoverCrop(
  key: string,
  crop?: {
    x?: number | null;
    y?: number | null;
    width?: number | null;
    height?: number | null;
  }
): AlbumCoverCrop | null {
  if (!key || !crop || crop.width == null || crop.height == null) {
    return null;
  }

  return clampCoverCrop({
    key,
    x: crop.x ?? 0,
    y: crop.y ?? 0,
    width: crop.width,
    height: crop.height
  });
}

function clampCoverCrop(crop: AlbumCoverCrop): AlbumCoverCrop {
  const width = clampNumber(crop.width, 10, 100);
  const height = clampNumber(crop.height, 10, 100);

  return {
    ...crop,
    width,
    height,
    x: clampNumber(crop.x, 0, 100 - width),
    y: clampNumber(crop.y, 0, 100 - height)
  };
}

function getCropFrameStyle(crop: AlbumCoverCrop) {
  const safeCrop = clampCoverCrop(crop);

  return {
    left: `${safeCrop.x}%`,
    top: `${safeCrop.y}%`,
    width: `${safeCrop.width}%`,
    height: `${safeCrop.height}%`
  };
}

function clampNumber(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

async function getSignedImageUpload(
  file: File
): Promise<SignedCloudinaryImageUpload> {
  const response = await fetch("/api/uploads/album-image-sign", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      fileName: file.name,
      contentType: file.type,
      size: file.size
    })
  });
  const result = (await response.json()) as SignedCloudinaryImageUpload;

  if (!response.ok) {
    throw new Error(result.error ?? "Не удалось подготовить загрузку фото.");
  }

  return result;
}

async function uploadImageToCloudinary(
  file: File,
  original: File
): Promise<UploadedMedia> {
  const signed = await getSignedImageUpload(file);
  const formData = new FormData();
  formData.append("file", file);
  formData.append("api_key", signed.apiKey);
  formData.append("timestamp", String(signed.timestamp));
  formData.append("folder", signed.folder);
  formData.append("format", signed.format);
  formData.append("transformation", signed.transformation);
  formData.append("signature", signed.signature);

  const response = await fetch(
    `https://api.cloudinary.com/v1_1/${signed.cloudName}/image/upload`,
    {
      method: "POST",
      body: formData
    }
  );
  const result = (await response.json()) as CloudinaryImageUploadResult;

  if (!response.ok || !result.secure_url || !result.public_id) {
    throw new Error(
      result.error?.message ?? "Не удалось загрузить фото в Cloudinary."
    );
  }

  return {
    imageUrl: result.secure_url,
    imagePublicId: `cloudinary:image:${result.public_id}`,
    mediaType: "IMAGE",
    provider: "CLOUDINARY",
    bytes: result.bytes ?? file.size,
    originalBytes: original.size,
    width: result.width,
    height: result.height,
    format: result.format ?? "webp",
    fileName: original.name,
    previewUrl: URL.createObjectURL(file)
  };
}

async function uploadVideoToCloudinary(file: File): Promise<UploadedMedia> {
  const signed = await getSignedVideoUpload(file);
  const formData = new FormData();
  formData.append("file", file);
  formData.append("api_key", signed.apiKey);
  formData.append("timestamp", String(signed.timestamp));
  formData.append("folder", signed.folder);
  formData.append("signature", signed.signature);

  const response = await fetch(
    `https://api.cloudinary.com/v1_1/${signed.cloudName}/video/upload`,
    {
      method: "POST",
      body: formData
    }
  );
  const result = (await response.json()) as CloudinaryVideoUploadResult;

  if (!response.ok || !result.secure_url || !result.public_id) {
    throw new Error(
      result.error?.message ?? "Не удалось загрузить видео в Cloudinary."
    );
  }

  return {
    imageUrl: result.secure_url,
    imagePublicId: `cloudinary:video:${result.public_id}`,
    mediaType: "VIDEO",
    provider: "CLOUDINARY",
    bytes: result.bytes ?? file.size,
    originalBytes: file.size,
    width: result.width,
    height: result.height,
    format: result.format,
    fileName: file.name,
    previewUrl: URL.createObjectURL(file)
  };
}

async function getSignedVideoUpload(
  file: File
): Promise<SignedCloudinaryVideoUpload> {
  const response = await fetch("/api/uploads/album-video-sign", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      fileName: file.name,
      contentType: file.type,
      size: file.size
    })
  });
  const result = (await response.json()) as SignedCloudinaryVideoUpload;

  if (!response.ok) {
    throw new Error(result.error ?? "Не удалось подготовить загрузку видео.");
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

  const blob = await canvasToBlob(canvas, optimizedImageQuality);
  return new File([blob], replaceExtension(file.name, "webp"), {
    type: "image/webp",
    lastModified: Date.now()
  });
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

function getReadableUploadError(error: unknown) {
  const message =
    error instanceof Error ? error.message : "Не удалось загрузить медиафайл.";

  if (/cloudinary|CLOUDINARY/i.test(message)) {
    return message;
  }

  if (/maximum|exceed|size|слишком|превыш/i.test(message)) {
    return `Файл превышает лимит загрузки. Видео можно загружать до ${formatMegabytes(albumVideoMaxBytes)} МБ.`;
  }

  return message;
}
