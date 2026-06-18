import Image from "next/image";
import Link from "next/link";
import { ArrowRight, MapPin, Users, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { formatPrice } from "@/lib/mock-data";
import type { Studio } from "@/lib/types";

interface StudioCardProps {
  studio: Studio;
  styleSlug?: string;
  photographerId?: string;
  mode?: "booking" | "full-shoot";
}

export function StudioCard({ studio, styleSlug, photographerId, mode = "full-shoot" }: StudioCardProps) {
  const primaryHref =
    mode === "booking"
      ? `/booking/new?type=STUDIO_ONLY&studioId=${studio.id}`
      : `/booking?style=${styleSlug}&photographer=${photographerId}&studio=${studio.id}`;
  const detailHref =
    styleSlug && photographerId
      ? `/studios/${studio.id}?style=${styleSlug}&photographer=${photographerId}`
      : `/studios/${studio.id}`;

  return (
    <Card className="overflow-hidden">
      <div className="relative aspect-[4/3]">
        <Image src={studio.imageUrl} alt={studio.name} fill className="object-cover" />
      </div>
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className="font-semibold">{studio.name}</h3>
            <p className="mt-1 text-sm text-muted-foreground">{studio.hallName}</p>
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
        <div className="mt-5 flex items-center justify-between gap-3">
          <span className="text-sm font-medium">
            {formatPrice(studio.pricePerHour)} / час
          </span>
          <Button asChild size="sm">
            <Link href={primaryHref}>
              {mode === "booking" ? "Забронировать студию" : "Выбрать студию"}
              <ArrowRight className="size-4" aria-hidden="true" />
            </Link>
          </Button>
        </div>
        <Link
          href={detailHref}
          className="mt-4 inline-block text-sm font-medium text-muted-foreground hover:text-foreground"
        >
          Смотреть студию
        </Link>
      </CardContent>
    </Card>
  );
}
