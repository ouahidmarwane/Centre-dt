import assert from "node:assert/strict";
import test from "node:test";

import { isStaffDigestKind, staffDigestText } from "./staff-digests.ts";

test("staff digests carry counts only, with French plurals", () => {
  assert.equal(staffDigestText("unpaid_payments", 1).split("\n")[1], "1 patient à relancer aujourd’hui. Ouvrez « Recouvrement » dans l’application pour envoyer les messages.");
  assert.match(staffDigestText("unpaid_payments", 3), /^Relances d’impayés\n3 patients à relancer/);
  assert.match(staffDigestText("low_stock", 2), /^Stock bas\n2 articles sous le seuil d’alerte/);
  assert.doesNotMatch(staffDigestText("unpaid_payments", 3), /MAD|\d{6,}/);
});

test("digest kinds are validated", () => {
  assert.equal(isStaffDigestKind("low_stock"), true);
  assert.equal(isStaffDigestKind("patients"), false);
});
