import type { NextRequest } from "next/server";

import { buildContentSecurityPolicy } from "@/lib/security/response-policy";
import { refreshSession } from "@/lib/supabase/proxy";
import { getSupabaseEnvironment } from "@/lib/supabase/env";

export async function proxy(request: NextRequest) {
  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
  const { url } = getSupabaseEnvironment();
  const contentSecurityPolicy = buildContentSecurityPolicy({
    nonce,
    supabaseUrl: url,
    development: process.env.NODE_ENV === "development",
  });
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("Content-Security-Policy", contentSecurityPolicy);

  return refreshSession(request, { contentSecurityPolicy, requestHeaders });
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|mp4|webm|ogg|mp3|wav|m4a|woff|woff2|ttf)$).*)",
  ],
};
