import Link from "next/link";
import type { ReactNode } from "react";
import { CheckCircle2 } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { StatusBadge } from "@/components/dashboard/status-badge";
import { getBookingById } from "@/lib/data/bookings";
import { getSession } from "@/lib/auth";
import { formatPrice } from "@/lib/mock-data";

interface BookingSuccessPageProps {
  searchParams: {
    bookingNumber?: string;
  };
}

export default async function BookingSuccessPage({ searchParams }: BookingSuccessPageProps) {
  const booking = await getBookingById(searchParams.bookingNumber ?? "");
  const session = await getSession();
  const showClientCta = Boolean(
    session?.user.role === "CLIENT" && booking?.clientId === session.user.id
  );

  return (
    <>
      <PageHeader
        eyebrow="Success"
        title="Бронь успешно создана"
        description="Депозит оплачен. Исполнитель должен подтвердить бронь."
      />
      <section className="section">
        <div className="container">
          {!booking ? (
            <Card><CardContent className="p-8 text-center text-sm text-muted-foreground">Бронь не найдена.</CardContent></Card>
          ) : (
            <Card className="mx-auto max-w-3xl">
              <CardContent className="grid gap-6 p-8">
                <div className="flex items-start gap-4">
                  <span className="flex size-12 items-center justify-center rounded-md bg-accent text-accent-foreground">
                    <CheckCircle2 className="size-7" aria-hidden="true" />
                  </span>
                  <div>
                    <h2 className="text-2xl font-semibold tracking-normal">Депозит оплачен</h2>
                    <p className="mt-2 text-muted-foreground">Номер брони: <span className="font-medium text-foreground">{booking.id}</span></p>
                  </div>
                </div>
                <div className="grid gap-3 rounded-lg border border-border p-5 text-sm md:grid-cols-2">
                  <Summary label="Тип брони" value={<StatusBadge status={booking.bookingType} />} />
                  <Summary
                    label="Сценарий"
                    value={
                      booking.bookingType === "PHOTOGRAPHER_ONLY"
                        ? "Бронирование фотографа"
                        : booking.bookingType === "STUDIO_ONLY"
                          ? "Бронирование студии"
                          : "Фотосессия под ключ"
                    }
                  />
                  <Summary label="Статус брони" value={<StatusBadge status={booking.status} />} />
                  <Summary label="Статус оплаты" value={<StatusBadge status={booking.paymentStatus} />} />
                  <Summary label="Депозит" value={formatPrice(booking.depositAmount)} />
                  <Summary label="Остаток" value={formatPrice(booking.remainingAmount)} />
                  <Summary label="Дата и время" value={`${booking.date} · ${booking.time}`} />
                  <Summary label="Длительность" value={`${booking.durationHours} ч`} />
                  {booking.bookingType === "PHOTOGRAPHER_ONLY" ? (
                    <>
                      <Summary label="Фотограф" value={booking.photographerName ?? booking.photographerId ?? "-"} />
                      <Summary label="Тип съемки" value={booking.shootType ?? "-"} />
                      <Summary label="Локация" value={[booking.city, booking.district].filter(Boolean).join(", ") || "-"} />
                    </>
                  ) : null}
                  {booking.bookingType === "STUDIO_ONLY" ? (
                    <>
                      <Summary label="Студия" value={booking.studioName ?? booking.studioId ?? "-"} />
                      <Summary label="Зал" value={booking.hallName ?? "-"} />
                      <Summary label="Цель аренды" value={booking.rentalPurpose ?? "-"} />
                    </>
                  ) : null}
                  <Summary label="Общая сумма" value={formatPrice(booking.totalAmount)} />
                </div>
                <p className="rounded-md bg-secondary px-4 py-3 text-sm font-medium">
                  {booking.bookingType === "PHOTOGRAPHER_ONLY"
                    ? "Ожидает подтверждения фотографа."
                    : booking.bookingType === "STUDIO_ONLY"
                      ? "Ожидает подтверждения студии."
                      : "Фотограф и студия должны подтвердить бронь."}
                </p>
                <Button asChild className="w-fit">
                  <Link href={showClientCta ? "/dashboard/client/bookings" : "/"}>
                    {showClientCta ? "Перейти в мои брони" : "На главную"}
                  </Link>
                </Button>
              </CardContent>
            </Card>
          )}
        </div>
      </section>
    </>
  );
}

function Summary({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div>
      <p className="text-muted-foreground">{label}</p>
      <div className="mt-1 font-semibold">{value}</div>
    </div>
  );
}
