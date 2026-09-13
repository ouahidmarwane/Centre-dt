const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type DocumentField = "interventionIds" | "idempotencyKey" | "reason";
export type InvoiceRequest = { interventionIds: string[]; idempotencyKey: string };
export type ValidationResult =
  | { success: true; data: InvoiceRequest }
  | { success: false; fieldErrors: Partial<Record<DocumentField, string>> };

export function isFinancialDocumentId(value: unknown): value is string {
  return typeof value === "string" && uuidPattern.test(value);
}

export function validateInvoiceRequest(formData: FormData): ValidationResult {
  const rawIds = formData.getAll("interventionIds");
  const interventionIds = rawIds.filter((value): value is string => typeof value === "string");
  const token = formData.get("idempotencyKey");
  const idempotencyKey = typeof token === "string" ? token.trim() : "";
  const fieldErrors: Partial<Record<DocumentField, string>> = {};
  if (
    interventionIds.length !== rawIds.length ||
    interventionIds.length < 1 ||
    interventionIds.length > 50 ||
    interventionIds.some((id) => !uuidPattern.test(id)) ||
    new Set(interventionIds).size !== interventionIds.length
  ) fieldErrors.interventionIds = "Sélectionnez entre 1 et 50 interventions admissibles.";
  if (!uuidPattern.test(idempotencyKey)) fieldErrors.idempotencyKey = "Jeton de demande invalide.";
  return Object.keys(fieldErrors).length
    ? { success: false, fieldErrors }
    : { success: true, data: { interventionIds, idempotencyKey } };
}

export function validateDocumentReason(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const reason = value.trim();
  return reason.length >= 5 && reason.length <= 500 ? reason : null;
}
