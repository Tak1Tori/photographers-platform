import { PhotographerCard } from "@/components/cards/photographer-card";
import { EditorFilters } from "@/components/editors/editor-filters";
import { EmptyState } from "@/components/shared/empty-state";
import { getEditors, getEditorTags } from "@/lib/data/editors";
import { PHOTOGRAPHER_MAX_PRICE, normalizePhotographerMaxPrice, normalizePhotographerRating } from "@/lib/photographer-filter-options";

export const dynamic = "force-dynamic";

export default async function EditorsPage({ searchParams }: { searchParams: Promise<{ tag?: string; price?: string; reviews?: string }> }) {
  const resolvedSearchParams = await searchParams;
  const [tags, editors] = await Promise.all([getEditorTags(), getEditors({ tag: resolvedSearchParams.tag })]);
  const maxPrice = normalizePhotographerMaxPrice(resolvedSearchParams.price);
  const minRating = normalizePhotographerRating(resolvedSearchParams.reviews);
  const filteredEditors = editors
    .filter((editor) => editor.pricePerHour <= maxPrice || maxPrice >= PHOTOGRAPHER_MAX_PRICE)
    .filter((editor) => !minRating || editor.rating >= minRating);

  return (
    <section className="py-6 md:py-10">
      <div className="container">
        <EditorFilters tags={tags} selectedTag={resolvedSearchParams.tag} selectedPrice={resolvedSearchParams.price} selectedReviews={resolvedSearchParams.reviews} />
        {filteredEditors.length === 0 ? <EmptyState title="Монтажеры не найдены" description="Под выбранные фильтры пока нет подходящих специалистов." /> : null}
        {filteredEditors.length > 0 ? (
          <div className="mt-6 grid grid-cols-2 gap-3 md:mt-8 md:gap-5 lg:grid-cols-3">
            {filteredEditors.map((editor) => <PhotographerCard key={editor.id} photographer={editor} profileHrefOverride={`/editors/${editor.id}`} professionalLabel="монтажера" />)}
          </div>
        ) : null}
      </div>
    </section>
  );
}
