"use client";

import styles from "./spotlight-surface.module.css";

export type SpotlightTexture = "dots" | "money" | "clock" | "people" | "tooth" | "calendar" | "pulse";

export function spotlightClass(texture: SpotlightTexture = "dots") {
  return `${styles.surface} ${texture === "dots" ? "" : styles[texture]}`;
}

// Tracks the pointer so the CSS layers can light up the area under the cursor.
export function trackSpotlight(event: React.PointerEvent<HTMLElement>) {
  const bounds = event.currentTarget.getBoundingClientRect();
  event.currentTarget.style.setProperty("--spot-x", `${event.clientX - bounds.left}px`);
  event.currentTarget.style.setProperty("--spot-y", `${event.clientY - bounds.top}px`);
}

export function SpotlightSurface({ children, className = "", texture = "dots" }: { children: React.ReactNode; className?: string; texture?: SpotlightTexture }) {
  return <div className={`${spotlightClass(texture)} ${className}`} onPointerMove={trackSpotlight}>{children}</div>;
}
