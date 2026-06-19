import Image from "next/image";
import Link from "next/link";
import { ArrowRight, MapPin, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { formatPrice, getStyleTitles } from "@/lib/mock-data";
import type { Photographer } from "@/lib/types";

interface PhotographerCardProps {
  photographer: Photographer;
  styleSlug?: string;
  mode?: "booking" | "full-shoot";
  selectionHref?: string;
  profileHrefOverride?: string;
}

export function PhotographerCard({
  photographer,
  styleSlug,
  mode = "full-shoot",
  selectionHref,
  profileHrefOverride
}: PhotographerCardProps) {
  const primaryHref =
    selectionHref ??
    (mode === "booking"
      ? `/booking/new?type=PHOTOGRAPHER_ONLY&photographerId=${photographer.id}`
      : `/studios?style=${styleSlug}&photographer=${photographer.id}`);
  const profileHref =
    profileHrefOverride ??
    (styleSlug
      ? `/photographers/${photographer.id}?style=${styleSlug}`
      : `/photographers/${photographer.id}`);

  return (
    <Card className="overflow-hidden">
      <div className="relative aspect-[4/3]">
        <Image
          src={photographer.imageUrl}
          alt={photographer.name}
          fill
          sizes="(max-width: 768px) 100vw, (max-width: 1024px) 50vw, 33vw"
          className="object-cover"
        />
      </div>
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className="font-semibold">{photographer.name}</h3>
            <p className="mt-1 inline-flex items-center gap-1 text-sm text-muted-foreground">
              <MapPin className="size-4" aria-hidden="true" />
              {photographer.city}
            </p>
          </div>
          <span className="inline-flex items-center gap-1 rounded-md bg-secondary px-2 py-1 text-sm">
            <Star className="size-4 fill-current" aria-hidden="true" />
            {photographer.rating}
          </span>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          {getStyleTitles(photographer.specializationIds).map((style) => (
            <span key={style} className="rounded-md bg-muted px-2 py-1 text-xs">
              {style}
            </span>
          ))}
        </div>
        <div className="mt-4 grid grid-cols-4 gap-2">
          {photographer.portfolio.slice(0, 4).map((imageUrl) => (
            <div key={imageUrl} className="relative aspect-square overflow-hidden rounded-md">
              <Image
                src={imageUrl}
                alt="Preview портфолио"
                fill
                sizes="96px"
                className="object-cover"
              />
            </div>
          ))}
        </div>
        <div className="mt-5 flex items-center justify-between gap-3">
          <span className="text-sm font-medium">
            {formatPrice(photographer.pricePerHour)} / час
          </span>
          <Button asChild size="sm">
            <Link href={primaryHref}>
              {mode === "booking" ? "Забронировать" : "Выбрать фотографа"}
              <ArrowRight className="size-4" aria-hidden="true" />
            </Link>
          </Button>
        </div>
        <Link
          href={profileHref}
          className="mt-4 inline-block text-sm font-medium text-muted-foreground hover:text-foreground"
        >
          Смотреть профиль
        </Link>
      </CardContent>
    </Card>
  );
}
