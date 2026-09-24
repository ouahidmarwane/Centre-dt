"use client";

import Image from "next/image";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";

import styles from "./login-welcome.module.css";

const WELCOME_PARAM = "bienvenue";
// The video lasts 10 s; the fallback closes the overlay if it stalls or never plays.
const FALLBACK_MS = 11_500;
const REDUCED_MOTION_MS = 1_200;
// The exit is a cross-fade: the video zooms softly into the smile while the dashboard
// fades in underneath. It starts before the last frame so the video never freezes.
const EXIT_MS = 1_300;
const EXIT_BEFORE_END_S = 1.2;
const REDUCED_QUERY = "(prefers-reduced-motion: reduce)";

// The server cannot know the viewer's preference: it renders the video, then the
// client switches to the still image when reduced motion is requested.
function subscribeReducedMotion(onChange: () => void) {
  const query = window.matchMedia(REDUCED_QUERY);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}
const prefersReducedMotion = () => window.matchMedia(REDUCED_QUERY).matches;

// Shown over the dashboard right after a successful MFA verification (?bienvenue=1).
export function LoginWelcome({ role }: { role: "doctor" | "assistant" }) {
  const searchParams = useSearchParams();
  // Captured once: stripping the flag from the URL below must not end the animation.
  const [active, setActive] = useState(() => searchParams.get(WELCOME_PARAM) === "1");
  const [leaving, setLeaving] = useState(false);
  const reduced = useSyncExternalStore(subscribeReducedMotion, prefersReducedMotion, () => false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const leavingRef = useRef(false);

  const finish = useCallback(() => {
    if (leavingRef.current) return;
    leavingRef.current = true;
    setLeaving(true);
    document.documentElement.dataset.welcome = "reveal";
    window.setTimeout(() => {
      setActive(false);
      delete document.documentElement.dataset.welcome;
    }, EXIT_MS);
  }, []);

  useEffect(() => {
    if (!active) return;
    // Drop the flag so a refresh or back navigation does not replay the animation.
    const url = new URL(window.location.href);
    url.searchParams.delete(WELCOME_PARAM);
    window.history.replaceState(window.history.state, "", `${url.pathname}${url.search}${url.hash}`);
    // Keep the dashboard hidden behind the video so it can fade in at the end.
    if (!leavingRef.current) document.documentElement.dataset.welcome = "hold";
    const timer = window.setTimeout(finish, reduced ? REDUCED_MOTION_MS : FALLBACK_MS);
    // Autoplay can be refused by the browser: the overlay then simply closes early.
    if (!reduced) videoRef.current?.play().catch(() => window.setTimeout(finish, REDUCED_MOTION_MS));
    return () => window.clearTimeout(timer);
  }, [active, finish, reduced]);

  useEffect(() => () => { delete document.documentElement.dataset.welcome; }, []);

  if (!active) return null;

  return (
    <div className={`${styles.overlay} ${leaving ? styles.leaving : ""}`} role="status" aria-live="polite">
      {reduced ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img alt="" aria-hidden="true" className={styles.video} src="/media/login-welcome-poster.jpg" />
      ) : (
        <video
          aria-hidden="true"
          className={styles.video}
          muted
          onEnded={finish}
          onTimeUpdate={(event) => { const video = event.currentTarget; if (video.duration && video.currentTime >= video.duration - EXIT_BEFORE_END_S) finish(); }}
          onError={() => window.setTimeout(finish, REDUCED_MOTION_MS)}
          playsInline
          poster="/media/login-welcome-poster.jpg"
          preload="auto"
          ref={videoRef}
          src="/media/login-welcome.mp4"
        />
      )}
      <Image alt="Ouahid Dental Center" className={styles.logo} height={887} loading="eager" sizes="260px" src="/images/ouahid-logo-navy.png" width={1774} />
      <p className="sr-only">Connexion réussie. {role === "doctor" ? "Ouverture de votre espace médecin." : "Ouverture de votre espace du cabinet."}</p>
      {!reduced ? <button className={styles.skip} onClick={finish} type="button">Passer ›</button> : null}
    </div>
  );
}
