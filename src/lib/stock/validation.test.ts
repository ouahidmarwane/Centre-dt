import assert from "node:assert/strict";
import test from "node:test";

import { buildOrderList, parseStockQuantity, stockLevel, suggestedOrderQuantity, validateStockItemForm, validateStockMovementForm } from "./validation.ts";

const form = (values: Record<string, string>) => { const data = new FormData(); for (const [key, value] of Object.entries(values)) data.set(key, value); return data; };

test("stock quantities accept French decimals, reject negatives and extra precision", () => {
  assert.equal(parseStockQuantity("12"), 12);
  assert.equal(parseStockQuantity("2,5"), 2.5);
  assert.equal(parseStockQuantity("-1"), null);
  assert.equal(parseStockQuantity("1.234"), null);
  assert.equal(parseStockQuantity(""), null);
});

test("item form validation", () => {
  const ok = validateStockItemForm(form({ name: " Gants nitrile M ", category: "consumable", unit: "boîte", quantity: "12", alertThreshold: "5", supplier: "", notes: "" }), { requireQuantity: true });
  assert.deepEqual(ok, { success: true, data: { name: "Gants nitrile M", category: "consumable", unit: "boîte", quantity: 12, alertThreshold: 5, supplier: null, notes: null } });
  const bad = validateStockItemForm(form({ name: "", category: "food", unit: "", quantity: "-3", alertThreshold: "x" }), { requireQuantity: true });
  assert.equal(bad.success, false);
  if (!bad.success) assert.deepEqual(Object.keys(bad.fieldErrors).sort(), ["alertThreshold", "category", "name", "quantity", "unit"]);
});

test("movement form: in/out need a quantity, an inventory needs a reason", () => {
  assert.deepEqual(validateStockMovementForm(form({ kind: "out", quantity: "3", reason: "" })), { success: true, data: { kind: "out", quantity: 3, reason: null } });
  assert.equal(validateStockMovementForm(form({ kind: "in", quantity: "0" })).success, false);
  assert.equal(validateStockMovementForm(form({ kind: "adjustment", quantity: "0", reason: "" })).success, false);
  assert.deepEqual(validateStockMovementForm(form({ kind: "adjustment", quantity: "0", reason: "Inventaire" })), { success: true, data: { kind: "adjustment", quantity: 0, reason: "Inventaire" } });
});

test("stock levels and suggested order", () => {
  assert.equal(stockLevel({ quantity: 0, alertThreshold: 5 }), "out");
  assert.equal(stockLevel({ quantity: 5, alertThreshold: 5 }), "low");
  assert.equal(stockLevel({ quantity: 6, alertThreshold: 5 }), "ok");
  assert.equal(suggestedOrderQuantity({ quantity: 4, alertThreshold: 5 }), 6);
  assert.equal(suggestedOrderQuantity({ quantity: 0, alertThreshold: 0 }), 1);
});

test("order list groups items to reorder by supplier", () => {
  const list = buildOrderList([
    { name: "Gants nitrile M", unit: "boîte", quantity: 4, alertThreshold: 5, supplier: "Dentalmed" },
    { name: "Articaïne 4 %", unit: "carpule", quantity: 0, alertThreshold: 20, supplier: "Pharma Sud" },
    { name: "Compresses", unit: "paquet", quantity: 50, alertThreshold: 10, supplier: "Dentalmed" },
    { name: "Aspirateurs", unit: "sachet", quantity: 1, alertThreshold: 3, supplier: null },
  ]);
  assert.equal(list, "Dentalmed :\n- Gants nitrile M : 6 boîte\n\nFournisseur non renseigné :\n- Aspirateurs : 5 sachet\n\nPharma Sud :\n- Articaïne 4 % : 40 carpule");
});
