import assert from "node:assert/strict";
import test from "node:test";

import { buildWhatsAppSlotOfferUrl, findFreedSlots, rankWaitlistForSlot, slotPeriod, validateWaitlistForm, type WaitlistEntry } from "./validation.ts";

const form = (values: Record<string, string>) => { const data = new FormData(); for (const [key, value] of Object.entries(values)) data.set(key, value); return data; };
const patientId = "5b2c8f4e-1d3a-4c6b-9e7f-0a1b2c3d4e5f";

test("waitlist form validation", () => {
  const ok = validateWaitlistForm(form({ patientId, reason: " Détartrage ", preferredPeriod: "morning", durationMinutes: "45", isUrgent: "on", notes: "" }));
  assert.deepEqual(ok, { success: true, data: { patientId, reason: "Détartrage", preferredPeriod: "morning", durationMinutes: 45, isUrgent: true, notes: null } });
  const bad = validateWaitlistForm(form({ patientId: "x", reason: "", preferredPeriod: "night", durationMinutes: "20" }));
  assert.equal(bad.success, false);
  if (!bad.success) assert.deepEqual(Object.keys(bad.fieldErrors).sort(), ["durationMinutes", "patientId", "preferredPeriod", "reason"]);
});

test("slot period follows clinic time, including Morocco's switch to UTC+0", () => {
  assert.equal(slotPeriod("2026-07-06T11:30:00.000Z"), "morning"); // 12:30 in July 2026 (UTC+1)
  assert.equal(slotPeriod("2026-07-06T12:00:00.000Z"), "afternoon"); // 13:00 in July 2026
  assert.equal(slotPeriod("2026-10-05T12:59:00.000Z"), "morning"); // 12:59, UTC+0 since 2026-09-20
  assert.equal(slotPeriod("2026-10-05T13:00:00.000Z"), "afternoon");
});

test("freed slots exclude past, retaken and duplicate cancellations", () => {
  const now = new Date("2026-10-05T08:00:00.000Z");
  const slots = findFreedSlots([
    { startsAt: "2026-10-05T07:00:00.000Z", endsAt: "2026-10-05T07:30:00.000Z", cancelledTitle: "Passé" },
    { startsAt: "2026-10-05T10:00:00.000Z", endsAt: "2026-10-05T10:30:00.000Z", cancelledTitle: "Repris" },
    { startsAt: "2026-10-06T09:00:00.000Z", endsAt: "2026-10-06T10:00:00.000Z", cancelledTitle: "Libre" },
    { startsAt: "2026-10-06T09:00:00.000Z", endsAt: "2026-10-06T10:00:00.000Z", cancelledTitle: "Doublon" },
    { startsAt: "2026-10-05T14:00:00.000Z", endsAt: "2026-10-05T14:30:00.000Z", cancelledTitle: "Libre aussi" },
  ], [{ startsAt: "2026-10-05T10:15:00+00:00", endsAt: "2026-10-05T10:45:00+00:00" }], now);
  assert.deepEqual(slots.map((slot) => slot.cancelledTitle), ["Libre aussi", "Libre"]);
});

const entry = (id: string, overrides: Partial<WaitlistEntry>): WaitlistEntry => ({
  id, patientId, patientName: id, patientFirstName: id, patientPhone: "0612345678", reason: "Soin",
  preferredPeriod: "any", durationMinutes: 30, isUrgent: false, notes: null, createdAt: "2026-10-01T10:00:00.000Z", ...overrides,
});

test("candidates fit the slot duration and period; urgent first, then oldest", () => {
  const slot = { startsAt: "2026-10-06T08:00:00.000Z", endsAt: "2026-10-06T08:45:00.000Z" }; // 09:00 clinic, 45 min
  const ranked = rankWaitlistForSlot(slot, [
    entry("recent", { createdAt: "2026-10-03T10:00:00.000Z" }),
    entry("old", { createdAt: "2026-09-20T10:00:00.000Z" }),
    entry("urgent", { isUrgent: true, createdAt: "2026-10-04T10:00:00.000Z" }),
    entry("too-long", { durationMinutes: 60 }),
    entry("afternoon-only", { preferredPeriod: "afternoon" }),
    entry("morning", { preferredPeriod: "morning", createdAt: "2026-10-02T10:00:00.000Z" }),
  ]);
  assert.deepEqual(ranked.map((item) => item.id), ["urgent", "old", "morning", "recent"]);
});

test("slot offer message is bilingual and addressed to a WhatsApp number", () => {
  const url = buildWhatsAppSlotOfferUrl({ phone: "0612345678", firstName: "Sara", startsAt: "2026-10-06T08:00:00.000Z" });
  assert.ok(url?.startsWith("https://wa.me/212612345678?text="));
  const text = decodeURIComponent(url!.split("text=")[1]);
  assert.match(text, /Bonjour Sara, un créneau vient de se libérer/);
  assert.match(text, /08:00/);
  assert.match(text, /مرحبا Sara/);
  assert.equal(buildWhatsAppSlotOfferUrl({ phone: "abc", firstName: "Sara", startsAt: "2026-10-06T08:00:00.000Z" }), null);
});
