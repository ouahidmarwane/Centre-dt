// Daily Telegram digests for the team. Counts only: no patient data leaves the app.
export const staffDigestKinds = ["unpaid_payments", "low_stock"] as const;
export type StaffDigestKind = (typeof staffDigestKinds)[number];

export function staffDigestText(kind: StaffDigestKind, count: number): string {
  if (kind === "unpaid_payments") {
    return `Relances d’impayés\n${count} patient${count > 1 ? "s" : ""} à relancer aujourd’hui. Ouvrez « Recouvrement » dans l’application pour envoyer les messages.`;
  }
  return `Stock bas\n${count} article${count > 1 ? "s" : ""} sous le seuil d’alerte. Ouvrez « Stock » dans l’application pour préparer la commande.`;
}

export function isStaffDigestKind(value: unknown): value is StaffDigestKind {
  return typeof value === "string" && (staffDigestKinds as readonly string[]).includes(value);
}
