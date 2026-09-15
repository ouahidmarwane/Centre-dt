import assert from "node:assert/strict";
import test from "node:test";

import { resolveDashboardPeriod } from "./period.ts";

const reference = new Date("2026-09-14T10:00:00Z");

test("dashboard periods use bounded clinic-calendar ranges", () => {
  assert.deepEqual(resolveDashboardPeriod("week", reference), {
    key: "week", startDate: "2026-09-14", endDate: "2026-09-21", bucket: "day",
  });
  assert.deepEqual(resolveDashboardPeriod("month", reference), {
    key: "month", startDate: "2026-09-01", endDate: "2026-10-01", bucket: "day",
  });
  assert.deepEqual(resolveDashboardPeriod("six_months", reference), {
    key: "six_months", startDate: "2026-04-01", endDate: "2026-10-01", bucket: "month",
  });
  assert.deepEqual(resolveDashboardPeriod("year", reference), {
    key: "year", startDate: "2026-01-01", endDate: "2027-01-01", bucket: "month",
  });
});

test("invalid and array values fall back to the current month", () => {
  assert.equal(resolveDashboardPeriod("forever", reference).key, "month");
  assert.equal(resolveDashboardPeriod(["week"], reference).key, "month");
});
