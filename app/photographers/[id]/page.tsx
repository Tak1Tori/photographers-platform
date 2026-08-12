import Image from "next/image";
import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CalendarCheck, MapPin, Star } from "lucide-react";
import { PhotographerProfileTabs } from "@/components/photographers/photographer-profile-tabs";
import { Button } from "@/components/ui/button";
import { formatPrice, getPhotographerStyleTitles } from "@/lib/mock-data";
import { formatServiceDuration, getPhotographerDisplayPrice } from "@/lib/photographer-services";
import {
  getPublicPhotographerPageData
} from "@/lib/data/photographers";

interface PhotographerDetailPageProps {
  params: {
    id: string;
  };
}

export async function generateMetadata({ params }: PhotographerDetailPageProps): Promise<Metadata> {
  const pageData = await getPublicPhotographerPageData(params.id);

  if (!pageData) {
    return {
      robots: {
        index: false,
        follow: false
      }
    };
  }

  const { photographer } = pageData;
  const city = photographer.city || "Алматы";
  const title = `${photographer.name} — фотограф в ${city} | Framely`;
  const description = buildPhotographerDescription(
    photographer.name,
    city,
    photographer.specializationTitles ?? [],
    photographer.bio
  );
  const image = getOpenGraphImage(photographer.imageUrl, photographer.name);

  return {
    title,
    description,
    alternates: {
      canonical: `/photographers/${photographer.id}`
    },
    openGraph: {
      title,
      description,
      url: `/photographers/${photographer.id}`,
      siteName: "Framely",
      locale: "ru_KZ",
      type: "profile",
      images: image ? [image] : undefined
    }
  };
}

export default function PhotographerDetailPage({ params }: PhotographerDetailPageProps) {
  return <PhotographerDetail params={params} />;
}

function buildPhotographerDescription(name: string, city: string, styles: string[], bio: string) {
  const specialization = styles.slice(0, 3).join(", ");
  const normalizedBio = bio.replace(/\s+/g, " ").trim();
  const profileSummary =
    normalizedBio && normalizedBio !== "Заполните описание профиля."
      ? normalizedBio.slice(0, 130).replace(/[.,;:]?$/, "")
      : "";
  const details = [
    specialization ? `Специализации: ${specialization}.` : "",
    profileSummary || "Смотрите портфолио и выбирайте удобное время для съёмки."
  ]
    .filter(Boolean)
    .join(" ");

  return `${name} — фотограф в ${city}. ${details}`.trim();
}

function getOpenGraphImage(url: string, alt: string) {
  if (!/^https?:\/\//.test(url)) {
    return undefined;
  }

  return {
    url,
    alt
  };
}

async function PhotographerDetail({ params }: PhotographerDetailPageProps) {
  const pageData = await getPublicPhotographerPageData(params.id);

  if (!pageData) {
    notFound();
  }

  const { photographer, portfolioItems, reviews } = pageData;
  const activeServices = photographer.services?.filter((service) => service.isActive) ?? [];

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
              от {formatPrice(getPhotographerDisplayPrice(photographer.pricePerHour, photographer.lowestServicePrice))}
            </p>
            {activeServices.length === 0 ? (
              <Button asChild size="lg" className="photographer-booking-button mt-7 w-full sm:w-fit">
                <Link href={`/booking/new?type=PHOTOGRAPHER_ONLY&photographerId=${photographer.id}`}>
                  <CalendarCheck className="size-4" aria-hidden="true" />
                  Забронировать фотографа
                </Link>
              </Button>
            ) : null}
          </div>
        </div>
      </section>
      {activeServices.length > 0 ? (
        <section className="section border-y border-border bg-card/40">
          <div className="container">
            <div className="mb-6 max-w-2xl">
              <h2 className="text-2xl font-semibold tracking-normal md:text-3xl">Услуги</h2>
              <p className="mt-2 text-sm text-muted-foreground md:text-base">
                Выберите подходящий формат съёмки. Цена и длительность будут зафиксированы в брони.
              </p>
            </div>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {activeServices.map((service) => (
                <article key={service.id} className="flex h-full flex-col rounded-lg border border-border bg-background p-5">
                  <div className="flex items-start justify-between gap-4">
                    <h3 className="text-lg font-semibold tracking-normal">{service.title}</h3>
                    <span className="shrink-0 rounded-md bg-secondary px-2 py-1 text-sm font-medium">
                      {formatServiceDuration(service.durationMinutes)}
                    </span>
                  </div>
                  {service.description ? <p className="mt-3 text-sm leading-6 text-muted-foreground">{service.description}</p> : null}
                  {service.included.length > 0 ? (
                    <ul className="mt-4 grid gap-2 text-sm text-muted-foreground">
                      {service.included.map((item) => <li key={item} className="flex gap-2"><span aria-hidden="true">•</span><span>{item}</span></li>)}
                    </ul>
                  ) : null}
                  <div className="mt-auto flex items-center justify-between gap-3 pt-6">
                    <p className="text-lg font-semibold">{formatPrice(service.price)}</p>
                    <Button asChild size="sm">
                      <Link href={`/booking/new?type=PHOTOGRAPHER_ONLY&photographerId=${photographer.id}&serviceId=${service.id}`}>Выбрать</Link>
                    </Button>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>
      ) : null}
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
