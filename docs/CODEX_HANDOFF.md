# État du projet

Version : 0.1.0-dev.1
Branche : dev
Dernier commit examiné : aucun ; dépôt initial sans commit.

## Travail terminé

Socle npm/Angular/NestJS, modèles géographiques, prototypes carte/globe,
configuration Docker/PostGIS et documentation complète V0.1–V3.0.

Ajout demandé : plusieurs personnes doivent créer leurs propres mondes.
- Initialisation administrateur locale à usage unique, sans premier compte public libre.
- Comptes sur invitation, mots de passe Argon2id, JWT et sessions renouvelables/révocables.
- Création/révocation des invitations réservée à l’administrateur.
- Liste/création/ouverture de mondes personnels, permissions serveur owner/editor/viewer.
- Premier ajout de lieux par coordonnées, persistance SQL et conflit de révision HTTP 409.
- Écran Mon espace, connexion, inscription, invitations, création et ouverture de mondes.
- Configuration Caddy/Compose pour VPS avec HTTPS ; documentation d’activation et déploiement.

## Travail en cours

Validation réelle du socle et des comptes avec Docker/PostGIS. Aucun déploiement distant.
L’utilisateur a choisi un VPS accessible par Internet, puis indiqué ne posséder
aucun VPS, domaine ni accès SSH. Ne pas supposer l’existence d’un serveur.

## Fichiers principaux modifiés

apps/api/src/auth, apps/api/src/worlds, apps/api/migrations/002_accounts.sql,
apps/ui/account-panel.ts, apps/ui/accounts.client.ts, apps/ui/map-shell.ts,
docker-compose.production.yml, docker/Caddyfile et documentation des comptes/VPS.

## Fonctionnalités fonctionnelles

Démo plan/globe, zoom, déplacement, recentrage, visibilité du calque.
API native démarre. Les routes privées refusent les anonymes ; les opérations
sur cookies contrôlent l’origine. Comptes testés avec SQL PostgreSQL embarqué.
Parcours d’interface testés avec HTTP contrôlé et mode serveur indisponible.

## Fonctionnalités incomplètes

Le service multi-utilisateur n’est pas encore activé sur une base réelle locale
ni accessible sur Internet. Les mondes/PostGIS n’ont pas été testés intégralement
ici. Partage de mondes dans l’interface, récupération de mot de passe, MFA,
désactivation de comptes et emails absents. Dessin complet, sélection, polygones,
publication publique, exports, installateur de releases et updater restent futurs.
Le SDK est interne. La roadmap V0.2–V3.0 reste non implémentée.

## Bugs connus et limites

Docker absent ; aucune exécution de Compose, de Caddy ou de PostGIS natif.
Pas de serveur ni domaine fournis. Pas de push ou CI distante exécutée.
Avertissement Angular sur @xmldom/xmldom provenant de PixiJS.
Validation GeoJSON structurelle, pas encore topologique.
Le limiteur de tentatives fonctionne pour une seule instance API.

## Dette technique

Séparer rôle DB de migration et rôle applicatif avant une exploitation publique
renforcée. Finaliser caméra/sélection, géométries polaires et cycle de vie d’erreur.
Fixer les digests d’images et tester les sauvegardes/restaurations au lot F.

## Tests exécutés

- npm run check : lint, types, 19 tests, builds packages/API/Editor/Viewer réussis.
- 4 tests du service comptes avec PGlite : initialisation unique, Argon2, invitation
  à usage unique/révocation/expiration, login et rotation/révocation des sessions.
- Tests des signatures/expiration JWT, origines et cookies.
- 6 tests Playwright réussis sous Edge : trois parcours moteur et trois parcours
  de comptes (ces derniers avec réponses HTTP contrôlées).
- API réelle via le proxy local : worlds/invitations anonymes=401, origine étrangère=403,
  initialisation malformée=400. Base absente : ready reste indisponible.
- Syntaxe YAML production parsée.
- npm install : aucune vulnérabilité signalée lors de l’installation.

## Tests en échec ou non exécutés

Pas d’échec connu dans les suites exécutées.
accounts.integration.ts et database.integration.ts nécessitent PostgreSQL/PostGIS
et restent non exécutés ici. La suite HTTP préparée teste l’isolation entre comptes,
le rôle viewer, les coordonnées, les révisions concurrentes et la déconnexion.
Dockerfiles, HTTPS réel et mise en ligne non validés faute d’infrastructure.

## Prochaine tâche recommandée

1. Mettre Docker à disposition pour valider les migrations et les tests PostGIS.
2. Valider Compose et les parcours complets de comptes sur base persistante.
3. Quand l’utilisateur dispose d’un VPS et d’un domaine, obtenir seulement les
   paramètres publics et un accès SSH configuré ; suivre DEPLOIEMENT_VPS.md.
4. Activer le premier compte via le lien local unique, puis tester deux personnes distinctes.
5. Continuer les lots C/D/F et le reste de la roadmap sans annoncer une V1 stable.

## Commandes utiles

npm ci
npm run config:init
npm run check
npm run test:integration
npm run admin:setup
npm run dev:api
npm run preview
npm run check:secrets

Pour Playwright avec Edge : $env:E2E_CHANNEL = 'msedge'; npm run test:e2e.
Prévisualisation locale : http://127.0.0.1:8080 ; bouton Mon espace.
Sans base, l’interface affiche l’indisponibilité du serveur de comptes.

## Points importants à ne pas casser

Ne jamais exposer une inscription administrateur libre : secret local obligatoire.
Le statut administrateur ne donne pas accès aux mondes d’autrui.
Le refresh token et les invitations ne sont persistés que sous forme d’empreinte.
Pas de token de session dans localStorage. Pas de mot de passe ni de lien secret dans les logs.
.env et secrets/ ignorés ; LICENSE suivi. Aucun secret du poste copié au VPS.
Un seul modèle et moteur commun ; coordonnées angulaires et rayon planétaire configurable.

## Décisions architecturales

Voir ARCHITECTURE.md. Instance privée sur invitation, mondes personnels,
VPS Internet avec HTTPS. Le besoin multi-utilisateur a explicitement priorisé
le lot comptes malgré le blocage Docker précédent. Aucune dépense ni abonnement créé.

## Notes pour la prochaine session

Lire ce fichier et ROADMAP.md, vérifier version.json et Git.
Le socle est dans l’index, les ajouts seront aussi indexés ; aucun commit ni push.
Ne pas confondre tests PGlite/HTTP contrôlé et exécution réelle de toute la pile.
La mise en ligne requiert encore le choix et la fourniture d’un hébergement.

## Pages de l’atelier (16 septembre 2026)

Navigation ajoutée dans l’Editor : Accueil, Carte, Atlas et Guide, accessible
par ?page=accueil, ?page=carte, ?page=atlas et ?page=guide.
L’Atlas lit uniquement les objets du monde déjà ouvert ; recherche sans accents
et filtres de géométrie. Aucun endpoint public ni publication implicite.
La carte reste montée pendant la navigation. Les pages expliquent les limites
actuelles et donnent accès au panneau de comptes existant.
WSL 2.7.14 est désormais installé et vérifié ; Docker reste bloqué au démarrage.
Un redémarrage Windows a été demandé, pas exécuté automatiquement.

Validation de ces pages : lint et typecheck réussis, build complet réussi,
8 tests Playwright Edge réussis (dont navigation/recherche et mobile).
Capture de l’accueil vérifiée visuellement. Les parcours de comptes restent
simulés dans les tests navigateur ; validation PostgreSQL/Docker toujours à faire.

## Export de la vue et calques (17 septembre 2026)

Le moteur commun expose exportPng() : image PNG de la vue plane ou globe,
sans interface superposée, au cadrage courant. Accessible aussi dans le Viewer.
Les calques disposent d’une visibilité indépendante dans l’interface ; ce choix
reste local à la consultation et ne modifie pas la sauvegarde serveur.
Le globe ignore les dimensions nulles quand la carte est masquée par une page.
Docker vérifié à nouveau : moteur indisponible, tests PostGIS toujours bloqués.

Validation : npm run check réussi (lint, types, 19 tests, builds) ;
11 tests Playwright Edge réussis, dont export PNG carte/globe et calques séparés.
Prochaine étape : sélection d’objets et édition géographique, après validation
réelle du socle Docker/PostGIS dès que le moteur peut démarrer.

## Validation réelle Docker (17 septembre 2026)

Docker 29.8.0 répond désormais. PostgreSQL/PostGIS et MinIO démarrés.
Les deux tests d’intégration réels passent : migrations et références entre
mondes ; comptes HTTP, permissions, révisions concurrentes, révocation.
Images MinIO déplacées vers quay.io/minio (Docker Hub inaccessible).
Lockfile npm régénéré sous Linux propre pour inclure les dépendances optionnelles
manquantes sous Windows. Construction complète Docker en cours.
Localisation des points depuis l’Atlas ajoutée au moteur commun et aux deux vues.
Le commit initial 7f5d095 a été poussé sur origin/dev ; les changements ci-dessus
sont postérieurs et encore locaux.

### Résultat final de la validation Docker

Construction et démarrage complets réussis sur Windows/Docker Desktop.
API, Editor, Viewer, proxy et PostgreSQL sains ; MinIO initialisé.
GET http://127.0.0.1:8080/api/v1/health/ready retourne status ok.
19 tests unitaires, 2 tests d’intégration PostgreSQL/PostGIS et 12 parcours
Playwright Edge réussis. Les parcours comptes Playwright utilisent encore
leurs réponses contrôlées ; les tests HTTP d’intégration utilisent la vraie base.
Lien administrateur généré dans secrets/admin-setup.txt (ignoré par Git),
valable une heure. Aucun compte personnel créé automatiquement.
Pour régénérer après expiration : docker compose exec -T alarmap-api node
apps/api/dist/setup-admin.js, puis docker compose cp
alarmap-api:/app/secrets/admin-setup.txt secrets/admin-setup.txt.
La validation Linux natif, installation autonome et mise en ligne VPS restent à faire.

## Édition des lieux (17 septembre 2026)

PATCH et DELETE /api/v1/worlds/:id/points/:pointId disponibles. Validation stricte,
permissions owner/editor, monde et objet liés, verrouillage du calque, révision
optimiste et transaction PostgreSQL. Nom/coordonnées modifiables depuis la fiche
Atlas ; suppression avec confirmation explicite dans l’interface.
Tests d’intégration PostGIS étendus et réussis : viewer refusé, autre monde
refusé, coordonnées invalides, calque verrouillé, révision obsolète, modification
avec identité conservée et suppression autorisée à un éditeur.
Typecheck, lint et build Docker réussis. Conteneurs reconstruits et démarrés.
Correction proxy Nginx : upstreams avec résolution DNS Docker dynamique pour
éviter les 502 après remplacement des conteneurs. Configuration nginx -t validée.
Pas de migration nouvelle. Undo/Redo reste à développer.
Après correction du proxy : les 13 tests Playwright Edge passent sur la pile Docker. API health/ready retourne ok.

## Scripts d’installation depuis les sources

install.ps1 et install.sh ajoutés : détection Docker/Compose, configuration
via conteneur Node si absente, build/démarrage Compose avec attente de santé.
Mode de vérification seule. Aucun secret local ou volume inclus dans Git.
CheckOnly PowerShell et bash -n Linux réussis. Installation neuve Linux
et installateur de releases encore non validés/non livrés.

## Annulation/rétablissement des lieux

PointHistory dans le moteur commun : instantanés isolés, curseur avancé seulement
après succès, 50 entrées, nouvelle action coupe la branche de rétablissement.
UI : annuler/rétablir ajout, modification et suppression ; reset au changement
ou rechargement du monde et à la déconnexion. Conflit sans avancée de curseur.
PUT /api/v1/worlds/:id/points/:pointId restaure un point avec identité, style,
propriétés et dates ; autorisation, révision, géométrie, monde/calque et verrous
vérifiés. Aucune migration nécessaire. Historique limité à la session.

Validation finale : npm run check réussi (lint, types, 21 tests unitaires,
builds). Construction et démarrage Docker réussis, health/ready ok.
13 parcours Playwright Edge passent, dont la séquence annulation de suppression,
annulation de modification puis rétablissement des deux actions.

## Sélection directe des points

Callback de sélection partagé par MapEngine et ses adaptateurs. Carte plane :
proximité de 10 pixels des points visibles. Globe : intersection des marqueurs
et de la sphère (occlusion), sans sélection des objets derrière la planète.
Séparation clic/déplacement et libération des écouteurs à la destruction.
La fiche sélectionnée permet l’édition selon les droits existants.
Validation sélection : lint/typecheck, build Docker et 15 tests Playwright Edge réussis. Annulation/rétablissement inclus dans cette livraison.
