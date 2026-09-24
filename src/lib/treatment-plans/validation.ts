import { isMoney } from "../finance/validation.ts";

export const treatmentCategories = ["implant", "orthodontics", "prosthesis", "endodontics", "periodontics", "other"] as const;
export type TreatmentCategory = (typeof treatmentCategories)[number];
export const treatmentCategoryLabels: Record<TreatmentCategory, string> = {
  implant: "Implantologie", orthodontics: "Orthodontie", prosthesis: "Prothèse", endodontics: "Endodontie", periodontics: "Parodontologie", other: "Autre",
};
export type TreatmentPlanStatus = "proposed" | "accepted" | "completed" | "cancelled";
export const treatmentStatusLabels: Record<TreatmentPlanStatus, string> = { proposed: "Devis proposé", accepted: "En cours", completed: "Terminé", cancelled: "Annulé" };
export const MAX_TREATMENT_STEPS = 30;

export type TreatmentStepInput = { label: string; amount: number; planned_date: string | null };
export type TreatmentPlanInput = { title: string; category: TreatmentCategory; notes: string | null; steps: TreatmentStepInput[]; idempotencyKey: string };
export type TreatmentPlanField = "title" | "category" | "notes" | "steps" | "idempotencyKey";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const isDate = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value) && new Date(`${value}T00:00:00Z`).toISOString().startsWith(value);

// Steps arrive as parallel stepLabel / stepAmount / stepDate fields; fully empty rows are ignored.
export function validateTreatmentPlanForm(form: FormData): { success: true; data: TreatmentPlanInput } | { success: false; fieldErrors: Partial<Record<TreatmentPlanField, string>> } {
  const text = (key: string) => { const value = form.get(key); return typeof value === "string" ? value.trim() : ""; };
  const list = (key: string) => form.getAll(key).map((value) => (typeof value === "string" ? value.trim() : ""));
  const title = text("title"), category = text("category"), notes = text("notes"), idempotencyKey = text("idempotencyKey");
  const labels = list("stepLabel"), amounts = list("stepAmount"), dates = list("stepDate");
  const fieldErrors: Partial<Record<TreatmentPlanField, string>> = {};
  if (!title || title.length > 120) fieldErrors.title = "Le titre doit contenir entre 1 et 120 caractères.";
  if (!treatmentCategories.includes(category as TreatmentCategory)) fieldErrors.category = "Choisissez une spécialité.";
  if (notes.length > 2000) fieldErrors.notes = "Les notes sont limitées à 2 000 caractères.";
  if (!uuidPattern.test(idempotencyKey)) fieldErrors.idempotencyKey = "Jeton de soumission invalide. Rechargez la page.";

  const steps: TreatmentStepInput[] = [];
  const rows = Math.max(labels.length, amounts.length, dates.length);
  for (let index = 0; index < rows; index += 1) {
    const label = labels[index] ?? "", amount = (amounts[index] ?? "").replace(",", "."), date = dates[index] ?? "";
    if (!label && !amount && !date) continue;
    if (!label || label.length > 120 || !isMoney(amount, true) || (date && !isDate(date))) {
      fieldErrors.steps = `Séance ${steps.length + 1} : indiquez un libellé et un montant MAD valide (date facultative).`;
      break;
    }
    steps.push({ label, amount: Number(amount), planned_date: date || null });
  }
  if (!fieldErrors.steps && !steps.length) fieldErrors.steps = "Ajoutez au moins une séance.";
  if (steps.length > MAX_TREATMENT_STEPS) fieldErrors.steps = `Un plan compte au maximum ${MAX_TREATMENT_STEPS} séances.`;
  if (Object.keys(fieldErrors).length) return { success: false, fieldErrors };
  return { success: true, data: { title, category: category as TreatmentCategory, notes: notes || null, steps, idempotencyKey } };
}

export type PlanStepState = { amount: number; done: boolean };
export type PlanSummary = { quote: number; realised: number; toRealise: number; stepsDone: number; stepsTotal: number };

// Money is summed in cents to avoid floating-point drift.
export function summarizePlan(steps: PlanStepState[]): PlanSummary {
  const cents = (value: number) => Math.round(value * 100);
  const quote = steps.reduce((sum, step) => sum + cents(step.amount), 0);
  const realised = steps.filter((step) => step.done).reduce((sum, step) => sum + cents(step.amount), 0);
  return { quote: quote / 100, realised: realised / 100, toRealise: (quote - realised) / 100, stepsDone: steps.filter((step) => step.done).length, stepsTotal: steps.length };
}

// What the patient still has to pay overall: already billed but unpaid, plus the
// sessions still to perform in plans that are accepted (proposed quotes are not owed).
export function remainingToPay(outstanding: number, plans: { status: TreatmentPlanStatus; summary: PlanSummary }[]): number {
  const future = plans.filter((plan) => plan.status === "accepted").reduce((sum, plan) => sum + Math.round(plan.summary.toRealise * 100), 0);
  return (Math.round(outstanding * 100) + future) / 100;
}
