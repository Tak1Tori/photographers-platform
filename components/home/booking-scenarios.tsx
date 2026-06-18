import Link from "next/link";
import { Building2, Camera, UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

const scenarios = [
  {
    title: "Фотосессия под ключ",
    description: "Соберите стиль, фотографа, студию и удобное время в одном маршруте.",
    href: "/booking/new?type=FULL_SHOOT",
    cta: "Собрать съемку",
    price: "от 45 000 ₸",
    icon: Camera
  },
  {
    title: "Найти фотографа",
    description: "Забронируйте фотографа для съемки на вашей локации или мероприятии.",
    href: "/photographers?mode=booking",
    cta: "Смотреть фотографов",
    price: "от 25 000 ₸/ч",
    icon: UserRound
  },
  {
    title: "Найти студию",
    description: "Подберите студию или зал для своей съемки без выбора фотографа.",
    href: "/studios?mode=booking",
    cta: "Смотреть студии",
    price: "от 12 000 ₸/ч",
    icon: Building2
  }
];

export function BookingScenarios() {
  return (
    <section className="section">
      <div className="container">
        <div className="mb-6 max-w-2xl">
          <p className="text-sm font-medium uppercase tracking-[0.18em] text-accent">
            Сценарии бронирования
          </p>
          <h2 className="mt-3 text-3xl font-semibold tracking-normal">
            Выберите, что нужно забронировать
          </h2>
        </div>
        <div className="grid gap-5 md:grid-cols-3">
          {scenarios.map((scenario) => {
            const Icon = scenario.icon;
            return (
              <Card key={scenario.href}>
                <CardContent className="grid h-full gap-5 p-6">
                  <div className="flex items-start justify-between gap-4">
                    <span className="flex size-11 items-center justify-center rounded-md bg-secondary">
                      <Icon className="size-5" aria-hidden="true" />
                    </span>
                    <span className="text-sm font-medium text-accent">{scenario.price}</span>
                  </div>
                  <div>
                    <h3 className="text-xl font-semibold tracking-normal">{scenario.title}</h3>
                    <p className="mt-2 text-sm leading-6 text-muted-foreground">
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
