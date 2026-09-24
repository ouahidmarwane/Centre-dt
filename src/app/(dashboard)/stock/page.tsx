import type { Metadata } from "next";

import { StockManager } from "@/components/stock/stock-manager";
import { requirePermission } from "@/lib/auth/server";
import { hasPermission } from "@/lib/permissions";
import { getStockOverview } from "@/lib/stock/data";

import { archiveStockItemAction, createStockItemAction, recordStockMovementAction, updateStockItemAction } from "./actions";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Stock" };

export default async function StockPage() {
  const user = await requirePermission("stock.read");
  const { items, movements } = await getStockOverview();
  return (
    <div className="mx-auto max-w-[1600px]">
      <header className="kpi-rise">
        <p className="flex items-center gap-2 text-xs font-medium text-slate-500"><span aria-hidden="true" className="h-px w-6 bg-[var(--blue)]" />Consommables et fournitures</p>
        <h1 className="mt-2 text-[2rem] leading-tight font-semibold tracking-[-0.04em] text-[var(--navy)] sm:text-[2.4rem]">Stock</h1>
        <p className="mt-1 max-w-2xl text-sm text-slate-500">Chaque entrée, sortie ou inventaire est historisé. Un article passe « à commander » dès qu’il atteint son seuil d’alerte, et l’équipe est prévenue chaque matin sur Telegram.</p>
      </header>
      <StockManager
        archiveAction={archiveStockItemAction}
        canArchive={hasPermission(user.role, "stock.archive")}
        createAction={createStockItemAction}
        formToken={crypto.randomUUID()}
        items={items}
        movementAction={recordStockMovementAction}
        movements={movements}
        updateAction={updateStockItemAction}
      />
    </div>
  );
}
