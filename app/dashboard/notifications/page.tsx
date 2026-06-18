import Link from "next/link";
import { Bell } from "lucide-react";
import { MarkAllNotificationsButton } from "@/components/notifications/MarkAllNotificationsButton";
import { NotificationItem } from "@/components/notifications/NotificationItem";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getUserNotifications } from "@/lib/notifications/notification-service";
import { requireSession } from "@/lib/guards";

export const dynamic = "force-dynamic";

type NotificationFilter = "All" | "Unread" | "Read";

const filters: NotificationFilter[] = ["All", "Unread", "Read"];

interface NotificationsPageProps {
  searchParams: {
    filter?: NotificationFilter;
  };
}

export default async function NotificationsPage({ searchParams }: NotificationsPageProps) {
  const session = await requireSession();
  const activeFilter = filters.includes(searchParams.filter ?? "All")
    ? searchParams.filter ?? "All"
    : "All";
  const notifications = await getUserNotifications(session.user.id);
  const visibleNotifications = notifications.filter((notification) => {
    if (activeFilter === "Unread") return !notification.isRead;
    if (activeFilter === "Read") return notification.isRead;
    return true;
  });

  return (
    <>
      <PageHeader
        eyebrow="Notifications"
        title="Уведомления"
        description="Важные события по вашим броням, оплатам и кабинетам."
      />
      <section className="section">
        <div className="container grid gap-6">
          <Card>
            <CardHeader className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
              <CardTitle className="flex items-center gap-2">
                <Bell className="size-5" aria-hidden="true" />
                Центр уведомлений
              </CardTitle>
              <MarkAllNotificationsButton disabled={notifications.length === 0} />
            </CardHeader>
            <CardContent className="flex flex-wrap gap-2">
              {filters.map((filter) => (
                <Button
                  key={filter}
                  asChild
                  size="sm"
                  variant={activeFilter === filter ? "default" : "outline"}
                >
                  <Link href={filter === "All" ? "/dashboard/notifications" : `/dashboard/notifications?filter=${filter}`}>
                    {filter}
                  </Link>
                </Button>
              ))}
            </CardContent>
          </Card>

          {visibleNotifications.length === 0 ? (
            <EmptyState
              title="Уведомлений пока нет"
              description="Когда появятся события по броням или оплатам, они будут отображаться здесь."
              actionLabel="Вернуться в кабинет"
              actionHref="/dashboard"
            />
          ) : (
            <div className="grid gap-3">
              {visibleNotifications.map((notification) => (
                <NotificationItem key={notification.id} notification={notification} />
              ))}
            </div>
          )}
        </div>
      </section>
    </>
  );
}
