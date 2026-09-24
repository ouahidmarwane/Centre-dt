"use client";

import { useEffect, useRef, useState } from "react";

import styles from "./accounting.module.css";

// Series colours, validated for colour-blind separation (see dataviz check). Text never
// wears these colours; it stays in ink tokens next to a coloured swatch.
export const PRODUCTION_COLOR = "#1677f2";
export const RECEIVED_COLOR = "#19a996";

const money = new Intl.NumberFormat("fr-MA", { style: "currency", currency: "MAD", maximumFractionDigits: 0 });
const compact = new Intl.NumberFormat("fr-FR", { notation: "compact", maximumFractionDigits: 1 });

export type FlowPoint = { label: string; longLabel: string; production: number; received: number };

function niceMax(value: number) {
  if (value <= 0) return 100;
  const power = 10 ** Math.floor(Math.log10(value));
  const step = [1, 2, 2.5, 5, 10].find((candidate) => candidate * power >= value / 4) ?? 10;
  return Math.ceil(value / (step * power)) * step * power;
}

// Grouped columns: production vs payments per day or month, with a hover read-out.
export function FlowChart({ points }: { points: FlowPoint[] }) {
  const [active, setActive] = useState<number | null>(null);
  const width = 720, height = 280, left = 52, right = 12, top = 16, bottom = 34;
  const plotW = width - left - right, plotH = height - top - bottom;
  const max = niceMax(Math.max(0, ...points.flatMap((point) => [point.production, point.received])));
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((ratio) => ratio * max);
  const band = plotW / Math.max(1, points.length);
  const barW = Math.max(2, Math.min(16, (band * 0.72 - 2) / 2));
  const y = (value: number) => top + plotH - (value / max) * plotH;
  const labelStep = Math.ceil(points.length / 12);
  const empty = points.every((point) => !point.production && !point.received);

  if (empty) {
    return <p className="grid h-56 place-items-center rounded-[14px] border border-dashed border-[#d3e1ef] text-sm text-slate-500">Aucun mouvement sur cette période.</p>;
  }

  const tip = active === null ? null : points[active];
  // Beside the hovered column, on whichever side has room, so it never hides the bars it describes.
  const activeCenter = active === null ? 0 : left + band * active + band / 2;
  const tipX = activeCenter < width / 2
    ? Math.min(activeCenter + band / 2 + 8, width - right - 160)
    : Math.max(activeCenter - band / 2 - 168, left);

  return (
    <svg aria-labelledby="flow-chart-title flow-chart-desc" className="block h-auto w-full touch-none select-none" onMouseLeave={() => setActive(null)} role="img" viewBox={`0 0 ${width} ${height}`}>
      <title id="flow-chart-title">Production et encaissements par période</title>
      <desc id="flow-chart-desc">Colonnes bleues : production. Colonnes vertes : encaissements. Le tableau des chiffres exacts est disponible sous le graphique.</desc>

      {ticks.map((tick) => (
        <g key={tick}>
          <line stroke={tick === 0 ? "#cbd6e2" : "#edf2f7"} strokeDasharray={tick === 0 ? undefined : "3 4"} x1={left} x2={width - right} y1={y(tick)} y2={y(tick)} />
          <text className="fill-slate-400 text-[11px]" dominantBaseline="middle" textAnchor="end" x={left - 8} y={y(tick)}>{tick === 0 ? "0" : compact.format(tick)}</text>
        </g>
      ))}

      {active !== null ? <rect className={styles.fade} fill="#eef5ff" height={plotH} rx={6} width={band} x={left + band * active} y={top} /> : null}

      <g className={styles.columns}>
        {points.map((point, index) => {
          const center = left + band * index + band / 2;
          return (
            <g key={`${point.longLabel}-${index}`}>
              <rect className={styles.growY} fill={PRODUCTION_COLOR} height={Math.max(0, y(0) - y(point.production))} opacity={active === null || active === index ? 1 : 0.35} rx={Math.min(3, barW / 2)} width={barW} x={center - barW - 1} y={y(point.production)} />
              <rect className={styles.growY} fill={RECEIVED_COLOR} height={Math.max(0, y(0) - y(point.received))} opacity={active === null || active === index ? 1 : 0.35} rx={Math.min(3, barW / 2)} width={barW} x={center + 1} y={y(point.received)} />
              {index % labelStep === 0 ? <text className="fill-slate-500 text-[11px]" textAnchor="middle" x={center} y={height - 12}>{point.label}</text> : null}
              {/* Hit target wider than the marks. */}
              <rect fill="transparent" height={plotH + bottom} onFocus={() => setActive(index)} onMouseEnter={() => setActive(index)} onTouchStart={() => setActive(index)} width={band} x={left + band * index} y={top} />
            </g>
          );
        })}
      </g>

      {tip ? (
        <g className={styles.fade} pointerEvents="none" transform={`translate(${tipX} ${top + 4})`}>
          <rect fill="#ffffff" height={74} rx={10} stroke="#dbe6f1" width={160} />
          <text className="fill-[var(--navy)] text-[12px] font-semibold" x={12} y={20}>{tip.longLabel}</text>
          <rect fill={PRODUCTION_COLOR} height={8} rx={2} width={8} x={12} y={33} />
          <text className="fill-slate-600 text-[11px]" x={26} y={41}>Production</text>
          <text className="fill-[var(--navy)] text-[11px] font-semibold" textAnchor="end" x={148} y={41}>{money.format(tip.production)}</text>
          <rect fill={RECEIVED_COLOR} height={8} rx={2} width={8} x={12} y={51} />
          <text className="fill-slate-600 text-[11px]" x={26} y={59}>Encaissé</text>
          <text className="fill-[var(--navy)] text-[11px] font-semibold" textAnchor="end" x={148} y={59}>{money.format(tip.received)}</text>
        </g>
      ) : null}
    </svg>
  );
}

// Ring gauge for the collection rate, drawn with SMIL so no inline style is needed.
export function CollectionGauge({ rate }: { rate: number | null }) {
  const radius = 52, circumference = 2 * Math.PI * radius;
  const shown = rate === null ? 0 : Math.min(1, Math.max(0, rate));
  const offset = circumference * (1 - shown);
  const tone = rate === null ? "#cbd6e2" : shown >= 0.9 ? "#19a996" : shown >= 0.6 ? "#1677f2" : "#d9822b";
  return (
    <svg aria-hidden="true" className="size-36 shrink-0" viewBox="0 0 128 128">
      <circle cx="64" cy="64" fill="none" r={radius} stroke="#edf2f7" strokeWidth="12" />
      <circle cx="64" cy="64" fill="none" r={radius} stroke={tone} strokeDasharray={circumference} strokeDashoffset={offset} strokeLinecap="round" strokeWidth="12" transform="rotate(-90 64 64)">
        <animate attributeName="stroke-dashoffset" calcMode="spline" dur="1.1s" from={circumference} keySplines="0.16 1 0.3 1" keyTimes="0;1" to={offset} />
      </circle>
    </svg>
  );
}

// Counts up from zero on first display; renders the final value on the server and
// when the user prefers reduced motion.
export function CountUp({ value, format }: { value: number; format: "money" | "number" | "percent" }) {
  const [shown, setShown] = useState(value);
  const frame = useRef(0);
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches || value === 0) return;
    const start = performance.now();
    const tick = (now: number) => {
      const progress = Math.min(1, (now - start) / 900);
      setShown(value * (1 - (1 - progress) ** 3));
      if (progress < 1) frame.current = requestAnimationFrame(tick);
    };
    frame.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame.current);
  }, [value]);
  const text = format === "money"
    ? new Intl.NumberFormat("fr-MA", { style: "currency", currency: "MAD", minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(shown)
    : format === "percent" ? `${Math.round(shown)} %` : String(Math.round(shown));
  return <span className="metric-number">{text}</span>;
}
