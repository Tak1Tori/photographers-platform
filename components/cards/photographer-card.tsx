import Image from "next/image";
import Link from "next/link";
import { MapPin, Star } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { formatPrice, getPhotographerStyleTitles } from "@/lib/mock-data";
import { getPhotographerDisplayPrice } from "@/lib/photographer-services";
import type { Photographer } from "@/lib/types";

interface PhotographerCardProps {
  photographer: Photographer;
  styleSlug?: string;
  mode?: "booking" | "full-shoot";
  selectionHref?: string;
  profileHrefOverride?: string;
  professionalLabel?: "фотографа" | "монтажера";
}

export function PhotographerCard({
  photographer,
  styleSlug,
  profileHrefOverride,
  professionalLabel = "фотографа"
}: PhotographerCardProps) {
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
        aria-label={`Открыть профиль ${professionalLabel} ${photographer.name}`}
      />
      <div className="relative aspect-square sm:aspect-[4/3]">
        <Image
          src={photographer.imageUrl}
          alt={photographer.name}
          fill
          sizes="(max-width: 768px) 50vw, (max-width: 1024px) 50vw, 33vw"
          className="object-cover transition-transform duration-500 group-hover:scale-[1.02]"
        />
      </div>
      <CardContent className="flex flex-1 flex-col p-3 sm:p-5">
        <div className="flex items-start justify-between gap-2 sm:gap-4">
          <div className="min-w-0">
            <h3 className="truncate text-sm font-semibold sm:text-base">{photographer.name}</h3>
            <p className="mt-1 inline-flex items-center gap-1 text-xs text-muted-foreground sm:text-sm">
              <MapPin className="size-3.5 shrink-0 sm:size-4" aria-hidden="true" />
              {photographer.city}
            </p>
          </div>
          <span className="inline-flex shrink-0 items-center gap-1 rounded-md bg-secondary px-1.5 py-1 text-xs sm:px-2 sm:text-sm">
            <Star className="size-3.5 fill-current sm:size-4" aria-hidden="true" />
            {photographer.rating}
          </span>
        </div>
        <div className="mt-3 flex flex-wrap gap-1.5 sm:mt-4 sm:gap-2">
          {getPhotographerStyleTitles(photographer).map((style) => (
            <span key={style} className="max-w-full truncate rounded-md bg-muted px-2 py-1 text-[11px] leading-none sm:text-xs">
              {style}
            </span>
          ))}
        </div>
        <div className="mt-auto pt-4 sm:pt-6">
          <p className="text-center text-sm font-medium sm:text-base">
            от {formatPrice(getPhotographerDisplayPrice(photographer.pricePerHour, photographer.lowestServicePrice))}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
