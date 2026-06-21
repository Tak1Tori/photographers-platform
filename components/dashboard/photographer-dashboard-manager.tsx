"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { Fragment, useState, useTransition } from "react";
import { CalendarDays, Images, Plus, Save, Trash2, UserRound, X } from "lucide-react";
import {
  createPhotographerAvailabilitySlotAction,
  createCustomPhotographerStyleAction,
  deleteAvailabilitySlotAction,
  deletePortfolioItemAction,
  requestPhotographerFinalPaymentAction,
  savePhotographerPortfolioAction,
  updateAvailabilitySlotAction,
  updatePhotographerBookingStatusAction,
  updatePhotographerProfileAction
} from "@/app/dashboard/photographer/actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/dashboard/status-badge";
import {
  DashboardSectionTabs,
  type DashboardSectionTab
} from "@/components/dashboard/dashboard-section-tabs";
import { AlbumContentField } from "@/components/uploads/album-content-field";
import { ImageUploadField } from "@/components/uploads/image-upload-field";
import { EQUIPMENT_OPTIONS, LOCATION_TYPES, SHOOT_TYPES, getOptionLabel } from "@/lib/booking-options";
import { formatPrice } from "@/lib/mock-data";
import type {
  Booking,
  DashboardAvailabilitySlot,
  PhotographerProfile,
  PhotoStyle,
  PortfolioItem
} from "@/lib/types";

interface PhotographerDashboardManagerProps {
  profile: PhotographerProfile;
  styles: PhotoStyle[];
  portfolioItems: PortfolioItem[];
  slots: DashboardAvailabilitySlot[];
  bookings: Booking[];
  databaseReady: boolean;
}

type ActionState = {
  area: string;
  success: boolean;
  message: string;
} | null;

const maxServerActionUploadBytes = 4 * 1024 * 1024;
type PhotographerSection = "profile" | "portfolio" | "schedule" | "bookings";

export function PhotographerDashboardManager({
  profile,
  styles,
  portfolioItems,
  slots,
  bookings,
  databaseReady
}: PhotographerDashboardManagerProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [state, setState] = useState<ActionState>(null);
  const [showCustomStyle, setShowCustomStyle] = useState(false);
  const [customStyleName, setCustomStyleName] = useState("");
  const [activeSection, setActiveSection] = useState<PhotographerSection>("profile");
  const sections: DashboardSectionTab<PhotographerSection>[] = [
    {
      id: "profile",
      label: "Профиль",
      description: "Данные и специализации",
      icon: UserRound
    },
    {
      id: "portfolio",
      label: "Портфолио",
      description: "Альбомы и материалы",
      icon: Images,
      count: portfolioItems.length
    },
    {
      id: "schedule",
      label: "Расписание",
      description: "Свободные даты",
      icon: CalendarDays,
      count: slots.length
    },
    {
      id: "bookings",
      label: "Брони",
      description: "Заявки и оплата",
      icon: CalendarDays,
      count: bookings.length
    }
  ];

  function run(area: string, action: (formData: FormData) => Promise<{ success: boolean; error?: string }>) {
    return (formData: FormData) => {
      setState(null);
      const uploadBytes = Array.from(formData.values()).reduce(
        (total, value) => total + (value instanceof File ? value.size : 0),
        0
      );

      if (uploadBytes > maxServerActionUploadBytes) {
        setState({
          area,
          success: false,
          message:
            "Выбрано слишком много файлов для одного сохранения. Сохраните изменения по одному альбому."
        });
        return;
      }

      startTransition(async () => {
        try {
          const result = await action(formData);
          if (!result) {
            throw new Error("Сервер не вернул ответ.");
          }
          setState({
            area,
            success: result.success,
            message: result.success
              ? "Изменения сохранены."
              : result.error ?? "Ошибка сохранения."
          });
          if (result.success) {
            router.refresh();
          }
        } catch {
          setState({
            area,
            success: false,
            message:
              "Не удалось отправить файлы. Уменьшите количество изображений и попробуйте снова."
          });
        }
      });
    };
  }

  function createCustomStyle() {
    const formData = new FormData();
    formData.set("styleName", customStyleName);
    setState(null);

    startTransition(async () => {
      const result = await createCustomPhotographerStyleAction(formData);
      setState({
        area: "style-create",
        success: result.success,
        message: result.success
          ? "Стиль добавлен и выбран."
          : result.error ?? "Не удалось добавить стиль."
      });

      if (result.success) {
        setCustomStyleName("");
        setShowCustomStyle(false);
        router.refresh();
      }
    });
  }

  return (
    <div className="grid gap-8">
      {!databaseReady ? (
        <Notice tone="error" message="DATABASE_URL не настроен. CRUD-операции требуют PostgreSQL." />
      ) : null}
      {profile.status === "Draft" ? (
        <Notice message="Профиль в draft. Заполните данные и дождитесь approval от администратора." />
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
            <CardTitle>Профиль фотографа</CardTitle>
            <StatusBadge status={profile.status} />
          </div>
        </CardHeader>
        <CardContent>
          <form action={run("profile", updatePhotographerProfileAction)} className="grid gap-6">
            <Message state={state} area="profile" />
            <div className="grid gap-4 rounded-lg border border-border p-4 md:grid-cols-[220px_1fr] md:items-start">
              <div className="max-w-[220px]">
                <ImageUploadField
                  name="avatar"
                  label="Новый аватар"
                  currentUrl={profile.avatarUrl}
                  previewAlt={profile.name}
                  maxSizeMb={25}
                />
              </div>
              <div className="grid gap-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <Field label="Имя" name="name" defaultValue={profile.name} />
                  <Field label="Город" name="city" defaultValue={profile.city} />
                </div>
                <Field label="Цена за час" name="hourlyRate" type="number" defaultValue={String(profile.pricePerHour)} />
                <label className="grid gap-2 text-sm font-medium">
                  Описание
                  <textarea name="bio" defaultValue={profile.bio} className={textareaClass} />
                </label>
              </div>
            </div>
            <div className="grid gap-2">
              <p className="text-sm font-medium">Стили съемки</p>
              <div className="grid gap-2 rounded-md border border-border p-3 sm:grid-cols-2 lg:grid-cols-3">
                {styles.map((style) => (
                  <label key={style.id} className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      name="styleIds"
                      value={style.id}
                      defaultChecked={profile.specializationIds.includes(style.id)}
                    />
                    {style.title}
                  </label>
                ))}
                <div className="flex items-center">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={isPending || !databaseReady}
                    onClick={() => setShowCustomStyle((visible) => !visible)}
                  >
                    {showCustomStyle ? (
                      <X className="size-4" aria-hidden="true" />
                    ) : (
                      <Plus className="size-4" aria-hidden="true" />
                    )}
                    {showCustomStyle ? "Отмена" : "Другие"}
                  </Button>
                </div>
              </div>
              {showCustomStyle ? (
                <div className="flex flex-col gap-2 rounded-md border border-emerald-500/30 bg-emerald-500/5 p-3 sm:flex-row">
                  <input
                    type="text"
                    aria-label="Название нового стиля"
                    placeholder="Например, спортивная съемка"
                    value={customStyleName}
                    maxLength={60}
                    className={inputClass}
                    onChange={(event) => setCustomStyleName(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        event.preventDefault();
                        createCustomStyle();
                      }
                    }}
                  />
                  <Button
                    type="button"
                    disabled={isPending || customStyleName.trim().length < 2 || !databaseReady}
                    onClick={createCustomStyle}
                    className="shrink-0"
                  >
                    <Plus className="size-4" aria-hidden="true" />
                    Добавить стиль
                  </Button>
                </div>
              ) : null}
              <Message state={state} area="style-create" />
            </div>
            <Button disabled={isPending || !databaseReady} className="w-full sm:w-fit sm:justify-self-end">
              <Save className="size-4" aria-hidden="true" />
              {isPending ? "Сохраняем..." : "Сохранить изменения"}
            </Button>
          </form>
        </CardContent>
      </Card>
      ) : null}

      {activeSection === "portfolio" ? (
      <Card>
        <CardHeader>
          <CardTitle>Портфолио фотографа</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-5">
          <form
            action={run("portfolio", savePhotographerPortfolioAction)}
            className="grid gap-5 rounded-lg border border-emerald-500/25 bg-emerald-500/[0.04] p-4 sm:p-5"
          >
            <div>
              <h4 className="text-lg font-semibold tracking-normal">Новый альбом</h4>
              <p className="mt-1 text-sm text-muted-foreground">
                Добавьте обложку, название и материалы новой съемки.
              </p>
            </div>
            <Message state={state} area="portfolio" />
            <div className="grid gap-4 md:grid-cols-[minmax(220px,360px)_1fr]">
              <ImageUploadField
                name="newPortfolioImage"
                label="Добавить новую работу"
                previewAlt="Предпросмотр новой работы"
                maxSizeMb={25}
              />
              <div className="grid content-start gap-3">
                <Field label="Название" name="newPortfolioTitle" />
                <Field label="Описание" name="newPortfolioDescription" />
                <AlbumContentField name="newAlbumImages" />
                <p className="text-sm text-muted-foreground">
                  Новая работа появится в портфолио после общего сохранения.
                </p>
              </div>
            </div>
            <Button
              disabled={isPending || !databaseReady}
              className="w-full sm:w-fit sm:justify-self-end"
            >
              <Plus className="size-4" aria-hidden="true" />
              {isPending ? "Создаём..." : "Создать альбом"}
            </Button>
          </form>

          <div className="border-t border-border pt-6">
            <div className="mb-5 flex flex-col justify-between gap-2 sm:flex-row sm:items-end">
              <div>
                <h4 className="text-lg font-semibold tracking-normal">Существующие альбомы</h4>
                <p className="mt-1 text-sm text-muted-foreground">
                  Обновляйте обложки, описание и содержимое каждого альбома.
                </p>
              </div>
              <span className="text-sm text-muted-foreground">
                {portfolioItems.length} альбомов
              </span>
            </div>
            {portfolioItems.length === 0 ? (
              <EmptyText text="Портфолио пока пустое. Добавьте первую работу выше." />
            ) : (
              <form action={run("portfolio", savePhotographerPortfolioAction)} className="grid gap-5">
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {portfolioItems.map((item) => (
                  <div key={item.id} className="grid gap-3 rounded-lg border border-border p-4">
                    <input type="hidden" name="portfolioItemIds" value={item.id} />
                    <ImageUploadField
                      name={`portfolioImage:${item.id}`}
                      label="Заменить изображение"
                      currentUrl={item.imageUrl}
                      previewAlt={item.title || "Portfolio item"}
                      maxSizeMb={25}
                    />
                    <Field
                      label="Название"
                      name={`portfolioTitle:${item.id}`}
                      defaultValue={item.title}
                    />
                    <Field
                      label="Описание"
                      name={`portfolioDescription:${item.id}`}
                      defaultValue={item.description}
                    />
                    <AlbumContentField
                      name={`albumImages:${item.id}`}
                      existingImages={item.albumImages}
                    />
                    <Button
                      disabled={isPending || !databaseReady}
                      size="sm"
                      variant="outline"
                      type="button"
                      className="w-fit"
                      onClick={() => {
                        if (!window.confirm("Удалить работу из портфолио?")) return;
                        const data = new FormData();
                        data.set("id", item.id);
                        run("portfolio", deletePortfolioItemAction)(data);
                      }}
                    >
                      <Trash2 className="size-4" aria-hidden="true" />
                      Удалить
                    </Button>
                  </div>
                ))}
              </div>
                <Button
                  disabled={isPending || !databaseReady}
                  className="w-full sm:w-fit sm:justify-self-end"
                >
                  <Save className="size-4" aria-hidden="true" />
                  {isPending ? "Сохраняем..." : "Сохранить альбомы"}
                </Button>
              </form>
            )}
          </div>
        </CardContent>
      </Card>
      ) : null}

      {activeSection === "schedule" ? (
      <Card>
        <CardHeader>
          <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
            <div>
              <CardTitle>Календарь доступности</CardTitle>
              <p className="mt-1 text-sm text-muted-foreground">
                Smart Calendar управляет рабочими часами, занятостью и бронями.
              </p>
            </div>
            <Button asChild>
              <Link href="/dashboard/photographer/calendar">
                <CalendarDays className="size-4" />
                Открыть Smart Calendar
              </Link>
            </Button>
          </div>
        </CardHeader>
        <CardContent className="grid gap-5">
          <p className="text-sm font-medium text-muted-foreground">
            Legacy slots: сохранены для совместимости и постепенно заменяются правилами календаря.
          </p>
          <form action={run("slots", createPhotographerAvailabilitySlotAction)} className="grid gap-3 rounded-lg border border-border p-4">
            <Message state={state} area="slots" />
            <div className="grid gap-3 md:grid-cols-4">
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
          {slots.length === 0 ? (
            <EmptyText text="Слотов пока нет." />
          ) : (
            <div className="grid gap-3">
              {slots.map((slot) => (
                <form key={slot.id} action={run(`slot-${slot.id}`, updateAvailabilitySlotAction)} className="grid gap-3 rounded-lg border border-border p-4 md:grid-cols-[1fr_1fr_1fr_auto] md:items-end">
                  <input type="hidden" name="id" value={slot.id} />
                  <Message state={state} area={`slot-${slot.id}`} />
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
                        run("slots", deleteAvailabilitySlotAction)(data);
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
        <h2 className="mb-4 text-2xl font-semibold tracking-normal">Бронирования фотографа</h2>
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
                  onSubmit={run("booking", updatePhotographerBookingStatusAction)}
                  onRequestFinal={run("booking", requestPhotographerFinalPaymentAction)}
                />
              </td>
            </tr>
            {booking.bookingType === "PHOTOGRAPHER_ONLY" ? (
              <tr key={`${booking.id}-brief`} className="border-b border-border bg-secondary/30">
                <td className="px-4 py-3" colSpan={8}>
                  <details className="group">
                    <summary className="cursor-pointer text-sm font-medium">View brief</summary>
                    <div className="mt-3 grid gap-3 text-sm md:grid-cols-3">
                      <BriefItem label="Тип" value={getOptionLabel(SHOOT_TYPES, booking.shootType)} />
                      <BriefItem label="Локация" value={getOptionLabel(LOCATION_TYPES, booking.locationType)} />
                      <BriefItem label="Город/район" value={[booking.city, booking.district].filter(Boolean).join(", ") || "-"} />
                      <BriefItem label="Людей" value={booking.peopleCount ? String(booking.peopleCount) : "-"} />
                      <BriefItem
                        label="Оборудование"
                        value={booking.equipmentNeeded?.map((item) => getOptionLabel(EQUIPMENT_OPTIONS, item)).join(", ") ?? "-"}
                      />
                      <BriefItem label="Описание" value={booking.shootDescription ?? "-"} />
                      <BriefItem label="Адрес" value={booking.addressDetails ?? "-"} />
                      <BriefItem label="Особые требования" value={booking.specialRequirements ?? "-"} />
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

function BriefItem({ label, value }: { label: string; value: string }) {
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
