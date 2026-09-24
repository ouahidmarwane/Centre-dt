# Centre Dentaire Ouahid

Plateforme interne de gestion du Centre Dentaire Ouahid. Elle réunit une
fondation d'authentification et d'autorisation privée avec patients, odontogramme,
interventions/paiements, rendez-vous/rappels WhatsApp et Telegram, ordonnances, documents
financiers, dashboards et Security Center. Le docteur est protégé par MFA AAL2.

## Stack

- Next.js 16 avec App Router et React 19
- TypeScript strict
- Tailwind CSS 4
- Supabase Auth, PostgreSQL et Row Level Security
- Hébergement de production à approuver (Vercel Hobby : usage non commercial)

## Développement local

Prérequis : Node.js 22 ou plus récent et npm.

```bash
npm install
cp .env.example .env.local
npm run dev
```

Vérifications disponibles :

```bash
npm run lint
npm run typecheck
npm test
npm run build
```

## Environnement

Renseigner uniquement `.env.local` en local et les variables d'environnement
du projet Vercel lors du déploiement :

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
```

La clé publiable est exposée au navigateur par conception. Elle ne remplace ni
l'authentification, ni les permissions, ni les politiques RLS. Aucun secret ou
service-role key n'est utilisé par le navigateur.

### Rappels WhatsApp et Telegram

Les rendez-vous à venir disposent d’un bouton **Préparer WhatsApp** : il ouvre
WhatsApp avec un message de confirmation déjà rédigé, sans information clinique
ni financière. Le personnel relit puis envoie le message.

Pour avertir automatiquement le docteur et l’assistante, créez un groupe
Telegram privé, ajoutez-y le bot, puis renseignez les variables serveur suivantes
dans `.env.local` et dans l’hébergeur. Elles ne doivent jamais commencer par
`NEXT_PUBLIC_` :

```env
SUPABASE_SERVICE_ROLE_KEY=
CRON_SECRET=
TELEGRAM_BOT_TOKEN=
TELEGRAM_CHAT_ID=
```

Planifiez une requête `POST` vers `/api/cron/appointment-reminders` toutes les
cinq minutes, avec l’en-tête `Authorization: Bearer <CRON_SECRET>`. Le service
notifie le groupe à H-2 ; pour le premier rendez-vous à 10 h, il attend
l’ouverture à 9 h au lieu d’envoyer un message à 8 h. Chaque alerte est
persistée et ne part qu’une fois ; un échec Telegram est réessayé cinq minutes
plus tard. Avant l’activation, appliquez la migration Supabase ajoutée au dépôt.

## Authentification et autorisation

L'application permet uniquement la connexion par e-mail et mot de passe. Elle
n'expose aucune inscription publique. Le proxy Next.js actualise les cookies
Supabase et effectue une première redirection, puis les Server Components
revalident les claims et chargent le profil actif depuis PostgreSQL.

Les rôles initiaux sont :

- `doctor` : accès complet aux fondations, dont l'archivage patient,
  Comptabilité et Supervision ;
- `assistant` : accès opérationnel aux dossiers patients, sans archivage,
  Comptabilité ni Supervision.

La chaîne de contrôle est :

```text
Visibilité de l'interface
  ↓
Protection des routes
  ↓
Autorisation serveur centralisée
  ↓
Grants PostgreSQL + Supabase RLS
  ↓
Base de données
```

Les clients authentifiés n'ont aucun droit de modification sur `role` ou
`is_active`. Une tentative directe avec la clé publiable est donc refusée au
niveau PostgreSQL, indépendamment de l'interface.

## Gestion des patients

Le module `/patients` permet de rechercher, créer, consulter et modifier un
dossier. L'âge n'est jamais stocké : il est calculé à partir de la date de
naissance. La recherche est exécutée côté serveur, limitée à 100 résultats et
ses termes ne sont pas placés dans l'URL.

Le docteur et l'assistant actifs peuvent saisir et consulter les informations
d'admission, y compris les antécédents et allergies. Cet accès clinique de
l'assistant est volontaire pour permettre la saisie initiale au cabinet. Seul
le docteur peut archiver un dossier. Un patient archivé reste consultable, mais
ne peut plus être modifié par les clients. Il n'existe ni permission ni
politique de suppression physique.

`created_by`, `updated_by`, `created_at`, `updated_at`, `is_active` et
`archived_at` sont contrôlés en base. Les événements `patient.created`,
`patient.updated` et `patient.archived` sont écrits par trigger dans
`audit_logs`; leurs métadonnées restent vides afin de ne dupliquer aucun nom,
téléphone, adresse, antécédent ou allergie.

## Fonctionnalités du quotidien (septembre 2026)

- **Recherche rapide (Ctrl+K / ⌘K)** : patients par nom ou téléphone, pages et
  actions, depuis n'importe quel écran (réutilise `search_patients`).
- **Liste d'attente** (page Rendez-vous) : un patient attend au plus une fois ;
  un rendez-vous annulé apparaît dans « Créneaux libérés » avec les patients
  compatibles (durée, matin/après-midi, urgents d'abord), une proposition
  WhatsApp et la réservation directe (`book_waitlist_entry`).
- **Plans de traitement** (dossier patient) : créés par le docteur ; le devis
  (somme des séances) est figé à l'acceptation ; valider une séance crée une
  intervention réalisée via `create_intervention`. « Reste à payer au total » =
  déjà facturé non réglé + séances restantes des devis acceptés.
- **Recouvrement** (`/payments`) : relance due après 7 jours d'impayé (répartition
  des paiements sur les soins les plus anciens), puis au plus tous les 14 jours ;
  message WhatsApp prérempli, confirmation « C'est envoyé ».
- **Stock** (`/stock`) : entrées, sorties et inventaires historisés, jamais de
  stock négatif, liste de commande par fournisseur ; archivage réservé au docteur.
- **Statistiques** (`/statistics`, docteur) : chiffre d'affaires par type de soin,
  encaissements, nouveaux patients et taux de rendez-vous manqués, sur 12 mois.

Chaque matin après 09:00 (Casablanca), la route cron envoie aussi sur Telegram un
récapitulatif du nombre de relances d'impayés dues et d'articles sous le seuil
(des nombres uniquement, aucune donnée patient).

### Tests d'intégration SQL

`supabase/tests/*.test.sql` exécutent les vraies RPC avec des rôles simulés
(assistante, docteur AAL1/AAL2) dans une transaction toujours annulée. Ils
refusent toute base non locale :

```bash
npx supabase start   # pile locale avec toutes les migrations
npm run test:db      # CONTAINER_ENGINE=podman si Docker n'est pas utilisé
```

## Migrations Supabase

Les migrations historiques approuvées et appliquées sont dans
`supabase/migrations/`. Ne jamais les réécrire. La préparation M14 vérifie
seulement l'alignement ; elle n'applique aucune migration.

Avec le CLI officiel Supabase authentifié :

```bash
npx --no-install supabase db lint --linked
npx --no-install supabase db push --linked --dry-run
```

Vérifier la cible déjà liée avant ces diagnostics. Aucun `db push` réel sans
autorisation distincte, sauvegarde et revue du dry-run. Les tables applicatives
utilisent RLS/grants minimaux et les mutations métier des RPC contrôlées.

### Comptes staff

Les comptes ont été préparés dans les jalons approuvés. Toute création,
promotion, désactivation ou récupération est une opération administrative
explicitement autorisée, jamais une action navigateur privilégiée. Voir les
procédures opérateur ci-dessous ; aucune modification de compte en M14.

## Types de base de données

Les types générés dans `src/types/database.types.ts` reflètent les jalons
appliqués. Ne pas les fabriquer ni les régénérer en changeant implicitement
le périmètre des schémas. M14 n'introduit aucun changement de schéma/types.

## Fondations de sécurité

- Les journaux d'audit et événements de sécurité sont lisibles uniquement par
  un docteur et ne sont pas modifiables par les clients.
- `blocked_ips` utilise le type PostgreSQL `inet`; seules des adresses observées
  dans un contexte serveur de confiance doivent y être enregistrées.
- L'extraction d'IP ne lit `x-vercel-forwarded-for` que lorsque `VERCEL=1`,
  et `VERCEL_ENV=production`, valide IPv4/IPv6 et renvoie `null` sinon. Une IP partagée/NAT ne
  représente jamais une personne et le blocage IP reste un signal secondaire.
- `user_sessions` est un journal d'activité compagnon. Il ne remplace pas
  `auth.sessions` et marquer une ligne comme terminée ne révoque aucun jeton.
- Une vraie révocation doit agir sur Supabase Auth. Un access token déjà émis
  peut rester valable jusqu'à son expiration. Consulter la doctrine sécurité
  actuelle pour les contrôles de sessions et AAL2, sans assimiler durée JWT
  et durée de session.
- Le contrat `DurableRateLimiter` est prêt pour un stockage partagé. Il n'existe
  volontairement aucun fallback en mémoire, inadapté à Vercel. La connexion
  s'appuie pour l'instant sur les protections Supabase Auth; un fournisseur
  durable pré-auth applicatif et l'enforcement edge des politiques IP restent
  des limites à ne pas présenter comme déjà déployées.
- Les entrées de connexion sont validées côté serveur, les erreurs restent
  génériques, aucune donnée utilisateur n'est rendue comme HTML brut et aucune
  destination de redirection fournie par le client n'est acceptée.

## Production et opérations

M14 est une préparation, pas un déploiement. Aucun backup réel ou restore
n'est effectué ; hébergement éligible, backup chiffré/TLS prouvé, répétition
de restauration et vérifications opérateur restent des gates de production.

- [Plan de déploiement et smoke tests](docs/operations/production-deployment.md)
- [Sauvegarde et restauration](docs/operations/backup-restore.md)
- [Incidents, offboarding et récupération MFA](docs/operations/incident-response.md)
- [Doctrine sécurité actuelle](src/lib/security/README.md)
- [Doctrine MFA](src/lib/auth/MFA.md)
