import assert from "node:assert/strict";
import test from "node:test";

import { formatDashboardMoney, frenchClinicDate, hourlyQuote, motivationalQuotes } from "./presentation.ts";

test("the motivational quote is deterministic and changes every hour", () => {
  assert.equal(hourlyQuote("2026-09-24", 14), hourlyQuote("2026-09-24", 14));
  assert.notEqual(hourlyQuote("2026-09-24", 14), hourlyQuote("2026-09-24", 15));
  assert.notEqual(hourlyQuote("2026-09-24", 23), hourlyQuote("2026-09-25", 0));
  const day = new Set(Array.from({ length: 24 }, (_, hour) => hourlyQuote("2026-09-24", hour)));
  assert.equal(day.size, 24, "no quote repeats within a day");
  assert.ok((motivationalQuotes as readonly string[]).includes(hourlyQuote("invalid", Number.NaN)));
});

test("clinic dates are rendered in French without depending on host time", () => {
  assert.equal(frenchClinicDate("2026-09-14"), "Lundi 14 septembre 2026");
});

test("zero and large MAD values retain a deterministic readable unit", () => {
  assert.match(formatDashboardMoney(0), /0.*MAD/);
  assert.match(formatDashboardMoney(9_999_999_999), /9.*999.*999.*999.*MAD/);
});
