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
    flow?: string;
  };
}

export default async function StudiosPage({ searchParams }: StudiosPageProps) {
  const isBookingMode = searchParams.mode === "booking";
  const isFullShootFlow = searchParams.flow === "full-shoot";
  const selectedStyle = await getStyleBySlug(searchParams.style);
  const selectedPhotographer = await getPhotographerById(searchParams.photographer);
  const filteredStudios =
    isBookingMode || isFullShootFlow
      ? await getStudios()
      : selectedStyle && selectedPhotographer
      ? await getStudios({ city: selectedPhotographer.city, style: selectedStyle.id })
      : [];

  return (
    <>
      <PageHeader
        eyebrow="Локации"
        title={isBookingMode ? "Выберите студию или зал" : isFullShootFlow ? "Добавьте студию в съемку" : selectedStyle ? `Студии для ${selectedStyle.title}` : "Студии"}
        description={isBookingMode ? "Выберите студию для отдельной аренды под вашу съемку." : isFullShootFlow ? "Выбранное пространство появится в конструкторе фотосессии под ключ." : "Подбираем пространства по городу фотографа и условной совместимости со стилем съемки."}
      />
      <section className="section">
        <div className="container">
          {!isBookingMode && !isFullShootFlow && (!searchParams.style || !searchParams.photographer) ? (
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
          {(isBookingMode || isFullShootFlow || (selectedStyle && selectedPhotographer)) && filteredStudios.length === 0 ? (
            <EmptyState
              title="Подходящие студии не найдены"
              description="Для города фотографа и выбранного стиля пока нет доступных студий в базе."
            />
          ) : null}
          {(isBookingMode || isFullShootFlow || (selectedStyle && selectedPhotographer)) && filteredStudios.length > 0 ? (
            <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
              {filteredStudios.map((studio) => (
                <StudioCard
                  key={studio.id}
                  studio={studio}
                  styleSlug={selectedStyle?.id}
                  photographerId={selectedPhotographer?.id}
                  mode={isBookingMode ? "booking" : "full-shoot"}
                  selectionHref={
                    isFullShootFlow
                      ? buildFullShootHref({
                          style: selectedStyle?.id,
                          photographer: selectedPhotographer?.id,
                          studio: studio.id
                        })
                      : undefined
                  }
                  detailHrefOverride={
                    isFullShootFlow
                      ? `/studios/${studio.id}?${buildFlowParams({
                          style: selectedStyle?.id,
                          photographer: selectedPhotographer?.id
                        })}`
                      : undefined
                  }
                />
              ))}
            </div>
          ) : null}
        </div>
      </section>
    </>
  );
}

function buildFullShootHref(selection: {
  style?: string;
  photographer?: string;
  studio: string;
}) {
  const params = new URLSearchParams({
    type: "FULL_SHOOT",
    studio: selection.studio
  });
  if (selection.style) params.set("style", selection.style);
  if (selection.photographer) params.set("photographer", selection.photographer);
  return `/booking/new?${params.toString()}`;
}

function buildFlowParams(selection: { style?: string; photographer?: string }) {
  const params = new URLSearchParams({ flow: "full-shoot" });
  if (selection.style) params.set("style", selection.style);
  if (selection.photographer) params.set("photographer", selection.photographer);
  return params.toString();
}
