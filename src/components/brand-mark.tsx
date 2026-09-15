export function BrandMark({ className = "size-11" }: { className?: string }) {
  return (
    <span aria-hidden="true" className={`grid shrink-0 place-items-center rounded-[13px] bg-[var(--blue)] shadow-[0_7px_18px_rgba(36,107,253,0.24)] ${className}`}>
      <svg fill="none" viewBox="0 0 36 36" className="size-[76%]">
        <path d="M8.2 11.2c2.9-3.1 6.4-2.8 9.8-.9 3.4-1.9 6.9-2.2 9.8.9-1 8.8-3.8 15.2-7.4 16.2-1.1.3-1.5-5.9-2.4-5.9s-1.3 6.2-2.4 5.9c-3.6-1-6.4-7.4-7.4-16.2Z" fill="white" fillOpacity=".96" />
        <path d="M11.3 16.7c3.8 2.7 9.6 2.7 13.4 0" stroke="var(--gold-light)" strokeLinecap="round" strokeWidth="1.8" />
      </svg>
    </span>
  );
}

export function BrandSignature({ className = "" }: { className?: string }) {
  return (
    <svg aria-hidden="true" className={className} fill="none" viewBox="0 0 240 104">
      <path d="M18 39c41 45 154 58 204 2" stroke="var(--blue)" strokeLinecap="round" strokeWidth="3" />
      <path d="M42 28c34 31 108 43 155 12" stroke="var(--gold-light)" strokeLinecap="round" strokeWidth="2" />
      <path d="M76 23c27 18 59 23 88 14" stroke="var(--navy)" strokeLinecap="round" strokeOpacity=".12" strokeWidth="12" />
      <circle cx="31" cy="47" fill="var(--gold)" r="4" />
      <circle cx="211" cy="48" fill="var(--blue)" r="4" />
    </svg>
  );
}
