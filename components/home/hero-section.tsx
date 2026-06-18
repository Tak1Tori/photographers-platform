import Link from "next/link";
import { ArrowRight, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";

export function HeroSection() {
  return (
    <section className="relative overflow-hidden border-b border-border bg-background">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_10%,hsl(151_58%_24%/0.38),transparent_34rem)]" />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-48 bg-gradient-to-t from-primary/10 to-transparent" />
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-emerald-400/45 to-transparent" />
      <div className="container relative flex min-h-[620px] items-center justify-center py-16 md:min-h-[680px] md:py-24">
        <div className="relative z-20 mx-auto max-w-5xl text-center">
          <div className="mb-6 inline-flex items-center gap-2 rounded-md border border-border bg-card/80 px-3 py-2 text-sm text-muted-foreground shadow-sm shadow-emerald-950/30 backdrop-blur">
            <Sparkles className="size-4 text-accent" aria-hidden="true" />
            Фотосессия в несколько шагов
          </div>
          <h1 className="text-5xl font-semibold leading-[1.02] tracking-normal md:text-7xl lg:text-8xl">
            Забронируйте фотосессию под ключ
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg leading-8 text-muted-foreground">
            Выберите стиль, фотографа, студию и удобное время в одном месте.
            Или забронируйте только нужного специалиста или пространство.
          </p>
          <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
            <Button asChild size="lg">
              <Link href="/booking/new">
                Начать подбор
                <ArrowRight className="size-4" aria-hidden="true" />
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link href="/styles">
                Смотреть стили
              </Link>
            </Button>
          </div>
          <div className="mx-auto mt-12 grid max-w-2xl grid-cols-3 gap-3 border-t border-border/70 pt-6 text-left">
            <div>
              <p className="text-xl font-semibold text-foreground">3 формата</p>
              <p className="mt-1 text-xs text-muted-foreground">Под ключ или отдельно</p>
            </div>
            <div>
              <p className="text-xl font-semibold text-foreground">1 маршрут</p>
              <p className="mt-1 text-xs text-muted-foreground">От выбора до брони</p>
            </div>
            <div>
              <p className="text-xl font-semibold text-foreground">Mock-оплата</p>
              <p className="mt-1 text-xs text-muted-foreground">Без реального списания</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
