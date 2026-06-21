import { Banknote, CalendarDays, Camera, CircleDollarSign, Clock3, Percent, Store } from "lucide-react";
import { AdminManagement } from "@/components/dashboard/admin-management";
import { DashboardCard } from "@/components/dashboard/dashboard-card";
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  formatPrice,
  mockAdminStats,
} from "@/lib/mock-data";
import {
  getAdminNotificationLogs,
  getAdminPayments,
  getAdminPaymentWebhookLogs,
  getAdminPhotographerProfiles,
  getAdminStudioHalls,
  getAdminStudioProfiles,
  getAdminUsers
} from "@/lib/data/admin";
import { getAllBookings } from "@/lib/data/bookings";
import { canUseDatabase } from "@/lib/data/db";
import { getAdminStats } from "@/lib/data/dashboard";
import { requireSession } from "@/lib/guards";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  await requireSession(["ADMIN"]);
  const bookings = await getAllBookings();
  const stats = await getAdminStats();
  const [users, photographers, studios, halls, payments, webhookLogs, notificationLogs] = await Promise.all([
    getAdminUsers(),
    getAdminPhotographerProfiles(),
    getAdminStudioProfiles(),
    getAdminStudioHalls(),
    getAdminPayments(),
    getAdminPaymentWebhookLogs(),
    getAdminNotificationLogs()
  ]);
  const photographerCommission = bookings.reduce(
    (sum, booking) => sum + booking.photographerTotal * mockAdminStats.photographerCommissionRate,
    0
  );
  const studioCommission = bookings.reduce(
    (sum, booking) => sum + booking.studioTotal * mockAdminStats.studioCommissionRate,
    0
  );
  const platformRevenue = stats.serviceFee + photographerCommission + studioCommission;

  return (
    <>
      <PageHeader
        eyebrow="Admin"
        title="Административная панель"
        description="Операционное управление бронированиями, партнерами и финансовыми метриками marketplace."
      />
      <section className="section">
        <div className="container grid gap-8">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            <DashboardCard
              label="Всего бронирований"
              value={String(stats.totalBookings)}
              icon={CalendarDays}
            />
            <DashboardCard
              label="Pending bookings"
              value={String(stats.pendingBookings)}
              icon={Clock3}
            />
            <DashboardCard
              label="Активных фотографов"
              value={String(stats.activePhotographers)}
              icon={Camera}
            />
            <DashboardCard
              label="Активных студий"
              value={String(stats.activeStudios)}
              icon={Store}
            />
            <DashboardCard label="Примерный GMV" value={formatPrice(stats.gmv)} icon={Banknote} />
            <DashboardCard
              label="Комиссия платформы"
              value={formatPrice(platformRevenue)}
              icon={CircleDollarSign}
            />
          </div>

          <AdminManagement
            databaseReady={canUseDatabase() || process.env.NODE_ENV === "development"}
            users={users.map((user) => ({
              id: user.id,
              name: user.name,
              email: user.email,
              phone: user.phone,
              role: user.role,
              createdAt: user.createdAt.toISOString().slice(0, 10)
            }))}
            photographers={photographers.map((profile) => ({
              id: profile.id,
              name: profile.name,
              city: profile.city,
              email: profile.user.email,
              status: mapProfileStatus(profile.status),
              styles: profile.styles.map((style) => style.name),
              bookingsCount: profile.bookings.length,
              portfolioCount: profile.portfolioItems.length
            }))}
            studios={studios.map((studio) => ({
              id: studio.id,
              name: studio.name,
              city: studio.city,
              email: studio.owner.email,
              status: mapProfileStatus(studio.status),
              hallsCount: studio.halls.length,
              bookingsCount: studio.bookings.length
            }))}
            halls={halls.map((hall) => ({
              id: hall.id,
              studioName: hall.studio.name,
              name: hall.name,
              capacity: hall.capacity,
              hourlyRate: hall.hourlyRate,
              status: hall.status === "ACTIVE" ? "Active" : "Inactive"
            }))}
            bookings={bookings}
            payments={payments.map((payment) => ({
              id: payment.id,
              bookingNumber: payment.booking.bookingNumber,
              clientName: payment.booking.clientName,
              amount: payment.amount,
              currency: payment.currency,
              status: payment.status,
              provider: payment.provider,
              type: payment.type,
              createdAt: payment.createdAt.toISOString().slice(0, 10)
            }))}
            webhookLogs={webhookLogs.map((log) => ({
              id: log.id,
              provider: log.provider,
              eventType: log.eventType,
              providerPaymentId: log.providerPaymentId ?? undefined,
              paymentId: log.paymentId ?? undefined,
              bookingId: log.bookingId ?? undefined,
              signatureValid: log.signatureValid,
              processed: log.processed,
              processingError: log.processingError ?? undefined,
              createdAt: log.createdAt.toISOString()
            }))}
            notificationLogs={notificationLogs.map((notification) => ({
              id: notification.id,
              userName: notification.user.name,
              userEmail: notification.user.email,
              type: notification.type,
              title: notification.title,
              isRead: notification.isRead,
              createdAt: notification.createdAt.toISOString().slice(0, 10),
              deliveryLogs: notification.deliveryLogs.map((log) => ({
                channel: log.channel,
                status: log.status,
                provider: log.provider ?? undefined,
                errorMessage: log.errorMessage ?? undefined,
                createdAt: log.createdAt.toISOString().slice(0, 10)
              }))
            }))}
          />

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Percent className="size-5" aria-hidden="true" />
                Platform revenue
              </CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3 text-sm md:grid-cols-2 lg:grid-cols-5">
              <RevenueItem label="GMV" value={formatPrice(stats.gmv)} />
              <RevenueItem
                label="Photographer commission"
                value={formatPrice(photographerCommission)}
              />
              <RevenueItem label="Studio commission" value={formatPrice(studioCommission)} />
              <RevenueItem label="Service fee" value={formatPrice(stats.serviceFee)} />
              <RevenueItem
                label="Estimated platform revenue"
                value={formatPrice(platformRevenue)}
                strong
              />
            </CardContent>
          </Card>
        </div>
      </section>
    </>
  );
}

function mapProfileStatus(status: string): "Draft" | "Published" | "Blocked" {
  const map: Record<string, "Draft" | "Published" | "Blocked"> = {
    DRAFT: "Draft",
    PUBLISHED: "Published",
    BLOCKED: "Blocked"
  };
  return map[status] ?? "Draft";
}

function RevenueItem({
  label,
  value,
  strong = false
}: {
  label: string;
  value: string;
  strong?: boolean;
}) {
  return (
    <div className="rounded-lg border border-border p-4">
      <p className="text-muted-foreground">{label}</p>
      <p className={`mt-2 ${strong ? "text-lg font-semibold" : "font-medium"}`}>{value}</p>
    </div>
  );
}
