"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";

const COOKIE_CONSENT_KEY = "framely-cookie-consent-v1";

export function CookieConsentBanner() {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    setIsVisible(window.localStorage.getItem(COOKIE_CONSENT_KEY) !== "accepted");
  }, []);

  const acceptCookies = () => {
    window.localStorage.setItem(COOKIE_CONSENT_KEY, "accepted");
    setIsVisible(false);
  };

  if (!isVisible) {
    return null;
  }

  return (
    <aside
      className="fixed inset-x-3 bottom-3 z-[70] mx-auto max-w-3xl border border-border bg-card/95 p-4 shadow-xl shadow-black/15 backdrop-blur-md sm:bottom-5 sm:flex sm:items-center sm:gap-5 sm:px-5"
      aria-label="Уведомление об использовании Cookies"
    >
      <p className="text-sm leading-relaxed text-muted-foreground sm:flex-1">
        Мы используем Cookies, чтобы сайт работал корректно и запоминал ваши настройки. {" "}
        <Link href="/cookies" className="font-medium text-foreground underline underline-offset-4 hover:text-primary">
          Подробнее
        </Link>
      </p>
      <Button className="mt-3 w-full sm:mt-0 sm:w-auto" onClick={acceptCookies}>
        Понятно
      </Button>
    </aside>
  );
}
