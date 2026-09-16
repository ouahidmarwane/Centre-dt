export type SupabaseEnvironment = {
  url: string;
  publishableKey: string;
};

export function validateSupabaseEnvironment(
  input: { url?: string; publishableKey?: string },
  production: boolean,
): SupabaseEnvironment {
  const invalid = () => new Error("Supabase configuration is missing or invalid. Check the documented public environment variables.");
  const { url, publishableKey } = input;
  if (!url || /\s/u.test(url) || !publishableKey || !/^sb_publishable_[A-Za-z0-9_-]+$/.test(publishableKey)) throw invalid();
  let parsed: URL;
  try { parsed = new URL(url); } catch { throw invalid(); }
  if (parsed.username || parsed.password || parsed.search || parsed.hash || parsed.pathname !== "/") throw invalid();
  const hosted = parsed.protocol === "https:" && /^[a-z0-9-]+\.supabase\.co$/.test(parsed.hostname) && !parsed.port;
  const local = !production && parsed.protocol === "http:" && ["localhost", "127.0.0.1", "[::1]"].includes(parsed.hostname);
  if (!hosted && !local) throw invalid();
  return { url: parsed.origin, publishableKey };
}

export function getSupabaseEnvironment(): SupabaseEnvironment {
  // Explicit property references are required for Next.js public-variable inlining.
  return validateSupabaseEnvironment({
    url: process.env.NEXT_PUBLIC_SUPABASE_URL,
    publishableKey: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  }, process.env.NODE_ENV === "production");
}
