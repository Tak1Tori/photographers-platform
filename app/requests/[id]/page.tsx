import Link from "next/link";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { CalendarDays, Clock3, MapPin, WalletCards } from "lucide-react";
import { JobPostStatus } from "@/components/job-board/job-post-card";
import { JobResponseForm } from "@/components/job-board/job-response-form";
import { JobResponseList } from "@/components/job-board/job-response-list";
import { Button } from "@/components/ui/button";
import { getSession } from "@/lib/auth";
import { getJobPostDetails } from "@/lib/job-board/job-post-service";
import { formatPrice } from "@/lib/mock-data";

export const dynamic = "force-dynamic";

export default async function JobPostPage({ params }: { params: Promise<{ id: string }> }) {
  const [{ id }, session] = await Promise.all([params, getSession()]);
  const post = await getJobPostDetails(id, session?.user ? { userId: session.user.id, role: session.user.role } : undefined);
  if (!post) notFound();

  const response = post.responses.find((item) => item.status === "ACCEPTED") ?? post.selectedResponse;
  const bookingUrl = response ? `/booking/new?type=PHOTOGRAPHER_ONLY&photographerId=${response.photographer.id}&jobPostId=${post.id}` : undefined;

  return (
    <section className="py-7 md:py-12">
      <div className="container max-w-5xl">
        <Link href="/requests" className="text-sm font-medium text-primary hover:underline">← Все объявления</Link>
        <article className="mt-5 rounded-xl border border-border bg-card p-5 md:p-8">
          <div className="flex flex-wrap items-center gap-2"><JobPostStatus status={post.status} />{post.style ? <span className="rounded-md bg-secondary px-2 py-1 text-xs font-medium">{post.style.title}</span> : null}</div>
          <h1 className="mt-4 text-3xl font-semibold tracking-normal md:text-5xl">{post.title}</h1>
          <p className="mt-5 max-w-3xl whitespace-pre-line text-base leading-7 text-muted-foreground">{post.description}</p>
          <dl className="mt-7 grid gap-4 border-t border-border pt-6 sm:grid-cols-2 lg:grid-cols-4">
            <Meta icon={<CalendarDays />}>{formatDate(post.date)}</Meta>
            <Meta icon={<Clock3 />}>{post.startTime} · {post.durationHours} ч</Meta>
            <Meta icon={<MapPin />}>{post.city}</Meta>
            <Meta icon={<WalletCards />}>{formatPrice(post.budget)}</Meta>
          </dl>
        </article>

        <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_21rem]">
          <div>
            {post.isOwner ? <JobResponseList post={post} /> : null}
            {!post.isOwner && post.selectedResponse ? <section className="rounded-xl border border-primary/30 bg-primary/[0.06] p-5"><h2 className="text-xl font-semibold tracking-normal">Фотограф уже выбран</h2><p className="mt-2 text-sm text-muted-foreground">Клиент завершает оформление бронирования.</p></section> : null}
          </div>
          <aside className="grid gap-4">
            {post.canRespond ? <JobResponseForm jobPostId={post.id} suggestedPrice={post.budget} /> : null}
            {!session?.user ? <div className="rounded-xl border border-border bg-card p-5"><h2 className="text-lg font-semibold">Хотите откликнуться?</h2><p className="mt-2 text-sm leading-6 text-muted-foreground">Войдите как фотограф, чтобы отправить предложение.</p><Button asChild className="mt-4" variant="outline"><Link href="/auth/sign-in">Войти</Link></Button></div> : null}
            {post.isOwner && bookingUrl ? <div className="rounded-xl border border-primary/40 bg-card p-5"><h2 className="text-lg font-semibold">Фотограф выбран</h2><p className="mt-2 text-sm leading-6 text-muted-foreground">Осталось закрепить дату через обычное бронирование.</p><Button asChild className="mt-4 w-full"><Link href={bookingUrl}>Перейти к бронированию</Link></Button></div> : null}
          </aside>
        </div>
      </div>
    </section>
  );
}

function Meta({ icon, children }: { icon: ReactNode; children: ReactNode }) {
  return <div className="flex items-center gap-3 text-sm text-muted-foreground"><span className="text-primary [&_svg]:size-5" aria-hidden="true">{icon}</span><span>{children}</span></div>;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "long", year: "numeric" }).format(new Date(value));
}
