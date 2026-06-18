import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Images } from "lucide-react";
import type { PortfolioItem } from "@/lib/types";

export function PortfolioGallery({
  photographerId,
  items
}: {
  photographerId: string;
  items: PortfolioItem[];
}) {
  if (items.length === 0) {
    return (
      <div className="mt-5 rounded-lg border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
        Фотограф пока не добавил работы в портфолио.
      </div>
    );
  }

  return (
    <div className="mt-5 grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
      {items.map((item) => {
        const imageCount = item.albumImages.length;

        return (
          <Link
            key={item.id}
            href={`/photographers/${photographerId}/portfolio/${item.id}`}
            className="group overflow-hidden rounded-lg border border-border bg-card transition-colors hover:border-primary/60"
          >
            <div className="relative aspect-[4/5] overflow-hidden">
              <Image
                src={item.imageUrl}
                alt={item.title || "Обложка альбома"}
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
              <span className="mt-2 inline-flex items-center gap-1 text-sm font-medium text-primary">
                Открыть альбом
                <ArrowRight className="size-4" aria-hidden="true" />
              </span>
            </div>
          </Link>
        );
      })}
    </div>
  );
}
