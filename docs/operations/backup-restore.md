# Sauvegarde et restauration — opérateur

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
