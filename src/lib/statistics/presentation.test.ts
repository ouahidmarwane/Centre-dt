import assert from "node:assert/strict";
import test from "node:test";

import { careTypeOf, groupByCareType, monthLabel, noShowRate, parseStatisticsMonth, relativeChange, shiftMonth } from "./presentation.ts";

test("free-text interventions fold into care types", () => {
  assert.equal(careTypeOf("Implant 36 — Pose de l’implant"), "Implantologie");
  assert.equal(careTypeOf("DÉTARTRAGE"), "Parodontie et détartrage");
  assert.equal(careTypeOf("Soin de carie 26"), "Soins conservateurs");
  assert.equal(careTypeOf("Dévitalisation molaire"), "Endodontie");
  assert.equal(careTypeOf("Couronne céramique"), "Prothèse et couronnes");
  assert.equal(careTypeOf("Extraction dent de sagesse"), "Chirurgie et extractions");
  assert.equal(careTypeOf("Contrôle"), "Consultations et contrôles");
  assert.equal(careTypeOf("Blanchiment"), "Esthétique");
  assert.equal(careTypeOf("Divers"), "Autres soins");
});

test("care types are summed exactly and ranked by amount", () => {
  const grouped = groupByCareType([
    { nature: "détartrage", amount: 400.1, count: 1 },
    { nature: "implant 36 — pose", amount: 6000, count: 1 },
    { nature: "surfaçage", amount: 300.2, count: 2 },
  ]);
  assert.deepEqual(grouped.map((item) => [item.careType, item.amount, item.count]), [["Implantologie", 6000, 1], ["Parodontie et détartrage", 700.3, 3]]);
  assert.equal(Math.round(grouped[0].share * 1000), 895);
  assert.deepEqual(groupByCareType([]), []);
});

test("no-show rate and month-over-month change", () => {
  assert.equal(noShowRate({ completed: 3, noShow: 1 }), 0.25);
  assert.equal(noShowRate({ completed: 0, noShow: 0 }), null);
  assert.equal(relativeChange(150, 100), 0.5);
  assert.equal(relativeChange(10, 0), null);
});

test("month parameter and navigation", () => {
  assert.equal(parseStatisticsMonth("2026-03", "2026-09"), "2026-03");
  assert.equal(parseStatisticsMonth("2026-10", "2026-09"), "2026-09");
  assert.equal(parseStatisticsMonth("2019-12", "2026-09"), "2026-09");
  assert.equal(parseStatisticsMonth("2026-13", "2026-09"), "2026-09");
  assert.equal(shiftMonth("2026-01", -1), "2025-12");
  assert.equal(shiftMonth("2026-12", 1), "2027-01");
  assert.equal(monthLabel("2026-09"), "septembre 2026");
});
