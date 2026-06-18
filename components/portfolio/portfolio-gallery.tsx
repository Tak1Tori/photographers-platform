"use client";

import Image from "next/image";
import { ChevronLeft, ChevronRight, Images, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { PortfolioItem } from "@/lib/types";

export function PortfolioGallery({ items }: { items: PortfolioItem[] }) {
  const [activeAlbumId, setActiveAlbumId] = useState<string | null>(null);
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const activeAlbum = items.find((item) => item.id === activeAlbumId);
  const activeImages = useMemo(
    () =>
      activeAlbum
        ? [
            {
              id: `${activeAlbum.id}-cover`,
              imageUrl: activeAlbum.imageUrl
            },
            ...activeAlbum.albumImages
          ]
        : [],
    [activeAlbum]
  );

  useEffect(() => {
    if (!activeAlbum) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setActiveAlbumId(null);
      }
      if (event.key === "ArrowLeft") {
        setActiveImageIndex((index) =>
          index === 0 ? activeImages.length - 1 : index - 1
        );
      }
      if (event.key === "ArrowRight") {
        setActiveImageIndex((index) => (index + 1) % activeImages.length);
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [activeAlbum, activeImages.length]);

  if (items.length === 0) {
    return (
      <div className="mt-5 rounded-lg border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
        Фотограф пока не добавил работы в портфолио.
      </div>
    );
  }

  function openAlbum(id: string) {
    setActiveAlbumId(id);
    setActiveImageIndex(0);
  }

  function showPrevious() {
    setActiveImageIndex((index) =>
      index === 0 ? activeImages.length - 1 : index - 1
    );
  }

  function showNext() {
    setActiveImageIndex((index) => (index + 1) % activeImages.length);
  }

  return (
    <>
      <div className="mt-5 grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
        {items.map((item) => {
          const imageCount = item.albumImages.length + 1;

          return (
            <button
              key={item.id}
              type="button"
              className="group overflow-hidden rounded-lg border border-border bg-card text-left transition-colors hover:border-primary/60"
              onClick={() => openAlbum(item.id)}
            >
              <div className="relative aspect-[4/5] overflow-hidden">
                <Image
                  src={item.imageUrl}
                  alt={item.title || "Работа из портфолио"}
                  fill
                  sizes="(max-width: 640px) 100vw, (max-width: 1280px) 50vw, 33vw"
                  className="object-cover transition-transform duration-500 group-hover:scale-[1.03]"
                />
                <span className="absolute right-3 top-3 inline-flex items-center gap-1 rounded-md bg-background/90 px-2 py-1 text-xs font-medium backdrop-blur">
                  <Images className="size-3.5" aria-hidden="true" />
                  {imageCount}
                </span>
              </div>
              <div className="grid gap-1 p-4">
                <h3 className="font-semibold">{item.title || "Без названия"}</h3>
                {item.description ? (
                  <p className="line-clamp-2 text-sm text-muted-foreground">
                    {item.description}
                  </p>
                ) : null}
                <span className="mt-2 text-sm font-medium text-primary">
                  Открыть альбом
                </span>
              </div>
            </button>
          );
        })}
      </div>

      {activeAlbum && activeImages[activeImageIndex] ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`Альбом ${activeAlbum.title || "портфолио"}`}
          className="fixed inset-0 z-50 flex flex-col bg-background/95 backdrop-blur-md"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              setActiveAlbumId(null);
            }
          }}
        >
          <div className="flex items-center justify-between gap-4 border-b border-border px-4 py-3 md:px-6">
            <div className="min-w-0">
              <p className="truncate font-semibold">
                {activeAlbum.title || "Альбом"}
              </p>
              <p className="text-sm text-muted-foreground">
                {activeImageIndex + 1} из {activeImages.length}
              </p>
            </div>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              aria-label="Закрыть альбом"
              onClick={() => setActiveAlbumId(null)}
            >
              <X className="size-5" aria-hidden="true" />
            </Button>
          </div>

          <div className="relative min-h-0 flex-1">
            <Image
              src={activeImages[activeImageIndex].imageUrl}
              alt={`${activeAlbum.title || "Альбом"}, кадр ${activeImageIndex + 1}`}
              fill
              priority
              sizes="100vw"
              className="object-contain p-4 md:p-8"
            />
            {activeImages.length > 1 ? (
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

          {activeImages.length > 1 ? (
            <div className="flex gap-2 overflow-x-auto border-t border-border p-3 md:px-6">
              {activeImages.map((image, index) => (
                <button
                  key={image.id}
                  type="button"
                  aria-label={`Открыть фотографию ${index + 1}`}
                  className={cn(
                    "relative aspect-square w-16 shrink-0 overflow-hidden rounded-md border",
                    index === activeImageIndex
                      ? "border-primary"
                      : "border-border opacity-60 hover:opacity-100"
                  )}
                  onClick={() => setActiveImageIndex(index)}
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
