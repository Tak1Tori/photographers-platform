const calendarTimeZoneOffset = "+05:00";

export function localDateTime(date: string, time: string) {
  return new Date(`${date}T${normalizeTime(time)}:00${calendarTimeZoneOffset}`);
}

export function dateKey(date: Date) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Almaty",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(date);
}

export function weekdayInAlmaty(date: Date) {
  const short = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Almaty",
    weekday: "short"
  }).format(date);
  return ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(short);
}

export function timeLabel(date: Date) {
  return new Intl.DateTimeFormat("ru-RU", {
    timeZone: "Asia/Almaty",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  }).format(date);
}

export function addMinutes(date: Date, minutes: number) {
  return new Date(date.getTime() + minutes * 60_000);
}

export function minutesBetween(start: Date, end: Date) {
  return Math.round((end.getTime() - start.getTime()) / 60_000);
}

export function minutesFromTime(value: string) {
  const [hours, minutes] = normalizeTime(value).split(":").map(Number);
  return hours * 60 + minutes;
}

export function timeFromMinutes(value: number) {
  const hours = Math.floor(value / 60);
  const minutes = value % 60;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

export function dayRange(date: string) {
  return {
    startTime: localDateTime(date, "00:00"),
    endTime: localDateTime(date, "23:59")
  };
}

export function rangesOverlap(
  firstStart: Date,
  firstEnd: Date,
  secondStart: Date,
  secondEnd: Date
) {
  return firstStart < secondEnd && firstEnd > secondStart;
}

export function normalizeTime(value: string) {
  const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(value);
  if (!match) throw new Error("Некорректное время.");
  return `${match[1]}:${match[2]}`;
}
