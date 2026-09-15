type CspOptions = {
  nonce: string;
  supabaseUrl: string;
  development?: boolean;
};

function origin(value: string): string {
  const parsed = new URL(value);
  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
    throw new Error("Unsupported Supabase URL protocol");
  }
  return parsed.origin;
}

export function buildContentSecurityPolicy({
  nonce,
  supabaseUrl,
  development = false,
}: CspOptions): string {
  if (!/^[A-Za-z0-9+/=_-]{16,}$/.test(nonce)) {
    throw new Error("Invalid CSP nonce");
  }

  const scriptSources = ["'self'", `'nonce-${nonce}'`, "'strict-dynamic'"];
  if (development) scriptSources.push("'unsafe-eval'");

  return [
    "default-src 'self'",
    `script-src ${scriptSources.join(" ")}`,
    `style-src 'self' 'nonce-${nonce}'`,
    "style-src-attr 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self'",
    `connect-src 'self' ${origin(supabaseUrl)}`,
    "media-src 'self'",
    "frame-src 'none'",
    "frame-ancestors 'none'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "manifest-src 'self'",
  ].join("; ");
}

export function isPrivateNoStorePath(pathname: string): boolean {
  return (
    pathname === "/" ||
    pathname === "/login" ||
    pathname === "/forbidden" ||
    pathname === "/dashboard" ||
    pathname.startsWith("/dashboard/") ||
    pathname === "/patients" ||
    pathname.startsWith("/patients/") ||
    pathname === "/appointments" ||
    pathname.startsWith("/appointments/") ||
    pathname === "/accounting" ||
    pathname.startsWith("/accounting/") ||
    pathname === "/security" ||
    pathname.startsWith("/security/")
  );
}
