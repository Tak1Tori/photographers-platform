import Link from "next/link";
import { ClipboardList, Plus } from "lucide-react";
import { JobPostCard } from "@/components/job-board/job-post-card";
import { JobPostFilters } from "@/components/job-board/job-post-filters";
import { Button } from "@/components/ui/button";
import { getSession } from "@/lib/auth";
import { getStyles } from "@/lib/data/styles";
import { getJobPosts } from "@/lib/job-board/job-post-service";

export const dynamic = "force-dynamic";

export default async function JobPostsPage({
  searchParams
}: {
  searchParams: Promise<{ city?: string; date?: string; style?: string; budget?: string }>;
}) {
  const params = await searchParams;
  const [session, styles] = await Promise.all([getSession(), getStyles()]);
  const maxBudget = Number(params.budget);
  const posts = await getJobPosts({
    city: params.city?.trim() || undefined,
    date: params.date,
    styleId: params.style,
    maxBudget: Number.isFinite(maxBudget) && maxBudget > 0 ? maxBudget : undefined,
    photographerUserId: session?.user.role === "PHOTOGRAPHER" ? session.user.id : undefined
  });
  const canCreate = session?.user.role === "CLIENT";

  return (
    <section className="py-7 md:py-12">
      <div className="container">
        <div className="flex flex-col justify-between gap-5 md:flex-row md:items-end">
          <div className="max-w-2xl">
            <p className="text-sm font-medium text-primary">Доска объявлений</p>
            <h1 className="mt-2 text-4xl font-semibold tracking-normal md:text-5xl">Найдите съёмку, которая вам подходит</h1>
            <p className="mt-4 text-base leading-7 text-muted-foreground">Клиенты публикуют задачу, а фотографы отправляют предложение со своей ценой и подходом.</p>
          </div>
          {canCreate ? <Button asChild size="lg"><Link href="/requests/new"><Plus className="size-4" aria-hidden="true" />Создать объявление</Link></Button> : null}
        </div>

        <div className="mt-8 grid gap-6 lg:grid-cols-[17rem_minmax(0,1fr)]">
          <JobPostFilters styles={styles} />
          <div className="grid gap-4">
            <p className="text-sm text-muted-foreground">{posts.length} {plural(posts.length, "объявление", "объявления", "объявлений")}</p>
            {posts.length ? posts.map((post) => <JobPostCard key={post.id} post={post} />) : (
              <div className="grid min-h-80 place-items-center rounded-xl border border-dashed border-border bg-card/40 p-8 text-center">
                <div>
                  <ClipboardList className="mx-auto size-9 text-primary" aria-hidden="true" />
                  <h2 className="mt-4 text-xl font-semibold tracking-normal">Подходящих объявлений пока нет</h2>
                  <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-muted-foreground">Попробуйте изменить фильтры или загляните позже — новые задачи появляются здесь первыми.</p>
                  {canCreate ? <Button asChild className="mt-5"><Link href="/requests/new">Создать первое объявление</Link></Button> : null}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

function plural(value: number, one: string, few: string, many: string) {
  const remainder = value % 100;
  if (remainder >= 11 && remainder <= 19) return many;
  const last = value % 10;
  if (last === 1) return one;
  if (last >= 2 && last <= 4) return few;
  return many;
}
