"use client";

import { useEffect, useRef } from "react";

export function ClinicVideo() {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    const start = () => {
      video.muted = true;
      void video.play().catch(() => {});
    };
    start();
    video.addEventListener("loadeddata", start);
    video.addEventListener("canplay", start);
    window.addEventListener("pointerdown", start, { once: true });
    window.addEventListener("keydown", start, { once: true });
    return () => {
      video.removeEventListener("loadeddata", start);
      video.removeEventListener("canplay", start);
      window.removeEventListener("pointerdown", start);
      window.removeEventListener("keydown", start);
    };
  }, []);

  return (
      <video
        ref={videoRef}
        aria-hidden="true"
        autoPlay
        loop
        muted
        playsInline
        preload="auto"
        poster="/media/clinic-loop-poster.jpg"
        className="absolute inset-0 size-full object-cover object-center"
        tabIndex={-1}
      >
        <source src="/media/dashboard-welcome-loop.mp4" type="video/mp4" />
      </video>
  );
}
