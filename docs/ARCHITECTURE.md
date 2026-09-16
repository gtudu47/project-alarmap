# Décisions d’architecture

## ADR-001 — Socle et dépendances

Monorepo npm, TypeScript strict, Angular 21.2 / TypeScript 5.9 pour rester
compatible avec Node 24.13 installé. NestJS 12 pour l’API. Le lockfile fixe les
versions transitives. Toute montée majeure exige les tests communs.

Ordre de dépendance : map-model → map-engine → map-sdk ; les applications
consomment ces packages. `shared` contient les textes et utilitaires sans
Angular. `apps/ui` contient uniquement la coque Angular commune.

## ADR-002 — Une scène, deux rendus

MapEngine valide une World et possède l’état partagé. PixiJS et Three.js sont
des adaptateurs chargés à la demande. Le cycle de vie détruit les canvas,
contrôles, observers et ressources GPU lors d’un changement de rendu.
Les prototypes actuels rendent grille, points et lignes. Les polygones,
sélection, culling et commandes d’édition ne sont pas encore implémentés.

Projection plane équirectangulaire. Longitude en [-180,180], latitude en
[-90,90]. Distances calculées sur une sphère avec le rayon du monde. Le SRID
4326 exprime les coordonnées angulaires du stockage ; les fonctions terrestres
de distance PostGIS ne doivent pas être utilisées comme distances du monde.

Les lignes de la scène sont interpolées en longitude/latitude et coupées à
l’antiméridien pour le plan. Le globe utilise la même interpolation densifiée.
Le traitement des anneaux, trous et territoires polaires reste au lot C.

## ADR-003 — Persistance et migrations

PostgreSQL/PostGIS, SQL versionné et accès `pg`. Migrations sous verrou
consultatif, transaction par migration et empreinte SHA-256 : une migration
déjà appliquée ne se modifie pas. Les clés étrangères composites empêchent
les références entre mondes différents.

Le schéma initial prépare utilisateurs, mondes, membres, calques, objets,
publications et religions. Les routes de comptes et de mondes personnels sont maintenant exposées avec
contrôle d’accès serveur ; le CRUD et les versions historiques restent partiels. Les snapshots publics seront filtrés côté serveur.

Le modèle accepte les géométries structurelles GeoJSON ; la validation
topologique (auto-intersections, trous hors anneau, pôles) doit être finalisée
avant les outils Polygon. Ne pas présenter le schéma actuel comme une
validation topologique complète.

## ADR-004 — Authentification et publication prévues

Instance privée, premier administrateur créé via un jeton d’initialisation
unique, comptes sur invitation. Argon2, JWT court, renouvellement révocable.
Chaque opération vérifiera l’appartenance au monde et le rôle. Aucun endpoint
temporairement ouvert ne doit être ajouté pour contourner cette étape.

États : draft, private, unlisted, public. Publication explicite d’une révision
filtrée et indépendante des modifications suivantes du brouillon. Unlisted
permet l’accès anonyme au lien ; private exige une authentification.

## ADR-005 — Distribution prévue

Windows + Linux ; releases validées provenant de main uniquement, jamais
chaque commit de développement. Contrôle toutes les six heures. Mise à jour
sous verrou et suspension des écritures, sauvegarde cohérente, restauration
de la base et de la version applicative avant réouverture en cas d’échec.

Les images Compose actuelles sont destinées au socle de développement. La
publication de digests immuables, la signature du manifeste et l’installateur
de releases appartiennent au lot F. Aucun updater automatique n’est actif.

## ADR-006 — Chronologie et simulations

Années entières signées, intervalles [startYear,endYear), bornes absentes =
illimitées. Identité métier stable, états historiques distincts à partir de
V0.4. Une persécution religieuse va de religionAId (auteur) à religionBId
(cible). Absence d’information et neutralité sont deux états distincts.

Les simulations V2.x s’exécuteront sur des scénarios isolés, avec état initial,
seed, paramètres et version d’algorithme. Aucun résultat ne modifiera le monde
avant validation explicite par l’auteur.

## ADR-007 — Comptes et VPS

La demande de plusieurs utilisateurs a priorisé le lot E avant la validation
Docker restante du socle. Les comptes et sessions sont testés sur PostgreSQL
embarqué ; les tests de mondes spatiaux sur PostGIS restent à exécuter.

Un administrateur crée des invitations. Chaque compte crée ses propres mondes,
et aucun rôle administrateur ne contourne les permissions de lecture des mondes.
Le JWT reste en mémoire ; le refresh token est en cookie HttpOnly. La déconnexion
révoque la session par identifiant, y compris après rotation du refresh token.

La cible choisie est un VPS Internet avec domaine, mais l’utilisateur ne possède
encore ni serveur ni domaine. Caddy termine TLS et transmet directement aux
services internes ; un seul proxy de confiance est déclaré à Express.
