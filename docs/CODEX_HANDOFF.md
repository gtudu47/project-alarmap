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
