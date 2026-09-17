# Comptes et mondes personnels

## Parcours

1. L’administrateur active l’instance avec un lien local à usage unique.
2. Dans **Mon espace**, il génère une invitation pour une adresse email.
3. Il transmet lui-même le lien ; aucun email n’est envoyé automatiquement.
4. La personne choisit son nom et un mot de passe de 12 caractères minimum.
5. Elle crée ses propres mondes et les retrouve après reconnexion.

Un compte invité n’est pas administrateur. Une invitation ne donne accès à
aucun monde existant. L’administrateur de l’instance ne voit pas les mondes
des autres comptes par défaut ; chaque requête vérifie propriétaire ou membre.
Le partage explicite de mondes avec d’autres membres reste un futur écran.

Le premier outil disponible dans un monde personnel ajoute un lieu par
longitude/latitude, avec sauvegarde immédiate côté serveur. Les outils de dessin
complets et la publication publique ne sont pas encore disponibles.

## Première activation en développement natif

Après configuration et démarrage de PostgreSQL/PostGIS :

```sh
npm run db:migrate
npm run admin:setup
```

Ouvrir le lien contenu dans `secrets/admin-setup.txt`. Il expire après une heure
et ne peut être utilisé qu’une fois. Une nouvelle exécution renouvelle le lien
tant qu’aucun compte n’existe. Dès le premier compte créé, la commande et la
route d’initialisation refusent toute réinitialisation.

## Sur une instance Docker

Après le démarrage et les migrations, exécuter dans le conteneur :

```sh
docker compose exec alarmap-api node apps/api/dist/setup-admin.js
mkdir -p secrets
docker compose cp alarmap-api:/app/secrets/admin-setup.txt ./secrets/admin-setup.txt
```

Sous Windows, remplacer `mkdir -p secrets` par :

```powershell
New-Item -ItemType Directory -Force secrets
```

Sur le VPS, récupérer le fichier par SSH/SCP puis ouvrir son lien dans le
navigateur. Ne pas partager le lien administrateur avec les futurs utilisateurs.
Le dossier `secrets/` est ignoré par Git et exclu des images Docker.

## Sécurité et limites

- Mots de passe hachés avec Argon2id.
- JWT d’accès de 15 minutes, gardé uniquement en mémoire dans le navigateur.
- Renouvellement par cookie HttpOnly/SameSite Strict, Secure lorsque l’URL est HTTPS.
- Session de sept jours, renouvellement atomique du jeton, révocation à la déconnexion.
- Contrôle d’origine sur les opérations d’authentification et limitation des tentatives.
- Invitations de sept jours, révocables ; seule leur empreinte est persistée.
- Validation stricte des entrées et contrôle serveur des rôles.
- Ajout d’un lieu sous verrou de monde avec révision attendue ; conflit HTTP 409.

Pas encore de récupération de mot de passe, de MFA, de désactivation de comptes
ni de service email. Le limiteur est local à l’unique processus API ; une
installation à plusieurs réplicas nécessitera un stockage de limites partagé.
Les données existantes ne sont pas modifiées par le simple affichage d’une carte.

## API ajoutée

| Route | Accès |
|---|---|
| GET /api/v1/auth/status | État de l’initialisation, sans liste d’utilisateurs |
| POST /api/v1/auth/setup | Lien initial à usage unique, avant création du premier compte |
| POST /api/v1/auth/login | Email et mot de passe |
| POST /api/v1/auth/accept-invitation | Invitation valide |
| POST /api/v1/auth/refresh | Cookie de session et origine autorisée |
| POST /api/v1/auth/logout | Session authentifiée et origine autorisée |
| GET /api/v1/auth/me | Compte connecté |
| GET, POST /api/v1/invitations | Administrateur |
| DELETE /api/v1/invitations/:id | Administrateur |
| GET, POST /api/v1/worlds | Compte connecté |
| GET /api/v1/worlds/:id | Propriétaire ou membre |
| POST /api/v1/worlds/:id/points | Propriétaire ou éditeur |

Les comptes anonymes reçoivent 401. Un monde inaccessible retourne 404.
Un membre en lecture seule reçoit 403 s’il essaie d’ajouter un lieu.

## Modification et suppression des lieux

Dans l’Atlas, cliquer sur « Localiser » pour ouvrir la fiche d’un point.
Le propriétaire ou un éditeur peut modifier son nom, sa longitude et sa latitude.
La suppression demande une confirmation dans la fiche. Les deux opérations
vérifient la révision du monde et le verrouillage du calque côté serveur.
Un conflit impose de recharger le monde avant de réessayer. L’identité du lieu
reste stable après modification. La suppression est définitive à ce stade ;
l’annulation et l’historique d’édition restent à développer.
API : PATCH /api/v1/worlds/:id/points/:pointId (nom, coordonnées, révision),
DELETE sur la même route (révision). Toutes les routes exigent une session.
