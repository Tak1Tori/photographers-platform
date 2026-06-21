"use client";

import { useRouter } from "next/navigation";
import { Fragment, useState, useTransition } from "react";
import {
  adminCancelPaymentAction,
  adminMarkPaymentAsFailedAction,
  adminRefundPaymentAction,
  adminUpdateBookingStatusAction,
  updatePhotographerProfileStatusAction,
  updateStudioProfileStatusAction
} from "@/app/admin/actions";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/dashboard/status-badge";
import { formatPrice } from "@/lib/mock-data";
import type {
  AdminNotificationDTO,
  Booking,
  PaymentDTO,
  PaymentStatus,
  PaymentWebhookLogDTO
} from "@/lib/types";

type ActionState = { success: boolean; message: string } | null;

interface AdminManagementProps {
  databaseReady: boolean;
  users: Array<{ id: string; name: string; email: string; phone?: string | null; role: string; createdAt: string }>;
  photographers: Array<{
    id: string;
    name: string;
    city: string;
    email: string;
    status: "Draft" | "Published" | "Blocked";
    styles: string[];
    bookingsCount: number;
    portfolioCount: number;
  }>;
  studios: Array<{
    id: string;
    name: string;
    city: string;
    email: string;
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
  const [paymentStatus, setPaymentStatus] = useState<"All" | PaymentStatus>("All");
  const [notificationType, setNotificationType] = useState("All");
  const [notificationRead, setNotificationRead] = useState<"All" | "Unread" | "Read">("All");
  const notificationTypes = ["All", ...Array.from(new Set(notificationLogs.map((item) => item.type)))];
  const filteredNotificationLogs = notificationLogs.filter((notification) => {
    const typeMatches = notificationType === "All" || notification.type === notificationType;
    const readMatches =
      notificationRead === "All" ||
      (notificationRead === "Read" ? notification.isRead : !notification.isRead);
    return typeMatches && readMatches;
  });

  function run(action: (formData: FormData) => Promise<{ success: boolean; error?: string }>, formData: FormData) {
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
      {state ? <Notice tone={state.success ? "success" : "error"} message={state.message} /> : null}

      <AdminSection title="Users">
        <SimpleTable
          empty="Пользователей пока нет."
          headers={["Имя", "Email", "Телефон", "Роль", "Created"]}
          rows={users.map((user) => [
            user.name,
            user.email,
            user.phone ?? "-",
            user.role,
            user.createdAt
          ])}
        />
      </AdminSection>

      <AdminSection title="Photographers">
        {photographers.length === 0 ? <Empty text="Фотографов пока нет." /> : (
          <div className="overflow-x-auto rounded-lg border border-border bg-card">
            <table className="w-full min-w-[900px] text-left text-sm">
              <thead className="border-b border-border bg-secondary/60 text-muted-foreground">
                <tr>
                  {["Имя", "Email", "Город", "Стили", "Портфолио", "Брони", "Статус", "Действия"].map((item) => (
                    <th key={item} className="px-4 py-3 font-medium">{item}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {photographers.map((profile) => (
                  <tr key={profile.id} className="border-b border-border last:border-0">
                    <td className="px-4 py-3 font-medium">{profile.name}</td>
                    <td className="px-4 py-3">{profile.email}</td>
                    <td className="px-4 py-3">{profile.city}</td>
                    <td className="px-4 py-3">{profile.styles.join(", ") || "-"}</td>
                    <td className="px-4 py-3">{profile.portfolioCount}</td>
                    <td className="px-4 py-3">{profile.bookingsCount}</td>
                    <td className="px-4 py-3"><StatusBadge status={profile.status} /></td>
                    <td className="px-4 py-3">
                      <ProfileStatusActions
                        id={profile.id}
                        disabled={isPending || !databaseReady}
                        action={updatePhotographerProfileStatusAction}
                        run={run}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </AdminSection>

      <AdminSection title="Studios">
        {studios.length === 0 ? <Empty text="Студий пока нет." /> : (
          <div className="overflow-x-auto rounded-lg border border-border bg-card">
            <table className="w-full min-w-[900px] text-left text-sm">
              <thead className="border-b border-border bg-secondary/60 text-muted-foreground">
                <tr>
                  {["Название", "Owner", "Город", "Залы", "Брони", "Статус", "Действия"].map((item) => (
                    <th key={item} className="px-4 py-3 font-medium">{item}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {studios.map((studio) => (
                  <tr key={studio.id} className="border-b border-border last:border-0">
                    <td className="px-4 py-3 font-medium">{studio.name}</td>
                    <td className="px-4 py-3">{studio.email}</td>
                    <td className="px-4 py-3">{studio.city}</td>
                    <td className="px-4 py-3">{studio.hallsCount}</td>
                    <td className="px-4 py-3">{studio.bookingsCount}</td>
                    <td className="px-4 py-3"><StatusBadge status={studio.status} /></td>
                    <td className="px-4 py-3">
                      <ProfileStatusActions
                        id={studio.id}
                        disabled={isPending || !databaseReady}
                        action={updateStudioProfileStatusAction}
                        run={run}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </AdminSection>

      <AdminSection title="Studio halls">
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

      <AdminSection title="Bookings">
        {bookings.length === 0 ? <Empty text="Бронирований пока нет." /> : (
          <div className="overflow-x-auto rounded-lg border border-border bg-card">
            <table className="w-full min-w-[940px] text-left text-sm">
              <thead className="border-b border-border bg-secondary/60 text-muted-foreground">
                <tr>
                  {["Booking", "Клиент", "Дата", "Тип", "Суммы", "Статус", "Оплата", "Действия"].map((item) => (
                    <th key={item} className="px-4 py-3 font-medium">{item}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {bookings.map((booking) => (
                  <Fragment key={booking.id}>
                  <tr className="border-b border-border last:border-0">
                    <td className="px-4 py-3 font-medium">{booking.id}</td>
                    <td className="px-4 py-3">{booking.clientName}</td>
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
                      <div className="flex flex-wrap gap-2">
                        {["PENDING", "CONFIRMED", "IN_PROGRESS", "COMPLETED", "CANCELLED", "DECLINED"].map((status) => (
                          <Button
                            key={status}
                            size="sm"
                            variant="outline"
                            disabled={isPending || !databaseReady}
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
                ))}
              </tbody>
            </table>
          </div>
        )}
      </AdminSection>

      <AdminSection title="Payments">
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

      <AdminSection title="Notification Logs">
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

      <AdminSection title="Webhook Logs">
        <WebhookLogsTable logs={webhookLogs} />
      </AdminSection>
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
                <span className="block text-xs text-muted-foreground">{notification.userEmail}</span>
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
  run: (action: (formData: FormData) => Promise<{ success: boolean; error?: string }>, formData: FormData) => void;
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
  action: (formData: FormData) => Promise<{ success: boolean; error?: string }>;
  run: (action: (formData: FormData) => Promise<{ success: boolean; error?: string }>, formData: FormData) => void;
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
  action: (formData: FormData) => Promise<{ success: boolean; error?: string }>;
  run: (action: (formData: FormData) => Promise<{ success: boolean; error?: string }>, formData: FormData) => void;
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

function AdminSection({ title, children }: { title: string; children: React.ReactNode }) {
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

function Empty({ text }: { text: string }) {
  return (
    <div className="rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
      {text}
    </div>
  );
}
