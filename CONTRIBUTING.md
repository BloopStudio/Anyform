# Contribuer à Anyform

Merci de l'intérêt porté à ce projet ! Ce dépôt a un modèle de branches un peu
particulier — merci de le lire avant d'ouvrir une pull request.

## Modèle de branches

Il n'y a **pas de branche de développement partagée**. Chaque forme de distribution
d'Anyform vit sur sa propre branche indépendante :

| Branche | Contenu |
| --- | --- |
| `main` | Page d'accueil du dépôt uniquement (pas de code) |
| `web-converter` | App web statique |
| `cli-converter` | Outil en ligne de commande |
| `browser-extension` | Extension Chrome/Edge |
| `desktop-app` | Application de bureau Electron |

**Une pull request doit cibler la branche correspondant à ce qu'elle modifie**, pas
`main`. Par exemple, un fix dans l'app web part de `web-converter` et cible
`web-converter`.

Détails complets du modèle de branches et des pipelines CI :
[page Architecture et CI-CD du wiki](https://github.com/BloopStudio/Anyform/wiki/Architecture-et-CI-CD).

## Avant d'ouvrir une pull request

1. Vérifier qu'une [issue](https://github.com/BloopStudio/Anyform/issues) ou une PR
   similaire n'existe pas déjà.
2. Partir de la bonne branche (voir tableau ci-dessus).
3. Tester localement — chaque branche a ses instructions dans son propre `README.md`
   (`npm install` puis la commande adaptée : `npx serve public`, `node bin/anyform.js`,
   extension non empaquetée, ou `npm start`).
4. Ne pas modifier les fichiers de version (`VERSION`, ou le champ `version` de
   `package.json`/`manifest.json`) — ils sont incrémentés automatiquement par CI à chaque
   push.

## Style de code

Pas de linter/formatter imposé pour l'instant — merci de rester cohérent avec le style
déjà présent dans le fichier modifié (JavaScript vanilla, pas de framework, commentaires
en français).

## Signaler un bug ou proposer une fonctionnalité

Ouvrir une [issue](https://github.com/BloopStudio/Anyform/issues) en précisant sur quelle
forme d'Anyform (web / CLI / extension / bureau) porte le problème.

## Sécurité

Pour signaler une vulnérabilité, voir [SECURITY.md](SECURITY.md) — ne pas ouvrir d'issue
publique pour un problème de sécurité.
