import { CalendarDashboard } from "@/components/calendar/calendar-dashboard";
import {
  getCalendarEventsForDashboard
} from "@/lib/calendar/calendar-service";
import { getAvailabilityRules } from "@/lib/calendar/availability-service";
import { dateKey, localDateTime } from "@/lib/calendar/time-utils";
import { getOrCreatePhotographerProfileByUserId } from "@/lib/data/photographers";
import { requireSession } from "@/lib/guards";

export const dynamic = "force-dynamic";

export default async function PhotographerCalendarPage({
  searchParams
}: {
  searchParams: { month?: string };
}) {
  const session = await requireSession(["PHOTOGRAPHER", "ADMIN"]);
  const profile = await getOrCreatePhotographerProfileByUserId(session.user.id);
  const monthStart = normalizeMonth(searchParams.month);
  const range = monthRange(monthStart);
  const owner = {
    type: "PHOTOGRAPHER" as const,
    photographerProfileId: profile.photographerId
  };
  const [rules, events] = await Promise.all([
    getAvailabilityRules(owner),
    getCalendarEventsForDashboard(owner, range)
  ]);

  return (
    <section className="pb-16 pt-8">
      <div className="container">
        <CalendarDashboard
          ownerType="PHOTOGRAPHER"
          ownerId={profile.photographerId}
          ownerName={profile.name}
          monthStart={monthStart}
          previousMonthHref={`/dashboard/photographer/calendar?month=${shiftMonth(monthStart, -1)}`}
          nextMonthHref={`/dashboard/photographer/calendar?month=${shiftMonth(monthStart, 1)}`}
          backHref="/dashboard/photographer"
          rules={rules.map(serializeRule)}
          events={events.map(serializeEvent)}
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
    endTime: event.endTime.toISOString()
  };
}
