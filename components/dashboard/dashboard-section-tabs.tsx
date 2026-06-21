"use client";

import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export interface DashboardSectionTab<T extends string> {
  id: T;
  label: string;
  description: string;
  icon: LucideIcon;
  count?: number;
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
      className="grid gap-2 rounded-lg border border-border bg-card p-2 sm:grid-cols-2 lg:flex"
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
              "relative flex min-h-16 flex-1 items-center gap-3 px-4 py-3 text-left transition-colors after:absolute after:inset-x-4 after:bottom-0 after:h-0.5 after:origin-center after:bg-emerald-400 after:shadow-[0_0_12px_rgba(52,211,153,0.85)] after:transition-transform focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/70 focus-visible:ring-inset",
              selected
                ? "text-foreground after:scale-x-100"
                : "text-muted-foreground after:scale-x-0 hover:bg-secondary/60 hover:text-foreground"
            )}
          >
            <Icon className="size-5 shrink-0" aria-hidden="true" />
            <span className="min-w-0">
              <span className="flex items-center gap-2 font-medium">
                {item.label}
                {item.count !== undefined ? (
                  <span
                    className={cn(
                      "rounded-md px-1.5 py-0.5 text-xs",
                      selected
                        ? "bg-emerald-400/15 text-emerald-300"
                        : "bg-muted"
                    )}
                  >
                    {item.count}
                  </span>
                ) : null}
              </span>
              <span
                className={cn(
                  "mt-0.5 block text-xs",
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
