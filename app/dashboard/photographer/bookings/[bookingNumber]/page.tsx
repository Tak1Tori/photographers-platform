import Link from "next/link";
import type { ReactNode } from "react";
import { notFound } from "next/navigation";
import { AlertTriangle, ArrowLeft } from "lucide-react";
import { MobileBookingSection } from "@/components/dashboard/mobile-booking-section";
import { StatusBadge } from "@/components/dashboard/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { autoCompletePastBookings } from "@/lib/bookings/status-service";
import { getPhotographerBookings } from "@/lib/data/bookings";
import { getOrCreatePhotographerProfileByUserId } from "@/lib/data/photographers";
import { requireSession } from "@/lib/guards";
import { formatPrice } from "@/lib/mock-data";
import { calculateProviderPayouts } from "@/lib/provider-payouts";

export const dynamic = "force-dynamic";

interface PhotographerBookingDetailsPageProps {
  params: {
    bookingNumber: string;
  };
}

export default async function PhotographerBookingDetailsPage({
  params
}: PhotographerBookingDetailsPageProps) {
  const session = await requireSession(["PHOTOGRAPHER", "ADMIN"]);
  const profile = await getOrCreatePhotographerProfileByUserId(session.user.id);
  const bookingNumber = decodeURIComponent(params.bookingNumber);

  await autoCompletePastBookings();

  const bookings = await getPhotographerBookings(profile.photographerId);
  const booking = bookings.find((item) => item.id === bookingNumber || item.dbId === bookingNumber);

  if (!booking) {
    notFound();
  }

  const payouts = calculateProviderPayouts(booking);
  const platformPaid = booking.paidAmount || booking.platformFeeAmount || booking.depositAmount;

  return (
    <section className="section">
      <div className="container grid gap-6">
        <Button asChild variant="outline" className="w-fit">
          <Link href="/dashboard/photographer?section=bookings">
            <ArrowLeft className="size-4" aria-hidden="true" />
            Назад к броням
          </Link>
        </Button>

        <div>
          <h1 className="text-3xl font-semibold tracking-normal">Бронь {booking.id}</h1>
          <p className="mt-2 text-muted-foreground">
            Детали заявки, оплаты и запроса на перенос для фотографа.
          </p>
        </div>

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
          <div className="grid gap-6">
            {booking.rescheduleRequestedAt ? (
              <Card className="border-amber-400/35 bg-amber-400/[0.04]">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-amber-100">
                    <AlertTriangle className="size-5" aria-hidden="true" />
                    Запрошен перенос
                  </CardTitle>
                </CardHeader>
                <CardContent className="grid gap-2 text-sm text-muted-foreground">
                  <p>
                    Новая дата уже отображается в календаре желтым цветом до подтверждения
                    фотографом.
                  </p>
                  {booking.rescheduleComment ? (
                    <p className="rounded-md border border-amber-400/25 bg-background/45 p-3 text-foreground">
                      {booking.rescheduleComment}
                    </p>
                  ) : null}
                </CardContent>
              </Card>
            ) : null}

            <MobileBookingSection
              title="Основная информация"
              icon="calendar"
              contentClassName="md:grid-cols-2"
            >
                <Summary label="Номер брони" value={booking.id} />
                <Summary label="Дата" value={booking.date} />
                <Summary label="Время" value={booking.time} />
                <Summary label="Длительность" value={`${booking.durationHours} ч`} />
                <Summary label="Тип брони" value={<StatusBadge status={booking.bookingType} />} />
                <Summary label="Статус брони" value={<StatusBadge status={booking.status} />} />
                <Summary label="Статус оплаты" value={<StatusBadge status={booking.paymentStatus} />} />
            </MobileBookingSection>

            <MobileBookingSection title="Детали съемки" icon="location" contentClassName="md:grid-cols-2">
                <Summary label="Стиль / тип" value={booking.shootType || booking.styleId || "-"} />
                <Summary label="Город" value={booking.city || "-"} />
                <Summary label="Локация" value={booking.addressDetails || booking.studioAddress || "-"} />
                <Summary label="Район" value={booking.district || "-"} />
                <Summary label="Описание" value={booking.shootDescription || "-"} />
                <Summary label="Особые требования" value={booking.specialRequirements || "-"} />
            </MobileBookingSection>

            <MobileBookingSection title="Клиент" icon="user" contentClassName="md:grid-cols-2">
                <Summary label="Имя" value={booking.clientName} />
                <Summary label="Телефон" value={booking.clientPhone || "-"} />
                <Summary label="Комментарий" value={booking.clientComment || "-"} />
            </MobileBookingSection>
          </div>

          <MobileBookingSection
            title="Финансы фотографа"
            icon="payment"
            className="h-fit lg:sticky lg:top-24"
            contentClassName="text-sm"
          >
              <MoneyLine label="Услуга фотографа" value={payouts.photographerGross} />
              <MoneyLine label="Сервисный сбор" value={payouts.photographerFeeShare} />
              <MoneyLine label="Оплачено платформе" value={platformPaid} />
              <div className="border-t border-border pt-3">
                <MoneyLine label="К выплате фотографу" value={payouts.photographerPayout} strong />
              </div>
          </MobileBookingSection>
        </div>
      </div>
    </section>
  );
}

function Summary({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="rounded-lg border border-border p-4">
      <p className="text-sm text-muted-foreground">{label}</p>
      <div className="mt-1 font-semibold">{value}</div>
    </div>
  );
}

function MoneyLine({
  label,
  value,
  strong = false
}: {
  label: string;
  value: number;
  strong?: boolean;
}) {
  return (
    <div className={`flex justify-between gap-4 ${strong ? "text-base font-semibold" : ""}`}>
      <span className={strong ? "" : "text-muted-foreground"}>{label}</span>
      <span>{formatPrice(value)}</span>
    </div>
  );
}
