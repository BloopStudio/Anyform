# Politique de sécurité

## Signaler une vulnérabilité

Merci de **ne pas** ouvrir d'issue publique pour signaler une faille de sécurité.

Méthode préférée : utiliser l'onglet **[Security → Report a vulnerability](https://github.com/BloopStudio/Anyform/security/advisories/new)**
du dépôt (signalement privé, visible uniquement par les mainteneurs jusqu'à résolution).

Si cette option n'est pas disponible, ouvrir une issue minimale (sans détail
d'exploitation) demandant un canal de contact privé.

## Portée

Anyform (web, CLI, extension navigateur, application de bureau) traite tous les fichiers
localement — aucune donnée n'est envoyée à un serveur. Les rapports les plus utiles
concernent :

- l'exécution de code arbitraire lors du traitement d'un fichier malveillant
  (image/audio/vidéo/données forgées pour exploiter une des librairies utilisées :
  sharp, ffmpeg.wasm, SheetJS, potrace, heic-convert...)
- les permissions de l'extension navigateur (accès excessif, fuite de données entre
  onglets)
- toute vulnérabilité dans les dépendances tierces vendorisées

## Versions supportées

Seule la dernière version publiée de chaque forme d'Anyform (web déployé, dernière
release de l'app de bureau, dernier commit des branches CLI/extension) est prise en
charge.
