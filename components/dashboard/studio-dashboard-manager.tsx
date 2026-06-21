"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { Fragment, useState, useTransition } from "react";
import { Building2, CalendarDays, Check, ClipboardList, Plus, Save, Trash2 } from "lucide-react";
import {
  createStudioAvailabilitySlotAction,
  createStudioHallAction,
  createStudioHallWithImageAction,
  deleteStudioAvailabilitySlotAction,
  deleteStudioHallAction,
  requestStudioFinalPaymentAction,
  updateStudioAvailabilitySlotAction,
  updateStudioBookingStatusAction,
  updateStudioHallAction,
  updateStudioHallImageAction,
  updateStudioProfileAction,
  uploadStudioImageAction
} from "@/app/dashboard/studio/actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/dashboard/status-badge";
import {
  DashboardSectionTabs,
  type DashboardSectionTab
} from "@/components/dashboard/dashboard-section-tabs";
import { ImagePreview } from "@/components/uploads/image-preview";
import { ImageUploadField } from "@/components/uploads/image-upload-field";
import { UploadButton } from "@/components/uploads/upload-button";
import { RENTAL_PURPOSES, getOptionLabel } from "@/lib/booking-options";
import { formatPrice } from "@/lib/mock-data";
import type { Booking, DashboardAvailabilitySlot, StudioProfile } from "@/lib/types";

interface StudioDashboardManagerProps {
  profile: StudioProfile;
  slots: DashboardAvailabilitySlot[];
  bookings: Booking[];
  databaseReady: boolean;
}

type StudioSection = "profile" | "schedule" | "bookings";

type ActionState = {
  area: string;
  success: boolean;
  message: string;
} | null;

export function StudioDashboardManager({
  profile,
  slots,
  bookings,
  databaseReady
}: StudioDashboardManagerProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [state, setState] = useState<ActionState>(null);
  const [activeSection, setActiveSection] = useState<StudioSection>("profile");
  const sections: DashboardSectionTab<StudioSection>[] = [
    {
      id: "profile",
      label: "Профиль и залы",
      description: "Данные и пространства",
      icon: Building2,
      count: profile.halls.length
    },
    {
      id: "schedule",
      label: "Расписание",
      description: "Доступность залов",
      icon: CalendarDays,
      count: slots.length
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
      <>
      <Card>
        <CardHeader>
          <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
            <CardTitle>Профиль студии</CardTitle>
            <StatusBadge status={profile.status} />
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid gap-6">
            <form action={run("studio-image", uploadStudioImageAction)} className="grid gap-4 rounded-lg border border-border p-4 md:grid-cols-[260px_1fr]">
              <ImagePreview src={profile.imageUrl} alt={profile.name} />
              <div className="grid content-start gap-3">
                <Message state={state} area="studio-image" />
                <ImageUploadField
                  name="image"
                  label="Studio image"
                  currentUrl={profile.imageUrl}
                  previewAlt={profile.name}
                />
                <UploadButton pending={isPending} disabled={!databaseReady}>
                  Upload studio image
                </UploadButton>
              </div>
            </form>

          <form action={run("profile", updateStudioProfileAction)} className="grid gap-4">
            <Message state={state} area="profile" />
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Название" name="name" defaultValue={profile.name} />
              <Field label="Город" name="city" defaultValue={profile.city} />
            </div>
            <Field label="Адрес" name="address" defaultValue={profile.address} />
            <label className="grid gap-2 text-sm font-medium">
              Описание
              <textarea name="description" defaultValue={profile.description} className={textareaClass} />
            </label>
            <label className="grid gap-2 text-sm font-medium">
              Правила аренды
              <textarea name="rules" defaultValue={profile.rules.join("\n")} className={textareaClass} />
            </label>
            <Button disabled={isPending || !databaseReady} className="w-fit">
              <Save className="size-4" aria-hidden="true" />
              Save changes
            </Button>
          </form>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Залы студии</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-5">
          <form action={run("halls-upload", createStudioHallWithImageAction)} className="grid gap-3 rounded-lg border border-border p-4">
            <Message state={state} area="halls-upload" />
            <ImageUploadField name="image" label="Hall image" previewAlt="Hall preview" />
            <div className="grid gap-3 md:grid-cols-3">
              <Field label="Название" name="name" />
              <Field label="Описание" name="description" />
              <Field label="Вместимость" name="capacity" type="number" />
              <Field label="Цена/час" name="hourlyRate" type="number" />
              <Field label="Amenities через запятую" name="amenities" />
            </div>
            <input type="hidden" name="imageUrl" value="" />
            <input type="hidden" name="status" value="ACTIVE" />
            <UploadButton pending={isPending} disabled={!databaseReady}>
              Add hall with image
            </UploadButton>
          </form>

          <form action={run("halls", createStudioHallAction)} className="grid gap-3 rounded-lg border border-border p-4">
            <Message state={state} area="halls" />
            <p className="text-sm font-medium text-muted-foreground">Или создать зал с image URL вручную</p>
            <div className="grid gap-3 md:grid-cols-3">
              <Field label="Название" name="name" />
              <Field label="Описание" name="description" />
              <Field label="Image URL" name="imageUrl" />
              <Field label="Вместимость" name="capacity" type="number" />
              <Field label="Цена/час" name="hourlyRate" type="number" />
              <Field label="Amenities через запятую" name="amenities" />
            </div>
            <input type="hidden" name="status" value="ACTIVE" />
            <Button disabled={isPending || !databaseReady} size="sm" className="w-fit">
              <Building2 className="size-4" aria-hidden="true" />
              Add hall
            </Button>
          </form>

          {profile.halls.length === 0 ? (
            <EmptyText text="Залов пока нет." />
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {profile.halls.map((hall) => (
                <div key={hall.id ?? hall.name} className="overflow-hidden rounded-lg border border-border">
                  <div className="relative aspect-[16/9]">
                    <Image src={hall.imageUrl ?? ""} alt={hall.name} fill className="object-cover" />
                  </div>
                  <div className="grid gap-3 p-4">
                    <div className="flex justify-between gap-3">
                      <StatusBadge status={hall.status ?? "Active"} />
                      <span className="text-sm text-muted-foreground">
                        {formatPrice(hall.pricePerHour)} / час
                      </span>
                    </div>
                    <form action={run(`hall-image-${hall.id}`, updateStudioHallImageAction)} className="grid gap-3 rounded-md border border-border p-3">
                      <input type="hidden" name="id" value={hall.id} />
                      <Message state={state} area={`hall-image-${hall.id}`} />
                      <ImageUploadField
                        name="image"
                        label="Replace hall image"
                        currentUrl={hall.imageUrl}
                        previewAlt={hall.name}
                      />
                      <UploadButton pending={isPending} disabled={!databaseReady}>
                        Upload hall photo
                      </UploadButton>
                    </form>
                    <form action={run(`hall-${hall.id}`, updateStudioHallAction)} className="grid gap-3">
                      <input type="hidden" name="id" value={hall.id} />
                      <Message state={state} area={`hall-${hall.id}`} />
                      <Field label="Название" name="name" defaultValue={hall.name} />
                      <Field label="Описание" name="description" defaultValue={hall.description ?? "Описание зала"} />
                      <Field label="Image URL" name="imageUrl" defaultValue={hall.imageUrl ?? ""} />
                      <div className="grid gap-3 sm:grid-cols-2">
                        <Field label="Вместимость" name="capacity" type="number" defaultValue={String(hall.capacity)} />
                        <Field label="Цена/час" name="hourlyRate" type="number" defaultValue={String(hall.pricePerHour)} />
                      </div>
                      <Field label="Amenities через запятую" name="amenities" defaultValue={(hall.amenities ?? []).join(", ")} />
                      <label className="flex items-center gap-2 text-sm font-medium">
                        <input
                          type="checkbox"
                          name="status"
                          value="ACTIVE"
                          defaultChecked={(hall.status ?? "Active") === "Active"}
                        />
                        Active
                      </label>
                      <div className="flex flex-wrap gap-2">
                        <Button disabled={isPending || !databaseReady} size="sm" variant="outline">
                          <Check className="size-4" aria-hidden="true" />
                          Edit hall
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
                          Delete
                        </Button>
                      </div>
                    </form>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
      </>
      ) : null}

      {activeSection === "schedule" ? (
      <Card>
        <CardHeader>
          <CardTitle>Доступность залов</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-5">
          {profile.halls.length === 0 ? (
            <EmptyText text="Добавьте зал, чтобы управлять слотами." />
          ) : (
            <form action={run("slots", createStudioAvailabilitySlotAction)} className="grid gap-3 rounded-lg border border-border p-4">
              <Message state={state} area="slots" />
              <div className="grid gap-3 md:grid-cols-5">
                <label className="grid gap-2 text-sm font-medium">
                  Зал
                  <select name="studioHallId" className={inputClass}>
                    {profile.halls.map((hall) => (
                      <option key={hall.id} value={hall.id}>{hall.name}</option>
                    ))}
                  </select>
                </label>
                <Field label="Дата" name="date" type="date" />
                <Field label="Начало" name="startTime" type="time" />
                <Field label="Конец" name="endTime" type="time" />
                <label className="flex items-end gap-2 pb-2 text-sm font-medium">
                  <input name="isAvailable" type="checkbox" defaultChecked />
                  Доступен
                </label>
              </div>
              <Button disabled={isPending || !databaseReady} size="sm" className="w-fit">
                <Plus className="size-4" aria-hidden="true" />
                Add slot
              </Button>
            </form>
          )}

          {slots.length === 0 ? (
            <EmptyText text="Слотов пока нет." />
          ) : (
            <div className="grid gap-3">
              {slots.map((slot) => (
                <form key={slot.id} action={run(`slot-${slot.id}`, updateStudioAvailabilitySlotAction)} className="grid gap-3 rounded-lg border border-border p-4 md:grid-cols-[1.2fr_1fr_1fr_1fr_auto] md:items-end">
                  <input type="hidden" name="id" value={slot.id} />
                  <label className="grid gap-2 text-sm font-medium">
                    Зал
                    <select name="studioHallId" defaultValue={slot.studioHallId} className={inputClass}>
                      {profile.halls.map((hall) => (
                        <option key={hall.id} value={hall.id}>{hall.name}</option>
                      ))}
                    </select>
                  </label>
                  <Field label="Дата" name="date" type="date" defaultValue={slot.date} />
                  <Field label="Начало" name="startTime" type="time" defaultValue={slot.startTime} />
                  <Field label="Конец" name="endTime" type="time" defaultValue={slot.endTime} />
                  <div className="flex flex-wrap gap-2">
                    <label className="flex items-center gap-2 text-sm">
                      <input name="isAvailable" type="checkbox" defaultChecked={slot.isAvailable} />
                      On
                    </label>
                    <Button disabled={isPending || !databaseReady} size="sm" variant="outline">Save</Button>
                    <Button
                      disabled={isPending || !databaseReady}
                      size="sm"
                      variant="outline"
                      type="button"
                      onClick={() => {
                        const data = new FormData();
                        data.set("id", slot.id);
                        run("slots", deleteStudioAvailabilitySlotAction)(data);
                      }}
                    >
                      Delete
                    </Button>
                  </div>
                </form>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
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
    <div className="overflow-x-auto rounded-lg border border-border bg-card">
      <table className="w-full min-w-[760px] text-left text-sm">
        <thead className="border-b border-border bg-secondary/60 text-muted-foreground">
          <tr>
            <th className="px-4 py-3 font-medium">Booking</th>
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
                  {["DEPOSIT_PAID", "FINAL_PAYMENT_PENDING", "FULLY_PAID"].includes(
                    booking.paymentStatus
                  ) && ["Confirmed", "In progress", "Completed"].includes(booking.status) ? (
                    <span className="text-xs text-muted-foreground">
                      {booking.clientPhone || "-"} · {booking.clientEmail || "-"}
                    </span>
                  ) : (
                    <span className="text-xs text-muted-foreground">Контакты после депозита</span>
                  )}
                </div>
              </td>
              <td className="px-4 py-3">{booking.date} · {booking.time}</td>
              <td className="px-4 py-3"><StatusBadge status={booking.bookingType ?? "FULL_SHOOT"} /></td>
              <td className="px-4 py-3">
                <div className="grid gap-1">
                  <span>Всего: {formatPrice(booking.totalAmount)}</span>
                  <span className="text-muted-foreground">Депозит: {formatPrice(booking.depositAmount)}</span>
                  <span className="text-muted-foreground">Оплачено: {formatPrice(booking.paidAmount)}</span>
                  <span className="text-muted-foreground">Остаток: {formatPrice(booking.remainingAmount)}</span>
                </div>
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
                  <details>
                    <summary className="cursor-pointer text-sm font-medium">View rental details</summary>
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
                </td>
              </tr>
            ) : null}
            </Fragment>
          ))}
        </tbody>
      </table>
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
    ["Confirmed", "In progress"].includes(booking.status) &&
    booking.paymentStatus === "DEPOSIT_PAID" &&
    booking.remainingAmount > 0;

  return (
    <div className="grid gap-2">
      {booking.status === "Pending" && booking.paymentStatus !== "DEPOSIT_PAID" ? (
        <p className="text-xs text-muted-foreground">Нельзя подтвердить бронь до оплаты депозита.</p>
      ) : null}
      <div className="flex flex-wrap gap-2">
      {statuses.map((status) => (
        <Button
          key={status}
          size="sm"
          variant={status === "CONFIRMED" || status === "IN_PROGRESS" ? "default" : "outline"}
          disabled={disabled || (status === "CONFIRMED" && booking.paymentStatus !== "DEPOSIT_PAID")}
          onClick={() => {
            const data = new FormData();
            data.set("bookingId", booking.dbId ?? booking.id);
            data.set("status", status);
            onSubmit(data);
          }}
        >
          {status}
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
          Работа завершена · запросить оплату
        </Button>
      ) : null}
      </div>
      {booking.paymentStatus === "FINAL_PAYMENT_PENDING" ? (
        <span className="text-xs text-amber-300">Остаток ожидает оплаты клиентом.</span>
      ) : null}
      {booking.paymentStatus === "FULLY_PAID" ? (
        <span className="text-xs text-emerald-300">Полностью оплачено.</span>
      ) : null}
    </div>
  );
}

function Field({
  label,
  name,
  defaultValue = "",
  type = "text"
}: {
  label: string;
  name: string;
  defaultValue?: string;
  type?: string;
}) {
  return (
    <label className="grid gap-2 text-sm font-medium">
      {label}
      <input name={name} type={type} defaultValue={defaultValue} className={inputClass} />
    </label>
  );
}

function Message({ state, area }: { state: ActionState; area: string }) {
  if (!state || state.area !== area) return null;
  return <Notice tone={state.success ? "success" : "error"} message={state.message} />;
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
