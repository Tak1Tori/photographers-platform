import Link from "next/link";
import { ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export default function UnauthorizedPage() {
  return (
    <section className="section">
      <div className="container">
        <Card className="mx-auto max-w-2xl">
          <CardContent className="flex flex-col items-center px-6 py-12 text-center">
            <span className="flex size-12 items-center justify-center rounded-md bg-secondary">
              <ShieldAlert className="size-6" aria-hidden="true" />
            </span>
            <h1 className="mt-5 text-3xl font-semibold tracking-normal">Access denied</h1>
            <p className="mt-3 max-w-md text-sm leading-6 text-muted-foreground">
              У вашей роли нет доступа к этой странице. Перейдите в доступный кабинет
              или войдите под другим аккаунтом.
            </p>
            <div className="mt-6 flex flex-wrap justify-center gap-3">
              <Button asChild>
                <Link href="/dashboard">Выбрать кабинет</Link>
              </Button>
              <Button asChild variant="outline">
                <Link href="/auth/sign-in">Войти</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </section>
  );
}
