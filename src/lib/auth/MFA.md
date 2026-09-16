# Doctor TOTP operations

The legitimate doctor must complete the first TOTP enrollment from the trusted
clinic workstation **before** clinical production use or exposure. Before a
verified factor exists, software cannot distinguish that doctor from an
attacker who already possesses the password.

Once one verified TOTP factor exists, application enrollment is locked and the
doctor is routed to the challenge. Active doctor application access requires
exactly one verified TOTP factor **and** AAL2. More than one verified TOTP factor
fails closed regardless of AAL and requires administrative review. Zero verified
factors at AAL1 routes to enrollment; zero at AAL2 is anomalous and fails closed
through the forbidden path. Failed or malformed factor enumeration also fails
closed. The doctor factor-count policy does not apply to assistants.

There is intentionally no self-service factor removal, replacement, disabling,
second-factor enrollment, or recovery bypass. Recovery is a future, separately
reviewed administrative procedure. There is no assistant MFA-reset workflow and
no application backdoor. A lost authenticator requires administrative recovery;
the exact recovery procedure and current Supabase Dashboard controls must be
verified immediately before production reliance rather than inferred here.
Enrollment secrets, QR payloads, setup URIs,
TOTP codes, session tokens, and factor secrets must never be logged or persisted.

The bootstrap profile RPC is routing information only. It never authorizes
clinic data or operations; effective database authority, RLS, business RPCs,
and `requirePermission` remain authoritative.

MFA protects against password-only compromise. It does not neutralize a stolen
active AAL2 session. Profile deactivation removes application authority through
RLS and RPC checks, but does not necessarily destroy the underlying GoTrue
refresh session. Browser closure is not treated as a guaranteed logout, and no
fixed AAL2 expiration duration is claimed.
