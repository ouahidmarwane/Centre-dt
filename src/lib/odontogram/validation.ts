export const toothQuadrants = [
  [18, 17, 16, 15, 14, 13, 12, 11],
  [21, 22, 23, 24, 25, 26, 27, 28],
  [48, 47, 46, 45, 44, 43, 42, 41],
  [31, 32, 33, 34, 35, 36, 37, 38],
] as const;

export const permanentTeeth = toothQuadrants.flat();
export type PermanentTooth = (typeof permanentTeeth)[number];

export const dentalConditions = [
  "caries",
  "missing",
  "filled",
  "crown",
  "root_canal",
  "fracture",
  "implant",
  "extraction_indicated",
  "other",
] as const;
export type DentalCondition = (typeof dentalConditions)[number];

export const dentalStatuses = ["untreated", "monitoring", "treated", "resolved"] as const;
export const editableDentalStatuses = dentalStatuses.slice(0, 3);
export type DentalStatus = (typeof dentalStatuses)[number];
export type EditableDentalStatus = (typeof editableDentalStatuses)[number];

export const conditionLabels: Record<DentalCondition, string> = {
  caries: "Carie",
  missing: "Absente",
  filled: "Obturée",
  crown: "Couronne",
  root_canal: "Traitement canalaire",
  fracture: "Fracture",
  implant: "Implant",
  extraction_indicated: "Extraction indiquée",
  other: "Autre",
};

export const statusLabels: Record<DentalStatus, string> = {
  untreated: "Non traitée",
  monitoring: "À surveiller",
  treated: "Traitée",
  resolved: "Résolue",
};

export type DentalFindingInput = {
  toothNumber: PermanentTooth;
  condition: DentalCondition;
  status: EditableDentalStatus;
  notes: string | null;
  recommendation: string | null;
};

export type DentalFindingField = "toothNumber" | "condition" | "status" | "notes" | "recommendation";

type ValidationResult =
  | { success: true; data: DentalFindingInput }
  | { success: false; fieldErrors: Partial<Record<DentalFindingField, string>> };

function textValue(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

export function isDentalFindingId(value: unknown): value is string {
  return typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

export function validateDentalFindingForm(formData: FormData): ValidationResult {
  const toothNumber = Number(textValue(formData, "toothNumber"));
  const condition = textValue(formData, "condition");
  const status = textValue(formData, "status");
  const notes = textValue(formData, "notes");
  const recommendation = textValue(formData, "recommendation");
  const fieldErrors: Partial<Record<DentalFindingField, string>> = {};

  if (!permanentTeeth.includes(toothNumber as PermanentTooth)) fieldErrors.toothNumber = "Numéro FDI invalide.";
  if (!dentalConditions.includes(condition as DentalCondition)) fieldErrors.condition = "État dentaire invalide.";
  if (!editableDentalStatuses.includes(status as EditableDentalStatus)) fieldErrors.status = "Statut invalide.";
  if (notes.length > 4000) fieldErrors.notes = "Les notes sont limitées à 4 000 caractères.";
  if (recommendation.length > 2000) fieldErrors.recommendation = "La recommandation est limitée à 2 000 caractères.";
  if (condition === "other" && !notes) fieldErrors.notes = "Précisez l’état dans les notes.";

  if (Object.keys(fieldErrors).length > 0) return { success: false, fieldErrors };
  return {
    success: true,
    data: {
      toothNumber: toothNumber as PermanentTooth,
      condition: condition as DentalCondition,
      status: status as EditableDentalStatus,
      notes: notes || null,
      recommendation: recommendation || null,
    },
  };
}
