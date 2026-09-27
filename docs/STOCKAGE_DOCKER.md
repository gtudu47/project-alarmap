# Construction du stockage Docker

MinIO Community est distribué depuis les sources : https://github.com/minio/minio.
Les anciennes images officielles ne sont plus téléchargeables lors des validations de septembre 2026.

Compose construit désormais le serveur et le client avec docker/Minio.Dockerfile.
Sources officielles utilisées, sans changement de version des données :
- https://github.com/minio/minio/tree/RELEASE.2025-09-07T16-13-09Z
- https://github.com/minio/mc/tree/RELEASE.2025-08-13T08-35-41Z

Go vérifie les modules via sa base de sommes de contrôle. La première construction exige un accès à Docker Hub et aux modules Go ; elle est plus longue et nécessite davantage de mémoire que le téléchargement des anciennes images. Les constructions suivantes utilisent le cache Docker.

Les noms des services, le volume minio-data, le bucket et les paramètres S3 sont conservés. Ne pas supprimer les volumes pour reconstruire les images. La commande habituelle docker compose up -d --build reste valable.

Le serveur et le client MinIO sont des composants distincts sous licence AGPL-3.0 ; les sources correspondant aux tags ci-dessus restent disponibles auprès du projet officiel. Cette construction rétablit la distribution ; elle ne constitue pas une mise à niveau ni une garantie de maintenance du logiciel amont.

## Validation

La CI démarre les services, vérifie la disponibilité du bucket puis exécute scripts/check-storage.mjs dans le conteneur API. Ce test écrit un objet de nom aléatoire sous installation-tests/, vérifie son contenu et supprime uniquement cet objet. Les identifiants restent dans l’environnement du conteneur.

Sous Linux : docker compose exec -T alarmap-api node --input-type=module < scripts/check-storage.mjs

Sous PowerShell : Get-Content -Raw scripts/check-storage.mjs | docker compose exec -T alarmap-api node --input-type=module
