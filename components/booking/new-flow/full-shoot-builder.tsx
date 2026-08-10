import Image from "next/image";
import Link from "next/link";
import {
  ArrowRight,
  Building2,
  Camera,
  Check,
  CircleDashed,
  DoorOpen,
  UserRound
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { formatPrice } from "@/lib/mock-data";
import type { Photographer, Studio, StudioHall } from "@/lib/types";

interface FullShootBuilderProps {
  photographer?: Photographer;
  studio?: Studio;
  studioHall?: StudioHall;
}

export function FullShootBuilder({
  photographer,
  studio,
  studioHall
}: FullShootBuilderProps) {
  const activeHalls = studio?.halls.filter((hall) => (hall.status ?? "Active") === "Active") ?? [];
  const selection = {
    photographer: photographer?.id,
    studio: studio?.id,
    studioHall: studioHall?.id
  };
  const isComplete = Boolean(photographer && studio && studioHall);

  const steps = [
    {
      number: "01",
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
      number: "02",
      title: "Студии",
      description: "Найдите пространство, свет и оборудование для съемки.",
      selectedTitle: studio?.name,
      selectedMeta: studio
        ? `${activeHalls.length} ${formatHallCount(activeHalls.length)} · от ${formatPrice(getLowestHallPrice(activeHalls, studio.pricePerHour))}/ч`
        : undefined,
      imageUrl: studio?.imageUrl,
      href: buildCatalogHref("/studios", selection),
      icon: Building2
    }
  ];

  return (
    <div className="grid gap-8">
      <div className="grid gap-2">
        <h1 className="text-3xl font-semibold tracking-normal md:text-5xl">
          Конструктор
        </h1>
        <p className="max-w-2xl text-sm leading-6 text-muted-foreground md:text-base">
          Соберите съемку из двух ключевых элементов: выберите фотографа и подходящую студию.
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
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
                    sizes="(max-width: 1024px) 100vw, 50vw"
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

      {studio ? (
        <div className="grid gap-4 rounded-lg border border-border bg-card/70 p-5 md:p-6">
          <div className="flex flex-col justify-between gap-3 md:flex-row md:items-end">
            <div>
              <div className="inline-flex items-center gap-2 text-sm font-medium text-primary">
                <DoorOpen className="size-4" aria-hidden="true" />
                Шаг 03
              </div>
              <h2 className="mt-2 text-2xl font-semibold tracking-normal">Выберите зал</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Для конструктора нужен конкретный зал: по нему считаем цену и проверяем календарь.
              </p>
            </div>
            {studioHall ? (
              <span className="rounded-md border border-primary/40 bg-primary/10 px-3 py-2 text-sm text-emerald-200">
                Выбран: {studioHall.name}
              </span>
            ) : null}
          </div>

          {activeHalls.length > 0 ? (
            <div className="grid gap-3 md:grid-cols-2">
              {activeHalls.map((hall) => {
                const isSelected = hall.id === studioHall?.id;

                return (
                  <Link
                    key={hall.id ?? hall.name}
                    href={buildConstructorHref({ ...selection, studioHall: hall.id })}
                    className={cn(
                      "group grid gap-3 overflow-hidden rounded-lg border p-4 transition",
                      isSelected
                        ? "border-primary bg-primary/10"
                        : "border-border hover:-translate-y-0.5 hover:border-primary/50"
                    )}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-lg font-semibold">{hall.name}</p>
                        <p className="mt-1 text-sm text-muted-foreground">
                          до {hall.capacity} чел · {formatPrice(hall.pricePerHour)} / час
                        </p>
                      </div>
                      <span
                        className={cn(
                          "flex size-8 items-center justify-center rounded-md border",
                          isSelected
                            ? "border-primary bg-primary text-emerald-950"
                            : "border-border text-muted-foreground"
                        )}
                      >
                        {isSelected ? <Check className="size-4" /> : <CircleDashed className="size-4" />}
                      </span>
                    </div>
                    <p className="line-clamp-2 text-sm text-muted-foreground">
                      {(hall.amenities ?? []).join(", ") || "Базовая площадка для съемки"}
                    </p>
                  </Link>
                );
              })}
            </div>
          ) : (
            <div className="rounded-lg border border-dashed border-border p-5 text-sm text-muted-foreground">
              У этой студии пока нет активных залов. Выберите другую студию.
            </div>
          )}
        </div>
      ) : null}

      <div className="flex flex-col items-start justify-between gap-5 border-t border-border pt-6 sm:flex-row sm:items-center">
        <div className="flex items-start gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-md bg-secondary">
            <Camera className="size-5" aria-hidden="true" />
          </span>
          <div>
            <p className="font-medium">
              {isComplete ? "Конструктор собран" : "Выберите фотографа, студию и зал"}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              {isComplete
                ? "Переходите к выбору даты, времени и оплате брони."
                : "После выбора всех элементов откроется пошаговое бронирование."}
            </p>
          </div>
        </div>
        {isComplete ? (
          <Button asChild size="lg">
            <Link href={buildBookingHref(selection)}>
              Продолжить бронирование
              {/* <ArrowRight className="size-4" aria-hidden="true" /> */}
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
  selection: { photographer?: string; studio?: string; studioHall?: string }
) {
  const params = new URLSearchParams({ flow: "full-shoot" });

  if (selection.photographer) params.set("photographer", selection.photographer);
  if (selection.studio) params.set("studio", selection.studio);
  if (selection.studioHall) params.set("studioHallId", selection.studioHall);

  return `${pathname}?${params.toString()}`;
}

function buildBookingHref(selection: {
  photographer?: string;
  studio?: string;
  studioHall?: string;
}) {
  const params = new URLSearchParams();
  if (selection.photographer) params.set("photographer", selection.photographer);
  if (selection.studio) params.set("studio", selection.studio);
  if (selection.studioHall) params.set("studioHallId", selection.studioHall);
  return `/booking?${params.toString()}`;
}

function buildConstructorHref(selection: {
  photographer?: string;
  studio?: string;
  studioHall?: string;
}) {
  const params = new URLSearchParams({ type: "FULL_SHOOT" });
  if (selection.photographer) params.set("photographer", selection.photographer);
  if (selection.studio) params.set("studio", selection.studio);
  if (selection.studioHall) params.set("studioHallId", selection.studioHall);
  return `/booking/new?${params.toString()}`;
}

function getLowestHallPrice(halls: StudioHall[], fallback: number) {
  if (halls.length === 0) return fallback;
  return Math.min(...halls.map((hall) => hall.pricePerHour));
}

function formatHallCount(count: number) {
  if (count % 100 >= 11 && count % 100 <= 14) return "залов";
  if (count % 10 === 1) return "зал";
  if (count % 10 >= 2 && count % 10 <= 4) return "зала";
  return "залов";
}
