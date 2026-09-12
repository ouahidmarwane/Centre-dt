import { permanentTeeth, type PermanentTooth } from "../odontogram/validation.ts";

export const interventionStatuses = ["planned", "performed"] as const;
export const paymentMethods = ["cash", "card", "bank_transfer", "cheque", "other"] as const;
export type InterventionStatusInput = (typeof interventionStatuses)[number];
export type PaymentMethodInput = (typeof paymentMethods)[number];

export const paymentMethodLabels: Record<PaymentMethodInput, string> = {
  cash: "Espèces", card: "Carte", bank_transfer: "Virement bancaire", cheque: "Chèque", other: "Autre",
};

export type InterventionInput = {
  performedAt: string; nature: string; amountDue: string; status: InterventionStatusInput;
  notes: string | null; teeth: PermanentTooth[]; findingIds: string[];
};
export type PaymentInput = {
  amount: string; method: PaymentMethodInput; receivedAt: string; reference: string | null;
  notes: string | null; idempotencyKey: string;
};

export type FinanceField = "performedAt" | "nature" | "amountDue" | "status" | "notes" | "teeth" | "findingIds" | "amount" | "method" | "receivedAt" | "reference" | "idempotencyKey" | "reason";
type Result<T> = { success: true; data: T } | { success: false; fieldErrors: Partial<Record<FinanceField, string>> };

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const moneyPattern = /^(?:0|[1-9]\d{0,9})(?:\.\d{1,2})?$/;
const text = (form: FormData, key: string) => { const value = form.get(key); return typeof value === "string" ? value.trim() : ""; };

export function isFinanceId(value: unknown): value is string { return typeof value === "string" && uuidPattern.test(value); }
export function isMoney(value: string, allowZero: boolean) {
  if (!moneyPattern.test(value)) return false;
  const [whole, fraction = ""] = value.split(".");
  const cents = Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
  return cents < 1_000_000_000_000 && (allowZero || cents > 0);
}

function validDate(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(new Date(`${value}T00:00:00Z`).valueOf());
}

export function validateInterventionForm(form: FormData, now = new Date()): Result<InterventionInput> {
  const performedAt=text(form,"performedAt"), nature=text(form,"nature"), amountDue=text(form,"amountDue"), status=text(form,"status"), notes=text(form,"notes");
  const teethRaw=form.getAll("teeth"), findingsRaw=form.getAll("findingIds");
  const errors: Partial<Record<FinanceField,string>>={};
  if (!validDate(performedAt)) errors.performedAt="Date invalide.";
  else if (status === "performed" && performedAt > now.toISOString().slice(0,10)) errors.performedAt="Une intervention réalisée ne peut pas être future.";
  if (!nature || nature.length>160) errors.nature="La nature doit contenir entre 1 et 160 caractères.";
  if (!isMoney(amountDue,true)) errors.amountDue="Montant MAD invalide (deux décimales maximum).";
  if (!interventionStatuses.includes(status as InterventionStatusInput)) errors.status="Statut invalide.";
  if (notes.length>4000) errors.notes="Les notes sont limitées à 4 000 caractères.";
  const teeth=teethRaw.map(Number);
  if (teethRaw.some(v=>typeof v!=="string") || teeth.some(v=>!permanentTeeth.includes(v as PermanentTooth)) || new Set(teeth).size!==teeth.length) errors.teeth="Sélection de dents invalide.";
  const findingIds=findingsRaw.filter((v):v is string=>typeof v==="string");
  if (findingIds.length!==findingsRaw.length || findingIds.some(v=>!uuidPattern.test(v)) || new Set(findingIds).size!==findingIds.length) errors.findingIds="Sélection de constatations invalide.";
  if (Object.keys(errors).length) return {success:false,fieldErrors:errors};
  return {success:true,data:{performedAt,nature,amountDue,status:status as InterventionStatusInput,notes:notes||null,teeth:teeth as PermanentTooth[],findingIds}};
}

export function validatePaymentForm(form: FormData, now = new Date()): Result<PaymentInput> {
  const amount=text(form,"amount"), method=text(form,"method"), receivedAt=text(form,"receivedAt"), reference=text(form,"reference"), notes=text(form,"notes"), idempotencyKey=text(form,"idempotencyKey");
  const errors: Partial<Record<FinanceField,string>>={};
  if (!isMoney(amount,false)) errors.amount="Montant MAD invalide et strictement positif.";
  if (!paymentMethods.includes(method as PaymentMethodInput)) errors.method="Mode de paiement invalide.";
  const parsed=new Date(receivedAt);
  if (!receivedAt || Number.isNaN(parsed.valueOf()) || parsed>now) errors.receivedAt="Date de réception invalide.";
  if (reference.length>160) errors.reference="La référence est limitée à 160 caractères.";
  if (notes.length>2000) errors.notes="La note est limitée à 2 000 caractères.";
  if (!uuidPattern.test(idempotencyKey)) errors.idempotencyKey="Jeton de paiement invalide.";
  if (Object.keys(errors).length) return {success:false,fieldErrors:errors};
  return {success:true,data:{amount,method:method as PaymentMethodInput,receivedAt:parsed.toISOString(),reference:reference||null,notes:notes||null,idempotencyKey}};
}

export function validateReason(value: unknown): string | null {
  if (typeof value!=="string") return null;
  const reason=value.trim(); return reason.length>=5 && reason.length<=500 ? reason : null;
}
