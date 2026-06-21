import { BookingFlow } from "@/components/booking/booking-flow";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { getPhotographerById } from "@/lib/data/photographers";
import { getStudioById } from "@/lib/data/studios";
import { getStyleBySlug } from "@/lib/data/styles";
import { getSession } from "@/lib/auth";

interface BookingPageProps {
  searchParams: {
    style?: string;
    photographer?: string;
    studio?: string;
  };
}

export default async function BookingPage({ searchParams }: BookingPageProps) {
  const selectedStyle = await getStyleBySlug(searchParams.style);
  const selectedPhotographer = await getPhotographerById(searchParams.photographer);
  const selectedStudio = await getStudioById(searchParams.studio);
  const session = await getSession();
  const hasRequiredParams =
    Boolean(searchParams.style) &&
    Boolean(searchParams.photographer) &&
    Boolean(searchParams.studio);

  return (
    <>
      <PageHeader
        eyebrow="Mock flow"
        title="Бронирование"
        description="Проверьте выбранные детали, выберите дату, время и длительность, затем создайте mock-бронь."
      />
      {!hasRequiredParams ? (
        <section className="section">
          <div className="container">
            <EmptyState
              title="Недостаточно данных для бронирования"
              description="Для финального шага нужны выбранный стиль, фотограф и студия. Начните с каталога стилей."
            />
          </div>
        </section>
      ) : null}
      {hasRequiredParams && !selectedStyle ? (
        <section className="section">
          <div className="container">
            <EmptyState
              title="Стиль не найден"
              description="Ссылка содержит неизвестный стиль съемки."
            />
          </div>
        </section>
      ) : null}
      {hasRequiredParams && !selectedPhotographer ? (
        <section className="section">
          <div className="container">
            <EmptyState
              title="Фотограф не найден"
              description="Выбранный фотограф отсутствует в mock data."
            />
          </div>
        </section>
      ) : null}
      {hasRequiredParams && !selectedStudio ? (
        <section className="section">
          <div className="container">
            <EmptyState
              title="Студия не найдена"
              description="Выбранная студия отсутствует в mock data."
            />
          </div>
        </section>
      ) : null}
      {selectedStyle && selectedPhotographer && selectedStudio ? (
        <BookingFlow
          style={selectedStyle}
          photographer={selectedPhotographer}
          studio={selectedStudio}
          currentUser={session?.user}
        />
      ) : null}
    </>
  );
}
