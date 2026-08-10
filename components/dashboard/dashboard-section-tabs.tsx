"use client";

import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export interface DashboardSectionTab<T extends string> {
  id: T;
  label: string;
  description: string;
  icon: LucideIcon;
  count?: number;
  attention?: boolean;
}

interface DashboardSectionTabsProps<T extends string> {
  value: T;
  onChange: (value: T) => void;
  items: DashboardSectionTab<T>[];
}

export function DashboardSectionTabs<T extends string>({
  value,
  onChange,
  items
}: DashboardSectionTabsProps<T>) {
  return (
    <div
      className="grid grid-cols-2 gap-1.5 rounded-lg border border-border bg-card p-2 sm:gap-2 lg:flex"
      role="tablist"
      aria-label="Разделы кабинета"
    >
      {items.map((item) => {
        const Icon = item.icon;
        const selected = item.id === value;

        return (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={selected}
            onClick={() => onChange(item.id)}
            className={cn(
              "relative flex min-h-14 flex-1 items-center gap-2 px-3 py-2 text-left transition-colors after:absolute after:inset-x-3 after:bottom-0 after:h-0.5 after:origin-center after:bg-primary after:shadow-[0_0_12px_hsl(var(--primary)/0.55)] after:transition-transform focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70 focus-visible:ring-inset sm:min-h-16 sm:gap-3 sm:px-4 sm:py-3 sm:after:inset-x-4",
              selected
                ? "text-foreground after:scale-x-100"
                : "text-muted-foreground after:scale-x-0 hover:bg-secondary/60 hover:text-foreground"
            )}
          >
            <Icon className="size-4 shrink-0 sm:size-5" aria-hidden="true" />
            <span className="min-w-0">
              <span className="flex items-center gap-1.5 text-sm font-medium sm:gap-2 sm:text-base">
                {item.label}
                {item.count !== undefined ? (
                  <span
                    className={cn(
                      "rounded-md px-1.5 py-0.5 text-xs",
                      selected
                        ? "bg-primary/15 text-emerald-300"
                        : "bg-muted"
                    )}
                  >
                    {item.count}
                  </span>
                ) : null}
                {item.attention ? (
                  <span className="inline-flex size-5 items-center justify-center rounded-full bg-amber-400 text-[11px] font-bold text-amber-950 shadow-[0_0_16px_rgba(251,191,36,0.65)]">
                    !
                  </span>
                ) : null}
              </span>
              <span
                className={cn(
                  "mt-0.5 hidden text-xs sm:block",
                  selected ? "text-foreground/70" : "text-muted-foreground"
                )}
              >
                {item.description}
              </span>
            </span>
          </button>
        );
      })}
    </div>
  );
}
