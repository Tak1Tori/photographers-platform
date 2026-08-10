"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogIn, Menu, UserPlus, X } from "lucide-react";
import { SessionProvider, useSession } from "next-auth/react";
import { useEffect, useState } from "react";
import { NotificationBell } from "@/components/notifications/NotificationBell";
import { BrandLogo } from "@/components/layout/brand-logo";
import { ThemePullToggle } from "@/components/layout/theme-pull-toggle";
import { Button } from "@/components/ui/button";
import type { NotificationDTO } from "@/lib/notifications/types";

const navItems = [
  {
    href: "/photographers?mode=booking",
    label: "Фотографы",
    sectionPath: "/photographers"
  },
  {
    href: "/editors",
    label: "Монтажеры",
    sectionPath: "/editors"
  }
];
const defaultAvatarUrl = "/images/default-avatar.png";

export function Header() {
  return (
    <SessionProvider refetchOnWindowFocus={false}>
      <HeaderContent />
    </SessionProvider>
  );
}

function HeaderContent() {
  const pathname = usePathname();
  const { data: session, status } = useSession();
  const [notifications, setNotifications] = useState<NotificationDTO[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const dashboardHref = getDashboardHref(session?.user.role);

  useEffect(() => {
    setIsMobileMenuOpen(false);
  }, [pathname]);

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
    <header className="sticky top-0 z-50 border-b border-border/80 bg-background/90 backdrop-blur md:border-b-0 md:bg-transparent md:backdrop-blur-none">
      <div className="desktop-header-capsule container relative flex h-20 items-center justify-between gap-4 md:mt-3 md:h-[4.5rem] md:w-[calc(100%-6rem)] md:max-w-[84rem] md:rounded-[1.5rem] md:border md:border-border/80 md:bg-card/95 md:px-5 md:shadow-[0_1.25rem_3rem_hsl(150_30%_2%/0.16)] md:backdrop-blur">
        <div className="mobile-theme-toggle md:hidden">
          <ThemePullToggle />
        </div>

        <Link
          href="/"
          className="absolute left-1/2 flex -translate-x-1/2 items-center md:hidden"
          aria-label="Framely"
        >
          <BrandLogo className="h-16 w-auto" priority sizes="114px" />
        </Link>

        <Link
          href="/"
          className="hidden items-center rounded-xl px-2 py-1 transition-opacity hover:opacity-75 md:flex"
          aria-label="Framely"
        >
          <BrandLogo className="h-10 w-auto" priority sizes="72px" />
        </Link>

        <nav className="absolute left-1/2 hidden -translate-x-1/2 items-center gap-8 text-base font-semibold text-muted-foreground md:flex">
          {navItems.map((item) => {
            const isActive = pathname.startsWith(item.sectionPath);

            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={isActive ? "page" : undefined}
                className={`relative flex h-[4.5rem] items-center transition-colors after:absolute after:inset-x-0 after:bottom-2.5 after:h-0.5 after:origin-center after:bg-primary after:shadow-[0_0_12px_hsl(var(--primary)/0.55)] after:transition-transform ${
                  isActive
                    ? "text-foreground after:scale-x-100"
                    : "hover:text-foreground after:scale-x-0"
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="hidden h-full min-w-0 items-center justify-end gap-2 overflow-visible md:flex">
          {status === "loading" ? (
            <>
              <HeaderActionsPlaceholder />
              <ThemePullToggle />
            </>
          ) : session?.user ? (
            <>
              <NotificationBell notifications={notifications} unreadCount={unreadCount} />
              <Link
                href={dashboardHref}
                className="relative flex size-9 items-center justify-center overflow-hidden rounded-full border border-border bg-secondary text-sm font-semibold text-foreground transition-colors hover:border-primary/60 hover:bg-primary/10"
                aria-label="Открыть личный кабинет"
                title={session.user.name ?? "Личный кабинет"}
              >
                <Image
                  src={session.user.image || defaultAvatarUrl}
                  alt=""
                  fill
                  sizes="36px"
                  className="object-cover"
                />
              </Link>
              <ThemePullToggle />
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
              <ThemePullToggle />
            </>
          )}
        </div>

        <button
          type="button"
          className="flex size-11 items-center justify-center rounded-md border border-transparent text-muted-foreground transition-colors hover:border-border hover:bg-secondary hover:text-foreground md:hidden"
          aria-label={isMobileMenuOpen ? "Закрыть меню" : "Открыть меню"}
          aria-expanded={isMobileMenuOpen}
          onClick={() => setIsMobileMenuOpen((value) => !value)}
        >
          {isMobileMenuOpen ? (
            <X className="size-7" aria-hidden="true" />
          ) : (
            <Menu className="size-8" aria-hidden="true" />
          )}
        </button>
      </div>

      {isMobileMenuOpen ? (
        <div className="border-t border-border/80 bg-background/95 shadow-[0_18px_44px_rgba(0,0,0,0.35)] backdrop-blur md:hidden">
          <div className="container grid gap-3 py-4">
            <nav className="grid gap-1 text-xl font-semibold leading-tight">
              {navItems.map((item) => {
                const isActive = pathname.startsWith(item.sectionPath);

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    aria-current={isActive ? "page" : undefined}
                    className={`relative flex items-center justify-between rounded-md px-1 py-4 text-muted-foreground transition-colors after:absolute after:inset-x-1 after:bottom-0 after:h-0.5 after:origin-left after:bg-primary after:shadow-[0_0_12px_hsl(var(--primary)/0.55)] after:transition-transform ${
                      isActive
                        ? "text-foreground after:scale-x-100"
                        : "hover:text-foreground after:scale-x-0"
                    }`}
                  >
                    {item.label}
                  </Link>
                );
              })}
            </nav>

            <div className="flex items-center gap-2 border-t border-border/70 pt-3">
              {status === "authenticated" && session?.user ? (
                <>
                  <NotificationBell notifications={notifications} unreadCount={unreadCount} />
                  <Link
                    href={dashboardHref}
                    className="flex h-10 flex-1 items-center justify-center rounded-md border border-border bg-secondary px-4 text-sm font-medium text-foreground"
                  >
                    Личный кабинет
                  </Link>
                </>
              ) : (
                <>
                  <Button asChild variant="outline" className="flex-1">
                    <Link href="/auth/sign-in">
                      <LogIn className="size-4" aria-hidden="true" />
                      Войти
                    </Link>
                  </Button>
                  <Button asChild className="flex-1">
                    <Link href="/auth/sign-up">
                      <UserPlus className="size-4" aria-hidden="true" />
                      Регистрация
                    </Link>
                  </Button>
                </>
              )}
            </div>
          </div>
        </div>
      ) : null}
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
    case "EDITOR":
      return "/dashboard";
    case "STUDIO_OWNER":
      return "/dashboard";
    case "ADMIN":
      return "/admin";
    default:
      return "/";
  }
}
