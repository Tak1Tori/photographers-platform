"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import {
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  Check,
  Clock3,
  Plus,
  Save,
  Trash2
} from "lucide-react";
import {
  createManualBusyEventAction,
  deleteManualBusyEventAction,
  updateAvailabilityRuleAction
} from "@/app/dashboard/calendar/actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type RuleDto = {
  weekday: number;
  startTime: string;
  endTime: string;
  isActive: boolean;
  minDurationMinutes: number;
  slotStepMinutes: number;
  bufferBeforeMinutes: number;
  bufferAfterMinutes: number;
};

type EventDto = {
  id: string;
  source: "PLATFORM_BOOKING" | "MANUAL_BUSY" | "SYSTEM_HOLD" | "ACTIVE_HOLD";
  title: string;
  privateNote?: string;
  startTime: string;
  endTime: string;
  canDelete: boolean;
};

interface CalendarDashboardProps {
  ownerType: "PHOTOGRAPHER" | "STUDIO_HALL";
  ownerId: string;
  ownerName: string;
  monthStart: string;
  previousMonthHref: string;
  nextMonthHref: string;
  backHref: string;
  rules: RuleDto[];
  events: EventDto[];
}

const weekdayHeaders = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];
const weekdayNames = [
  "воскресенье",
  "понедельник",
  "вторник",
  "среду",
  "четверг",
  "пятницу",
  "субботу"
];

export function CalendarDashboard({
  ownerType,
  ownerId,
  ownerName,
  monthStart,
  previousMonthHref,
  nextMonthHref,
  backHref,
  rules,
  events
}: CalendarDashboardProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const monthDate = useMemo(() => localDate(monthStart), [monthStart]);
  const calendarDays = useMemo(() => buildCalendarDays(monthStart), [monthStart]);
  const defaultSelectedDate = useMemo(() => {
    const today = dateKey(new Date());
    return today.startsWith(monthStart.slice(0, 7)) ? today : monthStart;
  }, [monthStart]);
  const [selectedDate, setSelectedDate] = useState(defaultSelectedDate);
  const eventMap = useMemo(() => {
    const map = new Map<string, EventDto[]>();
    for (const event of events) {
      const key = dateKey(new Date(event.startTime));
      const dayEvents = map.get(key);
      if (dayEvents) dayEvents.push(event);
      else map.set(key, [event]);
    }
    return map;
  }, [events]);
  const selectedDay = localDate(selectedDate);
  const selectedEvents = eventMap.get(selectedDate) ?? [];
  const selectedRule = rules.find((rule) => rule.weekday === selectedDay.getDay());

  function run(action: (formData: FormData) => Promise<{ success: boolean; error?: string }>) {
    return (formData: FormData) => {
      setMessage(null);
      startTransition(async () => {
        const result = await action(formData);
        setMessage({
          ok: result.success,
          text: result.success ? "Изменения сохранены." : result.error ?? "Ошибка сохранения."
        });
        if (result.success) router.refresh();
      });
    };
  }

  return (
    <div className="grid gap-4">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="text-sm text-muted-foreground">Календарь</p>
          <h2 className="mt-1 text-2xl font-semibold tracking-normal">{ownerName}</h2>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline" size="sm">
            <Link href={previousMonthHref} aria-label="Предыдущий месяц">
              <ArrowLeft className="size-4" />
            </Link>
          </Button>
          <Button asChild variant="outline" size="sm">
            <Link href={nextMonthHref} aria-label="Следующий месяц">
              <ArrowRight className="size-4" />
            </Link>
          </Button>
          <Button asChild variant="outline" size="sm">
            <Link href={backHref}>В кабинет</Link>
          </Button>
        </div>
      </div>

      {message ? (
        <p
          className={cn(
            "rounded-md px-4 py-3 text-sm font-medium",
            message.ok
              ? "bg-emerald-500/10 text-emerald-300"
              : "bg-rose-500/10 text-rose-300"
          )}
        >
          {message.text}
        </p>
      ) : null}

      <Card className="overflow-hidden">
        <CardContent className="p-0">
          <div className="grid xl:grid-cols-[minmax(0,1fr)_340px]">
            <div className="min-w-0 border-b border-border xl:border-b-0 xl:border-r">
              <div className="flex flex-col justify-between gap-4 border-b border-border px-4 py-4 sm:flex-row sm:items-center sm:px-5">
                <div>
                  <h3 className="text-xl font-semibold capitalize">
                    {formatMonth(monthDate)}
                  </h3>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Выберите день, чтобы изменить расписание или добавить занятость.
                  </p>
                </div>
                <div className="flex flex-wrap gap-x-4 gap-y-2 text-xs text-muted-foreground">
                  <Legend color="bg-emerald-400" label="Бронь" />
                  <Legend color="bg-amber-400" label="Занято" />
                  <Legend color="bg-sky-400" label="Удерживается" />
                </div>
              </div>

              <div>
                <div>
                  <div className="grid grid-cols-7 border-b border-border bg-secondary/25">
                    {weekdayHeaders.map((day) => (
                      <div
                        key={day}
                        className="px-3 py-2 text-center text-xs font-medium text-muted-foreground"
                      >
                        {day}
                      </div>
                    ))}
                  </div>
                  <div className="grid grid-cols-7">
                    {calendarDays.map((day) => {
                      const key = dateKey(day);
                      const dayEvents = eventMap.get(key) ?? [];
                      const isCurrentMonth = day.getMonth() === monthDate.getMonth();
                      const isSelected = key === selectedDate;
                      const isToday = key === dateKey(new Date());

                      return (
                        <button
                          key={key}
                          type="button"
                          onClick={() => setSelectedDate(key)}
                          className={cn(
                            "relative min-h-20 border-b border-r border-border p-1.5 text-left transition-colors last:border-r-0 hover:bg-secondary/40 sm:min-h-32 sm:p-2",
                            isSelected && "bg-emerald-400/[0.07] ring-1 ring-inset ring-emerald-400/70",
                            !isCurrentMonth && "bg-background/40 text-muted-foreground opacity-45"
                          )}
                        >
                          <span
                            className={cn(
                              "flex size-7 items-center justify-center rounded-md text-sm font-medium",
                              isToday && "bg-emerald-400 text-emerald-950",
                              isSelected && !isToday && "text-emerald-300"
                            )}
                          >
                            {day.getDate()}
                          </span>
                          <span className="mt-1 flex gap-1 sm:hidden">
                            {dayEvents.slice(0, 4).map((event) => (
                              <span
                                key={event.id}
                                className={cn(
                                  "size-1.5 rounded-full",
                                  event.source === "PLATFORM_BOOKING"
                                    ? "bg-emerald-400"
                                    : event.source === "MANUAL_BUSY"
                                      ? "bg-amber-400"
                                      : "bg-sky-400"
                                )}
                              />
                            ))}
                          </span>
                          <span className="mt-2 hidden gap-1 sm:grid">
                            {dayEvents.slice(0, 3).map((event) => (
                              <span
                                key={event.id}
                                className={cn(
                                  "block truncate rounded border px-1.5 py-1 text-[11px] leading-tight",
                                  eventClass(event.source)
                                )}
                              >
                                {formatTime(event.startTime)} {event.title}
                              </span>
                            ))}
                            {dayEvents.length > 3 ? (
                              <span className="px-1 text-[11px] text-muted-foreground">
                                Ещё {dayEvents.length - 3}
                              </span>
                            ) : null}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>

            <aside className="grid content-start">
              <div className="border-b border-border p-5">
                <p className="text-sm capitalize text-muted-foreground">
                  {formatWeekday(selectedDay)}
                </p>
                <h3 className="mt-1 text-2xl font-semibold">{formatSelectedDate(selectedDay)}</h3>
                <div className="mt-4 grid gap-2">
                  {selectedEvents.length === 0 ? (
                    <p className="rounded-md border border-dashed border-border px-3 py-4 text-sm text-muted-foreground">
                      На этот день событий нет.
                    </p>
                  ) : (
                    selectedEvents.map((event) => (
                      <div
                        key={event.id}
                        className={cn("rounded-md border p-3 text-sm", eventClass(event.source))}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="font-medium">{event.title}</p>
                            <p className="mt-1 text-xs opacity-75">
                              {formatTime(event.startTime)}–{formatTime(event.endTime)}
                            </p>
                          </div>
                          {event.canDelete ? (
                            <button
                              type="button"
                              className="text-rose-300 transition-colors hover:text-rose-200"
                              disabled={isPending}
                              aria-label={`Удалить ${event.title}`}
                              onClick={() => {
                                const data = baseForm(ownerType, ownerId);
                                data.set("eventId", event.id);
                                run(deleteManualBusyEventAction)(data);
                              }}
                            >
                              <Trash2 className="size-4" />
                            </button>
                          ) : null}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              <details className="group border-b border-border" open>
                <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-5 py-4">
                  <span className="inline-flex items-center gap-2 font-medium">
                    <Plus className="size-4 text-emerald-300" />
                    Добавить занятость
                  </span>
                  <span className="text-muted-foreground transition-transform group-open:rotate-45">
                    <Plus className="size-4" />
                  </span>
                </summary>
                <form
                  action={run(createManualBusyEventAction)}
                  className="grid gap-3 px-5 pb-5"
                >
                  <OwnerFields ownerType={ownerType} ownerId={ownerId} />
                  <input type="hidden" name="date" value={selectedDate} />
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="Начало" name="startTime" type="time" required />
                    <Field label="Конец" name="endTime" type="time" required />
                  </div>
                  <Field label="Название" name="title" placeholder="Личная съемка" />
                  <label className="grid gap-1.5 text-xs text-muted-foreground">
                    Личная заметка
                    <textarea
                      name="privateNote"
                      className="min-h-20 rounded-md border border-input bg-background p-2.5 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring"
                      placeholder="Клиенты её не увидят"
                    />
                  </label>
                  <Button disabled={isPending} size="sm">
                    <Plus className="size-4" />
                    Добавить
                  </Button>
                </form>
              </details>

              <details className="group">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-5 py-4">
                  <span className="inline-flex items-center gap-2 font-medium">
                    <Clock3 className="size-4 text-emerald-300" />
                    Рабочие часы
                  </span>
                  <span
                    className={cn(
                      "inline-flex items-center gap-1 text-xs",
                      selectedRule?.isActive ? "text-emerald-300" : "text-muted-foreground"
                    )}
                  >
                    {selectedRule?.isActive ? (
                      <>
                        <Check className="size-3" />
                        Рабочий день
                      </>
                    ) : (
                      "Выходной"
                    )}
                  </span>
                </summary>
                <form
                  action={run(updateAvailabilityRuleAction)}
                  className="grid gap-3 px-5 pb-5"
                >
                  <OwnerFields ownerType={ownerType} ownerId={ownerId} />
                  <input type="hidden" name="weekday" value={selectedDay.getDay()} />
                  <p className="text-xs text-muted-foreground">
                    Настройка применяется на каждую {weekdayNames[selectedDay.getDay()]}.
                  </p>
                  <label className="flex items-center gap-2 rounded-md border border-border p-3 text-sm">
                    <input
                      name="isActive"
                      type="checkbox"
                      defaultChecked={selectedRule?.isActive ?? selectedDay.getDay() !== 0}
                    />
                    Рабочий день
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    <CompactField
                      label="Начало"
                      name="startTime"
                      type="time"
                      value={selectedRule?.startTime ?? "10:00"}
                    />
                    <CompactField
                      label="Конец"
                      name="endTime"
                      type="time"
                      value={selectedRule?.endTime ?? "20:00"}
                    />
                    <CompactField
                      label="Мин. бронь"
                      name="minDurationMinutes"
                      type="number"
                      value={String(selectedRule?.minDurationMinutes ?? 60)}
                    />
                    <CompactField
                      label="Шаг слотов"
                      name="slotStepMinutes"
                      type="number"
                      value={String(selectedRule?.slotStepMinutes ?? 30)}
                    />
                    <CompactField
                      label="Буфер до"
                      name="bufferBeforeMinutes"
                      type="number"
                      value={String(selectedRule?.bufferBeforeMinutes ?? 0)}
                    />
                    <CompactField
                      label="Буфер после"
                      name="bufferAfterMinutes"
                      type="number"
                      value={String(selectedRule?.bufferAfterMinutes ?? 0)}
                    />
                  </div>
                  <Button disabled={isPending} size="sm" variant="outline">
                    <Save className="size-4" />
                    Сохранить рабочие часы
                  </Button>
                </form>
              </details>
            </aside>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function OwnerFields({ ownerType, ownerId }: { ownerType: string; ownerId: string }) {
  return (
    <>
      <input type="hidden" name="ownerType" value={ownerType} />
      <input type="hidden" name="ownerId" value={ownerId} />
    </>
  );
}

function Field({
  label,
  name,
  type = "text",
  placeholder,
  required
}: {
  label: string;
  name: string;
  type?: string;
  placeholder?: string;
  required?: boolean;
}) {
  return (
    <label className="grid gap-1.5 text-xs text-muted-foreground">
      {label}
      <input
        name={name}
        type={type}
        placeholder={placeholder}
        required={required}
        className="h-9 rounded-md border border-input bg-background px-2.5 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring"
      />
    </label>
  );
}

function CompactField({
  label,
  name,
  type,
  value
}: {
  label: string;
  name: string;
  type: string;
  value: string;
}) {
  return (
    <label className="grid gap-1.5 text-xs text-muted-foreground">
      {label}{type === "number" ? ", мин" : ""}
      <input
        name={name}
        type={type}
        min={type === "number" ? 0 : undefined}
        defaultValue={value}
        className="h-9 min-w-0 rounded-md border border-input bg-background px-2.5 text-sm text-foreground"
      />
    </label>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={cn("size-2 rounded-full", color)} />
      {label}
    </span>
  );
}

function baseForm(ownerType: string, ownerId: string) {
  const data = new FormData();
  data.set("ownerType", ownerType);
  data.set("ownerId", ownerId);
  return data;
}

function buildCalendarDays(monthStart: string) {
  const firstDay = localDate(monthStart);
  const mondayOffset = (firstDay.getDay() + 6) % 7;
  const gridStart = new Date(firstDay);
  gridStart.setDate(firstDay.getDate() - mondayOffset);
  return Array.from({ length: 42 }, (_, index) => {
    const day = new Date(gridStart);
    day.setDate(gridStart.getDate() + index);
    return day;
  });
}

function localDate(value: string) {
  return new Date(`${value}T12:00:00+05:00`);
}

function dateKey(date: Date) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Almaty",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(date);
}

function formatMonth(date: Date) {
  return new Intl.DateTimeFormat("ru-RU", {
    timeZone: "Asia/Almaty",
    month: "long",
    year: "numeric"
  }).format(date);
}

function formatSelectedDate(date: Date) {
  return new Intl.DateTimeFormat("ru-RU", {
    timeZone: "Asia/Almaty",
    day: "numeric",
    month: "long"
  }).format(date);
}

function formatWeekday(date: Date) {
  return new Intl.DateTimeFormat("ru-RU", {
    timeZone: "Asia/Almaty",
    weekday: "long"
  }).format(date);
}

function formatTime(value: string) {
  return new Intl.DateTimeFormat("ru-RU", {
    timeZone: "Asia/Almaty",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(value));
}

function eventClass(source: EventDto["source"]) {
  if (source === "PLATFORM_BOOKING") {
    return "border-emerald-400/35 bg-emerald-400/10 text-emerald-100";
  }
  if (source === "MANUAL_BUSY") {
    return "border-amber-400/35 bg-amber-400/10 text-amber-100";
  }
  return "border-sky-400/35 bg-sky-400/10 text-sky-100";
}
