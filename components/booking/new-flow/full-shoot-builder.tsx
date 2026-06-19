import Image from "next/image";
import Link from "next/link";
import {
  ArrowRight,
  Building2,
  Camera,
  Check,
  CircleDashed,
  Sparkles,
  UserRound
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { Photographer, PhotoStyle, Studio } from "@/lib/types";

interface FullShootBuilderProps {
  style?: PhotoStyle;
  photographer?: Photographer;
  studio?: Studio;
}

export function FullShootBuilder({
  style,
  photographer,
  studio
}: FullShootBuilderProps) {
  const selection = {
    style: style?.id,
    photographer: photographer?.id,
    studio: studio?.id
  };
  const isComplete = Boolean(style && photographer && studio);

  const steps = [
    {
      number: "01",
      title: "Стили",
      description: "Определите настроение и визуальный язык съемки.",
      selectedTitle: style?.title,
      selectedMeta: style ? `от ${style.startingPrice.toLocaleString("ru-RU")} ₸` : undefined,
      imageUrl: style?.imageUrl,
      href: buildCatalogHref("/styles", selection),
      icon: Sparkles
    },
    {
      number: "02",
      title: "Фотографы",
      description: "Выберите автора, чей взгляд подходит вашей задаче.",
      selectedTitle: photographer?.name,
      selectedMeta: photographer
        ? `${photographer.city} · ${photographer.pricePerHour.toLocaleString("ru-RU")} ₸/ч`
        : undefined,
      imageUrl: photographer?.imageUrl,
      href: buildCatalogHref("/photographers", selection),
      icon: UserRound
    },
    {
      number: "03",
      title: "Студии",
      description: "Найдите пространство, свет и оборудование для съемки.",
      selectedTitle: studio?.name,
      selectedMeta: studio
        ? `${studio.hallName} · ${studio.pricePerHour.toLocaleString("ru-RU")} ₸/ч`
        : undefined,
      imageUrl: studio?.imageUrl,
      href: buildCatalogHref("/studios", selection),
      icon: Building2
    }
  ];

  return (
    <div className="grid gap-8">
      <div className="grid gap-4 lg:grid-cols-3">
        {steps.map((step) => {
          const Icon = step.icon;
          const isSelected = Boolean(step.selectedTitle);

          return (
            <Link
              key={step.title}
              href={step.href}
              className={cn(
                "group relative flex min-h-[390px] overflow-hidden rounded-lg border bg-card transition duration-300",
                isSelected
                  ? "border-primary/50 shadow-[0_18px_60px_rgba(22,101,52,0.12)]"
                  : "border-border hover:-translate-y-1 hover:border-primary/45"
              )}
            >
              {step.imageUrl ? (
                <>
                  <Image
                    src={step.imageUrl}
                    alt={step.selectedTitle ?? step.title}
                    fill
                    sizes="(max-width: 1024px) 100vw, 33vw"
                    className="object-cover transition duration-500 group-hover:scale-[1.03]"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-background via-background/45 to-transparent" />
                </>
              ) : (
                <div className="absolute inset-0 flex items-center justify-center">
                  <Icon
                    className="size-28 stroke-[0.7] text-primary/20 transition duration-500 group-hover:scale-105 group-hover:text-primary/30"
                    aria-hidden="true"
                  />
                </div>
              )}

              <div className="relative z-10 mt-auto grid w-full gap-4 p-6">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-sm font-medium text-muted-foreground">
                    {step.number}
                  </span>
                  <span
                    className={cn(
                      "flex size-8 items-center justify-center rounded-md border",
                      isSelected
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border bg-background/70 text-muted-foreground"
                    )}
                  >
                    {isSelected ? (
                      <Check className="size-4" aria-hidden="true" />
                    ) : (
                      <CircleDashed className="size-4" aria-hidden="true" />
                    )}
                  </span>
                </div>

                <div>
                  <p className="text-3xl font-semibold">{step.title}</p>
                  {isSelected ? (
                    <>
                      <p className="mt-3 text-lg font-medium">{step.selectedTitle}</p>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {step.selectedMeta}
                      </p>
                    </>
                  ) : (
                    <p className="mt-3 max-w-xs text-sm leading-6 text-muted-foreground">
                      {step.description}
                    </p>
                  )}
                </div>

                <span className="inline-flex items-center gap-2 text-sm font-medium text-primary">
                  {isSelected ? "Изменить выбор" : `Выбрать: ${step.title.toLowerCase()}`}
                  <ArrowRight
                    className="size-4 transition-transform group-hover:translate-x-1"
                    aria-hidden="true"
                  />
                </span>
              </div>
            </Link>
          );
        })}
      </div>

      <div className="flex flex-col items-start justify-between gap-5 border-t border-border pt-6 sm:flex-row sm:items-center">
        <div className="flex items-start gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-md bg-secondary">
            <Camera className="size-5" aria-hidden="true" />
          </span>
          <div>
            <p className="font-medium">
              {isComplete ? "Комплект собран" : "Соберите все три элемента"}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              {isComplete
                ? "Переходите к выбору даты, времени и оплате брони."
                : "После выбора стиля, фотографа и студии откроется финальный шаг."}
            </p>
          </div>
        </div>
        {isComplete ? (
          <Button asChild size="lg">
            <Link
              href={`/booking?style=${style!.id}&photographer=${photographer!.id}&studio=${studio!.id}`}
            >
              Продолжить бронирование
              <ArrowRight className="size-4" aria-hidden="true" />
            </Link>
          </Button>
        ) : (
          <Button size="lg" disabled>
            Продолжить бронирование
          </Button>
        )}
      </div>
    </div>
  );
}

function buildCatalogHref(
  pathname: string,
  selection: { style?: string; photographer?: string; studio?: string }
) {
  const params = new URLSearchParams({ flow: "full-shoot" });

  if (selection.style) params.set("style", selection.style);
  if (selection.photographer) params.set("photographer", selection.photographer);
  if (selection.studio) params.set("studio", selection.studio);

  return `${pathname}?${params.toString()}`;
}
