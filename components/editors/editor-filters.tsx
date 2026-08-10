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
import { cn } from "@/lib/utils";
import type { EditorTagOption } from "@/lib/data/editors";

export function EditorFilters({
  tags,
  selectedTag,
  selectedPrice,
  selectedReviews
}: {
  tags: EditorTagOption[];
  selectedTag?: string;
  selectedPrice?: string;
  selectedReviews?: string;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [price, setPrice] = useState(() => normalizePhotographerMaxPrice(selectedPrice));
  const [tag, setTag] = useState(selectedTag ?? "");
  const [reviews, setReviews] = useState(() => String(normalizePhotographerRating(selectedReviews) || ""));

  useEffect(() => {
    setTag(selectedTag ?? "");
    setPrice(normalizePhotographerMaxPrice(selectedPrice));
    setReviews(String(normalizePhotographerRating(selectedReviews) || ""));
  }, [selectedPrice, selectedReviews, selectedTag]);

  function updateFilters(next: { tag?: string; price?: number; reviews?: string }) {
    const nextTag = next.tag ?? tag;
    const nextPrice = next.price ?? price;
    const nextReviews = next.reviews ?? reviews;
    const params = new URLSearchParams();

    if (nextTag) params.set("tag", nextTag);
    if (nextPrice < PHOTOGRAPHER_MAX_PRICE) params.set("price", String(nextPrice));
    if (nextReviews) params.set("reviews", nextReviews);

    setTag(nextTag);
    setPrice(nextPrice);
    setReviews(nextReviews);
    router.replace(`${pathname}${params.size ? `?${params}` : ""}`, { scroll: false });
  }

  function resetFilters() {
    setTag("");
    setPrice(PHOTOGRAPHER_MAX_PRICE);
    setReviews("");
    router.replace("/editors", { scroll: false });
  }

  return (
    <div className="rounded-xl border border-border bg-card/70 p-4 shadow-[0_18px_50px_rgba(0,0,0,0.14)] md:p-5">
      <button
        type="button"
        onClick={() => setIsOpen((value) => !value)}
        className="flex w-full items-center justify-between gap-3 text-left md:hidden"
        aria-expanded={isOpen}
      >
        <span className="inline-flex items-center gap-2 text-base font-semibold">
          <SlidersHorizontal className="size-5 text-primary" aria-hidden="true" />
          Фильтры
        </span>
        <span className="text-sm text-primary">{formatPrice(price)}</span>
      </button>
      <form
        className={cn(
          "mt-4 grid gap-5 md:mt-0 md:grid lg:grid-cols-[1fr_1.2fr_1.4fr_auto] lg:items-end",
          isOpen ? "grid" : "hidden"
        )}
        onSubmit={(event) => event.preventDefault()}
      >
        <label className="grid gap-2 text-sm font-medium">
          Теги монтажа
          <select name="tag" value={tag} onChange={(event) => updateFilters({ tag: event.currentTarget.value })} className={inputClass}>
            <option value="">Все направления</option>
            {tags.map((tag) => <option key={tag.id} value={tag.id}>{tag.title}</option>)}
          </select>
        </label>
        <div className="grid gap-2 text-sm font-medium">
          <div className="flex items-center justify-between gap-3"><span>Цена до</span><span className="text-primary">{price >= PHOTOGRAPHER_MAX_PRICE ? `${formatPrice(PHOTOGRAPHER_MAX_PRICE)}+` : formatPrice(price)}</span></div>
          <input type="range" name="price" min={PHOTOGRAPHER_MIN_PRICE} max={PHOTOGRAPHER_MAX_PRICE} step={PHOTOGRAPHER_PRICE_STEP} value={price} onChange={(event) => updateFilters({ price: Number(event.target.value) })} className="h-11 w-full accent-[hsl(var(--primary))]" />
        </div>
        <div className="grid gap-2 text-sm font-medium">
          <span>Отзывы</span>
          <div className="grid grid-cols-6 gap-1 rounded-md border border-input bg-background p-1">
            {["", "1", "2", "3", "4", "5"].map((rating) => (
              <label key={rating || "all"} className="cursor-pointer">
                <input type="radio" name="reviews" value={rating} checked={reviews === rating} onChange={() => updateFilters({ reviews: rating })} className="peer sr-only" />
                <span className="flex h-9 items-center justify-center rounded text-xs text-muted-foreground transition peer-checked:bg-primary peer-checked:text-primary-foreground">{rating ? `${rating}★` : "Все"}</span>
              </label>
            ))}
          </div>
        </div>
        <div className="flex justify-end"><Button type="button" variant="outline" onClick={resetFilters}>Сбросить</Button></div>
      </form>
    </div>
  );
}

const inputClass = "h-11 w-full rounded-md border border-input bg-background px-3 text-sm outline-none transition focus:ring-2 focus:ring-ring";
