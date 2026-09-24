import "server-only";

import { createClient } from "@/lib/supabase/server";
import type { StockCategory, StockMovementKind } from "./validation";

export type StockItem = { id: string; name: string; category: StockCategory; unit: string; quantity: number; alertThreshold: number; supplier: string | null; notes: string | null; updatedAt: string };
export type StockMovement = { id: string; itemName: string; unit: string; kind: StockMovementKind; delta: number; quantityAfter: number; reason: string | null; createdAt: string };

export async function getStockOverview(): Promise<{ items: StockItem[]; movements: StockMovement[] }> {
  const supabase = await createClient();
  const [itemsResult, movementsResult] = await Promise.all([
    supabase.from("stock_items").select("id,name,category,unit,quantity,alert_threshold,supplier,notes,updated_at").eq("is_active", true).order("name"),
    supabase.from("stock_movements").select("id,kind,delta,quantity_after,reason,created_at,item:stock_items(name,unit)").order("created_at", { ascending: false }).limit(30),
  ]);
  if (itemsResult.error || movementsResult.error) throw new Error("STOCK_UNAVAILABLE");
  return {
    items: (itemsResult.data ?? []).map((row) => ({
      id: row.id, name: row.name, category: row.category as StockCategory, unit: row.unit, quantity: Number(row.quantity),
      alertThreshold: Number(row.alert_threshold), supplier: row.supplier, notes: row.notes, updatedAt: row.updated_at,
    })),
    movements: (movementsResult.data ?? []).map((row) => ({
      id: row.id, itemName: row.item?.name ?? "Article", unit: row.item?.unit ?? "", kind: row.kind as StockMovementKind,
      delta: Number(row.delta), quantityAfter: Number(row.quantity_after), reason: row.reason, createdAt: row.created_at,
    })),
  };
}
