import Link from "next/link";
import { Clock3 } from "lucide-react";
import { ClientBookingCard } from "@/components/dashboard/client-booking-card";
import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";
import { getClientBookings } from "@/lib/data/client";
import { requireSession } from "@/lib/guards";
import type { ClientBookingListItem } from "@/lib/types";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

type BookingTab = "current" | "history";

interface ClientBookingsPageProps {
  searchParams: {
    tab?: BookingTab;
  };
}

export default async function ClientBookingsPage({ searchParams }: ClientBookingsPageProps) {
  const session = await requireSession(["CLIENT", "ADMIN"]);
  const bookings = await getClientBookings(session.user.id, {
    role: session.user.role
  });
  const activeTab: BookingTab = searchParams.tab === "history" ? "history" : "current";
  const visibleBookings = bookings.filter((booking) =>
    activeTab === "history" ? isHistoryBooking(booking) : !isHistoryBooking(booking)
  );

  return (
    <section className="section">
      <div className="container grid gap-6">
        <div className="grid gap-5">
          <h1 className="text-2xl font-medium tracking-normal md:text-4xl">Мои записи</h1>
          <div className="grid grid-cols-2 border-b border-border text-center text-xl font-semibold tracking-normal md:max-w-xl md:text-2xl">
            <TabLink active={activeTab === "current"} href="/dashboard/client/bookings">
              Текущие
            </TabLink>
            <TabLink active={activeTab === "history"} href="/dashboard/client/bookings?tab=history">
              История
            </TabLink>
          </div>
        </div>

        {visibleBookings.length === 0 ? (
          activeTab === "current" ? (
            <div className="grid justify-items-center gap-5 rounded-lg border border-border bg-card px-5 py-12 text-center md:py-16">
              <Clock3 className="size-16 text-emerald-300" aria-hidden="true" />
              <h2 className="text-2xl font-medium tracking-normal">Нет текущих записей</h2>
              <Button asChild className="mt-1 w-full max-w-md md:w-auto">
                <Link href="/photographers?mode=booking">Начать поиск</Link>
              </Button>
            </div>
          ) : (
            <EmptyState
              title="История пока пуста"
              description="Завершенные, отмененные и отклоненные записи появятся здесь."
              actionLabel="К текущим записям"
              actionHref="/dashboard/client/bookings"
            />
          )
        ) : (
          <div className="grid gap-4">
            {visibleBookings.map((booking) => (
              <ClientBookingCard
                key={booking.id}
                booking={booking}
                isHistory={activeTab === "history"}
                showMoney
              />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

function TabLink({
  active,
  href,
  children
}: {
  active: boolean;
  href: string;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "relative py-4 text-muted-foreground transition-colors after:absolute after:inset-x-0 after:bottom-0 after:h-0.5 after:bg-primary after:transition-transform",
        active ? "text-foreground after:scale-x-100" : "hover:text-foreground after:scale-x-0"
      )}
    >
      {children}
    </Link>
  );
}

function isHistoryBooking(booking: ClientBookingListItem) {
  return ["Completed", "Cancelled", "Declined"].includes(booking.status);
}
