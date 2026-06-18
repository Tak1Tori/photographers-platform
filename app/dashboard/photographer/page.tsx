import { CalendarDays, Clock3, Star, WalletCards } from "lucide-react";
import { DashboardCard } from "@/components/dashboard/dashboard-card";
import { PhotographerDashboardManager } from "@/components/dashboard/photographer-dashboard-manager";
import { PageHeader } from "@/components/shared/page-header";
import { getPhotographerBookings } from "@/lib/data/bookings";
import { canUseDatabase } from "@/lib/data/db";
import {
  getOrCreatePhotographerProfileByUserId,
  getPhotographerAvailabilitySlots,
  getPortfolioItems
} from "@/lib/data/photographers";
import { getStyles } from "@/lib/data/styles";
import { requireSession } from "@/lib/guards";
import { formatPrice } from "@/lib/mock-data";

export const dynamic = "force-dynamic";

export default async function PhotographerDashboardPage() {
  const session = await requireSession(["PHOTOGRAPHER", "ADMIN"]);
  const profile = await getOrCreatePhotographerProfileByUserId(session.user.id);
  const [photographerBookings, styles, portfolioItems, slots] = await Promise.all([
    getPhotographerBookings(profile.photographerId),
    getStyles(),
    getPortfolioItems(profile.photographerId),
    getPhotographerAvailabilitySlots(profile.photographerId)
  ]);
  const activeBookings = photographerBookings.filter((booking) =>
    ["Pending", "Confirmed"].includes(booking.status)
  );
  const pendingBookings = photographerBookings.filter((booking) => booking.status === "Pending");
  const monthlyRevenue = photographerBookings
    .filter((booking) => booking.status !== "Cancelled")
    .reduce((sum, booking) => sum + booking.photographerTotal, 0);

  return (
    <>
      <PageHeader
        eyebrow="Dashboard"
        title="Кабинет фотографа"
        description="Управление профилем, портфолио, доступностью и входящими бронями через Prisma."
      />
      <section className="section">
        <div className="container grid gap-8">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <DashboardCard
              label="Активные брони"
              value={String(activeBookings.length)}
              hint="Pending + Confirmed"
              icon={CalendarDays}
            />
            <DashboardCard
              label="Ожидают подтверждения"
              value={String(pendingBookings.length)}
              icon={Clock3}
            />
            <DashboardCard
              label="Доход за месяц"
              value={formatPrice(monthlyRevenue)}
              icon={WalletCards}
            />
            <DashboardCard
              label="Рейтинг"
              value={String(profile.rating)}
              hint="на основе mock reviews"
              icon={Star}
            />
          </div>

          <PhotographerDashboardManager
            profile={profile}
            styles={styles}
            portfolioItems={portfolioItems}
            slots={slots}
            bookings={photographerBookings}
            databaseReady={canUseDatabase() || process.env.NODE_ENV === "development"}
          />
        </div>
      </section>
    </>
  );
}
