# Sauvegarde et restauration — opérateur

## Exercice mensuel automatisé (depuis le 24 septembre 2026)

La procédure M15 ci-dessous est automatisée par `npm run backup:drill`
(`scripts/backup-drill.sh`). À lancer chaque mois, hors heures d'ouverture, disque
externe branché ; un rappel systemd utilisateur s'affiche le 1er de chaque mois à
10:00 (`scripts/install-backup-reminder.sh`, rattrapé à la connexion si le poste
était éteint). Le script, interactif, ne stocke ni mot de passe DB ni phrase GPG :

1. connexion session pooler en lecture seule, TLS `verify-full` avec le CA monté
   en lecture seule (`SUPABASE_CA_CERT`, défaut `~/Téléchargements/prod-ca-2021.crt`) ;
2. inventaire de la source avant et après l'export ; tout écart (écriture pendant
   l'export) arrête l'exercice ;
3. `pg_dump` custom de `public` et `private` ;
4. chiffrement GPG AES256, déchiffrement et comparaison SHA-256, suppression de la
   copie claire (suppression de fichier, pas effacement sécurisé) ;
5. restauration pre-data / data / post-data dans un conteneur `postgres:17` jetable
   `--network=none`, données en tmpfs, avec les mêmes prérequis de plateforme que M15
   (rôles NOLOGIN, extensions, substituts `auth.*`, ancrages UUID) ; comparaison des
   tables et nombres de lignes, fonctions (définitions, SECURITY DEFINER, search_path),
   contraintes, index, triggers, politiques RLS, droits et invariants financiers ;
6. copie facultative sur le disque externe avec SHA-256 vérifié, `metadata.json`,
   `restore-verification.json` et une ligne dans `journal-restauration.tsv` du
   dossier de sauvegarde (aucune donnée patient ni secret).

Mêmes limites que M15 : ni identités Auth, ni facteurs MFA, ni Storage. Le réseau
utilisé doit laisser passer PostgreSQL (5432) vers le pooler : le 24 septembre, le
réseau du poste bloquait ce trafic alors que HTTPS passait.

## M15 — procédure réellement vérifiée le 16 septembre 2026

Une archive custom `public/private` a été créée hors dépôt après préflight
libpq `verify-full` et confirmation TLS côté client par `psql`. Source :
PostgreSQL 17.6 ; clients PostgreSQL officiels 17.11 déjà présents dans l'image
locale `docker.io/library/postgres:17`, utilisés avec Podman 5.8.4. Aucun outil
installé, aucun chemin `supabase db dump` non vérifié utilisé, aucun secret
de connexion affiché. Le CA original a seulement été monté read-only.

Le contrôle des labels empêchait la lecture du bind mount. `label=disable`
a été limité aux conteneurs éphémères, sans modifier le certificat ni SELinux
système ; clients read-only, capabilities retirées et no-new-privileges.
Ce compromis local doit être relu sur tout autre poste. TLS n'a jamais été
désactivé. `pg_stat_ssl` côté serveur derrière le pooler ne prouve pas le TLS
du frontend : c'est `psql` côté client et `verify-full` qui ont été contrôlés.

### Export reproductible — nouvelle autorisation pour toute nouvelle exécution

Référence Bash, non exécutée automatiquement. Saisir les métadonnées depuis
la connexion session-pooler vérifiée, sans URL avec password. Ne jamais sourcer
`.env.local` comme du code shell ni publier les sorties de connexion.

```bash
set -euo pipefail
umask 077
task_repo="$(git rev-parse --show-toplevel)"
task_root=/home/miro/centre-dentaire-ouahid-backups
task_root="$(realpath -- "$task_root")"  # destination existante approuvée
case "$task_root/" in "$task_repo/"*) exit 1 ;; esac
test -r "$task_repo/supabase/.temp/prod-ca-2021.crt"
read -rp 'Host session-pooler vérifié : ' PGHOST
read -rp 'Port session-pooler vérifié : ' PGPORT
read -rp 'Utilisateur PostgreSQL : ' PGUSER
read -rp 'Base source vérifiée : ' PGDATABASE
read -rsp 'Password DB (non affiché) : ' PGPASSWORD
echo
export PGHOST PGPORT PGUSER PGDATABASE PGPASSWORD
export PGSSLMODE=verify-full PGSSLROOTCERT=/run/supabase-ca.crt
export PGCONNECT_TIMEOUT=10 PGOPTIONS='-c default_transaction_read_only=on'
trap 'unset PGPASSWORD' EXIT
task_client=(podman run --rm --pull=never --read-only --cap-drop=all
  --security-opt=no-new-privileges --security-opt=label=disable --network=host
  --mount "type=bind,src=$task_repo/supabase/.temp/prod-ca-2021.crt,target=/run/supabase-ca.crt,ro"
  --env PGHOST --env PGPORT --env PGUSER --env PGDATABASE --env PGPASSWORD
  --env PGSSLMODE --env PGSSLROOTCERT --env PGCONNECT_TIMEOUT --env PGOPTIONS)
"${task_client[@]}" docker.io/library/postgres:17 psql -X -w -v ON_ERROR_STOP=1 \
  -c '\conninfo' -c 'BEGIN READ ONLY; SELECT 1; ROLLBACK;'
# STOP si échec ou TLS côté client non confirmé ; aucun downgrade.
task_stamp="$(date -u +%Y%m%dT%H%M%SZ)"
task_dir="$(mktemp -d "$task_root/m15-$task_stamp-XXXXXX")"
"${task_client[@]}" --mount "type=bind,src=$task_dir,target=/backup,rw" \
  docker.io/library/postgres:17 pg_dump --no-password --format=custom \
  --schema=public --schema=private --strict-names --lock-wait-timeout=10000 \
  --file=/backup/application.dump
chmod 600 "$task_dir/application.dump"
test -s "$task_dir/application.dump"
podman run --rm --pull=never --read-only --network=none --cap-drop=all \
  --security-opt=no-new-privileges --security-opt=label=disable \
  --mount "type=bind,src=$task_dir,target=/backup,ro" \
  docker.io/library/postgres:17 pg_restore --list /backup/application.dump >/dev/null
sha256sum "$task_dir/application.dump"
unset PGPASSWORD
```

Conserver timestamp UTC, commit, versions, schémas, taille et SHA-256 sans
credential. L'exécution M15 a aussi conservé un snapshot exporté en transaction
read-only repeatable-read pour comparer les counts à ceux de l'archive.
`pg_dump --snapshot` a utilisé ce snapshot ; aucun changement source.
Les rôles globaux ne sont pas exportés par ce périmètre : prévoir les rôles
de plateforme dans la cible, sans mot de passe ni clé privilégiée dans le dépôt.

### Répétition de restauration vérifiée, portée limitée

Nouveaux conteneurs PostgreSQL 17.11 sans réseau (`--network=none`), aucun
port publié, base `m15_restore` accessible uniquement par socket Unix interne,
données en tmpfs. Identité/version/cible vide contrôlées avant restore. Archive
montée read-only ; aucune connexion distante de restauration.

Prérequis locaux : rôles NOLOGIN nécessaires aux ACL, extensions `pg_trgm`,
`pgcrypto`, `uuid-ossp` dans `extensions`, définitions de `auth.uid()` et
`auth.jwt()`, et table `auth.users(id uuid primary key)` minimale. Les UUID
d'ancrage ont été dérivés des profils restaurés, sans importer GoTrue users,
passwords, sessions ou facteurs. Ce substitut ne permet aucune authentification
réelle et ne prouve PAS une récupération d'identité Supabase.

Restore PostgreSQL natif par sections pre-data, data et post-data, chacune avec
`--exit-on-error --single-transaction`. Ancrages FK créés entre data/post-data.
Le grant USAGE public attendu par pg_dump sur un schéma public initialisé a
été reproduit uniquement parce qu'il existait à la source, avec son grantor
`pg_database_owner` ; pas de grant supplémentaire. ACL comparées avec leurs
defaults résolus et sans dépendance à l'ordre/collation. Les 28 CHECK dont
le déparseur a aplati les AND ont été reparsés par PostgreSQL sur des tables
temporaires vides, sans modifier les données restaurées : même expression cible.

Résultat final : 24 tables, 55 fonctions (définitions/search_path/SECURITY DEFINER),
173 contraintes, 83 index, 11 triggers, 26 politiques et comptes de lignes
correspondants. Aucun SECURITY DEFINER sans search_path. Vérifications financières
read-only : aucun paiement invalide, intervention négative, incohérence de total
facture/reçu ou surpaiement détecté ; ces tables sont vides, donc aucune preuve
transactionnelle sur données non vides n'est revendiquée.
Tous les conteneurs créés ont été supprimés et leurs tmpfs détruits ; archive
et preuves externes conservées. Aucun restore production.

### Chiffrement, copie externe et couverture — vérifications terminées

Vérification M15.1 réussie, puis finalisation opérateur confirmée : chiffrement
symétrique GPG AES256, déchiffrement réussi, SHA-256 du contenu déchiffré identique
à l'original et `pg_restore --list` réussi sur cette archive déchiffrée. La copie
temporaire déchiffrée a été supprimée après ces contrôles.

Archive chiffrée locale conservée :
`/home/miro/centre-dentaire-ouahid-backups/m15-2026-09-16T12-08-02-396Z-gM5rtN/application.dump.gpg`.
Droits locaux vérifiés après finalisation : `600`, propriétaire `miro:miro`.

| Artefact vérifié | SHA-256 |
| --- | --- |
| Original `application.dump` avant suppression, identique au contenu déchiffré | `cc2ebd6f1494bd9887e791686f8183ee9e9aa1fd9a6b823318ca1be1762b7086` |
| Archive chiffrée locale et seconde copie externe | `5c5a8c9980c562001de649dfc2792e8d46f40b463f8ff9f0552e1b754cff3439` |

Seconde copie chiffrée sur HDD WDC WD2500BEVT-22ZCT0 250 GB, monté lors du
contrôle à `/run/media/miro/B8FEFB7FFEFB346A/`, destination
`Centre-Dentaire-Ouahid-Backups/application.dump.gpg`. Son SHA-256 a été calculé
indépendamment et correspond exactement à celui de l'archive chiffrée locale.
Après `sync`, le disque a été démonté avec succès, mis hors tension puis
physiquement déconnecté. Ce contrôle ne démontre pas un lieu de stockage
géographiquement hors site.

Le fichier clair persistant
`/home/miro/centre-dentaire-ouahid-backups/m15-2026-09-16T12-08-02-396Z-gM5rtN/application.dump`
a été explicitement supprimé seulement après validation locale du chiffrement,
du déchiffrement, de l'équivalence du hash clair, de l'archive et du checksum
externe. Il s'agit d'une suppression de fichier, PAS d'un effacement physique
sécurisé : Btrfs/SSD, CoW, TRIM et snapshots peuvent affecter la récupérabilité.

Les bits Unix permissifs affichés pour le disque NTFS ne prouvent aucune
protection par `chmod` ; la confidentialité de la copie externe repose sur le
chiffrement GPG et sa phrase secrète. Ne jamais demander, documenter ou stocker
cette phrase dans Git ; la gérer séparément du backup, par procédure opérateur.

| Composant | Sauvegardé ici ? | Restaurable seul ? | Reprise séparée |
| --- | --- | --- | --- |
| Tables/données public/private, RLS, RPC, index, triggers | Oui | Avec prérequis de plateforme | Vérification cible/grants |
| Rôles globaux et extensions hors périmètre | Non | Non | Provisionnement compatible |
| Historique migrations | Dans Git au commit identifié, pas dans cette archive | Non depuis cette archive | Réconciliation revue |
| GoTrue utilisateurs/passwords/sessions | Non | Non | Stratégie d'identité autorisée |
| MFA et facteurs utilisables | Non | Non | Identité vérifiée puis réenrôlement administrativement approuvé |
| Objets Storage/configuration Dashboard/secrets externes | Non | Non | Récupération séparée |

Gate 2 Backup/TLS : CLOSED techniquement. Gate 3 Restore rehearsal : CLOSED
techniquement, dans le périmètre applicatif limité décrit ci-dessus.
Chiffrement/vérification de copie externe : CLOSED. Le travail technique M15
de sauvegarde/récupération applicative est terminé, mais ne constitue PAS une
récupération complète de plateforme ou d'identité Supabase. M15 seul ne rend
pas un déploiement production prêt : hébergement, configuration production et
smoke tests restent des gates séparés ; aucune autorisation de déploiement.
Les sections M14/M14.1 ci-dessous sont historiques
et décrivent le chemin CLI non utilisé, pas une méthode désormais autorisée.

Aucun export réel ni restore effectué en M14. Propriétaire + suppléant doivent
désigner un emplacement absolu HORS checkout, chiffré et hors site, et vérifier
les accès avant le premier patient réel. Ne pas stocker SQL, certificats,
identifiants ou journaux contenant des données dans Git.

[Supabase Free](https://supabase.com/docs/guides/platform/backups) ne fournit
pas de sauvegarde quotidienne automatisée ni PITR. Politique cabinet proposée
(pas obligation légale ni SLA) : backup avant premier patient, chaque clôture
de journée ouvrée, avant changement DB à risque et après changement de schéma.
Rétention proposée : 7 quotidiens, 4 hebdomadaires, 3 mensuels, à valider par
le cabinet selon minimisation/besoins. RPO cible ≤ un jour ouvré ; RTO cible ≤
un jour ouvré, à mesurer en répétition. Ce ne sont pas des garanties plateforme.

## Export — gate TLS obligatoire avant toute donnée réelle

CLI officiel existant vérifié localement : `supabase --help` et
`supabase db dump --help`. Ne pas installer un moteur d'export alternatif.
Utiliser la connexion PostgreSQL directe ou session pooler appropriée, avec
certificat CA téléchargé et validé par l'opérateur. Saisir le password de façon
interactive sécurisée ou dans un environnement éphémère accepté par le CLI,
jamais dans URL affichée, historique, commande `--password`, fichier du dépôt
ou logs. Pas de `service_role`.

**STOP avant export si la vérification TLS du processus pg_dump n'est pas
prouvée.** Une connexion Node `rejectUnauthorized: true` avec ce CA ne prouve
pas celle du conteneur CLI. Le dry-run local sur URL fictive n'a pas démontré
la propagation des paramètres `sslmode=verify-full` et `sslrootcert`. Ne pas
supposer qu'une variable hôte ou un chemin CA hôte est transmis/monté dans
Docker. Faire valider par l'opérateur le transport effectif du CLI/pg_dump
(CA accessible dans son contexte, hostname vérifié, mode verify-full effectif),
sans montrer le script généré avec credentials. Aucun export réel tant que
ce point n'est pas résolu. Jamais `no-verify`, `require` seul présenté comme
identité vérifiée, `rejectUnauthorized=false` ou variable de bypass.

Revue M14.1 du CLI installé 2.117.0 :
[`legacyToDumpEnv`](https://github.com/supabase/cli/blob/v2.117.0/apps/cli/src/command-internal/legacy-pg-dump.env.ts)
ne transmet que host/port/user/password/database ;
[`legacyStreamPgDump`](https://github.com/supabase/cli/blob/v2.117.0/apps/cli/src/command-internal/legacy-pg-dump.run.ts)
ne monte aucun fichier hôte. Les scripts n'imposent aucun mode SSL.
Ainsi, les paramètres SSL d'une `--db-url` ou les variables `PGSSLMODE` et
`PGSSLROOTCERT` du shell ne constituent pas une configuration TLS d'export
supportée par ce chemin CLI. [Libpq utilise `prefer` par défaut](https://www.postgresql.org/docs/current/libpq-ssl.html),
pas `verify-full`. Aucun flag CA n'est disponible dans `db dump --help`.
Le précheck Node read-only avec CA a réussi en M14.1, mais le gate d'export
reste ouvert : il faut une méthode officielle/revue transmettant effectivement
CA et verify-full au processus pg_dump, et un préflight dans ce même contexte.
Ne pas exécuter les références ci-dessous telles quelles pour contourner ce gate.

Après résolution du gate, les formes officielles sont les suivantes. Ce bloc
est une référence, PAS une séquence à exécuter maintenant. Remplacer la
destination par un nouveau répertoire externe timestampé UTC, droits 0700,
`umask 077`, sans écraser de sauvegarde. Le projet lié doit être vérifié juste
avant chaque export. Ne pas employer de sortie par défaut dans le checkout.

```bash
npx --no-install supabase db dump --linked --role-only --file /DESTINATION_EXTERNE/NOUVEAU_TIMESTAMP/roles.sql
npx --no-install supabase db dump --linked --schema public,private --file /DESTINATION_EXTERNE/NOUVEAU_TIMESTAMP/schema.sql
npx --no-install supabase db dump --linked --schema public,private --data-only --use-copy --file /DESTINATION_EXTERNE/NOUVEAU_TIMESTAMP/data.sql
npx --no-install supabase db dump --linked --schema supabase_migrations --file /DESTINATION_EXTERNE/NOUVEAU_TIMESTAMP/migrations-schema.sql
npx --no-install supabase db dump --linked --schema supabase_migrations --data-only --use-copy --file /DESTINATION_EXTERNE/NOUVEAU_TIMESTAMP/migrations-data.sql
```

Vérifier `public` ET le schéma applicatif `private`, fonctions, triggers, grants,
RLS et historique migrations dans les sorties. Le dump par défaut exclut des
schémas Supabase gérés : ne pas le présenter comme copie complète de la
plateforme. Attention : les exclusions du dump de schéma et de données diffèrent ;
le dump de données sans `--schema` inclut notamment Auth/Storage, donc des
identités, sessions et informations MFA sensibles. Les références ci-dessus
limitent explicitement schema/data à `public,private` et traitent l'historique
à part : aucun export Auth/MFA implicitement autorisé. Ce périmètre n'est PAS
une sauvegarde complète d'identité et ne résout pas ses foreign keys à lui seul.
[La procédure officielle de migration](https://supabase.com/docs/guides/platform/migrating-within-supabase/backup-restore)
demande une attention distincte à Auth/Storage et aux modifications de ces
schémas. Les objets Storage ne sont pas inclus dans le backup DB. Les lignes
métier référencent Auth : une reprise doit préserver ou réconcilier les
identités avant validation des relations. MFA/Vault chiffrés peuvent dépendre
de clés racines non transférables vers un autre projet : ne pas promettre la
restauration des vrais facteurs ni copier/exporter leurs secrets. L'opérateur
doit valider la stratégie de récupération d'identité avec Supabase ; sinon
la capacité de reprise complète reste NON VALIDÉE.

Vérifier code sortie, présence/taille plausibles de chaque fichier et manifeste
SHA-256. Chiffrer avec un outil déjà approuvé disponible, transférer hors site,
vérifier le checksum du fichier chiffré et faire un essai de déchiffrement en
zone sécurisée. Clé séparée du backup, accessible au suppléant autorisé ; ne
pas joindre la clé à l'archive. Effacer les copies claires uniquement via
procédure approuvée adaptée au support (ne pas promettre un effacement SSD).
Journal minimal : timestamp, cible pseudonymisée, version CLI, commit/migrations,
hashes, statut export/chiffrement/restore, opérateur ; pas de données ni secrets.

## RESTORE — risque élevé, jamais automatique

Une archive n'est pas déclarée restaurable tant qu'une répétition n'a pas réussi.
Préparer une cible locale/jetable explicitement autorisée, isolée des utilisateurs
et messages sortants, PostgreSQL/Supabase compatible et accès restreints. Vérifier
la cible par deux personnes ; aucune connexion implicite au projet production.
Contrôler manifeste, déchiffrement et fichiers ; revoir les rôles pour éviter
les conflits avec rôles gérés et toutes les fonctions SECURITY DEFINER/grants.

Suivre la procédure officielle pour cette cible jetable : rôles adaptés,
schéma, données COPY, historique migrations ; `psql --single-transaction` avec
`--variable ON_ERROR_STOP=1` et TLS vérifié quand la cible est distante.
La désactivation de triggers via `session_replication_role=replica`, lorsqu'elle
est requise par la procédure officielle, est une opération administrateur
exclusive de la cible jetable, jamais un mécanisme de l'application.
Ne pas fournir ici de commande restore pointant vers production.

Valider relations Auth/patient, nombres de lignes sans exposer les valeurs,
RLS/grants/RPC, types/migrations, totaux financiers, liens de documents,
autorisations assistant/docteur et chemin MFA de récupération approuvé.
Une copie contenant du clinique reste sensible même sur cible jetable : protéger
sa destination et faire approuver sa suppression après la répétition. Mesurer
temps/perte possible ; noter anomalies et décision de reprise. Pas de restore
M14, pas de mutation des vrais facteurs pour cette démonstration.

Avant tout restore PRODUCTION : confirmer projet et backup choisi, prendre un
backup frais si possible, contrôler intégrité, prévoir downtime, approuver
RPO/RTO et effets sur données depuis le backup, obtenir approbation humaine
explicite. Geler écritures, préserver preuves et planifier vérifications avant
réouverture. Un revert Git ne restaure pas la DB ; préférer un forward-fix revu
si approprié. Ne jamais lancer reset/wipe/down migrations à l'aveugle.

## Pourquoi aucun script M14

Sans destination externe configurée ni transport TLS de pg_dump prouvé, une
automatisation serait trompeuse. M14 fournit les commandes supportées et les
gates opérateur, pas un script qui contourne le certificat ou produit un vrai
dump pour se tester. Les ignores ciblés sont une défense secondaire, jamais
une autorisation à écrire des exports dans le checkout.
