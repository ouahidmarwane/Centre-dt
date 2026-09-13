"use server";

import { revalidatePath } from "next/cache";

import { requirePermission } from "@/lib/auth/server";
import {
  isFinancialDocumentId,
  validateDocumentReason,
  validateInvoiceRequest,
  type DocumentField,
} from "@/lib/financial-documents/validation";
import { isPatientId } from "@/lib/patients/validation";
import { createClient } from "@/lib/supabase/server";

export type FinancialDocumentActionState = {
  success: boolean;
  message: string | null;
  documentId?: string;
  fieldErrors: Partial<Record<DocumentField, string>>;
};

const failure = (
  message: string,
  fieldErrors: FinancialDocumentActionState["fieldErrors"] = {},
): FinancialDocumentActionState => ({ success: false, message, fieldErrors });

export async function createInvoiceAction(
  patientId: string,
  _state: FinancialDocumentActionState,
  formData: FormData,
): Promise<FinancialDocumentActionState> {
  await requirePermission("invoices.create");
  if (!isPatientId(patientId)) return failure("Dossier patient invalide.");
  const validation = validateInvoiceRequest(formData);
  if (!validation.success) return failure("Vérifiez les interventions sélectionnées.", validation.fieldErrors);
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("create_invoice", {
    target_patient_id: patientId,
    target_intervention_ids: validation.data.interventionIds,
    target_idempotency_key: validation.data.idempotencyKey,
  });
  if (error || !data) return failure("La facture n’a pas pu être émise. Vérifiez les interventions admissibles.");
  revalidatePath(`/patients/${patientId}`);
  return { success: true, message: "Facture émise. Ses lignes et montants sont désormais immuables.", documentId: data, fieldErrors: {} };
}

export async function voidInvoiceAction(
  patientId: string,
  invoiceId: string,
  _state: FinancialDocumentActionState,
  formData: FormData,
): Promise<FinancialDocumentActionState> {
  await requirePermission("invoices.void");
  if (!isPatientId(patientId) || !isFinancialDocumentId(invoiceId)) return failure("Facture invalide.");
  const reason = validateDocumentReason(formData.get("reason"));
  if (!reason) return failure("Le motif doit contenir entre 5 et 500 caractères.", { reason: "Motif requis." });
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("void_invoice", {
    target_patient_id: patientId,
    target_invoice_id: invoiceId,
    target_reason: reason,
  });
  if (error || !data) return failure("Cette facture ne peut pas être annulée.");
  revalidatePath(`/patients/${patientId}`);
  revalidatePath(`/patients/${patientId}/invoices/${invoiceId}/print`);
  return { success: true, message: "Facture annulée; son numéro et son contenu restent conservés.", fieldErrors: {} };
}

export async function createReceiptAction(
  patientId: string,
  paymentId: string,
  idempotencyKey: string,
  _state: FinancialDocumentActionState,
  _formData: FormData,
): Promise<FinancialDocumentActionState> {
  void _state;
  void _formData;
  await requirePermission("receipts.create");
  if (
    !isPatientId(patientId) ||
    !isFinancialDocumentId(paymentId) ||
    !isFinancialDocumentId(idempotencyKey)
  ) return failure("Paiement ou demande invalide.");
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("create_payment_receipt", {
    target_patient_id: patientId,
    target_payment_id: paymentId,
    target_idempotency_key: idempotencyKey,
  });
  if (error || !data) return failure("Le reçu ne peut être généré que pour un paiement reçu et un dossier actif.");
  revalidatePath(`/patients/${patientId}`);
  return { success: true, message: "Reçu officiel généré.", documentId: data, fieldErrors: {} };
}
