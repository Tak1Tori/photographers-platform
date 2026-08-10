interface PageHeaderProps {
  eyebrow?: string;
  title: string;
  description?: string;
  centered?: boolean;
}

export function PageHeader({ eyebrow, title, description, centered = false }: PageHeaderProps) {
  return (
    <section className="border-b border-border bg-card">
      <div className={`container py-12 md:py-16 ${centered ? "text-center" : ""}`}>
        {eyebrow ? (
          <p className="mb-3 text-sm font-medium uppercase tracking-[0.18em] text-accent">
            {eyebrow}
          </p>
        ) : null}
        <h1 className={`max-w-3xl text-3xl font-semibold tracking-normal md:text-5xl ${centered ? "mx-auto" : ""}`}>
          {title}
        </h1>
        {description ? (
          <p className={`mt-4 max-w-2xl text-base leading-7 text-muted-foreground md:text-lg ${centered ? "mx-auto" : ""}`}>
            {description}
          </p>
        ) : null}
      </div>
    </section>
  );
}
