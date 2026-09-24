"use client";

import { useSyncExternalStore } from "react";

const ZONE = "Africa/Casablanca";
const timeParts = new Intl.DateTimeFormat("fr-FR", { timeZone: ZONE, hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23" });
const dayLabel = new Intl.DateTimeFormat("fr-FR", { timeZone: ZONE, weekday: "long", day: "numeric", month: "long" });

// One tick per second shared by every subscriber.
function subscribe(onTick: () => void) {
  const id = window.setInterval(onTick, 1000);
  return () => window.clearInterval(id);
}
const currentSecond = () => Math.floor(Date.now() / 1000);
// The server can't know the viewer's clock, so it renders a placeholder.
const serverSecond = () => null;

export function LiveClock() {
  const second = useSyncExternalStore(subscribe, currentSecond, serverSecond);
  const now = second === null ? null : new Date(second * 1000);
  const parts = now ? Object.fromEntries(timeParts.formatToParts(now).map((part) => [part.type, part.value])) : null;
  const h = parts ? Number(parts.hour) : 0, m = parts ? Number(parts.minute) : 0, s = parts ? Number(parts.second) : 0;

  return (
    <div className="flex items-center gap-3">
      <svg aria-hidden="true" className="size-12 shrink-0 rounded-[12px] bg-white p-1 shadow-[0_6px_14px_-6px_rgba(5,42,102,0.6)]" viewBox="0 0 48 48">
        <circle cx="24" cy="24" fill="none" r="20" stroke="#dbe6f1" strokeWidth="1.5" />
        {Array.from({ length: 12 }, (_, index) => <line key={index} stroke={index % 3 ? "#cbd6e2" : "#102c4c"} strokeLinecap="round" strokeWidth={index % 3 ? 1 : 1.8} transform={`rotate(${index * 30} 24 24)`} x1="24" x2="24" y1="6" y2={index % 3 ? 8 : 9} />)}
        {now ? <>
          <line stroke="#102c4c" strokeLinecap="round" strokeWidth="2.6" transform={`rotate(${(h % 12) * 30 + m * 0.5} 24 24)`} x1="24" x2="24" y1="24" y2="14" />
          <line stroke="#102c4c" strokeLinecap="round" strokeWidth="1.8" transform={`rotate(${m * 6 + s * 0.1} 24 24)`} x1="24" x2="24" y1="24" y2="9" />
          <line stroke="#1677f2" strokeLinecap="round" strokeWidth="1" transform={`rotate(${s * 6} 24 24)`} x1="24" x2="24" y1="27" y2="8" />
        </> : null}
        <circle cx="24" cy="24" fill="#1677f2" r="1.8" />
      </svg>
      <div className="min-w-0">
        <p className="flex items-baseline gap-0.5 leading-none font-semibold text-white tabular-nums">
          {parts ? <>
            <span className="text-[22px] tracking-[-0.02em]">{parts.hour}</span>
            <span className="animate-pulse text-[22px]">:</span>
            <span className="text-[22px] tracking-[-0.02em]">{parts.minute}</span>
            <span className="ml-1 text-[11px] text-blue-100">{parts.second}</span>
          </> : <span className="text-[22px]">--:--</span>}
        </p>
        <p className="mt-1 truncate text-[11px] text-blue-50 first-letter:uppercase">{now ? dayLabel.format(now) : " "}</p>
      </div>
    </div>
  );
}
