"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { AlertCircle, ArrowLeft, Camera, CreditCard, MapPin, Star, UserRound } from "lucide-react";
import { createPhotographerOnlyBookingAction } from "@/app/booking/new/actions";
import {
  EQUIPMENT_OPTIONS,
  LOCATION_TYPES,
  SHOOT_TYPES
} from "@/lib/booking-options";
import { calculateBookingPricing } from "@/lib/pricing";
import {
  CONTACT_INFO_ERROR,
  validateNoContactInfo
} from "@/lib/validation/contact-sanitizer";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SmartSlotPicker } from "@/components/booking/smart-slot-picker";
import { formatPrice, getStyleTitles } from "@/lib/mock-data";
import type { Photographer } from "@/lib/types";

type FieldErrors = Record<string, string>;

interface PhotographerOnlyFormProps {
  photographer?: Photographer;
  clientDefaults?: {
    name?: string | null;
    email?: string | null;
    phone?: string | null;
  };
}

export function PhotographerOnlyForm({
  photographer,
  clientDefaults
}: PhotographerOnlyFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [durationHours, setDurationHours] = useState(2);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const pricing = useMemo(
    () =>
      calculateBookingPricing({
        photographerPrice: photographer?.pricePerHour ?? 0,
        studioPrice: 0,
        durationHours
      }),
    [durationHours, photographer?.pricePerHour]
  );
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
      const result = await createPhotographerOnlyBookingAction(formData);
      if (result.success && result.checkoutUrl) {
        router.push(result.checkoutUrl);
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
    <form action={submit} className="grid gap-6 lg:grid-cols-[1fr_380px]">
      <input type="hidden" name="photographerId" value={photographer.id} />

      <div className="grid gap-6">
        <PhotographerCard photographer={photographer} />

        <Card>
          <CardHeader>
            <CardTitle>Бриф съемки</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-5">
            {formError ? <Notice tone="error" message={formError} /> : null}
            <Select label="Тип съемки" name="shootType" options={SHOOT_TYPES} error={fieldErrors.shootType} />

            <Textarea
              label="Описание съемки"
              name="shootDescription"
              placeholder="Опишите, что нужно снять, сколько кадров ожидаете, какой стиль вам нравится"
              error={fieldErrors.shootDescription}
              onValidate={validateTextField}
              required
            />

            <div className="grid gap-4 md:grid-cols-2">
              <Select
                label="Локация"
                name="locationType"
                options={LOCATION_TYPES}
                error={fieldErrors.locationType}
              />
              <Field label="Город" name="city" defaultValue="Алматы" error={fieldErrors.city} />
              <Field label="Район" name="district" placeholder="Бостандыкский" />
              <Field label="Количество людей" name="peopleCount" type="number" min={1} max={100} defaultValue="1" error={fieldErrors.peopleCount} />
            </div>

            <Textarea
              label="Детали адреса"
              name="addressDetails"
              placeholder="Район, ориентир, формат площадки. Точный адрес будет доступен фотографу после оплаты депозита."
              error={fieldErrors.addressDetails}
              onValidate={validateTextField}
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
              <SmartSlotPicker
                bookingType="PHOTOGRAPHER_ONLY"
                photographerId={photographer.id}
                durationHours={durationHours}
                dateError={fieldErrors.date}
                timeError={fieldErrors.startTime}
              />
            </div>

            <div className="grid gap-2">
              <p className="text-sm font-medium">Оборудование</p>
              <div className="grid gap-2 rounded-md border border-border p-3 sm:grid-cols-2">
                {EQUIPMENT_OPTIONS.map((option, index) => (
                  <label key={option.value} className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      name="equipmentNeeded"
                      value={option.value}
                      defaultChecked={index === 0}
                    />
                    {option.label}
                  </label>
                ))}
              </div>
            </div>

            <Textarea
              label="Особые требования"
              name="specialRequirements"
              placeholder="Тайминг, ограничения площадки, пожелания по свету или реквизиту"
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
              Контакты фотографа и клиента раскрываются только после оплаты депозита. Не вставляйте телефон,
              email, ссылки или username в свободные поля.
            </p>
            <p className="sr-only">
              TODO: Позже можно добавить controlled Q&A flow без свободного чата: фотограф
              запрашивает уточнение через structured questions, клиент отвечает через форму,
              contact sanitizer применяется ко всем текстовым ответам.
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
            <MoneyLine label="Ставка фотографа" value={`${formatPrice(photographer.pricePerHour)} / час`} />
            <MoneyLine label="Длительность" value={`${durationHours} ч`} />
            <MoneyLine label="Фотограф" value={formatPrice(pricing.photographerTotal)} />
            <MoneyLine label="Сервисный сбор" value={formatPrice(pricing.serviceFee)} />
            <div className="border-t border-border pt-4">
              <MoneyLine label="Общая сумма" value={formatPrice(pricing.totalPrice)} strong />
            </div>
            <MoneyLine label="Депозит" value={formatPrice(pricing.depositAmount)} />
            <MoneyLine label="Остаток" value={formatPrice(pricing.remainingAmount)} />
            <Button
              size="lg"
              disabled={isPending || hasContactErrors}
              className="w-full"
            >
              <CreditCard className="size-4" aria-hidden="true" />
              {isPending ? "Создаем бронь..." : "Оплатить депозит"}
            </Button>
            {hasContactErrors ? <ErrorText error={CONTACT_INFO_ERROR} /> : null}
          </CardContent>
        </Card>

        <Button asChild variant="outline">
          <Link href="/photographers?mode=booking">
            <ArrowLeft className="size-4" aria-hidden="true" />
            Вернуться к выбору
          </Link>
        </Button>
      </aside>
    </form>
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
            {getStyleTitles(photographer.specializationIds).join(", ") || "Разные направления"}
          </p>
          <div className="grid grid-cols-3 gap-2">
            {photographer.portfolio.slice(0, 3).map((imageUrl, index) => (
              <div key={`${imageUrl}-${index}`} className="relative aspect-[4/3] overflow-hidden rounded-md bg-secondary">
                <Image src={imageUrl} alt={`${photographer.name} portfolio ${index + 1}`} fill className="object-cover" />
              </div>
            ))}
          </div>
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
  max
}: {
  label: string;
  name: string;
  type?: string;
  placeholder?: string;
  defaultValue?: string;
  error?: string;
  min?: number;
  max?: number;
}) {
  return (
    <label className="grid gap-2 text-sm font-medium">
      {label}
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
