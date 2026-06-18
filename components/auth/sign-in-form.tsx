"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { signIn } from "next-auth/react";
import { LogIn } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function SignInForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") ?? "/";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();

  function submit() {
    setError("");
    startTransition(async () => {
      const result = await signIn("credentials", {
        email,
        password,
        redirect: false,
        callbackUrl
      });

      if (result?.error) {
        setError("Неверный email или пароль");
        return;
      }

      router.push(result?.url ?? callbackUrl);
      router.refresh();
    });
  }

  return (
    <Card className="mx-auto w-full max-w-md">
      <CardHeader>
        <CardTitle>Вход</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-4">
        {error ? (
          <p className="rounded-md bg-rose-100 px-3 py-2 text-sm font-medium text-rose-800">
            {error}
          </p>
        ) : null}
        <label className="grid gap-2 text-sm font-medium">
          Email
          <input
            value={email}
            onChange={(event) => setEmail(event.target.value)}
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
