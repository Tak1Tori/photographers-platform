"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { SlidersHorizontal } from "lucide-react";
import type { ReactNode } from "react";
import type { PhotoStyle } from "@/lib/types";

export function JobPostFilters({ styles }: { styles: PhotoStyle[] }) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();

  function update(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value) params.set(key, value);
    else params.delete(key);
    router.replace(`${pathname}${params.size ? `?${params}` : ""}`, { scroll: false });
  }

  return (
    <aside className="rounded-xl border border-border bg-card p-5 lg:sticky lg:top-28">
      <div className="flex items-center justify-between gap-3">
        <h2 className="inline-flex items-center gap-2 font-semibold"><SlidersHorizontal className="size-4 text-primary" aria-hidden="true" />Фильтры</h2>
        <button type="button" className="text-sm text-primary hover:underline" onClick={() => router.replace(pathname, { scroll: false })}>Сбросить</button>
      </div>
      <div className="mt-5 grid gap-4">
        <Filter label="Город">
          <input className={inputClass} defaultValue={searchParams.get("city") ?? ""} placeholder="Алматы" onBlur={(event) => update("city", event.currentTarget.value.trim())} />
        </Filter>
        <Filter label="Дата">
          <input className={inputClass} type="date" value={searchParams.get("date") ?? ""} onChange={(event) => update("date", event.currentTarget.value)} />
        </Filter>
        <Filter label="Стиль">
          <select className={inputClass} value={searchParams.get("style") ?? ""} onChange={(event) => update("style", event.currentTarget.value)}>
            <option value="">Все направления</option>
            {styles.map((style) => <option key={style.id} value={style.id}>{style.title}</option>)}
          </select>
        </Filter>
        <Filter label="Бюджет до">
          <select className={inputClass} value={searchParams.get("budget") ?? ""} onChange={(event) => update("budget", event.currentTarget.value)}>
            <option value="">Неважно</option>
            {[20_000, 40_000, 70_000, 120_000, 200_000].map((value) => <option key={value} value={value}>{new Intl.NumberFormat("ru-RU").format(value)} ₸</option>)}
          </select>
        </Filter>
      </div>
    </aside>
  );
}

function Filter({ label, children }: { label: string; children: ReactNode }) {
  return <label className="grid gap-2 text-sm font-medium"><span>{label}</span>{children}</label>;
}

const inputClass = "h-11 w-full rounded-md border border-input bg-background px-3 text-sm outline-none transition focus:ring-2 focus:ring-ring";
