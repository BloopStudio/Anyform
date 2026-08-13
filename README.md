# Anyform

Développé par **BloopStudio**. Cette branche contient l'application de bureau Electron.
Les autres façons d'utiliser Anyform :

| Branche | Description |
| --- | --- |
| [`web-converter`](https://github.com/TheDEMON78/Anyform/tree/web-converter) | App web, déployée sur [thedemon78.github.io/Anyform](https://thedemon78.github.io/Anyform/) |
| [`cli-converter`](https://github.com/TheDEMON78/Anyform/tree/cli-converter) | Outil en ligne de commande |
| [`browser-extension`](https://github.com/TheDEMON78/Anyform/tree/browser-extension) | Extension Chrome/Edge |

## App de bureau (Electron)

Wrapper Electron autour de l'app web : même interface, même code de conversion
(`public/`), sans rien changer — juste une fenêtre native au lieu du navigateur.

```bash
npm install
npm start
```

Pour construire un exécutable distribuable (`.dmg` sur macOS, `.exe`/NSIS sur Windows,
`.AppImage` sur Linux) :

```bash
npm run dist
```

### Installateurs personnalisés

- **Windows (NSIS)** : assistant classique (choix du dossier d'installation) avec licence
  MIT à accepter, bannière et barre latérale aux couleurs d'Anyform
  (`build/installer-header.bmp`, `build/installer-sidebar.bmp`, générées depuis
  `build/license.txt`).
- **macOS (DMG)** : fenêtre d'installation avec fond personnalisé
  (`build/dmg-background.png`) illustrant le glisser-déposer vers `/Applications`.
- **Linux (AppImage)** : pas d'assistant graphique, personnalisation limitée à
  l'icône/aux métadonnées déjà en place.

### Builds automatiques (GitHub Actions)

Le workflow `.github/workflows/build-desktop.yml` construit automatiquement les trois
installateurs (Windows `.exe`, macOS `.dmg`, Linux `.AppImage`) à chaque push sur
`desktop-app`, ou manuellement via l'onglet **Actions → Construire l'app de bureau → Run
workflow**. La première étape (`bump`) incrémente le patch de `package.json` et pousse ce
commit *avant* que le job `build` ne parte construire les installateurs à partir de cette
nouvelle HEAD — les `.exe`/`.dmg`/`.AppImage` générés portent donc toujours le numéro de
version qui vient d'être incrémenté, pas l'ancien.

Chaque build publie une [release GitHub](https://github.com/TheDEMON78/Anyform/releases)
taguée avec le numéro de version (`v1.0.7`, `v1.0.8`...), les fichiers portant eux aussi la
version dans leur nom (`Anyform-1.0.7-win-x64.exe`, etc.), la plus récente étant marquée
**Latest**. Seules les **10 releases les plus récentes** sont conservées : les plus
anciennes sont supprimées automatiquement à la fin de chaque build. Les fichiers sont
aussi disponibles 30 jours dans les **Artifacts** du run pour du débogage rapide. Les builds
ne sont pas signés (pas de certificat) : Windows SmartScreen et macOS Gatekeeper afficheront
un avertissement au premier lancement.

## Deux modes : Convertisseur et Compresseur

Un onglet en haut de l'interface bascule entre les deux :

- **Convertisseur** : change le format d'un fichier (formats ci-dessous).
- **Compresseur** : réduit la taille d'un fichier **sans changer son format**. Limité aux
  images (qualité réduite pour JPG/WebP, redimensionnement pour PNG) et aux
  vidéos (CRF réduit sur le même codec/conteneur, audio inchangé), avec un niveau
  Léger/Moyen/Fort. Voir `public/compress.js`.

Le thème (clair/sombre) suit automatiquement les préférences de l'appareil.

## Formats supportés (Convertisseur)

- Images : SVG, PNG, JPG, WebP, GIF, BMP, HEIC en entrée ⇄ PNG/JPG/WebP/AVIF/ICO/TIFF/SVG en
  sortie (vectorisation raster → SVG incluse via ImageTracer.js, décodage HEIC via
  `heic2any`/libheif WASM)
- Audio : WAV, MP3, OGG, M4A, FLAC, AAC, WMA, Opus (moteur ffmpeg.wasm)
- Vidéo : MP4, WebM, MOV, MKV, AVI, FLV, OGV en entrée ⇄ les mêmes + GIF animé en sortie
  (moteur ffmpeg.wasm)
- Données : CSV ⇄ JSON ⇄ XLSX (SheetJS)

## Structure

- `main.js` / `preload.js` — process principal Electron (fenêtre, menu natif)
- `build/icon.png` — icône de l'application
- `build/license.txt`, `build/installer-*.bmp`, `build/dmg-background.png` — ressources de
  personnalisation des installateurs (voir plus haut)
- `public/convert.js` — conversion d'images (Canvas API + ImageTracer.js + heic2any + UTIF.js)
- `public/compress.js` — compression d'images/vidéos (même format en sortie)
- `public/data.js` — conversion de données (CSV/JSON/XLSX)
- `public/ffmpeg-engine.js` — chargement partagé du moteur ffmpeg.wasm
- `public/audio.js` / `public/video.js` — conversion audio/vidéo (ffmpeg.wasm)
- `public/app.js` — interface (mode, onglets par type, formats, glisser-déposer,
  progression, téléchargement)
- `public/vendor/` — librairies vendorisées (ImageTracer.js, SheetJS, heic2any, UTIF.js,
  ffmpeg.wasm)
