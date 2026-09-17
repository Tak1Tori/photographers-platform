"use client";

import { useId, useRef, useState } from "react";
import type { KeyboardEvent } from "react";
import { Image as ImageIcon, MessageSquare, Star } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { PortfolioGallery } from "@/components/portfolio/portfolio-gallery";
import type { PhotographerReview, PortfolioItem } from "@/lib/types";
import { cn } from "@/lib/utils";
import motionStyles from "./photographer-profile-tabs.module.css";

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
  const tabsId = useId();
  const tabListRef = useRef<HTMLDivElement>(null);
  const averageRating =
    reviews.length > 0
      ? reviews.reduce((sum, review) => sum + review.rating, 0) / reviews.length
      : 0;

  function handleTabKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;

    event.preventDefault();
    let nextTab: ProfileTab = activeTab === "portfolio" ? "reviews" : "portfolio";
    if (event.key === "Home") nextTab = "portfolio";
    if (event.key === "End") nextTab = "reviews";

    setActiveTab(nextTab);
    tabListRef.current?.querySelector<HTMLButtonElement>(`[data-tab="${nextTab}"]`)?.focus();
  }

  return (
    <div className="grid gap-8">
      <div
        ref={tabListRef}
        role="tablist"
        aria-label="Информация о специалисте"
        onKeyDown={handleTabKeyDown}
        data-active-tab={activeTab}
        className={cn("relative grid grid-cols-2 border-b border-border sm:w-fit", motionStyles.tabList)}
      >
        <TabButton
          id={`${tabsId}-portfolio-tab`}
          panelId={`${tabsId}-portfolio-panel`}
          tab="portfolio"
          active={activeTab === "portfolio"}
          icon={ImageIcon}
          label="Портфолио"
          count={portfolioItems.length}
          onClick={() => setActiveTab("portfolio")}
        />
        <TabButton
          id={`${tabsId}-reviews-tab`}
          panelId={`${tabsId}-reviews-panel`}
          tab="reviews"
          active={activeTab === "reviews"}
          icon={MessageSquare}
          label="Отзывы"
          count={reviews.length}
          onClick={() => setActiveTab("reviews")}
        />
        <span className={motionStyles.indicator} aria-hidden="true" />
      </div>

      <div
        id={`${tabsId}-portfolio-panel`}
        role="tabpanel"
        aria-labelledby={`${tabsId}-portfolio-tab`}
        hidden={activeTab !== "portfolio"}
        tabIndex={0}
        className="rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-4 focus-visible:ring-offset-background"
      >
        {activeTab === "portfolio" ? (
          <div key={activeTab} className={motionStyles.panel}>
            <h2 className="text-2xl font-semibold tracking-normal">Портфолио</h2>
            <PortfolioGallery
              photographerId={photographerId}
              items={portfolioItems}
              profileBasePath={profileBasePath}
              professionalLabel={professionalLabel}
            />
          </div>
        ) : null}
      </div>
      <div
        id={`${tabsId}-reviews-panel`}
        role="tabpanel"
        aria-labelledby={`${tabsId}-reviews-tab`}
        hidden={activeTab !== "reviews"}
        tabIndex={0}
        className="rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-4 focus-visible:ring-offset-background"
      >
        {activeTab === "reviews" ? (
          <div key={activeTab} className={cn("grid gap-5", motionStyles.panel)}>
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
        ) : null}
      </div>
    </div>
  );
}

function TabButton({
  id,
  panelId,
  tab,
  active,
  icon: Icon,
  label,
  count,
  onClick
}: {
  id: string;
  panelId: string;
  tab: ProfileTab;
  active: boolean;
  icon: LucideIcon;
  label: string;
  count: number;
  onClick: () => void;
}) {
  return (
    <button
      id={id}
      type="button"
      role="tab"
      aria-selected={active}
      aria-controls={panelId}
      tabIndex={active ? 0 : -1}
      data-tab={tab}
      onClick={onClick}
      className={cn(
        "relative flex min-h-16 items-center justify-center gap-1.5 rounded-t-lg px-2 py-4 text-sm font-medium text-muted-foreground outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring sm:min-w-48 sm:gap-2 sm:px-4 sm:text-base",
        motionStyles.tab,
        active && "text-foreground"
      )}
    >
      <Icon className={cn("size-5", motionStyles.tabIcon)} aria-hidden="true" />
      <span>{label}</span>
      <span className={cn("rounded-md bg-secondary px-2 py-0.5 text-xs", motionStyles.count)}>{count}</span>
    </button>
  );
}

function ReviewCard({ review }: { review: PhotographerReview }) {
  return (
    <article className="rounded-lg border border-border bg-card p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="font-semibold tracking-normal">{review.clientName}</h3>
          {review.reviewedAt ? (
            <p className="mt-1 text-xs text-muted-foreground">
              {new Intl.DateTimeFormat("ru-RU", {
                day: "numeric",
                month: "long",
                year: "numeric"
              }).format(new Date(review.reviewedAt))}
            </p>
          ) : null}
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
