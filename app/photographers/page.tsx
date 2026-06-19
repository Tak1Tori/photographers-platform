import { PhotographerCard } from "@/components/cards/photographer-card";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { getPhotographers, getPhotographersByStyle } from "@/lib/data/photographers";
import { getStyleBySlug } from "@/lib/data/styles";

interface PhotographersPageProps {
  searchParams: {
    style?: string;
    mode?: string;
    flow?: string;
    photographer?: string;
    studio?: string;
  };
}

export default async function PhotographersPage({ searchParams }: PhotographersPageProps) {
  const isBookingMode = searchParams.mode === "booking";
  const isFullShootFlow = searchParams.flow === "full-shoot";
  const [selectedStyle, filteredPhotographers] = await Promise.all([
    getStyleBySlug(searchParams.style),
    isBookingMode || (isFullShootFlow && !searchParams.style)
      ? getPhotographers()
      : searchParams.style
        ? getPhotographersByStyle(searchParams.style)
        : Promise.resolve([])
  ]);

  return (
    <>
      <PageHeader
        eyebrow="Исполнители"
        title={isBookingMode ? "Выберите фотографа для бронирования" : isFullShootFlow ? "Добавьте фотографа в съемку" : selectedStyle ? `Фотографы для ${selectedStyle.title}` : "Фотографы"}
        description={isBookingMode ? "Фотограф приедет на вашу локацию, мероприятие или выбранную площадку." : isFullShootFlow ? "Выбранный фотограф появится в конструкторе фотосессии под ключ." : "Выберите фотографа, который подходит под стиль съемки, город и бюджет."}
      />
      <section className="section">
        <div className="container">
          {!isBookingMode && !isFullShootFlow && !searchParams.style ? (
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
          {(isBookingMode || isFullShootFlow || selectedStyle) && filteredPhotographers.length === 0 ? (
            <EmptyState
              title="Фотографы не найдены"
              description="Для выбранного стиля пока нет подходящих фотографов в базе."
            />
          ) : null}
          {(isBookingMode || isFullShootFlow || selectedStyle) && filteredPhotographers.length > 0 ? (
            <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
              {filteredPhotographers.map((photographer) => (
                <PhotographerCard
                  key={photographer.id}
                  photographer={photographer}
                  styleSlug={selectedStyle?.id}
                  mode={isBookingMode ? "booking" : "full-shoot"}
                  selectionHref={
                    isFullShootFlow
                      ? buildFullShootHref({
                          style: selectedStyle?.id,
                          photographer: photographer.id,
                          studio: searchParams.studio
                        })
                      : undefined
                  }
                  profileHrefOverride={
                    isFullShootFlow
                      ? `/photographers/${photographer.id}?${buildFlowParams({
                          style: selectedStyle?.id,
                          studio: searchParams.studio
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
  photographer: string;
  studio?: string;
}) {
  const params = new URLSearchParams({
    type: "FULL_SHOOT",
    photographer: selection.photographer
  });
  if (selection.style) params.set("style", selection.style);
  if (selection.studio) params.set("studio", selection.studio);
  return `/booking/new?${params.toString()}`;
}

function buildFlowParams(selection: { style?: string; studio?: string }) {
  const params = new URLSearchParams({ flow: "full-shoot" });
  if (selection.style) params.set("style", selection.style);
  if (selection.studio) params.set("studio", selection.studio);
  return params.toString();
}
