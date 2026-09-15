import {
  createIpPolicyAction,
  disableIpPolicyAction,
  setUserActiveAction,
} from "@/app/(dashboard)/security/actions";
import type { SecurityCenterData, SecuritySeverity } from "@/lib/security/data";
import { PendingSubmitButton } from "@/components/ui/pending-submit-button";

const dateTime = new Intl.DateTimeFormat("fr-MA", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "Africa/Casablanca",
});

const eventLabels: Record<string, string> = {
  "auth.login_succeeded": "Connexion authentifiée observée",
  "auth.logout": "Déconnexion locale demandée",
  "auth.inactive_account_denied": "Compte inactif refusé",
  "security.rate_limited": "Limite de fréquence atteinte",
  "security.ip_policy_added": "Règle IP ajoutée",
  "security.ip_policy_disabled": "Règle IP désactivée",
  "security.user_deactivated": "Accès utilisateur désactivé",
  "security.user_reactivated": "Accès utilisateur réactivé",
};

const severityLabels: Record<SecuritySeverity, string> = {
  info: "Information",
  warning: "Avertissement",
  critical: "Critique",
};

const severityStyles: Record<SecuritySeverity, string> = {
  info: "border-sky-200 bg-sky-50 text-sky-800",
  warning: "border-amber-200 bg-amber-50 text-amber-900",
  critical: "border-red-200 bg-red-50 text-red-800",
};

function formatDate(value: string | null): string {
  if (!value) return "Non observée";
  const date = new Date(value);
  return Number.isNaN(date.valueOf()) ? "Indisponible" : dateTime.format(date);
}

function EmptyState({ children }: { children: React.ReactNode }) {
  return (
    <p className="rounded-lg border border-dashed border-slate-300 p-5 text-sm text-[var(--muted)]">
      {children}
    </p>
  );
}

function Confirmation() {
  return (
    <label className="flex min-h-11 items-center gap-2 text-xs text-slate-600">
      <input
        className="mt-0.5 size-4"
        name="confirmation"
        required
        type="checkbox"
        value="confirmed"
      />
      Je confirme cette action de sécurité.
    </label>
  );
}

export function SecurityCenter({
  data,
  notice,
}: {
  data: SecurityCenterData;
  notice?: { tone: "success" | "error"; message: string };
}) {
  const usersById = new Map(data.users.map((user) => [user.id, user]));
  const cards = [
    ["Événements 24 h", data.summary.events24h],
    ["Alertes sur 14 jours", data.summary.alerts14d],
    ["Règles IP actives", data.summary.activeIpPolicies],
    ["Utilisateurs actifs", data.summary.activeUsers],
  ] as const;

  return (
    <div className="mt-6 space-y-8">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-[var(--muted)]">
          Dernière actualisation : {formatDate(data.generatedAt)}
        </p>
        <nav
          aria-label="Sections du centre de sécurité"
          className="flex flex-wrap gap-2 text-sm font-semibold"
        >
          {[
            ["#activity", "Activité"],
            ["#connections", "Connexions"],
            ["#ip-policies", "Règles IP"],
            ["#users", "Utilisateurs"],
          ].map(([href, label]) => (
            <a
              className="inline-flex min-h-11 items-center rounded-full border border-[var(--border)] bg-white px-3 py-1.5 hover:border-[var(--brand)]"
              href={href}
              key={href}
            >
              {label}
            </a>
          ))}
        </nav>
      </div>

      {notice ? (
        <p
          aria-live="polite"
          className={`rounded-lg border px-4 py-3 text-sm ${notice.tone === "success" ? "border-emerald-200 bg-emerald-50 text-emerald-900" : "border-red-200 bg-red-50 text-red-800"}`}
          role={notice.tone === "error" ? "alert" : "status"}
        >
          {notice.message}
        </p>
      ) : null}

      <section
        aria-label="Résumé de sécurité"
        className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"
      >
        {cards.map(([label, value]) => (
          <article
            className="rounded-lg border border-[var(--border)] bg-white p-5 shadow-xs"
            key={label}
          >
            <p className="text-sm font-medium text-[var(--muted)]">{label}</p>
            <p className="mt-2 text-3xl font-semibold text-slate-950">{value}</p>
          </article>
        ))}
      </section>

      <section
        className="scroll-mt-24 rounded-lg border border-[var(--border)] bg-white p-5 shadow-xs sm:p-6"
        id="activity"
      >
        <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-xl font-semibold text-slate-950">Activité de sécurité</h2>
            <p className="mt-1 text-sm text-[var(--muted)]">
              50 événements maximum, du plus récent au plus ancien, sur les 14 derniers jours.
            </p>
          </div>
          <p className="text-xs text-[var(--muted)]">Critiques : {data.summary.critical14d}</p>
        </div>
        <div className="mt-5 space-y-3">
          {data.events.length ? (
            data.events.map((event) => {
              const user = event.userId ? usersById.get(event.userId) : undefined;
              return (
                <article
                  className="grid gap-3 rounded-lg border border-slate-200 p-4 lg:grid-cols-[minmax(0,1fr)_auto]"
                  key={event.id}
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={`rounded-full border px-2.5 py-1 text-xs font-bold ${severityStyles[event.severity]}`}
                      >
                        {severityLabels[event.severity]}
                      </span>
                      <h3 className="font-semibold">
                        {eventLabels[event.eventType] ?? "Événement de sécurité"}
                      </h3>
                    </div>
                    <p className="mt-2 text-sm text-slate-600">
                      Utilisateur : {user?.fullName ?? "Non identifié"}
                    </p>
                  </div>
                  <div className="text-sm text-slate-600 lg:text-right">
                    <p>{formatDate(event.createdAt)}</p>
                  </div>
                </article>
              );
            })
          ) : (
            <EmptyState>Aucun événement de sécurité récent.</EmptyState>
          )}
        </div>
      </section>

      <section
        className="scroll-mt-24 rounded-lg border border-[var(--border)] bg-white p-5 shadow-xs sm:p-6"
        id="connections"
      >
        <h2 className="text-xl font-semibold text-slate-950">Connexions observées</h2>
        <p className="mt-1 max-w-4xl text-sm text-[var(--muted)]">
          Activité fondée uniquement sur l’utilisateur et l’identifiant de session signés par
          Supabase, actualisée au maximum toutes les dix minutes. Aucune IP ni empreinte d’appareil
          n’est enregistrée. Cette vue ne garantit pas qu’une session de rafraîchissement soit
          encore active.
        </p>
        <div className="mt-5 overflow-x-auto">
          {data.sessions.length ? (
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead className="border-b border-slate-200 text-xs tracking-wide text-slate-500 uppercase">
                <tr>
                  <th className="px-3 py-3">Utilisateur</th>
                  <th className="px-3 py-3">Première observation</th>
                  <th className="px-3 py-3">Dernière activité observée</th>
                  <th className="px-3 py-3">État observé</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.sessions.map((session) => (
                  <tr key={session.id}>
                    <td className="px-3 py-4">
                      <p className="font-semibold">
                        {usersById.get(session.userId)?.fullName ?? "Utilisateur"}
                      </p>
                    </td>
                    <td className="px-3 py-4 text-slate-600">{formatDate(session.firstSeenAt)}</td>
                    <td className="px-3 py-4 text-slate-600">{formatDate(session.lastSeenAt)}</td>
                    <td className="px-3 py-4 font-medium">
                      {session.endedAt ? "Fin locale observée" : "Activité observée"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <EmptyState>Aucune connexion applicative n’a encore été observée.</EmptyState>
          )}
        </div>
      </section>

      <section
        className="scroll-mt-24 rounded-lg border border-[var(--border)] bg-white p-5 shadow-xs sm:p-6"
        id="ip-policies"
      >
        <h2 className="text-xl font-semibold text-slate-950">Règles de blocage IP</h2>
        <p className="mt-1 max-w-4xl text-sm text-[var(--muted)]">
          Ce registre prépare de futures règles pour une couche réseau de confiance (edge/WAF).
          Une IP n’identifie pas une personne et peut représenter plusieurs utilisateurs.
        </p>
        <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-900">
          Enforcement infrastructure pending — aucun blocage réseau actif dans Milestone 09.
        </p>
        <form
          action={createIpPolicyAction}
          className="mt-5 grid gap-4 rounded-lg border border-slate-200 bg-slate-50 p-4 lg:grid-cols-[1fr_1.5fr_auto]"
        >
          <label className="grid gap-1.5 text-sm font-semibold">
            Adresse IP
            <input className="min-h-11 rounded-md border border-slate-300 bg-white px-3 font-mono font-normal" maxLength={64} name="ipAddress" placeholder="203.0.113.10" required />
          </label>
          <label className="grid gap-1.5 text-sm font-semibold">
            Motif
            <input className="min-h-11 rounded-md border border-slate-300 bg-white px-3 font-normal" maxLength={500} minLength={3} name="reason" required />
          </label>
          <label className="grid gap-1.5 text-sm font-semibold">
            Durée
            <select className="min-h-11 rounded-md border border-slate-300 bg-white px-3 font-normal" defaultValue="24h" name="duration">
              <option value="1h">1 heure</option><option value="24h">24 heures</option><option value="7d">7 jours</option>
            </select>
          </label>
          <div className="lg:col-span-2"><Confirmation /></div>
          <PendingSubmitButton className="min-h-11 rounded-md bg-[var(--danger)] px-4 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-60" pendingLabel="Ajout…">Ajouter la règle IP</PendingSubmitButton>
        </form>
        <div className="mt-5 space-y-3">
          {data.ipPolicies.length ? (
            data.ipPolicies.map((policy) => (
              <article className="flex flex-col gap-4 rounded-lg border border-slate-200 p-4 lg:flex-row lg:items-center lg:justify-between" key={policy.id}>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-mono font-semibold">{policy.ipAddress}</p>
                    <span className={`rounded-full px-2 py-1 text-xs font-bold ${policy.isActive ? "bg-amber-50 text-amber-900" : "bg-slate-100 text-slate-600"}`}>
                      {policy.isActive
                        ? "Règle active — enforcement pending"
                        : "Règle inactive ou expirée"}
                    </span>
                  </div>
                  <p className="mt-2 break-words text-sm text-slate-700">{policy.reason}</p>
                  <p className="mt-1 text-xs text-[var(--muted)]">
                    Créée le {formatDate(policy.createdAt)} · Expire le {formatDate(policy.expiresAt)} · Par {usersById.get(policy.blockedBy)?.fullName ?? "Docteur"}
                  </p>
                </div>
                {policy.isActive ? (
                  <form action={disableIpPolicyAction} className="grid shrink-0 gap-2">
                    <input name="blockId" type="hidden" value={policy.id} />
                    <Confirmation />
                    <PendingSubmitButton className="min-h-11 rounded-md border border-slate-300 px-3 text-sm font-semibold hover:bg-slate-50 disabled:opacity-60" pendingLabel="Désactivation…">Désactiver la règle</PendingSubmitButton>
                  </form>
                ) : null}
              </article>
            ))
          ) : (
            <EmptyState>Aucune règle IP enregistrée.</EmptyState>
          )}
        </div>
      </section>

      <section
        className="scroll-mt-24 rounded-lg border border-[var(--border)] bg-white p-5 shadow-xs sm:p-6"
        id="users"
      >
        <h2 className="text-xl font-semibold text-slate-950">Utilisateurs et accès</h2>
        <p className="mt-1 text-sm text-[var(--muted)]">
          La désactivation retire l’accès à l’application. Elle ne supprime pas le compte Supabase
          et ne détruit pas rétroactivement un JWT déjà émis.
        </p>
        <div className="mt-5 grid gap-3">
          {data.users.map((user) => (
            <article className="flex flex-col gap-4 rounded-lg border border-slate-200 p-4 sm:flex-row sm:items-center sm:justify-between" key={user.id}>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="font-semibold">{user.fullName}</h3>
                  <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-bold">{user.role === "doctor" ? "Docteur" : "Assistant(e)"}</span>
                  <span className={`rounded-full px-2 py-1 text-xs font-bold ${user.isActive ? "bg-emerald-50 text-emerald-800" : "bg-red-50 text-red-800"}`}>{user.isActive ? "Actif" : "Inactif"}</span>
                </div>
                <p className="mt-2 text-xs text-[var(--muted)]">
                  Compte créé le {formatDate(user.createdAt)} · Dernière activité observée : {formatDate(user.lastObservedAt)}
                </p>
              </div>
              <form action={setUserActiveAction} className="grid shrink-0 gap-2">
                <input name="userId" type="hidden" value={user.id} />
                <input name="nextState" type="hidden" value={user.isActive ? "inactive" : "active"} />
                <Confirmation />
                <PendingSubmitButton className={`min-h-11 rounded-md px-3 text-sm font-semibold disabled:opacity-60 ${user.isActive ? "border border-red-200 text-red-800 hover:bg-red-50" : "bg-[var(--brand)] text-white hover:bg-[var(--brand-strong)]"}`} pendingLabel="Modification…">
                  {user.isActive ? "Désactiver l’accès" : "Réactiver l’accès"}
                </PendingSubmitButton>
              </form>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
