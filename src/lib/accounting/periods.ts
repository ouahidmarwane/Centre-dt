import { ClinicDateTimeFormat } from "../clinic-time.ts";
export const accountingPresets = [
  "current_week",
  "current_month",
  "current_year",
  "previous_week",
  "previous_month",
  "previous_year",
  "custom",
] as const;

export type AccountingPreset = (typeof accountingPresets)[number];
export type AccountingBucket = "day" | "month";

export type AccountingPeriod = {
  preset: AccountingPreset;
  startDate: string;
  endDate: string;
  bucket: AccountingBucket;
  usedFallback: boolean;
};

type SearchValue = string | string[] | undefined;

const isoDatePattern = /^\d{4}-\d{2}-\d{2}$/;

function fromIsoDate(value: string): Date | null {
  if (!isoDatePattern.test(value)) return null;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) return null;
  return date;
}

function toIsoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setUTCDate(result.getUTCDate() + days);
  return result;
}

function addMonths(date: Date, months: number): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + months, 1));
}

function addYears(date: Date, years: number): Date {
  return new Date(Date.UTC(date.getUTCFullYear() + years, date.getUTCMonth(), date.getUTCDate()));
}

export function clinicDate(now = new Date()): string {
  const parts = new ClinicDateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function presetPeriod(preset: Exclude<AccountingPreset, "custom">, today: Date): AccountingPeriod {
  let start: Date;
  let end: Date;

  if (preset.endsWith("week")) {
    const daysSinceMonday = (today.getUTCDay() + 6) % 7;
    start = addDays(today, -daysSinceMonday + (preset === "previous_week" ? -7 : 0));
    end = addDays(start, 7);
  } else if (preset.endsWith("month")) {
    start = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1));
    if (preset === "previous_month") start = addMonths(start, -1);
    end = addMonths(start, 1);
  } else {
    start = new Date(Date.UTC(today.getUTCFullYear(), 0, 1));
    if (preset === "previous_year") start = addYears(start, -1);
    end = addYears(start, 1);
  }

  return {
    preset,
    startDate: toIsoDate(start),
    endDate: toIsoDate(end),
    bucket: preset.endsWith("year") ? "month" : "day",
    usedFallback: false,
  };
}

function single(value: SearchValue): string | null {
  return typeof value === "string" ? value : null;
}

export function resolveAccountingPeriod(
  query: Record<string, SearchValue>,
  now = new Date(),
): AccountingPeriod {
  const today = fromIsoDate(clinicDate(now));
  if (!today) throw new Error("CLINIC_DATE_UNAVAILABLE");
  const rawPreset = single(query.period);
  const preset = accountingPresets.includes(rawPreset as AccountingPreset)
    ? rawPreset as AccountingPreset
    : "current_month";

  if (preset !== "custom") {
    const period = presetPeriod(preset, today);
    return { ...period, usedFallback: query.period !== undefined && rawPreset !== preset };
  }

  const start = fromIsoDate(single(query.from) ?? "");
  const inclusiveEnd = fromIsoDate(single(query.to) ?? "");
  if (!start || !inclusiveEnd || inclusiveEnd < start) {
    return { ...presetPeriod("current_month", today), usedFallback: true };
  }

  const end = addDays(inclusiveEnd, 1);
  if (end > addYears(start, 5) || start < new Date(Date.UTC(2020, 0, 1))) {
    return { ...presetPeriod("current_month", today), usedFallback: true };
  }

  const days = Math.round((end.getTime() - start.getTime()) / 86_400_000);
  return {
    preset,
    startDate: toIsoDate(start),
    endDate: toIsoDate(end),
    bucket: days <= 370 ? "day" : "month",
    usedFallback: false,
  };
}

export function inclusiveEndDate(period: AccountingPeriod): string {
  const end = fromIsoDate(period.endDate);
  if (!end) throw new Error("INVALID_ACCOUNTING_PERIOD");
  return toIsoDate(addDays(end, -1));
}
