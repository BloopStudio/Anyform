# converter

Convertisseur de formats de fichiers, avec une interface web (drag & drop) déployée sur
GitHub Pages. Trois autres branches proposent la même logique sous d'autres formes :
[`cli-converter`](https://github.com/TheDEMON78/converter/pull/2) (ligne de commande),
[`browser-extension`](https://github.com/TheDEMON78/converter/tree/browser-extension)
(extension Chrome/Edge) et cette branche `desktop-app` (application de bureau Electron).

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

### Builds automatiques (GitHub Actions)

Le workflow `.github/workflows/build-desktop.yml` construit automatiquement les trois
installateurs (Windows `.exe`, macOS `.dmg`, Linux `.AppImage`) à chaque push sur
`desktop-app`, ou manuellement via l'onglet **Actions → Construire l'app de bureau → Run
workflow**. Les fichiers générés sont disponibles en téléchargement dans les **Artifacts**
du run (30 jours de rétention). Les builds ne sont pas signés (pas de certificat) : Windows
SmartScreen et macOS Gatekeeper afficheront un avertissement au premier lancement.

## App web — 100% dans le navigateur

Aucune installation nécessaire : pas de Node, pas de serveur, pas de dépendances à
installer côté utilisateur. Toute la conversion se fait en JavaScript directement dans le
navigateur, tout est vendorisé localement dans `public/vendor/` — aucun appel réseau
externe, même pour la vidéo/l'audio (ffmpeg.wasm) ou le décodage HEIC.

Il suffit d'ouvrir `public/index.html`, ou de visiter la page déployée sur GitHub Pages,
de déposer un fichier, choisir le format cible, et cliquer sur "Convertir".

### Formats supportés

- Images : SVG, PNG, JPG, WebP, GIF, BMP, HEIC en entrée ⇄ PNG/JPG/WebP/AVIF/ICO/TIFF/SVG en
  sortie (vectorisation raster → SVG incluse via ImageTracer.js, décodage HEIC via
  `heic2any`/libheif WASM)
- Audio : WAV, MP3, OGG, M4A, FLAC, AAC, WMA, Opus (moteur ffmpeg.wasm)
- Vidéo : MP4, WebM, MOV, MKV, AVI, FLV, OGV en entrée ⇄ les mêmes + GIF animé en sortie
  (moteur ffmpeg.wasm)
- Données : CSV ⇄ JSON ⇄ XLSX (SheetJS)

D'autres formats (documents, archives...) pourront être ajoutés par la suite.

## Déploiement sur GitHub Pages

Un workflow (`.github/workflows/deploy-pages.yml`) déploie automatiquement le contenu de
`public/` à chaque push sur `main`, et applique un cache-busting (`?v=<sha>`) sur les
scripts/styles pour que les navigateurs ne servent jamais une version périmée. Étape
unique à faire une fois côté dépôt : dans **Settings → Pages**, choisir la source
**"GitHub Actions"**.

## Développement local

Pas de build nécessaire. Pour tester en local, servir simplement le dossier `public/` :

```bash
npx serve public
```

## Structure

- `main.js` / `preload.js` — process principal Electron (fenêtre, menu natif)
- `build/icon.png` — icône de l'application
- `public/convert.js` — conversion d'images (Canvas API + ImageTracer.js + heic2any + UTIF.js)
- `public/data.js` — conversion de données (CSV/JSON/XLSX)
- `public/ffmpeg-engine.js` — chargement partagé du moteur ffmpeg.wasm
- `public/audio.js` / `public/video.js` — conversion audio/vidéo (ffmpeg.wasm)
- `public/app.js` — interface (choix du type/format, drag & drop, téléchargement)
- `public/vendor/` — librairies vendorisées (ImageTracer.js, SheetJS, heic2any, UTIF.js,
  ffmpeg.wasm)
