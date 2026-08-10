import { HeroDotField } from "@/components/home/hero-dot-field";

export function HeroSection() {
  return (
    <section
      className="hero-light-on relative overflow-hidden border-b border-border bg-background"
      data-dot-scene
    >
      <div className="hero-dot-scene pointer-events-none absolute inset-0" aria-hidden="true" />
      <HeroDotField />

      <div className="container relative flex min-h-[620px] items-center justify-center py-16 md:min-h-[680px] md:py-24">
        <div className="relative z-20 mx-auto max-w-5xl text-center">
          <h1 className="hero-light-item hero-light-item-1 text-5xl font-semibold leading-[1.02] tracking-normal md:text-7xl lg:text-8xl">
            Ваша съемка наш праздник
          </h1>
          <p className="hero-light-item hero-light-item-2 mx-auto mt-6 max-w-xl text-lg leading-8 text-muted-foreground">
            Выбирайте проверенных специалистов в удобное для вас время.
          </p>
        </div>
      </div>
    </section>
  );
}
