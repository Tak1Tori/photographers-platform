import { StyleCard } from "@/components/cards/style-card";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { getStyles } from "@/lib/data/styles";

export default async function StylesPage() {
  const styles = await getStyles();

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
                <StyleCard key={style.id} style={style} />
              ))}
            </div>
          )}
        </div>
      </section>
    </>
  );
}
