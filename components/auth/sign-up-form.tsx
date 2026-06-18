"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import { UserPlus } from "lucide-react";
import { registerUserAction } from "@/app/auth/actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const roles = [
  { label: "Я клиент", value: "CLIENT" },
  { label: "Я фотограф", value: "PHOTOGRAPHER" },
  { label: "Я владелец студии", value: "STUDIO_OWNER" }
] as const;

export function SignUpForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<(typeof roles)[number]["value"]>("CLIENT");
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();

  function submit() {
    setError("");
    startTransition(async () => {
      const result = await registerUserAction({ name, email, phone, password, role });

      if (!result.success) {
        setError(result.error ?? "Не удалось зарегистрироваться");
        return;
      }

      const signInResult = await signIn("credentials", {
        email,
        password,
        redirect: false,
        callbackUrl: result.redirectTo
      });

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
          <p className="rounded-md bg-rose-100 px-3 py-2 text-sm font-medium text-rose-800">
            {error}
          </p>
        ) : null}
        <div className="grid gap-2 sm:grid-cols-3">
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
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Имя" value={name} onChange={setName} />
          <Field label="Телефон" value={phone} onChange={setPhone} />
        </div>
        <Field label="Email" value={email} onChange={setEmail} />
        <Field label="Пароль" type="password" value={password} onChange={setPassword} />
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
