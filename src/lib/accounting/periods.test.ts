import assert from "node:assert/strict";
import test from "node:test";

import { clinicDate, inclusiveEndDate, resolveAccountingPeriod } from "./periods.ts";

const sunday = new Date("2026-09-13T12:00:00Z");

test("week, month and year presets use inclusive-start exclusive-end calendar bounds", () => {
  assert.deepEqual(resolveAccountingPeriod({ period: "current_week" }, sunday), {
    preset: "current_week", startDate: "2026-09-07", endDate: "2026-09-14", bucket: "day", usedFallback: false,
  });
  assert.deepEqual(resolveAccountingPeriod({ period: "current_month" }, sunday), {
    preset: "current_month", startDate: "2026-09-01", endDate: "2026-10-01", bucket: "day", usedFallback: false,
  });
  assert.deepEqual(resolveAccountingPeriod({ period: "current_year" }, sunday), {
    preset: "current_year", startDate: "2026-01-01", endDate: "2027-01-01", bucket: "month", usedFallback: false,
  });
});

test("previous presets cross month and year boundaries without fixed UTC offsets", () => {
  const january = new Date("2026-01-02T12:00:00Z");
  assert.equal(resolveAccountingPeriod({ period: "previous_month" }, january).startDate, "2025-12-01");
  assert.equal(resolveAccountingPeriod({ period: "previous_year" }, january).startDate, "2025-01-01");
  assert.equal(resolveAccountingPeriod({ period: "previous_week" }, january).startDate, "2025-12-22");
});

test("custom filters validate real ISO dates, ordering and the five-year limit", () => {
  const valid = resolveAccountingPeriod({ period: "custom", from: "2026-02-01", to: "2026-02-28" }, sunday);
  assert.equal(valid.startDate, "2026-02-01");
  assert.equal(valid.endDate, "2026-03-01");
  assert.equal(inclusiveEndDate(valid), "2026-02-28");
  assert.equal(valid.bucket, "day");
  assert.equal(resolveAccountingPeriod({ period: "custom", from: "2026-02-30", to: "2026-03-01" }, sunday).usedFallback, true);
  assert.equal(resolveAccountingPeriod({ period: "custom", from: "2026-03-02", to: "2026-03-01" }, sunday).usedFallback, true);
  assert.equal(resolveAccountingPeriod({ period: "custom", from: "2020-01-01", to: "2025-01-01" }, sunday).usedFallback, true);
  assert.equal(resolveAccountingPeriod({ period: ["current_year"], from: "2026-01-01" }, sunday).usedFallback, true);
});

test("long valid custom ranges use monthly buckets", () => {
  const period = resolveAccountingPeriod({ period: "custom", from: "2024-01-01", to: "2025-06-30" }, sunday);
  assert.equal(period.usedFallback, false);
  assert.equal(period.bucket, "month");
});

test("clinic date follows Africa/Casablanca across midnight and Ramadan offset", () => {
  assert.equal(clinicDate(new Date("2025-12-31T22:59:59Z")), "2025-12-31");
  assert.equal(clinicDate(new Date("2025-12-31T23:00:00Z")), "2026-01-01");
  assert.equal(clinicDate(new Date("2026-03-01T23:30:00Z")), "2026-03-01");
});
