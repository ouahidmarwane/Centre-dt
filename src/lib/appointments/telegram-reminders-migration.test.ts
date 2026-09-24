import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

const migrationPath = path.join(process.cwd(), "supabase/migrations/20260918090000_telegram_appointment_reminders.sql");

test("Telegram reminder outbox is private, idempotent and retries delivery failures", async () => {
  const sql = await readFile(migrationPath, "utf8");
  assert.match(sql, /alter table public\.appointment_reminder_notifications enable row level security/i);
  assert.match(sql, /revoke all on table public\.appointment_reminder_notifications from public, anon, authenticated/i);
  assert.match(sql, /unique \(appointment_id, reminder_type\)/i);
  assert.match(sql, /for update of n skip locked/i);
  assert.match(sql, /next_attempt_at = now\(\) \+ interval '5 minutes'/i);
  assert.match(sql, /status = 'sent'/i);
});

test("Telegram H-2 rule respects the 09:00 opening-time exception", async () => {
  const sql = await readFile(migrationPath, "utf8");
  assert.match(sql, /a\.starts_at - interval '2 hours'/i);
  assert.match(sql, /time '09:00'/i);
  assert.match(sql, /greatest\(/i);
  assert.doesNotMatch(sql, /patient_phone|notes|purpose|diagnostic|montant/i);
});
