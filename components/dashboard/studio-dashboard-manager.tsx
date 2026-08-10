"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Fragment, useState, useTransition } from "react";
import { Building2, CalendarDays, Check, ChevronDown, ClipboardList, Plus, Save, Trash2 } from "lucide-react";
import {
  createStudioHallWithImageAction,
  deleteStudioHallAction,
  requestStudioFinalPaymentAction,
  deleteStudioHallGalleryImageAction,
  updateStudioBookingStatusAction,
  updateStudioHallAction,
  updateStudioHallImageAction,
  updateStudioProfileAction,
  uploadStudioHallGalleryAction
} from "@/app/dashboard/studio/actions";
import { CalendarDashboard, type CalendarDashboardProps } from "@/components/calendar/calendar-dashboard";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/dashboard/status-badge";
import { SuccessToast } from "@/components/shared/success-toast";
import {
  DashboardSectionTabs,
  type DashboardSectionTab
} from "@/components/dashboard/dashboard-section-tabs";
import { ImageUploadField } from "@/components/uploads/image-upload-field";
import { MultiImageUploadField } from "@/components/uploads/multi-image-upload-field";
import { UploadButton } from "@/components/uploads/upload-button";
import { RENTAL_PURPOSES, getOptionLabel } from "@/lib/booking-options";
import {
  canClientBookingMoveToInProgress,
  isClientBookingBeforeStart
} from "@/lib/bookings/client-status";
import { formatPrice } from "@/lib/mock-data";
import { calculateProviderPayouts } from "@/lib/provider-payouts";
import { cn } from "@/lib/utils";
import type { Booking, StudioProfile } from "@/lib/types";

interface StudioDashboardManagerProps {
  profile: StudioProfile;
  calendar?: CalendarDashboardProps;
  selectedHallId?: string;
  bookings: Booking[];
  databaseReady: boolean;
  initialSection?: StudioSection;
}

type StudioSection = "profile" | "halls" | "schedule" | "bookings";

type ActionState = {
  area: string;
  success: boolean;
  message: string;
} | null;

export function StudioDashboardManager({
  profile,
  calendar,
  selectedHallId,
  bookings,
  databaseReady,
  initialSection = "profile"
}: StudioDashboardManagerProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [state, setState] = useState<ActionState>(null);
  const [activeSection, setActiveSection] = useState<StudioSection>(initialSection);
  const sections: DashboardSectionTab<StudioSection>[] = [
    {
      id: "profile",
      label: "Профиль",
      description: "Данные студии",
      icon: Building2
    },
    {
      id: "halls",
      label: "Залы",
      description: "Пространства и галереи",
      icon: Building2,
      count: profile.halls.length
    },
    {
      id: "schedule",
      label: "Расписание",
      description: "Календарь залов",
      icon: CalendarDays,
      count: calendar?.events.length
    },
    {
      id: "bookings",
      label: "Брони",
      description: "Заявки и оплата",
      icon: ClipboardList,
      count: bookings.length
    }
  ];

  function run(area: string, action: (formData: FormData) => Promise<{ success: boolean; error?: string }>) {
    return (formData: FormData) => {
      setState(null);
      startTransition(async () => {
        const result = await action(formData);
        setState({
          area,
          success: result.success,
          message: result.success ? "Изменения сохранены." : result.error ?? "Ошибка сохранения."
        });
        if (result.success) router.refresh();
      });
    };
  }

  return (
    <div className="grid gap-8">
      {!databaseReady ? (
        <Notice tone="error" message="DATABASE_URL не настроен. CRUD-операции требуют PostgreSQL." />
      ) : null}
      {profile.status === "Draft" ? (
        <Notice message="Профиль студии в draft. Заполните данные и дождитесь approval от администратора." />
      ) : null}

      <DashboardSectionTabs
        value={activeSection}
        onChange={setActiveSection}
        items={sections}
      />

      {activeSection === "profile" ? (
      <Card>
        <CardHeader>
          <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
            <CardTitle>Профиль студии</CardTitle>
            <StatusBadge status={profile.status} />
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid gap-6">
          <form action={run("profile", updateStudioProfileAction)} className="grid gap-6 rounded-lg border border-border p-4 lg:grid-cols-[280px_minmax(0,1fr)]">
            <div className="grid content-start gap-3">
              <ImageUploadField
                name="image"
                label="Обложка студии"
                currentUrl={profile.imageUrl}
                previewAlt={profile.name}
                maxSizeMb={25}
              />
            </div>
            <div className="grid gap-4">
              <Message state={state} area="profile" />
              <div className="grid gap-4 md:grid-cols-2">
                <Field label="Название" name="name" defaultValue={profile.name} />
                <Field label="Город" name="city" defaultValue={profile.city} />
              </div>
              <Field label="Адрес" name="address" defaultValue={profile.address} />
              <Field
                label="Ссылка 2GIS"
                name="twoGisUrl"
                defaultValue={profile.twoGisUrl ?? ""}
                placeholder="Обычная ссылка на карточку или адрес"
              />
              <p className="-mt-2 text-sm text-muted-foreground">
                2GIS открывается по кнопке маршрута. Карта на странице автоматически строится по городу и адресу студии.
              </p>
              <div className="rounded-md border border-border bg-secondary/30 px-4 py-3">
                <p className="text-xs font-medium text-muted-foreground">Диапазон цен по залам</p>
                <p className="mt-1 text-lg font-semibold">{formatHallPriceRange(profile.halls)}</p>
              </div>
              <label className="grid gap-2 text-sm font-medium">
                Описание
                <textarea name="description" defaultValue={profile.description} className={cn(textareaClass, "min-h-40")} />
              </label>
              <label className="grid gap-2 text-sm font-medium">
                Правила аренды
                <textarea name="rules" defaultValue={profile.rules.join("\n")} className={textareaClass} />
              </label>
              <Button disabled={isPending || !databaseReady} className="w-fit">
                <Save className="size-4" aria-hidden="true" />
                Сохранить изменения
              </Button>
            </div>
          </form>
          </div>
        </CardContent>
      </Card>
      ) : null}

      {activeSection === "halls" ? (
      <Card>
        <CardHeader>
          <CardTitle>Залы студии</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-5">
          <form action={run("halls-upload", createStudioHallWithImageAction)} className="grid gap-6 rounded-lg border border-border p-4 lg:grid-cols-[320px_minmax(0,1fr)]">
            <div className="grid content-start gap-3">
              <ImageUploadField name="image" label="Обложка зала" previewAlt="Превью зала" maxSizeMb={25} />
            </div>
            <div className="grid content-start gap-3">
              <Message state={state} area="halls-upload" />
              <div className="grid gap-3 md:grid-cols-2">
                <Field label="Название" name="name" />
                <Field label="Вместимость" name="capacity" type="number" />
                <Field label="Цена/час" name="hourlyRate" type="number" />
                <Field label="Удобства через запятую" name="amenities" />
              </div>
              <label className="grid gap-2 text-sm font-medium">
                Описание
                <textarea name="description" className={cn(textareaClass, "min-h-32")} />
              </label>
              <input type="hidden" name="imageUrl" value="" />
              <input type="hidden" name="status" value="ACTIVE" />
              <UploadButton pending={isPending} disabled={!databaseReady}>
                Добавить зал
              </UploadButton>
            </div>
          </form>

          {profile.halls.length === 0 ? (
            <EmptyText text="Залов пока нет." />
          ) : (
            <div className="grid gap-4">
              {profile.halls.map((hall) => (
                <details
                  key={hall.id ?? hall.name}
                  className="group overflow-hidden rounded-lg border border-border bg-card/60"
                  open={profile.halls.length === 1}
                >
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-3 border-b border-border px-4 py-3 transition-colors hover:bg-white/[0.03] [&::-webkit-details-marker]:hidden">
                    <div className="min-w-0">
                      <p className="truncate text-base font-semibold text-foreground">{hall.name}</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        до {hall.capacity} человек · {formatPrice(hall.pricePerHour)} / час
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <StatusBadge status={hall.status ?? "Active"} />
                      <ChevronDown
                        className="size-5 text-muted-foreground transition-transform group-open:rotate-180"
                        aria-hidden="true"
                      />
                    </div>
                  </summary>

                  <div className="grid gap-4 p-4 lg:grid-cols-[minmax(260px,360px)_minmax(0,1fr)]">
                    <div className="grid content-start gap-3 rounded-md border border-border p-3">
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-sm font-medium text-muted-foreground">Медиа зала</p>
                        <StatusBadge status={hall.status ?? "Active"} />
                      </div>
                      <form action={run(`hall-image-${hall.id}`, updateStudioHallImageAction)} className="grid gap-3">
                        <input type="hidden" name="id" value={hall.id} />
                        <Message state={state} area={`hall-image-${hall.id}`} />
                        <ImageUploadField
                          name="image"
                          label="Заменить обложку зала"
                          currentUrl={hall.imageUrl}
                          previewAlt={hall.name}
                          maxSizeMb={25}
                        />
                        <UploadButton pending={isPending} disabled={!databaseReady}>
                          Загрузить обложку
                        </UploadButton>
                      </form>
                      <HallGalleryManager
                        hall={hall}
                        state={state}
                        run={run}
                        databaseReady={databaseReady}
                        isPending={isPending}
                      />
                    </div>
                    <form action={run(`hall-${hall.id}`, updateStudioHallAction)} className="grid content-start gap-3">
                      <input type="hidden" name="id" value={hall.id} />
                      <Message state={state} area={`hall-${hall.id}`} />
                      <Field label="Название" name="name" defaultValue={hall.name} />
                      <Field label="Описание" name="description" defaultValue={hall.description ?? "Описание зала"} />
                      <input type="hidden" name="imageUrl" value={hall.imageUrl ?? ""} />
                      <div className="grid gap-3 sm:grid-cols-2">
                        <Field label="Вместимость" name="capacity" type="number" defaultValue={String(hall.capacity)} />
                        <Field label="Цена/час" name="hourlyRate" type="number" defaultValue={String(hall.pricePerHour)} />
                      </div>
                      <Field label="Удобства через запятую" name="amenities" defaultValue={(hall.amenities ?? []).join(", ")} />
                      <label className="flex items-center gap-2 text-sm font-medium">
                        <input
                          type="checkbox"
                          name="status"
                          value="ACTIVE"
                          defaultChecked={(hall.status ?? "Active") === "Active"}
                        />
                        Активен
                      </label>
                      <div className="flex flex-wrap gap-2">
                        <Button disabled={isPending || !databaseReady} size="sm" variant="outline">
                          <Check className="size-4" aria-hidden="true" />
                          Сохранить зал
                        </Button>
                        <Button
                          disabled={isPending || !databaseReady}
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            if (!window.confirm("Удалить зал?")) return;
                            const data = new FormData();
                            data.set("id", hall.id ?? "");
                            run("halls", deleteStudioHallAction)(data);
                          }}
                        >
                          <Trash2 className="size-4" aria-hidden="true" />
                          Удалить
                        </Button>
                      </div>
                    </form>
                  </div>
                </details>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
      ) : null}

      {activeSection === "schedule" ? (
      <div className="grid gap-4">
        {profile.halls.length === 0 ? (
          <EmptyText text="Добавьте зал, чтобы управлять расписанием." />
        ) : (
          <>
            <div className="flex flex-wrap gap-2">
              {profile.halls.map((hall) => (
                <Link
                  key={hall.id}
                  href={`/dashboard/studio?section=schedule&hall=${hall.id}&month=${calendar?.monthStart.slice(0, 7) ?? ""}`}
                  className={cn(
                    "relative rounded-md border px-4 py-2 text-sm transition-colors after:absolute after:inset-x-3 after:bottom-0 after:h-0.5 after:bg-primary after:shadow-[0_0_12px_hsl(var(--primary)/0.55)]",
                    hall.id === selectedHallId
                      ? "border-border text-foreground after:scale-x-100"
                      : "border-border text-muted-foreground after:scale-x-0 hover:text-foreground"
                  )}
                >
                  {hall.name}
                </Link>
              ))}
            </div>
            {calendar ? (
              <CalendarDashboard
                {...calendar}
                showBackLink={false}
              />
            ) : null}
          </>
        )}
      </div>
      ) : null}

      {activeSection === "bookings" ? (
      <section>
        <h2 className="mb-4 text-2xl font-semibold tracking-normal">Бронирования студии</h2>
        <BookingStatusTable bookings={bookings} run={run} databaseReady={databaseReady} isPending={isPending} />
      </section>
      ) : null}
    </div>
  );
}

function BookingStatusTable({
  bookings,
  run,
  databaseReady,
  isPending
}: {
  bookings: Booking[];
  run: (area: string, action: (formData: FormData) => Promise<{ success: boolean; error?: string }>) => (formData: FormData) => void;
  databaseReady: boolean;
  isPending: boolean;
}) {
  if (bookings.length === 0) {
    return <EmptyText text="Бронирований пока нет." />;
  }

  return (
    <>
      <div className="grid gap-3 md:hidden">
        {bookings.map((booking) => (
          <MobileBookingCard
            key={booking.id}
            booking={booking}
            disabled={isPending || !databaseReady}
            onSubmit={run("booking", updateStudioBookingStatusAction)}
            onRequestFinal={run("booking", requestStudioFinalPaymentAction)}
          />
        ))}
      </div>
      <div className="hidden overflow-x-auto rounded-lg border border-border bg-card md:block">
        <table className="w-full min-w-[760px] text-left text-sm">
        <thead className="border-b border-border bg-secondary/60 text-muted-foreground">
          <tr>
            <th className="px-4 py-3 font-medium">Бронь</th>
            <th className="px-4 py-3 font-medium">Клиент</th>
            <th className="px-4 py-3 font-medium">Дата</th>
            <th className="px-4 py-3 font-medium">Тип</th>
            <th className="px-4 py-3 font-medium">Суммы</th>
            <th className="px-4 py-3 font-medium">Статус брони</th>
            <th className="px-4 py-3 font-medium">Оплата</th>
            <th className="px-4 py-3 font-medium">Действия</th>
          </tr>
        </thead>
        <tbody>
          {bookings.map((booking) => (
            <Fragment key={booking.id}>
            <tr className="border-b border-border last:border-0">
              <td className="px-4 py-3 font-medium">{booking.id}</td>
              <td className="px-4 py-3">
                <div className="grid gap-1">
                  <span>{booking.clientName}</span>
                    {canShowClientContacts(booking) ? (
                    <span className="text-xs text-muted-foreground">
                      {booking.clientPhone || "-"}
                    </span>
                  ) : (
                    <span className="text-xs text-muted-foreground">Контакты после сервисного сбора</span>
                  )}
                </div>
              </td>
              <td className="px-4 py-3">{booking.date} · {booking.time}</td>
              <td className="px-4 py-3"><StatusBadge status={booking.bookingType ?? "FULL_SHOOT"} /></td>
              <td className="px-4 py-3">
                <BookingAmounts booking={booking} />
              </td>
              <td className="px-4 py-3"><StatusBadge status={booking.status} /></td>
              <td className="px-4 py-3"><StatusBadge status={booking.paymentStatus} /></td>
              <td className="px-4 py-3">
                <StatusActions
                  booking={booking}
                  disabled={isPending || !databaseReady}
                  onSubmit={run("booking", updateStudioBookingStatusAction)}
                  onRequestFinal={run("booking", requestStudioFinalPaymentAction)}
                />
              </td>
            </tr>
            {booking.bookingType === "STUDIO_ONLY" ? (
              <tr className="border-b border-border bg-secondary/30">
                <td className="px-4 py-3" colSpan={8}>
                  <StudioRentalBrief booking={booking} />
                </td>
              </tr>
            ) : null}
            </Fragment>
          ))}
        </tbody>
        </table>
      </div>
    </>
  );
}

function MobileBookingCard({
  booking,
  disabled,
  onSubmit,
  onRequestFinal
}: {
  booking: Booking;
  disabled: boolean;
  onSubmit: (formData: FormData) => void;
  onRequestFinal: (formData: FormData) => void;
}) {
  return (
    <article className="rounded-lg border border-border bg-card p-4 shadow-[0_16px_44px_rgba(0,0,0,0.2)]">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
            Запись {booking.id}
          </p>
          <h3 className="mt-2 text-xl font-semibold tracking-normal">
            {booking.hallName || booking.studioName || "Аренда студии"}
          </h3>
        </div>
        <StatusBadge status={booking.bookingType ?? "STUDIO_ONLY"} />
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <StatusBadge status={booking.status} />
        <StatusBadge status={booking.paymentStatus} />
      </div>

      <div className="mt-4 border-t border-border pt-4 text-sm text-muted-foreground">
        <p className="text-foreground">{booking.date} · {booking.time} · {booking.durationHours} ч</p>
        <p className="mt-2">{booking.clientName}</p>
        {canShowClientContacts(booking) ? (
          <p className="mt-1 text-xs">
            {booking.clientPhone || "-"}
          </p>
        ) : (
          <p className="mt-1 text-xs">Контакты после сервисного сбора</p>
        )}
      </div>

      <div className="mt-4 rounded-md border border-border bg-background/70 p-3">
        <BookingAmounts booking={booking} />
      </div>

      <div className="mt-4">
        <StatusActions
          booking={booking}
          disabled={disabled}
          onSubmit={onSubmit}
          onRequestFinal={onRequestFinal}
        />
      </div>

      {booking.bookingType === "STUDIO_ONLY" ? (
        <div className="mt-4 border-t border-border pt-3">
          <StudioRentalBrief booking={booking} />
        </div>
      ) : null}
    </article>
  );
}

function BookingAmounts({ booking }: { booking: Booking }) {
  const hasPhotographerPart = booking.photographerTotal > 0;
  const payouts = calculateProviderPayouts(booking);
  const hasSeveralProviders = payouts.photographerGross > 0 && payouts.studioGross > 0;

  return (
    <div className="grid gap-1 text-sm">
      {hasPhotographerPart ? (
        <span>Общая услуга: {formatPrice(booking.totalServicePrice ?? booking.totalAmount)}</span>
      ) : null}
      {hasPhotographerPart ? (
        <span className="text-muted-foreground">Фотографу: {formatPrice(booking.photographerTotal)}</span>
      ) : null}
      <span>Студии: {formatPrice(payouts.studioGross)}</span>
      <span className="text-muted-foreground">
        {hasSeveralProviders ? "Сбор платформы всего" : "Сбор платформы"}:{" "}
        {formatPrice(payouts.platformFee)}
      </span>
      {hasSeveralProviders ? (
        <span className="text-muted-foreground">
          Доля сбора студии: {formatPrice(payouts.studioFeeShare)}
        </span>
      ) : null}
      <span className="text-muted-foreground">Оплачено платформе: {formatPrice(booking.paidAmount)}</span>
      <span className="font-medium text-emerald-200">
        К выплате студии: {formatPrice(payouts.studioPayout)}
      </span>
    </div>
  );
}

function StudioRentalBrief({ booking }: { booking: Booking }) {
  return (
    <details>
      <summary className="cursor-pointer text-sm font-medium">Детали аренды</summary>
      <div className="mt-3 grid gap-3 text-sm md:grid-cols-3">
        <RentalItem label="Цель" value={getOptionLabel(RENTAL_PURPOSES, booking.rentalPurpose)} />
        <RentalItem label="Зал" value={booking.hallName} />
        <RentalItem label="Людей" value={booking.peopleCount ? String(booking.peopleCount) : "-"} />
        <RentalItem label="Оборудование" value={booking.needsEquipment ? "Нужно" : "Не нужно"} />
        <RentalItem label="Удобства" value={booking.selectedAmenities?.join(", ") ?? "-"} />
        <RentalItem label="Описание" value={booking.shootDescription ?? "-"} />
        <RentalItem label="Требования" value={booking.specialRequirements ?? "-"} />
      </div>
    </details>
  );
}

function canShowClientContacts(booking: Booking) {
  return (
    (booking.platformFeeStatus === "PAID" ||
      ["DEPOSIT_PAID", "FINAL_PAYMENT_PENDING", "FULLY_PAID"].includes(booking.paymentStatus)) &&
    ["Confirmed", "In progress", "Completed"].includes(booking.status)
  );
}

function HallGalleryManager({
  hall,
  state,
  run,
  databaseReady,
  isPending
}: {
  hall: StudioProfile["halls"][number];
  state: ActionState;
  run: (area: string, action: (formData: FormData) => Promise<{ success: boolean; error?: string }>) => (formData: FormData) => void;
  databaseReady: boolean;
  isPending: boolean;
}) {
  const images = hall.galleryImages ?? [];
  const remainingSlots = Math.max(0, 7 - images.length);

  return (
    <div className="grid gap-3 rounded-md border border-border p-3">
      <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-center">
        <div>
          <p className="text-sm font-semibold">Галерея зала</p>
          <p className="text-xs text-muted-foreground">{images.length}/7 фото</p>
        </div>
      </div>
      <Message state={state} area={`hall-gallery-${hall.id}`} />
      {images.length > 0 ? (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {images.map((image) => (
            <div key={image.id} className="group relative aspect-square overflow-hidden rounded-md border border-border bg-secondary">
              <Image src={image.imageUrl} alt={`${hall.name}, фото галереи`} fill className="object-cover" />
              <button
                type="button"
                disabled={isPending || !databaseReady}
                className="absolute right-2 top-2 inline-flex size-8 items-center justify-center rounded-full bg-background/80 text-foreground opacity-100 backdrop-blur transition hover:bg-background disabled:pointer-events-none disabled:opacity-50 sm:opacity-0 sm:group-hover:opacity-100"
                aria-label="Удалить фото из галереи"
                onClick={() => {
                  if (!window.confirm("Удалить фото из галереи?")) return;
                  const data = new FormData();
                  data.set("imageId", image.id);
                  run(`hall-gallery-${hall.id}`, deleteStudioHallGalleryImageAction)(data);
                }}
              >
                <Trash2 className="size-4" aria-hidden="true" />
              </button>
            </div>
          ))}
        </div>
      ) : (
        <p className="rounded-md border border-dashed border-border p-4 text-sm text-muted-foreground">
          Галерея пока пустая. Добавьте до 7 фото интерьера, света или деталей зала.
        </p>
      )}
      {remainingSlots > 0 ? (
        <form action={run(`hall-gallery-${hall.id}`, uploadStudioHallGalleryAction)} className="grid gap-3">
          <input type="hidden" name="id" value={hall.id} />
          <MultiImageUploadField
            name="images"
            label={`Добавить фото в галерею (${remainingSlots} осталось)`}
            maxFiles={remainingSlots}
            maxSizeMb={25}
          />
          <UploadButton pending={isPending} disabled={!databaseReady}>
            Загрузить в галерею
          </UploadButton>
        </form>
      ) : (
        <p className="text-xs font-medium text-muted-foreground">
          Лимит галереи заполнен. Удалите фото, чтобы добавить новое.
        </p>
      )}
    </div>
  );
}

function RentalItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-border bg-background p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 font-medium">{value}</p>
    </div>
  );
}

function formatHallPriceRange(halls: StudioProfile["halls"]) {
  const prices = halls
    .map((hall) => hall.pricePerHour)
    .filter((price) => Number.isFinite(price) && price > 0);

  if (prices.length === 0) {
    return "Добавьте цены залов";
  }

  const min = Math.min(...prices);
  const max = Math.max(...prices);

  if (min === max) {
    return `${formatPrice(min)} / час`;
  }

  return `${formatPrice(min)} - ${formatPrice(max)} / час`;
}

function StatusActions({
  booking,
  disabled,
  onSubmit,
  onRequestFinal
}: {
  booking: Booking;
  disabled: boolean;
  onSubmit: (formData: FormData) => void;
  onRequestFinal: (formData: FormData) => void;
}) {
  const statuses =
    booking.status === "Pending"
      ? ["CONFIRMED", "DECLINED"]
      : booking.status === "Confirmed"
        ? ["IN_PROGRESS", "CANCELLED"]
        : [];
  const canRequestFinal =
    booking.status === "In progress" &&
    (booking.platformFeeStatus === "PAID" || booking.paymentStatus === "DEPOSIT_PAID");
  const isBeforeStart = isClientBookingBeforeStart(booking);
  const canMoveToInProgress = canClientBookingMoveToInProgress(booking);

  return (
    <div className="grid gap-2">
      {booking.status === "Pending" &&
      booking.platformFeeStatus !== "PAID" &&
      booking.paymentStatus !== "DEPOSIT_PAID" ? (
        <p className="text-xs text-muted-foreground">Нельзя подтвердить бронь до оплаты сервисного сбора.</p>
      ) : null}
      <div className="flex flex-wrap gap-2">
      {statuses.map((status) => (
        <Button
          key={status}
          size="sm"
          variant={status === "CONFIRMED" || status === "IN_PROGRESS" ? "default" : "outline"}
          disabled={
            disabled ||
            (status === "IN_PROGRESS" && !canMoveToInProgress) ||
            (status === "CONFIRMED" &&
              booking.platformFeeStatus !== "PAID" &&
              booking.paymentStatus !== "DEPOSIT_PAID")
          }
          onClick={() => {
            const data = new FormData();
            data.set("bookingId", booking.dbId ?? booking.id);
            data.set("status", status);
            onSubmit(data);
          }}
        >
          {bookingActionLabels[status] ?? status}
        </Button>
      ))}
      {canRequestFinal ? (
        <Button
          size="sm"
          disabled={disabled}
          onClick={() => {
            const data = new FormData();
            data.set("bookingId", booking.dbId ?? booking.id);
            onRequestFinal(data);
          }}
        >
          Работа завершена
        </Button>
      ) : null}
      </div>
      {booking.status === "Confirmed" && isBeforeStart ? (
        <span className="text-xs text-muted-foreground">
          Статус «В работе» станет доступен в дату и время начала брони.
        </span>
      ) : null}
      {booking.paymentStatus === "FINAL_PAYMENT_PENDING" ? (
        <span className="text-xs text-amber-300">Остаток оплачивается напрямую студии.</span>
      ) : null}
      {booking.paymentStatus === "FULLY_PAID" ? (
        <span className="text-xs text-emerald-300">Сервисный сбор оплачен.</span>
      ) : null}
    </div>
  );
}

const bookingActionLabels: Record<string, string> = {
  CONFIRMED: "Подтвердить",
  DECLINED: "Отклонить",
  IN_PROGRESS: "В работе",
  CANCELLED: "Отменить"
};

function Field({
  label,
  name,
  defaultValue = "",
  type = "text",
  placeholder
}: {
  label: string;
  name: string;
  defaultValue?: string;
  type?: string;
  placeholder?: string;
}) {
  return (
    <label className="grid gap-2 text-sm font-medium">
      {label}
      <input name={name} type={type} defaultValue={defaultValue} placeholder={placeholder} className={inputClass} />
    </label>
  );
}

function Message({ state, area }: { state: ActionState; area: string }) {
  if (!state || state.area !== area) return null;
  return state.success ? <SuccessToast message={state.message} /> : <Notice tone="error" message={state.message} />;
}

function Notice({ message, tone = "info" }: { message: string; tone?: "info" | "success" | "error" }) {
  const className =
    tone === "success"
      ? "bg-emerald-100 text-emerald-800"
      : tone === "error"
        ? "bg-rose-100 text-rose-800"
        : "bg-secondary text-secondary-foreground";

  return <p className={`rounded-md px-4 py-3 text-sm font-medium ${className}`}>{message}</p>;
}

function EmptyText({ text }: { text: string }) {
  return (
    <div className="rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
      {text}
    </div>
  );
}

const inputClass =
  "h-10 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring";

const textareaClass =
  "min-h-28 w-full rounded-md border border-input bg-background p-3 text-sm outline-none focus:ring-2 focus:ring-ring";
