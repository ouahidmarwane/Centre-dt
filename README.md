# Centre Dentaire Ouahid

Plateforme interne de gestion du Centre Dentaire Ouahid. Elle réunit une
fondation d'authentification et d'autorisation privée avec patients, odontogramme,
interventions/paiements, rendez-vous/rappels manuels, ordonnances, documents
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
service-role key n'est utilisé par l'application.

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
