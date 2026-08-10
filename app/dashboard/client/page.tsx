import Link from "next/link";
import Image from "next/image";
import { KeyRound, Pencil, UserRound } from "lucide-react";
import { SignOutButton } from "@/components/auth/sign-out-button";
import { AccountActionsCard } from "@/components/dashboard/account-actions-card";
import { ClientBookingCard } from "@/components/dashboard/client-booking-card";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getClientBookings } from "@/lib/data/client";
import { getAccountProfile } from "@/lib/data/account";
import { requireSession } from "@/lib/guards";
import type { ClientBookingListItem } from "@/lib/types";

export const dynamic = "force-dynamic";
const defaultAvatarUrl = "/images/default-avatar.png";

export default async function ClientDashboardPage() {
  const session = await requireSession(["CLIENT", "ADMIN"]);
  const [account, bookings] = await Promise.all([
    getAccountProfile(session),
    getClientBookings(session.user.id, { role: session.user.role })
  ]);
  const currentBookings = bookings.filter((booking) => !isHistoryBooking(booking)).slice(0, 4);
  const historyBookings = bookings.filter(isHistoryBooking).slice(0, 4);

  return (
    <>
      <section className="section md:hidden">
        <div className="container">
          <div className="grid gap-8 py-4">
            <h1 className="text-2xl font-medium tracking-normal">Личный кабинет</h1>

            <div className="flex items-center gap-5">
              <div className="relative size-24 overflow-hidden rounded-full border border-border bg-secondary">
                <Image
                  src={account.image || defaultAvatarUrl}
                  alt=""
                  fill
                  sizes="96px"
                  className="object-cover"
                />
              </div>
              <div className="min-w-0">
                <p className="truncate text-xl font-medium tracking-normal">{account.name}</p>
                <p className="mt-1 truncate text-sm text-muted-foreground">
                  {account.phone || "Телефон не указан"}
                </p>
              </div>
            </div>

            <nav className="grid gap-5 text-xl font-medium tracking-normal text-foreground">
              <Link
                href="/dashboard/client/edit"
                className="flex items-center gap-4 transition-colors hover:text-emerald-300"
              >
                <Pencil className="size-6 text-muted-foreground" aria-hidden="true" />
                Редактировать данные
              </Link>
              <button
                type="button"
                disabled
                className="flex cursor-not-allowed items-center gap-4 text-muted-foreground"
              >
                <KeyRound className="size-6" aria-hidden="true" />
                Сменить пароль
              </button>
              <Link
                href="/dashboard/client/bookings?tab=history"
                className="flex items-center gap-4 transition-colors hover:text-emerald-300"
              >
                <UserRound className="size-6 text-muted-foreground" aria-hidden="true" />
                История бронирований
              </Link>
              <SignOutButton
                variant="ghost"
                size="lg"
                showIcon={false}
                className="h-auto w-fit justify-start p-0 text-xl font-medium tracking-normal text-foreground hover:bg-transparent hover:text-emerald-300"
              />
            </nav>
          </div>
        </div>
      </section>

      <section className="section hidden md:block">
        <div className="container grid gap-8">
          <AccountActionsCard
            name={account.name}
            phone={account.phone}
            roleLabel="Личный кабинет"
            editHref="/dashboard/client/edit"
          />

          <div className="grid gap-4 xl:grid-cols-2">
            <BookingPreviewSection
              title="Текущие записи"
              description="Активные брони, которые ожидают подтверждения, оплаты или проведения."
              bookings={currentBookings}
              emptyTitle="Нет текущих записей"
              emptyDescription="Выберите фотографа для новой съемки, и бронь появится в этом разделе."
              actionHref="/dashboard/client/bookings"
              actionLabel="Все текущие"
              emptyActionHref="/photographers?mode=booking"
              emptyActionLabel="Начать поиск"
            />

            <BookingPreviewSection
              title="История бронирований"
              description="Завершенные, отмененные и отклоненные бронирования."
              bookings={historyBookings}
              emptyTitle="История пока пуста"
              emptyDescription="После завершения или отмены записи будут попадать сюда."
              actionHref="/dashboard/client/bookings?tab=history"
              actionLabel="Вся история"
            />
          </div>
        </div>
      </section>
    </>
  );
}

function BookingPreviewSection({
  title,
  description,
  bookings,
  emptyTitle,
  emptyDescription,
  actionHref,
  actionLabel,
  emptyActionHref,
  emptyActionLabel
}: {
  title: string;
  description: string;
  bookings: ClientBookingListItem[];
  emptyTitle: string;
  emptyDescription: string;
  actionHref: string;
  actionLabel: string;
  emptyActionHref?: string;
  emptyActionLabel?: string;
}) {
  return (
    <Card className="h-full">
      <CardHeader className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
        <div>
          <CardTitle>{title}</CardTitle>
          <p className="mt-2 text-sm text-muted-foreground">{description}</p>
        </div>
        <Button asChild variant="outline" size="sm" className="shrink-0">
          <Link href={actionHref}>{actionLabel}</Link>
        </Button>
      </CardHeader>
      <CardContent>
        {bookings.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border p-8 text-center">
            <h3 className="text-lg font-semibold tracking-normal">{emptyTitle}</h3>
            <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
              {emptyDescription}
            </p>
            {emptyActionHref && emptyActionLabel ? (
              <Button asChild className="mt-5">
                <Link href={emptyActionHref}>{emptyActionLabel}</Link>
              </Button>
            ) : null}
          </div>
        ) : (
          <div className="grid gap-3">
            {bookings.map((booking) => (
              <ClientBookingCard
                key={booking.id}
                booking={booking}
                isHistory={isHistoryBooking(booking)}
              />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function isHistoryBooking(booking: ClientBookingListItem) {
  return ["Completed", "Cancelled", "Declined"].includes(booking.status);
}
