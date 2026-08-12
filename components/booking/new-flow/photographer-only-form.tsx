"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { type ChangeEvent, type FormEvent, useCallback, useMemo, useState, useTransition } from "react";
import {
  AlertCircle,
  ArrowLeft,
  CalendarDays,
  Camera,
  Check,
  CreditCard,
  MapPin,
  Star,
  UserRound
} from "lucide-react";
import { createPhotographerOnlyBookingAction } from "@/app/booking/new/actions";
import {
  EQUIPMENT_OPTIONS,
  LOCATION_TYPES,
  SHOOT_TYPES
} from "@/lib/booking-options";
import { calculateBookingPricing, calculatePhotographerServicePricing } from "@/lib/pricing";
import { formatServiceDuration } from "@/lib/photographer-services";
import {
  CONTACT_INFO_ERROR,
  validateNoContactInfo
} from "@/lib/validation/contact-sanitizer";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SmartSlotPicker } from "@/components/booking/smart-slot-picker";
import { formatPrice, getPhotographerStyleTitles } from "@/lib/mock-data";
import { cn } from "@/lib/utils";
import type { Photographer, PhotographerService } from "@/lib/types";

type FieldErrors = Record<string, string>;
type CreatedBookingState = {
  bookingNumber: string;
  checkoutUrl: string;
};

interface PhotographerOnlyFormProps {
  photographer?: Photographer;
  service?: PhotographerService;
  clientDefaults?: {
    name?: string | null;
    phone?: string | null;
  };
}

export function PhotographerOnlyForm({
  photographer,
  service,
  clientDefaults
}: PhotographerOnlyFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [shootType, setShootType] = useState("");
  const [locationType, setLocationType] = useState("");
  const [equipmentNeeded, setEquipmentNeeded] = useState<string[]>(["NO_SPECIAL_EQUIPMENT"]);
  const [durationMode, setDurationMode] = useState("2");
  const [customDurationHours, setCustomDurationHours] = useState("6");
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [hasSubmitAttempt, setHasSubmitAttempt] = useState(false);
  const [createdBooking, setCreatedBooking] = useState<CreatedBookingState | null>(null);
  const [mobileStep, setMobileStep] = useState(0);
  const [mobileSlot, setMobileSlot] = useState({ date: "", startTime: "" });
  const legacyDurationHours = useMemo(() => {
    const value = Number(durationMode === "CUSTOM" ? customDurationHours : durationMode);
    return Number.isFinite(value) && value > 0 ? value : 0;
  }, [customDurationHours, durationMode]);
  const durationMinutes = service?.durationMinutes ?? legacyDurationHours * 60;
  const durationHours = Math.max(1, Math.ceil(durationMinutes / 60));
  const photographerLocationTypes = useMemo(
    () => LOCATION_TYPES.filter((option) => option.value !== "NEED_STUDIO_HELP"),
    []
  );
  const pricing = useMemo(
    () =>
      service
        ? calculatePhotographerServicePricing(service.price)
        : calculateBookingPricing({
            bookingType: "PHOTOGRAPHER_ONLY",
            photographerPrice: photographer?.pricePerHour ?? 0,
            studioPrice: 0,
            durationHours
          }),
    [durationHours, photographer?.pricePerHour, service]
  );
  const hasContactErrors = Object.values(fieldErrors).some((error) => error === CONTACT_INFO_ERROR);
  const canGoNext = mobileStep !== 1 || Boolean(mobileSlot.date && mobileSlot.startTime);
  const clearFormError = useCallback(() => {
    setFormError(null);
    setHasSubmitAttempt(false);
  }, []);
  const handleMobileSlotChange = useCallback((date: string, startTime: string) => {
    clearFormError();
    setMobileSlot((current) => {
      if (current.date === date && current.startTime === startTime) {
        return current;
      }

      return { date, startTime };
    });
  }, [clearFormError]);
  const handleEquipmentChange = useCallback((value: string, checked: boolean) => {
    setEquipmentNeeded((current) => {
      if (checked) {
        return current.includes(value) ? current : [...current, value];
      }

      return current.filter((item) => item !== value);
    });
  }, []);

  function validateTextField(name: string, value: string) {
    clearFormError();
    const result = validateNoContactInfo(value);
    setFieldErrors((current) => {
      const next = { ...current };
      if (result.valid) delete next[name];
      else next[name] = result.error!;
      return next;
    });
  }

  function handleFormSubmit(event: FormEvent<HTMLFormElement>) {
    if (mobileStep !== mobileSteps.length - 1) {
      event.preventDefault();
      return;
    }

    setHasSubmitAttempt(true);
  }

  function submit(formData: FormData) {
    setFormError(null);
    setFieldErrors({});
    setCreatedBooking(null);
    startTransition(async () => {
      const result = await createPhotographerOnlyBookingAction(formData);
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

  if (!photographer) {
    return (
      <Card>
        <CardContent className="grid gap-4 p-8 text-center">
          <div className="mx-auto flex size-12 items-center justify-center rounded-md bg-secondary">
            <UserRound className="size-6" aria-hidden="true" />
          </div>
          <div>
            <h2 className="text-2xl font-semibold tracking-normal">Сначала выберите фотографа</h2>
            <p className="mt-2 text-muted-foreground">
              Заявка создается под конкретного специалиста, чтобы правильно посчитать стоимость.
            </p>
          </div>
          <Button asChild className="mx-auto w-fit">
            <Link href="/photographers?mode=booking">Перейти к фотографам</Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <form
      action={submit}
      onSubmit={handleFormSubmit}
      onChange={clearFormError}
      className="grid gap-6"
    >
      <input type="hidden" name="photographerId" value={photographer.id} />
      {service ? <input type="hidden" name="serviceId" value={service.id} /> : null}

      <div className="sticky top-16 z-20 -mx-4 border-y border-border bg-background/95 px-4 py-4 backdrop-blur sm:-mx-6 sm:px-6 md:static md:mx-0 md:rounded-xl md:border md:bg-card/70 md:px-8">
        <MobileBookingStepper currentStep={mobileStep} />
      </div>

      <div className="grid min-h-[calc(100svh-230px)] gap-4 pb-28 pt-2 md:min-h-0 md:pb-0">
        {hasSubmitAttempt && formError ? <Notice tone="error" message={formError} /> : null}

        <section className={cn("grid gap-4 lg:grid-cols-[320px_minmax(0,1fr)]", mobileStep !== 0 && "hidden")}>
          <MobilePhotographerSummary photographer={photographer} />

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-xl">Детали съемки</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4">
              <Select
                label="Тип съемки"
                name="shootType"
                options={SHOOT_TYPES}
                value={shootType}
                onChange={setShootType}
                error={fieldErrors.shootType}
                required
              />

              {shootType === "OTHER" ? (
                <Field
                  label="Уточните тип съемки"
                  name="customShootType"
                  placeholder="Например: спорт, выпускной, авто"
                  error={fieldErrors.customShootType}
                  required
                />
              ) : null}

              <Textarea
                label="Описание"
                name="shootDescription"
                placeholder="Что снимаем, какой результат нужен, референсы по настроению"
                error={fieldErrors.shootDescription}
                onValidate={validateTextField}
                required
              />

              <div className="grid grid-cols-2 gap-3">
                <Select
                  label="Локация"
                  name="locationType"
                  options={photographerLocationTypes}
                  value={locationType}
                  onChange={setLocationType}
                  error={fieldErrors.locationType}
                  required
                />
                <Field label="Город" name="city" defaultValue="Алматы" error={fieldErrors.city} required />
              </div>

              {locationType === "OTHER" ? (
                <Field
                  label="Уточните локацию"
                  name="customLocationType"
                  placeholder="Например: загородный дом, шоурум, парковка"
                  error={fieldErrors.customLocationType}
                  required
                />
              ) : null}

              <div className="grid grid-cols-2 gap-3">
                <Field label="Район" name="district" placeholder="Бостандык" />
                <Field
                  label="Людей"
                  name="peopleCount"
                  type="number"
                  min={1}
                  max={100}
                  defaultValue="1"
                  error={fieldErrors.peopleCount}
                  required
                />
              </div>

              {service ? (
                <div className="rounded-lg border border-primary/30 bg-primary/[0.06] p-4 text-sm">
                  <p className="font-semibold">{service.title}</p>
                  <p className="mt-1 text-muted-foreground">{formatServiceDuration(service.durationMinutes)} · {formatPrice(service.price)}</p>
                </div>
              ) : (
              <label className="grid gap-2 text-sm font-medium">
                <RequiredLabel label="Длительность" required />
                <select
                  name="durationHours"
                  value={durationMode}
                  onChange={(event) => setDurationMode(event.target.value)}
                  className={inputClass}
                >
                  {[1, 2, 3, 4].map((hours) => (
                    <option key={hours} value={hours}>
                      {`${hours} ${hours === 1 ? "час" : "часа"}`}
                    </option>
                  ))}
                  <option value="CUSTOM">5+ часов</option>
                </select>
                <ErrorText error={fieldErrors.durationHours} />
              </label>
              )}

              {!service && durationMode === "CUSTOM" ? (
                <label className="grid gap-2 text-sm font-medium">
                  <RequiredLabel label="Сколько часов" required />
                  <input
                    name="customDurationHours"
                    type="number"
                    min={5}
                    max={24}
                    step={1}
                    value={customDurationHours}
                    onChange={(event) => setCustomDurationHours(event.target.value)}
                    placeholder="Например, 6"
                    className={inputClass}
                  />
                  <ErrorText error={fieldErrors.customDurationHours} />
                </label>
              ) : null}
            </CardContent>
          </Card>
        </section>

        <section className={cn("grid gap-4", mobileStep !== 1 && "hidden")}>
          <Card className="overflow-hidden">
            <CardHeader className="pb-3">
              <CardTitle className="text-xl">Дата и время</CardTitle>
            </CardHeader>
            <CardContent>
              <SmartSlotPicker
                bookingType="PHOTOGRAPHER_ONLY"
                photographerId={photographer.id}
                photographerServiceId={service?.id}
                durationMinutes={durationMinutes}
                dateError={fieldErrors.date}
                timeError={fieldErrors.startTime}
                onSelectionChange={handleMobileSlotChange}
                presentation="split"
              />
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
                      Теперь можно оплатить сервисный сбор. Если закрыть страницу, кнопка оплаты останется
                      в личном кабинете.
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
                <MoneyLine label="Фотограф" value={photographer.name} />
                {service ? <MoneyLine label="Услуга" value={service.title} /> : null}
                <MoneyLine label="Длительность" value={formatServiceDuration(durationMinutes)} />
                <MoneyLine label="Стоимость услуги" value={formatPrice(pricing.totalServicePrice)} strong />
                <MoneyLine label="Сервисный сбор" value={formatPrice(pricing.platformFeeAmount)} />
                <MoneyLine label="Остаток исполнителю" value={formatPrice(pricing.providerAmount)} />
              </div>

              <div className="grid gap-3">
                <Field label="Имя" name="clientName" defaultValue={clientDefaults?.name ?? ""} error={fieldErrors.clientName} required />
                <Field label="Телефон" name="clientPhone" defaultValue={clientDefaults?.phone ?? ""} error={fieldErrors.clientPhone} required />
              </div>

              <Textarea
                label="Точный адрес и комментарии"
                name="addressDetails"
                placeholder="Улица, дом, подъезд, ориентир, формат площадки"
                error={fieldErrors.addressDetails}
                onValidate={validateTextField}
                required
              />

              <Textarea
                label="Особые требования"
                name="specialRequirements"
                placeholder="Пожелания по свету, реквизиту, таймингу"
                error={fieldErrors.specialRequirements}
                onValidate={validateTextField}
              />

              <div className="grid gap-2">
                <p className="text-sm font-medium">Оборудование</p>
                <div className="grid gap-2 rounded-md border border-border p-3">
                  {EQUIPMENT_OPTIONS.map((option) => (
                    <label key={option.value} className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        name="equipmentNeeded"
                        value={option.value}
                        checked={equipmentNeeded.includes(option.value)}
                        onChange={(event) => handleEquipmentChange(option.value, event.target.checked)}
                      />
                      {option.label}
                    </label>
                  ))}
                </div>
                {equipmentNeeded.includes("OTHER") ? (
                  <Field
                    label="Уточните оборудование"
                    name="customEquipmentNeeded"
                    placeholder="Например: дым-машина, проектор, стойки"
                    error={fieldErrors.customEquipmentNeeded}
                    required
                  />
                ) : null}
              </div>

              <p className="inline-flex items-start gap-2 rounded-md bg-secondary px-4 py-3 text-sm text-muted-foreground">
                <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                Контакты фотографа и клиента раскроются после оплаты сервисного сбора.
              </p>
              {hasContactErrors ? <ErrorText error={CONTACT_INFO_ERROR} /> : null}
            </CardContent>
          </Card>
        </section>
      </div>

      <MobileWizardFooter
        currentStep={mobileStep}
        canGoNext={canGoNext}
        isPending={isPending}
        hasContactErrors={hasContactErrors}
        createdBooking={createdBooking}
        onPayDeposit={() => {
          if (createdBooking) router.push(createdBooking.checkoutUrl);
        }}
        onBack={() => {
          clearFormError();
          setMobileStep((step) => Math.max(step - 1, 0));
        }}
        onNext={() => {
          clearFormError();
          setMobileStep((step) => Math.min(step + 1, 2));
        }}
      />
    </form>
  );
}

const mobileSteps = [
  { label: "Фотограф", icon: UserRound },
  { label: "Дата", icon: CalendarDays },
  { label: "Данные", icon: Check }
];

function MobileBookingStepper({ currentStep }: { currentStep: number }) {
  const progressWidth =
    currentStep === 0
      ? "0%"
      : currentStep === mobileSteps.length - 1
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
      {mobileSteps.map((step, index) => {
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

function MobilePhotographerSummary({ photographer }: { photographer: Photographer }) {
  return (
    <div className="grid grid-cols-[72px_1fr] gap-3 rounded-xl border border-border bg-card p-3">
      <div className="relative aspect-square overflow-hidden rounded-lg bg-secondary">
        {photographer.imageUrl ? (
          <Image
            src={photographer.imageUrl}
            alt={photographer.name}
            fill
            priority
            className="object-cover"
          />
        ) : (
          <span className="flex size-full items-center justify-center">
            <Camera className="size-6 text-muted-foreground" aria-hidden="true" />
          </span>
        )}
      </div>
      <div className="min-w-0">
        <h2 className="truncate text-lg font-semibold">{photographer.name}</h2>
        <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1">
            <MapPin className="size-3.5" aria-hidden="true" />
            {photographer.city}
          </span>
          <span className="inline-flex items-center gap-1">
            <Star className="size-3.5" aria-hidden="true" />
            {photographer.rating}
          </span>
        </div>
        <p className="mt-2 text-sm font-medium">{formatPrice(photographer.pricePerHour)} / час</p>
      </div>
    </div>
  );
}

function MobileWizardFooter({
  currentStep,
  canGoNext,
  isPending,
  hasContactErrors,
  createdBooking,
  onPayDeposit,
  onBack,
  onNext
}: {
  currentStep: number;
  canGoNext: boolean;
  isPending: boolean;
  hasContactErrors: boolean;
  createdBooking: CreatedBookingState | null;
  onPayDeposit: () => void;
  onBack: () => void;
  onNext: () => void;
}) {
  const isLastStep = currentStep === mobileSteps.length - 1;

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
          <Button
            type="button"
            variant="outline"
            className="h-12 w-14 shrink-0"
            onClick={onBack}
            aria-label="Назад"
          >
            <ArrowLeft className="size-5" aria-hidden="true" />
          </Button>
        ) : null}

        {isLastStep ? (
          <Button
            type={createdBooking ? "button" : "submit"}
            size="lg"
            disabled={isPending || hasContactErrors}
            onClick={createdBooking ? onPayDeposit : undefined}
            className="h-12 flex-1"
          >
            <CreditCard className="size-4" aria-hidden="true" />
            {createdBooking ? "Подтвердить бронь" : isPending ? "Создаем..." : "Создать бронь"}
          </Button>
        ) : (
          <Button
            type="button"
            size="lg"
            disabled={!canGoNext}
            className="h-12 flex-1"
            onClick={onNext}
          >
            Далее
          </Button>
        )}
      </div>
    </div>
  );
}

function PhotographerCard({ photographer }: { photographer: Photographer }) {
  return (
    <Card>
      <CardContent className="grid gap-5 p-6 md:grid-cols-[160px_1fr]">
        <div className="relative aspect-square overflow-hidden rounded-md bg-secondary">
          {photographer.imageUrl ? (
            <Image
              src={photographer.imageUrl}
              alt={photographer.name}
              fill
              priority
              className="object-cover"
            />
          ) : (
            <span className="flex size-full items-center justify-center">
              <Camera className="size-8 text-muted-foreground" aria-hidden="true" />
            </span>
          )}
        </div>
        <div className="grid gap-3">
          <div>
            <h2 className="text-2xl font-semibold tracking-normal">{photographer.name}</h2>
            <div className="mt-2 flex flex-wrap gap-3 text-sm text-muted-foreground">
              <span className="inline-flex items-center gap-1">
                <MapPin className="size-4" aria-hidden="true" />
                {photographer.city}
              </span>
              <span className="inline-flex items-center gap-1">
                <Star className="size-4" aria-hidden="true" />
                {photographer.rating}
              </span>
              <span>{formatPrice(photographer.pricePerHour)} / час</span>
            </div>
          </div>
          <p className="text-sm text-muted-foreground">{photographer.bio}</p>
          <p className="text-sm">
            <span className="font-medium">Стили: </span>
            {getPhotographerStyleTitles(photographer).join(", ") || "Разные направления"}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

function Select({
  label,
  name,
  options,
  value,
  onChange,
  error,
  required
}: {
  label: string;
  name: string;
  options: ReadonlyArray<{ value: string; label: string }>;
  value?: string;
  onChange?: (value: string) => void;
  error?: string;
  required?: boolean;
}) {
  const selectProps =
    value === undefined
      ? { defaultValue: "" }
      : {
          value,
          onChange: (event: ChangeEvent<HTMLSelectElement>) => onChange?.(event.target.value)
        };

  return (
    <label className="grid gap-2 text-sm font-medium">
      <RequiredLabel label={label} required={required} />
      <select name={name} className={inputClass} {...selectProps}>
        <option value="" disabled>Выберите</option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
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
  placeholder,
  defaultValue,
  error,
  min,
  max,
  required
}: {
  label: string;
  name: string;
  type?: string;
  placeholder?: string;
  defaultValue?: string;
  error?: string;
  min?: number;
  max?: number;
  required?: boolean;
}) {
  return (
    <label className="grid gap-2 text-sm font-medium">
      <RequiredLabel label={label} required={required} />
      <input
        name={name}
        type={type}
        placeholder={placeholder}
        defaultValue={defaultValue}
        min={min}
        max={max}
        className={inputClass}
      />
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
      <RequiredLabel label={label} required={required} />
      <textarea
        name={name}
        placeholder={placeholder}
        onChange={(event) => onValidate(name, event.target.value)}
        className={textareaClass}
      />
      <ErrorText error={error} />
    </label>
  );
}

function RequiredLabel({ label, required }: { label: string; required?: boolean }) {
  return (
    <span>
      {label}
      {required ? <span className="text-emerald-300"> *</span> : null}
    </span>
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

function Notice({ message }: { message: string; tone: "error" }) {
  return <p className="rounded-md bg-rose-100 px-4 py-3 text-sm font-medium text-rose-800">{message}</p>;
}

function ErrorText({ error }: { error?: string }) {
  if (!error) return null;
  return <span className="text-xs font-medium text-rose-700">{error}</span>;
}

const inputClass =
  "h-10 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring";

const textareaClass =
  "min-h-28 w-full rounded-md border border-input bg-background p-3 text-sm outline-none focus:ring-2 focus:ring-ring";
