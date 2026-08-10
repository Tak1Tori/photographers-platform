import { FileText } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";

export interface LegalSection {
  title: string;
  paragraphs?: string[];
  items?: string[];
}

interface LegalDocumentProps {
  title: string;
  revision: string;
  intro?: string;
  sections: LegalSection[];
}

export function LegalDocument({ title, revision, intro, sections }: LegalDocumentProps) {
  return (
    <>
      <PageHeader eyebrow="Документы" title={title} description={revision} centered />
      <section className="section">
        <div className="container grid gap-8 lg:grid-cols-[15rem_minmax(0,1fr)]">
          <aside className="h-fit rounded-lg border border-border bg-card p-4 lg:sticky lg:top-5">
            <p className="mb-3 flex items-center gap-2 text-sm font-semibold">
              <FileText className="size-4" aria-hidden="true" />
              Содержание
            </p>
            <nav aria-label={`Разделы: ${title}`} className="grid gap-2 text-sm text-muted-foreground">
              {sections.map((section, index) => (
                <a key={section.title} href={`#section-${index + 1}`} className="transition-colors hover:text-foreground">
                  {section.title}
                </a>
              ))}
            </nav>
          </aside>

          <article className="min-w-0 rounded-lg border border-border bg-card p-5 md:p-8">
            {intro ? <p className="mb-10 text-base leading-8 text-muted-foreground md:text-lg">{intro}</p> : null}
            <div className="space-y-9">
              {sections.map((section, index) => (
                <section
                  key={section.title}
                  id={`section-${index + 1}`}
                  className="scroll-mt-8 border-b border-border pb-9 last:border-b-0 last:pb-0"
                >
                  <h2 className="text-xl font-semibold leading-tight md:text-2xl">{section.title}</h2>
                  {section.paragraphs?.length ? (
                    <div className="mt-4 space-y-3 text-sm leading-7 text-muted-foreground md:text-base md:leading-8">
                      {section.paragraphs.map((paragraph) => (
                        <p key={paragraph}>{paragraph}</p>
                      ))}
                    </div>
                  ) : null}
                  {section.items?.length ? (
                    <ul className="mt-4 space-y-2 text-sm leading-7 text-muted-foreground marker:text-foreground md:text-base md:leading-8">
                      {section.items.map((item) => (
                        <li key={item}>{item}</li>
                      ))}
                    </ul>
                  ) : null}
                </section>
              ))}
            </div>
          </article>
        </div>
      </section>
    </>
  );
}
