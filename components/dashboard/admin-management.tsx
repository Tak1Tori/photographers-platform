"use client";

import type { ReactNode } from "react";
import { Fragment, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  adminCancelPaymentAction,
  adminCreatePhotographerReviewAction,
  adminCreateEditorTagAction,
  adminCreateStyleAction,
  adminDeleteReviewAction,
  adminDeleteStyleAction,
  adminDeleteEditorTagAction,
  adminDeleteUserAction,
  adminMarkPaymentAsFailedAction,
  adminRefundPaymentAction,
  adminUpdateBookingStatusAction,
  updatePhotographerProfileStatusAction,
  updateStudioProfileStatusAction
} from "@/app/admin/actions";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/dashboard/status-badge";
import { SuccessToast } from "@/components/shared/success-toast";
import { formatPrice } from "@/lib/mock-data";
import type {
  AdminNotificationDTO,
  Booking,
  PaymentDTO,
  PaymentStatus,
  PaymentWebhookLogDTO
} from "@/lib/types";

type ActionState = { success: boolean; message: string } | null;
type AdminAction = (formData: FormData) => Promise<{ success: boolean; error?: string }>;
type AdminSectionId = "users" | "photographers" | "editors" | "studios" | "bookings" | "payments" | "logs";

interface AdminManagementProps {
  databaseReady: boolean;
  users: Array<{ id: string; name: string; phone?: string | null; role: string; createdAt: string }>;
  photographers: Array<{
    id: string;
    name: string;
    city: string;
    status: "Draft" | "Published" | "Blocked";
    styles: string[];
    bookingsCount: number;
    portfolioCount: number;
    rating: number;
    reviewsCount: number;
    reviews: Array<{
      id: string;
      clientName: string;
      rating: number;
      comment: string | null;
      createdAt: string;
    }>;
  }>;
  styles: Array<{
    id: string;
    name: string;
    slug: string;
    photographersCount: number;
    bookingsCount: number;
  }>;
  editors: Array<{
    id: string;
    name: string;
    city: string;
    status: "Draft" | "Published" | "Blocked";
    tags: string[];
    portfolioCount: number;
    rating: number;
    reviewsCount: number;
  }>;
  editorTags: Array<{
    id: string;
    name: string;
    slug: string;
    editorsCount: number;
  }>;
  studios: Array<{
    id: string;
    name: string;
    city: string;
    status: "Draft" | "Published" | "Blocked";
    hallsCount: number;
    bookingsCount: number;
  }>;
  halls: Array<{
    id: string;
    studioName: string;
    name: string;
    capacity: number;
    hourlyRate: number;
    status: "Active" | "Inactive";
  }>;
  bookings: Booking[];
  payments: PaymentDTO[];
  webhookLogs: PaymentWebhookLogDTO[];
  notificationLogs: AdminNotificationDTO[];
}

export function AdminManagement({
  databaseReady,
  users,
  photographers,
  styles,
  editors,
  editorTags,
  studios,
  halls,
  bookings,
  payments,
  webhookLogs,
  notificationLogs
}: AdminManagementProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [state, setState] = useState<ActionState>(null);
  const [activeSection, setActiveSection] = useState<AdminSectionId>("users");
  const [paymentStatus, setPaymentStatus] = useState<"All" | PaymentStatus>("All");
  const [notificationType, setNotificationType] = useState("All");
  const [notificationRead, setNotificationRead] = useState<"All" | "Unread" | "Read">("All");
  const hasRescheduleRequests = bookings.some((booking) => Boolean(booking.rescheduleRequestedAt));
  const notificationTypes = ["All", ...Array.from(new Set(notificationLogs.map((item) => item.type)))];
  const filteredNotificationLogs = notificationLogs.filter((notification) => {
    const typeMatches = notificationType === "All" || notification.type === notificationType;
    const readMatches =
      notificationRead === "All" ||
      (notificationRead === "Read" ? notification.isRead : !notification.isRead);
    return typeMatches && readMatches;
  });

  function run(action: AdminAction, formData: FormData) {
    setState(null);
    startTransition(async () => {
      const result = await action(formData);
      setState({
        success: result.success,
        message: result.success ? "Изменения сохранены." : result.error ?? "Ошибка."
      });
      if (result.success) router.refresh();
    });
  }

  return (
    <div className="grid gap-8">
      {!databaseReady ? (
        <Notice tone="error" message="DATABASE_URL не настроен. Реальные admin CRUD-операции требуют PostgreSQL." />
      ) : null}
      {state?.success ? <SuccessToast message={state.message} /> : null}
      {state && !state.success ? <Notice tone="error" message={state.message} /> : null}

      <AdminTabs
        activeSection={activeSection}
        onChange={setActiveSection}
        hasRescheduleRequests={hasRescheduleRequests}
        counts={{
          users: users.length,
          photographers: photographers.length,
          editors: editors.length,
          studios: studios.length,
          bookings: bookings.length,
          payments: payments.length,
          logs: notificationLogs.length + webhookLogs.length
        }}
      />

      {activeSection === "users" ? (
        <AdminSection title="Юзеры">
          <AdminUsersTable users={users} disabled={isPending || !databaseReady} run={run} />
        </AdminSection>
      ) : null}

      {activeSection === "photographers" ? (
        <div className="grid gap-8">
          <AdminSection title="Фотографы">
            <PhotographersTable
              photographers={photographers}
              disabled={isPending || !databaseReady}
              run={run}
            />
          </AdminSection>

          <div className="grid gap-6 xl:grid-cols-[minmax(0,1.35fr)_minmax(320px,0.75fr)]">
            <AdminSection title="Отзывы фотографов">
              <AdminPhotographerReviewsPanel
                photographers={photographers}
                disabled={isPending || !databaseReady}
                run={run}
              />
            </AdminSection>
            <AdminSection title="Пул тегов фотографов">
              <AdminStylesPool styles={styles} disabled={isPending || !databaseReady} run={run} />
            </AdminSection>
          </div>
        </div>
      ) : null}

      {activeSection === "editors" ? (
        <div className="grid gap-8">
          <AdminSection title="Монтажеры">
            <EditorsTable editors={editors} disabled={isPending || !databaseReady} run={run} />
          </AdminSection>
          <AdminSection title="Пул тегов монтажеров">
            <AdminEditorTagsPool editorTags={editorTags} disabled={isPending || !databaseReady} run={run} />
          </AdminSection>
        </div>
      ) : null}

      {activeSection === "studios" ? (
        <div className="grid gap-8">
          <AdminSection title="Студии">
            <StudiosTable studios={studios} disabled={isPending || !databaseReady} run={run} />
          </AdminSection>
          <AdminSection title="Залы студий">
            <SimpleTable
              empty="Залов пока нет."
              headers={["Студия", "Зал", "Вместимость", "Цена", "Статус"]}
              rows={halls.map((hall) => [
                hall.studioName,
                hall.name,
                String(hall.capacity),
                formatPrice(hall.hourlyRate),
                hall.status
              ])}
            />
          </AdminSection>
        </div>
      ) : null}

      {activeSection === "bookings" ? (
        <AdminSection title="Брони">
          <BookingsTable bookings={bookings} disabled={isPending || !databaseReady} run={run} />
        </AdminSection>
      ) : null}

      {activeSection === "payments" ? (
        <AdminSection title="Платежи">
          <div className="mb-4 flex flex-wrap gap-2">
            {(["All", "PENDING", "PAID", "FAILED", "CANCELLED", "REFUNDED"] as Array<"All" | PaymentStatus>).map((status) => (
              <Button
                key={status}
                size="sm"
                variant={paymentStatus === status ? "default" : "outline"}
                onClick={() => setPaymentStatus(status)}
              >
                {status}
              </Button>
            ))}
          </div>
          <PaymentsTable
            payments={paymentStatus === "All" ? payments : payments.filter((payment) => payment.status === paymentStatus)}
            disabled={isPending || !databaseReady}
            run={run}
          />
        </AdminSection>
      ) : null}

      {activeSection === "logs" ? (
        <div className="grid gap-8">
          <AdminSection title="Журнал уведомлений">
            <div className="mb-4 flex flex-wrap gap-2">
              {notificationTypes.map((type) => (
                <Button
                  key={type}
                  size="sm"
                  variant={notificationType === type ? "default" : "outline"}
                  onClick={() => setNotificationType(type)}
                >
                  {type}
                </Button>
              ))}
            </div>
            <div className="mb-4 flex flex-wrap gap-2">
              {(["All", "Unread", "Read"] as const).map((status) => (
                <Button
                  key={status}
                  size="sm"
                  variant={notificationRead === status ? "default" : "outline"}
                  onClick={() => setNotificationRead(status)}
                >
                  {status}
                </Button>
              ))}
            </div>
            <NotificationLogsTable notifications={filteredNotificationLogs} />
          </AdminSection>
          <AdminSection title="Webhook events">
            <WebhookLogsTable logs={webhookLogs} />
          </AdminSection>
        </div>
      ) : null}
    </div>
  );
}

function AdminTabs({
  activeSection,
  onChange,
  hasRescheduleRequests,
  counts
}: {
  activeSection: AdminSectionId;
  onChange: (section: AdminSectionId) => void;
  hasRescheduleRequests: boolean;
  counts: Record<AdminSectionId, number>;
}) {
  const items: Array<{ id: AdminSectionId; label: string; alert?: boolean }> = [
    { id: "users", label: "Юзеры" },
    { id: "photographers", label: "Фотографы" },
    { id: "editors", label: "Монтажеры" },
    { id: "studios", label: "Студии" },
    { id: "bookings", label: "Брони", alert: hasRescheduleRequests },
    { id: "payments", label: "Платежи" },
    { id: "logs", label: "Журналы" }
  ];

  return (
    <div className="rounded-lg border border-border bg-card/60 p-2">
      <div className="grid gap-2 md:grid-cols-3 xl:grid-cols-7">
        {items.map((item) => {
          const isActive = activeSection === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onChange(item.id)}
              className={`relative rounded-md px-4 py-4 text-left transition hover:bg-secondary/60 ${
                isActive ? "text-foreground" : "text-muted-foreground"
              }`}
            >
              <span className="flex items-center gap-2 text-base font-semibold">
                {item.label}
                <span className="rounded-full bg-secondary px-2 py-0.5 text-xs text-muted-foreground">
                  {counts[item.id]}
                </span>
                {item.alert ? (
                  <span className="rounded-full bg-amber-400 px-2 py-0.5 text-xs font-bold text-black">!</span>
                ) : null}
              </span>
              <span
                className={`absolute inset-x-3 bottom-1 h-0.5 rounded-full transition ${
                  isActive ? "bg-emerald-300 shadow-[0_0_18px_hsl(var(--primary)/0.5)]" : "bg-transparent"
                }`}
              />
            </button>
          );
        })}
      </div>
    </div>
  );
}

function AdminUsersTable({
  users,
  disabled,
  run
}: {
  users: AdminManagementProps["users"];
  disabled: boolean;
  run: (action: AdminAction, formData: FormData) => void;
}) {
  if (users.length === 0) return <Empty text="Пользователей пока нет." />;

  return (
    <div className="overflow-x-auto rounded-lg border border-border bg-card">
      <table className="w-full min-w-[920px] text-left text-sm">
        <thead className="border-b border-border bg-secondary/60 text-muted-foreground">
          <tr>
            {["Имя", "Телефон", "Роль", "Создан", "Действия"].map((item) => (
              <th key={item} className="px-4 py-3 font-medium">
                {item}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {users.map((user) => (
            <tr key={user.id} className="border-b border-border last:border-0">
              <td className="px-4 py-3 font-medium">{user.name}</td>
              <td className="px-4 py-3 text-muted-foreground">{user.phone ?? "-"}</td>
              <td className="px-4 py-3">{user.role}</td>
              <td className="px-4 py-3 text-muted-foreground">{user.createdAt}</td>
              <td className="px-4 py-3">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="border-rose-500/50 text-rose-100 hover:bg-rose-950/40"
                  disabled={disabled}
                  onClick={() => {
                    const confirmed = window.confirm(
                      `Удалить пользователя "${user.name}" и все связанные персональные данные? Это действие нельзя отменить.`
                    );
                    if (!confirmed) return;

                    const data = new FormData();
                    data.set("userId", user.id);
                    run(adminDeleteUserAction, data);
                  }}
                >
                  Удалить пользователя
                </Button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function PhotographersTable({
  photographers,
  disabled,
  run
}: {
  photographers: AdminManagementProps["photographers"];
  disabled: boolean;
  run: (action: AdminAction, formData: FormData) => void;
}) {
  if (photographers.length === 0) return <Empty text="Фотографов пока нет." />;

  return (
    <div className="overflow-x-auto rounded-lg border border-border bg-card">
      <table className="w-full min-w-[980px] text-left text-sm">
        <thead className="border-b border-border bg-secondary/60 text-muted-foreground">
          <tr>
            {["Имя", "Город", "Теги", "Портфолио", "Брони", "Отзывы", "Статус", "Действия"].map((item) => (
              <th key={item} className="px-4 py-3 font-medium">{item}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {photographers.map((profile) => (
            <tr key={profile.id} className="border-b border-border last:border-0">
              <td className="px-4 py-3 font-medium">{profile.name}</td>
              <td className="px-4 py-3">{profile.city}</td>
              <td className="px-4 py-3">{profile.styles.join(", ") || "-"}</td>
              <td className="px-4 py-3">{profile.portfolioCount}</td>
              <td className="px-4 py-3">{profile.bookingsCount}</td>
              <td className="px-4 py-3">
                {profile.reviewsCount ? `${profile.rating.toFixed(1)} / 5 · ${profile.reviewsCount}` : "Нет"}
              </td>
              <td className="px-4 py-3"><StatusBadge status={profile.status} /></td>
              <td className="px-4 py-3">
                <ProfileStatusActions
                  id={profile.id}
                  disabled={disabled}
                  action={updatePhotographerProfileStatusAction}
                  run={run}
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function EditorsTable({
  editors,
  disabled,
  run
}: {
  editors: AdminManagementProps["editors"];
  disabled: boolean;
  run: (action: AdminAction, formData: FormData) => void;
}) {
  if (editors.length === 0) return <Empty text="Монтажеров пока нет." />;

  return (
    <div className="overflow-x-auto rounded-lg border border-border bg-card">
      <table className="w-full min-w-[860px] text-left text-sm">
        <thead className="border-b border-border bg-secondary/60 text-muted-foreground">
          <tr>{["Имя", "Город", "Теги монтажа", "Портфолио", "Отзывы", "Статус", "Действия"].map((item) => <th key={item} className="px-4 py-3 font-medium">{item}</th>)}</tr>
        </thead>
        <tbody>
          {editors.map((profile) => (
            <tr key={profile.id} className="border-b border-border last:border-0">
              <td className="px-4 py-3 font-medium">{profile.name}</td>
              <td className="px-4 py-3">{profile.city}</td>
              <td className="px-4 py-3">{profile.tags.join(", ") || "-"}</td>
              <td className="px-4 py-3">{profile.portfolioCount}</td>
              <td className="px-4 py-3">{profile.reviewsCount ? `${profile.rating.toFixed(1)} / 5 · ${profile.reviewsCount}` : "Нет"}</td>
              <td className="px-4 py-3"><StatusBadge status={profile.status} /></td>
              <td className="px-4 py-3"><ProfileStatusActions id={profile.id} disabled={disabled} action={updatePhotographerProfileStatusAction} run={run} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function AdminPhotographerReviewsPanel({
  photographers,
  disabled,
  run
}: {
  photographers: AdminManagementProps["photographers"];
  disabled: boolean;
  run: (action: AdminAction, formData: FormData) => void;
}) {
  const [selectedPhotographerId, setSelectedPhotographerId] = useState(photographers[0]?.id ?? "");
  const [mode, setMode] = useState<"reviews" | "add">("reviews");
  const selectedPhotographer =
    photographers.find((photographer) => photographer.id === selectedPhotographerId) ?? photographers[0];
  const reviews = [...(selectedPhotographer?.reviews ?? [])]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  if (photographers.length === 0) {
    return (
      <div className="rounded-lg border border-border bg-card p-4">
        <Empty text="Фотографов пока нет." />
      </div>
    );
  }

  return (
    <div className="grid gap-4 rounded-lg border border-border bg-card p-4">
      <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
        <label className="grid gap-2 text-sm font-medium">
          Фотограф
          <select
            value={selectedPhotographer?.id ?? ""}
            onChange={(event) => setSelectedPhotographerId(event.currentTarget.value)}
            className="rounded-md border border-input bg-background p-3 outline-none"
          >
            {photographers.map((photographer) => (
              <option key={photographer.id} value={photographer.id}>
                {photographer.name}
              </option>
            ))}
          </select>
        </label>

        <div className="grid grid-cols-2 rounded-lg border border-border bg-background p-1">
          {(["reviews", "add"] as const).map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setMode(tab)}
              className={`relative rounded-md px-4 py-2 text-sm font-medium transition ${
                mode === tab ? "text-foreground" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {tab === "reviews" ? "Отзывы" : "Добавить"}
              <span
                className={`absolute inset-x-3 bottom-0 h-0.5 rounded-full ${
                  mode === tab ? "bg-emerald-300 shadow-[0_0_14px_hsl(var(--primary)/0.5)]" : "bg-transparent"
                }`}
              />
            </button>
          ))}
        </div>
      </div>

      {mode === "add" ? (
        <form
          className="grid gap-4 rounded-lg border border-border bg-background p-4"
          onSubmit={(event) => {
            event.preventDefault();
            run(adminCreatePhotographerReviewAction, new FormData(event.currentTarget));
          }}
        >
          <input type="hidden" name="photographerId" value={selectedPhotographer?.id ?? ""} />
          <div className="grid gap-4 md:grid-cols-2">
            <label className="grid gap-2 text-sm font-medium">
              Имя клиента
              <input
                name="clientName"
                required
                className="rounded-md border border-input bg-background p-3 outline-none"
                placeholder="Например: Алия"
              />
            </label>
            <label className="grid gap-2 text-sm font-medium">
              Дата отзыва
              <input
                type="date"
                name="reviewDate"
                defaultValue={getDateInputValue()}
                required
                className="rounded-md border border-input bg-background p-3 outline-none"
              />
            </label>
            <label className="grid gap-2 text-sm font-medium">
              Оценка
              <select name="rating" defaultValue="5" required className="rounded-md border border-input bg-background p-3 outline-none">
                {[5, 4, 3, 2, 1].map((rating) => (
                  <option key={rating} value={rating}>
                    {rating} из 5
                  </option>
                ))}
              </select>
            </label>
          </div>
          <label className="grid gap-2 text-sm font-medium">
            Комментарий
            <textarea
              name="comment"
              className="min-h-28 rounded-md border border-input bg-background p-3 outline-none"
              placeholder="Короткий текст отзыва"
            />
          </label>
          <Button disabled={disabled || !selectedPhotographer}>Добавить отзыв</Button>
        </form>
      ) : reviews.length === 0 ? (
        <Empty text="У выбранного фотографа пока нет отзывов." />
      ) : (
        <div className="grid max-h-[520px] gap-3 overflow-y-auto pr-1">
          {reviews.map((review) => (
            <div key={review.id} className="grid gap-3 rounded-md border border-border bg-background p-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate font-medium">{review.clientName}</p>
                  <p className="text-xs text-muted-foreground">
                    {selectedPhotographer?.name} · {formatDate(review.createdAt)}
                  </p>
                </div>
                <span className="shrink-0 rounded-md bg-secondary px-2 py-1 text-sm">
                  {review.rating} / 5
                </span>
              </div>
              <p className="text-sm text-muted-foreground">
                {review.comment || "Без комментария"}
              </p>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="justify-self-start"
                disabled={disabled}
                onClick={() => {
                  const data = new FormData();
                  data.set("reviewId", review.id);
                  run(adminDeleteReviewAction, data);
                }}
              >
                Удалить отзыв
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function AdminStylesPool({
  styles,
  disabled,
  run
}: {
  styles: AdminManagementProps["styles"];
  disabled: boolean;
  run: (action: AdminAction, formData: FormData) => void;
}) {
  return (
    <div className="grid gap-4 rounded-lg border border-border bg-card p-4">
      <form
        className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto]"
        onSubmit={(event) => {
          event.preventDefault();
          run(adminCreateStyleAction, new FormData(event.currentTarget));
          event.currentTarget.reset();
        }}
      >
        <input
          name="name"
          required
          className="min-h-11 min-w-0 rounded-md border border-input bg-background px-3 outline-none"
          placeholder="Новый тег, например: Reels"
        />
        <Button disabled={disabled}>Добавить тег</Button>
      </form>

      {styles.length === 0 ? (
        <Empty text="Тегов пока нет." />
      ) : (
        <div className="grid max-h-[620px] gap-3 overflow-y-auto pr-1">
          {styles.map((style) => (
            <div
              key={style.id}
              className="grid gap-3 rounded-md border border-border bg-background p-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center"
            >
              <div className="min-w-0">
                <p className="break-words font-medium">{style.name}</p>
                <p className="break-words text-xs text-muted-foreground">
                  {style.slug} · фотографов: {style.photographersCount} · броней: {style.bookingsCount}
                </p>
              </div>
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={disabled}
                onClick={() => {
                  const data = new FormData();
                  data.set("styleId", style.id);
                  run(adminDeleteStyleAction, data);
                }}
              >
                Удалить
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function AdminEditorTagsPool({
  editorTags,
  disabled,
  run
}: {
  editorTags: AdminManagementProps["editorTags"];
  disabled: boolean;
  run: (action: AdminAction, formData: FormData) => void;
}) {
  return (
    <div className="grid gap-4 rounded-lg border border-border bg-card p-4">
      <form
        className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto]"
        onSubmit={(event) => {
          event.preventDefault();
          run(adminCreateEditorTagAction, new FormData(event.currentTarget));
          event.currentTarget.reset();
        }}
      >
        <input name="name" required className="min-h-11 min-w-0 rounded-md border border-input bg-background px-3 outline-none" placeholder="Новый тег, например: Color grading" />
        <Button disabled={disabled}>Добавить тег</Button>
      </form>
      {editorTags.length === 0 ? <Empty text="Тегов монтажеров пока нет." /> : (
        <div className="grid max-h-[620px] gap-3 overflow-y-auto pr-1">
          {editorTags.map((tag) => (
            <div key={tag.id} className="grid gap-3 rounded-md border border-border bg-background p-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
              <div className="min-w-0"><p className="break-words font-medium">{tag.name}</p><p className="break-words text-xs text-muted-foreground">{tag.slug} · монтажеров: {tag.editorsCount}</p></div>
              <Button type="button" size="sm" variant="outline" disabled={disabled} onClick={() => { const data = new FormData(); data.set("editorTagId", tag.id); run(adminDeleteEditorTagAction, data); }}>Удалить</Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function StudiosTable({
  studios,
  disabled,
  run
}: {
  studios: AdminManagementProps["studios"];
  disabled: boolean;
  run: (action: AdminAction, formData: FormData) => void;
}) {
  if (studios.length === 0) return <Empty text="Студий пока нет." />;

  return (
    <div className="overflow-x-auto rounded-lg border border-border bg-card">
      <table className="w-full min-w-[900px] text-left text-sm">
        <thead className="border-b border-border bg-secondary/60 text-muted-foreground">
          <tr>
            {["Название", "Город", "Залы", "Брони", "Статус", "Действия"].map((item) => (
              <th key={item} className="px-4 py-3 font-medium">{item}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {studios.map((studio) => (
            <tr key={studio.id} className="border-b border-border last:border-0">
              <td className="px-4 py-3 font-medium">{studio.name}</td>
              <td className="px-4 py-3">{studio.city}</td>
              <td className="px-4 py-3">{studio.hallsCount}</td>
              <td className="px-4 py-3">{studio.bookingsCount}</td>
              <td className="px-4 py-3"><StatusBadge status={studio.status} /></td>
              <td className="px-4 py-3">
                <ProfileStatusActions
                  id={studio.id}
                  disabled={disabled}
                  action={updateStudioProfileStatusAction}
                  run={run}
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function BookingsTable({
  bookings,
  disabled,
  run
}: {
  bookings: Booking[];
  disabled: boolean;
  run: (action: AdminAction, formData: FormData) => void;
}) {
  if (bookings.length === 0) return <Empty text="Бронирований пока нет." />;

  return (
    <div className="overflow-x-auto rounded-lg border border-border bg-card">
      <table className="w-full min-w-[980px] text-left text-sm">
        <thead className="border-b border-border bg-secondary/60 text-muted-foreground">
          <tr>
            {["Booking", "Клиент", "Дата", "Тип", "Суммы", "Статус брони", "Оплата", "Действия"].map((item) => (
              <th key={item} className="px-4 py-3 font-medium">{item}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {bookings.map((booking) => {
            const hasReschedule = Boolean(booking.rescheduleRequestedAt);
            return (
              <Fragment key={booking.id}>
                <tr className={`border-b border-border last:border-0 ${hasReschedule ? "bg-amber-500/10" : ""}`}>
                  <td className="px-4 py-3 font-medium">
                    <div className="flex items-center gap-2">
                      {hasReschedule ? (
                        <span className="rounded-full bg-amber-400 px-2 py-0.5 text-xs font-bold text-black">!</span>
                      ) : null}
                      {booking.id}
                    </div>
                  </td>
                  <td className="px-4 py-3">{booking.clientName}</td>
                  <td className="px-4 py-3">{booking.date} · {booking.time}</td>
                  <td className="px-4 py-3"><StatusBadge status={booking.bookingType ?? "FULL_SHOOT"} /></td>
                  <td className="px-4 py-3">
                    <div className="grid gap-1">
                      {booking.bookingType === "FULL_SHOOT" ? (
                        <>
                          <span>Фотограф: {formatPrice(booking.photographerTotal)}</span>
                          <span>Студия: {formatPrice(booking.studioTotal)}</span>
                        </>
                      ) : (
                        <span>Услуга: {formatPrice(booking.totalServicePrice ?? booking.totalAmount)}</span>
                      )}
                      <span className="text-muted-foreground">
                        Сбор платформы: {formatPrice(booking.platformFeeAmount ?? booking.depositAmount)}
                      </span>
                      <span className="text-muted-foreground">Оплачено платформе: {formatPrice(booking.paidAmount)}</span>
                      <span className="text-emerald-200">
                        К выплате исполнителю: {formatPrice(booking.providerAmount ?? booking.remainingAmount)}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3"><StatusBadge status={booking.status} /></td>
                  <td className="px-4 py-3"><StatusBadge status={booking.paymentStatus} /></td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-2">
                      {["PENDING", "CONFIRMED", "IN_PROGRESS", "COMPLETED", "CANCELLED", "DECLINED"].map((status) => (
                        <Button
                          key={status}
                          size="sm"
                          variant="outline"
                          disabled={disabled}
                          onClick={() => {
                            const data = new FormData();
                            data.set("bookingId", booking.dbId ?? booking.id);
                            data.set("status", status);
                            run(adminUpdateBookingStatusAction, data);
                          }}
                        >
                          {status}
                        </Button>
                      ))}
                    </div>
                  </td>
                </tr>
                {hasReschedule ? (
                  <tr className="border-b border-amber-400/30 bg-amber-500/10">
                    <td className="px-4 py-3" colSpan={8}>
                      <div className="rounded-lg border border-amber-400/40 bg-amber-500/10 p-4 text-amber-100">
                        <p className="font-semibold">Запрос на перенос</p>
                        <p className="mt-1 whitespace-pre-line text-sm text-amber-50/90">
                          {booking.rescheduleComment ?? "Клиент запросил перенос без комментария."}
                        </p>
                      </div>
                    </td>
                  </tr>
                ) : null}
                {booking.bookingType === "PHOTOGRAPHER_ONLY" ? (
                  <tr className="border-b border-border bg-secondary/30">
                    <td className="px-4 py-3" colSpan={8}>
                      <div className="grid gap-2 text-sm md:grid-cols-4">
                        <AdminBrief label="Тип съемки" value={booking.shootType ?? "-"} />
                        <AdminBrief label="Локация" value={booking.locationType ?? "-"} />
                        <AdminBrief label="Город/район" value={[booking.city, booking.district].filter(Boolean).join(", ") || "-"} />
                        <AdminBrief label="Людей" value={booking.peopleCount ? String(booking.peopleCount) : "-"} />
                        <AdminBrief label="Описание" value={booking.shootDescription ?? "-"} />
                        <AdminBrief label="Адрес" value={booking.addressDetails ?? "-"} />
                        <AdminBrief label="Оборудование" value={booking.equipmentNeeded?.join(", ") ?? "-"} />
                        <AdminBrief label="Требования" value={booking.specialRequirements ?? "-"} />
                      </div>
                    </td>
                  </tr>
                ) : null}
                {booking.bookingType === "STUDIO_ONLY" ? (
                  <tr className="border-b border-border bg-secondary/30">
                    <td className="px-4 py-3" colSpan={8}>
                      <div className="grid gap-2 text-sm md:grid-cols-4">
                        <AdminBrief label="Цель аренды" value={booking.rentalPurpose ?? "-"} />
                        <AdminBrief label="Зал" value={booking.hallName} />
                        <AdminBrief label="Людей" value={booking.peopleCount ? String(booking.peopleCount) : "-"} />
                        <AdminBrief label="Оборудование" value={booking.needsEquipment ? "Нужно" : "Не нужно"} />
                        <AdminBrief label="Удобства" value={booking.selectedAmenities?.join(", ") ?? "-"} />
                        <AdminBrief label="Описание" value={booking.shootDescription ?? "-"} />
                        <AdminBrief label="Требования" value={booking.specialRequirements ?? "-"} />
                      </div>
                    </td>
                  </tr>
                ) : null}
              </Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function AdminBrief({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-border bg-background p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 font-medium">{value}</p>
    </div>
  );
}

function NotificationLogsTable({ notifications }: { notifications: AdminNotificationDTO[] }) {
  if (notifications.length === 0) return <Empty text="Уведомлений пока нет." />;

  return (
    <div className="overflow-x-auto rounded-lg border border-border bg-card">
      <table className="w-full min-w-[980px] text-left text-sm">
        <thead className="border-b border-border bg-secondary/60 text-muted-foreground">
          <tr>
            {["User", "Type", "Title", "Read", "Created", "Delivery logs"].map((header) => (
              <th key={header} className="px-4 py-3 font-medium">{header}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {notifications.map((notification) => (
            <tr key={notification.id} className="border-b border-border last:border-0">
              <td className="px-4 py-3">
                <span className="font-medium">{notification.userName}</span>
              </td>
              <td className="px-4 py-3">{notification.type}</td>
              <td className="px-4 py-3">{notification.title}</td>
              <td className="px-4 py-3">{notification.isRead ? "Read" : "Unread"}</td>
              <td className="px-4 py-3">{notification.createdAt}</td>
              <td className="px-4 py-3">
                <div className="grid gap-1">
                  {notification.deliveryLogs.map((log, index) => (
                    <span key={`${notification.id}-${index}`} className="text-xs text-muted-foreground">
                      {log.channel}: {log.status}{log.provider ? ` · ${log.provider}` : ""}
                    </span>
                  ))}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function PaymentsTable({
  payments,
  disabled,
  run
}: {
  payments: PaymentDTO[];
  disabled: boolean;
  run: (action: AdminAction, formData: FormData) => void;
}) {
  if (payments.length === 0) return <Empty text="Платежей пока нет." />;

  return (
    <div className="overflow-x-auto rounded-lg border border-border bg-card">
      <table className="w-full min-w-[980px] text-left text-sm">
        <thead className="border-b border-border bg-secondary/60 text-muted-foreground">
          <tr>
            {["Payment", "Booking", "Клиент", "Amount", "Provider", "Type", "Status", "Created", "Действия"].map((header) => (
              <th key={header} className="px-4 py-3 font-medium">{header}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {payments.map((payment) => (
            <tr key={payment.id} className="border-b border-border last:border-0">
              <td className="px-4 py-3 font-mono text-xs">{payment.id}</td>
              <td className="px-4 py-3 font-medium">{payment.bookingNumber}</td>
              <td className="px-4 py-3">{payment.clientName}</td>
              <td className="px-4 py-3">{formatPrice(payment.amount)} {payment.currency}</td>
              <td className="px-4 py-3">{payment.provider}</td>
              <td className="px-4 py-3">{payment.type}</td>
              <td className="px-4 py-3">{payment.status}</td>
              <td className="px-4 py-3">{payment.createdAt}</td>
              <td className="px-4 py-3">
                <div className="flex flex-wrap gap-2">
                  <PaymentAction label="Mark failed" paymentId={payment.id} disabled={disabled || payment.status === "FAILED"} action={adminMarkPaymentAsFailedAction} run={run} />
                  <PaymentAction label="Cancel" paymentId={payment.id} disabled={disabled || payment.status !== "PENDING"} action={adminCancelPaymentAction} run={run} />
                  <PaymentAction label="Manual refund" paymentId={payment.id} disabled={disabled || payment.status !== "PAID"} action={adminRefundPaymentAction} run={run} />
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function WebhookLogsTable({ logs }: { logs: PaymentWebhookLogDTO[] }) {
  if (logs.length === 0) return <Empty text="Webhook событий пока нет." />;

  return (
    <div className="overflow-x-auto rounded-lg border border-border bg-card">
      <table className="w-full min-w-[980px] text-left text-sm">
        <thead className="border-b border-border bg-secondary/60 text-muted-foreground">
          <tr>
            {["Created", "Provider", "Event", "Provider payment", "Signature", "Processed", "Error"].map((header) => (
              <th key={header} className="px-4 py-3 font-medium">{header}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {logs.map((log) => (
            <tr key={log.id} className="border-b border-border last:border-0">
              <td className="px-4 py-3">{new Date(log.createdAt).toLocaleString("ru-RU")}</td>
              <td className="px-4 py-3">{log.provider}</td>
              <td className="px-4 py-3">{log.eventType}</td>
              <td className="px-4 py-3 font-mono text-xs">{log.providerPaymentId ?? "-"}</td>
              <td className="px-4 py-3">{log.signatureValid ? "Valid" : "Invalid"}</td>
              <td className="px-4 py-3">{log.processed ? "Yes" : "No"}</td>
              <td className="px-4 py-3 text-rose-300">{log.processingError ?? "-"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function PaymentAction({
  label,
  paymentId,
  disabled,
  action,
  run
}: {
  label: string;
  paymentId: string;
  disabled: boolean;
  action: AdminAction;
  run: (action: AdminAction, formData: FormData) => void;
}) {
  return (
    <Button
      size="sm"
      variant="outline"
      disabled={disabled}
      onClick={() => {
        const data = new FormData();
        data.set("paymentId", paymentId);
        run(action, data);
      }}
    >
      {label}
    </Button>
  );
}

function ProfileStatusActions({
  id,
  disabled,
  action,
  run
}: {
  id: string;
  disabled: boolean;
  action: AdminAction;
  run: (action: AdminAction, formData: FormData) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {[
        ["PUBLISHED", "Approve"],
        ["BLOCKED", "Block"]
      ].map(([status, label]) => (
        <Button
          key={status}
          size="sm"
          variant={status === "PUBLISHED" ? "default" : "outline"}
          disabled={disabled}
          onClick={() => {
            const data = new FormData();
            data.set("id", id);
            data.set("status", status);
            run(action, data);
          }}
        >
          {label}
        </Button>
      ))}
    </div>
  );
}

function AdminSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section>
      <h2 className="mb-4 text-2xl font-semibold tracking-normal">{title}</h2>
      {children}
    </section>
  );
}

function SimpleTable({
  headers,
  rows,
  empty
}: {
  headers: string[];
  rows: string[][];
  empty: string;
}) {
  if (rows.length === 0) return <Empty text={empty} />;

  return (
    <div className="overflow-x-auto rounded-lg border border-border bg-card">
      <table className="w-full min-w-[760px] text-left text-sm">
        <thead className="border-b border-border bg-secondary/60 text-muted-foreground">
          <tr>{headers.map((header) => <th key={header} className="px-4 py-3 font-medium">{header}</th>)}</tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={index} className="border-b border-border last:border-0">
              {row.map((cell, cellIndex) => (
                <td key={`${index}-${cellIndex}`} className="px-4 py-3">{cell}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
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

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return date.toLocaleDateString("ru-RU");
}

function getDateInputValue(date = new Date()) {
  return date.toISOString().slice(0, 10);
}

function Empty({ text }: { text: string }) {
  return (
    <div className="rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
      {text}
    </div>
  );
}
