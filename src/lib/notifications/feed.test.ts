import assert from "node:assert/strict";
import test from "node:test";

import { buildNotifications, relativeTime, unseenNotifications } from "./feed.ts";

const now = new Date("2026-09-28T09:00:00Z"); // 09:00 clinic time (UTC+0)

test("each clinic event becomes a banner with a stable id and a useful link", () => {
  const items = buildNotifications({
    reminders: [{ appointmentId: "a1", patientName: "Sara Alaoui", startsAt: "2026-09-29T10:00:00Z", type: "day_before" }],
    upcoming: [
      { appointmentId: "a2", patientName: "Omar Tazi", title: "Contrôle", startsAt: "2026-09-28T09:12:00Z" },
      { appointmentId: "a3", patientName: "Loin", title: "Contrôle", startsAt: "2026-09-28T11:00:00Z" },
    ],
    payments: [{ patientId: "p1", name: "Imane R.", outstanding: 1000, lastReminderAt: null }],
    freedSlots: [{ startsAt: "2026-09-30T10:00:00Z", candidates: 2 }, { startsAt: "2026-09-30T11:00:00Z", candidates: 0 }],
    lowStock: [{ id: "s1", name: "Gants nitrile M", unit: "boîte", quantity: 4 }, { id: "s2", name: "Articaïne", unit: "carpule", quantity: 0 }],
  }, now);
  assert.deepEqual(items.map((item) => item.id), [
    "appointment_reminder:a1:day_before", "next_patient:a2", "payment_reminder:p1:first",
    "freed_slot:2026-09-30T10:00:00.000Z", "low_stock:s1:4", "low_stock:s2:0",
  ]);
  assert.equal(items[0].body, "Sara Alaoui — rendez-vous demain à 10:00");
  assert.equal(items[0].href, "/appointments?date=2026-09-29");
  assert.equal(items[1].body, "Omar Tazi à 09:12 (dans 12 min) · Contrôle");
  assert.equal(items[2].body.replace(/ | /g, " "), "Imane R. — 1 000 MAD à régler");
  assert.equal(items[3].body, "mercredi 30 septembre à 10:00 — 2 patients en attente");
  assert.equal(items[5].title, "Rupture de stock");
  const late = buildNotifications({ reminders: [{ appointmentId: "a9", patientName: "Salma", startsAt: "2026-09-28T09:10:00Z", type: "day_before" }] }, now)[0];
  assert.equal(late.body, "Salma — rendez-vous aujourd’hui à 09:10", "an unhandled day-before reminder says today, not tomorrow");
});

test("a new unpaid cycle or a new stock level produces a new banner", () => {
  const first = buildNotifications({ payments: [{ patientId: "p1", name: "X", outstanding: 1, lastReminderAt: null }] }, now)[0].id;
  const again = buildNotifications({ payments: [{ patientId: "p1", name: "X", outstanding: 1, lastReminderAt: "2026-09-10T10:00:00Z" }] }, now)[0].id;
  assert.notEqual(first, again);
});

test("seen banners are not shown again; relative time reads like iOS", () => {
  const items = buildNotifications({ lowStock: [{ id: "s1", name: "Gants", unit: "boîte", quantity: 3 }, { id: "s2", name: "Masques", unit: "boîte", quantity: 1 }] }, now);
  assert.deepEqual(unseenNotifications(items, new Set(["low_stock:s1:3"])).map((item) => item.id), ["low_stock:s2:1"]);
  assert.equal(relativeTime("2026-09-28T09:00:00Z", now), "maintenant");
  assert.equal(relativeTime("2026-09-28T08:57:00Z", now), "il y a 3 min");
  assert.equal(relativeTime("2026-09-28T07:00:00Z", now), "il y a 2 h");
});

test("the notification centre keeps today's notifications, newest first, and resets the next day", async () => {
  const { mergeHistory, pruneHistory } = await import("./feed.ts");
  const morning = new Date("2026-09-28T08:00:00Z");
  const noon = new Date("2026-09-28T12:00:00Z");
  const item = (id: string) => ({ id, kind: "low_stock" as const, title: "Stock bas", body: id, href: "/stock", at: "ignored" });
  let history = mergeHistory([], [item("a")], morning);
  history = mergeHistory(history, [item("a"), item("b")], noon);
  assert.deepEqual(history.map((entry) => [entry.id, entry.at, entry.read]), [["b", noon.toISOString(), false], ["a", morning.toISOString(), false]]);
  assert.deepEqual(pruneHistory(history, new Date("2026-09-28T23:59:00Z")).length, 2, "still the same clinic day");
  assert.deepEqual(pruneHistory(history, new Date("2026-09-29T00:01:00Z")), [], "a new clinic day starts empty");
});
