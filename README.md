# Centre Dentaire Ouahid

Plateforme interne de gestion du Centre Dentaire Ouahid. Elle réunit une
fondation d'authentification et d'autorisation privée avec un premier module de
gestion sécurisée des patients.

## Stack

- Next.js 16 avec App Router et React 19
- TypeScript strict
- Tailwind CSS 4
- Supabase Auth, PostgreSQL et Row Level Security
- Vercel prévu pour le déploiement

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

Les migrations reproductibles sont dans `supabase/migrations/`. Elles n'ont pas
été appliquées automatiquement à un projet distant.

Avec le CLI officiel Supabase authentifié :

```bash
npx supabase login
npx supabase link --project-ref <project-ref>
npx supabase db push --dry-run
npx supabase db push
```

Inspecter le projet et la sortie du `--dry-run` avant la dernière commande. Les
migrations créent `profiles`, `audit_logs`, `security_events`, `blocked_ips`,
`user_sessions` et `patients`, activent RLS et appliquent des grants minimaux.

### Premier compte docteur

Créer le compte depuis Supabase Dashboard → Authentication → Users, sans
ajouter de page d'inscription. Le trigger crée volontairement le profil avec le
rôle le moins privilégié, `assistant`. Après avoir vérifié l'UUID exact du
compte, promouvoir le premier docteur depuis le SQL Editor avec une opération
administrative explicite :

```sql
update public.profiles
set role = 'doctor', full_name = '<nom du docteur>'
where id = '<uuid auth.users vérifié>';
```

Ne jamais exposer cette opération au navigateur.

## Types de base de données

Le fichier de types n'est pas fabriqué manuellement : il doit refléter le schéma
effectivement appliqué. Après liaison au bon projet, le générer avec :

```bash
npx supabase gen types --lang typescript --linked --schema public > src/types/database.types.ts
```

Le dossier `src/types` existe pour recevoir ce fichier.

## Fondations de sécurité

- Les journaux d'audit et événements de sécurité sont lisibles uniquement par
  un docteur et ne sont pas modifiables par les clients.
- `blocked_ips` utilise le type PostgreSQL `inet`; seules des adresses observées
  dans un contexte serveur de confiance doivent y être enregistrées.
- L'extraction d'IP ne lit `x-vercel-forwarded-for` que lorsque `VERCEL=1`,
  valide IPv4/IPv6 et renvoie `null` localement. Une IP partagée/NAT ne
  représente jamais une personne et le blocage IP reste un signal secondaire.
- `user_sessions` est un journal d'activité compagnon. Il ne remplace pas
  `auth.sessions` et marquer une ligne comme terminée ne révoque aucun jeton.
- Une vraie révocation doit agir sur Supabase Auth. Un access token déjà émis
  peut rester valable jusqu'à son expiration; les actions les plus sensibles
  devront aussi vérifier l'existence du `session_id` dans `auth.sessions`.
- Le contrat `DurableRateLimiter` est prêt pour un stockage partagé. Il n'existe
  volontairement aucun fallback en mémoire, inadapté à Vercel. La connexion
  s'appuie pour l'instant sur les protections Supabase Auth; un fournisseur
  durable devra être choisi avant les endpoints sensibles de production.
- Les entrées de connexion sont validées côté serveur, les erreurs restent
  génériques, aucune donnée utilisateur n'est rendue comme HTML brut et aucune
  destination de redirection fournie par le client n'est acceptée.

## Limites actuelles

L'odontogramme, les interventions, paiements, ordonnances, factures,
rendez-vous et rappels ne sont pas encore implémentés. La supervision de
sessions, le blocage effectif des requêtes et le rate limiting durable restent
également prévus pour des jalons ultérieurs.
