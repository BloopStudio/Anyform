# Anyform

Convertisseur de formats de fichiers (images, données, audio, vidéo), 100% côté client —
aucun fichier n'est jamais envoyé à un serveur. Développé par **BloopStudio**.

Cette branche `main` sert uniquement de page d'accueil au dépôt : le code vit sur les
branches ci-dessous, chacune correspondant à une façon d'utiliser Anyform.

## 🔗 Essayer maintenant

**[thedemon78.github.io/Anyform](https://thedemon78.github.io/Anyform/)** — aucune
installation, ouvre directement dans le navigateur.

## Branches

| Branche | Description |
| --- | --- |
| [`web-converter`](https://github.com/TheDEMON78/Anyform/tree/web-converter) | App web statique déployée sur GitHub Pages (source de la page d'accueil ci-dessus) |
| [`cli-converter`](https://github.com/TheDEMON78/Anyform/tree/cli-converter) | Outil en ligne de commande (`npx anyform-cli` / `npm i -g`) |
| [`browser-extension`](https://github.com/TheDEMON78/Anyform/tree/browser-extension) | Extension Chrome/Edge (clic droit sur une image → convertir) |
| [`desktop-app`](https://github.com/TheDEMON78/Anyform/tree/desktop-app) | App de bureau Electron (Windows/macOS/Linux) |

## Téléchargements

- App de bureau (.exe / .dmg / .AppImage) : [release **desktop-latest**](https://github.com/TheDEMON78/Anyform/releases/tag/desktop-latest)
- Extension navigateur : bientôt sur le Chrome Web Store

## Formats supportés

- **Images** : SVG, PNG, JPG, WebP, GIF, BMP, HEIC en entrée ⇄ PNG/JPG/WebP/AVIF/ICO/TIFF/SVG
  en sortie (vectorisation raster → SVG, décodage HEIC)
- **Audio** : WAV, MP3, OGG, M4A, FLAC, AAC, WMA, Opus
- **Vidéo** : MP4, WebM, MOV, MKV, AVI, FLV, OGV en entrée ⇄ les mêmes + GIF animé en sortie
- **Données** : CSV ⇄ JSON ⇄ XLSX

## Confidentialité

Aucune collecte de données, traitement 100% local. Détails :
[politique de confidentialité](https://thedemon78.github.io/Anyform/privacy.html).
