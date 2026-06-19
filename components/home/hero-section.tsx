import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";

export function HeroSection() {
  return (
    <section className="hero-light-on relative overflow-hidden border-b border-border bg-background">
      <div
        className="hero-light-wash pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_10%,hsl(151_58%_24%/0.38),transparent_34rem)]"
        aria-hidden="true"
      />
      <div
        className="hero-light-flash pointer-events-none absolute inset-0"
        aria-hidden="true"
      />
      <div className="hero-light-base pointer-events-none absolute inset-x-0 bottom-0 h-48 bg-gradient-to-t from-primary/10 to-transparent" />
      <div className="hero-light-line pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-emerald-400/45 to-transparent" />
      <div className="container relative flex min-h-[620px] items-center justify-center py-16 md:min-h-[680px] md:py-24">
        <div className="relative z-20 mx-auto max-w-5xl text-center">
          <h1 className="hero-light-item hero-light-item-1 text-5xl font-semibold leading-[1.02] tracking-normal md:text-7xl lg:text-8xl">
            Забронируйте фотосессию под ключ
          </h1>
          <p className="hero-light-item hero-light-item-2 mx-auto mt-6 max-w-xl text-lg leading-8 text-muted-foreground">
            Стиль, фотограф, студия и удобное время в одном месте.
          </p>
          <div className="hero-light-item hero-light-item-3 mt-8 flex justify-center">
            <Button asChild size="lg">
              <Link href="/booking/new">
                Начать подбор
                <ArrowRight className="size-4" aria-hidden="true" />
              </Link>
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}
