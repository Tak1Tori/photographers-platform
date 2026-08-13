"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { signIn } from "next-auth/react";
import { ArrowLeft, CheckCircle2, RotateCw, UserPlus } from "lucide-react";
import {
  resendRegistrationCodeAction,
  startRegistrationAction,
  verifyRegistrationCodeAction
} from "@/app/auth/actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { normalizePhone } from "@/lib/phone";

const roles = [
  { label: "Я клиент", value: "CLIENT" },
  { label: "Я фотограф", value: "PHOTOGRAPHER" },
  { label: "Я монтажер", value: "EDITOR" }
] as const;

type RegistrationRole = (typeof roles)[number]["value"];

function maskPhone(value: string) {
  const phone = normalizePhone(value);
  if (!phone) return value;

  return `${phone.slice(0, 6)} *** ** ${phone.slice(-2)}`;
}

export function SignUpForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<RegistrationRole>("CLIENT");
  const [acceptedLegal, setAcceptedLegal] = useState(false);
  const [pendingRegistrationId, setPendingRegistrationId] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [resendAvailableAt, setResendAvailableAt] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();

  const resendSeconds = useMemo(() => {
    if (!resendAvailableAt) return 0;
    return Math.max(0, Math.ceil((new Date(resendAvailableAt).getTime() - now) / 1000));
  }, [now, resendAvailableAt]);

  useEffect(() => {
    if (!pendingRegistrationId || resendSeconds <= 0) return;

    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [pendingRegistrationId, resendSeconds]);

  function startRegistration() {
    setError("");
    startTransition(async () => {
      const result = await startRegistrationAction({ name, phone, password, role, acceptedLegal });

      if (!result.success) {
        setError(result.error ?? "Не удалось начать регистрацию");
        return;
      }

      setPendingRegistrationId(result.pendingRegistrationId);
      setResendAvailableAt(result.resendAvailableAt);
      setCode("");
      setNow(Date.now());
    });
  }

  function verifyCode() {
    if (!pendingRegistrationId) return;

    setError("");
    startTransition(async () => {
      const result = await verifyRegistrationCodeAction({ pendingRegistrationId, code });

      if (!result.success) {
        setError(result.error ?? "Не удалось подтвердить номер");
        return;
      }

      const signInResult = await signIn("credentials", {
        phone,
        password,
        redirect: false,
        callbackUrl: result.redirectTo
      });

      if (signInResult?.error) {
        setError("Номер подтверждён, но не удалось войти. Используйте номер и пароль на странице входа.");
        return;
      }

      router.push(signInResult?.url ?? result.redirectTo ?? "/");
      router.refresh();
    });
  }

  function resendCode() {
    if (!pendingRegistrationId || resendSeconds > 0) return;

    setError("");
    startTransition(async () => {
      const result = await resendRegistrationCodeAction(pendingRegistrationId);

      if (!result.success) {
        setError(result.error ?? "Не удалось отправить код повторно");
        if (result.resendAvailableAt) {
          setResendAvailableAt(result.resendAvailableAt);
          setNow(Date.now());
        }
        return;
      }

      setResendAvailableAt(result.resendAvailableAt);
      setNow(Date.now());
      setCode("");
    });
  }

  function editPhone() {
    setError("");
    setPendingRegistrationId(null);
    setCode("");
    setResendAvailableAt(null);
  }

  return (
    <Card className="mx-auto w-full max-w-xl">
      <CardHeader>
        <CardTitle>{pendingRegistrationId ? "Подтвердите номер" : "Регистрация"}</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-4">
        {error ? (
          <p className="rounded-md bg-rose-100 px-3 py-2 text-sm font-medium text-rose-800">
            {error}
          </p>
        ) : null}
        {pendingRegistrationId ? (
          <>
            <div className="grid gap-2 text-sm leading-6 text-muted-foreground">
              <p>Код отправлен в Telegram на {maskPhone(phone)}.</p>
              <p>Введите шестизначный код, чтобы создать аккаунт.</p>
            </div>
            <label className="grid gap-2 text-sm font-medium">
              Код из Telegram
              <input
                value={code}
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 6))}
                className="h-12 rounded-md border border-input bg-background px-3 text-center text-lg font-semibold tracking-[0.45em] outline-none focus:ring-2 focus:ring-ring"
                aria-label="Шестизначный код из Telegram"
              />
            </label>
            <Button onClick={verifyCode} disabled={isPending || code.length !== 6}>
              <CheckCircle2 className="size-4" aria-hidden="true" />
              {isPending ? "Проверяем код..." : "Подтвердить"}
            </Button>
            <Button variant="outline" onClick={resendCode} disabled={isPending || resendSeconds > 0}>
              <RotateCw className="size-4" aria-hidden="true" />
              {resendSeconds > 0 ? `Отправить код повторно через ${resendSeconds} сек.` : "Отправить код повторно"}
            </Button>
            <Button variant="ghost" onClick={editPhone} disabled={isPending}>
              <ArrowLeft className="size-4" aria-hidden="true" />
              Изменить номер
            </Button>
          </>
        ) : (
          <>
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
            <Button onClick={startRegistration} disabled={isPending}>
              <UserPlus className="size-4" aria-hidden="true" />
              {isPending ? "Отправляем код..." : "Продолжить"}
            </Button>
            <p className="text-center text-xs leading-5 text-muted-foreground">
              Код для подтверждения номера придёт через Telegram.
            </p>
          </>
        )}
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
