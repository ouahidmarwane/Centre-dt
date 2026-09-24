"use client";

import { useEffect, useRef, useState } from "react";

import { logoutAction } from "@/app/(dashboard)/actions";
import { IDLE_REASON, IDLE_TIMEOUT_MS, IDLE_WARNING_MS } from "@/lib/auth/session-activity";

const SHARED_KEY = "cdo-last-activity";
const PING_EVERY_MS = 2 * 60_000;
const CHECK_EVERY_MS = 10_000;
const ACTIVITY_EVENTS = ["pointerdown", "keydown", "wheel", "touchstart", "mousemove"] as const;

// Last interaction, shared by every open tab of the application.
function readShared(fallback: number): number {
  try { return Number(window.localStorage.getItem(SHARED_KEY)) || fallback; } catch { return fallback; }
}
function writeShared(value: number) {
  try { window.localStorage.setItem(SHARED_KEY, String(value)); } catch { /* private mode */ }
}

// Signs the user out after 30 minutes without interaction, with a warning 2 minutes
// before, so no patient data stays on an abandoned screen. The server enforces the
// same limit on every request (proxy); this guard only acts first and explains it.
export function IdleGuard() {
  const formRef = useRef<HTMLFormElement>(null);
  const lastLocal = useRef(0);
  const lastPing = useRef(0);
  const leaving = useRef(false);
  const [warning, setWarning] = useState(false);

  useEffect(() => {
    const start = Date.now();
    lastLocal.current = start;
    lastPing.current = start;
    writeShared(start);

    const onActivity = () => {
      const now = Date.now();
      if (now - lastLocal.current < 5_000) return;
      lastLocal.current = now;
      writeShared(now);
      setWarning(false);
      if (now - lastPing.current > PING_EVERY_MS) {
        lastPing.current = now;
        void fetch("/api/session/activity", { method: "POST", keepalive: true }).then((response) => {
          // Full reload on purpose: drops every piece of client state (cached patient data).
          // eslint-disable-next-line @next/next/no-location-assign-relative-destination
          if (response.status === 401) window.location.assign(`/login?raison=${IDLE_REASON}`);
        }).catch(() => {});
      }
    };
    const check = () => {
      if (leaving.current) return;
      const idle = Date.now() - readShared(lastLocal.current);
      if (idle >= IDLE_TIMEOUT_MS) {
        leaving.current = true;
        formRef.current?.requestSubmit();
      } else {
        setWarning(idle >= IDLE_TIMEOUT_MS - IDLE_WARNING_MS);
      }
    };
    for (const name of ACTIVITY_EVENTS) window.addEventListener(name, onActivity, { passive: true });
    const interval = window.setInterval(check, CHECK_EVERY_MS);
    return () => {
      for (const name of ACTIVITY_EVENTS) window.removeEventListener(name, onActivity);
      window.clearInterval(interval);
    };
  }, []);

  return (
    <>
      <form action={logoutAction} className="hidden" data-logout="" ref={formRef}>
        <input name="reason" type="hidden" value={IDLE_REASON} />
      </form>
      {warning ? (
        <div aria-live="assertive" className="fixed inset-x-0 top-20 z-[80] mx-auto w-[min(420px,calc(100vw-32px))] rounded-[18px] border border-amber-200 bg-white/95 p-4 shadow-[0_24px_60px_-20px_rgba(16,44,76,0.45)] backdrop-blur print:hidden" role="alertdialog" aria-label="Déconnexion pour inactivité">
          <p className="text-sm font-semibold text-[var(--navy)]">Vous allez être déconnecté(e)</p>
          <p className="mt-1 text-sm text-slate-600">Sans activité, la session se fermera dans moins de 2 minutes pour protéger les données des patients.</p>
          <button className="mt-3 inline-flex min-h-10 items-center rounded-[10px] bg-[var(--brand)] px-4 text-sm font-semibold text-white hover:bg-[var(--brand-strong)]" onClick={() => { writeShared(Date.now()); lastLocal.current = 0; setWarning(false); void fetch("/api/session/activity", { method: "POST" }); }} type="button">Rester connecté(e)</button>
        </div>
      ) : null}
    </>
  );
}
