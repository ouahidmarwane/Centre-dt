import Link from "next/link";
import { notFound } from "next/navigation";

import { ClinicDocument } from "@/components/documents/clinic-document";
import { PrintButton } from "@/components/documents/print-button";
import { requirePermission } from "@/lib/auth/server";
import { getInvoice } from "@/lib/financial-documents/data";
import { isFinancialDocumentId } from "@/lib/financial-documents/validation";
import { isPatientId } from "@/lib/patients/validation";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const date = new Intl.DateTimeFormat("fr-FR", { dateStyle: "long", timeZone: "Africa/Casablanca" });
const money = new Intl.NumberFormat("fr-MA", { style: "currency", currency: "MAD", minimumFractionDigits: 2 });

export default async function InvoicePrintPage({ params }: { params: Promise<{ id: string; invoiceId: string }> }) {
  await requirePermission("invoices.print");
  const { id, invoiceId } = await params;
  if (!isPatientId(id) || !isFinancialDocumentId(invoiceId)) notFound();
  const invoice = await getInvoice(id, invoiceId);
  if (!invoice) notFound();
  return <div className="document-page">
    <div className="print:hidden mx-auto mb-4 flex max-w-[210mm] items-center justify-between gap-3"><Link className="inline-flex min-h-11 items-center text-sm font-semibold text-[var(--brand-strong)]" href={`/patients/${id}`}>← Retour au patient</Link><PrintButton /></div>
    <ClinicDocument
      showLogo
      documentLabel="Document financier"
      footerText="Document financier interne établi en MAD à partir des données sécurisées du cabinet. Aucune certification fiscale n’est revendiquée."
      subtitle={`N° ${invoice.invoice_number} · Émise le ${date.format(new Date(invoice.issued_at))}`}
      title="Facture"
      voided={invoice.status === "voided"}
    >
      <section className="grid gap-2 border-b border-slate-300 pb-5 sm:grid-cols-2">
        <p><strong>Patient :</strong> {invoice.patient_first_name_snapshot} {invoice.patient_last_name_snapshot}</p>
        <p><strong>Émise par :</strong> {invoice.issuer_name_snapshot}</p>
        {invoice.patient_address_snapshot ? <p className="sm:col-span-2"><strong>Adresse :</strong> {invoice.patient_address_snapshot}</p> : null}
      </section>
      <table className="mt-7 w-full border-collapse text-left text-sm">
        <thead><tr className="border-b-2 border-slate-800"><th className="py-2">Description</th><th className="py-2 text-center">Qté</th><th className="py-2 text-right">Prix unitaire</th><th className="py-2 text-right">Total</th></tr></thead>
        <tbody>{invoice.items.map((item) => <tr className="break-inside-avoid border-b border-slate-200" key={item.id}><td className="py-3 pr-3">{item.description_snapshot}</td><td className="py-3 text-center">{item.quantity}</td><td className="py-3 text-right">{money.format(item.unit_amount)}</td><td className="py-3 text-right font-medium">{money.format(item.line_total)}</td></tr>)}</tbody>
        <tfoot><tr><th className="pt-5 text-right" colSpan={3}>Total</th><th className="pt-5 text-right text-lg">{money.format(invoice.total)}</th></tr></tfoot>
      </table>
      <p className="mt-3 text-right text-xs text-slate-600">Montants exprimés en MAD.</p>
      {invoice.status === "voided" ? <p className="mt-6 border border-slate-500 p-3 font-semibold">Facture annulée : {invoice.void_reason}</p> : null}
    </ClinicDocument>
  </div>;
}
