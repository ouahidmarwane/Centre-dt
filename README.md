# Centre Dentaire Ouahid

Plateforme interne de gestion du Centre Dentaire Ouahid. Ce premier jalon met
en place l'authentification privée, l'autorisation et les fondations de sécurité;
les modules métiers restent volontairement des espaces réservés.

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

- `doctor` : accès complet aux fondations, dont Comptabilité et Supervision ;
- `assistant` : accès opérationnel, sans Comptabilité ni Supervision.

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
migrations créent `profiles`, `audit_logs`, `security_events`, `blocked_ips` et
`user_sessions`, activent RLS et appliquent des grants minimaux.

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
npx supabase gen types typescript --project-id <project-ref> --schema public > src/types/database.types.ts
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

## Limites du jalon

Les migrations et RLS doivent encore être appliquées et testées sur un projet
Supabase de développement. La supervision de sessions, le blocage effectif des
requêtes, l'écriture des journaux, le rate limiting durable et les modules
métiers seront implémentés dans des jalons ultérieurs.
