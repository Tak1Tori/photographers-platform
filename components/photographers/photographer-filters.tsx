"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { SlidersHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  PHOTOGRAPHER_MAX_PRICE,
  PHOTOGRAPHER_MIN_PRICE,
  PHOTOGRAPHER_PRICE_STEP,
  normalizePhotographerMaxPrice,
  normalizePhotographerRating
} from "@/lib/photographer-filter-options";
import { formatPrice } from "@/lib/mock-data";
import type { PhotoStyle } from "@/lib/types";
import { cn } from "@/lib/utils";

interface PhotographerFiltersProps {
  styles: PhotoStyle[];
  selectedStyle?: string;
  selectedPrice?: string;
  selectedReviews?: string;
  mode?: string;
}

export function PhotographerFilters({
  styles,
  selectedStyle,
  selectedPrice,
  selectedReviews,
  mode
}: PhotographerFiltersProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [price, setPrice] = useState(() => normalizePhotographerMaxPrice(selectedPrice));
  const [style, setStyle] = useState(selectedStyle ?? "");
  const [reviews, setReviews] = useState(() => String(normalizePhotographerRating(selectedReviews) || ""));

  useEffect(() => {
    setStyle(selectedStyle ?? "");
    setPrice(normalizePhotographerMaxPrice(selectedPrice));
    setReviews(String(normalizePhotographerRating(selectedReviews) || ""));
  }, [selectedPrice, selectedReviews, selectedStyle]);

  function updateFilters(next: { style?: string; price?: number; reviews?: string }) {
    const nextStyle = next.style ?? style;
    const nextPrice = next.price ?? price;
    const nextReviews = next.reviews ?? reviews;
    const params = new URLSearchParams();

    if (mode) params.set("mode", mode);
    if (nextStyle) params.set("style", nextStyle);
    if (nextPrice < PHOTOGRAPHER_MAX_PRICE) params.set("price", String(nextPrice));
    if (nextReviews) params.set("reviews", nextReviews);

    setStyle(nextStyle);
    setPrice(nextPrice);
    setReviews(nextReviews);
    router.replace(`${pathname}${params.size ? `?${params}` : ""}`, { scroll: false });
  }

  function resetFilters() {
    setStyle("");
    setPrice(PHOTOGRAPHER_MAX_PRICE);
    setReviews("");
    router.replace(buildResetHref({ mode }), { scroll: false });
  }

  return (
    <div className="rounded-xl border border-border bg-card/70 p-4 shadow-[0_18px_50px_rgba(0,0,0,0.14)] md:p-5">
      <button
        type="button"
        onClick={() => setIsOpen((current) => !current)}
        className="flex w-full items-center justify-between gap-3 text-left md:hidden"
        aria-expanded={isOpen}
      >
        <span className="inline-flex items-center gap-2 text-base font-semibold">
          <SlidersHorizontal className="h-5 w-5 text-primary" />
          Фильтры
        </span>
        <span className="text-sm text-primary">
          {price >= PHOTOGRAPHER_MAX_PRICE ? `${formatPrice(PHOTOGRAPHER_MAX_PRICE)}+` : formatPrice(price)}
        </span>
      </button>

      <form
        className={cn(
          "mt-4 grid gap-5 md:mt-0 md:grid lg:grid-cols-[1fr_1.2fr_1.4fr_auto] lg:items-end",
          isOpen ? "grid" : "hidden"
        )}
        onSubmit={(event) => event.preventDefault()}
      >
        {mode ? <input type="hidden" name="mode" value={mode} /> : null}

        <label className="grid gap-2 text-sm font-medium">
          Теги
          <select
            name="style"
            value={style}
            onChange={(event) => updateFilters({ style: event.currentTarget.value })}
            className={filterInputClass}
          >
            <option value="">Все направления</option>
            {styles.map((style) => (
              <option key={style.id} value={style.id}>
                {style.title}
              </option>
            ))}
          </select>
        </label>

        <div className="grid gap-2 text-sm font-medium">
          <div className="flex items-center justify-between gap-3">
            <span>Цена до</span>
            <span className="text-sm text-primary">
              {price >= PHOTOGRAPHER_MAX_PRICE ? `${formatPrice(PHOTOGRAPHER_MAX_PRICE)}+` : formatPrice(price)}
            </span>
          </div>
          <input
            type="range"
            name="price"
            min={PHOTOGRAPHER_MIN_PRICE}
            max={PHOTOGRAPHER_MAX_PRICE}
            step={PHOTOGRAPHER_PRICE_STEP}
            value={price}
            onChange={(event) => updateFilters({ price: Number(event.target.value) })}
            className="h-11 w-full accent-[hsl(var(--primary))]"
          />
        </div>

        <div className="grid gap-2 text-sm font-medium">
          <span>Отзывы</span>
          <div className="grid grid-cols-6 gap-1 rounded-md border border-input bg-background p-1">
            <label className="cursor-pointer">
              <input
                type="radio"
                name="reviews"
                value=""
                checked={!reviews}
                onChange={() => updateFilters({ reviews: "" })}
                className="peer sr-only"
              />
              <span className="flex h-9 items-center justify-center rounded text-xs text-muted-foreground transition peer-checked:bg-primary peer-checked:text-primary-foreground">
                Все
              </span>
            </label>
            {[1, 2, 3, 4, 5].map((rating) => (
              <label key={rating} className="cursor-pointer">
                <input
                  type="radio"
                  name="reviews"
                  value={rating}
                  checked={reviews === String(rating)}
                  onChange={() => updateFilters({ reviews: String(rating) })}
                  className="peer sr-only"
                />
                <span className="flex h-9 items-center justify-center rounded text-xs text-muted-foreground transition peer-checked:bg-primary peer-checked:text-primary-foreground">
                  {rating}★
                </span>
              </label>
            ))}
          </div>
        </div>

        <div className="flex justify-end">
          <Button type="button" variant="outline" onClick={resetFilters}>
            Сбросить
          </Button>
        </div>
      </form>
    </div>
  );
}

function buildResetHref({
  mode
}: {
  mode?: string;
}) {
  const params = new URLSearchParams();
  if (mode) params.set("mode", mode);
  const query = params.toString();
  return query ? `/photographers?${query}` : "/photographers";
}

const filterInputClass =
  "h-11 w-full rounded-md border border-input bg-background px-3 text-sm outline-none transition focus:ring-2 focus:ring-ring";
