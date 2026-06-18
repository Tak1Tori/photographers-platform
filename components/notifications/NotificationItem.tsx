"use client";

import Link from "next/link";
import { useTransition } from "react";
import { markNotificationAsReadAction } from "@/app/dashboard/notifications/actions";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { NotificationDTO } from "@/lib/notifications/types";

export function NotificationItem({
  notification,
  compact = false
}: {
  notification: NotificationDTO;
  compact?: boolean;
}) {
  const [isPending, startTransition] = useTransition();

  function markRead() {
    startTransition(async () => {
      await markNotificationAsReadAction(notification.id);
    });
  }

  const content = (
    <div
      className={cn(
        "grid gap-1 rounded-md border border-border p-3 transition-colors",
        notification.isRead ? "bg-card" : "bg-secondary/70",
        notification.linkUrl ? "hover:bg-secondary" : ""
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <span className="inline-flex rounded-md bg-background px-2 py-1 text-[11px] font-medium text-muted-foreground">
            {notification.type}
          </span>
          <h3 className="mt-2 text-sm font-semibold tracking-normal">{notification.title}</h3>
        </div>
        {!notification.isRead ? <span className="mt-1 size-2 rounded-full bg-rose-600" /> : null}
      </div>
      <p className={cn("text-sm text-muted-foreground", compact ? "line-clamp-2" : "")}>
        {notification.message}
      </p>
      <div className="flex flex-wrap items-center justify-between gap-2 pt-1 text-xs text-muted-foreground">
        <span>{formatDate(notification.createdAt)}</span>
        {!notification.isRead ? (
          <Button
            type="button"
            size="sm"
            variant="ghost"
            disabled={isPending}
            onClick={(event) => {
              event.preventDefault();
              markRead();
            }}
          >
            Прочитано
          </Button>
        ) : null}
      </div>
    </div>
  );

  if (!notification.linkUrl) return content;
  return <Link href={notification.linkUrl}>{content}</Link>;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("ru-RU", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(value));
}
