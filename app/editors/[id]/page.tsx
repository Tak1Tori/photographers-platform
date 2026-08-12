import Image from "next/image";
import { notFound } from "next/navigation";
import { MapPin, Star } from "lucide-react";
import { PhotographerProfileTabs } from "@/components/photographers/photographer-profile-tabs";
import { formatPrice, getPhotographerStyleTitles } from "@/lib/mock-data";
import { getPublicEditorPageData } from "@/lib/data/editors";

export const dynamic = "force-dynamic";

export default async function EditorDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const pageData = await getPublicEditorPageData(id);
  if (!pageData) notFound();

  const { editor, portfolioItems, reviews } = pageData;

  return (
    <>
      <section className="photographer-profile-hero bg-card">
        <div className="container grid gap-8 py-10 md:grid-cols-[0.8fr_1.2fr] md:py-14">
          <div className="relative aspect-[4/5] overflow-hidden rounded-lg border border-border">
            <Image src={editor.imageUrl} alt={editor.name} fill priority className="object-cover" />
          </div>
          <div className="flex flex-col justify-center">
            <div className="mb-4 flex flex-wrap gap-2 text-sm">
              <span className="inline-flex items-center gap-1 rounded-md bg-secondary px-2 py-1 text-secondary-foreground"><Star className="size-4 fill-current" aria-hidden="true" />{editor.rating}</span>
              <span className="inline-flex items-center gap-1 rounded-md bg-secondary px-2 py-1 text-secondary-foreground"><MapPin className="size-4" aria-hidden="true" />{editor.city}</span>
            </div>
            <p className="text-sm font-medium text-primary">Монтажер</p>
            <h1 className="mt-2 text-3xl font-semibold tracking-normal md:text-5xl">{editor.name}</h1>
            <p className="mt-4 text-lg leading-8 text-muted-foreground">{editor.bio}</p>
            <div className="mt-5 flex flex-wrap gap-2">
              {getPhotographerStyleTitles(editor).map((tag) => <span key={tag} className="rounded-md bg-secondary px-3 py-1 text-sm text-secondary-foreground">{tag}</span>)}
            </div>
            <p className="mt-4 text-xl font-semibold">{formatPrice(editor.pricePerHour)} / час</p>
          </div>
        </div>
      </section>
      <section className="section"><div className="container"><PhotographerProfileTabs photographerId={editor.id} portfolioItems={portfolioItems} reviews={reviews} profileBasePath="/editors" professionalLabel="Монтажер" /></div></section>
    </>
  );
}
