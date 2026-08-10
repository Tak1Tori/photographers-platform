"use client";

import { useState } from "react";
import { Image as ImageIcon, MessageSquare, Star } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { PortfolioGallery } from "@/components/portfolio/portfolio-gallery";
import type { PhotographerReview, PortfolioItem } from "@/lib/types";
import { cn } from "@/lib/utils";

type PhotographerProfileTabsProps = {
  photographerId: string;
  portfolioItems: PortfolioItem[];
  reviews: PhotographerReview[];
  profileBasePath?: string;
  professionalLabel?: string;
};

type ProfileTab = "portfolio" | "reviews";

export function PhotographerProfileTabs({
  photographerId,
  portfolioItems,
  reviews,
  profileBasePath,
  professionalLabel
}: PhotographerProfileTabsProps) {
  const [activeTab, setActiveTab] = useState<ProfileTab>("portfolio");
  const averageRating =
    reviews.length > 0
      ? reviews.reduce((sum, review) => sum + review.rating, 0) / reviews.length
      : 0;

  return (
    <div className="grid gap-8">
      <div className="flex border-b border-border">
        <TabButton
          active={activeTab === "portfolio"}
          icon={ImageIcon}
          label="Портфолио"
          count={portfolioItems.length}
          onClick={() => setActiveTab("portfolio")}
        />
        <TabButton
          active={activeTab === "reviews"}
          icon={MessageSquare}
          label="Отзывы"
          count={reviews.length}
          onClick={() => setActiveTab("reviews")}
        />
      </div>

      {activeTab === "portfolio" ? (
        <div>
          <h2 className="text-2xl font-semibold tracking-normal">Портфолио</h2>
          <PortfolioGallery
            photographerId={photographerId}
            items={portfolioItems}
            profileBasePath={profileBasePath}
            professionalLabel={professionalLabel}
          />
        </div>
      ) : (
        <div className="grid gap-5">
          <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
            <div>
              <h2 className="text-2xl font-semibold tracking-normal">Отзывы</h2>
            </div>
            {reviews.length > 0 ? (
              <div className="w-fit rounded-lg border border-border bg-card px-4 py-3">
                <div className="flex items-center gap-2 text-lg font-semibold">
                  <Star className="size-5 fill-emerald-300 text-emerald-300" aria-hidden="true" />
                  {averageRating.toFixed(1)}
                </div>
                <p className="text-xs text-muted-foreground">{reviews.length} отзывов</p>
              </div>
            ) : null}
          </div>

          {reviews.length > 0 ? (
            <div className="grid gap-3 md:grid-cols-2">
              {reviews.map((review) => (
                <ReviewCard key={review.id} review={review} />
              ))}
            </div>
          ) : (
            <div className="rounded-lg border border-dashed border-border bg-card/50 p-8 text-center">
              <p className="font-medium">Отзывов пока нет</p>
              <p className="mt-2 text-sm text-muted-foreground">
                После завершенной съемки клиент сможет оставить оценку и комментарий.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function TabButton({
  active,
  icon: Icon,
  label,
  count,
  onClick
}: {
  active: boolean;
  icon: LucideIcon;
  label: string;
  count: number;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "relative flex min-h-16 flex-1 items-center justify-center gap-2 px-4 py-4 text-sm font-medium text-muted-foreground transition hover:text-foreground sm:flex-none sm:justify-start sm:text-base",
        active && "text-foreground"
      )}
    >
      <Icon className="size-5" aria-hidden="true" />
      <span>{label}</span>
      <span className="rounded-md bg-secondary px-2 py-0.5 text-xs">{count}</span>
      <span
        className={cn(
          "absolute inset-x-4 bottom-0 h-0.5 origin-center scale-x-0 bg-primary shadow-[0_0_18px_hsl(var(--primary)/0.42)] transition-transform",
          active && "scale-x-100"
        )}
        aria-hidden="true"
      />
    </button>
  );
}

function ReviewCard({ review }: { review: PhotographerReview }) {
  return (
    <article className="rounded-lg border border-border bg-card p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="font-semibold tracking-normal">{review.clientName}</h3>
          <p className="mt-1 text-xs text-muted-foreground">
            {new Intl.DateTimeFormat("ru-RU", {
              day: "numeric",
              month: "long",
              year: "numeric"
            }).format(new Date(review.createdAt))}
          </p>
        </div>
        <div className="flex items-center gap-1 rounded-md bg-secondary px-2 py-1 text-sm font-medium">
          <Star className="size-4 fill-emerald-300 text-emerald-300" aria-hidden="true" />
          {review.rating}
        </div>
      </div>
      {review.comment ? (
        <p className="mt-4 leading-7 text-muted-foreground">{review.comment}</p>
      ) : (
        <p className="mt-4 text-sm text-muted-foreground">Клиент оставил оценку без комментария.</p>
      )}
    </article>
  );
}
