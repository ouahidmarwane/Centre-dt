"use client";

import { ClinicDateTimeFormat } from "@/lib/clinic-time";
import { useActionState, useState } from "react";

import type { StockActionState } from "@/app/(dashboard)/stock/actions";
import { FormField } from "@/components/ui/form-field";
import { PendingSubmitButton } from "@/components/ui/pending-submit-button";
import { Badge, chipClass, Composer, EmptyNote, fieldClass, FormMessage, ghostButton, panelClass, primaryButton, type Tone } from "@/components/ui/panel-ui";
import { submitKeepingValues } from "@/components/ui/submit-keeping-values";
import type { StockItem, StockMovement } from "@/lib/stock/data";
import { buildOrderList, stockCategories, stockCategoryLabels, stockLevel, stockMovementLabels, suggestedOrderQuantity, type StockLevel, type StockMovementKind } from "@/lib/stock/validation";

type Action = (state: StockActionState, formData: FormData) => Promise<StockActionState>;
type Props = {
  items: StockItem[];
  movements: StockMovement[];
  canArchive: boolean;
  formToken: string;
  createAction: Action;
  updateAction: (itemId: string, state: StockActionState, formData: FormData) => Promise<StockActionState>;
  movementAction: (itemId: string, state: StockActionState, formData: FormData) => Promise<StockActionState>;
  archiveAction: (itemId: string) => Promise<void>;
};

const initial: StockActionState = { success: false, message: null, fieldErrors: {} };
const quantityFormat = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 2 });
const dateTime = new ClinicDateTimeFormat("fr-FR", { dateStyle: "medium", timeStyle: "short" });
const levelTone: Record<StockLevel, Tone> = { out: "red", low: "amber", ok: "green" };
const levelLabel: Record<StockLevel, string> = { out: "Rupture", low: "À commander", ok: "En stock" };

export function StockManager(props: Props) {
  const [filter, setFilter] = useState<"all" | "alert">("all");
  const alerts = props.items.filter((item) => stockLevel(item) !== "ok");
  const shown = filter === "alert" ? alerts : props.items;
  return (
    <>
      <dl className="kpi-rise mt-5 grid gap-3 sm:grid-cols-3">
        <Kpi label="Articles suivis" value={String(props.items.length)} />
        <Kpi alert={alerts.length > 0} label="À commander" value={String(alerts.length)} />
        <Kpi alert={props.items.some((item) => stockLevel(item) === "out")} label="En rupture" value={String(props.items.filter((item) => stockLevel(item) === "out").length)} />
      </dl>

      {alerts.length ? <OrderPanel items={alerts} /> : null}

      <section aria-labelledby="stock-items-title" className={`kpi-rise mt-5 ${panelClass} p-5 sm:p-6`}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-[17px] font-semibold tracking-[-0.02em] text-[var(--navy)]" id="stock-items-title">Articles</h2>
          <div aria-label="Filtrer les articles" className="flex gap-1.5" role="group">
            <button aria-pressed={filter === "all"} className={`${chipClass} ${filter === "all" ? "!border-[var(--navy)] !bg-[var(--navy)] !text-white" : ""}`} onClick={() => setFilter("all")} type="button">Tous ({props.items.length})</button>
            <button aria-pressed={filter === "alert"} className={`${chipClass} ${filter === "alert" ? "!border-[var(--navy)] !bg-[var(--navy)] !text-white" : ""}`} onClick={() => setFilter("alert")} type="button">À commander ({alerts.length})</button>
          </div>
        </div>
        {shown.length ? (
          <ul className="mt-4 space-y-2">{shown.map((item) => <ItemRow item={item} key={item.id} {...props} />)}</ul>
        ) : <div className="mt-4"><EmptyNote text={filter === "alert" ? "Aucun article sous son seuil d’alerte." : "Aucun article suivi pour le moment. Ajoutez vos consommables ci-dessous."} /></div>}
        <Composer label="Ajouter un article"><ItemForm action={props.createAction} key={props.formToken} mode="create" /></Composer>
      </section>

      <section aria-labelledby="stock-history-title" className={`kpi-rise mt-5 ${panelClass} p-5 sm:p-6`}>
        <h2 className="text-[17px] font-semibold tracking-[-0.02em] text-[var(--navy)]" id="stock-history-title">Derniers mouvements</h2>
        {props.movements.length ? (
          <ul className="mt-4 divide-y divide-[#eef3f8]">
            {props.movements.map((movement) => (
              <li className="flex flex-wrap items-center justify-between gap-2 py-2.5 text-sm" key={movement.id}>
                <span className="min-w-0"><span className="font-semibold text-[var(--navy)]">{movement.itemName}</span><span className="ml-2 text-xs text-slate-500">{stockMovementLabels[movement.kind]}{movement.reason ? ` · ${movement.reason}` : ""}</span></span>
                <span className="flex items-center gap-3 text-xs text-slate-500">
                  <span className={`metric-number text-sm font-semibold ${movement.delta > 0 ? "text-[#0e7c6d]" : "text-[#b4541a]"}`}>{movement.delta > 0 ? "+" : "−"}{quantityFormat.format(Math.abs(movement.delta))}</span>
                  <span>→ {quantityFormat.format(movement.quantityAfter)} {movement.unit}</span>
                  <span>{dateTime.format(new Date(movement.createdAt))}</span>
                </span>
              </li>
            ))}
          </ul>
        ) : <div className="mt-4"><EmptyNote text="Aucun mouvement enregistré." /></div>}
      </section>
    </>
  );
}

function Kpi({ label, value, alert = false }: { label: string; value: string; alert?: boolean }) {
  return <div className={`${panelClass} px-5 py-4`}><dt className="text-xs font-medium text-slate-500">{label}</dt><dd className={`metric-number mt-1 text-2xl font-semibold tracking-[-0.02em] ${alert ? "text-[#b4541a]" : "text-[var(--navy)]"}`}>{value}</dd></div>;
}

function OrderPanel({ items }: { items: StockItem[] }) {
  const [copied, setCopied] = useState(false);
  const list = buildOrderList(items);
  return (
    <section aria-labelledby="stock-order-title" className="kpi-rise mt-5 rounded-[20px] border border-amber-200 bg-amber-50/70 p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-[17px] font-semibold tracking-[-0.02em] text-amber-950" id="stock-order-title">Liste de commande</h2>
          <p className="mt-0.5 text-xs text-amber-900/80">Articles au niveau ou sous leur seuil d’alerte, quantités proposées pour revenir à deux fois le seuil.</p>
        </div>
        <button className={`${ghostButton} border-amber-300 text-amber-900`} onClick={async () => { try { await navigator.clipboard.writeText(list); setCopied(true); window.setTimeout(() => setCopied(false), 2500); } catch { setCopied(false); } }} type="button">{copied ? "✓ Copiée" : "Copier la liste"}</button>
      </div>
      <pre className="mt-3 overflow-x-auto rounded-[12px] bg-white/80 p-3 font-sans text-sm leading-6 whitespace-pre-wrap text-slate-800">{list}</pre>
    </section>
  );
}

function ItemRow({ item, canArchive, updateAction, movementAction, archiveAction }: Props & { item: StockItem }) {
  const [panel, setPanel] = useState<StockMovementKind | "edit" | null>(null);
  const level = stockLevel(item);
  const toggle = (next: StockMovementKind | "edit") => setPanel((current) => (current === next ? null : next));
  return (
    <li className={`rounded-[14px] border bg-white ${level === "out" ? "border-red-200" : level === "low" ? "border-amber-200" : "border-[#e3ebf3]"}`}>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-[var(--navy)]">{item.name}</p>
          <p className="text-xs text-slate-500">{stockCategoryLabels[item.category]}{item.supplier ? ` · ${item.supplier}` : ""} · seuil : {quantityFormat.format(item.alertThreshold)}</p>
        </div>
        <p className="text-right"><span className={`metric-number text-lg font-semibold ${level === "ok" ? "text-[var(--navy)]" : level === "low" ? "text-amber-700" : "text-red-700"}`}>{quantityFormat.format(item.quantity)}</span> <span className="text-xs text-slate-500">{item.unit}</span></p>
        <Badge tone={levelTone[level]}>{levelLabel[level]}{level !== "ok" ? ` · +${suggestedOrderQuantity(item)}` : ""}</Badge>
        <div className="flex flex-wrap gap-1.5">
          {(["in", "out", "adjustment"] as const).map((kind) => (
            <button aria-expanded={panel === kind} className={`inline-flex min-h-9 items-center rounded-[9px] border px-2.5 text-xs font-semibold transition-colors ${panel === kind ? "border-[var(--navy)] bg-[var(--navy)] text-white" : "border-[#d6e3f0] bg-white text-[var(--navy)] hover:border-[var(--blue)]"}`} key={kind} onClick={() => toggle(kind)} type="button">{kind === "in" ? "+ Entrée" : kind === "out" ? "− Sortie" : "Inventaire"}</button>
          ))}
          <button aria-expanded={panel === "edit"} className={`inline-flex min-h-9 items-center rounded-[9px] px-2.5 text-xs font-semibold hover:bg-slate-100 ${panel === "edit" ? "bg-slate-100 text-[var(--navy)]" : "text-slate-500"}`} onClick={() => toggle("edit")} type="button">Modifier</button>
        </div>
      </div>
      {panel && panel !== "edit" ? <div className="border-t border-[#eef3f8] bg-[#f7fafd] px-4 py-3"><MovementForm action={movementAction.bind(null, item.id)} item={item} kind={panel} key={panel} onDone={() => setPanel(null)} /></div> : null}
      {panel === "edit" ? (
        <div className="border-t border-[#eef3f8] bg-[#f7fafd] px-4 py-3">
          <ItemForm action={updateAction.bind(null, item.id)} item={item} mode="edit" />
          {canArchive ? (
            <form action={archiveAction.bind(null, item.id)} className="mt-3 border-t border-[#e3ebf3] pt-3" onSubmit={(event) => { if (!confirm(`Archiver « ${item.name} » ? Il ne sera plus suivi.`)) event.preventDefault(); }}>
              <PendingSubmitButton className="text-xs font-semibold text-red-700 hover:underline disabled:opacity-60" pendingLabel="Archivage…">Archiver cet article</PendingSubmitButton>
            </form>
          ) : null}
        </div>
      ) : null}
    </li>
  );
}

function MovementForm({ action, item, kind, onDone }: { action: Action; item: StockItem; kind: StockMovementKind; onDone: () => void }) {
  const [state, formAction, pending] = useActionState(async (previous: StockActionState, formData: FormData) => {
    const result = await action(previous, formData);
    if (result.success) onDone();
    return result;
  }, initial);
  return (
    <form action={formAction} className="flex flex-wrap items-end gap-2" onSubmit={submitKeepingValues(formAction)}>
      <input name="kind" type="hidden" value={kind} />
      <FormField className="block text-xs font-medium text-slate-600" error={state.fieldErrors.quantity} label={kind === "adjustment" ? `Quantité comptée (${item.unit})` : `Quantité (${item.unit})`}>
        <input autoFocus className={`${fieldClass} w-36`} inputMode="decimal" name="quantity" placeholder={kind === "adjustment" ? quantityFormat.format(item.quantity) : "0"} required />
      </FormField>
      <FormField className="block min-w-48 flex-1 text-xs font-medium text-slate-600" error={state.fieldErrors.reason} label={kind === "adjustment" ? "Motif (obligatoire)" : "Motif (facultatif)"}>
        <input className={fieldClass} maxLength={300} name="reason" placeholder={kind === "in" ? "Ex. Commande reçue" : kind === "out" ? "Ex. Utilisé en salle 1" : "Ex. Inventaire mensuel"} required={kind === "adjustment"} />
      </FormField>
      <button className={`${primaryButton} min-h-11`} disabled={pending} type="submit">{pending ? "Enregistrement…" : `Enregistrer ${kind === "in" ? "l’entrée" : kind === "out" ? "la sortie" : "l’inventaire"}`}</button>
      {state.message && !state.success ? <p className="w-full text-xs text-red-700" role="alert">{state.message}</p> : null}
    </form>
  );
}

function ItemForm({ action, mode, item }: { action: Action; mode: "create" | "edit"; item?: StockItem }) {
  const [state, formAction, pending] = useActionState(action, initial);
  return (
    <form action={formAction} className="grid gap-3 sm:grid-cols-2" onSubmit={submitKeepingValues(formAction)}>
      <FormField className="block text-xs font-medium text-slate-600 sm:col-span-2" error={state.fieldErrors.name} label="Nom de l’article">
        <input className={fieldClass} defaultValue={item?.name} maxLength={120} name="name" placeholder="Ex. Gants nitrile taille M" required />
      </FormField>
      <FormField className="block text-xs font-medium text-slate-600" error={state.fieldErrors.category} label="Catégorie">
        <select className={fieldClass} defaultValue={item?.category ?? "consumable"} name="category">{stockCategories.map((category) => <option key={category} value={category}>{stockCategoryLabels[category]}</option>)}</select>
      </FormField>
      <FormField className="block text-xs font-medium text-slate-600" error={state.fieldErrors.unit} label="Unité">
        <input className={fieldClass} defaultValue={item?.unit} maxLength={30} name="unit" placeholder="Ex. boîte, carpule, paquet" required />
      </FormField>
      {mode === "create" ? (
        <FormField className="block text-xs font-medium text-slate-600" error={state.fieldErrors.quantity} label="Quantité en stock">
          <input className={fieldClass} defaultValue="0" inputMode="decimal" name="quantity" required />
        </FormField>
      ) : null}
      <FormField className="block text-xs font-medium text-slate-600" error={state.fieldErrors.alertThreshold} label="Seuil d’alerte">
        <input className={fieldClass} defaultValue={item ? String(item.alertThreshold) : ""} inputMode="decimal" name="alertThreshold" placeholder="Ex. 5" required />
      </FormField>
      <FormField className="block text-xs font-medium text-slate-600" error={state.fieldErrors.supplier} label="Fournisseur (facultatif)">
        <input className={fieldClass} defaultValue={item?.supplier ?? ""} maxLength={120} name="supplier" />
      </FormField>
      <FormField className="block text-xs font-medium text-slate-600 sm:col-span-2" error={state.fieldErrors.notes} label="Note (facultatif)">
        <input className={fieldClass} defaultValue={item?.notes ?? ""} maxLength={1000} name="notes" />
      </FormField>
      <div className="sm:col-span-2"><FormMessage state={state} /></div>
      <button className={`${primaryButton} sm:col-span-2`} disabled={pending} type="submit">{pending ? "Enregistrement…" : mode === "create" ? "Ajouter l’article" : "Enregistrer les modifications"}</button>
    </form>
  );
}
