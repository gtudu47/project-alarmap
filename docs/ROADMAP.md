# Roadmap AlarMap

Légende : `[ ]` non commencé · `[-]` en cours · `[x]` terminé · `[!]` bloqué.
Une case terminée décrit du travail réellement vérifié, pas une intention.

## V0.1 — Fondations

### Lot A — Dépôt
- [x] Branche dev ; cahier des charges conservé dans docs.
- [x] Licence fournie, README, .gitignore, .env.example, version.json.
- [x] Configuration locale générée sans affichage des secrets.
- [x] Architecture, roadmap et fiche de reprise.
- [x] Contrôle final des fichiers suivis et exclusions Git.

### Lot B — Services
- [x] Workspaces npm et configurations strictes.
- [x] Applications Angular Editor/Viewer et API NestJS de santé.
- [x] Migration PostgreSQL/PostGIS et contrat de stockage local/S3.
- [x] Dockerfiles, Compose, proxy et dépendances de démarrage.
- [x] Validation des builds, 12 tests unitaires, 3 parcours navigateur et démarrage natif de l’API.
- [x] Démarrage complet Docker/PostGIS validé sur Windows avec Docker Desktop (17 septembre 2026).
- [ ] Validation de la CI distante Windows/Linux.

### Lot C — Modèle et moteur
- [x] Schémas de monde, calque, objet, période et fondations Religions.
- [x] Fonctions géographiques : sphère, distance, découpage de lignes à l’antiméridien.
- [-] Moteur commun : prototype plan/globe, grille, points, lignes, zoom, déplacement, visibilité.
- [ ] Polygones avec trous et territoires polaires ; validation topologique.
- [ ] Sélection, culling, propriétés de caméra et événements publics.
- [ ] Tests complets de cohérence de rendu et d’interaction.

### Lot D — Édition
- [ ] Outils Point, Polyline, Polygon, Text, Select, Pan, Delete.
- [ ] Propriétés, gestion complète des calques, commandes Undo/Redo.
- [ ] Import d’images et gestion d’assets.
- [-] Sauvegarde serveur et conflits de révisions pour les lieux ; édition complète à réaliser.

### Lot E — Consultation
- [x] Code et tests de l’initialisation administrateur, invitations, Argon2/JWT et sessions.
- [x] Écran Mon espace, connexion, invitations et création de mondes privés.
- [x] Premier outil de lieux par coordonnées avec sauvegarde et révisions.
- [x] Tests API des comptes/mondes sur PostgreSQL/PostGIS réel : isolation, lecture seule, concurrence et révocation.
- [-] Autorisations owner/editor/viewer sur les routes existantes ; tests HTTP/PostGIS écrits, à exécuter.
- [ ] Publication filtrée : draft/private/unlisted/public.
- [ ] Viewer et iframe sur données publiées réelles ; export PNG.

### Lot F — Distribution
- [ ] Installation depuis une release en une commande sous Windows/Linux.
- [ ] Manifeste, empreintes et images par digest.
- [ ] Sauvegarde, maintenance, migrations et rollback cohérent.
- [ ] Planificateur Windows et timer systemd toutes les six heures.
- [ ] Workflow release, essais d’installation/mise à jour et incidents simulés.

## V0.2 à V1.0

- [ ] **0.2 Monde physique** : océans, continents, îles, lacs, rivières, montagnes,
  chaînes, forêts, marais, déserts, biomes, textures, symboles ; consultation globe.
- [ ] **0.3 Monde politique** : royaumes, provinces, frontières, capitales, villes,
  villages, forteresses, ports, routes terrestres/commerciales/maritimes, blasons ; édition globe.
- [ ] **0.4 Chronologie** : année, timeline, frontières historiques, fondations,
  destructions, changements de noms et versions des entités.
- [ ] **0.5 Intégration** : SDK JS stable, événements, API publique, personnalisation,
  liens profonds, postMessage avec contrôle des origines.
- [ ] **0.6 Worldbuilding** : peuples, cultures, langues, population, ressources,
  magie, ruines, créatures et module Religions détaillé ci-dessous.
- [ ] **0.7 Génération** : seed reproductible, côtes, îles, relief, champ d’altitude
  minimal, bassins, rivières, forêts, biomes ; résultats modifiables et annulables.
- [ ] **0.8 Cohérence** : alertes explicables sur écoulements, bassins, routes,
  mers, localités, capitales et provinces ; aucune correction automatique destructive.
- [ ] **0.9 Grandes cartes** : index spatial, chunking, streaming, LOD, workers,
  cache ; jeux de 1k/10k/100k objets et mesures matérielles documentées.
- [ ] **1.0 Stable** : tests complets plan/globe, installation, sauvegarde,
  rollback, API/SDK, chronologie, exports PNG/JSON versionné et import, documentation.

### V0.6 — Religions
- [ ] Entités religion, branches, hérésies, filiations, histoire et siège.
- [ ] Zones d’influence superposables, majorité et importance 1–5.
- [ ] Lieux saints multireligieux, types, importance, statut, fiches et liens d’articles.
- [ ] Centres religieux distincts, routes de pèlerinage, événements et conflits.
- [ ] Relations historiques, score -100/+100 facultatif, persécutions directionnelles.
- [ ] Religions officielles et politiques des royaumes distinctes des relations.
- [ ] Six sous-couches, opacité, isolation et combinaison politique/religion.
- [ ] Filtres religion/type/importance, légende dynamique, recherche et centrage.
- [ ] Permissions publiques par catégorie et filtrage des recherches/assets.
- [ ] API publique religions, religion par id, holy-sites, religious-relations.

## V1.1 à V2.0

- [ ] **1.1 Collaboration** : invitations, partage, commentaires, audit, versions et restauration.
- [ ] **1.2 Temps réel** : WebSocket, présence, curseurs et documents CRDT autorisés côté serveur.
- [ ] **1.3 Encyclopédie** : articles et liens aux entités/périodes, personnages,
  événements, batailles ; graphe/statistiques religieux, ordres, reliques, conciles, pèlerinages.
- [ ] **1.4 Militaire** : armées, fortifications, fronts, batailles, sièges et campagnes.
- [ ] **1.5 Économie** : production, consommation, ressources, marchés, ports et réseaux commerciaux.
- [ ] **1.6 Climat** : température, précipitations, vents, saisons et zones climatiques.
- [ ] **1.7 Relief avancé** : heightmaps, altitude, pente, ombrage et topographie plan/globe.
- [ ] **1.8 Styles** : parchemin, politique, topographique, atlas, militaire, minimaliste, fantasy.
- [ ] **1.9 Plugins** : API versionnée, permissions et isolation ; outils, formats, objets, panneaux, styles.
- [ ] **2.0 Plateforme** : navigation unifiée géographie, politique, population,
  cultures, religions, langues, économie, histoire, guerres, personnages, magie et bestiaire.

## V2.1 à V3.0

- [ ] **2.1 Démographie** : scénarios population, croissance, migrations.
- [ ] **2.2 Économie** : production, consommation, échanges, pénuries.
- [ ] **2.3 Diplomatie** : alliances, tensions, traités, influence.
- [ ] **2.4 Militaire** : mouvements, ravitaillement, conflits.
- [ ] **2.5 Génération assistée** : propositions modifiables avec origine documentée.
- [ ] **2.6 Mobile** : PWA installable, consultation, recherche, édition légère.
- [ ] **2.7 Desktop** : Electron, packages et moteur partagés.
- [ ] **2.8 Hors ligne** : mondes/assets téléchargés, stockage local, modifications en attente.
- [ ] **2.9 Synchronisation** : reprise, résolution visible des conflits, compatibilité des versions.
- [ ] **3.0 Simulation intégrée** : scénarios combinés, comparaison et application sélective.

Critère commun des simulations : état initial, paramètres, seed et version
d’algorithme enregistrés ; monde original inchangé avant validation ; application annulable.

## Ordre et portes de validation

Sécurité du dépôt → licence → installation/socle → modèle géographique → moteur
→ persistance → Editor/Viewer → distribution → intégration → domaines métier.
Ne pas commencer le métier avancé avant le démarrage reproductible du socle
et la validation initiale des coordonnées partagées.

## Hébergement demandé

- [x] Configuration VPS/Caddy et guide HTTPS préparés.
- [!] Mise en ligne : aucun VPS, domaine ni accès SSH disponible.
- [ ] Validation externe HTTPS, comptes distincts, sauvegarde et restauration.

### Pages de l’atelier

Accueil, Atlas du monde ouvert (recherche et filtre de géométrie), Guide et
navigation avec historique du navigateur sont disponibles dans l’Editor.
Les fonctions de publication et les modules métier avancés restent à développer.

### Export de consultation

Export PNG de la vue courante dans Editor et Viewer (carte plane et globe).
Visibilité indépendante des calques. Export JSON et import de sauvegarde à venir.

### Édition de points

Ajout, modification du nom et des coordonnées, suppression confirmée depuis
la fiche d’un point. Permissions, verrouillage de calque et révisions vérifiés
sur PostgreSQL/PostGIS réel. Annulation et dessin des autres géométries à venir.

### Annuler et rétablir les lieux

Historique de session limité à 50 actions : ajout, modification et suppression.
Les opérations inverses sont sauvegardées avec contrôle de révision et de droits.
L’historique durable et l’annulation des autres géométries restent à développer.

### Sélection directe des lieux

Sélection des points visibles par clic dans la carte plane et le globe,
ouverture de la fiche existante et distinction avec le déplacement de caméra.
La sélection directe des lignes et polygones reste à développer.

### Gestion des calques

Création, nom, opacité, verrouillage et suppression de calques vides sauvegardés.
Choix du calque à l’ajout d’un lieu. Contrôles serveur de droits et de révision.
Réordonnancement, déplacement d’objets et Undo/Redo des calques restent à faire.

### Grille kilométrique et premiers niveaux de détail

- [x] Grille plane adaptative : largeur/hauteur choisies, rayon personnalisé,
  subdivision au zoom et cadrage au niveau choisi.
- [x] Objets demandés selon la zone visible et la résolution pour les mondes
  privés, permissions serveur, regroupement des points et simplification.
- [ ] Même grille sur globe ; streaming sans chargement initial intégral,
  pagination, cache et benchmark des grandes cartes (V0.9).

### Échelle cartographique plane

- [x] Choix du dénominateur, zoom centré, indication de l’échelle nominale
  nord-sud et de la largeur physique d’impression du PNG.
- [ ] Mise en page d’impression et légende d’échelle incorporée à l’export.

### Commande de zoom

- [x] Curseur vertical circulaire en bas à droite, commun à la carte et au
  globe, synchronisé avec les autres commandes et accessible au clavier.

### Placement des lieux

- [x] Choix des coordonnées par clic en vue plane, validation par formulaire,
  sauvegarde et historique des points existant.
- [ ] Placement sur globe, dessin des lignes et polygones.
