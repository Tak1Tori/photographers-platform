"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, X } from "lucide-react";
import { Button } from "@/components/ui/button";

export function SuccessToast({ message }: { message: string }) {
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    setIsVisible(true);
    const timeout = window.setTimeout(() => setIsVisible(false), 3600);
    return () => window.clearTimeout(timeout);
  }, [message]);

  if (!isVisible) return null;

  return (
    <div className="pointer-events-none fixed inset-x-4 bottom-5 z-[100] flex justify-center sm:inset-x-auto sm:left-1/2 sm:-translate-x-1/2">
      <div
        role="status"
        className="pointer-events-auto flex w-full max-w-md items-center gap-3 rounded-lg border border-primary/35 bg-card px-4 py-3 text-sm font-medium text-card-foreground shadow-xl shadow-black/20 animate-in fade-in slide-in-from-bottom-4 duration-300 sm:w-auto"
      >
        <CheckCircle2 className="size-5 shrink-0 text-primary" aria-hidden="true" />
        <span className="min-w-0 flex-1">{message}</span>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="size-7 shrink-0"
          onClick={() => setIsVisible(false)}
          aria-label="Закрыть уведомление"
        >
          <X className="size-4" aria-hidden="true" />
        </Button>
      </div>
    </div>
  );
}
