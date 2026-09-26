import { redirect } from "next/navigation";
import { PhotographerOnlyForm } from "@/components/booking/new-flow/photographer-only-form";
import { EmptyState } from "@/components/shared/empty-state";
import { getSession } from "@/lib/auth";
import { getPhotographerForBooking } from "@/lib/data/photographers";
import { getJobBoardBookingContext } from "@/lib/job-board/job-post-service";
import type { BookingType } from "@/lib/types";

interface BookingNewPageProps {
  searchParams: Promise<{
    type?: BookingType;
    photographerId?: string;
    serviceId?: string;
    jobPostId?: string;
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
  const selectedService = params.serviceId
    ? photographer?.services?.find((service) => service.id === params.serviceId && service.isActive)
    : undefined;
  const jobContext = await getJobBoardBookingContext({
    jobPostId: params.jobPostId,
    clientId: session?.user.id,
    photographerId: photographer?.id
  });

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
        {params.photographerId && params.serviceId && photographer && !selectedService ? (
          <EmptyState
            title="Услуга недоступна"
            description="Эта услуга была отключена или удалена. Выберите актуальный формат на странице фотографа."
            actionLabel="К услугам фотографа"
            actionHref={`/photographers/${photographer.id}`}
          />
        ) : null}
        {(!params.photographerId || photographer) && (!params.serviceId || selectedService) ? (
          <>
            {jobContext ? (
              <div className="mb-6 rounded-xl border border-primary/35 bg-primary/[0.06] p-5 md:p-6">
                <p className="text-sm font-medium text-primary">Выбор из доски объявлений</p>
                <h1 className="mt-2 text-xl font-semibold tracking-normal">{jobContext.title}</h1>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">Фотограф выбран. Подтвердите детали ниже, чтобы закрепить время и оформить бронирование.</p>
                <p className="mt-3 text-sm text-muted-foreground">{jobContext.city} · {new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "long" }).format(new Date(jobContext.date))} · {jobContext.startTime}</p>
              </div>
            ) : null}
            <PhotographerOnlyForm
              photographer={photographer}
              service={selectedService}
              clientDefaults={{
                name: session?.user.name,
                phone: session?.user.phone
              }}
            />
          </>
        ) : null}
      </div>
    </section>
  );
}
