import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowLeft, CalendarClock, CreditCard, MapPin, UserRound } from "lucide-react";
import { ClientBookingActions } from "@/components/dashboard/client-booking-actions";
import { StatusBadge } from "@/components/dashboard/status-badge";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getClientBookingByNumber } from "@/lib/data/client";
import {
  EQUIPMENT_OPTIONS,
  LOCATION_TYPES,
  RENTAL_PURPOSES,
  SHOOT_TYPES,
  getOptionLabel
} from "@/lib/booking-options";
import { formatPrice } from "@/lib/mock-data";
import { requireSession } from "@/lib/guards";
import type { ClientBookingDetails } from "@/lib/types";

export const dynamic = "force-dynamic";

interface ClientBookingDetailsPageProps {
  params: {
    bookingNumber: string;
  };
}

export default async function ClientBookingDetailsPage({ params }: ClientBookingDetailsPageProps) {
  const session = await requireSession(["CLIENT", "ADMIN"]);
  const booking = await getClientBookingByNumber(
    session.user.id,
    params.bookingNumber,
    session.user.role
  );

  if (!booking) {
    return (
      <>
        <PageHeader
          eyebrow="Booking"
          title="Бронь не найдена"
          description="Такой брони нет или она не принадлежит вашему аккаунту."
        />
        <section className="section">
          <div className="container">
            <EmptyState
              title="Доступ к брони закрыт"
              description="Клиентский кабинет показывает только бронирования, созданные под текущим аккаунтом."
              actionLabel="Мои брони"
              actionHref="/dashboard/client/bookings"
            />
          </div>
        </section>
      </>
    );
  }

  return (
    <>
      <PageHeader
        eyebrow="Booking details"
        title={`Бронь ${booking.id}`}
        description={getStatusText(booking.status)}
      />
      <section className="section">
        <div className="container grid gap-6">
          <Button asChild variant="outline" className="w-fit">
            <Link href="/dashboard/client/bookings">
              <ArrowLeft className="size-4" aria-hidden="true" />
              Назад к броням
            </Link>
          </Button>

          <div className="grid gap-6 lg:grid-cols-[1fr_390px]">
            <div className="grid gap-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <CalendarClock className="size-5" aria-hidden="true" />
                    Основная информация
                  </CardTitle>
                </CardHeader>
                <CardContent className="grid gap-4 md:grid-cols-2">
                  <Summary label="Номер брони" value={booking.id} />
                  <Summary label="Дата создания" value={formatDateTime(booking.createdAt)} />
                  <Summary label="Тип брони" value={<StatusBadge status={booking.bookingType ?? "FULL_SHOOT"} />} />
                  <Summary label="Статус брони" value={<StatusBadge status={booking.status} />} />
                  <Summary label="Статус оплаты" value={<StatusBadge status={booking.paymentStatus} />} />
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <MapPin className="size-5" aria-hidden="true" />
                    Детали съемки
                  </CardTitle>
                </CardHeader>
                <CardContent className="grid gap-4 md:grid-cols-2">
                  <Summary label="Стиль" value={booking.styleName} />
                  <Summary label="Фотограф" value={booking.photographerName} />
                  {booking.bookingType === "FULL_SHOOT" ? (
                    <>
                      <Summary label="Студия" value={booking.studioName} />
                      <Summary label="Зал" value={booking.hallName} />
                      <Summary label="Адрес студии" value={booking.studioAddress} />
                    </>
                  ) : null}
                  <Summary label="Дата" value={booking.date} />
                  <Summary label="Начало" value={booking.time} />
                  <Summary label="Окончание" value={booking.endTime} />
                  <Summary label="Длительность" value={`${booking.durationHours} ч`} />
                </CardContent>
              </Card>

              {booking.bookingType === "PHOTOGRAPHER_ONLY" ? (
                <Card>
                  <CardHeader>
                    <CardTitle>Бриф для фотографа</CardTitle>
                  </CardHeader>
                  <CardContent className="grid gap-4 md:grid-cols-2">
                    <Summary label="Тип съемки" value={getOptionLabel(SHOOT_TYPES, booking.shootType)} />
                    <Summary label="Описание" value={booking.shootDescription ?? "-"} />
                    <Summary label="Локация" value={getOptionLabel(LOCATION_TYPES, booking.locationType)} />
                    <Summary label="Город" value={booking.city ?? "-"} />
                    <Summary label="Район" value={booking.district ?? "-"} />
                    <Summary label="Детали адреса" value={booking.addressDetails ?? "-"} />
                    <Summary label="Количество людей" value={booking.peopleCount ? String(booking.peopleCount) : "-"} />
                    <Summary
                      label="Оборудование"
                      value={
                        booking.equipmentNeeded?.map((item) => getOptionLabel(EQUIPMENT_OPTIONS, item)).join(", ") ?? "-"
                      }
                    />
                    <Summary label="Особые требования" value={booking.specialRequirements ?? "-"} />
                  </CardContent>
                </Card>
              ) : null}

              {booking.bookingType === "STUDIO_ONLY" ? (
                <Card>
                  <CardHeader>
                    <CardTitle>Детали аренды студии</CardTitle>
                  </CardHeader>
                  <CardContent className="grid gap-4 md:grid-cols-2">
                    <Summary label="Цель аренды" value={getOptionLabel(RENTAL_PURPOSES, booking.rentalPurpose)} />
                    <Summary label="Студия" value={booking.studioName} />
                    <Summary label="Зал" value={booking.hallName} />
                    <Summary label="Количество людей" value={booking.peopleCount ? String(booking.peopleCount) : "-"} />
                    <Summary label="Нужно оборудование" value={booking.needsEquipment ? "Да" : "Нет"} />
                    <Summary label="Удобства/оборудование" value={booking.selectedAmenities?.join(", ") ?? "-"} />
                    <Summary label="Описание" value={booking.shootDescription ?? "-"} />
                    <Summary label="Особые требования" value={booking.specialRequirements ?? "-"} />
                  </CardContent>
                </Card>
              ) : null}

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <UserRound className="size-5" aria-hidden="true" />
                    Клиентские данные
                  </CardTitle>
                </CardHeader>
                <CardContent className="grid gap-4 md:grid-cols-2">
                  <Summary label="Имя" value={booking.clientName} />
                  <Summary label="Email" value={booking.clientEmail || "-"} />
                  <Summary label="Телефон" value={booking.clientPhone || "-"} />
                  <Summary label="Комментарий" value={booking.clientComment || "-"} />
                </CardContent>
              </Card>
            </div>

            <div className="grid h-fit gap-6 lg:sticky lg:top-24">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <CreditCard className="size-5" aria-hidden="true" />
                    Финансы
                  </CardTitle>
                </CardHeader>
                <CardContent className="grid gap-3 text-sm">
                  <MoneyLine label="Фотограф" value={booking.photographerTotal} />
                  <MoneyLine label="Студия" value={booking.studioTotal} />
                  <MoneyLine label="Сервисный сбор" value={booking.serviceFee} />
                  <div className="border-t border-border pt-3">
                    <MoneyLine label="Общая сумма" value={booking.totalAmount} strong />
                  </div>
                  <MoneyLine label="Депозит" value={booking.depositAmount} />
                  <MoneyLine label="Оплачено" value={booking.paidAmount} />
                  <MoneyLine label="Остаток" value={booking.remainingAmount} />
                </CardContent>
              </Card>

              <ClientBookingActions booking={booking} />
            </div>
          </div>
        </div>
      </section>
    </>
  );
}

function Summary({
  label,
  value
}: {
  label: string;
  value: ReactNode;
}) {
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

function getStatusText(status: ClientBookingDetails["status"]) {
  const map: Record<ClientBookingDetails["status"], string> = {
    Pending: "Ожидает подтверждения фотографа и студии",
    Confirmed: "Подтверждено",
    "In progress": "Съемка выполняется",
    Completed: "Завершено",
    Cancelled: "Отменено",
    Declined: "Отклонено"
  };
  return map[status];
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("ru-RU", {
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(value));
}
