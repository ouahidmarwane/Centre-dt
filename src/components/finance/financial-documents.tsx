"use client";

import Link from "next/link";
import { useActionState, useState } from "react";

import type { FinancialDocumentActionState } from "@/app/(dashboard)/patients/[id]/financial-document-actions";
import type { InterventionView, Payment } from "@/lib/finance/data";
import type { InvoiceSummary, ReceiptSummary } from "@/lib/financial-documents/data";
import { paymentMethodLabels } from "@/lib/finance/validation";
import type { AppRole } from "@/lib/permissions";

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
const input = "mt-1 w-full rounded-md border border-[var(--border)] bg-white px-3 py-2 text-sm";

export function FinancialDocuments(props: Props) {
  const claimed = new Set(props.activeInvoicedInterventionIds);
  const eligible = props.interventions.filter((item) => item.status === "performed" && !claimed.has(item.id));
  const receiptByPayment = new Map(props.receipts.map((receipt) => [receipt.payment_id, receipt]));
  return <section className="mt-6 rounded-lg border border-[var(--border)] bg-white p-5 sm:p-6" aria-labelledby="financial-documents-title">
    <div>
      <h2 className="font-semibold text-slate-900" id="financial-documents-title">Factures et reçus</h2>
      <p className="mt-1 text-sm text-[var(--muted)]">Documents historiques en MAD, générés depuis les interventions et paiements enregistrés.</p>
    </div>
    <div className="mt-5 grid gap-6 xl:grid-cols-2">
      <div>
        <h3 className="font-semibold text-slate-900">Factures</h3>
        <div className="mt-3 space-y-3">
          {props.invoices.map((invoice) => <InvoiceCard key={invoice.id} invoice={invoice} patientId={props.patientId} role={props.role} voidAction={props.voidInvoiceAction.bind(null, invoice.id)} />)}
          {!props.invoices.length ? <Empty text="Aucune facture émise." /> : null}
        </div>
        {props.role === "doctor" && props.patientActive
          ? <InvoiceForm action={props.createInvoiceAction} eligible={eligible} token={props.invoiceToken} />
          : props.role === "doctor" ? <ReadOnly /> : <p className="mt-4 text-sm text-[var(--muted)]">L’émission et l’annulation des factures sont réservées au docteur.</p>}
      </div>
      <div>
        <h3 className="font-semibold text-slate-900">Reçus de paiement</h3>
        <div className="mt-3 space-y-3">
          {props.payments.map((payment) => <PaymentReceiptCard
            action={props.createReceiptAction.bind(null, payment.id, props.receiptTokens[payment.id] ?? "")}
            key={payment.id}
            patientActive={props.patientActive}
            patientId={props.patientId}
            payment={payment}
            receipt={receiptByPayment.get(payment.id)}
          />)}
          {!props.payments.length ? <Empty text="Aucun paiement pouvant donner lieu à un reçu." /> : null}
        </div>
      </div>
    </div>
  </section>;
}

function InvoiceForm({ action, eligible, token }: { action: Action; eligible: InterventionView[]; token: string }) {
  const [state, formAction, pending] = useActionState(action, initial);
  const [selected, setSelected] = useState<string[]>([]);
  const displayedTotal = eligible.filter((item) => selected.includes(item.id)).reduce((sum, item) => sum + item.amount_due, 0);
  return <form action={formAction} className="mt-5 rounded-md border border-dashed border-slate-300 bg-slate-50 p-4">
    <h4 className="text-sm font-semibold">Émettre une facture</h4>
    <p className="mt-1 text-xs text-[var(--muted)]">Le total affiché est indicatif; PostgreSQL relit et additionne les montants de référence lors de l’émission.</p>
    <input name="idempotencyKey" type="hidden" value={token} />
    <div className="mt-3 space-y-2">
      {eligible.map((item) => <label className="flex min-h-11 items-start gap-2 rounded border border-slate-200 bg-white p-3 text-sm" key={item.id}>
        <input
          className="mt-1"
          name="interventionIds"
          onChange={(event) => setSelected((current) => event.target.checked ? [...current, item.id] : current.filter((id) => id !== item.id))}
          type="checkbox"
          value={item.id}
        />
        <span className="min-w-0 flex-1"><span className="font-medium">{item.nature}</span><span className="block text-xs text-[var(--muted)]">{item.performed_at}</span></span>
        <span className="font-semibold">{money.format(item.amount_due)}</span>
      </label>)}
      {!eligible.length ? <Empty text="Aucune intervention réalisée admissible. Une intervention redevient admissible si sa facture est annulée." /> : null}
    </div>
    <p className="mt-3 text-sm font-semibold">Total indicatif sélectionné : {money.format(displayedTotal)}</p>
    <Message state={state} />
    <button className="mt-3 min-h-11 rounded-md bg-[var(--brand)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-60" disabled={pending || selected.length === 0} type="submit">{pending ? "Émission…" : "Émettre la facture"}</button>
  </form>;
}

function InvoiceCard({ invoice, patientId, role, voidAction }: { invoice: InvoiceSummary; patientId: string; role: AppRole; voidAction: Action }) {
  const [state, formAction, pending] = useActionState(voidAction, initial);
  return <article className="rounded-md border border-slate-200 p-4">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div><p className="font-semibold">{invoice.invoice_number}</p><p className="mt-1 text-sm text-[var(--muted)]">{date.format(new Date(invoice.issued_at))} · {money.format(invoice.total)}</p></div>
      <span className={`text-xs font-semibold ${invoice.status === "active" ? "text-emerald-700" : "text-slate-600"}`}>{invoice.status === "active" ? "Active" : "Annulée"}</span>
    </div>
    {invoice.status === "voided" ? <p className="mt-2 text-sm text-slate-600">Motif : {invoice.void_reason}</p> : null}
    <Link className="mt-3 inline-flex min-h-11 items-center text-sm font-semibold text-[var(--brand-strong)]" href={`/patients/${patientId}/invoices/${invoice.id}/print`}>Imprimer la facture</Link>
    {role === "doctor" && invoice.status === "active" ? <form action={formAction} className="mt-3" onSubmit={(event) => { if (!confirm("Annuler cette facture ? Cette action n’efface pas la facture.")) event.preventDefault(); }}>
      <label className="text-sm font-medium">Motif d’annulation<input aria-describedby={state.fieldErrors.reason ? `invoice-${invoice.id}-reason-error` : undefined} aria-invalid={Boolean(state.fieldErrors.reason)} className={input} maxLength={500} minLength={5} name="reason" required /></label>
      {state.fieldErrors.reason ? <p className="mt-1 text-sm text-red-700" id={`invoice-${invoice.id}-reason-error`}>{state.fieldErrors.reason}</p> : null}
      <p className="mt-2 text-xs text-[var(--muted)]">Cette action n’efface pas la facture et son numéro ne sera jamais réutilisé.</p>
      <Message state={state} />
      <button className="mt-2 min-h-11 rounded-md px-2 text-sm font-semibold text-red-700 disabled:opacity-60" disabled={pending} type="submit">{pending ? "Annulation…" : "Annuler la facture"}</button>
    </form> : null}
  </article>;
}

function PaymentReceiptCard({ action, patientActive, patientId, payment, receipt }: { action: Action; patientActive: boolean; patientId: string; payment: Payment; receipt?: ReceiptSummary }) {
  const [state, formAction, pending] = useActionState(action, initial);
  return <article className="rounded-md border border-slate-200 p-4">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div><p className="font-semibold">{receipt?.receipt_number ?? `Paiement du ${date.format(new Date(payment.received_at))}`}</p><p className="mt-1 text-sm text-[var(--muted)]">{money.format(receipt?.amount_snapshot ?? payment.amount)} · {paymentMethodLabels[receipt?.payment_method_snapshot ?? payment.method]}</p></div>
      <span className={`text-xs font-semibold ${payment.status === "received" ? "text-emerald-700" : "text-red-700"}`}>{payment.status === "received" ? "Reçu" : "Paiement extourné"}</span>
    </div>
    {receipt ? <Link className="mt-3 inline-flex min-h-11 items-center text-sm font-semibold text-[var(--brand-strong)]" href={`/patients/${patientId}/receipts/${receipt.id}/print`}>Imprimer le reçu</Link> : payment.status === "received" && patientActive ? <form action={formAction} className="mt-3"><Message state={state} /><button className="min-h-11 rounded-md px-2 text-sm font-semibold text-[var(--brand-strong)] disabled:opacity-60" disabled={pending} type="submit">{pending ? "Génération…" : "Générer le reçu"}</button></form> : <p className="mt-2 text-xs text-[var(--muted)]">Aucun nouveau reçu ne peut être émis pour ce paiement.</p>}
  </article>;
}

function Empty({ text }: { text: string }) { return <p className="rounded-md bg-slate-50 px-4 py-3 text-sm text-[var(--muted)]">{text}</p>; }
function ReadOnly() { return <p className="mt-4 rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">Lecture seule : aucune facture ni aucun reçu ne peut être émis pour un dossier archivé.</p>; }
function Message({ state }: { state: FinancialDocumentActionState }) { return state.message ? <p aria-live="polite" className={`mt-3 text-sm ${state.success ? "text-emerald-700" : "text-red-700"}`} role={state.success ? "status" : "alert"}>{state.message}</p> : null; }
