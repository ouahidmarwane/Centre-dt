# Security boundary and operational policy

## Pre-authentication boundary

The application cannot safely implement the requested distributed pre-authentication login
limiter with its current credentials. A Server Action and an arbitrary browser both use the same
Supabase publishable key before authentication. Granting a `SECURITY DEFINER` counter RPC to
`anon` would expose that mutation directly through PostgREST. No such grant was added, and no
service-role or database credential is used by the application.

M13 must provision a dedicated trusted server or edge capability before adding the intended
limits: 20 attempts per trusted IP bucket and 8 per trusted IP plus privacy-preserving normalized
identifier in 15 minutes. That implementation must use an atomic PostgreSQL operation, must not
store plaintext identifiers, and must not introduce a global anonymous blocking cap.

The canonical IP utility accepts only `x-vercel-forwarded-for` when both `VERCEL=1` and
`VERCEL_ENV=production`. It rejects generic forwarding headers and ambiguous lists, normalizes
IPv4-mapped IPv6, and aggregates IPv6 to `/64` only for future rate-limit buckets. Explicit IP
policy entries remain exact addresses.

## Authenticated administrative limiting

The private PostgreSQL counter is retained only for authenticated doctor administration. Adding
or disabling an IP policy and changing an account state are each limited to six operations per
doctor in five minutes. These controls fail closed and execute in the same transaction as the
protected mutation. Expired counter rows are removed opportunistically.

## IP policy and edge enforcement

The IP list is an application security policy registry, not an active network blocklist. M12 does
not query PostgreSQL on every request and does not claim to block traffic before the application.
Actual network enforcement requires reviewed synchronization with Vercel Firewall/WAF in M13.
RPC callers cannot submit a current IP or another network value as authoritative context.

## Sessions and account deactivation

`user_sessions` is an application observation registry. User and session identifiers come from
signed Supabase JWT claims and timestamps are updated no more than once every ten minutes. IP
addresses, user-agent strings, access tokens, refresh tokens and cookies are not stored or shown.
The registry does not prove that a Supabase refresh session remains active.

Deactivating a profile immediately blocks application authorization and database RPC/RLS access,
but it does not revoke the underlying GoTrue refresh session.

Supabase SSR cookies retain the package defaults. `@supabase/ssr` defaults to `HttpOnly=false`, and
official Supabase guidance explains that a browser-compatible cookie lifecycle needs access to
session material. Although this project currently uses server clients, changing that flag without
an end-to-end replacement and verification of refresh, sign-in and sign-out is not justified here.

## Telemetry retention

Security events cover authenticated session observation, local logout requests, inactive-account
denials, authenticated administration and administrative rate limits. Failed-login and blocked-
network events are not claimed because this boundary cannot observe them reliably. Events are
shown for a strict 14-day window with an initial limit of 50 records. Storage cleanup remains an
opportunistic 90-day delete. At clinic scale this is retained as P3 technical debt; moving it to
`pg_cron` requires separately reviewed production infrastructure. Business audit history is not
deleted.

## Browser and response hardening

M12 adds a per-request nonce CSP, private/no-store handling for authentication-aware routes and a
proxy bypass for static media such as MP4. The CSP allows the exact Supabase origin for network
connections and local media only. WhatsApp is external navigation and is not a `connect-src`.

This milestone adds no service-role key, dependency, deployment or background process.
