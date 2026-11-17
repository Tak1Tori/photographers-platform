"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { CheckCircle2, MapPin, Star, WalletCards } from "lucide-react";
import { acceptJobResponseAction, closeJobPostAction } from "@/app/requests/actions";
import { Button } from "@/components/ui/button";
import { formatPrice } from "@/lib/mock-data";
import type { JobPostDetails, JobResponseItem } from "@/lib/job-board/types";

export function JobResponseList({ post }: { post: JobPostDetails }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string>();

  function accept(responseId: string) {
    setError(undefined);
    startTransition(async () => {
      const result = await acceptJobResponseAction(responseId);
      if (result.success && result.bookingUrl) {
        router.push(result.bookingUrl);
        router.refresh();
        return;
      }
      setError(result.error ?? "Не удалось выбрать фотографа.");
    });
  }

  function close() {
    setError(undefined);
    startTransition(async () => {
      const result = await closeJobPostAction(post.id);
      if (result.success) router.refresh();
      else setError(result.error ?? "Не удалось закрыть объявление.");
    });
  }

  return (
    <section className="grid gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-semibold tracking-normal">Отклики</h2>
          <p className="mt-1 text-sm text-muted-foreground">Сравните предложения и выберите фотографа для бронирования.</p>
        </div>
        {post.status === "PUBLISHED" ? <Button type="button" variant="outline" onClick={close} disabled={isPending}>Закрыть объявление</Button> : null}
      </div>
      {error ? <p role="alert" className="rounded-md border border-rose-500/40 bg-rose-950/25 px-4 py-3 text-sm text-rose-100">{error}</p> : null}
      {post.responses.length === 0 ? <div className="rounded-xl border border-dashed border-border bg-card/50 px-6 py-10 text-center text-muted-foreground">Откликов пока нет. Мы сообщим, когда фотограф откликнется.</div> : null}
      {post.responses.map((response) => <ResponseCard key={response.id} response={response} selectable={post.status === "PUBLISHED"} disabled={isPending} onSelect={accept} />)}
    </section>
  );
}

function ResponseCard({ response, selectable, disabled, onSelect }: { response: JobResponseItem; selectable: boolean; disabled: boolean; onSelect: (id: string) => void }) {
  const isAccepted = response.status === "ACCEPTED";
  return (
    <article className={`rounded-xl border p-5 ${isAccepted ? "border-primary/60 bg-primary/[0.06]" : "border-border bg-card"}`}>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <Link href={`/photographers/${response.photographer.id}`} className="flex min-w-0 items-center gap-3 group">
          <div className="relative size-12 shrink-0 overflow-hidden rounded-full bg-secondary">
            <Image src={response.photographer.imageUrl} alt="" fill sizes="48px" className="object-cover" />
          </div>
          <div className="min-w-0">
            <h3 className="truncate font-semibold transition-colors group-hover:text-primary">{response.photographer.name}</h3>
            <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground"><span className="inline-flex items-center gap-1"><MapPin className="size-3.5" aria-hidden="true" />{response.photographer.city}</span><span className="inline-flex items-center gap-1"><Star className="size-3.5 fill-current text-emerald-300" aria-hidden="true" />{response.photographer.rating.toFixed(1)}</span></p>
          </div>
        </Link>
        <div className="sm:text-right"><p className="text-xs text-muted-foreground">Предложенная цена</p><p className="mt-1 inline-flex items-center gap-1 font-semibold"><WalletCards className="size-4 text-primary" aria-hidden="true" />{formatPrice(response.quotedPrice)}</p></div>
      </div>
      <p className="mt-4 text-sm leading-6 text-muted-foreground">{response.message}</p>
      <div className="mt-5 flex flex-wrap items-center gap-3">
        {isAccepted ? <span className="inline-flex items-center gap-2 text-sm font-medium text-emerald-300"><CheckCircle2 className="size-4" aria-hidden="true" />Выбран</span> : null}
        {selectable ? <Button type="button" size="sm" onClick={() => onSelect(response.id)} disabled={disabled}>Выбрать и забронировать</Button> : null}
      </div>
    </article>
  );
}
