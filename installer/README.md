# Installateur — contrat du lot V0.1-F

État : préparé par la configuration Compose ; installateur de releases non implémenté.
Lancer le socle depuis un checkout est documenté dans le README racine.

Cible : `https://github.com/gtudu47/project-alarmap`, releases validées de main.
Les futurs install.ps1/install.sh devront télécharger vers un dossier temporaire
propre à l’opération, vérifier les empreintes, détecter Docker/Compose, générer
les secrets sans écraser une configuration existante, créer les volumes,
appliquer les migrations, créer le stockage et vérifier les services.

Créer ensuite l’administrateur via une initialisation unique, puis planifier
l’updater. Les nettoyages doivent vérifier que leurs chemins restent dans le
dossier temporaire créé par l’installateur.

Acceptation : installation Windows Docker Desktop et Linux Docker Engine,
réexécution idempotente, configuration préexistante conservée, échec lisible
sans perte de volumes et aucune valeur secrète dans les logs.
