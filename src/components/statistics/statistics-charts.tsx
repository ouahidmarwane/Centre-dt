"use client";

import { useState } from "react";

import type { CareTypeFigure } from "@/lib/statistics/presentation";

// Single-series charts: one hue (the production blue already validated for the
// accounting charts), one axis each. Text stays in ink tokens, never the series colour.
const SERIES_COLOR = "#1677f2";
const money = new Intl.NumberFormat("fr-MA", { style: "currency", currency: "MAD", maximumFractionDigits: 0 });
const percent = new Intl.NumberFormat("fr-FR", { style: "percent", maximumFractionDigits: 1 });

export function CareTypeBars({ items }: { items: CareTypeFigure[] }) {
  if (!items.length) return <p className="grid h-40 place-items-center rounded-[14px] border border-dashed border-[#d3e1ef] text-sm text-slate-500">Aucun soin réalisé ce mois-ci.</p>;
  const max = Math.max(...items.map((item) => item.amount), 1);
  return (
    <ul aria-label="Chiffre d’affaires par type de soin" className="space-y-3">
      {items.map((item) => (
        <li className="group" key={item.careType} title={`${item.careType} : ${money.format(item.amount)} · ${item.count} soin${item.count > 1 ? "s" : ""} · ${percent.format(item.share)} du mois`}>
          <div className="flex items-baseline justify-between gap-3 text-sm">
            <span className="font-medium text-[var(--navy)]">{item.careType}</span>
            <span className="metric-number shrink-0 font-semibold text-[var(--navy)]">{money.format(item.amount)} <span className="ml-1 text-xs font-medium text-slate-500">{percent.format(item.share)}</span></span>
          </div>
          <div aria-hidden="true" className="mt-1.5 h-3 rounded-full bg-[#edf2f7]">
            <div className="h-full rounded-full transition-[filter] group-hover:brightness-110" style={{ width: `${Math.max(2, (item.amount / max) * 100)}%`, background: SERIES_COLOR }} />
          </div>
          <p className="mt-1 text-[11px] text-slate-500">{item.count} soin{item.count > 1 ? "s" : ""} réalisé{item.count > 1 ? "s" : ""}</p>
        </li>
      ))}
    </ul>
  );
}

export type ColumnPoint = { key: string; label: string; longLabel: string; value: number | null };
export type ColumnUnit = "money" | "count" | "percent";
const formatters: Record<ColumnUnit, (value: number) => string> = {
  money: (value) => money.format(value),
  count: (value) => new Intl.NumberFormat("fr-FR").format(value),
  percent: (value) => percent.format(value),
};

// Twelve monthly columns with a hover / focus read-out; null values are drawn as gaps.
export function MonthlyColumns({ title, points, unit, highlightKey }: { title: string; points: ColumnPoint[]; unit: ColumnUnit; highlightKey: string }) {
  const [active, setActive] = useState<number | null>(null);
  const format = formatters[unit];
  const width = 360, height = 150, top = 22, bottom = 22, left = 4, right = 4;
  const plotH = height - top - bottom, band = (width - left - right) / Math.max(points.length, 1), barW = Math.min(18, band - 6);
  const max = Math.max(...points.map((point) => point.value ?? 0), 0) || 1;
  const shown = active ?? points.findIndex((point) => point.key === highlightKey);
  const current = shown >= 0 ? points[shown] : null;
  return (
    <figure>
      <figcaption>
        <span className="block text-sm font-semibold text-[var(--navy)]">{title}</span>
        <span aria-live="polite" className="mt-0.5 block min-h-4 text-xs text-slate-500">{current ? <><span className="first-letter:uppercase">{current.longLabel}</span> : <strong className="metric-number text-[var(--navy)]">{current.value === null ? "—" : format(current.value)}</strong></> : null}</span>
      </figcaption>
      <svg aria-label={`${title}, 12 derniers mois`} className="mt-2 block h-auto w-full select-none" onMouseLeave={() => setActive(null)} role="img" viewBox={`0 0 ${width} ${height}`}>
        <line stroke="#cbd6e2" x1={left} x2={width - right} y1={top + plotH} y2={top + plotH} />
        {points.map((point, index) => {
          const x = left + band * index + (band - barW) / 2;
          const barH = point.value ? Math.max(3, (point.value / max) * plotH) : 0;
          const isShown = index === shown;
          return (
            <g key={point.key} onFocus={() => setActive(index)} onMouseEnter={() => setActive(index)} tabIndex={0} aria-label={`${point.longLabel} : ${point.value === null ? "aucune donnée" : format(point.value)}`} role="img">
              <rect fill="transparent" height={plotH + bottom} width={band} x={left + band * index} y={top} />
              {barH ? <rect fill={SERIES_COLOR} height={barH} opacity={isShown ? 1 : 0.45} rx={4} width={barW} x={x} y={top + plotH - barH} /> : null}
              {point.value === null ? <text className="fill-slate-300 text-[10px]" textAnchor="middle" x={x + barW / 2} y={top + plotH - 4}>—</text> : null}
              <text className={`text-[10px] ${isShown ? "fill-[var(--navy)] font-semibold" : "fill-slate-400"}`} textAnchor="middle" x={x + barW / 2} y={height - 6}>{point.label}</text>
            </g>
          );
        })}
      </svg>
    </figure>
  );
}
