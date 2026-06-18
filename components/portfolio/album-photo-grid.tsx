"use client";

import Image from "next/image";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
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
        В этом альбоме пока нет дополнительных фотографий.
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
            <Image
              src={image.imageUrl}
              alt={`${albumTitle}, фотография ${index + 1}`}
              width={1000}
              height={1250}
              sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
              className="h-auto w-full object-cover transition-transform duration-500 group-hover:scale-[1.02]"
            />
          </button>
        ))}
      </div>

      {activeIndex !== null && images[activeIndex] ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`${albumTitle}, просмотр фотографии`}
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
              aria-label="Закрыть фотографию"
              onClick={() => setActiveIndex(null)}
            >
              <X className="size-5" aria-hidden="true" />
            </Button>
          </div>
          <div className="relative min-h-0 flex-1">
            <Image
              src={images[activeIndex].imageUrl}
              alt={`${albumTitle}, фотография ${activeIndex + 1}`}
              fill
              priority
              sizes="100vw"
              className="object-contain p-4 md:p-8"
            />
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
                  aria-label={`Открыть фотографию ${index + 1}`}
                  className={cn(
                    "relative aspect-square w-16 shrink-0 overflow-hidden rounded-md border",
                    index === activeIndex
                      ? "border-primary"
                      : "border-border opacity-60 hover:opacity-100"
                  )}
                  onClick={() => setActiveIndex(index)}
                >
                  <Image src={image.imageUrl} alt="" fill className="object-cover" />
                </button>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}
    </>
  );
}
