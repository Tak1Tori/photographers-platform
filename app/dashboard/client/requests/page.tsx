import Link from "next/link";
import { Plus } from "lucide-react";
import { JobPostCard } from "@/components/job-board/job-post-card";
import { Button } from "@/components/ui/button";
import { requireSession } from "@/lib/guards";
import { getClientJobPosts } from "@/lib/job-board/job-post-service";

export const dynamic = "force-dynamic";

export default async function ClientJobPostsPage() {
  const session = await requireSession(["CLIENT"]);
  const posts = await getClientJobPosts(session.user.id);
  return (
    <section className="py-7 md:py-10">
      <div className="container max-w-5xl">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div><p className="text-sm font-medium text-primary">Доска объявлений</p><h1 className="mt-2 text-3xl font-semibold tracking-normal md:text-4xl">Мои объявления</h1></div>
          <Button asChild><Link href="/requests/new"><Plus className="size-4" aria-hidden="true" />Создать объявление</Link></Button>
        </div>
        <div className="mt-7 grid gap-4">
          {posts.length ? posts.map((post) => <JobPostCard key={post.id} post={post} showStatus />) : <div className="rounded-xl border border-dashed border-border p-10 text-center"><h2 className="text-xl font-semibold">Объявлений пока нет</h2><p className="mt-2 text-sm text-muted-foreground">Создайте первое объявление, чтобы получить отклики фотографов.</p><Button asChild className="mt-5"><Link href="/requests/new">Создать объявление</Link></Button></div>}
        </div>
      </div>
    </section>
  );
}
