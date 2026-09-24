import { createServerClient } from "@supabase/ssr";

import { ACTIVITY_COOKIE, activityCookieOptions, encodeActivity, IDLE_REASON, isSessionIdle } from "@/lib/auth/session-activity";
import { type NextRequest, NextResponse } from "next/server";

import type { Database } from "@/types/database.types";
import { isPrivateNoStorePath } from "@/lib/security/response-policy";

import { getSupabaseEnvironment } from "./env";

const protectedRoutes = [
  "/dashboard",
  "/patients",
  "/appointments",
  "/accounting",
  "/security",
  "/payments",
  "/stock",
  "/statistics",
  "/mfa",
] as const;

export function isProtectedPath(pathname: string): boolean {
  return protectedRoutes.some(
    (route) => pathname === route || pathname.startsWith(`${route}/`),
  );
}

type ResponsePolicy = {
  contentSecurityPolicy?: string;
  requestHeaders?: Headers;
};

function applyResponsePolicy(response: NextResponse, pathname: string, policy: ResponsePolicy): NextResponse {
  if (policy.contentSecurityPolicy) {
    response.headers.set("Content-Security-Policy", policy.contentSecurityPolicy);
  }
  if (isPrivateNoStorePath(pathname)) {
    response.headers.set("Cache-Control", "private, no-store, max-age=0");
    response.headers.set("Pragma", "no-cache");
  }
  if (pathname === "/mfa" || pathname.startsWith("/mfa/")) {
    response.headers.set("X-Robots-Tag", "noindex, nofollow, noarchive");
  }
  return response;
}

export async function refreshSession(request: NextRequest, policy: ResponsePolicy = {}) {
  const forwardedRequest = policy.requestHeaders ? { headers: policy.requestHeaders } : request;
  let response = NextResponse.next({ request: forwardedRequest });
  const { url, publishableKey } = getSupabaseEnvironment();

  const supabase = createServerClient<Database>(url, publishableKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => {
          request.cookies.set(name, value);
        });

        response = NextResponse.next({ request: forwardedRequest });
        cookiesToSet.forEach(({ name, value, options }) => {
          response.cookies.set(name, value, options);
        });
      },
    },
  });

  const { data, error } = await supabase.auth.getClaims();
  const isAuthenticated = !error && Boolean(data?.claims?.sub);
  const pathname = request.nextUrl.pathname;

  if (!isAuthenticated && isProtectedPath(pathname)) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/login";
    loginUrl.search = "";
    return applyResponsePolicy(NextResponse.redirect(loginUrl), pathname, policy);
  }

  // Inactivity timeout: an authenticated request to the application whose activity
  // marker is missing or older than 30 minutes ends the session (password + MFA again).
  // The notification poll is checked but never counts as activity.
  const isBackgroundPoll = pathname === "/api/notifications";
  if (isAuthenticated && (isProtectedPath(pathname) || isBackgroundPoll || pathname === "/api/session/activity")) {
    const now = new Date();
    if (isSessionIdle(request.cookies.get(ACTIVITY_COOKIE)?.value, now)) {
      try { await supabase.rpc("record_logout"); } catch { /* telemetry must not block the sign-out */ }
      await supabase.auth.signOut({ scope: "local" });
      const loginUrl = request.nextUrl.clone();
      loginUrl.pathname = "/login";
      loginUrl.search = `?raison=${IDLE_REASON}`;
      const ended = pathname.startsWith("/api/")
        ? NextResponse.json({ error: "Session expired" }, { status: 401 })
        : NextResponse.redirect(loginUrl);
      // Carry the Supabase cookie deletions made by signOut.
      for (const cookie of response.cookies.getAll()) ended.cookies.set(cookie);
      ended.cookies.delete(ACTIVITY_COOKIE);
      return applyResponsePolicy(ended, pathname, policy);
    }
    if (!isBackgroundPoll) {
      response.cookies.set(ACTIVITY_COOKIE, encodeActivity(now), activityCookieOptions(request.nextUrl.protocol === "https:"));
    }
  }

  if (isAuthenticated && pathname === "/login") {
    const dashboardUrl = request.nextUrl.clone();
    dashboardUrl.pathname = "/dashboard";
    dashboardUrl.search = "";
    return applyResponsePolicy(NextResponse.redirect(dashboardUrl), pathname, policy);
  }

  if (
    pathname.endsWith("/print") ||
    pathname === "/mfa" ||
    pathname.startsWith("/mfa/") ||
    pathname === "/accounting" ||
    pathname.startsWith("/accounting/") ||
    pathname === "/security" ||
    pathname.startsWith("/security/")
  ) {
    response.headers.set("Cache-Control", "private, no-store, max-age=0");
    response.headers.set("Pragma", "no-cache");
    response.headers.set("X-Robots-Tag", "noindex, nofollow, noarchive");
  }

  return applyResponsePolicy(response, pathname, policy);
}
