import { createServerClient } from "@supabase/ssr";
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
