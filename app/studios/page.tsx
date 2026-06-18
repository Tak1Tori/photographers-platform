import { StudioCard } from "@/components/cards/studio-card";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { getPhotographerById } from "@/lib/data/photographers";
import { getStudios } from "@/lib/data/studios";
import { getStyleBySlug } from "@/lib/data/styles";

interface StudiosPageProps {
  searchParams: {
    style?: string;
    photographer?: string;
    mode?: string;
  };
}

export default async function StudiosPage({ searchParams }: StudiosPageProps) {
  const isBookingMode = searchParams.mode === "booking";
  const selectedStyle = await getStyleBySlug(searchParams.style);
  const selectedPhotographer = await getPhotographerById(searchParams.photographer);
  const filteredStudios =
    isBookingMode
      ? await getStudios()
      : selectedStyle && selectedPhotographer
      ? await getStudios({ city: selectedPhotographer.city, style: selectedStyle.id })
      : [];

  return (
    <>
      <PageHeader
        eyebrow="Локации"
        title={isBookingMode ? "Выберите студию или зал" : selectedStyle ? `Студии для ${selectedStyle.title}` : "Студии"}
        description={isBookingMode ? "Выберите студию для отдельной аренды под вашу съемку." : "Подбираем пространства по городу фотографа и условной совместимости со стилем съемки."}
      />
      <section className="section">
        <div className="container">
          {!isBookingMode && (!searchParams.style || !searchParams.photographer) ? (
            <EmptyState
              title="Недостаточно данных для подбора студии"
              description="Для этого шага нужен выбранный стиль и фотограф. Начните flow с выбора стиля."
            />
          ) : null}
          {!isBookingMode && searchParams.style && !selectedStyle ? (
            <EmptyState
              title="Стиль не найден"
              description="Ссылка содержит неизвестный style slug. Выберите стиль заново."
            />
          ) : null}
          {!isBookingMode && searchParams.photographer && !selectedPhotographer ? (
            <EmptyState
              title="Фотограф не найден"
              description="Мы не нашли фотографа из ссылки в mock data. Вернитесь к выбору стиля и пройдите сценарий заново."
            />
          ) : null}
          {(isBookingMode || (selectedStyle && selectedPhotographer)) && filteredStudios.length === 0 ? (
            <EmptyState
              title="Подходящие студии не найдены"
              description="Для города фотографа и выбранного стиля пока нет доступных студий в базе."
            />
          ) : null}
          {(isBookingMode || (selectedStyle && selectedPhotographer)) && filteredStudios.length > 0 ? (
            <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
              {filteredStudios.map((studio) => (
                <StudioCard
                  key={studio.id}
                  studio={studio}
                  styleSlug={selectedStyle?.id}
                  photographerId={selectedPhotographer?.id}
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
