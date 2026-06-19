"use client";

import Link from "next/link";
import { Camera, LayoutDashboard, LogIn, UserPlus } from "lucide-react";
import { SessionProvider, useSession } from "next-auth/react";
import { useEffect, useState } from "react";
import { SignOutButton } from "@/components/auth/sign-out-button";
import { NotificationBell } from "@/components/notifications/NotificationBell";
import { Button } from "@/components/ui/button";
import type { NotificationDTO } from "@/lib/notifications/types";

const navItems = [
  { href: "/booking/new?type=FULL_SHOOT", label: "Фотосессия под ключ" },
  { href: "/photographers?mode=booking", label: "Фотографы" },
  { href: "/studios?mode=booking", label: "Студии" }
];

export function Header() {
  return (
    <SessionProvider refetchOnWindowFocus={false}>
      <HeaderContent />
    </SessionProvider>
  );
}

function HeaderContent() {
  const { data: session, status } = useSession();
  const [notifications, setNotifications] = useState<NotificationDTO[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const dashboardHref = getDashboardHref(session?.user.role);
  const dashboardLabel = session?.user.role === "CLIENT" ? "Мои брони" : "Кабинет";

  useEffect(() => {
    if (status !== "authenticated") {
      setNotifications([]);
      setUnreadCount(0);
      return;
    }

    const controller = new AbortController();

    fetch("/api/notifications/header", { signal: controller.signal })
      .then((response) => (response.ok ? response.json() : undefined))
      .then((data: { notifications: NotificationDTO[]; unreadCount: number } | undefined) => {
        if (!data) return;
        setNotifications(data.notifications);
        setUnreadCount(data.unreadCount);
      })
      .catch((error: unknown) => {
        if (error instanceof Error && error.name !== "AbortError") {
          console.error("Unable to load header notifications", error);
        }
      });

    return () => controller.abort();
  }, [status]);

  return (
    <header className="sticky top-0 z-50 border-b border-border/80 bg-background/90 backdrop-blur">
      <div className="container flex h-16 items-center justify-between gap-4">
        <Link href="/" className="flex items-center gap-2 font-semibold">
          <span className="flex size-9 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <Camera className="size-5" aria-hidden="true" />
          </span>
          <span>Framely</span>
        </Link>
        <nav className="hidden items-center gap-6 text-sm text-muted-foreground md:flex">
          {navItems.map((item) => (
            <Link key={item.href} href={item.href} className="hover:text-foreground">
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="flex min-w-[188px] items-center justify-end gap-2">
          {status === "loading" ? (
            <HeaderActionsPlaceholder />
          ) : session?.user ? (
            <>
              <span className="hidden text-right text-xs text-muted-foreground sm:block">
                <span className="block font-medium text-foreground">{session.user.name}</span>
                {session.user.email}
              </span>
              <Button asChild variant="outline" size="sm">
                <Link href={dashboardHref}>
                  <LayoutDashboard className="size-4" aria-hidden="true" />
                  {dashboardLabel}
                </Link>
              </Button>
              <NotificationBell notifications={notifications} unreadCount={unreadCount} />
              <SignOutButton />
            </>
          ) : (
            <>
              <Button asChild variant="ghost" size="sm" className="hidden sm:inline-flex">
                <Link href="/auth/sign-in">
                  <LogIn className="size-4" aria-hidden="true" />
                  Войти
                </Link>
              </Button>
              <Button asChild variant="outline" size="sm">
                <Link href="/auth/sign-up">
                  <UserPlus className="size-4" aria-hidden="true" />
                  Регистрация
                </Link>
              </Button>
            </>
          )}
        </div>
      </div>
    </header>
  );
}

function HeaderActionsPlaceholder() {
  return (
    <div className="flex items-center gap-2" aria-hidden="true">
      <span className="hidden h-8 w-16 animate-pulse rounded-md bg-muted sm:block" />
      <span className="h-8 w-28 animate-pulse rounded-md bg-muted" />
    </div>
  );
}

function getDashboardHref(role?: string) {
  switch (role) {
    case "CLIENT":
      return "/dashboard/client";
    case "PHOTOGRAPHER":
      return "/dashboard/photographer";
    case "STUDIO_OWNER":
      return "/dashboard/studio";
    case "ADMIN":
      return "/admin";
    default:
      return "/";
  }
}
