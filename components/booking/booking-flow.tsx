"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { CalendarCheck, CheckCircle2, CreditCard, Mail, Phone, UserRound } from "lucide-react";
import { createBookingAction } from "@/app/booking/actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatPrice } from "@/lib/mock-data";
import { calculateBookingPricing } from "@/lib/pricing";
import type { AvailableSlot, Photographer, PhotoStyle, Studio } from "@/lib/types";

interface BookingFlowProps {
  style: PhotoStyle;
  photographer: Photographer;
  studio: Studio;
  slots: AvailableSlot[];
  currentUser?: {
    id: string;
    name?: string | null;
    email?: string | null;
    phone?: string | null;
  };
}

const durations = [1, 2, 3];

export function BookingFlow({ style, photographer, studio, slots, currentUser }: BookingFlowProps) {
  const router = useRouter();
  const [selectedSlotId, setSelectedSlotId] = useState(slots[0]?.id ?? "");
  const [selectedTime, setSelectedTime] = useState(slots[0]?.times[0] ?? "");
  const [duration, setDuration] = useState(1);
  const [isSuccess, setIsSuccess] = useState(false);
  const [clientName, setClientName] = useState(currentUser?.name ?? "");
  const [phone, setPhone] = useState(currentUser?.phone ?? "");
  const [email, setEmail] = useState(currentUser?.email ?? "");
  const [comment, setComment] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [createdBookingNumber, setCreatedBookingNumber] = useState("");

  const selectedSlot = slots.find((slot) => slot.id === selectedSlotId) ?? slots[0];
  const pricing = calculateBookingPricing({
    photographerPrice: photographer.pricePerHour,
    studioPrice: studio.pricePerHour,
    durationHours: duration
  });
  const photographerTotal = pricing.photographerTotal;
  const studioTotal = pricing.studioTotal;
  const serviceFee = pricing.serviceFee;
  const total = pricing.totalPrice;

  const fallbackBookingNumber = useMemo(
    () => `FR-${style.id.slice(0, 2).toUpperCase()}-${photographer.id.slice(0, 2).toUpperCase()}-${studio.id.slice(0, 2).toUpperCase()}-1024`,
    [photographer.id, studio.id, style.id]
  );
  const bookingNumber = createdBookingNumber || fallbackBookingNumber;

  async function handlePayment() {
    if (!clientName.trim() || !phone.trim() || !email.trim()) {
      setError("Заполните имя, телефон и email.");
      return;
    }

    if (!selectedSlot || !selectedTime) {
      setError("Выберите дату и время.");
      return;
    }

    setError("");
    setIsSubmitting(true);
    const result = await createBookingAction({
      clientId: currentUser?.id,
      clientName,
      clientPhone: phone,
      clientEmail: email,
      clientComment: comment,
      styleId: style.id,
      photographerId: photographer.id,
      studioId: studio.id,
      studioHallId: studio.primaryHallId,
      date: selectedSlot.date,
      startTime: selectedTime,
      durationHours: duration,
      photographerPrice: photographerTotal,
      studioPrice: studioTotal,
      serviceFee,
      totalPrice: total
    });
    setIsSubmitting(false);

    if (!result.success) {
      setError(result.error ?? "Не удалось создать бронь.");
      return;
    }

    if (result.checkoutUrl) {
      router.push(result.checkoutUrl);
      return;
    }

    setCreatedBookingNumber(result.bookingNumber ?? "");
    setIsSuccess(true);
  }

  if (isSuccess) {
    return (
      <section className="section">
        <div className="container">
          <Card className="mx-auto max-w-3xl">
            <CardContent className="px-6 py-10">
              <div className="flex flex-col items-start gap-5 md:flex-row">
                <span className="flex size-12 shrink-0 items-center justify-center rounded-md bg-accent text-accent-foreground">
                  <CheckCircle2 className="size-7" aria-hidden="true" />
                </span>
                <div>
                  <p className="text-sm font-medium uppercase tracking-[0.18em] text-accent">
                    Mock success
                  </p>
                  <h1 className="mt-3 text-3xl font-semibold tracking-normal">
                    Бронь успешно создана
                  </h1>
                  <p className="mt-3 text-muted-foreground">
                    Номер брони: <span className="font-medium text-foreground">{bookingNumber}</span>
                  </p>
                  <div className="mt-6 grid gap-3 rounded-lg border border-border bg-background p-5 text-sm md:grid-cols-2">
                    <SummaryItem label="Стиль" value={style.title} />
                    <SummaryItem label="Фотограф" value={photographer.name} />
                    <SummaryItem label="Студия" value={`${studio.name}, ${studio.hallName}`} />
                    <SummaryItem label="Дата и время" value={`${selectedSlot?.label}, ${selectedTime}`} />
                    <SummaryItem label="Длительность" value={`${duration} ч`} />
                    <SummaryItem label="Сумма" value={formatPrice(total)} />
                  </div>
                  <p className="mt-5 rounded-md bg-secondary px-4 py-3 text-sm font-medium">
                    Статус: Ожидает подтверждения фотографа и студии
                  </p>
                  {clientName ? (
                    <p className="mt-4 text-sm text-muted-foreground">
                      Клиент: {clientName}
                    </p>
                  ) : null}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>
    );
  }

  return (
    <section className="section">
      <div className="container grid gap-8 lg:grid-cols-[1fr_390px]">
        <div className="grid gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Детали съемки</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-3">
              <SummaryItem label="Стиль" value={style.title} />
              <SummaryItem label="Фотограф" value={photographer.name} />
              <SummaryItem label="Студия" value={`${studio.name}, ${studio.hallName}`} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Дата и время</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-5">
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {slots.map((slot) => (
                  <button
                    key={slot.id}
                    type="button"
                    onClick={() => {
                      setSelectedSlotId(slot.id);
                      setSelectedTime(slot.times[0] ?? "");
                    }}
                    className={`rounded-md border px-4 py-3 text-left text-sm transition-colors ${
                      selectedSlotId === slot.id
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border bg-card hover:bg-secondary"
                    }`}
                  >
                    <span className="font-medium">{slot.label}</span>
                    <span className="mt-1 block opacity-80">{slot.times.length} слота</span>
                  </button>
                ))}
              </div>
              <div className="flex flex-wrap gap-2">
                {selectedSlot?.times.map((time) => (
                  <button
                    key={time}
                    type="button"
                    onClick={() => setSelectedTime(time)}
                    className={`rounded-md border px-4 py-2 text-sm transition-colors ${
                      selectedTime === time
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border bg-card hover:bg-secondary"
                    }`}
                  >
                    {time}
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Длительность съемки</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-2">
              {durations.map((hours) => (
                <button
                  key={hours}
                  type="button"
                  onClick={() => setDuration(hours)}
                  className={`rounded-md border px-4 py-2 text-sm transition-colors ${
                    duration === hours
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border bg-card hover:bg-secondary"
                  }`}
                >
                  {hours} {hours === 1 ? "час" : "часа"}
                </button>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Данные клиента</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4">
              <div className="grid gap-4 md:grid-cols-3">
                <label className="grid gap-2 text-sm font-medium">
                  Имя
                  <span className="relative">
                    <UserRound className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                    <input
                      value={clientName}
                      onChange={(event) => setClientName(event.target.value)}
                      className="h-10 w-full rounded-md border border-input bg-background pl-9 pr-3 text-sm outline-none focus:ring-2 focus:ring-ring"
                      placeholder="Алия"
                    />
                  </span>
                </label>
                <label className="grid gap-2 text-sm font-medium">
                  Телефон
                  <span className="relative">
                    <Phone className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                    <input
                      value={phone}
                      onChange={(event) => setPhone(event.target.value)}
                      className="h-10 w-full rounded-md border border-input bg-background pl-9 pr-3 text-sm outline-none focus:ring-2 focus:ring-ring"
                      placeholder="+7 777 000 00 00"
                    />
                  </span>
                </label>
                <label className="grid gap-2 text-sm font-medium">
                  Email
                  <span className="relative">
                    <Mail className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                    <input
                      value={email}
                      onChange={(event) => setEmail(event.target.value)}
                      className="h-10 w-full rounded-md border border-input bg-background pl-9 pr-3 text-sm outline-none focus:ring-2 focus:ring-ring"
                      placeholder="name@email.com"
                    />
                  </span>
                </label>
              </div>
              <label className="grid gap-2 text-sm font-medium">
                Комментарий
                <textarea
                  value={comment}
                  onChange={(event) => setComment(event.target.value)}
                  className="min-h-28 w-full rounded-md border border-input bg-background p-3 text-sm outline-none focus:ring-2 focus:ring-ring"
                  placeholder="Пожелания по съемке, одежде, реквизиту или таймингу"
                />
              </label>
            </CardContent>
          </Card>
        </div>

        <Card className="h-fit lg:sticky lg:top-24">
          <CardHeader>
            <CardTitle>Итоговая стоимость</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-5">
            <div className="grid gap-3 text-sm">
              <PriceLine
                label={`Фотограф · ${duration} ч`}
                value={formatPrice(photographerTotal)}
              />
              <PriceLine label={`Студия · ${duration} ч`} value={formatPrice(studioTotal)} />
              <PriceLine label="Сервисный сбор" value={formatPrice(serviceFee)} />
              <PriceLine label="Депозит к оплате" value={formatPrice(pricing.depositAmount)} />
              <PriceLine label="Остаток после депозита" value={formatPrice(total - pricing.depositAmount)} />
              <div className="border-t border-border pt-3">
                <PriceLine label="Общая сумма" value={formatPrice(total)} strong />
              </div>
            </div>
            <Button
              size="lg"
              className="w-full"
              disabled={!selectedSlot || !selectedTime || isSubmitting}
              onClick={handlePayment}
            >
              <CreditCard className="size-4" aria-hidden="true" />
              {isSubmitting ? "Создаем бронь..." : "Оплатить бронь"}
            </Button>
            {error ? (
              <p className="rounded-md bg-rose-100 px-3 py-2 text-sm font-medium text-rose-800">
                {error}
              </p>
            ) : null}
            <div className="grid gap-2 text-sm text-muted-foreground">
              <span className="inline-flex items-center gap-2">
                <CalendarCheck className="size-4" aria-hidden="true" />
                Слот удерживается в mock-режиме
              </span>
              <span>Комментарий: {comment ? "добавлен" : "необязательно"}</span>
              <span>Контакты: {phone || email ? "заполнены частично" : "можно заполнить позже"}</span>
            </div>
          </CardContent>
        </Card>
      </div>
    </section>
  );
}

function SummaryItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="mt-1 font-semibold">{value}</p>
    </div>
  );
}

function PriceLine({
  label,
  value,
  strong = false
}: {
  label: string;
  value: string;
  strong?: boolean;
}) {
  return (
    <div className={`flex justify-between gap-4 ${strong ? "text-base font-semibold" : ""}`}>
      <span className={strong ? "" : "text-muted-foreground"}>{label}</span>
      <span>{value}</span>
    </div>
  );
}
