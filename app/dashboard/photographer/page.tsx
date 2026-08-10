import { CalendarDays, Clock3, Star, WalletCards } from "lucide-react";
import { AccountActionsCard } from "@/components/dashboard/account-actions-card";
import { DashboardCard } from "@/components/dashboard/dashboard-card";
import { PhotographerDashboardManager } from "@/components/dashboard/photographer-dashboard-manager";
import { getAvailabilityRules } from "@/lib/calendar/availability-service";
import { getCalendarEventsForDashboard } from "@/lib/calendar/calendar-service";
import { dateKey, localDateTime } from "@/lib/calendar/time-utils";
import { autoCompletePastBookings } from "@/lib/bookings/status-service";
import { getPhotographerBookings } from "@/lib/data/bookings";
import { canUseDatabase } from "@/lib/data/db";
import {
  getOrCreatePhotographerProfileByUserId,
  getPortfolioItems
} from "@/lib/data/photographers";
import { getStyles } from "@/lib/data/styles";
import { requireSession } from "@/lib/guards";
import { formatPrice } from "@/lib/mock-data";
import { calculateProviderPayouts } from "@/lib/provider-payouts";

export const dynamic = "force-dynamic";

export default async function PhotographerDashboardPage({
  searchParams
}: {
  searchParams: { month?: string; section?: string };
}) {
  const session = await requireSession(["PHOTOGRAPHER", "ADMIN"]);
  const profile = await getOrCreatePhotographerProfileByUserId(session.user.id);
  const monthStart = normalizeMonth(searchParams.month);
  const owner = {
    type: "PHOTOGRAPHER" as const,
    photographerProfileId: profile.photographerId
  };
  const range = monthRange(monthStart);
  await autoCompletePastBookings();
  const [photographerBookings, styles, portfolioItems, rules, events] = await Promise.all([
    getPhotographerBookings(profile.photographerId),
    getStyles(),
    getPortfolioItems(profile.photographerId),
    getAvailabilityRules(owner),
    getCalendarEventsForDashboard(owner, range)
  ]);
  const activeBookings = photographerBookings.filter((booking) =>
    ["Pending", "Confirmed"].includes(booking.status)
  );
  const pendingBookings = photographerBookings.filter((booking) => booking.status === "Pending");
  const monthlyRevenue = photographerBookings
    .filter((booking) => booking.status !== "Cancelled")
    .reduce((sum, booking) => sum + calculateProviderPayouts(booking).photographerPayout, 0);

  return (
    <section className="section">
      <div className="container grid gap-8">
        <AccountActionsCard
          name={profile.name}
          phone={session.user.phone}
          roleLabel="Аккаунт фотографа"
          editHref="/dashboard/photographer?section=profile#profile-editor"
          telegramHref="/dashboard/photographer/settings/notifications"
        />

        <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
          <DashboardCard
            label="Активные брони"
            value={String(activeBookings.length)}
            hint="В ожидании и подтвержденные"
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
          calendar={{
            ownerType: "PHOTOGRAPHER",
            ownerId: profile.photographerId,
            ownerName: profile.name,
            monthStart,
            previousMonthHref: `/dashboard/photographer?section=schedule&month=${shiftMonth(monthStart, -1)}`,
            nextMonthHref: `/dashboard/photographer?section=schedule&month=${shiftMonth(monthStart, 1)}`,
            bookingDetailsBaseHref: "/dashboard/photographer/bookings",
            rules: rules.map(serializeRule),
            events: events.map(serializeEvent)
          }}
          bookings={photographerBookings}
          databaseReady={canUseDatabase() || process.env.NODE_ENV === "development"}
          initialSection={isPhotographerSection(searchParams.section) ? searchParams.section : undefined}
        />
      </div>
    </section>
  );
}

function normalizeMonth(value?: string) {
  if (value && /^\d{4}-\d{2}$/.test(value)) return `${value}-01`;
  return `${dateKey(new Date()).slice(0, 7)}-01`;
}

function monthRange(monthStart: string) {
  return {
    startTime: localDateTime(monthStart, "00:00"),
    endTime: localDateTime(`${shiftMonth(monthStart, 1)}-01`, "00:00")
  };
}

function shiftMonth(value: string, months: number) {
  const date = localDateTime(value, "12:00");
  date.setMonth(date.getMonth() + months, 1);
  return dateKey(date).slice(0, 7);
}

function serializeRule(rule: Awaited<ReturnType<typeof getAvailabilityRules>>[number]) {
  return {
    weekday: rule.weekday,
    startTime: rule.startTime,
    endTime: rule.endTime,
    isActive: rule.isActive,
    minDurationMinutes: rule.minDurationMinutes,
    slotStepMinutes: rule.slotStepMinutes,
    bufferBeforeMinutes: rule.bufferBeforeMinutes,
    bufferAfterMinutes: rule.bufferAfterMinutes
  };
}

function serializeEvent(event: Awaited<ReturnType<typeof getCalendarEventsForDashboard>>[number]) {
  return {
    ...event,
    startTime: event.startTime.toISOString(),
    endTime: event.endTime.toISOString(),
    rescheduleRequestedAt: event.rescheduleRequestedAt?.toISOString()
  };
}

function isPhotographerSection(value?: string): value is "profile" | "portfolio" | "schedule" | "bookings" {
  return value === "profile" || value === "portfolio" || value === "schedule" || value === "bookings";
}
