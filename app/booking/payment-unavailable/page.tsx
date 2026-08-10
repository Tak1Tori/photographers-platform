import Link from "next/link";
import { ArrowLeft, CreditCard, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export default function PaymentUnavailablePage() {
  return (
    <section className="py-10 md:py-16">
      <div className="container">
        <Card className="mx-auto max-w-2xl overflow-hidden">
          <CardContent className="grid gap-7 px-6 py-12 text-center md:px-12 md:py-16">
            <span className="mx-auto flex size-14 items-center justify-center rounded-md bg-primary text-primary-foreground">
              <CreditCard className="size-7" aria-hidden="true" />
            </span>

            <div>
              <p className="text-sm font-medium text-primary">ИЗВИНИТЕ</p>
              <h1 className="mt-3 text-3xl font-semibold tracking-normal md:text-4xl">
                Оплата еще не подключена
              </h1>
              <p className="mx-auto mt-4 max-w-lg text-sm leading-6 text-muted-foreground md:text-base">
                Мы завершаем подключение онлайн-оплаты. Бронь не создана, выбранное время не
                удерживается и средства с вас не списываются.
              </p>
            </div>

            <p className="mx-auto inline-flex max-w-lg items-start gap-2 text-left text-sm text-muted-foreground">
              <ShieldCheck className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
              Попробуйте оформить съемку немного позже.
            </p>

            <Button asChild className="mx-auto w-full sm:w-auto">
              <Link href="/photographers?mode=booking">
                <ArrowLeft className="size-4" aria-hidden="true" />
                Вернуться к фотографам
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </section>
  );
}
