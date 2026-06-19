import { FullShootBuilder } from "@/components/booking/new-flow/full-shoot-builder";
import { BookingTypeSelector } from "@/components/booking/new-flow/booking-type-selector";
import { PhotographerOnlyForm } from "@/components/booking/new-flow/photographer-only-form";
import { StudioOnlyForm } from "@/components/booking/new-flow/studio-only-form";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { getSession } from "@/lib/auth";
import { getPhotographerForBooking } from "@/lib/data/photographers";
import { getStudioForBooking, getStudioHallForBooking } from "@/lib/data/studios";
import { getStyleBySlug } from "@/lib/data/styles";
import type { BookingType, Studio, StudioHall } from "@/lib/types";

interface BookingNewPageProps {
  searchParams: {
    type?: BookingType;
    style?: string;
    photographer?: string;
    studio?: string;
    photographerId?: string;
    studioId?: string;
    studioHallId?: string;
  };
}

const validTypes: BookingType[] = ["FULL_SHOOT", "PHOTOGRAPHER_ONLY", "STUDIO_ONLY"];

export default async function BookingNewPage({ searchParams }: BookingNewPageProps) {
  const type = validTypes.includes(searchParams.type as BookingType)
    ? (searchParams.type as BookingType)
    : undefined;

  const fullShootSelection =
    type === "FULL_SHOOT"
      ? await Promise.all([
          getStyleBySlug(searchParams.style),
          getPhotographerForBooking(searchParams.photographer),
          getStudioForBooking(searchParams.studio)
        ])
      : undefined;

  const photographer =
    type === "PHOTOGRAPHER_ONLY"
      ? await getPhotographerForBooking(searchParams.photographerId)
      : undefined;
  const session =
    type === "PHOTOGRAPHER_ONLY" || type === "STUDIO_ONLY" ? await getSession() : undefined;
  const studioSelection =
    type === "STUDIO_ONLY"
      ? await resolveStudioSelection(searchParams.studioId, searchParams.studioHallId)
      : undefined;

  return (
    <>
      <PageHeader
        eyebrow="Booking"
        title={type ? getTitle(type) : "Выберите тип бронирования"}
        description={type ? getDescription(type) : "Framely поддерживает три сценария: под ключ, фотограф отдельно или студия отдельно."}
      />
      <section className="section">
        <div className="container">
          {!type ? <BookingTypeSelector /> : null}
          {type === "FULL_SHOOT" ? (
            <FullShootBuilder
              style={fullShootSelection?.[0]}
              photographer={fullShootSelection?.[1]}
              studio={fullShootSelection?.[2]}
            />
          ) : null}

          {type === "PHOTOGRAPHER_ONLY" && searchParams.photographerId && !photographer ? (
            <EmptyState
              title="Фотограф не найден"
              description="Проверьте ссылку или вернитесь к каталогу фотографов."
              actionLabel="Выбрать фотографа"
              actionHref="/photographers?mode=booking"
            />
          ) : null}
          {type === "PHOTOGRAPHER_ONLY" && (!searchParams.photographerId || photographer) ? (
            <PhotographerOnlyForm
              photographer={photographer}
              clientDefaults={{
                name: session?.user.name,
                email: session?.user.email,
                phone: session?.user.phone
              }}
            />
          ) : null}

          {type === "STUDIO_ONLY" && (searchParams.studioId || searchParams.studioHallId) && !studioSelection?.studio ? (
            <EmptyState
              title="Студия или зал не найдены"
              description="Проверьте ссылку или вернитесь к каталогу студий."
              actionLabel="Выбрать студию"
              actionHref="/studios?mode=booking"
            />
          ) : null}
          {type === "STUDIO_ONLY" && ((!searchParams.studioId && !searchParams.studioHallId) || studioSelection?.studio) ? (
            <StudioOnlyForm
              studio={studioSelection?.studio}
              hall={studioSelection?.hall}
              clientDefaults={{
                name: session?.user.name,
                email: session?.user.email,
                phone: session?.user.phone
              }}
            />
          ) : null}
        </div>
      </section>
    </>
  );
}

async function resolveStudioSelection(studioId?: string, hallId?: string) {
  if (studioId) {
    const studio = await getStudioForBooking(studioId);
    const hall = studio?.halls.find((item) => item.id === hallId);
    return { studio, hall };
  }

  if (hallId) {
    return getStudioHallForBooking(hallId);
  }

  return undefined as { studio?: Studio; hall?: StudioHall } | undefined;
}

function getTitle(type: BookingType) {
  const map: Record<BookingType, string> = {
    FULL_SHOOT: "Фотосессия под ключ",
    PHOTOGRAPHER_ONLY: "Бронирование фотографа",
    STUDIO_ONLY: "Бронирование студии"
  };
  return map[type];
}

function getDescription(type: BookingType) {
  const map: Record<BookingType, string> = {
    FULL_SHOOT: "Соберите съемку в одном месте: выберите стиль, фотографа и студию.",
    PHOTOGRAPHER_ONLY: "Базовая форма заявки на фотографа для съемки на вашей локации.",
    STUDIO_ONLY: "Базовая форма заявки на аренду студии или конкретного зала."
  };
  return map[type];
}
