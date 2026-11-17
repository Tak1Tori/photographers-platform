import Link from "next/link";
import { CalendarDays, Clock3, type LucideIcon, MapPin, MessagesSquare, WalletCards } from "lucide-react";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { formatPrice } from "@/lib/mock-data";
import type { JobPostCard } from "@/lib/job-board/types";

export function JobPostCard({ post, showStatus = false }: { post: JobPostCard; showStatus?: boolean }) {
  return (
    <article className="grid gap-5 rounded-xl border border-border bg-card p-5 shadow-sm shadow-emerald-950/15 md:grid-cols-[minmax(0,1fr)_auto] md:items-start md:p-6">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          {post.style ? <span className="rounded-md bg-secondary px-2 py-1 font-medium text-secondary-foreground">{post.style.title}</span> : null}
          {showStatus ? <JobPostStatus status={post.status} /> : null}
        </div>
        <h2 className="mt-3 text-xl font-semibold tracking-normal md:text-2xl">
          <Link className="transition-colors hover:text-primary" href={`/requests/${post.id}`}>
            {post.title}
          </Link>
        </h2>
        <p className="mt-3 line-clamp-2 max-w-3xl text-sm leading-6 text-muted-foreground md:text-base">
          {post.description}
        </p>
        <dl className="mt-5 flex flex-wrap gap-x-5 gap-y-3 text-sm text-muted-foreground">
          <Meta icon={CalendarDays}>{formatDate(post.date)}</Meta>
          <Meta icon={Clock3}>{post.startTime} · {post.durationHours} ч</Meta>
          <Meta icon={MapPin}>{post.city}</Meta>
          <Meta icon={MessagesSquare}>{post.responsesCount} {plural(post.responsesCount, "отклик", "отклика", "откликов")}</Meta>
        </dl>
      </div>

      <div className="flex min-w-[10rem] flex-col items-start gap-4 border-t border-border pt-4 md:items-end md:border-t-0 md:pt-0">
        <div className="md:text-right">
          <p className="text-xs text-muted-foreground">Бюджет</p>
          <p className="mt-1 text-lg font-semibold">{formatPrice(post.budget)}</p>
        </div>
        <Button asChild variant={post.hasResponded ? "secondary" : "outline"}>
          <Link href={`/requests/${post.id}`}>{post.hasResponded ? "Отклик отправлен" : "Посмотреть"}</Link>
        </Button>
      </div>
    </article>
  );
}

export function JobPostStatus({ status }: { status: JobPostCard["status"] }) {
  const labels = {
    DRAFT: "Черновик",
    PUBLISHED: "Открыто",
    SELECTED: "Фотограф выбран",
    PAUSED: "На паузе",
    CLOSED: "Закрыто",
    EXPIRED: "Срок истёк"
  };
  return <span className="rounded-md border border-border px-2 py-1 font-medium">{labels[status]}</span>;
}

function Meta({ icon: Icon, children }: { icon: LucideIcon; children: ReactNode }) {
  return <div className="inline-flex items-center gap-1.5"><Icon className="size-4 text-primary" aria-hidden="true" />{children}</div>;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "long" }).format(new Date(value));
}

function plural(value: number, one: string, few: string, many: string) {
  const remainder = value % 100;
  if (remainder >= 11 && remainder <= 19) return many;
  const last = value % 10;
  if (last === 1) return one;
  if (last >= 2 && last <= 4) return few;
  return many;
}
