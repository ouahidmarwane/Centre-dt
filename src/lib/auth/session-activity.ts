// Inactivity timeout for staff sessions on shared clinic computers. The server is
// authoritative: an httpOnly cookie holds the time of the last user activity and the
// proxy signs the session out when it is missing or older than the timeout.

export const IDLE_TIMEOUT_MS = 30 * 60_000;
export const IDLE_WARNING_MS = 2 * 60_000;
export const ACTIVITY_COOKIE = "cdo_last_activity";
export const IDLE_REASON = "inactivite";

export function encodeActivity(now: Date): string {
  return String(now.getTime());
}

// Missing, malformed, too old or from the future (clock tampering) all count as idle.
export function isSessionIdle(value: string | undefined, now: Date): boolean {
  if (!value || !/^\d{13}$/.test(value)) return true;
  const last = Number(value);
  const age = now.getTime() - last;
  return age > IDLE_TIMEOUT_MS || age < -60_000;
}

export const activityCookieOptions = (secure: boolean) => ({
  httpOnly: true,
  sameSite: "lax" as const,
  secure,
  path: "/",
  // Browser copy disappears soon after the timeout anyway.
  maxAge: Math.ceil(IDLE_TIMEOUT_MS / 1000) + 60,
});
