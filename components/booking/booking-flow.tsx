"use client";

import { useCallback, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  CalendarCheck,
  CalendarDays,
  Check,
  CheckCircle2,
  CreditCard,
  DoorOpen,
  Phone,
  UserRound
} from "lucide-react";
import { createBookingAction } from "@/app/booking/actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SmartSlotPicker } from "@/components/booking/smart-slot-picker";
import { formatPrice } from "@/lib/mock-data";
import { calculateBookingPricing } from "@/lib/pricing";
import { cn } from "@/lib/utils";
import type { Photographer, PhotoStyle, Studio, StudioHall } from "@/lib/types";

interface BookingFlowProps {
  style: PhotoStyle;
  photographer: Photographer;
  studio: Studio;
  studioHall?: StudioHall;
  currentUser?: {
    id: string;
    name?: string | null;
    phone?: string | null;
  };
}

const durations = [1, 2, 3];

export function BookingFlow({ style, photographer, studio, studioHall, currentUser }: BookingFlowProps) {
  const router = useRouter();
  const isConstructorStyle = style.id === "constructor";
  const activeHalls = useMemo(
    () => studio.halls.filter((hall) => (hall.status ?? "Active") === "Active"),
    [studio.halls]
  );
  const [currentStep, setCurrentStep] = useState(0);
  const [selectedHallId, setSelectedHallId] = useState(studioHall?.id ?? activeHalls[0]?.id ?? "");
  const selectedHall =
    activeHalls.find((hall) => hall.id === selectedHallId) ?? studioHall ?? activeHalls[0];
  const [selectedDate, setSelectedDate] = useState("");
  const [selectedTime, setSelectedTime] = useState("");
  const [duration, setDuration] = useState(1);
  const [isSuccess, setIsSuccess] = useState(false);
  const [clientName, setClientName] = useState(currentUser?.name ?? "");
  const [phone, setPhone] = useState(currentUser?.phone ?? "");
  const [comment, setComment] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [createdBookingNumber, setCreatedBookingNumber] = useState("");

  const handleSlotSelection = useCallback((date: string, time: string) => {
    setSelectedDate(date);
    setSelectedTime(time);
  }, []);
  const pricing = calculateBookingPricing({
    photographerPrice: photographer.pricePerHour,
    studioPrice: selectedHall?.pricePerHour ?? studio.pricePerHour,
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
    if (!selectedHall?.id) {
      setError("Выберите зал студии.");
      setCurrentStep(0);
      return;
    }

    if (!clientName.trim() || !phone.trim()) {
      setError("Заполните имя и телефон.");
      setCurrentStep(2);
      return;
    }

    if (!selectedDate || !selectedTime) {
      setError("Выберите дату и время.");
      setCurrentStep(1);
      return;
    }

    setError("");
    setIsSubmitting(true);
    const result = await createBookingAction({
      clientId: currentUser?.id,
      clientName,
      clientPhone: phone,
      clientEmail: "",
      clientComment: comment,
      styleId: isConstructorStyle ? undefined : style.id,
      photographerId: photographer.id,
      studioId: studio.id,
      studioHallId: selectedHall.id,
      date: selectedDate,
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
                    {!isConstructorStyle ? <SummaryItem label="Стиль" value={style.title} /> : null}
                    <SummaryItem label="Фотограф" value={photographer.name} />
                    <SummaryItem label="Студия" value={`${studio.name}, ${selectedHall?.name ?? studio.hallName}`} />
                    <SummaryItem label="Дата и время" value={`${selectedDate}, ${selectedTime}`} />
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
    <section className="py-6 md:py-10">
      <div className="container grid gap-6 pb-24 md:pb-0">
        <div className="sticky top-16 z-20 -mx-4 border-y border-border bg-background/95 px-4 py-4 backdrop-blur sm:-mx-6 sm:px-6 md:static md:mx-0 md:rounded-xl md:border md:bg-card/70 md:px-8">
          <FullShootStepper currentStep={currentStep} />
        </div>

        {error ? (
          <p className="rounded-md bg-rose-100 px-4 py-3 text-sm font-medium text-rose-800">
            {error}
          </p>
        ) : null}

        <section className={cn("grid gap-6", currentStep !== 0 && "hidden")}>
          <Card>
            <CardHeader>
              <CardTitle>Состав съемки</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-3">
              {!isConstructorStyle ? <SummaryItem label="Стиль" value={style.title} /> : null}
              <SummaryItem label="Фотограф" value={photographer.name} />
              <SummaryItem label="Студия" value={studio.name} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Зал студии</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4">
              {activeHalls.length > 0 ? (
                <div className="grid gap-3 md:grid-cols-2">
                  {activeHalls.map((hall) => {
                    const isSelected = selectedHall?.id === hall.id;

                    return (
                      <button
                        key={hall.id ?? hall.name}
                        type="button"
                        onClick={() => {
                          setSelectedHallId(hall.id ?? "");
                          setSelectedDate("");
                          setSelectedTime("");
                        }}
                        className={cn(
                          "grid gap-3 rounded-lg border p-4 text-left transition",
                          isSelected
                            ? "border-white bg-white text-emerald-950 shadow-[0_0_26px_rgba(255,255,255,0.18)]"
                            : "border-border bg-card hover:border-primary/50"
                        )}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="text-lg font-semibold">{hall.name}</p>
                            <p className={cn("mt-1 text-sm", isSelected ? "text-emerald-950/70" : "text-muted-foreground")}>
                              до {hall.capacity} чел · {formatPrice(hall.pricePerHour)} / час
                            </p>
                          </div>
                          <span
                            className={cn(
                              "flex size-8 items-center justify-center rounded-md border",
                              isSelected ? "border-emerald-800 bg-emerald-700 text-white" : "border-border"
                            )}
                          >
                            {isSelected ? <Check className="size-4" /> : <DoorOpen className="size-4" />}
                          </span>
                        </div>
                        <p className={cn("line-clamp-2 text-sm", isSelected ? "text-emerald-950/70" : "text-muted-foreground")}>
                          {(hall.amenities ?? []).join(", ") || "Базовые удобства"}
                        </p>
                      </button>
                    );
                  })}
                </div>
              ) : (
                <p className="rounded-md border border-dashed border-border p-4 text-sm text-muted-foreground">
                  У студии пока нет активных залов. Выберите другую студию в конструкторе.
                </p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Длительность</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-2">
              {durations.map((hours) => (
                <button
                  key={hours}
                  type="button"
                  onClick={() => {
                    setDuration(hours);
                    setSelectedDate("");
                    setSelectedTime("");
                  }}
                  className={cn(
                    "rounded-md border px-4 py-2 text-sm transition-colors",
                    duration === hours
                      ? "border-white bg-white text-emerald-950"
                      : "border-border bg-card hover:bg-secondary"
                  )}
                >
                  {hours} {hours === 1 ? "час" : "часа"}
                </button>
              ))}
            </CardContent>
          </Card>
        </section>

        <section className={cn("grid gap-6", currentStep !== 1 && "hidden")}>
          <Card>
            <CardHeader>
              <CardTitle>Дата и время</CardTitle>
            </CardHeader>
            <CardContent>
              {selectedHall?.id ? (
                <SmartSlotPicker
                  bookingType="FULL_SHOOT"
                  photographerId={photographer.id}
                  studioHallId={selectedHall.id}
                  durationHours={duration}
                  onSelectionChange={handleSlotSelection}
                  presentation="split"
                />
              ) : (
                <p className="rounded-md border border-dashed border-border p-4 text-sm text-muted-foreground">
                  Сначала выберите зал студии.
                </p>
              )}
            </CardContent>
          </Card>
        </section>

        <section className={cn("grid gap-6 lg:grid-cols-[1fr_390px]", currentStep !== 2 && "hidden")}>
          <Card>
            <CardHeader>
              <CardTitle>Данные клиента</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4">
              <div className="grid gap-4 md:grid-cols-2">
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

          <Card className="h-fit">
            <CardHeader>
              <CardTitle>Итоговая стоимость</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-5">
              <div className="grid gap-3 text-sm">
                <PriceLine label="Фотограф" value={photographer.name} />
                <PriceLine label="Студия" value={studio.name} />
                <PriceLine label="Зал" value={selectedHall?.name ?? "-"} />
                <PriceLine label={`Фотограф · ${duration} ч`} value={formatPrice(photographerTotal)} />
                <PriceLine label={`Студия · ${duration} ч`} value={formatPrice(studioTotal)} />
                <PriceLine label="Сервисный сбор платформы" value={formatPrice(pricing.platformFeeAmount)} />
                <PriceLine label="К оплате исполнителям напрямую" value={formatPrice(pricing.providerAmount)} />
                <div className="border-t border-border pt-3">
                  <PriceLine label="Стоимость услуги" value={formatPrice(pricing.totalServicePrice)} strong />
                </div>
              </div>
              <div className="grid gap-2 text-sm text-muted-foreground">
                <span className="inline-flex items-center gap-2">
                  <CalendarCheck className="size-4" aria-hidden="true" />
                  {selectedDate && selectedTime
                    ? `${selectedDate} · ${selectedTime}`
                    : "Время еще не выбрано"}
                </span>
                <span>Комментарий: {comment ? "добавлен" : "необязательно"}</span>
              </div>
            </CardContent>
          </Card>
        </section>

        <FullShootWizardFooter
          currentStep={currentStep}
          isSubmitting={isSubmitting}
          canGoNext={currentStep === 0 ? Boolean(selectedHall?.id) : Boolean(selectedDate && selectedTime)}
          onBack={() => setCurrentStep((step) => Math.max(step - 1, 0))}
          onNext={() => {
            setError("");
            setCurrentStep((step) => Math.min(step + 1, 2));
          }}
          onSubmit={handlePayment}
        />
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

const fullShootSteps = [
  { label: "Состав", icon: DoorOpen },
  { label: "Дата", icon: CalendarDays },
  { label: "Данные", icon: Check }
];

function FullShootStepper({ currentStep }: { currentStep: number }) {
  const progressWidth =
    currentStep === 0
      ? "0%"
      : currentStep === fullShootSteps.length - 1
        ? "calc(100% - 33.333%)"
        : "calc((100% - 33.333%) / 2)";

  return (
    <div className="relative grid grid-cols-3 items-start gap-2">
      <span
        className="pointer-events-none absolute left-[16.666%] right-[16.666%] top-5 h-px bg-border"
        aria-hidden="true"
      />
      <span
        className="pointer-events-none absolute left-[16.666%] top-5 h-px bg-primary/80 transition-[width] duration-300"
        style={{ width: progressWidth }}
        aria-hidden="true"
      />
      {fullShootSteps.map((step, index) => {
        const Icon = step.icon;
        const isActive = currentStep === index;
        const isDone = currentStep > index;

        return (
          <div key={step.label} className="relative z-10 grid justify-items-center gap-2 text-center">
            <span
              className={cn(
                "flex size-10 items-center justify-center rounded-full border bg-background transition",
                isActive || isDone
                  ? "border-primary bg-primary text-primary-foreground shadow-[0_0_24px_hsl(var(--primary)/0.12)]"
                  : "border-border text-muted-foreground"
              )}
            >
              <Icon className="size-5" aria-hidden="true" />
            </span>
            <span className={cn("text-sm font-medium", isActive || isDone ? "text-foreground" : "text-muted-foreground")}>
              {step.label}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function FullShootWizardFooter({
  currentStep,
  isSubmitting,
  canGoNext,
  onBack,
  onNext,
  onSubmit
}: {
  currentStep: number;
  isSubmitting: boolean;
  canGoNext: boolean;
  onBack: () => void;
  onNext: () => void;
  onSubmit: () => void;
}) {
  const isLastStep = currentStep === fullShootSteps.length - 1;

  return (
    <div className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-background/95 px-4 py-3 backdrop-blur md:static md:border-0 md:bg-transparent md:px-0 md:py-0 md:backdrop-blur-0">
      <div
        className={cn(
          "mx-auto grid max-w-screen-sm gap-3 md:max-w-none md:justify-center",
          currentStep === 0
            ? "grid-cols-1 md:grid-cols-[minmax(220px,320px)]"
            : "grid-cols-[64px_1fr] md:grid-cols-[72px_minmax(220px,320px)]"
        )}
      >
        {currentStep > 0 ? (
          <Button type="button" variant="outline" size="lg" onClick={onBack} className="h-16 w-16 p-0 md:h-16 md:w-16">
            <ArrowLeft className="size-7" strokeWidth={2.4} aria-hidden="true" />
            <span className="sr-only">Назад</span>
          </Button>
        ) : null}
        {isLastStep ? (
          <Button type="button" size="lg" disabled={isSubmitting} onClick={onSubmit} className="h-14">
            <CreditCard className="size-5" aria-hidden="true" />
            {isSubmitting ? "Создаем бронь..." : "Оплатить бронь"}
          </Button>
        ) : (
          <Button type="button" size="lg" disabled={!canGoNext} onClick={onNext} className="h-14">
            Далее
          </Button>
        )}
      </div>
    </div>
  );
}
