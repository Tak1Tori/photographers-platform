"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import { Send } from "lucide-react";
import { completeTelegramOnboardingAction } from "@/app/auth/telegram/onboarding/actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const roles = [
  { label: "Я клиент", value: "CLIENT" },
  { label: "Я фотограф", value: "PHOTOGRAPHER" }
] as const;

export function TelegramOnboardingForm({
  intentToken,
  name,
  phone
}: {
  intentToken: string;
  name: string;
  phone: string;
}) {
  const router = useRouter();
  const [role, setRole] = useState<(typeof roles)[number]["value"]>("CLIENT");
  const [acceptedLegal, setAcceptedLegal] = useState(false);
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();

  function submit() {
    setError("");
    startTransition(async () => {
      const result = await completeTelegramOnboardingAction({ intentToken, role, acceptedLegal });

      if (!result.success) {
        setError(result.error);
        return;
      }

      const signInResult = await signIn("telegram-onboarding", {
        ticket: result.ticket,
        redirect: false,
        callbackUrl: result.redirectTo
      });

      if (signInResult?.error) {
        setError("Не удалось открыть сессию. Войдите через Telegram еще раз.");
        return;
      }

      router.replace(signInResult?.url ?? result.redirectTo);
      router.refresh();
    });
  }

  return (
    <Card className="mx-auto w-full max-w-xl">
      <CardHeader>
        <CardTitle>Завершите регистрацию</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-5">
        {error ? <p className="rounded-md bg-rose-100 px-3 py-2 text-sm font-medium text-rose-800">{error}</p> : null}

        <div className="rounded-md border border-border bg-secondary/50 px-4 py-3 text-sm">
          <p className="font-medium">{name}</p>
          <p className="mt-1 text-muted-foreground">{phone} подтвержден через Telegram</p>
        </div>

        <div className="grid gap-2 sm:grid-cols-2">
          {roles.map((item) => (
            <button
              key={item.value}
              type="button"
              onClick={() => setRole(item.value)}
              className={`rounded-md border px-3 py-2 text-sm font-medium ${
                role === item.value
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-card"
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>

        <label className="flex items-start gap-3 text-sm leading-5 text-muted-foreground">
          <input
            type="checkbox"
            checked={acceptedLegal}
            onChange={(event) => setAcceptedLegal(event.target.checked)}
            className="mt-1 size-4 shrink-0 accent-primary"
          />
          <span>
            Я принимаю <Link href="/terms" className="text-foreground underline underline-offset-2">Пользовательское соглашение</Link> и <Link href="/privacy-policy" className="text-foreground underline underline-offset-2">Политику конфиденциальности</Link>.
          </span>
        </label>

        <Button onClick={submit} disabled={isPending}>
          <Send className="size-4" aria-hidden="true" />
          {isPending ? "Создаем аккаунт..." : "Продолжить"}
        </Button>
      </CardContent>
    </Card>
  );
}
