"use client";

import Image from "next/image";
import Link from "next/link";
import { ChevronLeft, ChevronRight, MapPin, Star } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { formatPrice } from "@/lib/mock-data";
import type { Photographer, Studio } from "@/lib/types";

const photographerFallback =
  "https://images.unsplash.com/photo-1516035069371-29a1b244cc32?auto=format&fit=crop&w=900&q=80";
const studioFallback =
  "https://images.unsplash.com/photo-1604014237800-1c9102c219da?auto=format&fit=crop&w=1200&q=80";

type MarketplaceSliderProps =
  | {
      title: string;
      viewAllHref: string;
      items: Photographer[];
      type: "photographers";
    }
  | {
      title: string;
      viewAllHref: string;
      items: Studio[];
      type: "studios";
    };

export function MarketplaceSlider(props: MarketplaceSliderProps) {
  const railRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(props.items.length > 1);

  useEffect(() => {
    const rail = railRef.current;
    if (!rail) return;

    const observer = new ResizeObserver(updateControls);
    observer.observe(rail);
    updateControls();

    return () => observer.disconnect();
  }, []);

  if (props.items.length === 0) return null;

  function updateControls() {
    const rail = railRef.current;
    if (!rail) return;

    setCanScrollLeft(rail.scrollLeft > 4);
    setCanScrollRight(
      rail.scrollLeft + rail.clientWidth < rail.scrollWidth - 4
    );
  }

  function scroll(direction: -1 | 1) {
    const rail = railRef.current;
    if (!rail) return;

    rail.scrollBy({
      left: direction * Math.max(rail.clientWidth * 0.82, 280),
      behavior: "smooth"
    });
  }

  return (
    <section className="py-10 md:py-14">
      <div className="container">
        <div className="mb-6 flex items-center justify-between gap-4">
          <div className="flex min-w-0 items-baseline gap-4">
            <h2 className="text-2xl font-semibold tracking-normal md:text-3xl">
              {props.title}
            </h2>
            <Link
              href={props.viewAllHref}
              className="hidden text-sm text-muted-foreground transition-colors hover:text-foreground sm:inline"
            >
              Смотреть всех
            </Link>
          </div>
          <div className="flex shrink-0 gap-2">
            <Button
              type="button"
              size="sm"
              variant="secondary"
              className="size-10 p-0"
              aria-label={`Прокрутить ${props.title.toLowerCase()} назад`}
              disabled={!canScrollLeft}
              onClick={() => scroll(-1)}
            >
              <ChevronLeft className="size-5" aria-hidden="true" />
            </Button>
            <Button
              type="button"
              size="sm"
              variant="secondary"
              className="size-10 p-0"
              aria-label={`Прокрутить ${props.title.toLowerCase()} вперед`}
              disabled={!canScrollRight}
              onClick={() => scroll(1)}
            >
              <ChevronRight className="size-5" aria-hidden="true" />
            </Button>
          </div>
        </div>

        <div
          ref={railRef}
          className="-mx-4 flex snap-x snap-mandatory gap-4 overflow-x-auto px-4 pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          onScroll={updateControls}
        >
          {props.type === "photographers"
            ? props.items.map((photographer) => (
                <PhotographerSlide
                  key={photographer.id}
                  photographer={photographer}
                />
              ))
            : props.items.map((studio) => (
                <StudioSlide key={studio.id} studio={studio} />
              ))}
        </div>

        <Link
          href={props.viewAllHref}
          className="mt-5 inline-block text-sm text-muted-foreground transition-colors hover:text-foreground sm:hidden"
        >
          Смотреть всех
        </Link>
      </div>
    </section>
  );
}

function PhotographerSlide({ photographer }: { photographer: Photographer }) {
  return (
    <Link
      href={`/photographers/${photographer.id}`}
      className="group w-[82vw] max-w-[310px] shrink-0 snap-start overflow-hidden rounded-lg border border-border bg-card transition-colors hover:border-primary/45 sm:w-[46vw] lg:w-[calc((100%_-_3rem)/4)]"
    >
      <div className="relative aspect-[4/3] overflow-hidden">
        <Image
          src={photographer.imageUrl || photographerFallback}
          alt={photographer.name}
          fill
          sizes="(max-width: 640px) 82vw, (max-width: 1024px) 46vw, 295px"
          className="object-cover transition-transform duration-500 group-hover:scale-[1.025]"
        />
      </div>
      <div className="p-4">
        <div className="flex items-start justify-between gap-3">
          <h3 className="truncate font-semibold">{photographer.name}</h3>
          <span className="inline-flex shrink-0 items-center gap-1 text-sm text-accent">
            <Star className="size-4 fill-current" aria-hidden="true" />
            {photographer.rating}
          </span>
        </div>
        <p className="mt-2 flex items-center gap-1.5 truncate text-sm text-muted-foreground">
          <MapPin className="size-4 shrink-0" aria-hidden="true" />
          {photographer.city}
        </p>
        <p className="mt-4 text-sm font-medium">
          {formatPrice(photographer.pricePerHour)} / час
        </p>
      </div>
    </Link>
  );
}

function StudioSlide({ studio }: { studio: Studio }) {
  return (
    <Link
      href={`/studios/${studio.id}`}
      className="group w-[82vw] max-w-[310px] shrink-0 snap-start overflow-hidden rounded-lg border border-border bg-card transition-colors hover:border-primary/45 sm:w-[46vw] lg:w-[calc((100%_-_3rem)/4)]"
    >
      <div className="relative aspect-[4/3] overflow-hidden">
        <Image
          src={studio.imageUrl || studioFallback}
          alt={studio.name}
          fill
          sizes="(max-width: 640px) 82vw, (max-width: 1024px) 46vw, 295px"
          className="object-cover transition-transform duration-500 group-hover:scale-[1.025]"
        />
      </div>
      <div className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="truncate font-semibold">{studio.name}</h3>
            <p className="mt-1 truncate text-sm text-muted-foreground">
              {studio.hallName}
            </p>
          </div>
          <span className="inline-flex shrink-0 items-center gap-1 text-sm text-accent">
            <Star className="size-4 fill-current" aria-hidden="true" />
            {studio.rating}
          </span>
        </div>
        <p className="mt-3 flex items-center gap-1.5 truncate text-sm text-muted-foreground">
          <MapPin className="size-4 shrink-0" aria-hidden="true" />
          {studio.address}
        </p>
        <p className="mt-4 text-sm font-medium">
          {formatPrice(studio.pricePerHour)} / час
        </p>
      </div>
    </Link>
  );
}
