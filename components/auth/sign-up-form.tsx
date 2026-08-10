"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { signIn } from "next-auth/react";
import { Send, UserPlus } from "lucide-react";
import { registerUserAction } from "@/app/auth/actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const roles = [
  { label: "Я клиент", value: "CLIENT" },
  { label: "Я фотограф", value: "PHOTOGRAPHER" },
  { label: "Я монтажер", value: "EDITOR" }
] as const;

export function SignUpForm({ telegramEnabled }: { telegramEnabled: boolean }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<(typeof roles)[number]["value"]>("CLIENT");
  const [acceptedLegal, setAcceptedLegal] = useState(false);
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();

  function submit() {
    setError("");
    startTransition(async () => {
      const result = await registerUserAction({ name, phone, password, role, acceptedLegal });

      if (!result.success) {
        setError(result.error ?? "Не удалось зарегистрироваться");
        return;
      }

      const signInResult = await signIn("credentials", {
        phone,
        password,
        redirect: false,
        callbackUrl: result.redirectTo
      });

      router.push(signInResult?.url ?? result.redirectTo ?? "/");
      router.refresh();
    });
  }

  function signUpWithTelegram() {
    setError("");
    startTransition(async () => {
      await signIn("telegram", { callbackUrl: "/" });
    });
  }

  return (
    <Card className="mx-auto w-full max-w-xl">
      <CardHeader>
        <CardTitle>Регистрация</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-4">
        {error ? (
          <p className="rounded-md bg-rose-100 px-3 py-2 text-sm font-medium text-rose-800">
            {error}
          </p>
        ) : null}
        <Button
          variant="outline"
          className="h-11 w-full"
          onClick={signUpWithTelegram}
          disabled={isPending || !telegramEnabled}
        >
          <Send className="size-4" aria-hidden="true" />
          {isPending ? "Открываем Telegram..." : "Продолжить через Telegram"}
        </Button>
        {telegramEnabled ? (
          <p className="-mt-2 text-center text-xs leading-5 text-muted-foreground">
            Номер телефона подтвердится через Telegram. Пароль создавать не нужно.
          </p>
        ) : (
          <p className="-mt-2 text-center text-xs leading-5 text-muted-foreground">
            Регистрация через Telegram станет доступна после настройки интеграции.
          </p>
        )}
        <div className="relative py-1 text-center text-xs text-muted-foreground before:absolute before:inset-x-0 before:top-1/2 before:border-t before:border-border">
          <span className="relative bg-card px-3">или</span>
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
        <Field label="Имя" value={name} onChange={setName} />
        <Field label="Телефон" value={phone} type="tel" onChange={setPhone} />
        <Field label="Пароль" type="password" value={password} onChange={setPassword} />
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
          <UserPlus className="size-4" aria-hidden="true" />
          {isPending ? "Создаем аккаунт..." : "Зарегистрироваться"}
        </Button>
      </CardContent>
    </Card>
  );
}

function Field({
  label,
  value,
  type = "text",
  onChange
}: {
  label: string;
  value: string;
  type?: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="grid gap-2 text-sm font-medium">
      {label}
      <input
        value={value}
        type={type}
        onChange={(event) => onChange(event.target.value)}
        className="h-10 rounded-md border border-input bg-background px-3 outline-none focus:ring-2 focus:ring-ring"
      />
    </label>
  );
}
