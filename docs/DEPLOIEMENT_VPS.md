# Déploiement VPS avec domaine et HTTPS

Configuration préparée, pas encore déployée ni validée sur un VPS.
L’adresse du serveur, le domaine et l’accès SSH doivent être connus avant
toute opération distante. Aucun fournisseur ni service payant n’est créé.

## Préparer le serveur

Utiliser un VPS Linux avec Docker Engine et Compose v2. Copier les sources
validées du projet dans un répertoire de déploiement. Ne pas copier `.env`,
`node_modules`, `data` ni les secrets du poste de développement.

Le domaine ou sous-domaine doit pointer vers le VPS via son enregistrement A
(et AAAA seulement si IPv6 fonctionne). Les ports 80 et 443 doivent être
accessibles. Préserver l’accès SSH existant. PostgreSQL, MinIO et l’API ne sont
pas publiés directement sur Internet par la configuration fournie.

## Configurer

Depuis le répertoire du projet, créer les secrets du serveur avec Node 24 :

```sh
node scripts/init-env.mjs
```

Si Node n’est pas installé sur le VPS, utiliser le conteneur Node :

```sh
docker run --rm --user "$(id -u):$(id -g)" -v "$PWD:/work" -w /work node:24-bookworm-slim node scripts/init-env.mjs
```

Ajouter dans `.env` le véritable domaine, sans protocole ni chemin :

```dotenv
ALARMAP_DOMAIN=maps.example.com
```

Le fichier de production impose `PUBLIC_APP_URL=https://<ALARMAP_DOMAIN>` pour
l’API et les migrations. Les liens d’invitation et cookies utilisent donc HTTPS.

## Lancer et vérifier

```sh
docker compose -f docker-compose.yml -f docker-compose.production.yml config --quiet
docker compose -f docker-compose.yml -f docker-compose.production.yml up -d --build --wait --wait-timeout 300
```

Vérifier depuis un ordinateur extérieur au serveur :

```sh
curl --fail https://maps.example.com/api/v1/health/ready
```

Puis ouvrir le site et vérifier le certificat TLS. Caddy obtient et renouvelle
les certificats lorsque le domaine et les ports sont correctement accessibles.
Voir la [documentation HTTPS officielle](https://caddyserver.com/docs/automatic-https).

Le gateway transmet directement les requêtes aux services internes, avec un
unique proxy de confiance pour la limitation des tentatives par IP. Les routes
Viewer et iframe conservent leur préfixe d’assets `/viewer/`.

## Activer et inviter

Suivre [MULTI_UTILISATEURS.md](MULTI_UTILISATEURS.md) pour créer le lien
administrateur dans le conteneur puis le récupérer par SSH/SCP.
Ouvrir ce lien, créer le premier compte et générer une invitation de test.
Dans un navigateur séparé, accepter l’invitation, créer un monde et vérifier
qu’il ne figure pas dans l’espace du premier compte.

## Exploitation

Conserver les volumes PostgreSQL, MinIO et Caddy. Le proxy Nginx de développement
reste lié à 127.0.0.1:8080 ; l’accès public passe exclusivement par Caddy.
Ne pas ajouter le fichier `docker-compose.dev.yml` sur le serveur public.

Les mises à jour automatiques, sauvegardes restaurables et rollback du lot F
ne sont pas encore implémentés. Ne pas présenter cette version comme la V1.0
stable ni y stocker l’unique copie de données importantes.
