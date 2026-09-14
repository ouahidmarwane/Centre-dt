# Security Center operational policy

Milestone 09 does not implement application-level pre-authentication login rate limiting. The
application relies on Supabase Auth's native protections until a later milestone introduces a
trusted edge/server boundary. No Milestone 09 RPC is granted to `anon`.

The private PostgreSQL counter is retained only for authenticated doctor administration. Adding
or disabling an IP policy and changing an account state are each limited to six operations per
doctor in five minutes. These controls fail closed and execute in the same transaction as the
protected mutation. Expired counter rows are removed opportunistically.

The IP list is a policy registry, not an active network blocklist. The browser and the current
Next.js runtime do not provide a trusted client-network identity to PostgreSQL, so Milestone 09
does not claim to enforce those policies. Actual IP enforcement is deferred until a reviewed
edge/WAF integration can supply trusted network context. RPC callers cannot submit a "current IP"
or another network value as authoritative context.

`user_sessions` is an application observation registry. The user and session identifiers come
from signed Supabase JWT claims, and its timestamps are updated no more than once every ten
minutes. IP addresses, user-agent strings, access tokens, refresh tokens and cookies are not
stored or displayed. The registry does not prove that a Supabase refresh session remains active.

Security events cover authenticated session observation, local logout requests, inactive-account
denials, authenticated administration and administrative rate limits. Failed login, forbidden
route and blocked-network events are not claimed because this application boundary cannot observe
them reliably. Events are shown for a strict 14-day window with an initial limit of 50 records;
storage cleanup is opportunistic after 90 days. Generic business audit history is not deleted.

This milestone adds no service-role key, external dependency, deployment or background process.
