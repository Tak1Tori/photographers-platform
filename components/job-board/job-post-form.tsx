"use client";

import { useRouter } from "next/navigation";
import { type FormEvent, useState, useTransition } from "react";
import { CalendarDays, CheckCircle2, Clock3, type LucideIcon, MapPin, WalletCards } from "lucide-react";
import type { ReactNode } from "react";
import { createJobPostAction } from "@/app/requests/actions";
import { Button } from "@/components/ui/button";
import { formatPrice } from "@/lib/mock-data";
import type { PhotoStyle } from "@/lib/types";

export function JobPostForm({ styles }: { styles: PhotoStyle[] }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string>();
  const [values, setValues] = useState({ title: "", city: "Алматы", date: "", startTime: "", durationHours: "2", budget: "", description: "", styleId: "" });

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(undefined);
    startTransition(async () => {
      const result = await createJobPostAction(new FormData(event.currentTarget));
      if (result.success && result.id) {
        router.push(`/requests/${result.id}`);
        router.refresh();
        return;
      }
      setError(result.error ?? "Не удалось опубликовать объявление.");
    });
  }

  return (
    <form onSubmit={submit} className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_24rem]">
      <section className="rounded-xl border border-border bg-card p-5 md:p-7">
        <h1 className="text-3xl font-semibold tracking-normal md:text-4xl">Расскажите о съёмке</h1>
        <p className="mt-3 max-w-2xl text-muted-foreground">Чем точнее бриф, тем полезнее будут отклики фотографов.</p>
        <div className="mt-7 grid gap-5">
          <Field label="Название съёмки" required>
            <input name="title" className={inputClass} placeholder="Например, портретная съёмка для бренда" value={values.title} onChange={(event) => setValues({ ...values, title: event.currentTarget.value })} required minLength={6} maxLength={110} />
          </Field>
          <Field label="Описание" required>
            <textarea name="description" className={`${inputClass} min-h-36 resize-y py-3`} placeholder="Что важно в съёмке, какой результат нужен, есть ли пожелания к стилю и локации" value={values.description} onChange={(event) => setValues({ ...values, description: event.currentTarget.value })} required minLength={20} maxLength={1500} />
            <span className="mt-1 text-right text-xs text-muted-foreground">{values.description.length}/1500</span>
          </Field>
          <div className="grid gap-5 sm:grid-cols-2">
            <Field label="Стиль съёмки">
              <select name="styleId" className={inputClass} value={values.styleId} onChange={(event) => setValues({ ...values, styleId: event.currentTarget.value })}>
                <option value="">Не принципиально</option>
                {styles.map((style) => <option key={style.id} value={style.id}>{style.title}</option>)}
              </select>
            </Field>
            <Field label="Город" required>
              <input name="city" className={inputClass} value={values.city} onChange={(event) => setValues({ ...values, city: event.currentTarget.value })} required maxLength={80} />
            </Field>
            <Field label="Дата" required>
              <input name="date" className={inputClass} type="date" value={values.date} onChange={(event) => setValues({ ...values, date: event.currentTarget.value })} required />
            </Field>
            <Field label="Начало" required>
              <input name="startTime" className={inputClass} type="time" value={values.startTime} onChange={(event) => setValues({ ...values, startTime: event.currentTarget.value })} required />
            </Field>
            <Field label="Длительность" required>
              <select name="durationHours" className={inputClass} value={values.durationHours} onChange={(event) => setValues({ ...values, durationHours: event.currentTarget.value })}>
                {[1, 2, 3, 4, 5, 6, 8, 10, 12].map((hour) => <option key={hour} value={hour}>{hour} {hour === 1 ? "час" : hour < 5 ? "часа" : "часов"}</option>)}
              </select>
            </Field>
            <Field label="Бюджет, ₸" required>
              <input name="budget" className={inputClass} type="number" min={5000} max={2000000} step={1000} placeholder="Например, 35 000" value={values.budget} onChange={(event) => setValues({ ...values, budget: event.currentTarget.value })} required />
            </Field>
          </div>
        </div>
        {error ? <p role="alert" className="mt-5 rounded-md border border-rose-500/45 bg-rose-950/30 px-4 py-3 text-sm text-rose-100">{error}</p> : null}
        <Button className="mt-6 w-full sm:w-auto" size="lg" disabled={isPending}>{isPending ? "Публикуем…" : "Опубликовать объявление"}</Button>
        <p className="mt-3 text-xs leading-5 text-muted-foreground">Контакты в объявлении и откликах скрыты. Они откроются после выбора фотографа.</p>
      </section>

      <aside className="h-fit rounded-xl border border-border bg-card p-5 md:p-6 xl:sticky xl:top-28">
        <p className="text-sm font-medium text-primary">Предпросмотр</p>
        <h2 className="mt-2 text-xl font-semibold tracking-normal">Так увидят ваше объявление</h2>
        <div className="mt-5 rounded-lg border border-border bg-background/50 p-4">
          <h3 className="font-semibold">{values.title || "Название съёмки"}</h3>
          <div className="mt-4 grid gap-3 text-sm text-muted-foreground">
            <Preview icon={MapPin}>{values.city || "Город не указан"}</Preview>
            <Preview icon={CalendarDays}>{values.date ? new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "long" }).format(new Date(`${values.date}T12:00:00`)) : "Дата не указана"}</Preview>
            <Preview icon={Clock3}>{values.startTime || "Время не указано"} · {values.durationHours || "—"} ч</Preview>
            <Preview icon={WalletCards}>{values.budget ? formatPrice(Number(values.budget)) : "Бюджет не указан"}</Preview>
          </div>
          <p className="mt-4 line-clamp-4 text-sm leading-6 text-muted-foreground">{values.description || "Здесь появится краткое описание задачи."}</p>
        </div>
        <div className="mt-5 flex gap-3 rounded-lg border border-primary/20 bg-primary/[0.06] p-4 text-sm text-muted-foreground">
          <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden="true" />
          Откликнуться смогут только фотографы с опубликованным профилем.
        </div>
      </aside>
    </form>
  );
}

function Field({ label, required, children }: { label: string; required?: boolean; children: ReactNode }) {
  return <label className="grid gap-2 text-sm font-medium"><span>{label}{required ? <span className="text-primary"> *</span> : null}</span>{children}</label>;
}

function Preview({ icon: Icon, children }: { icon: LucideIcon; children: ReactNode }) {
  return <div className="flex items-center gap-2"><Icon className="size-4 text-primary" aria-hidden="true" />{children}</div>;
}

const inputClass = "w-full rounded-md border border-input bg-background px-3 py-2.5 text-sm outline-none transition focus:ring-2 focus:ring-ring";
