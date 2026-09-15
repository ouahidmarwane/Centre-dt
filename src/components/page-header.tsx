export function PageHeader({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow: string;
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <header className="flex flex-col gap-5 border-b border-[var(--border)] pb-7 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <p className="text-[11px] font-bold tracking-[0.18em] text-[var(--brand)] uppercase">
          {eyebrow}
        </p>
        <h1 className="mt-2 text-[1.75rem] leading-tight font-semibold tracking-[-0.035em] text-[var(--navy)] sm:text-[2rem]">
          {title}
        </h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--muted)]">{description}</p>
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </header>
  );
}

export function PlaceholderPanel({ children }: { children: React.ReactNode }) {
  return (
    <section className="mt-6 rounded-[19px] border border-[var(--border)] bg-white p-5 shadow-[0_16px_38px_-30px_rgba(16,44,76,0.45),0_2px_8px_rgba(16,44,76,0.04)] sm:p-6">
      {children}
    </section>
  );
}
