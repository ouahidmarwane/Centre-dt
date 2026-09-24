"use client";

import { useEffect, useState } from "react";

import { clinicDateValue, clinicTimeValue } from "@/lib/appointments/validation";
import { hourlyQuote } from "@/lib/dashboard/presentation";

const currentQuote = () => {
  const now = new Date();
  return hourlyQuote(clinicDateValue(now), Number(clinicTimeValue(now).slice(0, 2)));
};

// Morocco's offset is a whole number of hours, so clinic hours turn with UTC hours.
const msUntilNextHour = () => 3_600_000 - (Date.now() % 3_600_000) + 500;

// The server renders the quote of the current hour; the client swaps it at every
// full hour while the dashboard stays open, with a soft fade.
export function HourlyQuote({ initial, className }: { initial: string; className: string }) {
  const [quote, setQuote] = useState(initial);

  useEffect(() => {
    let timer: number;
    const schedule = () => {
      timer = window.setTimeout(() => { setQuote(currentQuote()); schedule(); }, msUntilNextHour());
    };
    // Catch up if the page was served just before the hour turned.
    const catchUp = window.setTimeout(() => setQuote(currentQuote()), 0);
    schedule();
    return () => { window.clearTimeout(timer); window.clearTimeout(catchUp); };
  }, []);

  return <p aria-live="polite" className={`animate-[quote-in_700ms_ease-out] ${className}`} key={quote}>{quote}</p>;
}
