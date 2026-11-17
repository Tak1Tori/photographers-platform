"use client";

import { type FormEvent, useState, useTransition } from "react";
import { createJobResponseAction } from "@/app/requests/actions";
import { Button } from "@/components/ui/button";

export function JobResponseForm({ jobPostId, suggestedPrice }: { jobPostId: string; suggestedPrice: number }) {
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState("");
  const [price, setPrice] = useState(String(suggestedPrice));
  const [result, setResult] = useState<{ error?: string; message?: string }>({});

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setResult({});
    startTransition(async () => {
      const response = await createJobResponseAction(new FormData(event.currentTarget));
      setResult(response.success ? { message: response.message } : { error: response.error });
    });
  }

  return (
    <form onSubmit={submit} className="rounded-xl border border-primary/30 bg-card p-5 md:p-6">
      <h2 className="text-xl font-semibold tracking-normal">Откликнуться</h2>
      <p className="mt-2 text-sm leading-6 text-muted-foreground">Расскажите, как вы проведёте съёмку. Контакты станут доступны только после выбора.</p>
      <input type="hidden" name="jobPostId" value={jobPostId} />
      <label className="mt-5 grid gap-2 text-sm font-medium">Ваше предложение
        <textarea name="message" value={message} onChange={(event) => setMessage(event.currentTarget.value)} required minLength={10} maxLength={1200} className="min-h-28 rounded-md border border-input bg-background px-3 py-2.5 text-sm font-normal outline-none focus:ring-2 focus:ring-ring" placeholder="Например, предложу два варианта локации и подготовлю референсы до съёмки." />
      </label>
      <label className="mt-4 grid max-w-xs gap-2 text-sm font-medium">Ваша цена, ₸
        <input name="quotedPrice" type="number" value={price} onChange={(event) => setPrice(event.currentTarget.value)} min={5000} max={2000000} step={1000} required className="rounded-md border border-input bg-background px-3 py-2.5 text-sm font-normal outline-none focus:ring-2 focus:ring-ring" />
      </label>
      {result.error ? <p role="alert" className="mt-4 text-sm text-rose-300">{result.error}</p> : null}
      {result.message ? <p className="mt-4 text-sm text-emerald-300">{result.message}</p> : null}
      <Button className="mt-5" disabled={isPending || Boolean(result.message)}>{isPending ? "Отправляем…" : "Отправить отклик"}</Button>
    </form>
  );
}
