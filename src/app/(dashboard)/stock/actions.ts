"use server";

import { revalidatePath } from "next/cache";

import { isUuid } from "@/lib/appointments/validation";
import { requirePermission } from "@/lib/auth/server";
import { validateStockItemForm, validateStockMovementForm } from "@/lib/stock/validation";
import { createClient } from "@/lib/supabase/server";

export type StockActionState = { success: boolean; message: string | null; fieldErrors: Partial<Record<string, string>> };
const fail = (message: string, fieldErrors: StockActionState["fieldErrors"] = {}): StockActionState => ({ success: false, message, fieldErrors });
const done = (message: string): StockActionState => { revalidatePath("/stock"); return { success: true, message, fieldErrors: {} }; };

export async function createStockItemAction(_state: StockActionState, formData: FormData): Promise<StockActionState> {
  await requirePermission("stock.write");
  const validation = validateStockItemForm(formData, { requireQuantity: true });
  if (!validation.success) return fail("Vérifiez les informations indiquées.", validation.fieldErrors);
  const value = validation.data, supabase = await createClient();
  const { error } = await supabase.rpc("create_stock_item", {
    target_name: value.name, target_category: value.category, target_unit: value.unit, target_quantity: value.quantity,
    target_alert_threshold: value.alertThreshold, target_supplier: value.supplier ?? undefined, target_notes: value.notes ?? undefined,
  });
  if (error) return fail(error.code === "23505" ? "Un article actif porte déjà ce nom." : "L’article n’a pas pu être enregistré.");
  return done("Article ajouté au stock.");
}

export async function updateStockItemAction(itemId: string, _state: StockActionState, formData: FormData): Promise<StockActionState> {
  await requirePermission("stock.write");
  if (!isUuid(itemId)) return fail("Article invalide.");
  const validation = validateStockItemForm(formData, { requireQuantity: false });
  if (!validation.success) return fail("Vérifiez les informations indiquées.", validation.fieldErrors);
  const value = validation.data, supabase = await createClient();
  const { data, error } = await supabase.rpc("update_stock_item", {
    target_item_id: itemId, target_name: value.name, target_category: value.category, target_unit: value.unit,
    target_alert_threshold: value.alertThreshold, target_supplier: value.supplier ?? undefined, target_notes: value.notes ?? undefined,
  });
  if (error || !data) return fail(error?.code === "23505" ? "Un article actif porte déjà ce nom." : "L’article n’a pas pu être modifié.");
  return done("Article mis à jour.");
}

export async function recordStockMovementAction(itemId: string, _state: StockActionState, formData: FormData): Promise<StockActionState> {
  await requirePermission("stock.write");
  if (!isUuid(itemId)) return fail("Article invalide.");
  const validation = validateStockMovementForm(formData);
  if (!validation.success) return fail("Vérifiez la quantité indiquée.", validation.fieldErrors);
  const value = validation.data, supabase = await createClient();
  const { error } = await supabase.rpc("record_stock_movement", { target_item_id: itemId, target_kind: value.kind, target_quantity: value.quantity, target_reason: value.reason ?? undefined });
  if (error) return fail(error.message.includes("Insufficient stock") ? "Stock insuffisant pour cette sortie." : "Le mouvement n’a pas pu être enregistré.");
  return done(value.kind === "adjustment" ? "Inventaire enregistré." : value.kind === "in" ? "Entrée enregistrée." : "Sortie enregistrée.");
}

export async function archiveStockItemAction(itemId: string): Promise<void> {
  await requirePermission("stock.archive");
  if (!isUuid(itemId)) return;
  const supabase = await createClient();
  await supabase.rpc("archive_stock_item", { target_item_id: itemId });
  revalidatePath("/stock");
}
