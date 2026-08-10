import { redirect } from "next/navigation";
import { PhotographerOnlyForm } from "@/components/booking/new-flow/photographer-only-form";
import { EmptyState } from "@/components/shared/empty-state";
import { getSession } from "@/lib/auth";
import { getPhotographerForBooking } from "@/lib/data/photographers";
import type { BookingType } from "@/lib/types";

interface BookingNewPageProps {
  searchParams: Promise<{
    type?: BookingType;
    photographerId?: string;
  }>;
}

export default async function BookingNewPage({ searchParams }: BookingNewPageProps) {
  const params = await searchParams;

  if (params.type !== "PHOTOGRAPHER_ONLY") {
    redirect("/photographers?mode=booking");
  }

  const [photographer, session] = await Promise.all([
    getPhotographerForBooking(params.photographerId),
    getSession()
  ]);

  return (
    <section className="py-6 md:py-10">
      <div className="container">
        {params.photographerId && !photographer ? (
          <EmptyState
            title="Фотограф не найден"
            description="Проверьте ссылку или вернитесь к каталогу фотографов."
            actionLabel="Выбрать фотографа"
            actionHref="/photographers?mode=booking"
          />
        ) : null}
        {!params.photographerId || photographer ? (
          <PhotographerOnlyForm
            photographer={photographer}
            clientDefaults={{
              name: session?.user.name,
              phone: session?.user.phone
            }}
          />
        ) : null}
      </div>
    </section>
  );
}
