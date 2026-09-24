#!/usr/bin/env bash
# Monthly backup + restore drill (automates the procedure verified manually in M15,
# see docs/operations/backup-restore.md). Interactive on purpose: the database
# password and the GPG passphrase are typed by the operator and never stored.
#
#   bash scripts/backup-drill.sh
#
# 1. read-only, TLS verify-full connection to the Supabase session pooler
# 2. inventory of the source (before and after the export, to detect concurrent writes)
# 3. pg_dump of the public and private schemas (custom format)
# 4. GPG AES256 encryption, decryption check, removal of the clear copy
# 5. restore into a throw-away PostgreSQL container WITHOUT network, then compare
#    tables, row counts, functions, policies, grants and financial invariants
# 6. optional copy to an external disk, and one line in the drill journal
#
# Loopback sources (127.0.0.1 / localhost) are accepted without TLS for rehearsing the
# script against a local `supabase start`; any other host requires verify-full + CA.
set -euo pipefail
umask 077

repo="$(cd "$(dirname "$0")/.." && pwd)"
backup_root="${BACKUP_ROOT:-/home/miro/centre-dentaire-ouahid-backups}"
image="${DRILL_POSTGRES_IMAGE:-docker.io/library/postgres:17}"
engine="${CONTAINER_ENGINE:-podman}"
started_at="$(date -u +%s)"
stamp="$(date -u +%Y-%m-%dT%H-%M-%SZ)"
step() { printf '\n\033[1m== %s\033[0m\n' "$*"; }
fail() { printf '\n\033[31mÉCHEC : %s\033[0m\n' "$*" >&2; exit 1; }

[ -d "$backup_root" ] || fail "dossier de sauvegarde absent : $backup_root"
backup_root="$(realpath -- "$backup_root")"
case "$backup_root/" in "$repo/"*) fail "le dossier de sauvegarde ne doit pas être dans le dépôt" ;; esac
command -v gpg >/dev/null || fail "gpg introuvable"
"$engine" image exists "$image" 2>/dev/null || "$engine" pull -q "$image" >/dev/null

step "1/6 Connexion à la base source"
PGHOST="${PGHOST:-}"; PGPORT="${PGPORT:-5432}"; PGUSER="${PGUSER:-}"; PGDATABASE="${PGDATABASE:-postgres}"
[ -n "$PGHOST" ] || read -rp "Hôte session pooler (ex. aws-1-eu-west-1.pooler.supabase.com) : " PGHOST
[ -n "$PGUSER" ] || read -rp "Utilisateur (ex. postgres.<ref du projet>) : " PGUSER
if [ -z "${PGPASSWORD:-}" ]; then read -rsp "Mot de passe de la base (non affiché) : " PGPASSWORD; echo; fi
export PGHOST PGPORT PGUSER PGDATABASE PGPASSWORD
trap 'unset PGPASSWORD' EXIT
export PGCONNECT_TIMEOUT=15 PGOPTIONS='-c default_transaction_read_only=on'
tls_mounts=()
case "$PGHOST" in
  127.0.0.1|localhost)
    export PGSSLMODE=disable; tls_label="local rehearsal (loopback, no TLS)" ;;
  *)
    ca="${SUPABASE_CA_CERT:-/home/miro/Téléchargements/prod-ca-2021.crt}"
    [ -r "$ca" ] || fail "certificat CA Supabase introuvable : $ca (Dashboard > Database > SSL)"
    export PGSSLMODE=verify-full PGSSLROOTCERT=/run/supabase-ca.crt
    tls_mounts=(--mount "type=bind,src=$ca,target=/run/supabase-ca.crt,ro")
    tls_label="verify-full; CA mounted read-only" ;;
esac
client=("$engine" run --rm -i --pull=never --read-only --cap-drop=all --security-opt=no-new-privileges
  --security-opt=label=disable --network=host "${tls_mounts[@]}"
  --env PGHOST --env PGPORT --env PGUSER --env PGDATABASE --env PGPASSWORD --env PGSSLMODE
  --env PGSSLROOTCERT --env PGCONNECT_TIMEOUT --env PGOPTIONS "$image")
source_psql() { "${client[@]}" psql -X -w -q -v ON_ERROR_STOP=1 "$@"; }
source_psql -At -c "select 'connecté : PostgreSQL ' || current_setting('server_version') || case when (select ssl from pg_stat_ssl where pid = pg_backend_pid()) then ', TLS' else '' end" \
  || fail "connexion impossible (réseau, mot de passe ou certificat) — aucun export n'a été fait"
echo "Transport : $tls_label"

work="$(mktemp -d "$backup_root/drill-$stamp-XXXXXX")"
chmod 700 "$work"
echo "Dossier : $work"

# One JSON document describing the application schemas; identical on source and restore.
inventory_sql=$(cat <<'SQL'
select json_build_object(
  'tables', (select coalesce(json_agg(json_build_object('name', n.nspname || '.' || c.relname, 'rls', c.relrowsecurity,
      'rows', (xpath('/row/c/text()', query_to_xml(format('select count(*) as c from %I.%I', n.nspname, c.relname), false, true, '')))[1]::text::bigint)
      order by n.nspname, c.relname), '[]')
    from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname in ('public', 'private') and c.relkind in ('r', 'p')),
  'functions', (select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname in ('public', 'private')),
  'security_definer_without_search_path', (select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname in ('public', 'private') and p.prosecdef and not exists (select 1 from unnest(coalesce(p.proconfig, '{}')) c where c like 'search_path=%')),
  'function_signature', (select md5(coalesce(string_agg(x, '|' order by x), '')) from (
    select n.nspname || '.' || p.proname || '(' || pg_get_function_identity_arguments(p.oid) || ')' || p.prosecdef::text || coalesce(array_to_string(p.proconfig, ','), '') || md5(p.prosrc) as x
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname in ('public', 'private')) f),
  'constraints', (select count(*) from pg_constraint k join pg_namespace n on n.oid = k.connamespace where n.nspname in ('public', 'private')),
  'indexes', (select count(*) from pg_indexes where schemaname in ('public', 'private')),
  'triggers', (select count(*) from pg_trigger t join pg_class c on c.oid = t.tgrelid join pg_namespace n on n.oid = c.relnamespace where n.nspname in ('public', 'private') and not t.tgisinternal),
  'policies', (select count(*) from pg_policies where schemaname in ('public', 'private')),
  'policy_signature', (select md5(coalesce(string_agg(x, '|' order by x), '')) from (
    select schemaname || '.' || tablename || '.' || policyname || ':' || cmd || ':' || coalesce(qual, '') || ':' || coalesce(with_check, '') as x
    from pg_policies where schemaname in ('public', 'private')) p),
  'grant_signature', (select md5(coalesce(string_agg(x, '|' order by x), '')) from (
    select n.nspname || '.' || c.relname || ':' || coalesce(r.rolname, 'PUBLIC') || ':' || a.privilege_type as x
    from pg_class c join pg_namespace n on n.oid = c.relnamespace
    cross join lateral aclexplode(coalesce(c.relacl, acldefault('r', c.relowner))) a
    left join pg_roles r on r.oid = a.grantee
    where n.nspname in ('public', 'private') and c.relkind in ('r', 'p', 'v')) g),
  'financial_violations', json_build_object(
    'invalid_payments', (select count(*) from public.payments where amount <= 0),
    'invalid_interventions', (select count(*) from public.interventions where amount_due < 0),
    'overpaid_patients', (select count(*) from (select p.patient_id from public.payments p where p.status = 'received' group by p.patient_id
      having sum(p.amount) > coalesce((select sum(i.amount_due) from public.interventions i where i.patient_id = p.patient_id and i.status = 'performed'), 0)) o))
)
SQL
)

step "2/6 Inventaire de la source (lecture seule)"
source_psql -At -c "$inventory_sql" > "$work/source-inventory-before.json"
python3 -c 'import json,sys; d=json.load(open(sys.argv[1])); print(len(d["tables"]), "tables,", sum(t["rows"] for t in d["tables"]), "lignes,", d["functions"], "fonctions,", d["policies"], "politiques RLS")' "$work/source-inventory-before.json"

step "3/6 Export pg_dump (public, private)"
"$engine" run --rm --pull=never --read-only --cap-drop=all --security-opt=no-new-privileges --security-opt=label=disable --network=host \
  "${tls_mounts[@]}" --mount "type=bind,src=$work,target=/backup,rw" \
  --env PGHOST --env PGPORT --env PGUSER --env PGDATABASE --env PGPASSWORD --env PGSSLMODE --env PGSSLROOTCERT --env PGCONNECT_TIMEOUT --env PGOPTIONS \
  "$image" pg_dump --no-password --format=custom --schema=public --schema=private --strict-names --lock-wait-timeout=10000 --file=/backup/application.dump \
  || fail "pg_dump a échoué"
chmod 600 "$work/application.dump"
test -s "$work/application.dump" || fail "archive vide"
source_psql -At -c "$inventory_sql" > "$work/source-inventory.json"
cmp -s "$work/source-inventory-before.json" "$work/source-inventory.json" \
  || fail "la base a changé pendant l'export (écritures en cours) : relancer en dehors des heures d'ouverture"
rm "$work/source-inventory-before.json"
dump_sha="$(sha256sum "$work/application.dump" | cut -d' ' -f1)"
dump_bytes="$(stat -c %s "$work/application.dump")"
pg_dump_version="$("$engine" run --rm --pull=never --network=none "$image" pg_dump --version | awk '{print $3}')"
echo "Archive : $dump_bytes octets, SHA-256 $dump_sha"

step "4/6 Chiffrement GPG AES256 et contrôle du déchiffrement"
gpg_args=()
if [ -n "${BACKUP_DRILL_PASSPHRASE_FILE:-}" ]; then gpg_args=(--batch --pinentry-mode loopback --passphrase-file "$BACKUP_DRILL_PASSPHRASE_FILE"); fi
gpg "${gpg_args[@]}" --quiet --symmetric --cipher-algo AES256 --output "$work/application.dump.gpg" "$work/application.dump"
chmod 600 "$work/application.dump.gpg"
decrypted_sha="$(gpg "${gpg_args[@]}" --quiet --decrypt "$work/application.dump.gpg" | sha256sum | cut -d' ' -f1)"
[ "$decrypted_sha" = "$dump_sha" ] || fail "le contenu déchiffré ne correspond pas à l'archive"
gpg_sha="$(sha256sum "$work/application.dump.gpg" | cut -d' ' -f1)"
echo "Déchiffrement vérifié. Archive chiffrée : SHA-256 $gpg_sha"

step "5/6 Restauration dans un conteneur jetable sans réseau"
target="drill-restore-$(date +%s)-$RANDOM"
cleanup_target() { [ -n "${DRILL_KEEP_TARGET:-}" ] || "$engine" rm -f "$target" >/dev/null 2>&1 || true; }
trap 'unset PGPASSWORD; cleanup_target' EXIT
restore_started="$(date -u +%s)"
"$engine" run -d --name "$target" --network=none --cap-drop=all --cap-add=CHOWN,DAC_OVERRIDE,FOWNER,SETGID,SETUID \
  --security-opt=no-new-privileges --security-opt=label=disable --tmpfs /var/lib/postgresql/data:rw,size=2g \
  --mount "type=bind,src=$work,target=/backup,ro" -e POSTGRES_HOST_AUTH_METHOD=trust -e POSTGRES_DB=drill_restore "$image" >/dev/null
for _ in $(seq 1 60); do "$engine" exec "$target" pg_isready -U postgres -d drill_restore >/dev/null 2>&1 && break; sleep 1; done
sleep 2
target_psql() { "$engine" exec -i "$target" psql -X -q -U postgres -d drill_restore -v ON_ERROR_STOP=1 "$@"; }
target_restore() { "$engine" exec "$target" pg_restore -U postgres -d drill_restore --exit-on-error --single-transaction "$@" /backup/application.dump; }

# Platform prerequisites (roles, extensions, Auth stubs) that live outside public/private.
roles="$("$engine" exec "$target" pg_restore --schema-only -f - /backup/application.dump \
  | grep -oE '(OWNER TO|FOR ROLE|GRANT [A-Z, ]+ ON [^;]+ TO|REVOKE [A-Z, ]+ ON [^;]+ FROM) [^; ]+( *, *[^; ]+)*' \
  | sed -E 's/.*(OWNER TO|FOR ROLE|TO|FROM) //' | tr ',' '\n' | tr -d ' "' \
  | grep -vE '^(PUBLIC|postgres|pg_database_owner)$' | sort -u)"
{
  for role in $roles; do echo "do \$\$ begin if not exists (select 1 from pg_roles where rolname = '$role') then create role \"$role\" nologin; end if; end \$\$;"; done
  cat <<'SQL'
-- The archive recreates schema public with its own ACL: drop the empty default one.
drop schema if exists public;
create schema if not exists extensions;
create extension if not exists pgcrypto with schema extensions;
create extension if not exists "uuid-ossp" with schema extensions;
create extension if not exists pg_trgm with schema extensions;
create extension if not exists btree_gist with schema extensions;
create schema if not exists auth;
create table if not exists auth.users (id uuid primary key);
create or replace function auth.jwt() returns jsonb language sql stable as $$
  select coalesce(nullif(current_setting('request.jwt.claim', true), ''), nullif(current_setting('request.jwt.claims', true), ''))::jsonb $$;
create or replace function auth.uid() returns uuid language sql stable as $$ select nullif(auth.jwt() ->> 'sub', '')::uuid $$;
create or replace function auth.role() returns text language sql stable as $$ select auth.jwt() ->> 'role' $$;
create or replace function auth.email() returns text language sql stable as $$ select auth.jwt() ->> 'email' $$;
SQL
} | target_psql >/dev/null || fail "préparation de la cible"

target_restore --section=pre-data || fail "restauration pre-data"
target_restore --section=data || fail "restauration des données"
# Foreign-key anchors: identity ids referenced by clinic rows (UUID only, no Auth data).
"$engine" exec "$target" pg_restore --section=post-data -f - /backup/application.dump \
  | tr '\n' ' ' | grep -oE 'ALTER TABLE ONLY [a-z_]+\.[a-z_]+ +ADD CONSTRAINT [a-z_0-9]+ FOREIGN KEY \([a-z_]+\) REFERENCES auth\.users\(id\)' \
  | sed -E 's/ALTER TABLE ONLY ([a-z_.]+) +ADD CONSTRAINT [a-z_0-9]+ FOREIGN KEY \(([a-z_]+)\).*/insert into auth.users(id) select distinct \2 from \1 where \2 is not null on conflict do nothing;/' \
  | target_psql >/dev/null || fail "ancrages auth.users"
target_restore --section=post-data || fail "restauration post-data (contraintes, index, triggers, politiques)"
restore_seconds=$(( $(date -u +%s) - restore_started ))
target_psql -At -c "$inventory_sql" > "$work/restore-inventory.json"

python3 - "$work" "$restore_seconds" <<'PY' || fail "la restauration ne correspond pas à la source (voir restore-verification.json)"
import json, sys
work, seconds = sys.argv[1], int(sys.argv[2])
source = json.load(open(f"{work}/source-inventory.json"))
restored = json.load(open(f"{work}/restore-inventory.json"))
checks = {key: source[key] == restored[key] for key in ["tables", "functions", "function_signature", "constraints", "indexes", "triggers", "policies", "policy_signature", "grant_signature"]}
checks["no_security_definer_without_search_path"] = restored["security_definer_without_search_path"] == 0
checks["financial_invariants"] = all(value == 0 for value in restored["financial_violations"].values())
report = {
    "target": {"classification": "LOCAL DISPOSABLE", "network": "none", "published_ports": 0, "connection": "container-local socket"},
    "checks": checks,
    "inventory_counts": {"tables": len(restored["tables"]), "rows": sum(t["rows"] for t in restored["tables"]), **{k: restored[k] for k in ["functions", "constraints", "indexes", "triggers", "policies"]}},
    "financial_violation_counts": restored["financial_violations"],
    "restore_seconds": seconds,
    "auth_recovery": "UUID-only foreign-key anchors, not Auth identities or MFA",
}
json.dump(report, open(f"{work}/restore-verification.json", "w"), indent=2)
for name, ok in checks.items(): print(("  ok   " if ok else "  ÉCART ") + name)
mismatched = [t["name"] for t, r in zip(source["tables"], restored["tables"]) if t != r] if len(source["tables"]) == len(restored["tables"]) else ["nombre de tables différent"]
if mismatched: print("  tables en écart :", ", ".join(mismatched))
print(f"  {report['inventory_counts']['tables']} tables, {report['inventory_counts']['rows']} lignes restaurées en {seconds} s")
sys.exit(0 if all(checks.values()) else 1)
PY
cleanup_target
rm "$work/application.dump" "$work/restore-inventory.json"
echo "Copie en clair supprimée (suppression de fichier, pas effacement sécurisé)."

step "6/6 Copie externe et journal"
offsite="non"
external="${BACKUP_EXTERNAL_DIR:-}"
if [ -z "$external" ] && [ -t 0 ]; then read -rp "Dossier du disque externe (vide pour ignorer) : " external; fi
if [ -n "$external" ]; then
  [ -d "$external" ] || fail "dossier externe introuvable : $external"
  cp "$work/application.dump.gpg" "$external/application-$stamp.dump.gpg"
  sync
  [ "$(sha256sum "$external/application-$stamp.dump.gpg" | cut -d' ' -f1)" = "$gpg_sha" ] || fail "copie externe corrompue"
  offsite="oui (SHA-256 vérifié)"
fi
commit="$(git -C "$repo" rev-parse --short HEAD 2>/dev/null || echo inconnu)"
python3 - "$work" <<PY
import json
json.dump({"timestamp": "$stamp", "git_commit": "$commit", "pg_dump_version": "$pg_dump_version", "schemas": ["public", "private"],
  "sha256": "$dump_sha", "bytes": $dump_bytes, "encrypted_sha256": "$gpg_sha", "tls": "$tls_label", "encrypted": True,
  "restore_verified": True, "restore_report": "restore-verification.json", "external_copy": "$offsite"}, open("$work/metadata.json", "w"), indent=2)
PY
journal="$backup_root/journal-restauration.tsv"
[ -f "$journal" ] || printf 'date_utc\tcommit\tsha256_chiffre\ttables\tlignes\trestauration_s\tcopie_externe\tstatut\n' > "$journal"
python3 - "$work" "$journal" "$stamp" "$commit" "$gpg_sha" "$offsite" <<'PY'
import json, sys
work, journal, stamp, commit, sha, offsite = sys.argv[1:]
report = json.load(open(f"{work}/restore-verification.json"))
counts = report["inventory_counts"]
open(journal, "a").write(f"{stamp}\t{commit}\t{sha}\t{counts['tables']}\t{counts['rows']}\t{report['restore_seconds']}\t{offsite}\tOK\n")
PY
echo "Journal : $journal"
printf '\n\033[32mExercice réussi en %s s. Archive chiffrée : %s\033[0m\n' "$(( $(date -u +%s) - started_at ))" "$work/application.dump.gpg"
