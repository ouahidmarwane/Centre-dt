import { normalizeWhatsAppPhone } from "../appointments/validation.ts";

// Same cadence as the database rule (private.patient_balances).
export const PAYMENT_GRACE_DAYS = 7;
export const PAYMENT_REMINDER_INTERVAL_DAYS = 14;

const amountFormatter = new Intl.NumberFormat("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
export function formatReminderAmount(value: number): string {
  return `${amountFormatter.format(value).replace(/ | /g, " ")} MAD`;
}

export function reminderRankLabel(previousReminders: number): string {
  const next = previousReminders + 1;
  return next === 1 ? "1re relance" : `${next}e relance`;
}

export function daysBetween(fromDate: string, today: string): number {
  return Math.round((Date.parse(`${today}T00:00:00Z`) - Date.parse(`${fromDate}T00:00:00Z`)) / 86_400_000);
}

// Courteous bilingual message (French, then Arabic), like the appointment reminders.
export function buildWhatsAppPaymentReminderUrl(input: { phone: string | null; firstName: string; outstanding: number }): string | null {
  const phone = normalizeWhatsAppPhone(input.phone);
  if (!phone) return null;
  const amount = formatReminderAmount(input.outstanding);
  const french = `Bonjour ${input.firstName}, sauf erreur de notre part, un solde de ${amount} reste à régler pour vos soins au Centre Dentaire Ouahid. Vous pouvez le régler lors de votre prochain passage ou nous contacter pour en parler. Merci de votre confiance.`;
  const arabic = `مرحبا ${input.firstName}، ما لم نكن مخطئين، يتبقى مبلغ ${amount} لتسويته مقابل علاجاتكم في مركز وحيد لطب الأسنان. يمكنكم تسويته خلال زيارتكم القادمة أو التواصل معنا بخصوصه. شكرا على ثقتكم.`;
  return `https://wa.me/${phone}?text=${encodeURIComponent(`${french}\n\n${arabic}`)}`;
}
