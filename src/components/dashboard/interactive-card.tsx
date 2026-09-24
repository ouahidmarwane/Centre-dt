"use client";

import { useEffect, useId, useRef, useState } from "react";
import styles from "./interactive-card.module.css";
import { spotlightClass, trackSpotlight, type SpotlightTexture } from "./spotlight-surface";

export function InteractiveCard({ children, className = "", title, details, texture }: {
  children: React.ReactNode;
  className?: string;
  title?: string;
  details?: React.ReactNode;
  texture?: SpotlightTexture;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const headingId = useId();
  const [open, setOpen] = useState(false);
  const [closing, setClosing] = useState(false);
  const welcome = className.includes("clinic-video-card");

  useEffect(() => {
    if (!open) return;
    dialog.current?.showModal();
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = overflow;
      if (timer.current) clearTimeout(timer.current);
    };
  }, [open]);

  function close() {
    if (closing) return;
    setClosing(true);
    timer.current = setTimeout(() => {
      dialog.current?.close();
      setOpen(false);
      setClosing(false);
    }, window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : 180);
  }

  return (
    <article className={`vision-card ${welcome ? "" : styles.card} ${texture ? spotlightClass(texture) : ""} ${title ? styles.explorable : ""} ${className}`} onPointerMove={texture ? trackSpotlight : undefined} onClick={title ? (event) => {
      if (!(event.target instanceof Element)) return;
      if (event.target.closest("button, a, input, select, textarea, summary, dialog")) return;
      setOpen(true);
    } : undefined}>
      {children}
      {title ? <>
        <div className={styles.actions}>
          <button type="button" className={styles.expand} onClick={() => setOpen(true)} aria-label={`Agrandir ${title}`} aria-haspopup="dialog">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M8 3H3v5m13-5h5v5M3 16v5h5m13-5v5h-5M3 3l6 6m12-6-6 6M3 21l6-6m12 6-6-6" /></svg>
            Explorer les résultats
          </button>
        </div>
        <dialog ref={dialog} aria-labelledby={headingId} className={`${styles.dialog} ${closing ? styles.closing : ""}`} onCancel={(event) => { event.preventDefault(); close(); }} onClose={() => { setOpen(false); setClosing(false); }} onClick={(event) => {
          if (event.target !== event.currentTarget) return;
          const bounds = event.currentTarget.getBoundingClientRect();
          if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) close();
        }}>
          {open ? <>
            <header className={styles.header}>
              <div><h2 id={headingId}>{title}</h2><p>Résultats détaillés du cabinet</p></div>
              <button autoFocus type="button" onClick={close} aria-label="Fermer les résultats" className={styles.close}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18" /></svg>
              </button>
            </header>
            <div className={styles.content}>{children}{details ? <div className={styles.details}>{details}</div> : null}</div>
          </> : null}
        </dialog>
      </> : null}
    </article>
  );
}
