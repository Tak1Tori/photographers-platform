import Link from "next/link";
import type { ReactNode } from "react";
import { CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { StatusBadge } from "@/components/dashboard/status-badge";
import { getBookingById } from "@/lib/data/bookings";
import { getSession } from "@/lib/auth";
import { formatPrice } from "@/lib/mock-data";

interface BookingSuccessPageProps {
  searchParams: Promise<{
    bookingNumber?: string;
  }>;
}

export default async function BookingSuccessPage({ searchParams }: BookingSuccessPageProps) {
  const { bookingNumber } = await searchParams;
  const booking = await getBookingById(bookingNumber ?? "");
  const session = await getSession();
  const showClientCta = Boolean(
    session?.user.role === "CLIENT" && booking?.clientId === session.user.id
  );
  const platformFeePaid = Boolean(
    booking &&
      (booking.platformFeeStatus === "PAID" ||
        ["DEPOSIT_PAID", "FINAL_PAYMENT_PENDING", "FULLY_PAID"].includes(
          booking.paymentStatus
        ))
  );
  const successTitle = platformFeePaid
      ? "Бронь подтверждена"
      : "Оплата обрабатывается";
  const successMessage = platformFeePaid
      ? booking?.bookingType === "PHOTOGRAPHER_ONLY"
        ? "Сервисный сбор оплачен. Ожидает подтверждения фотографа, остаток оплачивается напрямую исполнителю."
        : "Сервисный сбор оплачен. Ожидает подтверждения исполнителя."
      : "Redirect не меняет статус оплаты. Страница обновится после webhook провайдера.";

  return (
      <section className="py-6 md:py-10">
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
                    <h2 className="text-2xl font-semibold tracking-normal">
                      {successTitle}
                    </h2>
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
                        : "Бронирование"
                    }
                  />
                  <Summary label="Статус брони" value={<StatusBadge status={booking.status} />} />
                  <Summary label="Статус оплаты" value={<StatusBadge status={booking.paymentStatus} />} />
                  <Summary
                    label="Стоимость услуги"
                    value={formatPrice(booking.totalServicePrice ?? booking.totalAmount)}
                  />
                  <Summary
                    label="Сервисный сбор платформы"
                    value={formatPrice(booking.platformFeeAmount ?? booking.depositAmount)}
                  />
                  <Summary
                    label="Остаток исполнителю"
                    value={formatPrice(booking.providerAmount ?? booking.remainingAmount)}
                  />
                  <Summary label="Дата и время" value={`${booking.date} · ${booking.time}`} />
                  <Summary label="Длительность" value={`${booking.durationHours} ч`} />
                  {booking.bookingType === "PHOTOGRAPHER_ONLY" ? (
                    <>
                      <Summary label="Фотограф" value={booking.photographerName ?? booking.photographerId ?? "-"} />
                      <Summary label="Тип съемки" value={booking.shootType ?? "-"} />
                      <Summary label="Локация" value={[booking.city, booking.district].filter(Boolean).join(", ") || "-"} />
                    </>
                  ) : null}
                </div>
                <p className="rounded-md bg-secondary px-4 py-3 text-sm font-medium">
                  {successMessage}
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
