import { PhotographerCard } from "@/components/cards/photographer-card";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { getPhotographers, getPhotographersByStyle } from "@/lib/data/photographers";
import { getStyleBySlug } from "@/lib/data/styles";

interface PhotographersPageProps {
  searchParams: {
    style?: string;
    mode?: string;
  };
}

export default async function PhotographersPage({ searchParams }: PhotographersPageProps) {
  const isBookingMode = searchParams.mode === "booking";
  const selectedStyle = await getStyleBySlug(searchParams.style);
  const filteredPhotographers = isBookingMode
    ? await getPhotographers()
    : selectedStyle
    ? await getPhotographersByStyle(selectedStyle.id)
    : [];

  return (
    <>
      <PageHeader
        eyebrow="Исполнители"
        title={isBookingMode ? "Выберите фотографа для бронирования" : selectedStyle ? `Фотографы для ${selectedStyle.title}` : "Фотографы"}
        description={isBookingMode ? "Фотограф приедет на вашу локацию, мероприятие или выбранную площадку." : "Выберите фотографа, который подходит под стиль съемки, город и бюджет."}
      />
      <section className="section">
        <div className="container">
          {!isBookingMode && !searchParams.style ? (
            <EmptyState
              title="Сначала выберите стиль"
              description="Фильтр фотографов строится от выбранного стиля съемки, чтобы дальше сохранить корректный сценарий бронирования."
            />
          ) : null}
          {!isBookingMode && searchParams.style && !selectedStyle ? (
            <EmptyState
              title="Такой стиль не найден"
              description="Похоже, ссылка устарела или содержит неверный slug. Вернитесь к каталогу и выберите стиль заново."
            />
          ) : null}
          {(isBookingMode || selectedStyle) && filteredPhotographers.length === 0 ? (
            <EmptyState
              title="Фотографы не найдены"
              description="Для выбранного стиля пока нет подходящих фотографов в базе."
            />
          ) : null}
          {(isBookingMode || selectedStyle) && filteredPhotographers.length > 0 ? (
            <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
              {filteredPhotographers.map((photographer) => (
                <PhotographerCard
                  key={photographer.id}
                  photographer={photographer}
                  styleSlug={selectedStyle?.id}
                  mode={isBookingMode ? "booking" : "full-shoot"}
                />
              ))}
            </div>
          ) : null}
        </div>
      </section>
    </>
  );
}
