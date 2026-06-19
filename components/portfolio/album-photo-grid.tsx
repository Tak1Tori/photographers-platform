"use client";

import Image from "next/image";
import { ChevronLeft, ChevronRight, Play, X } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { PortfolioAlbumImage } from "@/lib/types";

export function AlbumPhotoGrid({
  albumTitle,
  images
}: {
  albumTitle: string;
  images: PortfolioAlbumImage[];
}) {
  const [activeIndex, setActiveIndex] = useState<number | null>(null);

  useEffect(() => {
    if (activeIndex === null) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setActiveIndex(null);
      if (event.key === "ArrowLeft") {
        setActiveIndex((index) =>
          index === null || index === 0 ? images.length - 1 : index - 1
        );
      }
      if (event.key === "ArrowRight") {
        setActiveIndex((index) =>
          index === null ? 0 : (index + 1) % images.length
        );
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [activeIndex, images.length]);

  if (images.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-border p-12 text-center text-sm text-muted-foreground">
        В этом альбоме пока нет фотографий или видео.
      </div>
    );
  }

  function showPrevious() {
    setActiveIndex((index) =>
      index === null || index === 0 ? images.length - 1 : index - 1
    );
  }

  function showNext() {
    setActiveIndex((index) =>
      index === null ? 0 : (index + 1) % images.length
    );
  }

  function isVideo(image: PortfolioAlbumImage) {
    if (image.mediaType === "VIDEO") return true;

    const pathname = image.imageUrl.split(/[?#]/, 1)[0].toLowerCase();
    return /\.(mp4|webm|mov|m4v)$/.test(pathname);
  }

  return (
    <>
      <div className="columns-1 gap-4 sm:columns-2 lg:columns-3">
        {images.map((image, index) => (
          <button
            key={image.id}
            type="button"
            className="group relative mb-4 block w-full overflow-hidden rounded-lg border border-border bg-card"
            onClick={() => setActiveIndex(index)}
          >
            {isVideo(image) ? (
              <div className="relative aspect-video">
                <video
                  src={image.imageUrl}
                  muted
                  playsInline
                  preload="metadata"
                  className="size-full object-cover transition-transform duration-500 group-hover:scale-[1.02]"
                />
                <span className="absolute inset-0 flex items-center justify-center bg-background/20">
                  <span className="flex size-12 items-center justify-center rounded-full bg-background/85">
                    <Play className="ml-0.5 size-5 fill-current" aria-hidden="true" />
                  </span>
                </span>
              </div>
            ) : (
              <Image
                src={image.imageUrl}
                alt={`${albumTitle}, фотография ${index + 1}`}
                width={1000}
                height={1250}
                sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                className="h-auto w-full object-cover transition-transform duration-500 group-hover:scale-[1.02]"
              />
            )}
          </button>
        ))}
      </div>

      {activeIndex !== null && images[activeIndex] ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`${albumTitle}, просмотр медиа`}
          className="fixed inset-0 z-50 flex flex-col bg-background/95 backdrop-blur-md"
        >
          <div className="flex items-center justify-between gap-4 border-b border-border px-4 py-3 md:px-6">
            <div>
              <p className="font-semibold">{albumTitle}</p>
              <p className="text-sm text-muted-foreground">
                {activeIndex + 1} из {images.length}
              </p>
            </div>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              aria-label="Закрыть просмотр"
              onClick={() => setActiveIndex(null)}
            >
              <X className="size-5" aria-hidden="true" />
            </Button>
          </div>
          <div className="relative min-h-0 flex-1">
            {isVideo(images[activeIndex]) ? (
              <video
                key={images[activeIndex].id}
                src={images[activeIndex].imageUrl}
                controls
                autoPlay
                playsInline
                className="size-full object-contain p-4 md:p-8"
              />
            ) : (
              <Image
                src={images[activeIndex].imageUrl}
                alt={`${albumTitle}, фотография ${activeIndex + 1}`}
                fill
                priority
                sizes="100vw"
                className="object-contain p-4 md:p-8"
              />
            )}
            {images.length > 1 ? (
              <>
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  className="absolute left-3 top-1/2 size-11 -translate-y-1/2 md:left-6"
                  aria-label="Предыдущая фотография"
                  onClick={showPrevious}
                >
                  <ChevronLeft className="size-5" aria-hidden="true" />
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  className="absolute right-3 top-1/2 size-11 -translate-y-1/2 md:right-6"
                  aria-label="Следующая фотография"
                  onClick={showNext}
                >
                  <ChevronRight className="size-5" aria-hidden="true" />
                </Button>
              </>
            ) : null}
          </div>
          {images.length > 1 ? (
            <div className="flex gap-2 overflow-x-auto border-t border-border p-3 md:px-6">
              {images.map((image, index) => (
                <button
                  key={image.id}
                  type="button"
                  aria-label={`Открыть файл ${index + 1}`}
                  className={cn(
                    "relative aspect-square w-16 shrink-0 overflow-hidden rounded-md border",
                    index === activeIndex
                      ? "border-primary"
                      : "border-border opacity-60 hover:opacity-100"
                  )}
                  onClick={() => setActiveIndex(index)}
                >
                  {isVideo(image) ? (
                    <>
                      <video
                        src={image.imageUrl}
                        muted
                        playsInline
                        preload="metadata"
                        className="size-full object-cover"
                      />
                      <Play
                        className="absolute left-1/2 top-1/2 size-4 -translate-x-1/2 -translate-y-1/2 fill-current"
                        aria-hidden="true"
                      />
                    </>
                  ) : (
                    <Image src={image.imageUrl} alt="" fill className="object-cover" />
                  )}
                </button>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}
    </>
  );
}
