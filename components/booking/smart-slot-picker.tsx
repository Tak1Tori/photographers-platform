"use client";

import { useEffect, useState, useTransition } from "react";
import { CalendarClock, Clock3 } from "lucide-react";
import {
  getAvailableSlotsAction,
  type AvailableSlotsRequest
} from "@/app/booking/calendar-actions";
import { cn } from "@/lib/utils";
import type { ClientAvailableSlot } from "@/lib/calendar/types";

interface SmartSlotPickerProps
  extends Pick<
    AvailableSlotsRequest,
    "bookingType" | "photographerId" | "studioHallId"
  > {
  durationHours: number;
  dateError?: string;
  timeError?: string;
  onSelectionChange?: (date: string, startTime: string) => void;
}

export function SmartSlotPicker({
  bookingType,
  photographerId,
  studioHallId,
  durationHours,
  dateError,
  timeError,
  onSelectionChange
}: SmartSlotPickerProps) {
  const [date, setDate] = useState(() => defaultBookingDate());
  const [selectedTime, setSelectedTime] = useState("");
  const [slots, setSlots] = useState<ClientAvailableSlot[]>([]);
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    setSelectedTime("");
    onSelectionChange?.(date, "");
    if (!date) {
      setSlots([]);
      return;
    }
    startTransition(async () => {
      const result = await getAvailableSlotsAction({
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
    studioHallId,
    onSelectionChange
  ]);

  return (
    <div className="grid gap-4 rounded-lg border border-border p-4">
      <input type="hidden" name="date" value={date} />
      <input type="hidden" name="startTime" value={selectedTime} />
      <label className="grid gap-2 text-sm font-medium sm:max-w-xs">
        Дата
        <span className="relative">
          <CalendarClock className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="date"
            min={todayInAlmaty()}
            value={date}
            onChange={(event) => setDate(event.target.value)}
            className="h-10 w-full rounded-md border border-input bg-background pl-9 pr-3 text-sm outline-none focus:ring-2 focus:ring-ring"
          />
        </span>
      </label>
      {dateError ? <ErrorText text={dateError} /> : null}

      <div>
        <p className="mb-3 inline-flex items-center gap-2 text-sm font-medium">
          <Clock3 className="size-4" />
          Свободное время
        </p>
        {!date ? (
          <p className="text-sm text-muted-foreground">Сначала выберите дату.</p>
        ) : isPending ? (
          <p className="text-sm text-muted-foreground">Проверяем календарь...</p>
        ) : slots.length === 0 ? (
          <p className="rounded-md border border-dashed border-border px-4 py-5 text-sm text-muted-foreground">
            {bookingType === "FULL_SHOOT"
              ? "На эту дату нет общих свободных слотов. Выберите другую дату."
              : error || "Нет свободных окон на выбранную дату."}
          </p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {slots.map((slot) => (
              <button
                key={slot.value}
                type="button"
                onClick={() => {
                  setSelectedTime(slot.value);
                  onSelectionChange?.(date, slot.value);
                }}
                className={cn(
                  "rounded-md border px-4 py-2 text-sm transition-colors",
                  selectedTime === slot.value
                    ? "border-emerald-400 bg-emerald-400/15 text-emerald-200"
                    : "border-border bg-card hover:border-emerald-400/45"
                )}
              >
                {slot.label}–{slot.endLabel}
              </button>
            ))}
          </div>
        )}
        {timeError ? <ErrorText text={timeError} /> : null}
      </div>

      {selectedTime ? (
        <p className="text-sm text-muted-foreground">
          Мы удержим выбранное время на 15 минут, пока вы оплачиваете депозит.
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

function formatDateInAlmaty(date: Date) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Almaty",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(date);
}

function ErrorText({ text }: { text: string }) {
  return <span className="mt-2 block text-xs font-medium text-rose-700">{text}</span>;
}
