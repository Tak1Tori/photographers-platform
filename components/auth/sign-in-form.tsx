"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { signIn } from "next-auth/react";
import { LogIn, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const telegramErrors: Record<string, string> = {
  TelegramPhoneRequired: "Для входа через Telegram нужно подтвердить передачу номера телефона.",
  TelegramPhoneAlreadyLinked: "Этот номер уже связан с другим Telegram-аккаунтом.",
  TelegramLinkRequiresPassword: "Войдите с паролем, чтобы подтвердить прежний аккаунт и связать Telegram.",
  TelegramOnboardingExpired: "Ссылка для регистрации через Telegram истекла. Войдите еще раз.",
  TelegramLinkExpired: "Ссылка для привязки Telegram истекла. Войдите через Telegram еще раз.",
  TelegramSignInFailed: "Не удалось завершить вход через Telegram. Попробуйте еще раз.",
  OAuthCallback: "Вход через Telegram отменен или не завершен.",
  Callback: "Не удалось завершить вход через Telegram. Попробуйте еще раз.",
  AccessDenied: "Telegram не предоставил доступ к аккаунту.",
  Configuration: "Вход через Telegram пока настраивается."
};

export function SignInForm({ telegramEnabled }: { telegramEnabled: boolean }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") ?? "/";
  const telegramLinkIntent = searchParams.get("telegramLink");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();

  const providerError = searchParams.get("error");
  const displayedError = error || (providerError ? telegramErrors[providerError] : "");

  function submit() {
    setError("");
    startTransition(async () => {
      const result = await signIn("credentials", {
        phone,
        password,
        redirect: false,
        callbackUrl
      });

      if (result?.error) {
        setError("Неверный номер телефона или пароль");
        return;
      }

      router.push(
        telegramLinkIntent
          ? `/auth/telegram/link?intent=${encodeURIComponent(telegramLinkIntent)}`
          : (result?.url ?? callbackUrl)
      );
      router.refresh();
    });
  }

  function signInWithTelegram() {
    setError("");
    startTransition(async () => {
      await signIn("telegram", { callbackUrl });
    });
  }

  return (
    <Card className="mx-auto w-full max-w-md">
      <CardHeader>
        <CardTitle>Вход</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-4">
        {displayedError ? (
          <p className="rounded-md bg-rose-100 px-3 py-2 text-sm font-medium text-rose-800">
            {displayedError}
          </p>
        ) : null}
        <label className="grid gap-2 text-sm font-medium">
          Телефон
          <input
            value={phone}
            type="tel"
            onChange={(event) => setPhone(event.target.value)}
            className="h-10 rounded-md border border-input bg-background px-3 outline-none focus:ring-2 focus:ring-ring"
          />
        </label>
        <label className="grid gap-2 text-sm font-medium">
          Пароль
          <input
            value={password}
            type="password"
            onChange={(event) => setPassword(event.target.value)}
            className="h-10 rounded-md border border-input bg-background px-3 outline-none focus:ring-2 focus:ring-ring"
          />
        </label>
        <Button onClick={submit} disabled={isPending}>
          <LogIn className="size-4" aria-hidden="true" />
          {isPending ? "Входим..." : "Войти"}
        </Button>
        <div className="relative py-1 text-center text-xs text-muted-foreground before:absolute before:inset-x-0 before:top-1/2 before:border-t before:border-border">
          <span className="relative bg-card px-3">или</span>
        </div>
        <Button variant="outline" onClick={signInWithTelegram} disabled={isPending || !telegramEnabled}>
          <Send className="size-4" aria-hidden="true" />
          {isPending ? "Открываем Telegram..." : "Продолжить через Telegram"}
        </Button>
        {!telegramEnabled ? (
          <p className="text-center text-xs leading-5 text-muted-foreground">
            Вход через Telegram станет доступен после настройки интеграции.
          </p>
        ) : null}
        <p className="text-sm text-muted-foreground">
          Нет аккаунта?{" "}
          <Link href="/auth/sign-up" className="font-medium text-foreground">
            Зарегистрироваться
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}
