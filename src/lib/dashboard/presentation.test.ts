import assert from "node:assert/strict";
import test from "node:test";

import { dashboardQuote, formatDashboardMoney, frenchClinicDate } from "./presentation.ts";

test("the daily quote is deterministic and local", () => {
  assert.equal(dashboardQuote("2026-09-14"), dashboardQuote("2026-09-14"));
  assert.notEqual(dashboardQuote("2026-09-14"), dashboardQuote("2026-09-15"));
});

test("clinic dates are rendered in French without depending on host time", () => {
  assert.equal(frenchClinicDate("2026-09-14"), "Lundi 14 septembre 2026");
});

test("zero and large MAD values retain a deterministic readable unit", () => {
  assert.match(formatDashboardMoney(0), /0.*MAD/);
  assert.match(formatDashboardMoney(9_999_999_999), /9.*999.*999.*999.*MAD/);
});
