export function PageHeader({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string;
  title: string;
  description: string;
}) {
  return (
    <header className="border-b border-[var(--border)] pb-6">
      <p className="text-xs font-bold tracking-[0.14em] text-[var(--brand)] uppercase">
        {eyebrow}
      </p>
      <h1 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950 sm:text-3xl">
        {title}
      </h1>
      <p className="mt-2 max-w-3xl leading-6 text-[var(--muted)]">{description}</p>
    </header>
  );
}

export function PlaceholderPanel({ children }: { children: React.ReactNode }) {
  return (
    <section className="mt-6 rounded-lg border border-[var(--border)] bg-white p-5 shadow-xs sm:p-6">
      {children}
    </section>
  );
}
