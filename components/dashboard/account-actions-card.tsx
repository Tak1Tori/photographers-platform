import Link from "next/link";
import { Edit3, Send } from "lucide-react";
import { SignOutButton } from "@/components/auth/sign-out-button";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

interface AccountActionsCardProps {
  name?: string | null;
  phone?: string | null;
  roleLabel: string;
  editHref?: string;
  telegramHref?: string;
}

export function AccountActionsCard({
  name,
  phone,
  roleLabel,
  editHref,
  telegramHref
}: AccountActionsCardProps) {
  return (
    <Card>
      <CardContent className="flex flex-col justify-between gap-5 p-5 sm:flex-row sm:items-center">
        <div>
          <p className="text-sm text-muted-foreground">{roleLabel}</p>
          <h2 className="mt-1 text-xl font-semibold tracking-normal">
            {name || "Аккаунт"}
          </h2>
          <div className="mt-2 grid gap-1 text-sm text-muted-foreground">
            {phone ? <span>{phone}</span> : null}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {telegramHref ? (
            <Button asChild variant="outline" size="sm">
              <Link href={telegramHref}>
                <Send className="size-4" aria-hidden="true" />
                Telegram
              </Link>
            </Button>
          ) : null}
          {editHref ? (
            <Button asChild variant="outline" size="sm">
              <Link href={editHref}>
                <Edit3 className="size-4" aria-hidden="true" />
                Редактировать
              </Link>
            </Button>
          ) : null}
          <SignOutButton />
        </div>
      </CardContent>
    </Card>
  );
}
