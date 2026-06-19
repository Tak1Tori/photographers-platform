import { StyleCard } from "@/components/cards/style-card";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { getStyles } from "@/lib/data/styles";

interface StylesPageProps {
  searchParams: {
    flow?: string;
    photographer?: string;
    studio?: string;
  };
}

export default async function StylesPage({ searchParams }: StylesPageProps) {
  const styles = await getStyles();
  const isFullShootFlow = searchParams.flow === "full-shoot";

  return (
    <>
      <PageHeader
        eyebrow="Каталог"
        title="Стили съемки"
        description="Выберите направление съемки, чтобы перейти к подходящим фотографам, студиям и слотам."
      />
      <section className="section">
        <div className="container">
          {styles.length === 0 ? (
            <EmptyState
              title="Стили пока не добавлены"
              description="Запустите seed или добавьте стили через Prisma Studio."
            />
          ) : (
            <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
              {styles.map((style) => (
                <StyleCard
                  key={style.id}
                  style={style}
                  ctaLabel={isFullShootFlow ? "Добавить в съемку" : undefined}
                  selectionHref={
                    isFullShootFlow
                      ? buildFullShootHref({
                          style: style.id,
                          photographer: searchParams.photographer,
                          studio: searchParams.studio
                        })
                      : undefined
                  }
                />
              ))}
            </div>
          )}
        </div>
      </section>
    </>
  );
}

function buildFullShootHref(selection: {
  style: string;
  photographer?: string;
  studio?: string;
}) {
  const params = new URLSearchParams({
    type: "FULL_SHOOT",
    style: selection.style
  });
  if (selection.photographer) params.set("photographer", selection.photographer);
  if (selection.studio) params.set("studio", selection.studio);
  return `/booking/new?${params.toString()}`;
}
