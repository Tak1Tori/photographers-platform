import { BookingFlow } from "@/components/booking/booking-flow";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { getAvailableBookingSlots } from "@/lib/data/bookings";
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

  const slots =
    selectedPhotographer && selectedStudio
      ? await getAvailableBookingSlots(selectedPhotographer.id, selectedStudio.id)
      : [];

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
      {selectedStyle && selectedPhotographer && selectedStudio && slots.length === 0 ? (
        <section className="section">
          <div className="container">
            <EmptyState
              title="Нет общих свободных слотов"
              description="У фотографа и студии нет пересекающихся дат в mock data. Попробуйте выбрать другую студию."
              actionLabel="Вернуться к выбору студии"
              actionHref={`/studios?style=${selectedStyle.id}&photographer=${selectedPhotographer.id}`}
            />
          </div>
        </section>
      ) : null}
      {selectedStyle && selectedPhotographer && selectedStudio && slots.length > 0 ? (
        <BookingFlow
          style={selectedStyle}
          photographer={selectedPhotographer}
          studio={selectedStudio}
          slots={slots}
          currentUser={session?.user}
        />
      ) : null}
    </>
  );
}
