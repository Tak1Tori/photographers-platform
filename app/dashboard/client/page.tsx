import Link from "next/link";
import { CalendarDays, CheckCircle2, Clock3, CreditCard, Images, ListChecks } from "lucide-react";
import { DashboardCard } from "@/components/dashboard/dashboard-card";
import { StatusBadge } from "@/components/dashboard/status-badge";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getClientBookings, getClientDashboardStats } from "@/lib/data/client";
import { formatPrice } from "@/lib/mock-data";
import { requireSession } from "@/lib/guards";

export const dynamic = "force-dynamic";

export default async function ClientDashboardPage() {
  const session = await requireSession(["CLIENT", "ADMIN"]);
  const [stats, bookings] = await Promise.all([
    getClientDashboardStats(session.user.id, session.user.role),
    getClientBookings(session.user.id, { role: session.user.role })
  ]);
  const latestBookings = bookings.slice(0, 5);

  return (
    <>
      <PageHeader
        eyebrow="Client dashboard"
        title="Мои брони"
        description="Ваши фотосессии, статусы подтверждения и оплаты в одном месте."
      />
      <section className="section">
        <div className="container grid gap-8">
          <Card>
            <CardContent className="flex flex-col justify-between gap-5 p-6 md:flex-row md:items-center">
              <div>
                <p className="text-sm text-muted-foreground">Добро пожаловать</p>
                <h2 className="mt-2 text-2xl font-semibold tracking-normal">
                  {session.user.name ?? session.user.email}
                </h2>
                <div className="mt-3 grid gap-1 text-sm text-muted-foreground">
                  <span>{session.user.email}</span>
                  {session.user.phone ? <span>{session.user.phone}</span> : null}
                </div>
              </div>
              <Button asChild>
                <Link href="/styles">
                  <Images className="size-4" aria-hidden="true" />
                  Забронировать новую съемку
                </Link>
              </Button>
            </CardContent>
          </Card>

          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
            <DashboardCard label="Всего бронирований" value={String(stats.totalBookings)} icon={CalendarDays} />
            <DashboardCard label="Ожидают подтверждения" value={String(stats.pendingBookings)} icon={Clock3} />
            <DashboardCard label="Подтвержденные" value={String(stats.confirmedBookings)} icon={CheckCircle2} />
            <DashboardCard label="Завершенные" value={String(stats.completedBookings)} icon={ListChecks} />
            <DashboardCard label="Оплаченный депозит" value={formatPrice(stats.paidDepositTotal)} icon={CreditCard} />
          </div>

          <Card>
            <CardHeader className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
              <CardTitle>Последние бронирования</CardTitle>
              <Button asChild variant="outline" size="sm">
                <Link href="/dashboard/client/bookings">Все бронирования</Link>
              </Button>
            </CardHeader>
            <CardContent>
              {latestBookings.length === 0 ? (
                <div className="rounded-lg border border-dashed border-border p-8 text-center">
                  <h3 className="text-lg font-semibold tracking-normal">
                    У вас пока нет бронирований
                  </h3>
                  <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
                    Начните с выбора стиля съемки, а после mock-оплаты бронь появится здесь.
                  </p>
                  <Button asChild className="mt-5">
                    <Link href="/styles">Выбрать стиль</Link>
                  </Button>
                </div>
              ) : (
                <div className="grid gap-3">
                  {latestBookings.map((booking) => (
                    <Link
                      key={booking.id}
                      href={`/dashboard/client/bookings/${booking.id}`}
                      className="grid gap-3 rounded-lg border border-border p-4 transition-colors hover:bg-secondary md:grid-cols-[1fr_auto]"
                    >
                      <div>
                        <p className="font-semibold">{booking.id}</p>
                        <p className="mt-1 text-sm text-muted-foreground">
                          {booking.styleName} · {booking.photographerName} · {booking.studioName}
                        </p>
                        <p className="mt-1 text-sm text-muted-foreground">
                          {booking.date} · {booking.time} · {booking.durationHours} ч
                        </p>
                      </div>
                      <div className="flex flex-wrap items-start gap-2 md:justify-end">
                        <StatusBadge status={booking.status} />
                        <StatusBadge status={booking.paymentStatus} />
                        <StatusBadge status={booking.bookingType ?? "FULL_SHOOT"} />
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </section>
    </>
  );
}
