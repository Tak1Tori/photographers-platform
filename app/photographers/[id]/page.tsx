import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CalendarCheck, MapPin, Star } from "lucide-react";
import { PhotographerProfileTabs } from "@/components/photographers/photographer-profile-tabs";
import { Button } from "@/components/ui/button";
import { formatPrice, getPhotographerStyleTitles } from "@/lib/mock-data";
import {
  getPublicPhotographerPageData
} from "@/lib/data/photographers";

interface PhotographerDetailPageProps {
  params: {
    id: string;
  };
}

export default function PhotographerDetailPage({ params }: PhotographerDetailPageProps) {
  return <PhotographerDetail params={params} />;
}

async function PhotographerDetail({ params }: PhotographerDetailPageProps) {
  const pageData = await getPublicPhotographerPageData(params.id);

  if (!pageData) {
    notFound();
  }

  const { photographer, portfolioItems, reviews } = pageData;

  return (
    <>
      <section className="photographer-profile-hero bg-card">
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
              <span className="inline-flex items-center gap-1 rounded-md bg-secondary px-2 py-1 text-secondary-foreground">
                <Star className="size-4 fill-current" aria-hidden="true" />
                {photographer.rating}
              </span>
              <span className="inline-flex items-center gap-1 rounded-md bg-secondary px-2 py-1 text-secondary-foreground">
                <MapPin className="size-4" aria-hidden="true" />
                {photographer.city}
              </span>
            </div>
            <h1 className="text-3xl font-semibold tracking-normal md:text-5xl">
              {photographer.name}
            </h1>
            <p className="mt-4 text-lg leading-8 text-muted-foreground">{photographer.bio}</p>
            <div className="mt-5 flex flex-wrap gap-2">
              {getPhotographerStyleTitles(photographer).map((style) => (
                <span
                  key={style}
                  className="rounded-md bg-secondary px-3 py-1 text-sm text-secondary-foreground"
                >
                  {style}
                </span>
              ))}
            </div>
            <p className="mt-3 text-xl font-semibold">
              {formatPrice(photographer.pricePerHour)} / час
            </p>
            <Button asChild size="lg" className="photographer-booking-button mt-7 w-full sm:w-fit">
              <Link href={`/booking/new?type=PHOTOGRAPHER_ONLY&photographerId=${photographer.id}`}>
                <CalendarCheck className="size-4" aria-hidden="true" />
                Забронировать фотографа
              </Link>
            </Button>
          </div>
        </div>
      </section>
      <section className="section">
        <div className="container">
          <PhotographerProfileTabs
            photographerId={photographer.id}
            portfolioItems={portfolioItems}
            reviews={reviews}
          />
        </div>
      </section>
    </>
  );
}
