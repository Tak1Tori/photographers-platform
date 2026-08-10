"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Images, X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { StudioHallGalleryImage } from "@/lib/types";

interface HallGalleryLightboxProps {
  hallName: string;
  images?: StudioHallGalleryImage[];
}

export function HallGalleryLightbox({ hallName, images = [] }: HallGalleryLightboxProps) {
  const galleryImages = useMemo(
    () => images.slice().sort((a, b) => a.sortOrder - b.sortOrder),
    [images]
  );
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const activeImage = activeIndex === null ? null : galleryImages[activeIndex];
  const canNavigate = galleryImages.length > 1;

  useEffect(() => {
    if (activeIndex === null) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setActiveIndex(null);
      }

      if (event.key === "ArrowLeft") {
        setActiveIndex((current) => getPreviousIndex(current, galleryImages.length));
      }

      if (event.key === "ArrowRight") {
        setActiveIndex((current) => getNextIndex(current, galleryImages.length));
      }
    };

    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [activeIndex, galleryImages.length]);

  if (galleryImages.length === 0) {
    return null;
  }

  return (
    <>
      <div className="grid grid-cols-4 gap-2 border-t border-border p-3">
        {galleryImages.slice(0, 7).map((image, index) => (
          <button
            key={image.id}
            type="button"
            className="group/thumb relative aspect-square overflow-hidden rounded-md border border-border bg-secondary text-left outline-none transition hover:border-primary/70 focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/30"
            onClick={() => setActiveIndex(index)}
            aria-label={`Открыть фото ${index + 1} из галереи зала ${hallName}`}
          >
            <Image
              src={image.imageUrl}
              alt={`${hallName}, фото галереи ${index + 1}`}
              fill
              sizes="(max-width: 768px) 25vw, 12vw"
              className="object-cover transition duration-300 group-hover/thumb:scale-105 group-hover/thumb:brightness-110"
            />
            {index === Math.min(6, galleryImages.length - 1) && galleryImages.length > 7 ? (
              <span className="absolute inset-0 flex items-center justify-center bg-black/65 text-sm font-semibold text-white">
                +{galleryImages.length - 7}
              </span>
            ) : null}
          </button>
        ))}
      </div>

      {activeImage ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/88 p-3 backdrop-blur-md md:p-6"
          role="dialog"
          aria-modal="true"
          aria-label={`Галерея зала ${hallName}`}
          onClick={() => setActiveIndex(null)}
        >
          <button
            type="button"
            className="absolute right-4 top-4 inline-flex size-11 items-center justify-center rounded-full border border-white/15 bg-white/10 text-white backdrop-blur transition hover:bg-white/20"
            onClick={() => setActiveIndex(null)}
            aria-label="Закрыть галерею"
          >
            <X className="size-5" aria-hidden="true" />
          </button>

          <div className="absolute left-4 top-4 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-4 py-2 text-sm font-medium text-white/90 backdrop-blur">
            <Images className="size-4" aria-hidden="true" />
            {(activeIndex ?? 0) + 1} / {galleryImages.length}
          </div>

          {canNavigate ? (
            <button
              type="button"
              className="absolute left-3 top-1/2 inline-flex size-11 -translate-y-1/2 items-center justify-center rounded-full border border-white/15 bg-white/10 text-white backdrop-blur transition hover:bg-white/20 md:left-6"
              onClick={(event) => {
                event.stopPropagation();
                setActiveIndex((current) => getPreviousIndex(current, galleryImages.length));
              }}
              aria-label="Предыдущее фото"
            >
              <ChevronLeft className="size-6" aria-hidden="true" />
            </button>
          ) : null}

          <div
            className="relative h-[78vh] w-full max-w-6xl overflow-hidden rounded-lg border border-white/10 bg-black"
            onClick={(event) => event.stopPropagation()}
          >
            <Image
              src={activeImage.imageUrl}
              alt={`${hallName}, фото галереи ${(activeIndex ?? 0) + 1}`}
              fill
              sizes="100vw"
              className="object-contain"
              priority
            />
          </div>

          {canNavigate ? (
            <button
              type="button"
              className="absolute right-3 top-1/2 inline-flex size-11 -translate-y-1/2 items-center justify-center rounded-full border border-white/15 bg-white/10 text-white backdrop-blur transition hover:bg-white/20 md:right-6"
              onClick={(event) => {
                event.stopPropagation();
                setActiveIndex((current) => getNextIndex(current, galleryImages.length));
              }}
              aria-label="Следующее фото"
            >
              <ChevronRight className="size-6" aria-hidden="true" />
            </button>
          ) : null}

          <div className="absolute bottom-4 left-1/2 hidden max-w-[80vw] -translate-x-1/2 items-center gap-2 overflow-x-auto rounded-full border border-white/15 bg-black/45 p-2 backdrop-blur md:flex">
            {galleryImages.map((image, index) => (
              <button
                key={image.id}
                type="button"
                className={cn(
                  "relative size-14 shrink-0 overflow-hidden rounded-md border bg-white/10 transition",
                  index === activeIndex ? "border-white" : "border-white/15 opacity-65 hover:opacity-100"
                )}
                onClick={(event) => {
                  event.stopPropagation();
                  setActiveIndex(index);
                }}
                aria-label={`Перейти к фото ${index + 1}`}
              >
                <Image src={image.imageUrl} alt="" fill sizes="56px" className="object-cover" />
              </button>
            ))}
          </div>
        </div>
      ) : null}
    </>
  );
}

function getPreviousIndex(current: number | null, total: number) {
  if (current === null || total === 0) return null;
  return current === 0 ? total - 1 : current - 1;
}

function getNextIndex(current: number | null, total: number) {
  if (current === null || total === 0) return null;
  return current === total - 1 ? 0 : current + 1;
}
