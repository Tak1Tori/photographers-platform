import Link from "next/link";
import {
  ArrowRight,
  Building2,
  CalendarDays,
  Camera,
  Check,
  Clock3,
  Images,
  Palette,
  UserRound
} from "lucide-react";
import { Button } from "@/components/ui/button";

const bookingTypes = [
  {
    number: "01",
    eyebrow: "Полный продакшн",
    title: "Фотосессия под ключ",
    description:
      "Для тех, кто хочет получить готовую съемку без самостоятельной координации команды и локации.",
    href: "/booking/new?type=FULL_SHOOT",
    cta: "Собрать фотосессию",
    icon: Camera,
    inclusions: [
      "Выбор стиля и формата съемки",
      "Подходящий фотограф",
      "Студия и свободное время",
      "Единая итоговая стоимость"
    ],
    route: [
      { label: "Стиль", icon: Palette },
      { label: "Фотограф", icon: UserRound },
      { label: "Студия", icon: Building2 },
      { label: "Время", icon: CalendarDays }
    ]
  },
  {
    number: "02",
    eyebrow: "Специалист",
    title: "Забронировать фотографа",
    description:
      "Когда локация уже есть, выберите фотографа по специализации, портфолио, рейтингу и стоимости часа.",
    href: "/photographers?mode=booking",
    cta: "Выбрать фотографа",
    icon: UserRound,
    inclusions: [
      "Фильтр по стилю съемки",
      "Портфолио и специализации",
      "Рейтинг и стоимость часа",
      "Доступные даты и слоты"
    ],
    route: [
      { label: "Каталог", icon: Images },
      { label: "Профиль", icon: UserRound },
      { label: "Дата", icon: CalendarDays },
      { label: "Бронь", icon: Check }
    ]
  },
  {
    number: "03",
    eyebrow: "Пространство",
    title: "Арендовать студию",
    description:
      "Подберите зал под свою команду и задачу: изучите интерьер, оборудование, вместимость и правила аренды.",
    href: "/studios?mode=booking",
    cta: "Выбрать студию",
    icon: Building2,
    inclusions: [
      "Фотографии залов и интерьера",
      "Оборудование и удобства",
      "Вместимость и правила",
      "Цена и длительность аренды"
    ],
    route: [
      { label: "Студии", icon: Building2 },
      { label: "Зал", icon: Images },
      { label: "Время", icon: Clock3 },
      { label: "Бронь", icon: Check }
    ]
  }
];

export function BookingTypesOverview() {
  return (
    <div className="border-t border-border">
      {bookingTypes.map((bookingType, index) => {
        const Icon = bookingType.icon;
        const isReversed = index % 2 === 1;

        return (
          <section
            key={bookingType.href}
            className={index % 2 === 0 ? "section bg-background/90" : "section bg-card/90"}
          >
            <div
              className={[
                "container grid items-center gap-10 lg:grid-cols-[0.9fr_1.1fr] lg:gap-20",
                isReversed ? "lg:grid-cols-[1.1fr_0.9fr]" : ""
              ].join(" ")}
            >
              <div className={isReversed ? "lg:order-2" : ""}>
                <div className="flex items-center gap-3 text-sm font-medium uppercase tracking-[0.18em] text-accent">
                  <span>{bookingType.number}</span>
                  <span className="h-px w-10 bg-accent/60" />
                  <span>{bookingType.eyebrow}</span>
                </div>
                <div className="mt-6 flex size-12 items-center justify-center rounded-md bg-primary text-primary-foreground">
                  <Icon className="size-6" aria-hidden="true" />
                </div>
                <h2 className="mt-6 text-3xl font-semibold tracking-normal md:text-4xl">
                  {bookingType.title}
                </h2>
                <p className="mt-4 max-w-xl text-base leading-7 text-muted-foreground">
                  {bookingType.description}
                </p>
                <ul className="mt-7 grid gap-3 sm:grid-cols-2">
                  {bookingType.inclusions.map((item) => (
                    <li key={item} className="flex items-start gap-3 text-sm text-foreground/90">
                      <Check className="mt-0.5 size-4 shrink-0 text-accent" aria-hidden="true" />
                      {item}
                    </li>
                  ))}
                </ul>
                <Button asChild size="lg" className="mt-8">
                  <Link href={bookingType.href}>
                    {bookingType.cta}
                    <ArrowRight className="size-4" aria-hidden="true" />
                  </Link>
                </Button>
              </div>

              <div className={isReversed ? "lg:order-1" : ""}>
                <div className="border-y border-border bg-secondary/35 px-5 py-8 md:px-8 md:py-10">
                  <p className="text-sm font-medium text-muted-foreground">Маршрут бронирования</p>
                  <div className="mt-8 grid grid-cols-2 gap-x-5 gap-y-8 sm:grid-cols-4">
                    {bookingType.route.map((step, stepIndex) => {
                      const StepIcon = step.icon;

                      return (
                        <div key={step.label} className="relative">
                          <div className="flex size-11 items-center justify-center rounded-md border border-border bg-background">
                            <StepIcon className="size-5" aria-hidden="true" />
                          </div>
                          <p className="mt-3 text-sm font-medium">{step.label}</p>
                          <p className="mt-1 text-xs text-muted-foreground">
                            Шаг {stepIndex + 1}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                  <div className="mt-9 border-t border-border pt-5">
                    <p className="text-sm leading-6 text-muted-foreground">
                      Вы видите выбранные детали и итоговую стоимость до подтверждения
                      mock-брони.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </section>
        );
      })}
    </div>
  );
}
