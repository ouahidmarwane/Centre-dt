import assert from "node:assert/strict";
import test from "node:test";

import { filterQuickCommands, normalizeQuickSearchTerm, patientSearchHref, type QuickCommand } from "./quick-search.ts";

const commands: QuickCommand[] = [
  { href: "/dashboard", label: "Tableau de bord", keywords: "accueil", section: "Pages" },
  { href: "/appointments", label: "Rendez-vous", keywords: "agenda planning", section: "Pages" },
  { href: "/patients/new", label: "Nouveau patient", keywords: "créer dossier", section: "Actions" },
];

test("quick search terms follow the search_patients database contract", () => {
  assert.equal(normalizeQuickSearchTerm("  Alaoui   Sara "), "Alaoui Sara");
  assert.equal(normalizeQuickSearchTerm("06"), "06");
  assert.equal(normalizeQuickSearchTerm("a"), null);
  assert.equal(normalizeQuickSearchTerm("x".repeat(81)), null);
  assert.equal(normalizeQuickSearchTerm("50%"), null);
  assert.equal(normalizeQuickSearchTerm("a_b"), null);
  assert.equal(normalizeQuickSearchTerm(42), null);
});

test("command filtering is accent-insensitive and requires every word", () => {
  assert.deepEqual(filterQuickCommands(commands, "").map((c) => c.href), ["/dashboard", "/appointments", "/patients/new"]);
  assert.deepEqual(filterQuickCommands(commands, "PLANNING").map((c) => c.href), ["/appointments"]);
  assert.deepEqual(filterQuickCommands(commands, "creer patient").map((c) => c.href), ["/patients/new"]);
  assert.deepEqual(filterQuickCommands(commands, "nouveau agenda"), []);
});

test("full patient search link encodes the typed term", () => {
  assert.equal(patientSearchHref("Sara & Co"), "/patients?query=Sara%20%26%20Co");
});
