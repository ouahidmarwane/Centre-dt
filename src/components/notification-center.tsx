"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { AppIcon, type AppIconName } from "@/components/app-icon";
import { WhatsAppGlyph } from "@/components/patients/patient-list";
import { mergeHistory, pruneHistory, relativeTime, type AppNotification, type HistoryEntry, type NotificationKind } from "@/lib/notifications/feed";

import styles from "./notification-center.module.css";

const POLL_MS = 60_000;
const DISPLAY_MS = 4_000;
const EXIT_MS = 300;

const thumbnails: Record<NotificationKind, { icon: AppIconName | "whatsapp"; tone: string }> = {
  appointment_reminder: { icon: "whatsapp", tone: styles.whatsapp },
  next_patient: { icon: "calendar", tone: styles.blue },
  payment_reminder: { icon: "receipt", tone: styles.amber },
  freed_slot: { icon: "calendar", tone: styles.green },
  low_stock: { icon: "box", tone: styles.red },
};

// Today's notifications live in this browser only (per user); storage may be unavailable.
function readHistory(key: string): HistoryEntry[] {
  try { return JSON.parse(window.localStorage.getItem(key) ?? "[]") as HistoryEntry[]; } catch { return []; }
}
function writeHistory(key: string, history: HistoryEntry[]) {
  try { window.localStorage.setItem(key, JSON.stringify(history)); } catch { /* private mode */ }
}

// Isolation between staff members sharing a computer: only the signed-in user's list is
// kept. Other users' lists (which contain patient names) are removed at sign-in, and the
// user's own list is removed at sign-out.
const STORAGE_PREFIXES = ["cdo-notifications-today:", "cdo-notifications-seen:"];
function removeStoredNotifications(keep: string | null) {
  try {
    for (const key of Object.keys(window.localStorage)) {
      if (key !== keep && STORAGE_PREFIXES.some((prefix) => key.startsWith(prefix))) window.localStorage.removeItem(key);
    }
  } catch { /* storage unavailable */ }
}

function Thumbnail({ kind, small = false }: { kind: NotificationKind; small?: boolean }) {
  const thumbnail = thumbnails[kind];
  return (
    <span aria-hidden="true" className={`${styles.thumbnail} ${small ? styles.thumbnailSmall : ""} ${thumbnail.tone}`}>
      {thumbnail.icon === "whatsapp" ? <WhatsAppGlyph className={small ? "size-4" : "size-5"} /> : <AppIcon className={small ? "size-4" : "size-5"} name={thumbnail.icon} />}
    </span>
  );
}

// iOS-style banner (Figma "iOS Notifications", light variant) centred at the top of every
// page for a few seconds, plus a bell in the header listing today's notifications.
export function NotificationCenter({ userId }: { userId: string }) {
  const router = useRouter();
  const storageKey = `cdo-notifications-today:${userId}`;
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [queue, setQueue] = useState<AppNotification[]>([]);
  const [leaving, setLeaving] = useState(false);
  const [paused, setPaused] = useState(false);
  const [open, setOpen] = useState(false);
  const [now, setNow] = useState(() => new Date());
  const [mounted, setMounted] = useState(false);
  const bellRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const save = useCallback((next: HistoryEntry[]) => { setHistory(next); writeHistory(storageKey, next); }, [storageKey]);

  const poll = useCallback(async () => {
    const moment = new Date();
    setNow(moment);
    // A new clinic day starts with an empty list.
    const stored = pruneHistory(readHistory(storageKey), moment);
    if (document.visibilityState !== "visible" || document.documentElement.dataset.welcome) { save(stored); return; }
    try {
      const response = await fetch("/api/notifications", { cache: "no-store" });
      if (!response.ok) throw new Error("Notifications unavailable");
      const items = (await response.json()) as AppNotification[];
      const known = new Set(stored.map((entry) => entry.id));
      const fresh = items.filter((item) => !known.has(item.id));
      save(mergeHistory(stored, fresh, moment));
      if (fresh.length) setQueue((current) => [...current, ...fresh.filter((item) => !current.some((queued) => queued.id === item.id))]);
    } catch { save(stored); /* offline or session ended: try again at the next poll */ }
  }, [save, storageKey]);

  useEffect(() => {
    removeStoredNotifications(storageKey);
    const onSubmit = (event: SubmitEvent) => {
      if (event.target instanceof HTMLFormElement && event.target.hasAttribute("data-logout")) removeStoredNotifications(null);
    };
    document.addEventListener("submit", onSubmit, true);
    return () => document.removeEventListener("submit", onSubmit, true);
  }, [storageKey]);

  useEffect(() => {
    const ready = window.setTimeout(() => setMounted(true), 0);
    const first = window.setTimeout(poll, 1_500);
    const interval = window.setInterval(poll, POLL_MS);
    const onVisible = () => { if (document.visibilityState === "visible") void poll(); };
    document.addEventListener("visibilitychange", onVisible);
    // The welcome video hides the app after login: check again once it has gone.
    const observer = new MutationObserver(() => { if (!document.documentElement.dataset.welcome) void poll(); });
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-welcome"] });
    return () => { window.clearTimeout(ready); window.clearTimeout(first); window.clearInterval(interval); document.removeEventListener("visibilitychange", onVisible); observer.disconnect(); };
  }, [poll]);

  const current = queue[0];
  const dismiss = useCallback(() => {
    if (!current || leaving) return;
    setLeaving(true);
    window.setTimeout(() => { setQueue((items) => items.slice(1)); setLeaving(false); }, EXIT_MS);
  }, [current, leaving]);

  useEffect(() => {
    if (!current || paused || leaving) return;
    const timer = window.setTimeout(dismiss, DISPLAY_MS);
    return () => window.clearTimeout(timer);
  }, [current, paused, leaving, dismiss]);

  const openItem = useCallback((item: AppNotification) => {
    save(history.map((entry) => (entry.id === item.id ? { ...entry, read: true } : entry)));
    setOpen(false);
    router.push(item.href);
  }, [history, router, save]);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") { setOpen(false); bellRef.current?.focus(); } };
    const onPointer = (event: PointerEvent) => {
      const target = event.target as Node;
      if (!panelRef.current?.contains(target) && !bellRef.current?.contains(target)) setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("pointerdown", onPointer);
    return () => { window.removeEventListener("keydown", onKey); window.removeEventListener("pointerdown", onPointer); };
  }, [open]);

  const unread = history.filter((entry) => !entry.read).length;

  return (
    <>
      <button
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-label={unread ? `Notifications du jour, ${unread} non lue${unread > 1 ? "s" : ""}` : "Notifications du jour"}
        className={styles.bell}
        onClick={() => { setNow(new Date()); setOpen((value) => !value); }}
        ref={bellRef}
        type="button"
      >
        <AppIcon className="size-5" name="bell" />
        {unread ? <span aria-hidden="true" className={styles.badge}>{unread > 99 ? "99+" : unread}</span> : null}
      </button>

      {mounted ? createPortal(
        <>
          <div aria-live="polite" className={styles.region} role="status">
            {current ? (
              <article className={`${styles.banner} ${leaving ? styles.leaving : ""}`} key={current.id} onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)}>
                <button aria-label={`${current.title} : ${current.body}. Ouvrir`} className={styles.open} onClick={() => { openItem(current); dismiss(); }} type="button">
                  <span className={styles.header}>
                    <span aria-hidden="true" className={styles.appIcon}><svg fill="currentColor" viewBox="0 0 24 24"><path d="M7 3c-2.2 0-4 1.8-4 4.5 0 2 .8 3.6 1.6 5.4L6 20c.3 1.3 2 1.3 2.3 0l1-4.5c.3-1.3 2.1-1.3 2.4 0l1 4.5c.3 1.3 2 1.3 2.3 0l1.4-7.1c.8-1.8 1.6-3.4 1.6-5.4C18 4.8 16.2 3 14 3c-1.4 0-2.2.7-3.5.7S8.4 3 7 3" /></svg></span>
                    <span className={styles.appName}>Centre Dentaire Ouahid</span>
                    <span className={styles.time}>maintenant</span>
                  </span>
                  <span className={styles.content}>
                    <span className={styles.text}><span className={styles.title}>{current.title}</span><span className={styles.body}>{current.body}</span></span>
                    <Thumbnail kind={current.kind} />
                  </span>
                  {queue.length > 1 ? <span className={styles.more}>{queue.length - 1} autre{queue.length > 2 ? "s" : ""} notification{queue.length > 2 ? "s" : ""}</span> : null}
                </button>
              </article>
            ) : null}
          </div>

          {open ? (
            <div aria-label="Notifications du jour" className={styles.panel} ref={panelRef} role="dialog">
              <div className={styles.panelHeader}>
                <div>
                  <p className={styles.panelTitle}>Notifications du jour</p>
                  <p className={styles.panelHint}>La liste repart à zéro chaque jour à minuit.</p>
                </div>
                {unread ? <button className={styles.markAll} onClick={() => save(history.map((entry) => ({ ...entry, read: true })))} type="button">Tout marquer comme lu</button> : null}
              </div>
              {history.length ? (
                <ul className={styles.list}>
                  {history.map((entry) => (
                    <li key={entry.id}>
                      <button className={`${styles.item} ${entry.read ? "" : styles.unread}`} onClick={() => openItem(entry)} type="button">
                        <Thumbnail kind={entry.kind} small />
                        <span className={styles.itemText}>
                          <span className={styles.itemTitle}>{entry.title}</span>
                          <span className={styles.itemBody}>{entry.body}</span>
                        </span>
                        <span className={styles.itemTime}>{relativeTime(entry.at, now)}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              ) : <p className={styles.empty}>Aucune notification aujourd’hui.</p>}
            </div>
          ) : null}
        </>,
        document.body,
      ) : null}
    </>
  );
}
