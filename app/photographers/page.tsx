import { PhotographerCard } from "@/components/cards/photographer-card";
import { PhotographerFilters } from "@/components/photographers/photographer-filters";
import { EmptyState } from "@/components/shared/empty-state";
import { getPhotographers, getPhotographersByStyle } from "@/lib/data/photographers";
import { getStyleBySlug, getStyles } from "@/lib/data/styles";
import {
  PHOTOGRAPHER_MAX_PRICE,
  normalizePhotographerMaxPrice,
  normalizePhotographerRating
} from "@/lib/photographer-filter-options";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Фотографы Алматы — цены, портфолио и свободное время | Framely",
  description:
    "Найдите фотографа в Алматы по стилю, цене и отзывам. Смотрите портфолио, выбирайте свободное время и бронируйте онлайн на Framely.",
  alternates: {
    canonical: "/photographers"
  },
  openGraph: {
    title: "Фотографы Алматы — цены, портфолио и свободное время | Framely",
    description:
      "Найдите фотографа в Алматы по стилю, цене и отзывам. Смотрите портфолио, выбирайте свободное время и бронируйте онлайн на Framely.",
    url: "/photographers",
    siteName: "Framely",
    locale: "ru_KZ",
    type: "website"
  }
};

interface PhotographersPageProps {
  searchParams: Promise<{
    style?: string;
    mode?: string;
    photographer?: string;
    price?: string;
    reviews?: string;
  }>;
}

export default async function PhotographersPage({ searchParams }: PhotographersPageProps) {
  const resolvedSearchParams = await searchParams;
  const isBookingMode = resolvedSearchParams.mode === "booking";
  const [styles, selectedStyle, photographers] = await Promise.all([
    getStyles(),
    getStyleBySlug(resolvedSearchParams.style),
    resolvedSearchParams.style ? getPhotographersByStyle(resolvedSearchParams.style) : getPhotographers()
  ]);
  const filteredPhotographers = photographers
    .filter((photographer) => matchesPrice(photographer.lowestServicePrice ?? photographer.pricePerHour, resolvedSearchParams.price))
    .filter((photographer) => matchesReviews(photographer.rating, resolvedSearchParams.reviews));
  const canShowCatalog =
    isBookingMode ||
    !resolvedSearchParams.style ||
    Boolean(selectedStyle);

  return (
    <section className="py-6 md:py-10">
      <div className="container">
        <div className="mb-6 max-w-3xl md:mb-8">
          <h1 className="text-3xl font-semibold tracking-normal md:text-5xl">Фотографы Алматы</h1>
          <p className="mt-3 text-sm leading-6 text-muted-foreground md:text-base md:leading-7">
            Выбирайте фотографов в Алматы по стилю съёмки, стоимости и отзывам. Смотрите портфолио и
            находите свободное время без долгих переписок.
          </p>
        </div>
        <PhotographerFilters
          styles={styles}
          selectedStyle={resolvedSearchParams.style}
          selectedPrice={resolvedSearchParams.price}
          selectedReviews={resolvedSearchParams.reviews}
          mode={resolvedSearchParams.mode}
        />

        {!isBookingMode && resolvedSearchParams.style && !selectedStyle ? (
          <EmptyState
            title="Такой стиль не найден"
            description="Похоже, ссылка устарела или содержит неверный slug. Вернитесь к каталогу и выберите стиль заново."
          />
        ) : null}
        {canShowCatalog && filteredPhotographers.length === 0 ? (
          <EmptyState
            title="Фотографы не найдены"
            description="Под выбранные фильтры пока нет подходящих фотографов."
          />
        ) : null}
        {canShowCatalog && filteredPhotographers.length > 0 ? (
          <div className="mt-6 grid grid-cols-2 gap-3 md:mt-8 md:gap-5 lg:grid-cols-3">
            {filteredPhotographers.map((photographer) => (
              <PhotographerCard
                key={photographer.id}
                photographer={photographer}
                styleSlug={selectedStyle?.id}
                mode="booking"
              />
            ))}
          </div>
        ) : null}
      </div>
    </section>
  );
}

function matchesPrice(startingPrice: number, price?: string) {
  const maxPrice = normalizePhotographerMaxPrice(price);
  return maxPrice >= PHOTOGRAPHER_MAX_PRICE || startingPrice <= maxPrice;
}

function matchesReviews(rating: number, reviews?: string) {
  const minRating = normalizePhotographerRating(reviews);
  if (!minRating) return true;
  return rating >= minRating;
}
