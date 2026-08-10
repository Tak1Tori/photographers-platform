"use client";

import Image from "next/image";
import { useEffect, useRef } from "react";

const benefits = [
  {
    title: "Проверенные специалисты",
    description: "Смотрите портфолио, специализации и отзывы до выбора исполнителя.",
    image: "/images/benefits/verified-specialists.png",
    imageClassName: "scale-[1.18] -rotate-3 object-[57%_57%]"
  },
  {
    title: "Свободное время без переписок",
    description: "Выбирайте дату и слот в актуальном календаре фотографа.",
    image: "/images/benefits/available-time.png",
    imageClassName: "scale-[1.15] rotate-2 object-[48%_46%]"
  },
  {
    title: "Прозрачная стоимость",
    description: "Стоимость услуги, сервисный сбор и остаток видны до подтверждения брони.",
    image: "/images/benefits/transparent-price.png",
    imageClassName: "scale-[1.2] -rotate-2 object-[53%_55%]"
  },
  {
    title: "Все детали в одном месте",
    description: "Следите за статусом брони и держите договоренности под рукой.",
    image: "/images/benefits/booking-details.png",
    imageClassName: "scale-[1.16] rotate-3 object-[51%_50%]"
  }
] as const;

export function BenefitsSlider() {
  const railRef = useRef<HTMLDivElement>(null);
  const pauseTimeoutRef = useRef<number>();
  const isAutoplayPausedRef = useRef(false);

  useEffect(() => {
    const rail = railRef.current;
    if (!rail) return;

    const placeOnMiddleLoop = () => {
      const loopWidth = rail.scrollWidth / 3;

      if (loopWidth > 0) {
        rail.scrollLeft = loopWidth;
      }
    };

    const observer = new ResizeObserver(placeOnMiddleLoop);
    observer.observe(rail);
    const initialFrame = window.requestAnimationFrame(placeOnMiddleLoop);

    let animationFrame = 0;
    let previousTimestamp = performance.now();

    const animate = (timestamp: number) => {
      const elapsed = timestamp - previousTimestamp;
      previousTimestamp = timestamp;

      if (!isAutoplayPausedRef.current) {
        const loopWidth = rail.scrollWidth / 3;

        if (loopWidth > rail.clientWidth + 4) {
          rail.scrollLeft += elapsed * 0.018;

          if (rail.scrollLeft >= loopWidth * 2) {
            rail.scrollLeft -= loopWidth;
          }
        }
      }

      animationFrame = window.requestAnimationFrame(animate);
    };

    animationFrame = window.requestAnimationFrame(animate);

    return () => {
      observer.disconnect();
      window.cancelAnimationFrame(initialFrame);
      window.cancelAnimationFrame(animationFrame);
      window.clearTimeout(pauseTimeoutRef.current);
    };
  }, []);

  function pauseAutoplay() {
    window.clearTimeout(pauseTimeoutRef.current);
    isAutoplayPausedRef.current = true;
  }

  function resumeAutoplay(delay = 1400) {
    window.clearTimeout(pauseTimeoutRef.current);
    pauseTimeoutRef.current = window.setTimeout(() => {
      isAutoplayPausedRef.current = false;
    }, delay);
  }

  return (
    <section className="border-b border-border py-8 md:py-10">
      <div className="container mb-5">
        <p className="text-sm font-medium uppercase tracking-[0.18em] text-primary">Framely</p>
      </div>

      <div
        ref={railRef}
        className="flex gap-4 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        onPointerDown={pauseAutoplay}
        onPointerUp={() => resumeAutoplay()}
        onPointerCancel={() => resumeAutoplay()}
        onMouseEnter={pauseAutoplay}
        onMouseLeave={() => resumeAutoplay(200)}
        onFocusCapture={pauseAutoplay}
        onBlurCapture={() => resumeAutoplay(200)}
      >
        {[0, 1, 2].flatMap((loopIndex) =>
          benefits.map((benefit) => {
            return (
              <article
                key={`${loopIndex}-${benefit.title}`}
                data-benefit-card
                aria-hidden={loopIndex !== 1}
                className="grid w-[84vw] max-w-[42rem] shrink-0 overflow-hidden rounded-lg border border-border bg-card sm:grid-cols-[1fr_13rem] sm:w-[38rem]"
              >
                <div className="p-5 md:p-7">
                  <h2 className="text-xl font-semibold tracking-normal md:text-2xl">{benefit.title}</h2>
                  <p className="mt-3 max-w-lg text-sm leading-6 text-muted-foreground md:text-base md:leading-7">
                    {benefit.description}
                  </p>
                </div>
                <div className="relative min-h-40 overflow-hidden border-t border-border bg-secondary sm:min-h-0 sm:border-l sm:border-t-0">
                  <Image
                    src={benefit.image}
                    alt=""
                    fill
                    sizes="(min-width: 640px) 208px, 84vw"
                    className={`object-cover transition-transform duration-500 ${benefit.imageClassName}`}
                  />
                  <span className="absolute inset-0 bg-gradient-to-tr from-background/25 via-transparent to-transparent" aria-hidden="true" />
                </div>
              </article>
            );
          })
        )}
      </div>
    </section>
  );
}
