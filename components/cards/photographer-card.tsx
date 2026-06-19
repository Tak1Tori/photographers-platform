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
    <Card className="group relative flex h-full flex-col overflow-hidden transition-colors hover:border-primary/45">
      <Link
        href={profileHref}
        className="absolute inset-0 z-10"
        aria-label={`Открыть профиль фотографа ${photographer.name}`}
      />
      <div className="relative aspect-[4/3]">
        <Image
          src={photographer.imageUrl}
          alt={photographer.name}
          fill
          sizes="(max-width: 768px) 100vw, (max-width: 1024px) 50vw, 33vw"
          className="object-cover transition-transform duration-500 group-hover:scale-[1.02]"
        />
      </div>
      <CardContent className="flex flex-1 flex-col p-5">
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
        <div className="mt-auto pt-6">
          <p className="text-center text-base font-medium">
            {formatPrice(photographer.pricePerHour)} / час
          </p>
          <Button asChild size="lg" className="relative z-20 mx-auto mt-4 flex w-full max-w-sm">
            <Link href={primaryHref} aria-label={`Забронировать фотографа ${photographer.name}`}>
              {mode === "booking" ? "Забронировать" : "Выбрать фотографа"}
              <ArrowRight className="size-4" aria-hidden="true" />
            </Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
