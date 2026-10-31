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

## Gestion des calques (17 septembre 2026)

POST/PATCH/DELETE layers ajoutés sous worlds : droits, révision et transaction.
Création en fin de pile, nom, opacité et verrouillage ; suppression uniquement
si vide, déverrouillé et au moins un autre calque. Ajout de point avec layerId
facultatif pour compatibilité API ; calque choisi et déverrouillé côté serveur.
UI : réglages repliables, création, suppression confirmée, choix du calque.
Une modification de calque vide l’historique local des lieux. Pas de migration.
Typecheck et lint réussis ; intégration PostGIS étendue réussie (droits, calques
verrouillés/non vides, dernier calque, conflit et références entre mondes).
Push au seuil de 5 % demandé : reconstruction Docker en cours ; test navigateur layers.spec.ts écrit mais non encore exécuté pour ce lot.

## Tuiles et détail au zoom (18 septembre 2026)

Grille adaptative Pixi : dimensions km indépendantes, rayon du monde, bandes
de latitude et bords partiels, limite de lignes visibles, zoom étendu. Points
et traits gardent une taille écran ; noms au rapprochement. Nouveau panneau
« Détail et tuiles », bouton de cadrage et indication du niveau effectif.
GET /api/v1/worlds/:id/tiles : session et appartenance requises, bounds validés,
filtre spatial PostGIS, représentant par cellule/calque, simplification des
lignes, maximum 2 000 objets. Réponse avec révision, total et reduced.
Client : délai de 180 ms, annulation des anciennes requêtes, rejet des réponses
obsolètes et contrôle de révision. Aucune migration supplémentaire.

Validation : 24 tests unitaires, 2 tests d’intégration PostgreSQL/PostGIS, lint,
typecheck et construction Docker réussis. 18 parcours Playwright Edge réussis,
y compris le test de calques qui restait à exécuter au précédent push.
Les conteneurs API, Editor et Viewer sont sains.

Limites : vue plane uniquement, réglages non persistés ; objets du monde encore
chargés intégralement à l’ouverture pour édition/Atlas. Ce premier LOD ne livre
pas la V0.9 entière. Pas de génération de terrain. Prochaine tâche : étendre le
contrat de scène pour charger les objets à la demande sans instantané intégral,
puis pagination/cache et cohérence du globe.

## Choix d’échelle (18 septembre 2026)

Échelle cartographique en vue plane : dénominateur personnalisable, suggestions,
zoom autour du centre actuel et affichage recalculé à chaque transformation.
Calcul nord-sud fondé sur le rayon et 96 pixels CSS/pouce. Indication de largeur
d’impression du PNG ; pas de légende exportée ni de mise en page automatique.
La distorsion est-ouest et les limites de zoom sont documentées.
Validation : typecheck, lint, 26 tests unitaires et build Docker réussis. Six
parcours Edge ciblés réussis (Editor, Viewer, iframe, tuiles, échelle). Première
exécution : deux dépassements de délai avec capture navigateur concurrente ;
relance isolée intégralement réussie sans modification des délais.

## Curseur de zoom vertical

Commande en bas à droite, poignée circulaire, adaptée au mobile et au clavier.
Contrat partagé setZoom/onZoom : niveau logarithmique 0–100 pour carte plane
et globe, synchronisé à la molette, au recentrage et au choix d’échelle.
Validation : typecheck/lint et build Docker réussis ; trois parcours tuiles/
échelle et deux parcours du curseur réussis. Contrôle visuel du globe effectué.
Le test attend explicitement la fin du changement de vue (jusqu’à 15 secondes
pour le démarrage WebGL logiciel) avant de mesurer le niveau de zoom.

## Placement par clic (19 septembre 2026)

Commits de grille, échelle et curseur poussés sur dev avant cette étape.
Mode « Placer sur la carte » en vue plane pour propriétaire/éditeur : conversion
écran vers longitude/latitude, remplissage du formulaire et saisie du nom.
Validation explicite avant sauvegarde avec l’API existante et historique de
points. Glissement exclu, Échap et bouton d’annulation ; changement de vue
ou de monde désactive le mode. Pas de migration ni de nouvelle route API.
Validation : types, lint, build Docker et quatre parcours Edge réussis
(placement/sauvegarde/annulation, modification/suppression, sélection plane/globe).
Prochaine étape : outil de lignes avec validation géographique, persistance et
commandes d’annulation ; puis polygones avec trous.

## Routes et rivières : création (19 septembre 2026)

Outil de tracé en vue plane : aperçu local, ajout/retrait de sommets, abandon,
nom/type/calque, sauvegarde. Validation partagée lineObjectSchema : LineString,
road/river, nom et 2–2000 sommets dont deux distincts.
PUT/DELETE worlds/:id/lines/:lineId réutilisent les transactions de restauration
et suppression avec un type géométrique explicite. Les routes points restent
limitées aux points. Historique commun dirigé vers la route selon la géométrie.
Aucune migration requise. Consultation existante plane/globe et Atlas.

Validation : types/lint et build Docker réussis ; deux tests d’intégration
PostGIS passent avec droits, calques, révisions, rechargement, raccordement
antiméridien et restauration des lignes. Parcours rivière et placement réussis.
Le parcours existant d’édition de point a dépassé le délai avant connexion au
premier chargement puis réussi seul sans modification.
Limites : pas de sélection/édition des sommets d’une ligne enregistrée, pas
de simulation hydrologique. Prochaine étape : édition des lignes et polygones.

## Échelle en 3D (19 septembre 2026)

Panneau d’échelle partagé entre les vues. Globe : échelle différentielle au
centre de la sphère, calculée à partir du rayon, de la distance caméra, du
champ vertical, de la hauteur CSS et du grossissement. setScale utilise le
zoom optique pour atteindre les petites échelles sans traverser la surface.
Callback onScale partagé ; curseur logarithmique synchronisé avec distance
et grossissement. Recentrer rétablit le grossissement initial. Marqueurs
redimensionnés pour rester lisibles. Pas de grille km ni streaming 3D livré.
Validation : types/lint, 27 tests unitaires, build Docker et huit parcours
Edge réussis (échelles, tuiles, zoom et sélection). Capture à 1:25 000 centrée
sur Origine contrôlée visuellement.

## Grille kilométrique 3D (19 septembre 2026)

Adaptateur globe : setGrid et zoomToGrid, grille métrique sur la sphère,
emprise conservatrice de la vue, découpage à l’antiméridien et couverture
polaire. Utilise visibleGrid partagé avec la 2D ; géométrie remplacée et
libérée à chaque changement d’emprise/résolution, cache du dernier état.
Dimensions et visibilité communes dans le panneau. Les colonnes sont
positionnées indépendamment par bande pour respecter leur largeur locale.
Aucun streaming API 3D ajouté dans ce lot.
Validation : types/lint, 29 tests unitaires et build Docker réussis. Sept
parcours navigateur réussis (grilles, échelles, zoom, dimensions partagées,
masquage). Capture globe à 1 × 1 km contrôlée visuellement.

## Chargement des objets sur le globe (19 septembre 2026)

Callback de grille étendu avec les emprises (une ou deux). Le client commun
charge chacune via l’API tiles existante, fusionne par identifiant et exige
la même révision pour toutes les réponses. Changement de vue : annulation
et invalidation des requêtes. Les modifications du monde déclenchent les
notifications même lorsque la géométrie de grille est conservée en cache.
Aucune modification de l’API ni migration. Maximum 2 000 objets par emprise.
Le chargement initial du monde pour édition/Atlas reste intégral.
Validation : types/lint et build Docker réussis ; six parcours Edge passent,
dont globe centré à 179,999°, deux réponses dédoublonnées et refus d’une
révision périmée. Les tests 2D et grilles/échelles restent verts.

## Ouverture légère (19 septembre 2026)

GET worlds/:id?summary=1 renvoie objects=[] et objectsComplete=false ; SQL
évite l’agrégation des objets dans cette branche. GET sans option conserve
la réponse complète. AccountPanel et Recharger utilisent le résumé.
En mode partiel, les objets reçus par zone alimentent aussi la sélection
canonique de l’éditeur. Atlas/synthèses et mutations demandent un instantané
complet avec contrôle du monde, de la session et de la révision. Protection
contre les doubles soumissions après attente du chargement.
Limite assumée : édition et Atlas chargent encore tous les objets ; pas de
pagination ajoutée. Pas de migration.
Validation : types/lint, intégration PostgreSQL/PostGIS (2 tests) et builds
Docker réussis. Quatre parcours Edge passent : ouverture légère/Atlas, détails
3D au raccordement, lignes et placement de points.

## Correction CI (21 septembre 2026)

Run 35459066663 : quality Linux échouait lors de la résolution de
@alarmap/map-model dans history.test.ts avant compilation. Compose réussissait,
Windows était annulé par la matrice. Cause reproduite localement en masquant
temporairement le dossier dist du modèle. Vitest résout maintenant les quatre
packages internes vers leurs sources TypeScript. Sans dist, les 29 tests
passent après correction ; lint validé. Exports de production inchangés.

## Atlas paginé (22 septembre 2026)

GET worlds/:id/atlas : curseur UUID stable, 50 objets par défaut (100 max),
recherche littérale sans accents et filtre de géométrie. Droits du monde et
révision contrôlés. Migration 003 : extension unaccent et index world_id/id.
Pour les mondes ouverts en mode léger, l’Atlas utilise le serveur et ne
charge plus la liste entière. Recherches différées et annulables, navigation
précédente/suivante et actualisation. Localiser transmet l’objet au moteur.
Si le monde est déjà complet en mémoire, la consultation locale est conservée.
Validation avant pause : types/lint, deux tests API/PostGIS et build Docker
réussis. Reprise : cinq parcours Edge réussis (Atlas paginé, navigation, mobile,
localisation et édition de lieux). L’édition et l’accueil chargent encore le
monde complet ; optimisation restante, sans prétendre livrer toute la V0.9.

## Accueil et Guide légers (22 septembre 2026)

Les métadonnées autorisées incluent objectCount, calculé dans la même requête que la révision. Accueil et Guide ne déclenchent plus ensureComplete, y compris via l’historique du navigateur. Le total reste indépendant des objets des tuiles et est recalculé après une édition complète. Ancien serveur sans compteur : valeur inconnue affichée par un tiret.
Validation : npm run check (29 tests), build Docker et contrôles de santé réussis ; deux tests API/PostGIS et cinq parcours Edge validés. Lors du premier passage sous compilation simultanée, un test SQL et deux initialisations du globe ont dépassé leur délai ; relance isolée réussie sans modification des délais. Contrôle des secrets et diff réussis. L’édition charge encore les objets complets : prochaine optimisation à traiter séparément.

## Édition légère validée (24 septembre 2026)

PATCH/DELETE/PUT des points et PUT/DELETE des lignes acceptent compact=1 : métadonnées avec zéro ou un objet, compteur et révision capturés dans la transaction. Sans cette option, le contrat complet reste disponible. Le client fusionne la réponse ciblée ; modifier/supprimer un lieu et Annuler/Rétablir ne déclenchent plus ensureComplete. Le chargement complet reste utilisé pour la création et les calques.
Validation : npm run check réussi (lint, types, 29 tests, builds), build Docker et santé des services réussis, deux tests API/PostGIS, quatre parcours Edge (édition complète et partielle, navigation légère, tracés avec historique), contrôle des secrets et diff réussis.

## Reprise du stockage (27 septembre 2026)

Les images officielles MinIO/mc utilisées par Compose refusent le téléchargement sur Quay et Docker Hub. Ajout de docker/Minio.Dockerfile : compilation des mêmes tags officiels via Go, images serveur et client séparées. Compose conserve les noms de services, volumes et paramètres S3. Validation locale réussie : construction des deux images depuis les sources, redémarrage sur le volume existant, initialisation du bucket (code 0), écriture/lecture/nettoyage S3 et API ready. Lint et diff vérifiés. Images de base figées par digest et licences incluses. Le contrôle S3 est ajouté à la CI ; sa validation distante reste à suivre après push.

## Création légère (27 octobre 2026)

Dépôt de travail déplacé vers C:/Users/fred/OneDrive/Documents/GitHub/project-alarmap. Les jonctions npm des sept workspaces ont été réparées localement après le déplacement (elles visaient encore l’ancien dossier).
POST points accepte compact=1 et renvoie le seul objet créé avec révision/compteur dans la transaction. Ajout des lieux et création des lignes ne chargent plus le monde complet ; les opérations de calque restent à optimiser. Historique conservé.
Validation : lint, types, 29 tests unitaires, builds natifs et Docker réussis ; deux tests API/PostGIS, six parcours navigateur validés. Un test d’édition attend désormais la fin effective de la mutation plutôt que le bouton désactivé pendant la requête. Santé API et contrôle des secrets réussis.

## Sélection des tracés (27 octobre 2026)

Après demande utilisateur, optimisation des calques abandonnée au profit de la roadmap. La vue plane détecte les clics à dix pixels des segments affichés, en utilisant le découpage à l’antiméridien et en ignorant les calques ou objets invisibles. L’Atlas localise les lignes à leur premier sommet, avec fiche dédiée. Sélection directe des lignes sur globe, modification des sommets et polygones restent à faire.
Validation : lint, types, 30 tests unitaires et build Docker réussis ; huit parcours navigateur validés, dont le chargement partiel relancé après un délai au premier démarrage. La CI du commit 65110df a réussi sur Windows, Linux et Docker.

## Sélection des tracés sur le globe (28 octobre 2026)

Le raycaster détecte les lignes rendues avec une tolérance de 10 pixels convertie selon la profondeur et le zoom. La sphère participe au calcul et bloque les tracés de la face cachée ; les couches masquées et objets transparents ne sont pas rendus ni sélectionnables. Validation : lint, types, 30 tests unitaires, build Docker et cinq parcours de sélection ; test supplémentaire du zoom et de la face cachée réussi. Un délai plus long est prévu pour le démarrage WebGL dans les tests sur machines lentes. Prochain travail : sélection des polygones et édition des sommets.

## Chargement à l’ouverture d’un monde (28 octobre 2026)

La CI a révélé une course : quand la scène de démonstration et le monde ouvert avaient le même identifiant, la même révision et la même vue, la clé des tuiles pouvait être réutilisée et empêcher le chargement des détails. L’ouverture annule maintenant les anciennes demandes et réinitialise cette clé. Le test attend la fin du chargement de la démonstration avant l’ouverture pour vérifier le cas. Validation : lint, types, builds Docker et six parcours navigateur réussis.

## Édition des sommets de tracés (28 octobre 2026)

Nouvelle route GET worlds/:id/objects/:objectId : accès membre, géométrie non simplifiée et révision cohérente, 404 si objet absent ou hors monde. Depuis une fiche de tracé, éditeur du nom et des coordonnées longitude/latitude (2 à 2 000 sommets) ; propriétés et identité conservées, calque verrouillé et révisions contrôlés par le serveur, Undo/Redo sur le tracé complet. Modification directe des sommets sur la carte encore à faire.
Validation : npm run check (30 tests), build Docker, deux tests API/PostGIS et huit parcours Edge réussis, dont un tracé simplifié chargé intégralement avant sauvegarde, erreur de saisie et Undo/Redo.

## Déplacement des sommets en vue plane (29 octobre 2026)

Dans l’éditeur de tracé, des poignées permettent de déplacer les sommets à la souris ; la liste des coordonnées se synchronise. Le déplacement reste local jusqu’à la sauvegarde et utilise la révision et l’historique existants. L’annulation abandonne le brouillon. Les poignées reviennent après un passage 2D/3D/2D. La saisie invalide suspend les poignées ; le placement est borné aux coordonnées géographiques et arrondi à dix décimales. Sur le globe, édition par coordonnées uniquement.
Validation : npm run check (30 tests), build Docker ; huit parcours Edge dont glisser-déposer, saisie, annulation, conservation lors du changement de vue et Undo/Redo. Le premier test de glisser-déposer a révélé un écart d’arrondi sub-pixel ; l’assertion utilise une tolérance.

## Suppression des tracés (30 octobre 2026)

La fiche d’une route/rivière permet sa suppression après confirmation. Le client récupère d’abord l’objet complet à la révision courante afin d’enregistrer un historique fidèle, puis supprime via l’API avec vérification serveur des droits et du verrou de calque. Undo/Redo de session restaure les sommets et propriétés ; aucun chargement complet du monde. Validation : npm run check (30 tests), build Docker, deux tests API/PostGIS et trois parcours Edge, incluant annulation de la confirmation, suppression, Undo/Redo et calque verrouillé.

## Reprise — premiers territoires (30 octobre 2026)

Branche `dev`, dépôt `C:\Users\fred\OneDrive\Documents\GitHub\project-alarmap`.
Les sections antérieures conservent l’historique et peuvent décrire un état dépassé.
Dessin de territoires simples en vue plane, nom/couleur/calque, contrôle des droits,
révisions, verrouillage et topologie PostGIS ; surface 2D, contour 3D, sélection,
Atlas, suppression confirmée et annulation/rétablissement de session. Les
polygones d’autres catégories ne peuvent être écrasés ou supprimés par l’API
territoires. Création limitée à un anneau, hors pôles et antiméridien, sans trou.
Les tracés croisés ou de surface nulle sont refusés. Tests unitaires, intégration
PostGIS et parcours navigateur exécutés ; voir la CI du commit pour les contrôles
complets. À poursuivre : édition des sommets des territoires enregistrés,
remplissage sur globe, trous et géométries aux raccordements/pôles. Le VPS n’est
toujours pas fourni ; aucun déploiement public n’a été effectué.

## Reprise — édition des territoires simples (30 octobre 2026)

Édition du nom, de la couleur et des sommets d’un territoire simple : chargement
de la géométrie complète avant modification, coordonnées ou poignées en 2D,
fermeture automatique de l’anneau, conservation du brouillon en cas d’erreur,
contrôle de révision et historique de session. Le changement de vue conserve
le brouillon ; la modification graphique des sommets reste limitée à la 2D.
À poursuivre : contours à trous et aux raccordements/pôles, remplissage sur
le globe et autres fonctionnalités du lot V0.1-D puis consultation/publication.
Validation du lot précédent : CI GitHub 41121285745 réussie sur Windows et Linux,
avec intégration PostGIS, conteneurs et tests navigateur.

## Reprise — trous des territoires (30 octobre 2026)

Les territoires peuvent comporter plusieurs trous, ajoutés ou modifiés par
coordonnées dans leur fiche après dessin du contour extérieur. Chaque anneau
est fermé automatiquement ; 2 000 sommets au total. PostGIS refuse les trous
hors du contour ou les croisements ; la carte plane découpe leur surface et ne
les sélectionne pas, le globe affiche les contours. Suppression et historique
conservent les anneaux. Les poignées ne déplacent que le contour extérieur.
À poursuivre : dessin des trous à la souris, globe rempli, antiméridien et pôles.
La CI GitHub 41122648285 du lot d’édition précédent est réussie.

## Reprise — dessin des trous (30 octobre 2026)

Depuis la fiche d’édition d’un territoire en vue plane, **Dessiner un trou**
collecte des sommets, permet d’en retirer ou d’abandonner avec Échap, puis ajoute
le contour au brouillon. La sauvegarde reste explicite et le changement de vue
est suspendu pendant le dessin. Les trous existants restent modifiables par
coordonnées ; les poignées concernent uniquement le contour extérieur.

## Reprise — partage privé entre comptes (30 octobre 2026)

Le propriétaire d’un monde peut ajouter un compte déjà inscrit comme lecteur ou
éditeur, changer son rôle et retirer son accès dans Mon espace. Routes privées
`GET/POST /worlds/:id/members` et `DELETE /worlds/:id/members/:memberId` :
propriétaire uniquement, droits vérifiés à chaque requête, rôle propriétaire
protégé, contrôles HTTP/PostGIS et parcours navigateur. Aucun email n’est envoyé.
Les invitations créent les comptes mais ne partagent aucun monde automatiquement.
Aucun VPS ni domaine fourni ; cette fonctionnalité locale ne met pas le service
sur Internet. À poursuivre : publication de révisions et Viewer public filtré.
Validation du partage : tests HTTP/PostGIS réussis (accès, changement de rôle,
révocation immédiate et isolement des mondes), navigateur propriétaire et lecteur
réussis. La suite navigateur a révélé deux sélecteurs ambigus et un délai WebGL
insuffisant : corrigés et parcours concernés relancés avec succès. La CI du
commit bb95b0e est réussie.

## Reprise — publication filtrée (31 octobre 2026)

Le propriétaire publie explicitement une copie d’une révision avec un choix de
calques et une visibilité publique ou par lien non répertorié. L’API publique
expose uniquement la copie publiée : géométries, noms, styles et dates des
objets retenus, propriétés vidées, aucun calque exclu. Le brouillon reste
indépendant jusqu’à republication ; le retrait bloque les accès suivants.
Le Viewer et l’intégration iframe chargent la copie sans authentification.
Les assets et catégories de worldbuilding ne sont pas encore publiables.
La CI du partage privé e7539db est réussie. Toujours aucun VPS ni domaine fourni.

Compléments de validation : les propriétés sont également vidées à la lecture,
même dans une copie ancienne. Les droits de modification sont revérifiés après
verrouillage du monde ; un test PostGIS couvre la révocation pendant une écriture
en attente. Pour une instance configurée localement, `localhost` et `127.0.0.1`
sont acceptés uniquement avec le protocole et le port configurés.
Validation réelle : un compte et un monde temporaires ont été créés puis
supprimés après connexion sur 127.0.0.1, ajout d’un lieu, publication par
calque, consultation dans un contexte navigateur anonyme et retrait. Le test
iframe entre localhost et 127.0.0.1 vérifie deux origines distinctes ; un site
public simulé vers une adresse locale est normalement bloqué par la protection
réseau du navigateur, sans incidence sur un déploiement HTTPS accessible.
Validation finale : `npm run check` (lint, types, 33 tests unitaires et builds),
tests HTTP/PostGIS, parcours réel anonyme et 42 tests navigateur réussis.
La publication nécessite un choix explicite des calques ; au maximum 100 calques
par publication. Aucun partage Internet n’a été déployé automatiquement.

## Reprise — catalogue public (31 octobre 2026)

Le catalogue anonyme liste les cartes de visibilité publique, ouvre leur copie
dans le Viewer et ne liste pas celles accessibles par lien non répertorié.
L’interface valide la réponse, présente un état vide ou une erreur récupérable
et fonctionne sur mobile. L’API limite actuellement la liste aux 100 dernières
publications ; la pagination et la recherche restent à développer.
Validation : lint, types et build Docker réussis ; 14 tests navigateur ciblés
passés. Un essai réel avec deux mondes temporaires a confirmé qu’une carte
publique apparaît au catalogue, qu’une carte non répertoriée reste absente et
que le Viewer s’ouvre anonymement ; comptes et mondes de test supprimés.

## Reprise — annotations textuelles (31 octobre 2026)

Le formulaire de repère permet de créer un texte géolocalisé (80 caractères
maximum), avec couleur et calque. Modification, suppression et historique
réutilisent les contrôles de droits et de révision des points. Le rendu affiche
le texte à taille d’écran constante en 2D et sur le globe, où la face cachée est
masquée. Les textures du globe sont libérées lors du changement de scène.
Polices, tailles personnalisées et placement direct sur globe restent à faire.
Validation : tests HTTP/PostGIS (y compris la publication du texte), captures
comparatives 2D/globe et masquage de la face cachée, 47 parcours navigateur
réussis. Un compte et un monde temporaires ont confirmé la création, la
publication et la consultation anonyme sur globe ; ils ont été supprimés.
La CI GitHub 41174902281 du catalogue public est réussie. Prochain lot : export JSON versionné.

## Reprise — export JSON d’un monde (31 octobre 2026)

Le bouton d’export produit un document `alarmap-world`, version 1, validé par
`worldBackupSchema`. Pour un monde privé, il récupère la révision complète auprès
de l’API et refuse un résultat partiel ou périmé ; tous les calques et propriétés
sont présents, même masqués. Le Viewer exporte uniquement sa copie publiée.
Attention : les fichiers d’assets ne sont pas pris en charge ;
il ne s’agit pas d’une sauvegarde complète de l’instance.
Validation : test réel avec un compte temporaire, un objet hors écran et un
calque masqué ; le fichier téléchargé contient la révision complète et ses
propriétés, puis les données de test ont été supprimées. Les tests navigateur
couvrent aussi les réponses périmées ou partielles et le Viewer public.

## Reprise — import JSON dans un nouveau monde (31 octobre 2026)

L’import `alarmap-world` version 1 crée un monde privé en brouillon, sans jamais
remplacer la source. Identifiants de monde, calques et objets renouvelés ; les
références exactes dans les propriétés sont adaptées. Contrôle des champs,
limites 8 Mio / 100 calques / 2 000 objets / 100 000 coordonnées, géométries
validées par PostGIS et transaction atomique. Les assets ne sont pas inclus ;
les polygones polaires et au raccordement ne sont pas encore rendus en 2D.

Validation : npm run check (lint, typage, 34 tests unitaires et builds),
`npm run test:integration` sur PostgreSQL/PostGIS (dont taille, version,
références, géométrie invalide et profondeur), et test réel navigateur : export
puis import dans une copie privée distincte avec conservation de la source ; 9 parcours navigateur import, export et comptes réussis.
Les données temporaires ont été supprimées. CI GitHub du lot export 41176507437
réussie. Prochaine étape : poursuivre la V0.1, notamment les assets et la
sauvegarde complète ; l’import JSON actuel ne comprend pas les fichiers d’assets.
Le déploiement Internet attend toujours un serveur et un domaine.