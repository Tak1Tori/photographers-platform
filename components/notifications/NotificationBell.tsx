"use client";

import { useEffect, useRef, useState } from "react";
import { Bell } from "lucide-react";
import { NotificationBadge } from "@/components/notifications/NotificationBadge";
import { NotificationsDropdown } from "@/components/notifications/NotificationsDropdown";
import { Button } from "@/components/ui/button";
import type { NotificationDTO } from "@/lib/notifications/types";

export function NotificationBell({
  notifications,
  unreadCount
}: {
  notifications: NotificationDTO[];
  unreadCount: number;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;

    function handlePointerDown(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    }

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  return (
    <div ref={rootRef} className="relative">
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="relative px-3"
        aria-label="Уведомления"
        onClick={() => setIsOpen((value) => !value)}
      >
        <Bell className="size-4" aria-hidden="true" />
        <NotificationBadge count={unreadCount} />
      </Button>
      {isOpen ? (
        <NotificationsDropdown
          notifications={notifications}
          onClose={() => setIsOpen(false)}
        />
      ) : null}
    </div>
  );
}
