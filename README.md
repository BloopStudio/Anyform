# Anyform

Convertisseur de formats de fichiers (images, données, audio, vidéo), 100% côté client —
aucun fichier n'est jamais envoyé à un serveur. Développé par **BloopStudio**.

Cette branche `main` sert uniquement de page d'accueil au dépôt : le code vit sur les
branches ci-dessous, chacune correspondant à une façon d'utiliser Anyform.

## 🔗 Essayer maintenant

**[bloopstudio.github.io/Anyform](https://bloopstudio.github.io/Anyform/)** — aucune
installation, ouvre directement dans le navigateur.

## Branches

| Branche | Description |
| --- | --- |
| [`web-converter`](https://github.com/BloopStudio/Anyform/tree/web-converter) | App web statique déployée sur GitHub Pages (source de la page d'accueil ci-dessus) |
| [`cli-converter`](https://github.com/BloopStudio/Anyform/tree/cli-converter) | Outil en ligne de commande (non publié sur npm : `git clone` + `npm install` + `npm link`) |
| [`browser-extension`](https://github.com/BloopStudio/Anyform/tree/browser-extension) | Extension Chrome/Edge (clic droit sur une image → convertir) |
| [`desktop-app`](https://github.com/BloopStudio/Anyform/tree/desktop-app) | App de bureau Electron (Windows/macOS/Linux) |
| [`node-library`](https://github.com/BloopStudio/Anyform/tree/node-library) | Bibliothèque Node.js (`npm install anyform`) — mêmes fonctions que le CLI, appelables directement depuis un autre programme |

## Téléchargements

- App de bureau (.exe / .dmg / .AppImage) : [dernière release](https://github.com/BloopStudio/Anyform/releases/latest)
- Extension navigateur : bientôt sur le Chrome Web Store

## Convertisseur, Compresseur, Inspecteur, Comparateur

Quatre modes disponibles (web, app de bureau, extension — le CLI et la bibliothèque Node
exposent les mêmes fonctions via `-c`/`info`/`diff` plutôt que des onglets) :

- **Convertisseur** : change le format (tableau ci-dessous).
- **Compresseur** : réduit la taille d'un fichier **sans changer son format**, avec un
  niveau Léger/Moyen/Fort — images (dont minification SVG), audio, vidéo et PDF
  (recompression des images JPEG intégrées).
- **Inspecteur** : lit les propriétés d'un fichier (dimensions, durée, métadonnées...) sans
  le modifier — y compris des formats que le Convertisseur ne gère pas : PDF, ZIP et
  polices TTF/OTF/WOFF/WOFF2, plus tags ID3 (MP3), EXIF (images) et codec vidéo (MP4/MOV).
- **Comparateur** : diff visuelle (images), ligne à ligne (données/sous-titres) ou par
  empreinte SHA-256 (reste) entre deux fichiers.

## Formats supportés

- **Images** : SVG, PNG, JPG, WebP, GIF, BMP, HEIC en entrée ⇄ PNG/JPG/WebP/AVIF/ICO/TIFF/SVG
  en sortie (vectorisation raster → SVG, décodage HEIC)
- **Audio** : WAV, MP3, OGG, M4A, FLAC, AAC, WMA, Opus
- **Vidéo** : MP4, WebM, MOV, MKV, AVI, FLV, OGV en entrée ⇄ les mêmes + GIF animé en sortie
- **Données** : CSV ⇄ JSON ⇄ XLSX
- **Inspection/compression seule** (pas de format de sortie équivalent) : PDF, ZIP, polices

## Confidentialité

Aucune collecte de données, traitement 100% local. Détails :
[politique de confidentialité](https://bloopstudio.github.io/Anyform/privacy.html).

## Documentation

Le [wiki](https://github.com/BloopStudio/Anyform/wiki) détaille chaque forme d'Anyform,
l'architecture du dépôt et les pipelines CI/CD.

## Contribuer

Voir [CONTRIBUTING.md](CONTRIBUTING.md) (modèle de branches, comment proposer une PR) et
le [code de conduite](CODE_OF_CONDUCT.md). Projet sous licence [MIT](LICENSE).
