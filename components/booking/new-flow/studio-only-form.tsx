"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useMemo, useState, useTransition } from "react";
import { AlertCircle, ArrowLeft, Building2, CalendarDays, Check, CreditCard, MapPin, Users } from "lucide-react";
import { createStudioOnlyBookingAction } from "@/app/booking/new/actions";
import {
  RENTAL_PURPOSES,
  STUDIO_EQUIPMENT_OPTIONS
} from "@/lib/booking-options";
import { calculateBookingPricing } from "@/lib/pricing";
import {
  CONTACT_INFO_ERROR,
  validateNoContactInfo
} from "@/lib/validation/contact-sanitizer";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SmartSlotPicker } from "@/components/booking/smart-slot-picker";
import { StudioMap } from "@/components/studios/studio-map";
import { formatPrice } from "@/lib/mock-data";
import { cn } from "@/lib/utils";
import type { Studio, StudioHall } from "@/lib/types";

type FieldErrors = Record<string, string>;
type CreatedBookingState = {
  bookingNumber: string;
  checkoutUrl: string;
};

interface StudioOnlyFormProps {
  studio?: Studio;
  hall?: StudioHall;
  clientDefaults?: {
    name?: string | null;
    phone?: string | null;
  };
}

export function StudioOnlyForm({ studio, hall, clientDefaults }: StudioOnlyFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const activeHalls = useMemo(
    () => (studio?.halls ?? []).filter((item) => (item.status ?? "Active") === "Active"),
    [studio?.halls]
  );
  const initialHallId = hall?.id ?? activeHalls[0]?.id ?? "";
  const [selectedHallId, setSelectedHallId] = useState(initialHallId);
  const selectedHall = activeHalls.find((item) => item.id === selectedHallId) ?? hall ?? activeHalls[0];
  const [durationHours, setDurationHours] = useState(2);
  const [peopleCount, setPeopleCount] = useState(1);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [createdBooking, setCreatedBooking] = useState<CreatedBookingState | null>(null);
  const [mobileStep, setMobileStep] = useState(0);
  const [mobileSlot, setMobileSlot] = useState({ date: "", startTime: "" });
  const pricing = useMemo(
    () =>
      calculateBookingPricing({
        bookingType: "STUDIO_ONLY",
        photographerPrice: 0,
        studioPrice: selectedHall?.pricePerHour ?? 0,
        durationHours
      }),
    [durationHours, selectedHall?.pricePerHour]
  );
  const capacityError =
    selectedHall && peopleCount > selectedHall.capacity
      ? `Вместимость выбранного зала: ${selectedHall.capacity} человек.`
      : undefined;
  const hasContactErrors = Object.values(fieldErrors).some((error) => error === CONTACT_INFO_ERROR);
  const canGoNext = mobileStep !== 1 || Boolean(mobileSlot.date && mobileSlot.startTime);
  const requiresStudioConfirmation =
    studio?.confirmationMode === "WHATSAPP_CONFIRMATION" && Boolean(studio.whatsappConfirmationEnabled);
  const handleMobileSlotChange = useCallback((date: string, startTime: string) => {
    setMobileSlot((current) => {
      if (current.date === date && current.startTime === startTime) {
        return current;
      }

      return { date, startTime };
    });
  }, []);

  function validateTextField(name: string, value: string) {
    const result = validateNoContactInfo(value);
    setFieldErrors((current) => {
      const next = { ...current };
      if (result.valid) delete next[name];
      else next[name] = result.error!;
      return next;
    });
  }

  function submit(formData: FormData) {
    setFormError(null);
    setFieldErrors({});
    setCreatedBooking(null);
    startTransition(async () => {
      const result = await createStudioOnlyBookingAction(formData);
      if (result.success && result.requiresStudioConfirmation && result.waitingUrl) {
        router.push(result.waitingUrl);
        return;
      }
      if (result.success && result.checkoutUrl) {
        setCreatedBooking({
          bookingNumber: result.bookingNumber ?? "Новая бронь",
          checkoutUrl: result.checkoutUrl
        });
        setMobileStep(2);
        return;
      }

      setFieldErrors(result.fieldErrors ?? {});
      setFormError(result.error ?? "Не удалось создать заявку.");
    });
  }

  if (!studio) {
    return (
      <Card>
        <CardContent className="grid gap-4 p-8 text-center">
          <div className="mx-auto flex size-12 items-center justify-center rounded-md bg-secondary">
            <Building2 className="size-6" aria-hidden="true" />
          </div>
          <div>
            <h2 className="text-2xl font-semibold tracking-normal">Сначала выберите студию или зал</h2>
            <p className="mt-2 text-muted-foreground">
              Заявка создается под конкретный зал, чтобы проверить вместимость и посчитать стоимость.
            </p>
          </div>
          <Button asChild className="mx-auto w-fit">
            <Link href="/studios?mode=booking">Перейти к студиям</Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <form action={submit} className="grid gap-6">
      <input type="hidden" name="studioId" value={studio.id} />
      <input type="hidden" name="studioHallId" value={selectedHall?.id ?? ""} />
      <input type="hidden" name="selectedHallCapacity" value={selectedHall?.capacity ?? 0} />

      <div className="sticky top-16 z-20 -mx-4 border-y border-border bg-background/95 px-4 py-4 backdrop-blur sm:-mx-6 sm:px-6 md:static md:mx-0 md:rounded-xl md:border md:bg-card/70 md:px-8">
        <StudioBookingStepper currentStep={mobileStep} />
      </div>

      <div className="grid min-h-[calc(100svh-230px)] gap-4 pb-28 pt-2 md:min-h-0 md:pb-0">
        {formError ? <Notice message={formError} /> : null}

        <section className={cn("grid gap-4 lg:grid-cols-[320px_minmax(0,1fr)]", mobileStep !== 0 && "hidden")}>
          <StudioCard studio={studio} selectedHall={selectedHall} />

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-xl">Детали аренды</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-5">
              <div className="grid gap-3">
                <p className="text-sm font-medium">Выбор зала</p>
                <div className="grid gap-3 md:grid-cols-2">
                  {activeHalls.map((item) => (
                    <label
                      key={item.id ?? item.name}
                      className={cn(
                        "grid cursor-pointer gap-2 rounded-lg border p-4 text-sm transition-colors",
                        selectedHall?.id === item.id
                          ? "border-primary bg-primary/10"
                          : "border-border hover:border-primary/50"
                      )}
                    >
                      <input
                        type="radio"
                        className="sr-only"
                        checked={selectedHall?.id === item.id}
                        onChange={() => {
                          setSelectedHallId(item.id ?? "");
                          setPeopleCount((current) => Math.min(current, item.capacity));
                          setMobileSlot({ date: "", startTime: "" });
                        }}
                      />
                      <span className="font-semibold">{item.name}</span>
                      <span className="text-muted-foreground">
                        {item.capacity} чел · {formatPrice(item.pricePerHour)} / час
                      </span>
                      <span className="text-muted-foreground">
                        {(item.amenities ?? []).join(", ") || "Базовые удобства"}
                      </span>
                    </label>
                  ))}
                </div>
                <ErrorText error={fieldErrors.studioHallId} />
              </div>

              <Select label="Цель аренды" name="rentalPurpose" options={RENTAL_PURPOSES} error={fieldErrors.rentalPurpose} />

              <Textarea
                label="Описание съемки/аренды"
                name="shootDescription"
                placeholder="Опишите, для чего нужна студия: съемка, видео, контент, предметка, кастинг и т.д."
                error={fieldErrors.shootDescription}
                onValidate={validateTextField}
                required
              />

              <div className="grid gap-4 md:grid-cols-2">
                <label className="grid gap-2 text-sm font-medium">
                  Длительность
                  <select
                    name="durationHours"
                    value={durationHours}
                    onChange={(event) => {
                      setDurationHours(Number(event.target.value));
                      setMobileSlot({ date: "", startTime: "" });
                    }}
                    className={inputClass}
                  >
                    {[1, 2, 3, 4, 5].map((hours) => (
                      <option key={hours} value={hours}>
                        {hours === 5 ? "5+ часов" : `${hours} ${hours === 1 ? "час" : "часа"}`}
                      </option>
                    ))}
                  </select>
                  <ErrorText error={fieldErrors.durationHours} />
                </label>

                <label className="grid gap-2 text-sm font-medium">
                  Количество людей
                  <input
                    name="peopleCount"
                    type="number"
                    min={1}
                    max={selectedHall?.capacity ?? 100}
                    value={peopleCount}
                    onChange={(event) => setPeopleCount(Number(event.target.value))}
                    className={inputClass}
                  />
                  <ErrorText error={capacityError ?? fieldErrors.peopleCount} />
                </label>
              </div>
            </CardContent>
          </Card>
        </section>

        <section className={cn("grid gap-4", mobileStep !== 1 && "hidden")}>
          <Card className="overflow-hidden">
            <CardHeader className="pb-3">
              <CardTitle className="text-xl">Дата и время</CardTitle>
            </CardHeader>
            <CardContent>
              {selectedHall?.id ? (
                <SmartSlotPicker
                  bookingType="STUDIO_ONLY"
                  studioHallId={selectedHall.id}
                  durationHours={durationHours}
                  dateError={fieldErrors.date}
                  timeError={fieldErrors.startTime}
                  onSelectionChange={handleMobileSlotChange}
                  presentation="split"
                />
              ) : (
                <Notice message="Сначала выберите зал." />
              )}
            </CardContent>
          </Card>
        </section>

        <section className={cn("grid gap-4", mobileStep !== 2 && "hidden")}>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-xl">Подтверждение</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4">
              {createdBooking ? (
                <div className="grid gap-3 rounded-lg border border-primary/40 bg-primary/10 p-4">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-300">
                      Бронь создана
                    </p>
                    <h3 className="mt-2 text-xl font-semibold tracking-normal">
                      {createdBooking.bookingNumber}
                    </h3>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Сервисный сбор можно оплатить сейчас или позже из личного кабинета.
                    </p>
                  </div>
                  <Button
                    type="button"
                    onClick={() => router.push(createdBooking.checkoutUrl)}
                    className="w-full bg-white text-emerald-950 hover:bg-white/90"
                  >
                    <CreditCard className="size-4" aria-hidden="true" />
                    Подтвердить бронь
                  </Button>
                </div>
              ) : null}

              <div className="grid gap-3 rounded-lg border border-border bg-secondary/20 p-4 text-sm">
                <MoneyLine label="Студия" value={studio.name} />
                <MoneyLine label="Зал" value={selectedHall?.name ?? "-"} />
                <MoneyLine label="Длительность" value={`${durationHours} ч`} />
                <MoneyLine label="Ставка зала" value={`${formatPrice(selectedHall?.pricePerHour ?? 0)} / час`} />
                <MoneyLine label="Аренда" value={formatPrice(pricing.studioTotal)} />
                <MoneyLine label="Сервисный сбор" value={formatPrice(pricing.platformFeeAmount)} />
                <div className="border-t border-border pt-3">
                  <MoneyLine label="Стоимость услуги" value={formatPrice(pricing.totalServicePrice)} strong />
                </div>
                <MoneyLine label="Остаток студии" value={formatPrice(pricing.providerAmount)} />
              </div>

              <div className="grid gap-3">
                <Field label="Имя" name="clientName" defaultValue={clientDefaults?.name ?? ""} error={fieldErrors.clientName} />
                <Field label="Телефон" name="clientPhone" defaultValue={clientDefaults?.phone ?? ""} error={fieldErrors.clientPhone} />
              </div>

              <label className="flex items-center gap-2 rounded-md border border-border px-3 py-3 text-sm font-medium">
                <input type="checkbox" name="needsEquipment" />
                Нужно оборудование
              </label>

              <div className="grid gap-2">
                <p className="text-sm font-medium">Оборудование и удобства</p>
                <div className="grid gap-2 rounded-md border border-border p-3 sm:grid-cols-2">
                  {[...(selectedHall?.amenities ?? []), ...STUDIO_EQUIPMENT_OPTIONS.map((item) => item.label)]
                    .filter((item, index, array) => array.indexOf(item) === index)
                    .map((label) => (
                      <label key={label} className="flex items-center gap-2 text-sm">
                        <input type="checkbox" name="selectedAmenities" value={label} />
                        {label}
                      </label>
                    ))}
                </div>
              </div>

              <Textarea
                label="Особые требования"
                name="specialRequirements"
                placeholder="Пожелания по залу, свету, реквизиту или таймингу"
                error={fieldErrors.specialRequirements}
                onValidate={validateTextField}
              />

              <p className="inline-flex items-start gap-2 rounded-md bg-secondary px-4 py-3 text-sm text-muted-foreground">
                <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                Контакты студии раскрываются только после оплаты сервисного сбора. Не вставляйте телефон,
                email, ссылки или username в свободные поля.
              </p>
              {hasContactErrors ? <ErrorText error={CONTACT_INFO_ERROR} /> : null}
              {capacityError ? <ErrorText error={capacityError} /> : null}
            </CardContent>
          </Card>
        </section>
      </div>

      <StudioWizardFooter
        currentStep={mobileStep}
        canGoNext={canGoNext}
        isPending={isPending}
        hasContactErrors={hasContactErrors}
        hasBlockingError={Boolean(capacityError) || !selectedHall}
        requiresStudioConfirmation={requiresStudioConfirmation}
        createdBooking={createdBooking}
        onPayDeposit={() => {
          if (createdBooking) router.push(createdBooking.checkoutUrl);
        }}
        onBack={() => setMobileStep((step) => Math.max(step - 1, 0))}
        onNext={() => {
          setMobileStep((step) => Math.min(step + 1, 2));
        }}
      />
    </form>
  );
}

function StudioCard({ studio, selectedHall }: { studio: Studio; selectedHall?: StudioHall }) {
  const imageUrl = selectedHall?.imageUrl || studio.imageUrl;

  return (
    <Card className="min-w-0 overflow-hidden">
      <CardContent className="grid min-w-0 gap-5 p-6">
        <div className="relative aspect-[4/3] overflow-hidden rounded-md bg-secondary">
          {imageUrl ? (
            <Image src={imageUrl} alt={studio.name} fill className="object-cover" />
          ) : (
            <span className="flex size-full items-center justify-center">
              <Building2 className="size-8 text-muted-foreground" aria-hidden="true" />
            </span>
          )}
        </div>
        <div className="grid min-w-0 gap-3">
          <div className="min-w-0">
            <h2 className="break-words text-2xl font-semibold tracking-normal">{studio.name}</h2>
            <div className="mt-2 grid gap-2 text-sm text-muted-foreground">
              <span className="inline-flex min-w-0 items-start gap-1">
                <MapPin className="size-4" aria-hidden="true" />
                <span className="min-w-0 break-words">
                  {studio.city} · {studio.address}
                </span>
              </span>
              <span className="inline-flex items-center gap-1">
                <Users className="size-4" aria-hidden="true" />
                до {selectedHall?.capacity ?? studio.capacity} чел
              </span>
            </div>
          </div>
          <p className="line-clamp-4 break-words text-sm text-muted-foreground">{studio.description}</p>
          {selectedHall ? (
            <p className="break-words text-sm">
              <span className="font-medium">Выбранный зал: </span>
              {selectedHall.name} · {formatPrice(selectedHall.pricePerHour)} / час
            </p>
          ) : null}
          <p className="line-clamp-3 break-words text-sm text-muted-foreground">{studio.rules.join(" ")}</p>
          {studio.address ? (
            <StudioMap
              title={studio.name}
              address={studio.address}
              city={studio.city}
              twoGisUrl={studio.twoGisUrl}
              twoGisEmbedUrl={studio.twoGisEmbedUrl}
              compact
            />
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}

function Select({
  label,
  name,
  options,
  error
}: {
  label: string;
  name: string;
  options: ReadonlyArray<{ value: string; label: string }>;
  error?: string;
}) {
  return (
    <label className="grid gap-2 text-sm font-medium">
      {label}
      <select name={name} className={inputClass} defaultValue="">
        <option value="" disabled>Выберите</option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>{option.label}</option>
        ))}
      </select>
      <ErrorText error={error} />
    </label>
  );
}

function Field({
  label,
  name,
  type = "text",
  defaultValue,
  error
}: {
  label: string;
  name: string;
  type?: string;
  defaultValue?: string;
  error?: string;
}) {
  return (
    <label className="grid gap-2 text-sm font-medium">
      {label}
      <input name={name} type={type} defaultValue={defaultValue} className={inputClass} />
      <ErrorText error={error} />
    </label>
  );
}

function Textarea({
  label,
  name,
  placeholder,
  error,
  required,
  onValidate
}: {
  label: string;
  name: string;
  placeholder: string;
  error?: string;
  required?: boolean;
  onValidate: (name: string, value: string) => void;
}) {
  return (
    <label className="grid gap-2 text-sm font-medium">
      {label}
      <textarea
        name={name}
        required={required}
        placeholder={placeholder}
        onChange={(event) => onValidate(name, event.target.value)}
        className={textareaClass}
      />
      <ErrorText error={error} />
    </label>
  );
}

function MoneyLine({
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

function Notice({ message }: { message: string }) {
  return <p className="rounded-md bg-rose-100 px-4 py-3 text-sm font-medium text-rose-800">{message}</p>;
}

function ErrorText({ error }: { error?: string }) {
  if (!error) return null;
  return <span className="text-xs font-medium text-rose-700">{error}</span>;
}

const studioSteps = [
  { label: "Студия", icon: Building2 },
  { label: "Дата", icon: CalendarDays },
  { label: "Данные", icon: Check }
];

function StudioBookingStepper({ currentStep }: { currentStep: number }) {
  const progressWidth =
    currentStep === 0
      ? "0%"
      : currentStep === studioSteps.length - 1
        ? "calc(100% - 33.333%)"
        : "calc((100% - 33.333%) / 2)";

  return (
    <div className="relative grid grid-cols-3 items-start gap-2">
      <span
        className="pointer-events-none absolute left-[16.666%] right-[16.666%] top-4 h-px bg-border"
        aria-hidden="true"
      />
      <span
        className="pointer-events-none absolute left-[16.666%] top-4 h-px bg-primary/70 transition-[width] duration-300"
        style={{ width: progressWidth }}
        aria-hidden="true"
      />
      {studioSteps.map((step, index) => {
        const Icon = step.icon;
        const isActive = index === currentStep;
        const isDone = index < currentStep;

        return (
          <div key={step.label} className="relative grid justify-items-center gap-2 text-center">
            <span
              className={cn(
                "relative z-10 flex size-8 items-center justify-center rounded-full border bg-background transition-colors",
                isActive && "border-primary text-emerald-300 shadow-[0_0_20px_hsl(var(--primary)/0.16)]",
                isDone && "border-primary bg-primary text-emerald-950"
              )}
            >
              <Icon className="size-4" aria-hidden="true" />
            </span>
            <span
              className={cn(
                "text-xs font-medium text-muted-foreground",
                isActive && "text-foreground",
                isDone && "text-emerald-300"
              )}
            >
              {step.label}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function StudioWizardFooter({
  currentStep,
  canGoNext,
  isPending,
  hasContactErrors,
  hasBlockingError,
  requiresStudioConfirmation,
  createdBooking,
  onPayDeposit,
  onBack,
  onNext
}: {
  currentStep: number;
  canGoNext: boolean;
  isPending: boolean;
  hasContactErrors: boolean;
  hasBlockingError: boolean;
  requiresStudioConfirmation: boolean;
  createdBooking: CreatedBookingState | null;
  onPayDeposit: () => void;
  onBack: () => void;
  onNext: () => void;
}) {
  const isLastStep = currentStep === studioSteps.length - 1;

  return (
    <div className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-background/95 px-4 py-3 backdrop-blur md:static md:border-0 md:bg-transparent md:px-0 md:py-0 md:backdrop-blur-0">
      <div
        className={cn(
          "mx-auto grid max-w-screen-sm gap-3 md:max-w-none md:justify-center",
          currentStep === 0
            ? "grid-cols-1 md:grid-cols-[minmax(220px,300px)]"
            : "grid-cols-[56px_1fr] md:grid-cols-[56px_minmax(220px,300px)]"
        )}
      >
        {currentStep > 0 ? (
          <Button type="button" variant="outline" className="h-12 w-14 shrink-0" onClick={onBack} aria-label="Назад">
            <ArrowLeft className="size-5" aria-hidden="true" />
          </Button>
        ) : null}

        {isLastStep ? (
          <Button
            type={createdBooking ? "button" : "submit"}
            size="lg"
            disabled={isPending || hasContactErrors || hasBlockingError}
            onClick={createdBooking ? onPayDeposit : undefined}
            className="h-12 flex-1"
          >
            <CreditCard className="size-4" aria-hidden="true" />
            {createdBooking
              ? "Подтвердить бронь"
              : isPending
                ? requiresStudioConfirmation
                  ? "Отправляем..."
                  : "Создаем..."
                : requiresStudioConfirmation
                  ? "Отправить заявку студии"
                  : "Создать бронь"}
          </Button>
        ) : (
          <Button type="button" size="lg" disabled={!canGoNext} className="h-12 flex-1" onClick={onNext}>
            Далее
          </Button>
        )}
      </div>
    </div>
  );
}

const inputClass =
  "h-10 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring";

const textareaClass =
  "min-h-28 w-full rounded-md border border-input bg-background p-3 text-sm outline-none focus:ring-2 focus:ring-ring";
