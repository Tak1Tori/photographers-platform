"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { markAllNotificationsAsReadAction } from "@/app/dashboard/notifications/actions";
import { Button } from "@/components/ui/button";

export function MarkAllNotificationsButton({ disabled = false }: { disabled?: boolean }) {
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [isPending, startTransition] = useTransition();

  function markAll() {
    setMessage("");
    startTransition(async () => {
      const result = await markAllNotificationsAsReadAction();
      setMessage(result.success ? result.message ?? "Готово." : result.error ?? "Ошибка.");
      if (result.success) router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-2 sm:items-end">
      <Button type="button" disabled={disabled || isPending} onClick={markAll}>
        {isPending ? "Обновляем..." : "Отметить все как прочитанные"}
      </Button>
      {message ? <p className="text-xs text-muted-foreground">{message}</p> : null}
    </div>
  );
}
