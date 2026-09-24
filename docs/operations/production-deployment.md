# Première mise en production — décision humaine obligatoire

M14 prépare seulement cette procédure. Aucun déploiement, réglage Dashboard,
DNS, test métier distant ou achat n'est autorisé ici. Responsable : propriétaire
du cabinet, avec un suppléant désigné. Consigner date, opérateur et résultats,
jamais les secrets ni les données patient dans le dépôt.

## Contrat d'environnement

Inventaire mécanique du code :

| Variable | Classification | Action opérateur |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | PUBLIC REQUIRED | Origine HTTPS du projet Supabase voulu |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | PUBLIC REQUIRED | Clé publiable moderne de ce même projet |
| `NODE_ENV` | PLATFORM PROVIDED | Gérée par Next.js, pas de saisie Vercel |
| `VERCEL` | PLATFORM PROVIDED | Fournie par Vercel, pas de saisie manuelle |
| `VERCEL_ENV` | PLATFORM PROVIDED | Fournie par Vercel, pas de saisie manuelle |

Aucune variable SERVER REQUIRED. `NEXT_PUBLIC_SUPABASE_ANON_KEY` n'est pas
utilisée : ne pas ajouter d'alias. `.env.example` contient seulement les deux
placeholders vides. Ne jamais configurer `SUPABASE_SERVICE_ROLE_KEY`, mot de
passe DB, clé SSH, jeton administrateur ou identifiants de test dans l'application.
La [clé publiable](https://supabase.com/docs/guides/getting-started/api-keys)
est publique par conception ; les autorisations restent serveur + PostgreSQL.

La validation sans dépendance est exécutée par la configuration Next au build,
par `instrumentation.register` au démarrage et par les clients Supabase. Elle
rejette absence, clé non publiable, URL avec credentials/chemin/query, origine
non Supabase et HTTP en production. Elle accepte uniquement une origine
`https://<projet>.supabase.co` en production ; un domaine Supabase personnalisé
nécessiterait une revue distincte. Le loopback HTTP est réservé au développement.
Les erreurs ne reflètent aucune valeur. Une autre origine Supabase syntaxiquement
valide n'est PAS détectable comme mauvais projet : comparer indépendamment
projet, URL et clé au Dashboard avant build. Les variables publiques sont
intégrées au build : un changement exige un nouveau build autorisé.

## Phase A — AVANT DÉPLOIEMENT

- Vérifier commit approuvé, arbre propre, lint/typecheck/tests/build/audit verts,
  secrets absents, migrations alignées, DB lint et dry-run sans migration.
- Résoudre l'éligibilité d'hébergement : [Vercel Hobby est réservé à l'usage
  personnel non commercial](https://vercel.com/docs/limits/fair-use-guidelines).
  Un cabinet en activité est a priori commercial. Ne pas déployer sur Hobby
  en supposant son admissibilité ; obtenir une décision d'hébergement autorisée.
  M14 ne souscrit aucun service. Le budget sécurité/ops additionnel reste nul.
- Réaliser la sauvegarde externe chiffrée et la répétition de restauration
  décrites dans [backup-restore.md](backup-restore.md), avant le premier vrai patient.
- Opérateur : vérifier dans Supabase email/password actif, anonymous désactivé,
  signup public désactivé, seuls comptes prévus, docteur exactement un TOTP
  vérifié et zéro en attente, politique de mots de passe et limites Auth relues.
  Vérifier les capacités de récupération administrateur sans les exécuter.
- Ces réglages Dashboard ne sont PAS revérifiés par M14. La doctrine MFA et
  les contrôles serveur/DB sont établis par M13B et les tests locaux, pas une
  preuve du réglage Dashboard actuel. Ne pas inventer des durées de session.
- Choisir le host canonique sans inventer de domaine. Vérifier si Site URL et
  redirects sont nécessaires aux workflows réellement utilisés ; aucune
  inscription publique ou redirect OAuth n'est ajouté ici.
- Configurer ultérieurement les deux variables publiques sur le scope voulu,
  séparant production et preview ; aucune copie de credentials de test.

## Phase B — DÉPLOIEMENT (NON EXÉCUTÉ PAR M14)

Après approbation distincte et résolution de A, déployer le commit approuvé sur
l'hébergement autorisé. Noter commit, cible et procédure de rollback. Ne pas
exécuter de migration ou modifier Auth implicitement avec le déploiement.

## Phase C — SÉCURITÉ IMMÉDIATE

Vérifier HTTPS, certificat valide, redirection HTTP → HTTPS, host canonique,
redirects sans boucle et origine Supabase/CSP attendue. Contrôler CSP à nonce,
`base-uri 'self'`, `frame-ancestors 'none'`, nosniff, frame DENY, referrer,
permissions et cache privé/no-store des pages sensibles. Examiner les cookies
sans copier leurs valeurs : Secure en HTTPS, comportement SameSite attendu.
Les cookies `@supabase/ssr` sont volontairement non-HttpOnly ; CSP ne supprime
pas le risque d'un navigateur compromis.

Plan firewall seulement : [mitigation automatique L3/L4/L7](https://vercel.com/docs/vercel-firewall/ddos-mitigation),
[règles WAF limitées selon plan](https://vercel.com/docs/vercel-firewall/vercel-waf/custom-rules)
et [Attack Mode d'urgence](https://vercel.com/docs/vercel-firewall/attack-mode).
Relire disponibilités et quotas Dashboard lors du déploiement. Évaluer une
règle login/MFA limitée, d'abord observer puis tester ; tenir compte NAT du
cabinet, mobile et faux positifs. Prévoir retour arrière par l'opérateur.
Pas de geo-blocage ni confiance implicite dans le trafic marocain. Ne rien
configurer en M14. WAF n'est pas le limiteur durable pré-auth applicatif ; CSP
et RLS ne sont pas des protections DDoS. L'IP n'est de confiance que sur Vercel
production via l'extracteur existant, sinon `null` ; une IP n'est pas une identité.

## Phase D — AUTH

Firefox ET Chromium : anonyme atteint login mais pas dashboard/patients/
comptabilité/sécurité. Assistant actif : connexion, patients, rendez-vous et
actions autorisées ; comptabilité, sécurité et actions docteur refusées, y
compris requêtes directes. Tester logout, navigation arrière, session expirée
et reprise, sans journaliser cookies/JWT. Un refus serveur/DB doit subsister
indépendamment de la visibilité du menu.

## Phase E — CLINIQUE

Tests futurs autorisés seulement avec patient explicitement SYNTHETIQUE,
sans identité/téléphone réel : création, consultation, modification, finding,
ordonnance et rendez-vous ; chevauchement/idempotence et transitions refusées.
Archiver à la fin via le docteur après les étapes financières. Pas de DELETE
normal : les lignes synthétiques restent identifiées et auditées, pas de purge
administrative implicite. Patient archivé : mutations refusées, sauf annulation
opérationnelle documentée d'un rendez-vous déjà prévu.

## Phase F — FINANCE ET IMPRESSION

Même patient synthétique : intervention effectuée, paiement sans argent réel,
reçu, facture si appropriée ; vérifier totaux PostgreSQL et solde. Paiement
dupliqué/surpaiement refusés ; assistant ne peut annuler ni reverser. Docteur :
réversion/annulation/void par les workflows approuvés et contrôle des totaux,
sans suppression d'historique ni mutation directe. Les documents émis ne
doivent pas être silencieusement réécrits après les changements de dette.

Impressions patient, ordonnance, facture et reçu : bon patient et numéro,
autorisation par rôle, cache absent, aucune chrome application, aucune
surexposition assistant. Tester aperçu/impression Firefox et Chromium, desktop,
tablette/mobile par viewport responsive (pas de mode mobile manuel), focus,
clavier, formulaires et navigation. Ne jamais imprimer des données réelles
pour ce smoke test ; protéger/détruire les sorties synthétiques hors Git.

## Phase G — MFA

Docteur : password → challenge, AAL1 sans accès clinique ; TOTP valide → AAL2,
dashboard/comptabilité/sécurité accessibles.
Depuis le 24 septembre 2026, même règle pour l'assistante : password → enrôlement
(première fois) ou challenge, AAL1 sans aucun accès clinique, AAL2 requis. Code invalide refusé, retour arrière
et routes directes protégés. Zéro ou plusieurs facteurs vérifiés : fail-closed.
Ne pas provoquer ces anomalies sur le vrai compte ; couvrir par tests isolés.
Ni secret, QR, URI, code ni facteur dans les captures/logs.

## Phase H — SECURITY CENTER ET RAPPELS

Contrôler événements/sessions et actions approuvées sans exposer IP ou identité
dans les rapports. Les sessions compagnon ne remplacent pas GoTrue.
WhatsApp : numéro synthétique valide, normalisation, message URL-encoded portant
`Centre Dentaire Ouahid`, sans information clinique/financière. Ouverture
uniquement sur clic ; jamais d'envoi automatique. Ne pas envoyer au tiers.
Ouvrir ne marque pas traité ; action explicite séparée, aucune promesse de
livraison/lecture. J-1/H-2 en `Africa/Casablanca`, aucune action pour rendez-vous
terminé/annulé/no-show/passé, rappel traité ne réapparaît pas.

## Phase I — BACKUP ET SURVEILLANCE

Confirmer sauvegarde chiffrée hors site, manifeste, clé disponible au suppléant,
restauration répétée et journal opérateur. Le responsable vérifie chaque jour
ouvré accès login/workflow autorisé, Supabase/Vercel état/erreurs/quotas et
Security Center ; alerte humaine au suppléant en cas d'échec. Aucun nouvel
endpoint health : pas de sonde DB publique, pas de surveillance/alerte automatique
prétendue. [Supabase Free peut être suspendu pour faible activité](https://supabase.com/docs/guides/platform/free-project-pausing)
: surveiller les notifications propriétaire et prévoir une indisponibilité,
pas de keep-alive artificiel. Voir [incident-response.md](incident-response.md).

## Phase J — GO / NO-GO

Bloqueurs sécurité : secret exposé/service-role configuré, TLS invalide, MFA
cassée/AAL1 accepté, élévation assistant, cache clinique inattendu, RLS/grants
affaiblis. Bloqueurs opérationnels : sauvegarde absente, restore non répété,
migration en attente/DB lint erreur, tests/build/audit en échec, environnement
production manquant, hébergement inéligible. Un défaut cosmétique non critique
n'autorise pas à ignorer un bloqueur sécurité ou opérationnel.

À la préparation M14, quatre gates opérateur restent ouverts : (1) hébergement
éligible approuvé ; (2) premier backup chiffré avec chaîne TLS d'export prouvée ;
(3) restore jetable réussi, y compris limites Auth ; (4) configuration de
production et contrôles Dashboard/smoke post-déploiement humains.
Ces gates interdisent la production mais n'empêchent pas la revue M14.

Rollback application : après autorisation, revenir à un déploiement connu ou
reconstruire son commit, vérifier compatibilité avec le schéma actuel puis
refaire smoke tests. Rollback DB ≠ revert Git : aucun down/reset aveugle.
Préférer correction forward revue ; restore uniquement après approbation et
procédure [backup-restore.md](backup-restore.md).
