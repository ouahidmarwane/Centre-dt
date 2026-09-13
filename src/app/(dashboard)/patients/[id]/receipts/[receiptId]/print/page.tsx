import Link from "next/link";
import { notFound } from "next/navigation";

import { ClinicDocument } from "@/components/documents/clinic-document";
import { PrintButton } from "@/components/documents/print-button";
import { requirePermission } from "@/lib/auth/server";
import { getReceipt } from "@/lib/financial-documents/data";
import { isFinancialDocumentId } from "@/lib/financial-documents/validation";
import { paymentMethodLabels } from "@/lib/finance/validation";
import { isPatientId } from "@/lib/patients/validation";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const date = new Intl.DateTimeFormat("fr-FR", { dateStyle: "long", timeStyle: "short", timeZone: "Africa/Casablanca" });
const money = new Intl.NumberFormat("fr-MA", { style: "currency", currency: "MAD", minimumFractionDigits: 2 });

export default async function ReceiptPrintPage({ params }: { params: Promise<{ id: string; receiptId: string }> }) {
  await requirePermission("receipts.print");
  const { id, receiptId } = await params;
  if (!isPatientId(id) || !isFinancialDocumentId(receiptId)) notFound();
  const receipt = await getReceipt(id, receiptId);
  if (!receipt) notFound();
  const reversed = receipt.paymentStatus === "reversed";
  return <div className="document-page">
    <div className="print:hidden mx-auto mb-4 flex max-w-[210mm] items-center justify-between gap-3"><Link className="text-sm font-semibold text-[var(--brand-strong)]" href={`/patients/${id}`}>← Retour au patient</Link><PrintButton /></div>
    <ClinicDocument
      documentLabel="Document financier"
      footerText="Reçu historique d’un paiement enregistré par le cabinet. Ce document ne constitue pas une facture fiscale certifiée."
      subtitle={`N° ${receipt.receipt_number} · Émis le ${date.format(new Date(receipt.issued_at))}`}
      title="Reçu de paiement"
    >
      {reversed ? <div className="mb-7 border-4 border-double border-red-700 p-3 text-center text-xl font-black tracking-wide text-red-800">PAIEMENT EXTOURNÉ</div> : null}
      <section className="grid gap-3 sm:grid-cols-2">
        <p><strong>Patient :</strong> {receipt.patient_first_name_snapshot} {receipt.patient_last_name_snapshot}</p>
        <p><strong>Émis par :</strong> {receipt.issuer_name_snapshot}</p>
        {receipt.patient_address_snapshot ? <p className="sm:col-span-2"><strong>Adresse :</strong> {receipt.patient_address_snapshot}</p> : null}
      </section>
      <section className="mt-8 rounded border border-slate-300 p-5">
        <p className="text-sm text-slate-600">Montant reçu</p><p className="mt-1 text-3xl font-bold">{money.format(receipt.amount_snapshot)}</p>
        <dl className="mt-5 grid gap-3 text-sm sm:grid-cols-2"><div><dt className="font-semibold">Mode de paiement</dt><dd>{paymentMethodLabels[receipt.payment_method_snapshot]}</dd></div><div><dt className="font-semibold">Paiement reçu le</dt><dd>{date.format(new Date(receipt.payment_received_at_snapshot))}</dd></div></dl>
      </section>
      {reversed ? <p className="mt-6 border border-red-300 bg-red-50 p-3 font-semibold text-red-900">Le paiement associé a été extourné{receipt.paymentReversedAt ? ` le ${date.format(new Date(receipt.paymentReversedAt))}` : ""}. Le montant historique du reçu demeure inchangé.</p> : null}
    </ClinicDocument>
  </div>;
}
