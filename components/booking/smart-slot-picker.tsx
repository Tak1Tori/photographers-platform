"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { ArrowLeft, ArrowRight, CalendarClock, Clock3 } from "lucide-react";
import {
  getBookingCalendarDaysAction,
  getBookingDaySlotsAction,
  type AvailableSlotsRequest,
  type BookingCalendarDay,
  type ClientBookingSlot
} from "@/app/booking/calendar-actions";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface SmartSlotPickerProps
  extends Pick<
    AvailableSlotsRequest,
    "bookingType" | "photographerId" | "studioHallId"
  > {
  durationHours: number;
  dateError?: string;
  timeError?: string;
  onSelectionChange?: (date: string, startTime: string) => void;
  presentation?: "default" | "split";
}

export function SmartSlotPicker({
  bookingType,
  photographerId,
  studioHallId,
  durationHours,
  dateError,
  timeError,
  onSelectionChange,
  presentation = "default"
}: SmartSlotPickerProps) {
  const [date, setDate] = useState(() => defaultBookingDate());
  const [month, setMonth] = useState(() => monthKey(defaultBookingDate()));
  const [selectedTime, setSelectedTime] = useState("");
  const [calendarDays, setCalendarDays] = useState<BookingCalendarDay[]>([]);
  const [slots, setSlots] = useState<ClientBookingSlot[]>([]);
  const [error, setError] = useState("");
  const [calendarError, setCalendarError] = useState("");
  const [isPending, startTransition] = useTransition();
  const [isCalendarPending, startCalendarTransition] = useTransition();
  const selectionChangeRef = useRef(onSelectionChange);
  const monthDate = useMemo(() => localMonthDate(month), [month]);
  const calendarGridDays = useMemo(() => buildCalendarGrid(month), [month]);
  const today = todayInAlmaty();
  const calendarDayMap = useMemo(() => {
    return new Map(calendarDays.map((day) => [day.date, day]));
  }, [calendarDays]);
  const selectedDayInfo = calendarDayMap.get(date);
  const availableSlotCount = slots.filter(
    (slot) => slot.status === "AVAILABLE"
  ).length;
  const calendarTitle = photographerId
    ? "Календарь фотографа"
    : "Календарь студии";
  const timeTitle =
    bookingType === "FULL_SHOOT" ? "Общее время фотографа и студии" : "Все слоты";
  const groupedSlots = useMemo(
    () =>
      slotGroups.map((group) => ({
        ...group,
        slots: slots.filter((slot) => group.matches(getSlotHour(slot.value)))
      })),
    [slots]
  );
  const isSplit = presentation === "split";

  useEffect(() => {
    selectionChangeRef.current = onSelectionChange;
  }, [onSelectionChange]);

  useEffect(() => {
    setSelectedTime("");
    selectionChangeRef.current?.(date, "");
    if (!date) {
      setSlots([]);
      return;
    }
    startTransition(async () => {
      const result = await getBookingDaySlotsAction({
        bookingType,
        photographerId,
        studioHallId,
        date,
        durationMinutes: durationHours * 60
      });
      setSlots(result.slots);
      setError(result.error ?? "");
    });
  }, [
    bookingType,
    date,
    durationHours,
    photographerId,
    studioHallId
  ]);

  useEffect(() => {
    setCalendarDays([]);
    setCalendarError("");
    startCalendarTransition(async () => {
      const result = await getBookingCalendarDaysAction({
        bookingType,
        photographerId,
        studioHallId,
        month,
        durationMinutes: durationHours * 60
      });
      setCalendarDays(result.days);
      setCalendarError(result.error ?? "");
    });
  }, [bookingType, durationHours, month, photographerId, studioHallId]);

  function selectDate(nextDate: string) {
    setDate(nextDate);
    if (monthKey(nextDate) !== month) setMonth(monthKey(nextDate));
  }

  function shiftMonth(delta: number) {
    const current = localMonthDate(month);
    current.setMonth(current.getMonth() + delta, 1);
    const nextMonth = formatDateInAlmaty(current).slice(0, 7);
    setMonth(nextMonth);

    const selectedMonth = monthKey(date);
    if (selectedMonth === month) {
      const daysInNextMonth = new Date(
        current.getFullYear(),
        current.getMonth() + 1,
        0
      ).getDate();
      selectDate(`${nextMonth}-${String(Math.min(Number(date.slice(8, 10)), daysInNextMonth)).padStart(2, "0")}`);
    }
  }

  function renderSlotButton(slot: ClientBookingSlot) {
    const isAvailable = slot.status === "AVAILABLE";
    const isBusy = slot.status === "BUSY";

    return (
      <button
        key={`${slot.value}-${slot.endLabel}`}
        type="button"
        disabled={!isAvailable}
        aria-label={`${slot.label}-${slot.endLabel}, ${
          isAvailable ? "свободно" : isBusy ? "занято" : "недоступно"
        }`}
        onClick={() => {
          if (!isAvailable) return;
          setSelectedTime(slot.value);
          selectionChangeRef.current?.(date, slot.value);
        }}
        className={cn(
          "rounded-md border px-3 py-3 text-sm transition-colors sm:px-4 sm:py-2",
          isSplit && "min-h-12 text-base md:text-sm",
          isAvailable && selectedTime === slot.value
            ? "border-white bg-white text-emerald-950 shadow-[0_0_0_1px_rgba(255,255,255,0.35),0_0_28px_rgba(255,255,255,0.22),0_0_36px_hsl(var(--primary)/0.18)]"
            : isAvailable
              ? "border-primary/35 bg-primary/[0.08] text-foreground hover:border-primary/70 hover:bg-primary/[0.14]"
              : isBusy
                ? "cursor-not-allowed border-rose-500/40 bg-rose-500/10 text-rose-200"
                : "cursor-not-allowed border-border bg-secondary/20 text-muted-foreground/55"
        )}
      >
        {slot.label}–{slot.endLabel}
      </button>
    );
  }

  return (
    <div
      className={cn(
        "grid gap-4",
        isSplit ? "sm:gap-5" : "rounded-lg border border-border p-3 sm:gap-5 sm:p-4"
      )}
    >
      <input type="hidden" name="date" value={date} />
      <input type="hidden" name="startTime" value={selectedTime} />

      <div
        className={cn(
          "grid gap-4",
          isSplit && "lg:grid-cols-[minmax(520px,1fr)_minmax(500px,1.15fr)] lg:items-start"
        )}
      >
      <div
        className={cn(
          "grid gap-3",
          isSplit && "rounded-xl border border-border bg-background/30 p-3 shadow-[0_20px_60px_rgba(0,0,0,0.18)] sm:p-4"
        )}
      >
          <div className="flex items-end justify-between gap-3">
            <div>
              <p className="inline-flex items-center gap-2 text-sm font-medium">
                <CalendarClock className="size-4 text-emerald-300" />
                {calendarTitle}
              </p>
            <h3 className="mt-1 text-lg font-semibold capitalize sm:text-xl">
              {formatMonth(monthDate)}
            </h3>
          </div>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => shiftMonth(-1)}
              aria-label="Предыдущий месяц"
            >
              <ArrowLeft className="size-4" />
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => shiftMonth(1)}
              aria-label="Следующий месяц"
            >
              <ArrowRight className="size-4" />
            </Button>
          </div>
        </div>

        <div className="overflow-hidden rounded-lg border border-border">
          <div className="grid grid-cols-7 border-b border-border bg-secondary/25 text-center text-xs font-medium text-muted-foreground">
            {weekdayHeaders.map((day) => (
              <div key={day} className="px-2 py-2">
                {day}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7">
            {calendarGridDays.map((day) => {
              const key = formatDateInAlmaty(day);
              const info = calendarDayMap.get(key);
              const isCurrentMonth = key.startsWith(month);
              const isSelected = key === date;
              const isToday = key === today;
              const isPast = key < today;
              const hasSlots = info?.status === "AVAILABLE";

              return (
                <button
                  key={key}
                  type="button"
                  disabled={!isCurrentMonth || isPast}
                  onClick={() => selectDate(key)}
                  className={cn(
                    "relative min-h-14 border-b border-r border-border p-1.5 text-left transition-colors last:border-r-0 hover:bg-secondary/40 disabled:pointer-events-none disabled:opacity-35 sm:min-h-20 sm:p-2 lg:min-h-[78px]",
                    isSelected && "bg-primary/[0.08] ring-1 ring-inset ring-primary/70",
                    !isCurrentMonth && "bg-background/40 text-muted-foreground"
                  )}
                >
                  <span
                    className={cn(
                      "flex size-6 items-center justify-center rounded-md text-xs font-medium sm:size-7 sm:text-sm",
                      isToday && "bg-primary text-primary-foreground",
                      isSelected && !isToday && "text-emerald-300"
                    )}
                  >
                    {day.getDate()}
                  </span>
                  <span className="mt-2 flex items-center gap-1.5 sm:mt-3">
                    <span
                      className={cn(
                        "size-2 rounded-full",
                        hasSlots ? "bg-primary shadow-[0_0_12px_hsl(var(--primary)/0.5)]" : "bg-muted"
                      )}
                    />
                  </span>
                  {isCalendarPending && isCurrentMonth ? (
                    <span className="sr-only">Проверяем доступность</span>
                  ) : null}
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex flex-wrap gap-x-4 gap-y-2 text-xs text-muted-foreground">
          <Legend color="bg-primary" label="есть окна" />
          <Legend color="bg-muted" label="нет доступного времени" />
          {bookingType === "FULL_SHOOT" ? (
            <span>Время ниже проверяется с учетом выбранной студии.</span>
          ) : null}
        </div>
        {calendarError ? <ErrorText text={calendarError} /> : null}
        {dateError ? <ErrorText text={dateError} /> : null}
      </div>

      <div
        className={cn(
          isSplit && "rounded-xl border border-border bg-background/30 p-4 shadow-[0_20px_60px_rgba(0,0,0,0.18)] md:p-5"
        )}
      >
        <p className="mb-3 inline-flex items-center gap-2 text-sm font-medium">
          <Clock3 className="size-4" />
          {timeTitle}
        </p>
        <p className="mb-3 text-sm text-muted-foreground">
          {formatSelectedDate(localMonthDate(date))} · свободно{" "}
          {availableSlotCount} из {slots.length || selectedDayInfo?.availableCount || 0}
        </p>
        {!date ? (
          <p className="text-sm text-muted-foreground">Сначала выберите дату.</p>
        ) : isPending ? (
          <p className="text-sm text-muted-foreground">Проверяем календарь...</p>
        ) : slots.length === 0 ? (
          <p className="rounded-md border border-dashed border-border px-4 py-5 text-sm text-muted-foreground">
            {bookingType === "FULL_SHOOT"
              ? "На эту дату нет рабочих слотов. Выберите другую дату."
              : error || "Нет рабочих слотов на выбранную дату."}
          </p>
        ) : isSplit ? (
          <>
            <div className="grid gap-5">
              {groupedSlots.map((group) => (
                <section
                  key={group.key}
                  className="grid gap-3 border-b border-border/80 pb-5 last:border-b-0 last:pb-0"
                >
                  <h4 className="text-center text-sm font-semibold text-foreground">
                    {group.label}
                  </h4>
                  {group.slots.length > 0 ? (
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-4">
                      {group.slots.map(renderSlotButton)}
                    </div>
                  ) : (
                    <p className="rounded-md border border-dashed border-border px-4 py-4 text-center text-sm text-muted-foreground">
                      Нет слотов
                    </p>
                  )}
                </section>
              ))}
            </div>
            <div className="mt-4 flex flex-wrap gap-x-4 gap-y-2 text-xs text-muted-foreground">
              <Legend color="bg-primary" label="свободно" />
              <Legend color="bg-rose-400" label="занято" />
              <Legend color="bg-muted" label="буфер" />
            </div>
          </>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
              {slots.map(renderSlotButton)}
            </div>
            <div className="mt-4 flex flex-wrap gap-x-4 gap-y-2 text-xs text-muted-foreground">
              <Legend color="bg-primary" label="свободно" />
              <Legend color="bg-rose-400" label="занято" />
              <Legend color="bg-muted" label="буфер" />
            </div>
          </>
        )}
        {timeError ? <ErrorText text={timeError} /> : null}
      </div>
      </div>

      {selectedTime ? (
        <p className="text-sm text-muted-foreground">
          Мы удержим выбранное время на 15 минут, пока вы оплачиваете сервисный сбор.
        </p>
      ) : null}
    </div>
  );
}

function todayInAlmaty() {
  return formatDateInAlmaty(new Date());
}

function defaultBookingDate() {
  const date = new Date();
  date.setDate(date.getDate() + 1);
  return formatDateInAlmaty(date);
}

const weekdayHeaders = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];

const slotGroups = [
  { key: "morning", label: "Утро", matches: (hour: number) => hour < 12 },
  { key: "day", label: "День", matches: (hour: number) => hour >= 12 && hour < 18 },
  { key: "evening", label: "Вечер", matches: (hour: number) => hour >= 18 }
];

function getSlotHour(value: string) {
  return Number(value.slice(0, 2));
}

function buildCalendarGrid(month: string) {
  const firstDay = localMonthDate(`${month}-01`);
  const mondayOffset = (firstDay.getDay() + 6) % 7;
  const gridStart = new Date(firstDay);
  gridStart.setDate(firstDay.getDate() - mondayOffset);

  return Array.from({ length: 42 }, (_, index) => {
    const day = new Date(gridStart);
    day.setDate(gridStart.getDate() + index);
    return day;
  });
}

function localMonthDate(value: string) {
  const date = value.length === 7 ? `${value}-01` : value;
  return new Date(`${date}T12:00:00+05:00`);
}

function monthKey(date: string) {
  return date.slice(0, 7);
}

function formatDateInAlmaty(date: Date) {
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
    weekday: "long",
    day: "numeric",
    month: "long"
  }).format(date);
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={cn("size-2 rounded-full", color)} />
      {label}
    </span>
  );
}

function ErrorText({ text }: { text: string }) {
  return <span className="mt-2 block text-xs font-medium text-rose-700">{text}</span>;
}
