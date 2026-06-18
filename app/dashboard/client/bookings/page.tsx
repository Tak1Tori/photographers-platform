import Link from "next/link";
import { Filter } from "lucide-react";
import { StatusBadge } from "@/components/dashboard/status-badge";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getClientBookings } from "@/lib/data/client";
import { formatPrice } from "@/lib/mock-data";
import { requireSession } from "@/lib/guards";
import type { ClientBookingFilter } from "@/lib/types";

export const dynamic = "force-dynamic";

const filters: ClientBookingFilter[] = [
  "All",
  "Pending",
  "Confirmed",
  "Completed",
  "Cancelled",
  "Declined"
];

interface ClientBookingsPageProps {
  searchParams: {
    status?: ClientBookingFilter;
  };
}

export default async function ClientBookingsPage({ searchParams }: ClientBookingsPageProps) {
  const session = await requireSession(["CLIENT", "ADMIN"]);
  const activeFilter = filters.includes(searchParams.status ?? "All")
    ? searchParams.status ?? "All"
    : "All";
  const bookings = await getClientBookings(session.user.id, {
    status: activeFilter,
    role: session.user.role
  });

  return (
    <>
      <PageHeader
        eyebrow="Client bookings"
        title="Все бронирования"
        description="История съемок, финансовые детали и текущие статусы."
      />
      <section className="section">
        <div className="container grid gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Filter className="size-5" aria-hidden="true" />
                Фильтр
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-2">
              {filters.map((filter) => (
                <Button
                  key={filter}
                  asChild
                  variant={activeFilter === filter ? "default" : "outline"}
                  size="sm"
                >
                  <Link href={filter === "All" ? "/dashboard/client/bookings" : `/dashboard/client/bookings?status=${filter}`}>
                    {filter}
                  </Link>
                </Button>
              ))}
            </CardContent>
          </Card>

          {bookings.length === 0 ? (
            <EmptyState
              title="У вас пока нет бронирований"
              description="Для выбранного фильтра бронирований нет. Можно создать новую бронь из каталога стилей."
              actionLabel="Выбрать стиль"
              actionHref="/styles"
            />
          ) : (
            <div className="grid gap-4">
              {bookings.map((booking) => (
                <Card key={booking.id}>
                  <CardContent className="grid gap-4 p-5 lg:grid-cols-[1.4fr_1fr_auto] lg:items-center">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="text-lg font-semibold tracking-normal">{booking.id}</h2>
                        <StatusBadge status={booking.status} />
                        <StatusBadge status={booking.paymentStatus} />
                        <StatusBadge status={booking.bookingType ?? "FULL_SHOOT"} />
                      </div>
                      <p className="mt-2 text-sm text-muted-foreground">
                        {booking.styleName} · {booking.photographerName}
                      </p>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {booking.studioName}, {booking.hallName}
                      </p>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {booking.date} · {booking.time} · {booking.durationHours} ч
                      </p>
                    </div>
                    <div className="grid gap-1 text-sm">
                      <MoneyLine label="Всего" value={booking.totalAmount} />
                      <MoneyLine label="Депозит" value={booking.depositAmount} />
                      <MoneyLine label="Оплачено" value={booking.paidAmount} />
                      <MoneyLine label="Остаток" value={booking.remainingAmount} />
                    </div>
                    <Button asChild variant="outline">
                      <Link href={`/dashboard/client/bookings/${booking.id}`}>Подробнее</Link>
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </section>
    </>
  );
}

function MoneyLine({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex justify-between gap-4">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium">{formatPrice(value)}</span>
    </div>
  );
}
