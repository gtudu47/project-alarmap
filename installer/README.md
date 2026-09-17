# Installation depuis les sources

Les scripts racines install.ps1 (Windows) et install.sh (Linux) installent
la pile depuis le dépôt cloné. Ils vérifient Docker/Compose et le moteur Linux,
créent .env avec des secrets aléatoires si absent, construisent les images,
créent les volumes, lancent les migrations et attendent les contrôles de santé.
La génération de configuration utilise Node dans un conteneur temporaire.
Aucun Node/npm n’est requis sur l’hôte pour ce parcours.

## Utilisation

Windows : ./install.ps1 ; vérification seule : ./install.ps1 -CheckOnly.
Linux : bash install.sh ; vérification seule : bash install.sh --check.
Exécuter depuis une copie locale du dépôt avec accès au moteur Docker.
Le port local 8080 doit être libre. Le premier build nécessite Internet.
Un .env existant n’est jamais écrasé. Une erreur conserve les volumes et les
fichiers ; corriger sa cause puis relancer. Ne pas supprimer les volumes.
Les scripts ne téléchargent ni n’installent Docker lui-même.
Après démarrage : http://localhost:8080/.
Pour le premier compte : voir docs/MULTI_UTILISATEURS.md.

## Limites et validation

Pile Compose construite et testée avec Docker Desktop/Windows.
Prérequis du script PowerShell vérifiés sur ce poste ; syntaxe Bash vérifiée
avec bash -n dans Linux. Installation automatique neuve Linux non encore validée.
L’installation depuis une release signée/avec empreintes, la sauvegarde avant
mise à jour, le rollback et l’updater automatique restent le lot V0.1-F.
Ne pas utiliser ces scripts comme procédure de mise à jour d’une production
contenant des données sans sauvegarde préalable.
