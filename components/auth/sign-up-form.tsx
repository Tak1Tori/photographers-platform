"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { signIn } from "next-auth/react";
import { Eye, EyeOff, UserPlus } from "lucide-react";
import { startRegistrationAction } from "@/app/auth/actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const roles = [
  { label: "Я клиент", value: "CLIENT" },
  { label: "Я фотограф", value: "PHOTOGRAPHER" },
  { label: "Я монтажер", value: "EDITOR" }
] as const;

type RegistrationRole = (typeof roles)[number]["value"];

export function SignUpForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [role, setRole] = useState<RegistrationRole>("CLIENT");
  const [acceptedLegal, setAcceptedLegal] = useState(false);
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();

  function register() {
    setError("");

    if (password !== confirmPassword) {
      setError("Пароли не совпадают");
      return;
    }

    startTransition(async () => {
      const result = await startRegistrationAction({
        name,
        email,
        phone,
        password,
        role,
        acceptedLegal
      });

      if (!result.success) {
        setError(result.error ?? "Не удалось создать аккаунт");
        return;
      }

      const signInResult = await signIn("credentials", {
        phone,
        password,
        redirect: false,
        callbackUrl: result.redirectTo
      });

      if (signInResult?.error) {
        setError("Аккаунт создан, но не удалось войти. Используйте номер и пароль на странице входа.");
        return;
      }

      router.push(signInResult?.url ?? result.redirectTo ?? "/");
      router.refresh();
    });
  }

  return (
    <Card className="mx-auto w-full max-w-xl">
      <CardHeader>
        <CardTitle>Регистрация</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-4">
        {error ? (
          <p className="rounded-md bg-rose-100 px-3 py-2 text-sm font-medium text-rose-800">{error}</p>
        ) : null}
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
        <Field label="Имя" value={name} autoComplete="name" onChange={setName} />
        <Field label="Email" value={email} type="email" autoComplete="email" onChange={setEmail} />
        <Field label="Телефон" value={phone} type="tel" autoComplete="tel" onChange={setPhone} />
        <PasswordField
          label="Пароль"
          value={password}
          visible={showPassword}
          onChange={setPassword}
          onVisibilityChange={setShowPassword}
        />
        <PasswordField
          label="Подтвердите пароль"
          value={confirmPassword}
          visible={showConfirmPassword}
          onChange={setConfirmPassword}
          onVisibilityChange={setShowConfirmPassword}
        />
        <label className="flex items-start gap-3 text-sm leading-5 text-muted-foreground">
          <input
            type="checkbox"
            checked={acceptedLegal}
            onChange={(event) => setAcceptedLegal(event.target.checked)}
            className="mt-1 size-4 shrink-0 accent-primary"
          />
          <span>
            Я принимаю{" "}
            <Link href="/terms" className="text-foreground underline underline-offset-2">
              Пользовательское соглашение
            </Link>{" "}
            и{" "}
            <Link href="/privacy-policy" className="text-foreground underline underline-offset-2">
              Политику конфиденциальности
            </Link>
            .
          </span>
        </label>
        <Button onClick={register} disabled={isPending}>
          <UserPlus className="size-4" aria-hidden="true" />
          {isPending ? "Создаём аккаунт..." : "Зарегистрироваться"}
        </Button>
      </CardContent>
    </Card>
  );
}

function Field({
  label,
  value,
  type = "text",
  autoComplete,
  onChange
}: {
  label: string;
  value: string;
  type?: string;
  autoComplete?: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="grid gap-2 text-sm font-medium">
      {label}
      <input
        value={value}
        type={type}
        autoComplete={autoComplete}
        onChange={(event) => onChange(event.target.value)}
        className="h-10 rounded-md border border-input bg-background px-3 outline-none focus:ring-2 focus:ring-ring"
      />
    </label>
  );
}

function PasswordField({
  label,
  value,
  visible,
  onChange,
  onVisibilityChange
}: {
  label: string;
  value: string;
  visible: boolean;
  onChange: (value: string) => void;
  onVisibilityChange: (visible: boolean) => void;
}) {
  const visibilityLabel = visible ? "Скрыть пароль" : "Показать пароль";

  return (
    <label className="grid gap-2 text-sm font-medium">
      {label}
      <span className="relative">
        <input
          value={value}
          type={visible ? "text" : "password"}
          autoComplete="new-password"
          onChange={(event) => onChange(event.target.value)}
          className="h-10 w-full rounded-md border border-input bg-background px-3 pr-10 outline-none focus:ring-2 focus:ring-ring"
        />
        <button
          type="button"
          aria-label={visibilityLabel}
          onClick={() => onVisibilityChange(!visible)}
          className="absolute inset-y-0 right-0 grid w-10 place-items-center text-muted-foreground hover:text-foreground"
        >
          {visible ? <EyeOff className="size-4" aria-hidden="true" /> : <Eye className="size-4" aria-hidden="true" />}
        </button>
      </span>
    </label>
  );
}
