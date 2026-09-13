import "server-only";

import { createClient } from "@/lib/supabase/server";
import type { Tables } from "@/types/database.types";

export type Invoice = Tables<"invoices">;
export type InvoiceItem = Tables<"invoice_items">;
export type PaymentReceipt = Tables<"payment_receipts">;

export type InvoiceSummary = Pick<
  Invoice,
  "id" | "invoice_number" | "issued_at" | "status" | "total" | "void_reason"
>;
export type ReceiptSummary = Pick<
  PaymentReceipt,
  | "id"
  | "payment_id"
  | "receipt_number"
  | "issued_at"
  | "amount_snapshot"
  | "payment_method_snapshot"
>;
export type InvoiceWithItems = Invoice & { items: InvoiceItem[] };
export type ReceiptWithPaymentState = PaymentReceipt & {
  paymentStatus: Tables<"payments">["status"];
  paymentReversedAt: string | null;
};

function unavailable(error: { message: string } | null) {
  if (error) throw new Error("FINANCIAL_DOCUMENTS_UNAVAILABLE");
}

export async function getPatientFinancialDocuments(patientId: string) {
  const supabase = await createClient();
  const [invoicesResult, receiptsResult] = await Promise.all([
    supabase
      .from("invoices")
      .select("id,invoice_number,issued_at,status,total,void_reason")
      .eq("patient_id", patientId)
      .order("issued_at", { ascending: false }),
    supabase
      .from("payment_receipts")
      .select("id,payment_id,receipt_number,issued_at,amount_snapshot,payment_method_snapshot")
      .eq("patient_id", patientId)
      .order("issued_at", { ascending: false }),
  ]);
  unavailable(invoicesResult.error);
  unavailable(receiptsResult.error);
  const invoices = invoicesResult.data ?? [];
  const invoiceIds = invoices.filter((invoice) => invoice.status === "active").map((invoice) => invoice.id);
  const itemsResult = invoiceIds.length
    ? await supabase.from("invoice_items").select("invoice_id,intervention_id").in("invoice_id", invoiceIds)
    : { data: [], error: null };
  unavailable(itemsResult.error);
  return {
    invoices,
    receipts: receiptsResult.data ?? [],
    activeInvoicedInterventionIds: (itemsResult.data ?? []).map((item) => item.intervention_id),
  };
}

export async function getInvoice(patientId: string, invoiceId: string): Promise<InvoiceWithItems | null> {
  const supabase = await createClient();
  const invoiceResult = await supabase
    .from("invoices")
    .select("*")
    .eq("id", invoiceId)
    .eq("patient_id", patientId)
    .maybeSingle();
  unavailable(invoiceResult.error);
  if (!invoiceResult.data) return null;
  const itemsResult = await supabase
    .from("invoice_items")
    .select("*")
    .eq("invoice_id", invoiceId)
    .order("position");
  unavailable(itemsResult.error);
  return { ...invoiceResult.data, items: itemsResult.data ?? [] };
}

export async function getReceipt(patientId: string, receiptId: string): Promise<ReceiptWithPaymentState | null> {
  const supabase = await createClient();
  const receiptResult = await supabase
    .from("payment_receipts")
    .select("*")
    .eq("id", receiptId)
    .eq("patient_id", patientId)
    .maybeSingle();
  unavailable(receiptResult.error);
  if (!receiptResult.data) return null;
  const paymentResult = await supabase
    .from("payments")
    .select("status,reversed_at")
    .eq("id", receiptResult.data.payment_id)
    .eq("patient_id", patientId)
    .maybeSingle();
  unavailable(paymentResult.error);
  if (!paymentResult.data) return null;
  return {
    ...receiptResult.data,
    paymentStatus: paymentResult.data.status,
    paymentReversedAt: paymentResult.data.reversed_at,
  };
}
