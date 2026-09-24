export const stockCategories = ["consumable", "anesthetic", "hygiene", "instrument", "prosthesis", "medication", "other"] as const;
export type StockCategory = (typeof stockCategories)[number];
export const stockCategoryLabels: Record<StockCategory, string> = {
  consumable: "Consommables", anesthetic: "Anesthésiques", hygiene: "Hygiène et stérilisation", instrument: "Instruments", prosthesis: "Prothèse et laboratoire", medication: "Médicaments", other: "Autre",
};
export const stockMovementKinds = ["in", "out", "adjustment"] as const;
export type StockMovementKind = (typeof stockMovementKinds)[number];
export const stockMovementLabels: Record<StockMovementKind, string> = { in: "Entrée", out: "Sortie", adjustment: "Inventaire" };

export type StockItemField = "name" | "category" | "unit" | "quantity" | "alertThreshold" | "supplier" | "notes";
export type StockItemInput = { name: string; category: StockCategory; unit: string; quantity: number; alertThreshold: number; supplier: string | null; notes: string | null };
export type StockMovementField = "kind" | "quantity" | "reason";
export type StockMovementInput = { kind: StockMovementKind; quantity: number; reason: string | null };

const quantityPattern = /^(?:0|[1-9]\d{0,6})(?:[.,]\d{1,2})?$/;
const text = (form: FormData, key: string) => { const value = form.get(key); return typeof value === "string" ? value.trim() : ""; };
export function parseStockQuantity(value: string): number | null {
  return quantityPattern.test(value) ? Number(value.replace(",", ".")) : null;
}

export function validateStockItemForm(form: FormData, { requireQuantity }: { requireQuantity: boolean }): { success: true; data: StockItemInput } | { success: false; fieldErrors: Partial<Record<StockItemField, string>> } {
  const name = text(form, "name"), category = text(form, "category"), unit = text(form, "unit"), supplier = text(form, "supplier"), notes = text(form, "notes");
  const quantity = requireQuantity ? parseStockQuantity(text(form, "quantity") || "0") : 0;
  const alertThreshold = parseStockQuantity(text(form, "alertThreshold") || "0");
  const fieldErrors: Partial<Record<StockItemField, string>> = {};
  if (!name || name.length > 120) fieldErrors.name = "Le nom doit contenir entre 1 et 120 caractères.";
  if (!stockCategories.includes(category as StockCategory)) fieldErrors.category = "Choisissez une catégorie.";
  if (!unit || unit.length > 30) fieldErrors.unit = "Indiquez l’unité (ex. boîte, carpule).";
  if (quantity === null) fieldErrors.quantity = "Quantité invalide (nombre positif, 2 décimales maximum).";
  if (alertThreshold === null) fieldErrors.alertThreshold = "Seuil invalide (nombre positif, 2 décimales maximum).";
  if (supplier.length > 120) fieldErrors.supplier = "Le fournisseur est limité à 120 caractères.";
  if (notes.length > 1000) fieldErrors.notes = "La note est limitée à 1 000 caractères.";
  if (Object.keys(fieldErrors).length) return { success: false, fieldErrors };
  return { success: true, data: { name, category: category as StockCategory, unit, quantity: quantity!, alertThreshold: alertThreshold!, supplier: supplier || null, notes: notes || null } };
}

export function validateStockMovementForm(form: FormData): { success: true; data: StockMovementInput } | { success: false; fieldErrors: Partial<Record<StockMovementField, string>> } {
  const kind = text(form, "kind"), reason = text(form, "reason"), quantity = parseStockQuantity(text(form, "quantity"));
  const fieldErrors: Partial<Record<StockMovementField, string>> = {};
  if (!stockMovementKinds.includes(kind as StockMovementKind)) fieldErrors.kind = "Type de mouvement invalide.";
  if (quantity === null || (kind !== "adjustment" && quantity === 0)) fieldErrors.quantity = kind === "adjustment" ? "Indiquez la quantité comptée." : "Indiquez une quantité supérieure à 0.";
  if (kind === "adjustment" && !reason) fieldErrors.reason = "Un inventaire doit être justifié (ex. inventaire mensuel).";
  if (reason.length > 300) fieldErrors.reason = "Le motif est limité à 300 caractères.";
  if (Object.keys(fieldErrors).length) return { success: false, fieldErrors };
  return { success: true, data: { kind: kind as StockMovementKind, quantity: quantity!, reason: reason || null } };
}

export type StockLevel = "out" | "low" | "ok";
export function stockLevel(item: { quantity: number; alertThreshold: number }): StockLevel {
  if (item.quantity <= 0) return "out";
  return item.quantity <= item.alertThreshold ? "low" : "ok";
}

// Order enough to get back to twice the alert threshold (at least one unit).
export function suggestedOrderQuantity(item: { quantity: number; alertThreshold: number }): number {
  return Math.max(1, Math.ceil(item.alertThreshold * 2 - item.quantity));
}

export type OrderableItem = { name: string; unit: string; quantity: number; alertThreshold: number; supplier: string | null };
// Plain-text order list grouped by supplier, ready to paste into a message or an email.
export function buildOrderList(items: OrderableItem[]): string {
  const toOrder = items.filter((item) => stockLevel(item) !== "ok");
  const groups = new Map<string, OrderableItem[]>();
  for (const item of toOrder) {
    const supplier = item.supplier ?? "Fournisseur non renseigné";
    groups.set(supplier, [...(groups.get(supplier) ?? []), item]);
  }
  return [...groups.entries()]
    .sort(([a], [b]) => a.localeCompare(b, "fr"))
    .map(([supplier, list]) => [`${supplier} :`, ...list.sort((a, b) => a.name.localeCompare(b.name, "fr")).map((item) => `- ${item.name} : ${suggestedOrderQuantity(item)} ${item.unit}`)].join("\n"))
    .join("\n\n");
}
