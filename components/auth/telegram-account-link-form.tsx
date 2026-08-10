"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Link2 } from "lucide-react";
import { completeTelegramAccountLinkAction } from "@/app/auth/telegram/link/actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function TelegramAccountLinkForm({
  intentToken,
  phone,
  redirectTo
}: {
  intentToken: string;
  phone: string;
  redirectTo: string;
}) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();

  function submit() {
    setError("");
    startTransition(async () => {
      const result = await completeTelegramAccountLinkAction(intentToken);
      if (!result.success) {
        setError(result.error);
        return;
      }

      router.replace(redirectTo);
      router.refresh();
    });
  }

  return (
    <Card className="mx-auto w-full max-w-xl">
      <CardHeader>
        <CardTitle>Подтвердите привязку</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-5">
        {error ? <p className="rounded-md bg-rose-100 px-3 py-2 text-sm font-medium text-rose-800">{error}</p> : null}
        <p className="rounded-md border border-border bg-secondary/50 px-4 py-3 text-sm text-muted-foreground">
          Telegram подтвердил номер <span className="font-medium text-foreground">{phone}</span>. После
          подтверждения этот Telegram будет использоваться для входа в текущий аккаунт.
        </p>
        <Button onClick={submit} disabled={isPending}>
          <Link2 className="size-4" aria-hidden="true" />
          {isPending ? "Связываем..." : "Связать Telegram"}
        </Button>
      </CardContent>
    </Card>
  );
}
