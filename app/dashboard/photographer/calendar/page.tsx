import { CalendarDashboard } from "@/components/calendar/calendar-dashboard";
import { PageHeader } from "@/components/shared/page-header";
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
  searchParams: { week?: string };
}) {
  const session = await requireSession(["PHOTOGRAPHER", "ADMIN"]);
  const profile = await getOrCreatePhotographerProfileByUserId(session.user.id);
  const weekStart = normalizeWeek(searchParams.week);
  const range = weekRange(weekStart);
  const owner = {
    type: "PHOTOGRAPHER" as const,
    photographerProfileId: profile.photographerId
  };
  const [rules, events] = await Promise.all([
    getAvailabilityRules(owner),
    getCalendarEventsForDashboard(owner, range)
  ]);

  return (
    <>
      <PageHeader
        eyebrow="Smart Calendar"
        title="Календарь фотографа"
        description="Рабочие часы, ручная занятость, брони платформы и временно удерживаемые окна."
      />
      <section className="section">
        <div className="container">
          <CalendarDashboard
            ownerType="PHOTOGRAPHER"
            ownerId={profile.photographerId}
            ownerName={profile.name}
            weekStart={weekStart}
            previousWeekHref={`/dashboard/photographer/calendar?week=${shiftDate(weekStart, -7)}`}
            nextWeekHref={`/dashboard/photographer/calendar?week=${shiftDate(weekStart, 7)}`}
            backHref="/dashboard/photographer"
            rules={rules.map(serializeRule)}
            events={events.map(serializeEvent)}
          />
        </div>
      </section>
    </>
  );
}

function normalizeWeek(value?: string) {
  const base = value && /^\d{4}-\d{2}-\d{2}$/.test(value) ? localDateTime(value, "12:00") : new Date();
  const day = Number(new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Almaty", weekday: "short" }).format(base) === "Sun" ? 7 : ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Almaty", weekday: "short" }).format(base)) + 1);
  base.setDate(base.getDate() - day + 1);
  return dateKey(base);
}

function weekRange(weekStart: string) {
  return {
    startTime: localDateTime(weekStart, "00:00"),
    endTime: localDateTime(shiftDate(weekStart, 7), "00:00")
  };
}

function shiftDate(value: string, days: number) {
  const date = localDateTime(value, "12:00");
  date.setDate(date.getDate() + days);
  return dateKey(date);
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
