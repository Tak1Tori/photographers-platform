"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { markAllNotificationsAsReadAction } from "@/app/dashboard/notifications/actions";
import { NotificationItem } from "@/components/notifications/NotificationItem";
import { Button } from "@/components/ui/button";
import type { NotificationDTO } from "@/lib/notifications/types";

export function NotificationsDropdown({
  notifications,
  onClose
}: {
  notifications: NotificationDTO[];
  onClose: () => void;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function markAll() {
    startTransition(async () => {
      await markAllNotificationsAsReadAction();
      router.refresh();
    });
  }

  return (
    <div className="absolute right-0 top-12 z-50 w-[min(92vw,380px)] rounded-lg border border-border bg-card p-3 shadow-lg">
      <div className="flex items-center justify-between gap-3 border-b border-border pb-3">
        <div>
          <p className="font-semibold tracking-normal">Уведомления</p>
          <p className="text-xs text-muted-foreground">Последние события платформы</p>
        </div>
        <Button type="button" variant="ghost" size="sm" onClick={onClose}>Закрыть</Button>
      </div>
      <div className="max-h-[430px] overflow-y-auto py-3">
        {notifications.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
            Уведомлений пока нет.
          </div>
        ) : (
          <div className="grid gap-2">
            {notifications.slice(0, 7).map((notification) => (
              <NotificationItem key={notification.id} notification={notification} compact />
            ))}
          </div>
        )}
      </div>
      <div className="flex flex-wrap justify-between gap-2 border-t border-border pt-3">
        <Button asChild variant="outline" size="sm" onClick={onClose}>
          <Link href="/dashboard/notifications">Все уведомления</Link>
        </Button>
        <Button type="button" size="sm" disabled={isPending || notifications.length === 0} onClick={markAll}>
          Отметить все
        </Button>
      </div>
    </div>
  );
}
