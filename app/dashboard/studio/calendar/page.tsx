import Link from "next/link";
import { CalendarDashboard } from "@/components/calendar/calendar-dashboard";
import { getAvailabilityRules } from "@/lib/calendar/availability-service";
import { getCalendarEventsForDashboard } from "@/lib/calendar/calendar-service";
import { dateKey, localDateTime } from "@/lib/calendar/time-utils";
import { getOrCreateStudioProfileByOwnerId } from "@/lib/data/studios";
import { requireSession } from "@/lib/guards";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function StudioCalendarPage({
  searchParams
}: {
  searchParams: { month?: string; hall?: string };
}) {
  const session = await requireSession(["STUDIO_OWNER", "ADMIN"]);
  const profile = await getOrCreateStudioProfileByOwnerId(session.user.id);
  const selectedHall =
    profile.halls.find((hall) => hall.id === searchParams.hall) ?? profile.halls[0];
  const monthStart = normalizeMonth(searchParams.month);

  if (!selectedHall?.id) {
    return (
      <section className="pb-16 pt-8">
        <div className="container">
          <p>Сначала добавьте зал в кабинете студии.</p>
          <Link className="mt-4 inline-block text-primary" href="/dashboard/studio">
            Вернуться в кабинет
          </Link>
        </div>
      </section>
    );
  }

  const owner = { type: "STUDIO_HALL" as const, studioHallId: selectedHall.id };
  const range = {
    startTime: localDateTime(monthStart, "00:00"),
    endTime: localDateTime(`${shiftMonth(monthStart, 1)}-01`, "00:00")
  };
  const [rules, events] = await Promise.all([
    getAvailabilityRules(owner),
    getCalendarEventsForDashboard(owner, range)
  ]);

  return (
    <section className="pb-16 pt-8">
      <div className="container grid gap-5">
        <div className="flex flex-wrap gap-2">
          {profile.halls.map((hall) => (
            <Link
              key={hall.id}
              href={`/dashboard/studio/calendar?hall=${hall.id}&month=${monthStart.slice(0, 7)}`}
              className={cn(
                "rounded-md border px-4 py-2 text-sm transition-colors",
                hall.id === selectedHall.id
                  ? "border-emerald-400 text-emerald-300"
                  : "border-border text-muted-foreground hover:text-foreground"
              )}
            >
              {hall.name}
            </Link>
          ))}
        </div>
        <CalendarDashboard
          ownerType="STUDIO_HALL"
          ownerId={selectedHall.id}
          ownerName={`${profile.name} · ${selectedHall.name}`}
          monthStart={monthStart}
          previousMonthHref={`/dashboard/studio/calendar?hall=${selectedHall.id}&month=${shiftMonth(monthStart, -1)}`}
          nextMonthHref={`/dashboard/studio/calendar?hall=${selectedHall.id}&month=${shiftMonth(monthStart, 1)}`}
          backHref="/dashboard/studio"
          rules={rules.map((rule) => ({
            weekday: rule.weekday,
            startTime: rule.startTime,
            endTime: rule.endTime,
            isActive: rule.isActive,
            minDurationMinutes: rule.minDurationMinutes,
            slotStepMinutes: rule.slotStepMinutes,
            bufferBeforeMinutes: rule.bufferBeforeMinutes,
            bufferAfterMinutes: rule.bufferAfterMinutes
          }))}
          events={events.map((event) => ({
            ...event,
            startTime: event.startTime.toISOString(),
            endTime: event.endTime.toISOString()
          }))}
        />
      </div>
    </section>
  );
}

function normalizeMonth(value?: string) {
  if (value && /^\d{4}-\d{2}$/.test(value)) return `${value}-01`;
  return `${dateKey(new Date()).slice(0, 7)}-01`;
}

function shiftMonth(value: string, months: number) {
  const date = localDateTime(value, "12:00");
  date.setMonth(date.getMonth() + months, 1);
  return dateKey(date).slice(0, 7);
}
