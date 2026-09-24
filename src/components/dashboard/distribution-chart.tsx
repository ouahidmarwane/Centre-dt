type Slice = { label: string; value: number; color: string };

const exactNumber = new Intl.NumberFormat("fr-FR");
const percentage = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 1 });

export function DistributionChart({ items, unit, emptyLabel }: {
  items: Slice[];
  unit: string;
  emptyLabel: string;
}) {
  const total = items.reduce((sum, item) => sum + item.value, 0);
  const largest = Math.max(...items.map((item) => item.value), 0);
  let offset = 0;
  const segments = items.map((item) => {
    const fraction = total ? item.value / total : 0;
    const start = offset;
    offset += fraction;
    const middle = (start + fraction / 2) * Math.PI * 2 - Math.PI / 2;
    const raised = item.value === largest && item.value > 0;
    return { ...item, fraction, start, x: raised ? Math.cos(middle) * 5 : 0, y: raised ? Math.sin(middle) * 5 : 0 };
  });

  return (
    <div className="mt-6">
      <div className="relative mx-auto size-60">
        <svg viewBox="0 0 240 240" className="size-full" role="img" aria-label={`${exactNumber.format(total)} ${unit}. ${items.map((item) => `${item.label} : ${exactNumber.format(item.value)}`).join(". ")}`}>
          {!total ? <circle cx="120" cy="120" r="78" fill="none" stroke="#e4edf6" strokeWidth="42" /> : segments.filter((item) => item.value > 0).map((item) => (
            <g key={item.label} transform={`translate(${item.x}, ${item.y})`}>
              <circle cx="120" cy="120" r="78" fill="none" stroke={item.color} strokeWidth="42" pathLength="100" strokeDasharray={`${item.fraction * 100} ${100 - item.fraction * 100}`} strokeDashoffset={-item.start * 100} transform="rotate(-90 120 120)">
                <title>{`${item.label} : ${exactNumber.format(item.value)} (${percentage.format(item.fraction * 100)} %)`}</title>
              </circle>
              {segments.filter((slice) => slice.value > 0).length > 1 ? <line x1="120" y1="63" x2="120" y2="21" stroke="white" strokeWidth="4" transform={`rotate(${item.start * 360} 120 120)`} /> : null}
            </g>
          ))}
        </svg>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <strong className="metric-number text-4xl font-extrabold text-[var(--navy)]">{exactNumber.format(total)}</strong>
          <span className="mt-1 max-w-24 text-center text-xs text-[var(--muted)]">{unit}</span>
        </div>
      </div>
      {!total ? <p className="mb-4 text-center text-sm text-[var(--muted)]">{emptyLabel}</p> : null}
      <ul className="grid gap-2 sm:grid-cols-2">
        {items.map((item) => <li key={item.label} className="flex items-center gap-2 rounded-lg bg-white/65 px-3 py-2.5 text-sm">
          <svg aria-hidden="true" className="size-2.5 shrink-0" viewBox="0 0 10 10"><circle cx="5" cy="5" fill={item.color} r="5" /></svg>
          <span className="min-w-0 flex-1 break-words text-[var(--navy)]">{item.label}</span>
          <strong className="metric-number text-[var(--navy)]">{exactNumber.format(item.value)}</strong>
          <span className="metric-number w-14 text-right text-xs text-[var(--muted)]">{total ? `${percentage.format(item.value / total * 100)} %` : "—"}</span>
        </li>)}
      </ul>
    </div>
  );
}
