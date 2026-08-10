"use client";

import { useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { signIn } from "next-auth/react";
import { ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function AdminAccessForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const requestedPath = searchParams.get("callbackUrl");
  const callbackUrl = requestedPath?.startsWith("/admin") ? requestedPath : "/admin";
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();

  function submit() {
    setError("");
    startTransition(async () => {
      const result = await signIn("credentials", {
        adminAccess: "true",
        password,
        redirect: false,
        callbackUrl
      });

      if (result?.error) {
        setError("Неверный пароль администратора");
        return;
      }

      router.push(result?.url ?? callbackUrl);
      router.refresh();
    });
  }

  return (
    <Card className="mx-auto w-full max-w-md">
      <CardHeader>
        <CardTitle>Доступ администратора</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-4">
        {error ? (
          <p className="rounded-md bg-rose-100 px-3 py-2 text-sm font-medium text-rose-800">{error}</p>
        ) : null}
        <label className="grid gap-2 text-sm font-medium">
          Пароль администратора
          <input
            value={password}
            type="password"
            autoComplete="current-password"
            onChange={(event) => setPassword(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") submit();
            }}
            className="h-10 rounded-md border border-input bg-background px-3 outline-none focus:ring-2 focus:ring-ring"
          />
        </label>
        <Button onClick={submit} disabled={isPending || !password}>
          <ShieldCheck className="size-4" aria-hidden="true" />
          {isPending ? "Проверяем..." : "Открыть админку"}
        </Button>
      </CardContent>
    </Card>
  );
}
