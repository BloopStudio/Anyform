# Anyform

Développé par **BloopStudio**. Convertisseur de formats de fichiers (images, données,
audio, vidéo), 100% côté client, avec une interface web (drag & drop) déployée sur GitHub
Pages. Trois autres branches proposent la même logique sous d'autres formes :
[`cli-converter`](https://github.com/TheDEMON78/Anyform/tree/cli-converter) (ligne de
commande), [`browser-extension`](https://github.com/TheDEMON78/Anyform/tree/browser-extension)
(extension Chrome/Edge) et
[`desktop-app`](https://github.com/TheDEMON78/Anyform/tree/desktop-app) (application de
bureau Electron).

**En ligne : [thedemon78.github.io/Anyform](https://thedemon78.github.io/Anyform/)**

## App web — 100% dans le navigateur

Aucune installation nécessaire : pas de Node, pas de serveur, pas de dépendances à
installer côté utilisateur. Toute la conversion se fait en JavaScript directement dans le
navigateur, tout est vendorisé localement dans `public/vendor/` — aucun appel réseau
externe, même pour la vidéo/l'audio (ffmpeg.wasm) ou le décodage HEIC.

Il suffit d'ouvrir `public/index.html`, ou de visiter la page déployée sur GitHub Pages, de
choisir le mode (**Convertisseur** ou **Compresseur**), le type de fichier (onglets
Image/Données/Audio/Vidéo), déposer un fichier, choisir le format cible, et cliquer sur
"Convertir". Une barre de progression suit les conversions audio/vidéo (moteur
ffmpeg.wasm), et le résultat s'affiche dans une carte dédiée avec téléchargement et bouton
pour recommencer. Le thème (clair/sombre) suit automatiquement les préférences de
l'appareil.

### Deux modes

- **Convertisseur** : change le format d'un fichier (formats ci-dessous).
- **Compresseur** : réduit la taille d'un fichier **sans changer son format** — limité aux
  images et vidéos, avec un niveau Léger/Moyen/Fort. Images : qualité réduite pour
  JPG/WebP, redimensionnement pour PNG/GIF/BMP (pas de curseur de qualité pour ceux-là).
  Vidéo : CRF réduit sur le même codec/conteneur, audio inchangé. Voir
  `public/compress.js`.

### Formats supportés (Convertisseur)

- Images : SVG, PNG, JPG, WebP, GIF, BMP, HEIC en entrée ⇄ PNG/JPG/WebP/AVIF/ICO/TIFF/SVG en
  sortie (vectorisation raster → SVG incluse via ImageTracer.js, décodage HEIC via
  `heic2any`/libheif WASM)
- Audio : WAV, MP3, OGG, M4A, FLAC, AAC, WMA, Opus (moteur ffmpeg.wasm)
- Vidéo : MP4, WebM, MOV, MKV, AVI, FLV, OGV en entrée ⇄ les mêmes + GIF animé en sortie
  (moteur ffmpeg.wasm)
- Données : CSV ⇄ JSON ⇄ XLSX (SheetJS)

D'autres formats (documents, archives...) pourront être ajoutés par la suite.

## Confidentialité

Aucune donnée n'est envoyée à un serveur, aucune collecte. Détails :
[politique de confidentialité](https://thedemon78.github.io/Anyform/privacy.html).

## Déploiement sur GitHub Pages

Un workflow (`.github/workflows/deploy-pages.yml`) déploie automatiquement le contenu de
`public/` à chaque push sur **`web-converter`** (pas besoin de merger vers `main`, qui sert
uniquement de page d'accueil au dépôt), et applique un cache-busting (`?v=<sha>`) sur les
scripts/styles pour que les navigateurs ne servent jamais une version périmée. Étape unique
à faire une fois côté dépôt : dans **Settings → Pages**, choisir la source
**"GitHub Actions"**, et dans **Settings → Environments → github-pages → Deployment
branches**, autoriser la branche `web-converter`.

Un second workflow (`.github/workflows/bump-version.yml`) incrémente automatiquement le
patch de `VERSION` à chaque push.

## Développement local

Pas de build nécessaire. Pour tester en local, servir simplement le dossier `public/` :

```bash
npx serve public
```

## Structure

- `public/convert.js` — conversion d'images (Canvas API + ImageTracer.js + heic2any + UTIF.js)
- `public/compress.js` — compression d'images/vidéos (même format en sortie)
- `public/data.js` — conversion de données (CSV/JSON/XLSX)
- `public/ffmpeg-engine.js` — chargement partagé du moteur ffmpeg.wasm
- `public/audio.js` / `public/video.js` — conversion audio/vidéo (ffmpeg.wasm)
- `public/app.js` — interface (onglets par type, formats, glisser-déposer, progression,
  téléchargement)
- `public/privacy.html` — politique de confidentialité
- `public/vendor/` — librairies vendorisées (ImageTracer.js, SheetJS, heic2any, UTIF.js,
  ffmpeg.wasm)
