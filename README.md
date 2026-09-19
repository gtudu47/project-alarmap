# AlarMap

Cartographie et worldbuilding auto-hébergés, en français. Angular, NestJS,
PostgreSQL/PostGIS et un moteur commun avec PixiJS (carte plane) et Three.js (globe).

## État réel
(en dévellopement active)
Version `0.1.0-dev.1`, branche `dev`. Le dépôt contient le socle du monorepo,
une API de santé, les migrations initiales et deux applications affichant la
même scène géographique de démonstration. Le changement carte/globe, le
déplacement, le zoom et la visibilité du calque sont disponibles.

**Comptes et espaces personnels ajoutés.** Le bouton **Mon espace** permet la
connexion, l’inscription sur invitation, la création de mondes privés et leur
réouverture. Un premier outil enregistre des lieux par longitude/latitude.
L’administrateur peut créer et révoquer les invitations. Aucun compte n’est
créé automatiquement.

Le fonctionnement local complet demande PostgreSQL/PostGIS et les migrations.
Dans la prévisualisation sans base, la démonstration reste disponible mais les
comptes affichent l’indisponibilité du serveur. Le dessin complet, la publication
publique, les exports JSON, l’installateur de releases et le rollback restent à
implémenter. La route /embed/demonstration montre encore la scène de référence.

- [Activer les comptes et inviter des personnes](docs/MULTI_UTILISATEURS.md)
- [Préparer un VPS avec domaine et HTTPS](docs/DEPLOIEMENT_VPS.md)

La configuration VPS est préparée, mais aucun serveur, domaine ou déploiement
public n’existe encore pour cette instance.

Voir [ROADMAP](docs/ROADMAP.md), [architecture](docs/ARCHITECTURE.md) et
[fiche de reprise](docs/CODEX_HANDOFF.md).

## Prérequis

- Node.js 24.13 ou plus récent dans la branche 24 ; npm 11.
- Docker Desktop avec conteneurs Linux sous Windows, ou Docker Engine avec
  Compose v2 sous Linux, pour PostgreSQL/PostGIS et la validation complète.
- Navigateur avec WebGL2 pour le globe.

```sh
npm ci
npm run config:init
npm run check
```

`config:init` crée `.env` avec des secrets aléatoires sans écraser un fichier
existant. Les secrets ne sont jamais affichés. La configuration partagée est
documentée dans `.env.example` ; `.env` reste local et ignoré par Git.

Alternative manuelle Linux :

```sh
cp .env.example .env
```

Alternative manuelle PowerShell :

```powershell
Copy-Item .env.example .env
```

Après une copie manuelle, remplacer les secrets d’exemple avant le lancement
Docker. L’API refuse les secrets d’exemple en production. L’installation
automatique de releases réalisera cette initialisation en V0.1-F.

## Installation depuis le dépôt

Cloner ce dépôt puis, depuis sa racine :

- Windows : ouvrir PowerShell et lancer `./install.ps1`.
- Linux : lancer `bash install.sh`.

Docker doit être installé et son moteur Linux démarré. Ces scripts génèrent
la configuration si elle manque, construisent les images et attendent que les
services soient sains. Node.js et npm sur l’hôte ne sont pas nécessaires pour
ce parcours. Réexécuter le script conserve la configuration et les volumes.
Vérification seule : `./install.ps1 -CheckOnly` ou `bash install.sh --check`.
Il s’agit d’une installation depuis les sources, pas encore d’une release validée.
Voir [détails des installateurs](installer/README.md).

## Démarrer avec Docker Compose

Depuis la racine, après `npm run config:init` :

```sh
docker compose up -d --build --wait --wait-timeout 240
```

- Editor : <http://localhost:8080/>
- Viewer : <http://localhost:8080/viewer/>
- Démonstration iframe : <http://localhost:8080/embed/demonstration>
- Swagger : <http://localhost:8080/api/docs>
- Santé processus : `/api/v1/health/live`
- Santé complète : `/api/v1/health/ready`

Les migrations et la création du bucket sont exécutées avant l’API. PostgreSQL
et MinIO ne sont pas exposés sur l’hôte par défaut. Le proxy écoute uniquement
sur la boucle locale ; un déploiement public nécessitera TLS et la validation des
comptes et du déploiement complet. Les volumes persistent après `docker compose down`.

**Ne pas utiliser `docker compose down -v` sur une installation contenant des
données à conserver.**

## Prévisualisation sans Docker

Après `npm run build`, lancer `npm run preview` puis ouvrir
<http://127.0.0.1:8080/>. La scène fonctionne sans backend ; l’indicateur
affiche honnêtement que les services ne sont pas disponibles. Ce serveur
local ne remplace pas la validation de Nginx ou de Compose.

## Développement natif

Démarrer les dépendances :

```sh
docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d alarmap-postgres alarmap-minio storage-init
npm run db:migrate
```

Puis, dans trois terminaux :

```sh
npm run dev:api
npm run dev:editor
npm run dev:viewer
```

Editor : <http://localhost:4200/> ; Viewer : <http://localhost:4201/viewer/>.
Les fronts utilisent un proxy local vers l’API sur le port 3000.
Le stockage natif utilise `data/assets`, ignoré par Git.

## Contrôles

```sh
npm run doctor
npm run check             # lint, types, tests unitaires, builds
npm run check:secrets     # fichiers suivis par Git
npm run test:integration  # nécessite PostgreSQL/PostGIS accessible via .env
npx playwright install chromium
npm run test:e2e          # nécessite les applications sur localhost:8080
```

Les tests d’intégration utilisent des transactions annulées ou des comptes
éphémères nettoyés à la fin. Les migrations de schéma restent appliquées.
Les tests de comptes locaux utilisent PostgreSQL embarqué (PGlite), sans
PostGIS ; ils ne remplacent pas les tests complets avec Docker.

La CI vérifie le code sur Windows et Linux et la pile Compose sur Linux. Une
CI configurée ne signifie pas qu’elle a déjà été exécutée : les résultats
locaux et les limites sont consignés dans la fiche de reprise.

## Organisation

`apps/{editor,viewer,api}` contiennent les applications ; `apps/ui` leur coque
Angular partagée. `packages/{map-model,map-engine,map-sdk,shared}` contiennent
les bibliothèques. Aucun rendu n’est propre à l’Editor ou au Viewer.

Le modèle est géographique, avec un rayon de planète configurable. Les années
sont signées ; la borne de début est incluse et celle de fin est exclue.

## License

Le projet est distribué sous **PolyForm Noncommercial License 1.0.0**.
L’utilisation commerciale n’est pas autorisée par cette licence.
Le texte de `LICENSE` reprend celui fourni dans le cahier des charges.

See [LICENSE](LICENSE).
