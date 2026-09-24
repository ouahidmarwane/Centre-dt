"use client";

import { ClinicDateTimeFormat } from "@/lib/clinic-time";
import { useState } from "react";
import type { AccountingDashboard } from "@/lib/accounting/data";
import { formatDashboardMoney } from "@/lib/dashboard/presentation";

const dateLabel = new ClinicDateTimeFormat("fr-FR", { day: "numeric", month: "short" });

export function CashflowAreaChart({ dashboard }: { dashboard: AccountingDashboard }) {
  const [active, setActive] = useState<number | null>(null);
  const points = dashboard.series;
  const width = 860;
  const baseline = 230;
  const maximum = Math.max(1, ...points.flatMap((point) => [point.production, point.received]));
  const x = (index: number) => points.length < 2 ? width / 2 : index * width / (points.length - 1);
  const y = (value: number) => baseline - value / maximum * 180;
  const path = (field: "production" | "received") => {
    if (!points.length) return `M0,${baseline} L${width},${baseline}`;
    if (points.length === 1) return `M0,${y(points[0][field])} L${width},${y(points[0][field])}`;
    return points.reduce((line, point, index) => {
      if (!index) return `M${x(0)},${y(point[field])}`;
      const middle = (x(index - 1) + x(index)) / 2;
      return `${line} C${middle},${y(points[index - 1][field])} ${middle},${y(point[field])} ${x(index)},${y(point[field])}`;
    }, "");
  };
  const hasActivity = points.some((point) => point.production > 0 || point.received > 0);
  const selected = active === null ? null : points[active];

  return (
    <div className="mt-5">
      <div className="flex flex-wrap gap-4 px-6 text-xs text-[var(--navy)]">
        <span className="flex items-center gap-2"><i className="size-2 rounded-full bg-[#7769ed]" />Production</span>
        <span className="flex items-center gap-2"><i className="size-2 rounded-full bg-[#ff826f]" />Encaissements</span>
      </div>
      <div className="relative mt-4">
        <svg viewBox="0 0 860 250" className="h-64 w-full" preserveAspectRatio="none" role="img" aria-label="Flux financier : production en violet, encaissements en corail. Les valeurs exactes sont disponibles sous le graphique.">
          {Array.from({ length: 25 }, (_, index) => <line key={index} x1={index * width / 24} x2={index * width / 24} y1="0" y2={baseline} stroke="#e8e9ef" strokeDasharray="3 6" />)}
          <path d={`${path("received")} L${width},250 L0,250 Z`} fill="#ff826f" fillOpacity={hasActivity ? 0.85 : 0.12} />
          <path d={`${path("production")} L${width},250 L0,250 Z`} fill="#7769ed" fillOpacity={hasActivity ? 0.8 : 0.12} />
          <path d={path("received")} fill="none" stroke="#ff826f" strokeWidth="2.5" />
          <path d={path("production")} fill="none" stroke="#7769ed" strokeWidth="2.5" />
          {active !== null && selected ? <g>
            <line x1={x(active)} x2={x(active)} y1="0" y2={baseline} stroke="#102c4c" strokeOpacity="0.3" strokeDasharray="4 4" />
            <circle cx={x(active)} cy={y(selected.received)} r="5" fill="#ff826f" stroke="white" strokeWidth="3" />
            <circle cx={x(active)} cy={y(selected.production)} r="5" fill="#7769ed" stroke="white" strokeWidth="3" />
          </g> : null}
        </svg>
        <div className="absolute inset-0 flex" onMouseLeave={() => setActive(null)}>
          {points.map((point, index) => <button key={point.bucket_start} type="button" className="min-w-0 flex-1 rounded focus-visible:outline-2 focus-visible:outline-[var(--navy)]" aria-label={`${dateLabel.format(new Date(point.bucket_start))} : production ${formatDashboardMoney(point.production)}, encaissements ${formatDashboardMoney(point.received)}`} onMouseEnter={() => setActive(index)} onFocus={() => setActive(index)} onBlur={() => setActive(null)} onClick={() => setActive(index)} />)}
        </div>
        {selected ? <div className="pointer-events-none absolute top-2 left-1/2 w-max max-w-[90%] -translate-x-1/2 rounded-xl bg-white px-4 py-3 text-xs shadow-lg">
          <p className="font-semibold text-[var(--navy)]">{dateLabel.format(new Date(selected.bucket_start))}</p>
          <p className="mt-1 text-[#5548bd]">Production : <strong>{formatDashboardMoney(selected.production)}</strong></p>
          <p className="mt-1 text-[#ad4739]">Encaissements : <strong>{formatDashboardMoney(selected.received)}</strong></p>
        </div> : !hasActivity ? <p className="pointer-events-none absolute inset-0 flex items-center justify-center text-sm text-[var(--muted)]">Aucune activité sur cette période</p> : null}
      </div>
      <div className="flex justify-between gap-3 px-6 py-3 text-xs text-[var(--muted)]">
        {points.length ? <><span>{dateLabel.format(new Date(points[0].bucket_start))}</span><span>{dateLabel.format(new Date(points[points.length - 1].bucket_start))}</span></> : <span>Aucune donnée</span>}
      </div>
    </div>
  );
}
