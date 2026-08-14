"use client";

import Link from "next/link";
import { useState } from "react";
import { CalendarCheck, LogIn, UserPlus, X } from "lucide-react";
import { Button } from "@/components/ui/button";

interface PhotographerBookingGateProps {
  href: string;
  isAuthenticated: boolean;
  label: "Забронировать фотографа" | "Выбрать услугу";
  size?: "sm" | "lg";
  className?: string;
}

export function PhotographerBookingGate({
  href,
  isAuthenticated,
  label,
  size,
  className
}: PhotographerBookingGateProps) {
  const [isOpen, setIsOpen] = useState(false);

  if (isAuthenticated) {
    return (
      <Button asChild size={size} className={className}>
        <Link href={href}>
          <CalendarCheck className="size-4" aria-hidden="true" />
          {label}
        </Link>
      </Button>
    );
  }

  const callbackUrl = encodeURIComponent(href);

  return (
    <>
      <Button size={size} className={className} onClick={() => setIsOpen(true)}>
        <CalendarCheck className="size-4" aria-hidden="true" />
        {label}
      </Button>
      {isOpen ? (
        <div
          className="fixed inset-0 z-50 grid place-items-center bg-black/55 p-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-labelledby="booking-auth-title"
          onMouseDown={() => setIsOpen(false)}
        >
          <div
            className="w-full max-w-md rounded-lg border border-border bg-card p-6 shadow-xl"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 id="booking-auth-title" className="text-xl font-semibold tracking-normal">
                  Сначала войдите в аккаунт
                </h2>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  Чтобы {label === "Выбрать услугу" ? "выбрать услугу и продолжить бронирование" : "забронировать фотографа"}, нужно авторизироваться.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="grid size-9 shrink-0 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
                aria-label="Закрыть предупреждение"
              >
                <X className="size-5" aria-hidden="true" />
              </button>
            </div>
            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              <Button asChild>
                <Link href={`/auth/sign-in?callbackUrl=${callbackUrl}`}>
                  <LogIn className="size-4" aria-hidden="true" />
                  Войти
                </Link>
              </Button>
              <Button asChild variant="outline">
                <Link href="/auth/sign-up">
                  <UserPlus className="size-4" aria-hidden="true" />
                  Регистрация
                </Link>
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
