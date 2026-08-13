"use client";

import Image from "next/image";
import {
  Film,
  Images,
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
import {
  type AlbumMediaDraft,
  registerAlbumMediaDrafts
} from "@/components/uploads/album-media-upload";
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
type MediaSource = "existing" | "draft";

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

export function AlbumContentField({
  name,
  uploadScope,
  disabled = false,
  existingImages = [],
  initialCoverCrop
}: {
  name: string;
  uploadScope: string;
  disabled?: boolean;
  existingImages?: PortfolioAlbumImage[];
  initialCoverCrop?: {
    x?: number | null;
    y?: number | null;
    width?: number | null;
    height?: number | null;
  };
}) {
  const selectedMediaRef = useRef<AlbumMediaDraft[]>([]);
  const [selectedMedia, setSelectedMedia] = useState<AlbumMediaDraft[]>([]);
  const [removedIds, setRemovedIds] = useState<string[]>([]);
  const [error, setError] = useState("");
  const [isDragging, setIsDragging] = useState(false);
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

  useEffect(
    () =>
      registerAlbumMediaDrafts(
        uploadScope,
        name,
        () => selectedMediaRef.current,
        () => {
          selectedMediaRef.current.forEach((media) => URL.revokeObjectURL(media.previewUrl));
          selectedMediaRef.current = [];
          setSelectedMedia([]);
        }
      ),
    [name, uploadScope]
  );

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
        key: media.key,
        source: "draft",
        imageUrl: media.previewUrl,
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

  function addFiles(fileList: FileList | File[]) {
    if (disabled) return;
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

    const drafts = files.map((file): AlbumMediaDraft => ({
      key: `draft:${crypto.randomUUID()}`,
      file,
      mediaType: file.type.startsWith("video/") ? "VIDEO" : "IMAGE",
      fileName: file.name,
      previewUrl: URL.createObjectURL(file)
    }));
    const next = [...selectedMedia, ...drafts];
    selectedMediaRef.current = next;
    setSelectedMedia(next);
    setMediaOrder((currentOrder) => [
      ...currentOrder,
      ...drafts.map((media) => media.key).filter((key) => !currentOrder.includes(key))
    ]);
  }

  function handleDrop(event: DragEvent<HTMLLabelElement>) {
    event.preventDefault();
    if (disabled) return;
    setIsDragging(false);
    addFiles(event.dataTransfer.files);
  }

  function removeSelected(index: number) {
    const media = selectedMedia[index];
    const next = selectedMedia.filter((_, mediaIndex) => mediaIndex !== index);
    const mediaKey = media.key;
    selectedMediaRef.current = next;
    setSelectedMedia(next);
    setMediaOrder((order) => order.filter((key) => key !== mediaKey));
    URL.revokeObjectURL(media.previewUrl);
  }

  function removeMedia(media: AlbumMediaItem) {
    setMediaOrder((order) => order.filter((key) => key !== media.key));

    if (media.source === "existing" && media.id) {
      setRemovedIds((ids) => [...ids, media.id!]);
      return;
    }

    const selectedIndex = selectedMedia.findIndex(
      (item) => item.key === media.key
    );
    if (selectedIndex >= 0) {
      removeSelected(selectedIndex);
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
                selected={media.source === "draft"}
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
                onRemove={() => removeMedia(media)}
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
          "album-upload-dropzone flex min-h-36 cursor-pointer flex-col items-center justify-center gap-2 rounded-md border border-dashed border-border bg-secondary/30 px-5 py-6 text-center transition-colors hover:border-primary/60 hover:bg-secondary/60",
          isDragging && "border-primary bg-primary/10",
          disabled && "pointer-events-none cursor-not-allowed opacity-60"
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
        <span className="text-sm font-medium">Добавить фото или видео</span>
        <span className="text-xs text-muted-foreground">
          Перетащите несколько файлов или нажмите для выбора
        </span>
        <input
          type="file"
          accept={accept}
          multiple
          disabled={disabled}
          className="sr-only"
          onChange={(event) => {
            if (event.target.files) addFiles(event.target.files);
            event.currentTarget.value = "";
          }}
        />
      </label>

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
          unoptimized={Boolean(media.previewUrl)}
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
  media: Pick<PortfolioAlbumImage, "id" | "imageUrl" | "imagePublicId">
) {
  return media.imagePublicId || media.imageUrl || media.id;
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
