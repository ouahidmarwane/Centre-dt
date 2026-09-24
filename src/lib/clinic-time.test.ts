import assert from "node:assert/strict";
import test from "node:test";

import { ClinicDateTimeFormat, clinicTimeZoneAt } from "./clinic-time.ts";

const time = new ClinicDateTimeFormat("fr-FR", { hour: "2-digit", minute: "2-digit", hourCycle: "h23" });

test("clinic time follows Morocco's permanent UTC+0 from 2026-09-20", () => {
  assert.equal(time.format(new Date("2026-09-24T14:02:00Z")), "14:02");
  assert.equal(time.format(new Date("2027-07-01T09:00:00Z")), "09:00");
  assert.equal(clinicTimeZoneAt(new Date("2026-09-20T01:00:00Z")), "UTC");
});

test("dates before the switch keep the historical Moroccan rules", () => {
  assert.equal(time.format(new Date("2026-07-01T09:00:00Z")), "10:00");
  assert.equal(time.format(new Date("2026-09-20T00:59:00Z")), "01:59");
  assert.equal(clinicTimeZoneAt(new Date("2026-09-20T00:59:59Z")), "Africa/Casablanca");
});

test("formatToParts uses the same rule", () => {
  const parts = new ClinicDateTimeFormat("en-CA", { year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date("2026-12-31T23:30:00Z"));
  assert.equal(parts.map((part) => part.value).join(""), "2026-12-31");
});
