# Incidents et récupération — propriétaire + suppléant

Appeler le responsable par un canal indépendant de l'appareil suspect. Garder
un journal hors Git : heures UTC, symptôme, actions approuvées, preuves minimales
en accès restreint. Ne pas copier patient, finance, IP brute, cookies/JWT, QR,
URI TOTP ou secret dans une issue/capture/log. Ne pas effacer les événements.

## Capacités et limites à respecter

La désactivation du profil retire l'autorité applicative/DB ; elle ne détruit
pas nécessairement les sessions GoTrue. `user_sessions` est un journal compagnon,
pas une révocation Auth. Utiliser la procédure administrative Auth autorisée
pour la révocation globale si requise, puis vérifier son effet. Un access token
déjà émis peut survivre jusqu'à expiration : durée de session ≠ durée JWT.
Ne pas inventer de bouton ou menu Dashboard ; confirmer les capacités actuelles
avec l'opérateur. L'application n'a pas de reset MFA self-service.

Le [contrôle administrateur Supabase de suppression de facteur vérifié](https://supabase.com/docs/reference/javascript/auth-admin-deletefactor)
documente une déconnexion des sessions. M14 n'implémente ni n'appelle cette API
administrative et n'utilise pas sa clé privilégiée. L'opérateur doit confirmer
un chemin administratif approuvé (Dashboard/support) avant action ; ne pas
supposer un menu disponible. Voir la [doctrine MFA](../../src/lib/auth/MFA.md).

## Playbooks : CONTENIR → PREUVE → RÉCUPÉRER → VÉRIFIER

| Situation | Contenir | Préserver | Récupérer | Vérifier |
| --- | --- | --- | --- | --- |
| Compte/password suspect | Suspendre autorité du profil via administrateur autorisé ; révoquer Auth selon procédure vérifiée | Heures et événements minimaux, pas de jetons | Password changé par canal sûr, appareil assaini ; examiner facteurs | Ancienne session refusée, rôle actif correct, login/logout et MFA |
| Assistant quitte le cabinet | Désactiver profil, retirer accès appareil et Auth | Journal d'offboarding et accès attribués | Révocation administrative, récupération matériel | Aucun accès applicatif/DB ; ne pas prétendre avoir supprimé GoTrue |
| Laptop/téléphone volé, session AAL2 suspecte | Isoler appareil ; suspendre compte concerné et révoquer sessions | Dernières heures/actions, prévenir responsable | Poste fiable, password et révocation, examiner Auth | Sessions anciennes refusées et actions doctor protégées ; AAL2 volé reste critique |
| Événement Security Center suspect | Évaluer avant blocage ; limiter compte/flux confirmé | Événement original préservé en accès restreint | Mesure proportionnée, Attack Mode/WAF seulement si hébergement autorisé et décision humaine | Accès cabinet/mobile légitime toujours fonctionnel, faux positifs NAT évalués |
| Modification financière inattendue | Suspendre workflow suspect, pas de correction directe SQL | Révisions/documents et chronologie protégés | Docteur : reversal/cancellation/void approuvés, ou forward-fix revu | Totaux PostgreSQL et historique cohérents ; pas de hard-delete |
| Exposition patient suspectée | Couper canal compromis et sessions, restreindre accès concerné | Préserver minimum de preuves sans dupliquer données | Corriger vecteur, restaurer service après revue, consulter conseil compétent pour obligations applicables | Autorisations/cache/CSP et absence de fuite ; aucune promesse de conformité légale M14 |

## Authenticator perdu/remplacé, password connu sans TOTP

1. Arrêter les tentatives répétées et ne pas contourner le fail-closed AAL1.
2. Vérifier l'identité docteur par canaux indépendants et obtenir approbation
   administrateur avec second témoin ; un password seul ne prouve pas l'identité.
3. Confirmer le chemin administratif actuel. Retirer uniquement le facteur
   obsolète précisément identifié, après revue des sessions ; aucune suppression
   large, aucune opération automatique. Pour plusieurs facteurs vérifiés, garder
   le fail-closed jusqu'à résolution administrative documentée.
4. Sur poste et téléphone fiables, réenrôler via flux approuvé et challenge.
   Jamais photographier/archiver secret/QR/URI/code. Pas de reset self-service.
5. Vérifier exactement un facteur vérifié, zéro en attente, password → AAL1
   interdit aux données docteur → TOTP → AAL2 autorisé ; logout et révocation
   des anciennes sessions vérifiés. Réactiver seulement après ces contrôles.

Le bootstrap après password peut être exploité si l'identité administrative
est mal vérifiée ; un navigateur déjà compromis peut voler une session AAL2.
MFA n'est ni une garantie anti-phishing ni une révocation universelle.

## Indisponibilité / surveillance

Vérification quotidienne humaine : état hébergeur/Supabase, alertes propriétaire,
quotas, login et Security Center. Pas de nouvel endpoint public, télémétrie
payante, alerte automatique ou keep-alive fictif. Pendant panne : arrêter les
ressaisies répétées/idempotence, appliquer procédure cabinet hors ligne sûre,
reconcilier explicitement à la reprise. Ne pas copier clinique dans un ticket.
Pour perte DB, suivre [backup-restore.md](backup-restore.md) : forward-fix ou
restore approuvé, jamais reset lié. Pour régression application, rollback
autorisé compatible avec schéma puis smoke tests. Reprise décidée par responsable.
