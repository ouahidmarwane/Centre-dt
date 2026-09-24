import assert from "node:assert/strict";
import test from "node:test";

import { buildWhatsAppPaymentReminderUrl, daysBetween, formatReminderAmount, reminderRankLabel } from "./validation.ts";

test("reminder rank labels in French", () => {
  assert.equal(reminderRankLabel(0), "1re relance");
  assert.equal(reminderRankLabel(1), "2e relance");
  assert.equal(reminderRankLabel(4), "5e relance");
});

test("days between clinic dates", () => {
  assert.equal(daysBetween("2026-09-04", "2026-09-24"), 20);
  assert.equal(daysBetween("2026-09-24", "2026-09-24"), 0);
});

test("payment reminder message is courteous, bilingual and states the amount", () => {
  assert.equal(formatReminderAmount(1234.5), "1 234,50 MAD");
  const url = buildWhatsAppPaymentReminderUrl({ phone: "06 12 34 56 78", firstName: "Imane", outstanding: 700 });
  assert.ok(url?.startsWith("https://wa.me/212612345678?text="));
  const text = decodeURIComponent(url!.split("text=")[1]);
  assert.match(text, /Bonjour Imane, sauf erreur de notre part, un solde de 700,00 MAD reste à régler/);
  assert.match(text, /مرحبا Imane/);
  assert.equal(buildWhatsAppPaymentReminderUrl({ phone: null, firstName: "Imane", outstanding: 700 }), null);
});
