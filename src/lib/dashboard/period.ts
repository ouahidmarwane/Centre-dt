import { clinicDate, type AccountingBucket } from "../accounting/periods.ts";

export const dashboardPeriods = ["week", "month", "six_months", "year"] as const;

export type DashboardPeriodKey = (typeof dashboardPeriods)[number];

export type DashboardPeriod = {
  key: DashboardPeriodKey;
  startDate: string;
  endDate: string;
  bucket: AccountingBucket;
};

function addDays(date: Date, days: number) {
  const result = new Date(date);
  result.setUTCDate(result.getUTCDate() + days);
  return result;
}

function addMonths(date: Date, months: number) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + months, 1));
}

function toIso(date: Date) {
  return date.toISOString().slice(0, 10);
}

export function resolveDashboardPeriod(value: string | string[] | undefined, now = new Date()): DashboardPeriod {
  const key = typeof value === "string" && dashboardPeriods.includes(value as DashboardPeriodKey)
    ? value as DashboardPeriodKey
    : "month";
  const [year, month, day] = clinicDate(now).split("-").map(Number);
  const today = new Date(Date.UTC(year, month - 1, day));
  let startDate: Date;
  let endDate: Date;
  let bucket: AccountingBucket = "day";

  if (key === "week") {
    startDate = addDays(today, -((today.getUTCDay() + 6) % 7));
    endDate = addDays(startDate, 7);
  } else if (key === "month") {
    startDate = new Date(Date.UTC(year, month - 1, 1));
    endDate = addMonths(startDate, 1);
  } else if (key === "six_months") {
    endDate = addMonths(new Date(Date.UTC(year, month - 1, 1)), 1);
    startDate = addMonths(endDate, -6);
    bucket = "month";
  } else {
    startDate = new Date(Date.UTC(year, 0, 1));
    endDate = new Date(Date.UTC(year + 1, 0, 1));
    bucket = "month";
  }

  return { key, startDate: toIso(startDate), endDate: toIso(endDate), bucket };
}
