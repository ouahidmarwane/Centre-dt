"use client";

import Link from "next/link";
import { useActionState, useState } from "react";

import type { FinancialDocumentActionState } from "@/app/(dashboard)/patients/[id]/financial-document-actions";
import type { InterventionView, Payment } from "@/lib/finance/data";
import type { InvoiceSummary, ReceiptSummary } from "@/lib/financial-documents/data";
import { paymentMethodLabels } from "@/lib/finance/validation";
import type { AppRole } from "@/lib/permissions";

import { Badge, Composer, DangerDisclosure, dangerLink, EmptyNote, fieldClass, FormMessage, ghostButton, PanelHeading, panelClass, primaryButton, ReadOnlyNote } from "@/components/ui/panel-ui";

type Action = (state: FinancialDocumentActionState, formData: FormData) => Promise<FinancialDocumentActionState>;
type Props = {
  patientId: string;
  patientActive: boolean;
  role: AppRole;
  invoices: InvoiceSummary[];
  receipts: ReceiptSummary[];
  interventions: InterventionView[];
  payments: Payment[];
  activeInvoicedInterventionIds: string[];
  invoiceToken: string;
  receiptTokens: Record<string, string>;
  createInvoiceAction: Action;
  voidInvoiceAction: (invoiceId: string, state: FinancialDocumentActionState, formData: FormData) => Promise<FinancialDocumentActionState>;
  createReceiptAction: (paymentId: string, token: string, state: FinancialDocumentActionState, formData: FormData) => Promise<FinancialDocumentActionState>;
};

const initial: FinancialDocumentActionState = { success: false, message: null, fieldErrors: {} };
const money = new Intl.NumberFormat("fr-MA", { style: "currency", currency: "MAD", minimumFractionDigits: 2 });
const date = new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium", timeZone: "Africa/Casablanca" });

export function FinancialDocuments(props: Props) {
  const claimed = new Set(props.activeInvoicedInterventionIds);
  const eligible = props.interventions.filter((item) => item.status === "performed" && !claimed.has(item.id));
  const receiptByPayment = new Map(props.receipts.map((receipt) => [receipt.payment_id, receipt]));
  return <section className={`${panelClass} mt-5 p-5 sm:p-7`} aria-labelledby="financial-documents-title">
    <PanelHeading id="financial-documents-title" title="Factures et reçus" subtitle="Documents en MAD générés depuis les interventions et paiements enregistrés. Ils ne sont jamais modifiés après émission." />
    <div className="mt-5 grid gap-6 xl:grid-cols-2">
      <div>
        <h3 className="flex items-center gap-2 text-sm font-semibold text-[var(--navy)]">Factures <span className="rounded-md bg-[#eef3f8] px-1.5 text-xs text-slate-500">{props.invoices.length}</span></h3>
        <ul className="mt-3 space-y-2">
          {props.invoices.map((invoice) => <InvoiceCard key={invoice.id} invoice={invoice} patientId={props.patientId} role={props.role} voidAction={props.voidInvoiceAction.bind(null, invoice.id)} />)}
        </ul>
        {!props.invoices.length ? <EmptyNote text="Aucune facture émise." /> : null}
        {props.role === "doctor" && props.patientActive
          ? <Composer label="Émettre une facture"><InvoiceForm action={props.createInvoiceAction} eligible={eligible} token={props.invoiceToken} /></Composer>
          : props.role === "doctor" ? <ReadOnlyNote text="Lecture seule : aucune facture ni aucun reçu ne peut être émis pour un dossier archivé." /> : <p className="mt-4 text-xs text-slate-500">L’émission et l’annulation des factures sont réservées au docteur.</p>}
      </div>
      <div>
        <h3 className="flex items-center gap-2 text-sm font-semibold text-[var(--navy)]">Reçus de paiement <span className="rounded-md bg-[#eef3f8] px-1.5 text-xs text-slate-500">{props.payments.length}</span></h3>
        <ul className="mt-3 space-y-2">
          {props.payments.map((payment) => <PaymentReceiptCard
            action={props.createReceiptAction.bind(null, payment.id, props.receiptTokens[payment.id] ?? "")}
            key={payment.id}
            patientActive={props.patientActive}
            patientId={props.patientId}
            payment={payment}
            receipt={receiptByPayment.get(payment.id)}
          />)}
        </ul>
        {!props.payments.length ? <EmptyNote text="Aucun paiement pouvant donner lieu à un reçu." /> : null}
      </div>
    </div>
  </section>;
}

function DocIcon({ tone }: { tone: "blue" | "green" | "slate" }) {
  const colors = { blue: "bg-[#eef6ff] text-[#0f5fc5]", green: "bg-[#e9f8f4] text-[#0e7c6d]", slate: "bg-slate-100 text-slate-400" };
  return <span aria-hidden="true" className={`grid size-10 shrink-0 place-items-center rounded-[10px] ${colors[tone]}`}><svg className="size-5" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" viewBox="0 0 24 24"><path d="M6 3h9l4 4v14H6z" /><path d="M14 3v5h5M9 13h7M9 17h5" /></svg></span>;
}

const printIcon = <svg aria-hidden="true" className="size-3.5" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24"><path d="M7 9V3h10v6M7 17H4v-7h16v7h-3" /><path d="M7 14h10v7H7z" /></svg>;

function InvoiceForm({ action, eligible, token }: { action: Action; eligible: InterventionView[]; token: string }) {
  const [state, formAction, pending] = useActionState(action, initial);
  const [selected, setSelected] = useState<string[]>([]);
  const displayedTotal = eligible.filter((item) => selected.includes(item.id)).reduce((sum, item) => sum + item.amount_due, 0);
  return <form action={formAction} className="mt-1">
    <p className="text-xs text-slate-500">Cochez les interventions à facturer. Le total est indicatif : il est recalculé par la base à l’émission.</p>
    <input name="idempotencyKey" type="hidden" value={token} />
    <div className="mt-3 space-y-1.5">
      {eligible.map((item) => <label className="flex min-h-12 cursor-pointer items-center gap-3 rounded-[12px] border border-[#e3ebf3] bg-white px-3 py-2.5 text-sm transition-all hover:border-[#bfd3e8] has-[:checked]:border-[var(--blue)] has-[:checked]:bg-[#f3f8ff] has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-[var(--blue)]" key={item.id}>
        <input
          className="size-4 accent-[var(--blue)]"
          name="interventionIds"
          onChange={(event) => setSelected((current) => event.target.checked ? [...current, item.id] : current.filter((id) => id !== item.id))}
          type="checkbox"
          value={item.id}
        />
        <span className="min-w-0 flex-1"><span className="block truncate font-semibold text-[var(--navy)]">{item.nature}</span><span className="block text-xs text-slate-500">{item.performed_at}</span></span>
        <span className="metric-number font-semibold text-[var(--navy)]">{money.format(item.amount_due)}</span>
      </label>)}
      {!eligible.length ? <EmptyNote text="Aucune intervention réalisée admissible. Une intervention redevient admissible si sa facture est annulée." /> : null}
    </div>
    <div className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-[12px] bg-[#f5f8fb] px-4 py-3">
      <span className="text-xs text-slate-500">{selected.length} intervention{selected.length > 1 ? "s" : ""} · total indicatif</span>
      <span className="metric-number text-lg font-semibold text-[var(--navy)]">{money.format(displayedTotal)}</span>
    </div>
    <FormMessage state={state} />
    <button className={`${primaryButton} mt-3`} disabled={pending || selected.length === 0} type="submit">{pending ? "Émission…" : "Émettre la facture"}</button>
  </form>;
}

function InvoiceCard({ invoice, patientId, role, voidAction }: { invoice: InvoiceSummary; patientId: string; role: AppRole; voidAction: Action }) {
  const [state, formAction, pending] = useActionState(voidAction, initial);
  const voided = invoice.status !== "active";
  return <li className="rounded-[14px] border border-[#e3ebf3] bg-white px-3.5 py-3">
    <div className="flex items-center gap-3">
      <DocIcon tone={voided ? "slate" : "blue"} />
      <div className="min-w-0 flex-1">
        <p className={`truncate text-sm font-semibold ${voided ? "text-slate-400 line-through" : "text-[var(--navy)]"}`}>{invoice.invoice_number}</p>
        <p className="mt-0.5 text-xs text-slate-500">{date.format(new Date(invoice.issued_at))} · <span className="metric-number">{money.format(invoice.total)}</span></p>
      </div>
      <Badge tone={voided ? "slate" : "green"}>{voided ? "Annulée" : "Active"}</Badge>
    </div>
    {voided ? <p className="mt-2 text-xs text-slate-500">Motif d’annulation : {invoice.void_reason}</p> : null}
    <div className="mt-2.5 flex flex-wrap items-start gap-2">
      <Link className={ghostButton} href={`/patients/${patientId}/invoices/${invoice.id}/print`}>{printIcon}Imprimer la facture</Link>
      {role === "doctor" && !voided ? <DangerDisclosure label="Annuler la facture…"><form action={formAction} onSubmit={(event) => { if (!confirm("Annuler cette facture ? Cette action n’efface pas la facture.")) event.preventDefault(); }}>
        <label className="block text-sm font-medium text-slate-700">Motif d’annulation<input aria-describedby={state.fieldErrors.reason ? `invoice-${invoice.id}-reason-error` : undefined} aria-invalid={Boolean(state.fieldErrors.reason)} className={fieldClass} maxLength={500} minLength={5} name="reason" required /></label>
        {state.fieldErrors.reason ? <p className="mt-1 text-sm text-red-700" id={`invoice-${invoice.id}-reason-error`}>{state.fieldErrors.reason}</p> : null}
        <p className="mt-2 text-xs text-slate-500">La facture n’est pas effacée et son numéro ne sera jamais réutilisé.</p>
        <FormMessage state={state} />
        <button className={`${dangerLink} mt-2 border border-red-200 bg-white`} disabled={pending} type="submit">{pending ? "Annulation…" : "Confirmer l’annulation"}</button>
      </form></DangerDisclosure> : null}
    </div>
  </li>;
}

function PaymentReceiptCard({ action, patientActive, patientId, payment, receipt }: { action: Action; patientActive: boolean; patientId: string; payment: Payment; receipt?: ReceiptSummary }) {
  const [state, formAction, pending] = useActionState(action, initial);
  const received = payment.status === "received";
  return <li className="rounded-[14px] border border-[#e3ebf3] bg-white px-3.5 py-3">
    <div className="flex items-center gap-3">
      <DocIcon tone={received ? "green" : "slate"} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-[var(--navy)]">{receipt?.receipt_number ?? `Paiement du ${date.format(new Date(payment.received_at))}`}</p>
        <p className="mt-0.5 text-xs text-slate-500"><span className="metric-number">{money.format(receipt?.amount_snapshot ?? payment.amount)}</span> · {paymentMethodLabels[receipt?.payment_method_snapshot ?? payment.method]}</p>
      </div>
      <Badge tone={received ? "green" : "red"}>{received ? "Reçu" : "Paiement extourné"}</Badge>
    </div>
    <div className="mt-2.5">
      {receipt
        ? <Link className={ghostButton} href={`/patients/${patientId}/receipts/${receipt.id}/print`}>{printIcon}Imprimer le reçu</Link>
        : received && patientActive
          ? <form action={formAction}><FormMessage state={state} /><button className={`${ghostButton} border-[var(--blue)] text-[var(--blue-deep)]`} disabled={pending} type="submit">{pending ? "Génération…" : "+ Générer le reçu"}</button></form>
          : <p className="text-xs text-slate-500">Aucun nouveau reçu ne peut être émis pour ce paiement.</p>}
    </div>
  </li>;
}
