import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CalendarCheck, MapPin, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PortfolioGallery } from "@/components/portfolio/portfolio-gallery";
import { formatPrice, getStyleTitles } from "@/lib/mock-data";
import {
  getPhotographerById,
  getPhotographerSlots,
  getPortfolioItems
} from "@/lib/data/photographers";
import { getStyleBySlug } from "@/lib/data/styles";

interface PhotographerDetailPageProps {
  params: {
    id: string;
  };
  searchParams: {
    style?: string;
  };
}

export default function PhotographerDetailPage({
  params,
  searchParams
}: PhotographerDetailPageProps) {
  return <PhotographerDetail params={params} searchParams={searchParams} />;
}

async function PhotographerDetail({ params, searchParams }: PhotographerDetailPageProps) {
  const photographer = await getPhotographerById(params.id);

  if (!photographer) {
    notFound();
  }

  const [requestedStyle, fallbackStyle, slots, portfolioItems] = await Promise.all([
    getStyleBySlug(searchParams.style),
    getStyleBySlug(photographer.specializationIds[0]),
    getPhotographerSlots(photographer.id),
    getPortfolioItems(photographer.id)
  ]);
  const selectedStyle = requestedStyle ?? fallbackStyle;

  return (
    <>
      <section className="bg-card">
        <div className="container grid gap-8 py-10 md:grid-cols-[0.8fr_1.2fr] md:py-14">
          <div className="relative aspect-[4/5] overflow-hidden rounded-lg border border-border">
            <Image
              src={photographer.imageUrl}
              alt={photographer.name}
              fill
              priority
              className="object-cover"
            />
          </div>
          <div className="flex flex-col justify-center">
            <div className="mb-4 flex flex-wrap gap-2 text-sm">
              <span className="inline-flex items-center gap-1 rounded-md bg-secondary px-2 py-1">
                <Star className="size-4 fill-current" aria-hidden="true" />
                {photographer.rating}
              </span>
              <span className="inline-flex items-center gap-1 rounded-md bg-secondary px-2 py-1">
                <MapPin className="size-4" aria-hidden="true" />
                {photographer.city}
              </span>
            </div>
            <h1 className="text-3xl font-semibold tracking-normal md:text-5xl">
              {photographer.name}
            </h1>
            <p className="mt-4 text-lg leading-8 text-muted-foreground">{photographer.bio}</p>
            <div className="mt-5 flex flex-wrap gap-2">
              {getStyleTitles(photographer.specializationIds).map((style) => (
                <span key={style} className="rounded-md bg-secondary px-3 py-1 text-sm">
                  {style}
                </span>
              ))}
            </div>
            <p className="mt-3 text-xl font-semibold">
              {formatPrice(photographer.pricePerHour)} / час
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Button asChild size="lg">
                <Link
                  href={`/studios?style=${selectedStyle?.id ?? photographer.specializationIds[0]}&photographer=${photographer.id}`}
                >
                  <CalendarCheck className="size-4" aria-hidden="true" />
                  Выбрать этого фотографа
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline">
                <Link href={`/booking/new?type=PHOTOGRAPHER_ONLY&photographerId=${photographer.id}`}>
                  Забронировать фотографа
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </section>
      <section className="section">
        <div className="container grid gap-8 lg:grid-cols-[1fr_360px]">
          <div>
            <h2 className="text-2xl font-semibold tracking-normal">Портфолио</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Откройте работу, чтобы посмотреть все фотографии внутри альбома.
            </p>
            <PortfolioGallery photographerId={photographer.id} items={portfolioItems} />
          </div>
          <Card>
            <CardHeader>
              <CardTitle>Доступные даты и слоты</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3">
              {slots.map((slot) => (
                <div
                  key={slot.id}
                  className="rounded-md border border-border px-3 py-3 text-sm"
                >
                  <div className="flex items-center justify-between gap-3">
                    <span className="font-medium">{slot.label}</span>
                    <span className="text-muted-foreground">{slot.times.length} слота</span>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {slot.times.map((time) => (
                      <span key={time} className="rounded-md bg-muted px-2 py-1">
                        {time}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </section>
    </>
  );
}
