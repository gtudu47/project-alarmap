# Updater — contrat du lot V0.1-F

État : non implémenté ; aucune tâche planifiée n’a été créée.

Canal main uniquement. Vérifier une release validée toutes les six heures.
Windows : tâche « AlarMap Auto Update ». Linux : systemd service/timer.

Séquence attendue : verrou → validation manifeste/digests/compatibilité →
suspension des écritures → sauvegarde cohérente DB/config/version/assets →
installation → migrations → health checks → réouverture.

Échec : restaurer une paire application/base cohérente avant de réautoriser
les écritures. Conserver les assets immuables et les sauvegardes d’incident.
Rotation de cinq sauvegardes réussies ; aucune suppression des données actives.

La sauvegarde n’est considérée fonctionnelle qu’après un test de restauration.
Le workflow de release sera ajouté avec cette chaîne validée, sans publier
prématurément ce socle comme installation stable.
