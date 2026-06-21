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
              "flex min-h-16 flex-1 items-center gap-3 rounded-md px-4 py-3 text-left transition-colors",
              selected
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-secondary hover:text-foreground"
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
                      selected ? "bg-black/20" : "bg-muted"
                    )}
                  >
                    {item.count}
                  </span>
                ) : null}
              </span>
              <span
                className={cn(
                  "mt-0.5 block text-xs",
                  selected ? "text-primary-foreground/70" : "text-muted-foreground"
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
