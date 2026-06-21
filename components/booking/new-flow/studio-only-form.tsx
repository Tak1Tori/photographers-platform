"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { AlertCircle, ArrowLeft, Building2, CreditCard, MapPin, Users } from "lucide-react";
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
import { formatPrice } from "@/lib/mock-data";
import type { Studio, StudioHall } from "@/lib/types";

type FieldErrors = Record<string, string>;

interface StudioOnlyFormProps {
  studio?: Studio;
  hall?: StudioHall;
  clientDefaults?: {
    name?: string | null;
    email?: string | null;
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
  const pricing = useMemo(
    () =>
      calculateBookingPricing({
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
    startTransition(async () => {
      const result = await createStudioOnlyBookingAction(formData);
      if (result.success && result.checkoutUrl) {
        router.push(result.checkoutUrl);
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
    <form action={submit} className="grid gap-6 lg:grid-cols-[1fr_380px]">
      <input type="hidden" name="studioId" value={studio.id} />
      <input type="hidden" name="studioHallId" value={selectedHall?.id ?? ""} />
      <input type="hidden" name="selectedHallCapacity" value={selectedHall?.capacity ?? 0} />

      <div className="grid gap-6">
        <StudioCard studio={studio} selectedHall={selectedHall} />

        <Card>
          <CardHeader>
            <CardTitle>Детали аренды</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-5">
            {formError ? <Notice message={formError} /> : null}
            <div className="grid gap-3">
              <p className="text-sm font-medium">Выбор зала</p>
              <div className="grid gap-3 md:grid-cols-2">
                {activeHalls.map((item) => (
                  <label
                    key={item.id ?? item.name}
                    className={`grid cursor-pointer gap-2 rounded-lg border p-4 text-sm ${
                      selectedHall?.id === item.id ? "border-foreground bg-secondary" : "border-border"
                    }`}
                  >
                    <input
                      type="radio"
                      className="sr-only"
                      checked={selectedHall?.id === item.id}
                      onChange={() => {
                        setSelectedHallId(item.id ?? "");
                        setPeopleCount((current) => Math.min(current, item.capacity));
                      }}
                    />
                    <span className="font-semibold">{item.name}</span>
                    <span className="text-muted-foreground">{item.capacity} чел · {formatPrice(item.pricePerHour)} / час</span>
                    <span className="text-muted-foreground">{(item.amenities ?? []).join(", ") || "Базовые удобства"}</span>
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

            <div className="grid gap-4">
              <label className="grid max-w-xs gap-2 text-sm font-medium">
                Длительность
                <select
                  name="durationHours"
                  value={durationHours}
                  onChange={(event) => setDurationHours(Number(event.target.value))}
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
              {selectedHall?.id ? (
                <SmartSlotPicker
                  bookingType="STUDIO_ONLY"
                  studioHallId={selectedHall.id}
                  durationHours={durationHours}
                  dateError={fieldErrors.date}
                  timeError={fieldErrors.startTime}
                />
              ) : null}
            </div>

            <div className="grid gap-4 md:grid-cols-2">
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
              <label className="flex items-center gap-2 rounded-md border border-border px-3 py-2 text-sm font-medium">
                <input type="checkbox" name="needsEquipment" />
                Нужно оборудование
              </label>
            </div>

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

            <div className="grid gap-4 rounded-lg border border-border p-4 md:grid-cols-3">
              <Field label="Имя" name="clientName" defaultValue={clientDefaults?.name ?? ""} error={fieldErrors.clientName} />
              <Field label="Телефон" name="clientPhone" defaultValue={clientDefaults?.phone ?? ""} error={fieldErrors.clientPhone} />
              <Field label="Email" name="clientEmail" type="email" defaultValue={clientDefaults?.email ?? ""} error={fieldErrors.clientEmail} />
            </div>

            <p className="inline-flex items-start gap-2 rounded-md bg-secondary px-4 py-3 text-sm text-muted-foreground">
              <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
              Контакты студии раскрываются только после оплаты депозита. Не вставляйте телефон,
              email, ссылки или username в свободные поля.
            </p>
          </CardContent>
        </Card>
      </div>

      <aside className="grid h-fit gap-4 lg:sticky lg:top-24">
        <Card>
          <CardHeader>
            <CardTitle>Стоимость</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 text-sm">
            <MoneyLine label="Зал" value={selectedHall?.name ?? "-"} />
            <MoneyLine label="Ставка зала" value={`${formatPrice(selectedHall?.pricePerHour ?? 0)} / час`} />
            <MoneyLine label="Длительность" value={`${durationHours} ч`} />
            <MoneyLine label="Студия" value={formatPrice(pricing.studioTotal)} />
            <MoneyLine label="Сервисный сбор" value={formatPrice(pricing.serviceFee)} />
            <div className="border-t border-border pt-4">
              <MoneyLine label="Общая сумма" value={formatPrice(pricing.totalPrice)} strong />
            </div>
            <MoneyLine label="Депозит" value={formatPrice(pricing.depositAmount)} />
            <MoneyLine label="Остаток" value={formatPrice(pricing.remainingAmount)} />
            <Button
              size="lg"
              disabled={isPending || hasContactErrors || Boolean(capacityError) || !selectedHall}
              className="w-full"
            >
              <CreditCard className="size-4" aria-hidden="true" />
              {isPending ? "Создаем бронь..." : "Оплатить депозит"}
            </Button>
            {hasContactErrors ? <ErrorText error={CONTACT_INFO_ERROR} /> : null}
            {capacityError ? <ErrorText error={capacityError} /> : null}
          </CardContent>
        </Card>

        <Button asChild variant="outline">
          <Link href="/studios?mode=booking">
            <ArrowLeft className="size-4" aria-hidden="true" />
            Вернуться к выбору
          </Link>
        </Button>
      </aside>
    </form>
  );
}

function StudioCard({ studio, selectedHall }: { studio: Studio; selectedHall?: StudioHall }) {
  const imageUrl = selectedHall?.imageUrl || studio.imageUrl;

  return (
    <Card>
      <CardContent className="grid gap-5 p-6 md:grid-cols-[220px_1fr]">
        <div className="relative aspect-[4/3] overflow-hidden rounded-md bg-secondary">
          {imageUrl ? (
            <Image src={imageUrl} alt={studio.name} fill className="object-cover" />
          ) : (
            <span className="flex size-full items-center justify-center">
              <Building2 className="size-8 text-muted-foreground" aria-hidden="true" />
            </span>
          )}
        </div>
        <div className="grid gap-3">
          <div>
            <h2 className="text-2xl font-semibold tracking-normal">{studio.name}</h2>
            <div className="mt-2 flex flex-wrap gap-3 text-sm text-muted-foreground">
              <span className="inline-flex items-center gap-1">
                <MapPin className="size-4" aria-hidden="true" />
                {studio.city} · {studio.address}
              </span>
              <span className="inline-flex items-center gap-1">
                <Users className="size-4" aria-hidden="true" />
                до {selectedHall?.capacity ?? studio.capacity} чел
              </span>
            </div>
          </div>
          <p className="text-sm text-muted-foreground">{studio.description}</p>
          {selectedHall ? (
            <p className="text-sm">
              <span className="font-medium">Выбранный зал: </span>
              {selectedHall.name} · {formatPrice(selectedHall.pricePerHour)} / час
            </p>
          ) : null}
          <p className="text-sm text-muted-foreground">{studio.rules.join(" ")}</p>
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

const inputClass =
  "h-10 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring";

const textareaClass =
  "min-h-28 w-full rounded-md border border-input bg-background p-3 text-sm outline-none focus:ring-2 focus:ring-ring";
