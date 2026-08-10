import { FileText } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import type { LegalDocumentKey } from "@/lib/legal-documents";
import { getLegalDocument } from "@/lib/legal-documents";

export function LegalSourceDocument({ documentKey }: { documentKey: LegalDocumentKey }) {
  const document = getLegalDocument(documentKey);

  return (
    <>
      <PageHeader eyebrow="Документы" title={document.title} description={document.description} centered />
      <section className="py-8 md:py-12">
        <div className="container grid gap-8 lg:grid-cols-[15rem_minmax(0,1fr)]">
          <aside className="h-fit rounded-lg border border-border bg-card p-4 lg:sticky lg:top-5">
            <p className="mb-3 flex items-center gap-2 text-sm font-semibold">
              <FileText className="size-4" aria-hidden="true" />
              Содержание
            </p>
            <nav aria-label={`Разделы: ${document.title}`} className="grid gap-2 text-sm text-muted-foreground">
              {document.sections.map((section) => (
                <a key={section.id} href={`#${section.id}`} className="transition-colors hover:text-foreground">
                  {section.title}
                </a>
              ))}
            </nav>
          </aside>

          <article className="min-w-0 rounded-lg border border-border bg-card p-5 md:p-8">
            {document.intro ? (
              <p className="mb-8 text-base leading-7 text-muted-foreground md:text-lg">{document.intro}</p>
            ) : null}
            <div className="grid gap-8">
              {document.sections.map((section) => (
                <section key={section.id} id={section.id} className="scroll-mt-8">
                  <h2 className="text-xl font-semibold tracking-normal md:text-2xl">{section.title}</h2>
                  <div className="mt-3 grid gap-3 text-sm leading-6 text-muted-foreground md:text-base md:leading-7">
                    {section.paragraphs.map((paragraph, index) => (
                      <p key={`${section.id}-${index}`}>{paragraph}</p>
                    ))}
                  </div>
                </section>
              ))}
            </div>
          </article>
        </div>
      </section>
    </>
  );
}
