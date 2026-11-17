import { JobPostForm } from "@/components/job-board/job-post-form";
import { getStyles } from "@/lib/data/styles";
import { requireSession } from "@/lib/guards";

export const dynamic = "force-dynamic";

export default async function NewJobPostPage() {
  await requireSession(["CLIENT"]);
  const styles = await getStyles();
  return <section className="py-7 md:py-10"><div className="container"><JobPostForm styles={styles} /></div></section>;
}
