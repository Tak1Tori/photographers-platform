import Link from "next/link";
import { UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

const scenarios = [
  {
    title: "Найти фотографа",
    description: "Специалист под ваш стиль и задачу.",
    href: "/photographers?mode=booking",
    cta: "Смотреть фотографов",
    price: "от 25 000 ₸/ч",
    icon: UserRound
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
        </div>
        <div className="grid gap-5 md:max-w-xl">
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
