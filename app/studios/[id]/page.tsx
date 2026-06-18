import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CalendarCheck, MapPin, Star, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatPrice, studios } from "@/lib/mock-data";
import { getPhotographerById } from "@/lib/data/photographers";
import { getStudioById } from "@/lib/data/studios";
import { getStyleBySlug } from "@/lib/data/styles";

interface StudioDetailPageProps {
  params: {
    id: string;
  };
  searchParams: {
    style?: string;
    photographer?: string;
  };
}

export function generateStaticParams() {
  return studios.map((studio) => ({ id: studio.id }));
}

export default function StudioDetailPage({ params, searchParams }: StudioDetailPageProps) {
  return <StudioDetail params={params} searchParams={searchParams} />;
}

async function StudioDetail({ params, searchParams }: StudioDetailPageProps) {
  const studio = await getStudioById(params.id);

  if (!studio) {
    notFound();
  }

  const selectedStyle =
    (await getStyleBySlug(searchParams.style)) ??
    (await getStyleBySlug(studio.suitableStyleIds[0]));
  const selectedPhotographer = await getPhotographerById(searchParams.photographer);
  const bookingHref = selectedPhotographer
    ? `/booking?style=${selectedStyle?.id ?? studio.suitableStyleIds[0]}&photographer=${selectedPhotographer.id}&studio=${studio.id}`
    : `/studios?style=${selectedStyle?.id ?? studio.suitableStyleIds[0]}`;

  return (
    <>
      <section className="bg-card">
        <div className="container grid gap-8 py-10 md:grid-cols-[1.1fr_0.9fr] md:py-14">
          <div className="relative aspect-[16/11] overflow-hidden rounded-lg border border-border">
            <Image src={studio.imageUrl} alt={studio.name} fill priority className="object-cover" />
          </div>
          <div className="flex flex-col justify-center">
            <div className="mb-4 flex flex-wrap gap-2 text-sm">
              <span className="inline-flex items-center gap-1 rounded-md bg-secondary px-2 py-1">
                <Star className="size-4 fill-current" aria-hidden="true" />
                {studio.rating}
              </span>
              <span className="inline-flex items-center gap-1 rounded-md bg-secondary px-2 py-1">
                <MapPin className="size-4" aria-hidden="true" />
                {studio.city}, {studio.district}
              </span>
              <span className="inline-flex items-center gap-1 rounded-md bg-secondary px-2 py-1">
                <Users className="size-4" aria-hidden="true" />
                до {studio.capacity}
              </span>
            </div>
            <h1 className="text-3xl font-semibold tracking-normal md:text-5xl">
              {studio.name}
            </h1>
            <p className="mt-4 text-lg text-muted-foreground">
              {studio.description}
            </p>
            <p className="mt-4 text-sm text-muted-foreground">
              {studio.address}
            </p>
            <p className="mt-3 text-xl font-semibold">
              {formatPrice(studio.pricePerHour)} / час
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Button asChild size="lg">
                <Link href={bookingHref}>
                  <CalendarCheck className="size-4" aria-hidden="true" />
                  Выбрать студию
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline">
                <Link href={`/booking/new?type=STUDIO_ONLY&studioId=${studio.id}`}>
                  Забронировать студию
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </section>
      <section className="section">
        <div className="container grid gap-8 lg:grid-cols-[1fr_360px]">
          <div>
            <h2 className="text-2xl font-semibold tracking-normal">Галерея</h2>
            <div className="mt-5 grid gap-4 md:grid-cols-3">
              {studio.gallery.map((imageUrl) => (
                <div key={imageUrl} className="relative aspect-[4/3] overflow-hidden rounded-lg">
                  <Image src={imageUrl} alt={studio.name} fill className="object-cover" />
                </div>
              ))}
            </div>
            <h2 className="mt-10 text-2xl font-semibold tracking-normal">Залы</h2>
            <div className="mt-5 grid gap-3 md:grid-cols-3">
              {studio.halls.map((hall) => (
                <div key={hall.name} className="rounded-lg border border-border bg-card p-5">
                  <p className="font-medium">{hall.name}</p>
                  <p className="mt-2 text-sm text-muted-foreground">
                    до {hall.capacity} человек · {formatPrice(hall.pricePerHour)} / час
                  </p>
                  <Button asChild size="sm" variant="outline" className="mt-4">
                    <Link href={`/booking/new?type=STUDIO_ONLY&studioId=${studio.id}${hall.id ? `&studioHallId=${hall.id}` : ""}`}>
                      Забронировать этот зал
                    </Link>
                  </Button>
                </div>
              ))}
            </div>
          </div>
          <Card>
            <CardHeader>
              <CardTitle>Условия аренды</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {studio.amenities.map((amenity) => (
                  <span key={amenity} className="rounded-md bg-muted px-2 py-1 text-xs">
                    {amenity}
                  </span>
                ))}
              </div>
              <div className="mt-6 grid gap-3 text-sm text-muted-foreground">
                {studio.rules.map((rule) => (
                  <p key={rule}>• {rule}</p>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </section>
    </>
  );
}
