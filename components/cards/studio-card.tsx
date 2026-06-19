import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Building2, MapPin, Users, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { formatPrice } from "@/lib/mock-data";
import type { Studio } from "@/lib/types";

interface StudioCardProps {
  studio: Studio;
  styleSlug?: string;
  photographerId?: string;
  mode?: "booking" | "full-shoot";
  selectionHref?: string;
  detailHrefOverride?: string;
  imagePriority?: boolean;
}

export function StudioCard({
  studio,
  styleSlug,
  photographerId,
  mode = "full-shoot",
  selectionHref,
  detailHrefOverride,
  imagePriority = false
}: StudioCardProps) {
  const primaryHref =
    selectionHref ??
    (mode === "booking"
      ? `/booking/new?type=STUDIO_ONLY&studioId=${studio.id}`
      : `/booking?style=${styleSlug}&photographer=${photographerId}&studio=${studio.id}`);
  const detailHref =
    detailHrefOverride ??
    (styleSlug && photographerId
      ? `/studios/${studio.id}?style=${styleSlug}&photographer=${photographerId}`
      : `/studios/${studio.id}`);
  const visibleHalls = studio.halls.filter((hall) => hall.status !== "Inactive");
  const lowestHallPrice =
    visibleHalls.length > 0
      ? Math.min(...visibleHalls.map((hall) => hall.pricePerHour))
      : studio.pricePerHour;

  return (
    <Card className="group relative flex h-full flex-col overflow-hidden transition-colors hover:border-primary/45">
      <Link
        href={detailHref}
        className="absolute inset-0 z-10"
        aria-label={`Открыть студию ${studio.name}`}
      />
      <div className="relative aspect-[4/3]">
        {studio.imageUrl ? (
          <Image
            src={studio.imageUrl}
            alt={studio.name}
            fill
            priority={imagePriority}
            sizes="(max-width: 768px) 100vw, 50vw"
            className="object-cover transition-transform duration-500 group-hover:scale-[1.02]"
          />
        ) : (
          <div className="flex size-full items-center justify-center bg-muted text-muted-foreground">
            <Building2 className="size-12" aria-hidden="true" />
            <span className="sr-only">У студии пока нет обложки</span>
          </div>
        )}
      </div>
      <CardContent className="flex flex-1 flex-col p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className="font-semibold">{studio.name}</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              {formatHallsCount(visibleHalls.length)}
            </p>
          </div>
          <span className="inline-flex items-center gap-1 rounded-md bg-secondary px-2 py-1 text-sm">
            <Star className="size-4 fill-current" aria-hidden="true" />
            {studio.rating}
          </span>
        </div>
        <div className="mt-3 grid gap-2 text-sm text-muted-foreground">
          <span className="inline-flex items-center gap-2">
            <MapPin className="size-4" aria-hidden="true" />
            {studio.address}
          </span>
          <span className="inline-flex items-center gap-2">
            <Users className="size-4" aria-hidden="true" />
            до {studio.capacity} человек
          </span>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          {studio.amenities.slice(0, 4).map((feature) => (
            <span key={feature} className="rounded-md bg-muted px-2 py-1 text-xs">
              {feature}
            </span>
          ))}
        </div>

        {visibleHalls.length > 0 ? (
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            {visibleHalls.map((hall) => (
              <div
                key={hall.id ?? hall.name}
                className="overflow-hidden rounded-md border border-border bg-muted/35"
              >
                {hall.imageUrl ? (
                  <div className="relative aspect-[16/9]">
                    <Image
                      src={hall.imageUrl}
                      alt={`Зал ${hall.name}`}
                      fill
                      sizes="(max-width: 640px) 100vw, 25vw"
                      className="object-cover"
                    />
                  </div>
                ) : null}
                <div className="p-3">
                  <p className="font-medium">{hall.name}</p>
                  <div className="mt-1 flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
                    <span>до {hall.capacity} человек</span>
                    <span>{formatPrice(hall.pricePerHour)} / час</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : null}

        <div className="mt-auto pt-6">
          <p className="text-center text-base font-medium">
            {lowestHallPrice > 0 ? `от ${formatPrice(lowestHallPrice)} / час` : "Цена уточняется"}
          </p>
          <Button asChild size="lg" className="relative z-20 mx-auto mt-4 flex w-full max-w-md">
            <Link href={primaryHref} aria-label={`Забронировать студию ${studio.name}`}>
              {mode === "booking" ? "Забронировать студию" : "Выбрать студию"}
              <ArrowRight className="size-4" aria-hidden="true" />
            </Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function formatHallsCount(count: number) {
  const lastTwoDigits = count % 100;
  const lastDigit = count % 10;

  if (lastTwoDigits >= 11 && lastTwoDigits <= 14) return `${count} залов`;
  if (lastDigit === 1) return `${count} зал`;
  if (lastDigit >= 2 && lastDigit <= 4) return `${count} зала`;
  return `${count} залов`;
}
