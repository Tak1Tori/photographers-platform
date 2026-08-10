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

interface PhotographersPageProps {
  searchParams: {
    style?: string;
    mode?: string;
    photographer?: string;
    price?: string;
    reviews?: string;
  };
}

export default async function PhotographersPage({ searchParams }: PhotographersPageProps) {
  const isBookingMode = searchParams.mode === "booking";
  const [styles, selectedStyle, photographers] = await Promise.all([
    getStyles(),
    getStyleBySlug(searchParams.style),
    searchParams.style ? getPhotographersByStyle(searchParams.style) : getPhotographers()
  ]);
  const filteredPhotographers = photographers
    .filter((photographer) => matchesPrice(photographer.pricePerHour, searchParams.price))
    .filter((photographer) => matchesReviews(photographer.rating, searchParams.reviews));
  const canShowCatalog =
    isBookingMode ||
    !searchParams.style ||
    Boolean(selectedStyle);

  return (
    <section className="py-6 md:py-10">
      <div className="container">
        <PhotographerFilters
          styles={styles}
          selectedStyle={searchParams.style}
          selectedPrice={searchParams.price}
          selectedReviews={searchParams.reviews}
          mode={searchParams.mode}
        />

        {!isBookingMode && searchParams.style && !selectedStyle ? (
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

function matchesPrice(pricePerHour: number, price?: string) {
  const maxPrice = normalizePhotographerMaxPrice(price);
  return maxPrice >= PHOTOGRAPHER_MAX_PRICE || pricePerHour <= maxPrice;
}

function matchesReviews(rating: number, reviews?: string) {
  const minRating = normalizePhotographerRating(reviews);
  if (!minRating) return true;
  return rating >= minRating;
}
