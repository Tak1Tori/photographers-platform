import Link from "next/link";
import { Building2, Camera, UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

const scenarios = [
  {
    title: "Фотосессия под ключ",
    description: "Вся съемка в одном маршруте.",
    href: "/booking/new?type=FULL_SHOOT",
    cta: "Собрать съемку",
    price: "от 45 000 ₸",
    icon: Camera
  },
  {
    title: "Найти фотографа",
    description: "Специалист под ваш стиль и задачу.",
    href: "/photographers?mode=booking",
    cta: "Смотреть фотографов",
    price: "от 25 000 ₸/ч",
    icon: UserRound
  },
  {
    title: "Найти студию",
    description: "Пространство с нужным интерьером.",
    href: "/studios?mode=booking",
    cta: "Смотреть студии",
    price: "от 12 000 ₸/ч",
    icon: Building2
  }
];

export function BookingScenarios() {
  return (
    <section className="section border-b border-border">
      <div className="container">
        <div className="mb-8 flex flex-col justify-between gap-3 md:flex-row md:items-end">
          <h2 className="max-w-xl text-3xl font-semibold tracking-normal md:text-4xl">
            Что бронируем?
          </h2>
          <p className="text-sm text-muted-foreground">
            Под ключ или только нужную часть съемки
          </p>
        </div>
        <div className="grid gap-5 md:grid-cols-3">
          {scenarios.map((scenario) => {
            const Icon = scenario.icon;
            return (
              <Card key={scenario.href}>
                <CardContent className="grid h-full gap-6 p-6">
                  <div className="flex items-start justify-between gap-4">
                    <span className="flex size-11 items-center justify-center rounded-md bg-secondary">
                      <Icon className="size-5" aria-hidden="true" />
                    </span>
                    <span className="text-sm font-medium text-accent">{scenario.price}</span>
                  </div>
                  <div>
                    <h3 className="text-xl font-semibold tracking-normal">{scenario.title}</h3>
                    <p className="mt-2 text-sm text-muted-foreground">
                      {scenario.description}
                    </p>
                  </div>
                  <Button asChild className="mt-auto">
                    <Link href={scenario.href}>{scenario.cta}</Link>
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </section>
  );
}
