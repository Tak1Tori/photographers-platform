import Link from "next/link";
import { CalendarDashboard } from "@/components/calendar/calendar-dashboard";
import { PageHeader } from "@/components/shared/page-header";
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
  searchParams: { week?: string; hall?: string };
}) {
  const session = await requireSession(["STUDIO_OWNER", "ADMIN"]);
  const profile = await getOrCreateStudioProfileByOwnerId(session.user.id);
  const selectedHall =
    profile.halls.find((hall) => hall.id === searchParams.hall) ?? profile.halls[0];
  const weekStart = normalizeWeek(searchParams.week);

  if (!selectedHall?.id) {
    return (
      <>
        <PageHeader eyebrow="Smart Calendar" title="Календарь студии" description="Сначала добавьте зал в кабинете студии." />
        <section className="section"><div className="container"><Link className="text-primary" href="/dashboard/studio">Вернуться в кабинет</Link></div></section>
      </>
    );
  }

  const owner = { type: "STUDIO_HALL" as const, studioHallId: selectedHall.id };
  const range = {
    startTime: localDateTime(weekStart, "00:00"),
    endTime: localDateTime(shiftDate(weekStart, 7), "00:00")
  };
  const [rules, events] = await Promise.all([
    getAvailabilityRules(owner),
    getCalendarEventsForDashboard(owner, range)
  ]);

  return (
    <>
      <PageHeader
        eyebrow="Smart Calendar"
        title="Календарь студии"
        description="Каждый зал имеет собственные рабочие часы, занятость и буфер на подготовку."
      />
      <section className="section">
        <div className="container grid gap-5">
          <div className="flex flex-wrap gap-2">
            {profile.halls.map((hall) => (
              <Link
                key={hall.id}
                href={`/dashboard/studio/calendar?hall=${hall.id}&week=${weekStart}`}
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
            weekStart={weekStart}
            previousWeekHref={`/dashboard/studio/calendar?hall=${selectedHall.id}&week=${shiftDate(weekStart, -7)}`}
            nextWeekHref={`/dashboard/studio/calendar?hall=${selectedHall.id}&week=${shiftDate(weekStart, 7)}`}
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
    </>
  );
}

function normalizeWeek(value?: string) {
  const date = value && /^\d{4}-\d{2}-\d{2}$/.test(value) ? localDateTime(value, "12:00") : new Date();
  const short = new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Almaty", weekday: "short" }).format(date);
  const day = short === "Sun" ? 7 : ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(short) + 1;
  date.setDate(date.getDate() - day + 1);
  return dateKey(date);
}

function shiftDate(value: string, days: number) {
  const date = localDateTime(value, "12:00");
  date.setDate(date.getDate() + days);
  return dateKey(date);
}
