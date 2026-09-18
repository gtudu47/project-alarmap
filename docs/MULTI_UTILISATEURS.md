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
reste stable après modification. La suppression peut être annulée pendant la session, tant que l’action figure
dans les 50 dernières actions et que le monde n’a pas été rechargé.
API : PATCH /api/v1/worlds/:id/points/:pointId (nom, coordonnées, révision),
DELETE sur la même route (révision). Toutes les routes exigent une session.

## Annuler et rétablir

Les boutons « Annuler l’action » et « Rétablir l’action » concernent l’ajout,
la modification et la suppression de lieux. Les actions sont sauvegardées sur
le serveur ; elles ne rétablissent pas une ancienne révision entière du monde.
L’historique reste en mémoire dans l’onglet (50 actions), sans stockage local
persistant. Fermer/recharger le monde ou se déconnecter efface cet historique.
Une nouvelle action après une annulation efface la suite de rétablissement.
Un conflit serveur laisse les piles intactes ; recharger abandonne l’historique.
Ce mécanisme ne remplace pas une sauvegarde ou le futur historique durable.

### Sélection directe

Cliquer sur un point dans la carte plane ou le globe ouvre sa fiche.
Un clic dans une zone vide ferme la fiche. Les déplacements de plus de cinq
pixels sont traités comme des mouvements de caméra. Les objets invisibles
(calque masqué ou opacité nulle) ne sont pas sélectionnables. Le globe teste
également la sphère pour ne pas sélectionner un point derrière la planète.
Les lignes et polygones ne disposent pas encore de sélection directe.

## Gestion des calques

Dans un monde privé ouvert, les réglages de chaque calque permettent de modifier
son nom, son opacité et le verrouillage de ses objets. Le verrouillage empêche
l’écriture des objets ; un propriétaire ou éditeur peut le désactiver.
Le nouveau calque est ajouté après les calques existants. Le formulaire d’ajout
de lieu permet de choisir un calque déverrouillé. Supprimer un calque demande
une confirmation ; le serveur refuse les calques verrouillés, non vides ou
le dernier calque du monde. Un lecteur ne peut modifier aucun calque.
La case de visibilité conserve son rôle de filtre local de consultation.
Une modification des calques réinitialise l’historique local des lieux ;
les boutons Annuler/Rétablir ne couvrent pas encore les opérations de calques.

## Grille kilométrique et détails au zoom

Dans la carte plane, ouvrir « Détail et tuiles ». Choisir largeur et hauteur
en kilomètres (par exemple 1 × 1 ou 10 × 12), puis appliquer les dimensions.
« Voir ce niveau de détail » rapproche la caméra. Les grandes mailles se
subdivisent au zoom jusqu’aux dimensions choisies ; le panneau indique le
niveau effectivement affiché. Le rayon du monde sert au calcul.
La largeur est mesurée au parallèle médian de chaque bande ; les cases aux
pôles et à l’antiméridien peuvent être partielles. Réglages limités à la session.

Les mondes privés chargent les objets de la zone visible après le déplacement
ou le zoom. Une vue éloignée conserve un représentant par cellule et calque ;
le rapprochement révèle les autres points. Les lignes sont simplifiées selon
la résolution. Les noms des points apparaissent au rapprochement. Ce mécanisme
affiche les données existantes : il ne génère pas de nouveaux paysages.

Limites : grille kilométrique disponible en vue plane seulement ; réponse
limitée à 2 000 objets avec indication de réduction. Le chargement initial du
monde reste intégral pour l’éditeur et l’Atlas. Le streaming complet des grandes
cartes, la pagination, le cache de tuiles et les mesures à 100 000 objets restent
à réaliser. La démonstration locale utilise ses objets intégrés sans requête API.

## Échelle cartographique

Dans la carte plane, ouvrir « Échelle cartographique », saisir le dénominateur
(par exemple 25000 pour 1:25 000), puis appliquer. Valeurs de 100 à un milliard.
L’échelle actuelle se recalcule au zoom et au redimensionnement ; les limites
de zoom peuvent empêcher certaines valeurs extrêmes, la valeur affichée fait foi.
À 1:25 000, 1 cm nominal représente 250 m dans la direction nord-sud.
Le calcul utilise le rayon du monde et 96 pixels CSS par pouce. La projection
équirectangulaire déforme les distances est-ouest hors de l’équateur ; cette
échelle ne constitue pas une garantie de mesure physique sur le moniteur.

Pour imprimer un PNG exporté, utiliser la largeur en centimètres indiquée au
moment de l’export, conserver les proportions et désactiver l’ajustement à la
page. Cette largeur tient compte de la taille CSS de la vue, indépendamment
de la densité de pixels du moniteur. Le PNG n’inclut pas encore de légende
d’échelle ni de mise en page d’impression automatique.

## Curseur de zoom

Une barre verticale avec poignée circulaire se trouve en bas à droite de la
carte et du globe. Monter rapproche la vue ; descendre l’éloigne. Le curseur
suit la molette, le recentrage et les changements d’échelle. Il fonctionne
au clavier avec les flèches et conserve le centre de la vue lors du réglage.
