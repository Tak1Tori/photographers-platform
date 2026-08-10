import Image from "next/image";
import Link from "next/link";
import { Images } from "lucide-react";
import { getCoverCropPresentation } from "@/lib/cover-crop";
import type { PortfolioItem } from "@/lib/types";

export function PortfolioGallery({
  photographerId,
  items,
  profileBasePath = "/photographers",
  professionalLabel = "Фотограф"
}: {
  photographerId: string;
  items: PortfolioItem[];
  profileBasePath?: string;
  professionalLabel?: string;
}) {
  if (items.length === 0) {
    return (
      <div className="mt-5 rounded-lg border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
        {professionalLabel} пока не добавил работы в портфолио.
      </div>
    );
  }

  return (
    <div className="mt-5 grid gap-5 lg:grid-cols-2">
      {items.map((item) => {
        const imageCount = item.albumImages.length;
        const coverPresentation = getCoverCropPresentation({
          x: item.coverCropX,
          y: item.coverCropY,
          width: item.coverCropWidth,
          height: item.coverCropHeight
        });

        return (
          <Link
            key={item.id}
            href={`${profileBasePath}/${photographerId}/portfolio/${item.id}`}
            className="group relative min-h-[280px] overflow-hidden rounded-lg border border-border bg-card transition-colors hover:border-primary/60 md:min-h-[340px]"
          >
            <Image
              src={item.imageUrl}
              alt={item.title || "Обложка альбома"}
              fill
              sizes="(max-width: 1024px) 100vw, 50vw"
              className="object-cover transition-transform duration-500"
              style={coverPresentation}
            />
            <div className="absolute inset-0 bg-black/28" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/52 to-black/24" />
            <span className="absolute right-4 top-4 inline-flex items-center gap-1 rounded-md bg-black/45 px-2.5 py-1 text-xs font-medium text-white backdrop-blur">
              <Images className="size-3.5" aria-hidden="true" />
              {imageCount}
            </span>
            <div className="absolute inset-x-0 bottom-0 p-5 text-white md:p-7">
              <h3 className="text-2xl font-semibold tracking-normal drop-shadow-[0_2px_16px_rgba(0,0,0,0.85)] md:text-3xl">
                {item.title || "Без названия"}
              </h3>
              <span className="mt-3 inline-flex text-sm font-medium text-white/85 drop-shadow-[0_1px_10px_rgba(0,0,0,0.8)] transition-colors group-hover:text-white">
                Открыть альбом
              </span>
            </div>
          </Link>
        );
      })}
    </div>
  );
}
