import { Building2, CalendarDays, Percent, WalletCards } from "lucide-react";
import { DashboardCard } from "@/components/dashboard/dashboard-card";
import { StudioDashboardManager } from "@/components/dashboard/studio-dashboard-manager";
import { PageHeader } from "@/components/shared/page-header";
import { getStudioBookings } from "@/lib/data/bookings";
import { canUseDatabase } from "@/lib/data/db";
import {
  getOrCreateStudioProfileByOwnerId,
  getStudioAvailabilitySlots
} from "@/lib/data/studios";
import { requireSession } from "@/lib/guards";
import { formatPrice } from "@/lib/mock-data";

export const dynamic = "force-dynamic";

export default async function StudioDashboardPage() {
  const session = await requireSession(["STUDIO_OWNER", "ADMIN"]);
  const profile = await getOrCreateStudioProfileByOwnerId(session.user.id);
  const [studioBookings, slots] = await Promise.all([
    getStudioBookings(profile.studioId),
    getStudioAvailabilitySlots(profile.studioId)
  ]);
  const activeBookings = studioBookings.filter((booking) =>
    ["Pending", "Confirmed"].includes(booking.status)
  );
  const monthlyRevenue = studioBookings
    .filter((booking) => booking.status !== "Cancelled")
    .reduce((sum, booking) => sum + booking.studioTotal, 0);
  const utilization = Math.round((activeBookings.length / Math.max(profile.halls.length * 4, 1)) * 100);

  return (
    <>
      <PageHeader
        eyebrow="Dashboard"
        title="Кабинет студии"
        description="Управление профилем студии, залами, расписанием и заявками на аренду."
      />
      <section className="section">
        <div className="container grid gap-8">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <DashboardCard
              label="Активные брони"
              value={String(activeBookings.length)}
              icon={CalendarDays}
            />
            <DashboardCard
              label="Загрузка залов"
              value={`${utilization}%`}
              hint="mock utilization"
              icon={Percent}
            />
            <DashboardCard
              label="Доход за месяц"
              value={formatPrice(monthlyRevenue)}
              icon={WalletCards}
            />
            <DashboardCard
              label="Количество залов"
              value={String(profile.halls.length)}
              icon={Building2}
            />
          </div>

          <StudioDashboardManager
            profile={profile}
            slots={slots}
            bookings={studioBookings}
            databaseReady={canUseDatabase() || process.env.NODE_ENV === "development"}
          />
        </div>
      </section>
    </>
  );
}
