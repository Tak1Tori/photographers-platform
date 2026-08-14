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
  const trackRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;

    const setLoopWidth = () => {
      const cards = track.querySelectorAll<HTMLElement>("[data-benefit-card]");
      const firstCard = cards.item(0);
      const firstCardOfSecondLoop = cards.item(benefits.length);

      if (!firstCard || !firstCardOfSecondLoop) return;

      const loopWidth = firstCardOfSecondLoop.offsetLeft - firstCard.offsetLeft;
      track.style.setProperty("--benefits-loop-width", `${loopWidth}px`);
    };

    const observer = new ResizeObserver(setLoopWidth);
    observer.observe(track);
    const initialFrame = window.requestAnimationFrame(setLoopWidth);

    return () => {
      observer.disconnect();
      window.cancelAnimationFrame(initialFrame);
    };
  }, []);

  return (
    <section className="border-b border-border py-8 md:py-10">
      <div className="container mb-5">
        <p className="text-sm font-medium uppercase tracking-[0.18em] text-primary">Framely</p>
      </div>

      <div className="overflow-hidden pb-1">
        <div ref={trackRef} className="benefits-slider-track flex w-max gap-4">
          {[0, 1].flatMap((loopIndex) =>
          benefits.map((benefit) => {
            return (
              <article
                key={`${loopIndex}-${benefit.title}`}
                data-benefit-card
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
      </div>
    </section>
  );
}
