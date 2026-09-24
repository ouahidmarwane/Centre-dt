import { timingSafeEqual } from "node:crypto";

import { formatClinicDate, formatClinicTime } from "@/lib/appointments/validation";
import { isStaffDigestKind, staffDigestText } from "@/lib/notifications/staff-digests";
import { getSupabaseEnvironment } from "@/lib/supabase/env";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type DueReminder = { notification_id: string; appointment_id: string; patient_id: string; patient_first_name: string; starts_at: string };
type DueDigest = { notification_id: string; kind: string; item_count: number };

function sameSecret(received: string | null, expected: string) {
  if (!received) return false;
  const receivedBuffer = Buffer.from(received), expectedBuffer = Buffer.from(expected);
  return receivedBuffer.length === expectedBuffer.length && timingSafeEqual(receivedBuffer, expectedBuffer);
}

function getConfiguration() {
  const cronSecret = process.env.CRON_SECRET, serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY, botToken = process.env.TELEGRAM_BOT_TOKEN, chatId = process.env.TELEGRAM_CHAT_ID;
  return cronSecret && serviceRoleKey && botToken && chatId ? { cronSecret, serviceRoleKey, botToken, chatId } : null;
}

async function rpc<T>(path: string, serviceRoleKey: string, body: Record<string, unknown>) {
  const { url } = getSupabaseEnvironment();
  const response = await fetch(`${url}/rest/v1/rpc/${path}`, { method: "POST", headers: { apikey: serviceRoleKey, Authorization: `Bearer ${serviceRoleKey}`, "Content-Type": "application/json" }, body: JSON.stringify(body), cache: "no-store" });
  if (!response.ok) throw new Error(`Supabase RPC ${path} failed.`);
  return response.json() as Promise<T>;
}

function telegramText(reminder: DueReminder) {
  return `Rappel WhatsApp\n${reminder.patient_first_name} a rendez-vous ${formatClinicDate(reminder.starts_at)} à ${formatClinicTime(reminder.starts_at)}. Merci d’envoyer le message de confirmation au patient.`;
}

async function complete(notificationId: string, delivered: boolean, serviceRoleKey: string, failureMessage?: string) {
  await rpc("complete_telegram_appointment_reminder", serviceRoleKey, { target_notification_id: notificationId, delivered, failure_message: failureMessage ?? null });
}

async function sendTelegram(config: { botToken: string; chatId: string }, text: string) {
  const response = await fetch(`https://api.telegram.org/bot${config.botToken}/sendMessage`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ chat_id: config.chatId, text }), cache: "no-store" });
  if (!response.ok) throw new Error(`Telegram returned ${response.status}.`);
}

// Daily team digests (unpaid reminders, low stock), claimed once per clinic day.
async function processDigests(config: { botToken: string; chatId: string; serviceRoleKey: string }) {
  const digests = await rpc<DueDigest[]>("claim_staff_digests", config.serviceRoleKey, {});
  let delivered = 0, failed = 0;
  for (const digest of digests) {
    try {
      if (!isStaffDigestKind(digest.kind)) throw new Error("Unknown digest kind.");
      await sendTelegram(config, staffDigestText(digest.kind, digest.item_count));
      await rpc("complete_staff_digest", config.serviceRoleKey, { target_notification_id: digest.notification_id, delivered: true, failure_message: null }); delivered += 1;
    } catch (error) {
      await rpc("complete_staff_digest", config.serviceRoleKey, { target_notification_id: digest.notification_id, delivered: false, failure_message: error instanceof Error ? error.message : "Telegram delivery failed." }); failed += 1;
    }
  }
  return { delivered, failed };
}

export async function POST(request: Request) {
  const config = getConfiguration();
  if (!config) return Response.json({ error: "Reminder service is not configured." }, { status: 503 });
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? null;
  if (!sameSecret(token, config.cronSecret)) return Response.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const reminders = await rpc<DueReminder[]>("claim_due_telegram_appointment_reminders", config.serviceRoleKey, {});
    let delivered = 0, failed = 0;
    for (const reminder of reminders) {
      try {
        await sendTelegram(config, telegramText(reminder));
        await complete(reminder.notification_id, true, config.serviceRoleKey); delivered += 1;
      } catch (error) {
        await complete(reminder.notification_id, false, config.serviceRoleKey, error instanceof Error ? error.message : "Telegram delivery failed."); failed += 1;
      }
    }
    const digests = await processDigests(config);
    return Response.json({ delivered, failed, digests });
  } catch {
    return Response.json({ error: "Reminder processing failed." }, { status: 500 });
  }
}
