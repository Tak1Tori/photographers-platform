"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import {
  ArrowLeft,
  ArrowRight,
  CalendarClock,
  Clock3,
  LockKeyhole,
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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
  weekStart: string;
  previousWeekHref: string;
  nextWeekHref: string;
  backHref: string;
  rules: RuleDto[];
  events: EventDto[];
}

const weekdays = ["Вс", "Пн", "Вт", "Ср", "Чт", "Пт", "Сб"];

export function CalendarDashboard({
  ownerType,
  ownerId,
  ownerName,
  weekStart,
  previousWeekHref,
  nextWeekHref,
  backHref,
  rules,
  events
}: CalendarDashboardProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const days = Array.from({ length: 7 }, (_, index) => {
    const date = new Date(`${weekStart}T12:00:00+05:00`);
    date.setDate(date.getDate() + index);
    return date;
  });
  const ruleMap = new Map(rules.map((rule) => [rule.weekday, rule]));

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

  const platformCount = events.filter((event) => event.source === "PLATFORM_BOOKING").length;
  const manualCount = events.filter((event) => event.source === "MANUAL_BUSY").length;
  const holdCount = events.filter((event) => event.source === "ACTIVE_HOLD").length;

  return (
    <div className="grid gap-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <p className="text-sm text-muted-foreground">Календарь</p>
          <h2 className="text-2xl font-semibold tracking-normal">{ownerName}</h2>
        </div>
        <div className="flex gap-2">
          <Button asChild variant="outline" size="sm">
            <Link href={previousWeekHref} aria-label="Предыдущая неделя">
              <ArrowLeft className="size-4" />
            </Link>
          </Button>
          <Button asChild variant="outline" size="sm">
            <Link href={nextWeekHref} aria-label="Следующая неделя">
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

      <div className="grid gap-3 sm:grid-cols-3">
        <Stat icon={CalendarClock} label="Событий за неделю" value={events.length} />
        <Stat icon={Clock3} label="Брони платформы" value={platformCount} />
        <Stat icon={LockKeyhole} label="Ручная занятость / hold" value={manualCount + holdCount} />
      </div>

      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle>Неделя</CardTitle>
          <span className="text-sm text-muted-foreground">
            {formatDay(days[0])} — {formatDay(days[6])}
          </span>
        </CardHeader>
        <CardContent>
          <div className="grid min-w-[820px] grid-cols-7 gap-2 overflow-x-auto pb-2">
            {days.map((day) => {
              const key = dateKey(day);
              const dayEvents = events.filter((event) => dateKey(new Date(event.startTime)) === key);
              return (
                <div key={key} className="min-h-56 rounded-md border border-border bg-background p-2">
                  <div className="mb-3 border-b border-border pb-2">
                    <p className="text-xs text-muted-foreground">{weekdays[day.getDay()]}</p>
                    <p className="font-medium">{formatDay(day)}</p>
                  </div>
                  <div className="grid gap-2">
                    {dayEvents.length === 0 ? (
                      <p className="py-6 text-center text-xs text-muted-foreground">Свободно</p>
                    ) : (
                      dayEvents.map((event) => (
                        <div
                          key={event.id}
                          className={cn(
                            "rounded-md border px-2 py-2 text-xs",
                            event.source === "PLATFORM_BOOKING"
                              ? "border-emerald-400/35 bg-emerald-400/10"
                              : event.source === "MANUAL_BUSY"
                                ? "border-amber-400/35 bg-amber-400/10"
                                : "border-sky-400/35 bg-sky-400/10"
                          )}
                        >
                          <p className="font-medium">{event.title}</p>
                          <p className="mt-1 text-muted-foreground">
                            {formatTime(event.startTime)}–{formatTime(event.endTime)}
                          </p>
                          {event.canDelete ? (
                            <button
                              type="button"
                              className="mt-2 inline-flex items-center gap-1 text-rose-300"
                              disabled={isPending}
                              onClick={() => {
                                const data = baseForm(ownerType, ownerId);
                                data.set("eventId", event.id);
                                run(deleteManualBusyEventAction)(data);
                              }}
                            >
                              <Trash2 className="size-3" />
                              Удалить
                            </button>
                          ) : null}
                        </div>
                      ))
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 xl:grid-cols-[0.8fr_1.2fr]">
        <Card>
          <CardHeader>
            <CardTitle>Добавить занятость</CardTitle>
          </CardHeader>
          <CardContent>
            <form action={run(createManualBusyEventAction)} className="grid gap-4">
              <OwnerFields ownerType={ownerType} ownerId={ownerId} />
              <Field label="Дата" name="date" type="date" required />
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Начало" name="startTime" type="time" required />
                <Field label="Конец" name="endTime" type="time" required />
              </div>
              <Field label="Название" name="title" placeholder="Личная съемка" />
              <label className="grid gap-2 text-sm font-medium">
                Личная заметка
                <textarea
                  name="privateNote"
                  className="min-h-24 rounded-md border border-input bg-background p-3 text-sm outline-none focus:ring-2 focus:ring-ring"
                  placeholder="Клиенты эту заметку не увидят"
                />
              </label>
              <Button disabled={isPending}>
                <Plus className="size-4" />
                Добавить
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Рабочее расписание</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3">
            {weekdays.map((label, weekday) => {
              const rule = ruleMap.get(weekday);
              return (
                <form
                  key={weekday}
                  action={run(updateAvailabilityRuleAction)}
                  className="grid gap-3 rounded-md border border-border p-3 lg:grid-cols-[50px_90px_repeat(6,minmax(80px,1fr))_auto] lg:items-end"
                >
                  <OwnerFields ownerType={ownerType} ownerId={ownerId} />
                  <input type="hidden" name="weekday" value={weekday} />
                  <span className="pb-2 font-medium">{label}</span>
                  <label className="flex items-center gap-2 pb-2 text-sm">
                    <input name="isActive" type="checkbox" defaultChecked={rule?.isActive ?? weekday !== 0} />
                    Рабочий
                  </label>
                  <CompactField label="Начало" name="startTime" type="time" value={rule?.startTime ?? "10:00"} />
                  <CompactField label="Конец" name="endTime" type="time" value={rule?.endTime ?? "20:00"} />
                  <CompactField label="Мин., мин" name="minDurationMinutes" type="number" value={String(rule?.minDurationMinutes ?? 60)} />
                  <CompactField label="Шаг, мин" name="slotStepMinutes" type="number" value={String(rule?.slotStepMinutes ?? 30)} />
                  <CompactField label="Буфер до" name="bufferBeforeMinutes" type="number" value={String(rule?.bufferBeforeMinutes ?? 0)} />
                  <CompactField label="Буфер после" name="bufferAfterMinutes" type="number" value={String(rule?.bufferAfterMinutes ?? 0)} />
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={isPending}
                    title="Сохранить день"
                    className="px-3"
                  >
                    <Save className="size-4" />
                  </Button>
                </form>
              );
            })}
          </CardContent>
        </Card>
      </div>
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
    <label className="grid gap-2 text-sm font-medium">
      {label}
      <input
        name={name}
        type={type}
        placeholder={placeholder}
        required={required}
        className="h-10 rounded-md border border-input bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
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
    <label className="grid gap-1 text-xs text-muted-foreground">
      {label}
      <input
        name={name}
        type={type}
        min={type === "number" ? 0 : undefined}
        defaultValue={value}
        className="h-9 min-w-0 rounded-md border border-input bg-background px-2 text-sm text-foreground"
      />
    </label>
  );
}

function Stat({
  icon: Icon,
  label,
  value
}: {
  icon: typeof CalendarClock;
  label: string;
  value: number;
}) {
  return (
    <div className="flex items-center gap-3 rounded-lg border border-border bg-card p-4">
      <span className="flex size-10 items-center justify-center rounded-md bg-emerald-400/10 text-emerald-300">
        <Icon className="size-5" />
      </span>
      <div>
        <p className="text-2xl font-semibold">{value}</p>
        <p className="text-sm text-muted-foreground">{label}</p>
      </div>
    </div>
  );
}

function baseForm(ownerType: string, ownerId: string) {
  const data = new FormData();
  data.set("ownerType", ownerType);
  data.set("ownerId", ownerId);
  return data;
}

function dateKey(date: Date) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Almaty",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(date);
}

function formatDay(date: Date) {
  return new Intl.DateTimeFormat("ru-RU", {
    timeZone: "Asia/Almaty",
    day: "numeric",
    month: "short"
  }).format(date);
}

function formatTime(value: string) {
  return new Intl.DateTimeFormat("ru-RU", {
    timeZone: "Asia/Almaty",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(value));
}
