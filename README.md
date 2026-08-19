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
(`public/`), sans rien changer — juste une fenêtre native au lieu du navigateur. La fenêtre
s'ouvre à 960×800 par défaut, reste redimensionnable (min. 420×600) et la carte s'adapte en
continu à sa largeur (`clamp()` CSS, jusqu'à 880px), sans dépendre d'un plein écran.

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
**Latest**. À la fin de chaque build, toute release dont le patch est inférieur à
**(version publiée − 10)** est supprimée automatiquement (ex. en publiant 1.0.50, tout ce
qui est sous 1.0.40 disparaît) — ça revient à toujours garder les 10 dernières, sans dépendre
d'un décompte fixe. Les fichiers sont aussi disponibles 30 jours dans les **Artifacts** du
run pour du débogage rapide.

### Builds non signés : à quoi s'attendre

Pas de certificat de signature (payant) sur ces builds — deux conséquences différentes selon
l'OS :

- **Windows** : SmartScreen affiche "Windows a protégé votre ordinateur" au premier
  lancement. Cliquer **Informations complémentaires → Exécuter quand même** suffit.
- **macOS** : le message est plus trompeur. Comme l'app n'est ni signée ni notariée, macOS
  affiche **"« Anyform » est endommagé et ne peut pas être ouvert"** — l'app n'est pas
  vraiment corrompue, c'est juste le message que montrent les versions récentes de macOS
  pour tout logiciel non signé téléchargé depuis internet (au lieu du classique
  "développeur non identifié" avec un bouton "Ouvrir quand même"). Il faut retirer
  manuellement l'attribut de quarantaine dans le Terminal :

  ```bash
  xattr -cr /Applications/Anyform.app
  ```

  (adapter le chemin si l'app est ailleurs). Pas besoin de `sudo` pour sa propre installation.

## Mise à jour automatique

L'app vérifie au démarrage (uniquement sur un build packagé, jamais en `npm start`) si une
nouvelle release GitHub est disponible, via `electron-updater` (`main.js`). Si oui, elle la
télécharge en arrière-plan puis propose de redémarrer pour l'installer — rien d'automatique
sans confirmation de l'utilisateur. Ça s'appuie sur les fichiers `latest.yml` /
`latest-mac.yml` / `latest-linux.yml` générés par electron-builder à chaque build (config
`build.publish` dans `package.json`) et attachés à chaque release à côté des
installateurs.

## Quatre modes

Un onglet en haut de l'interface bascule entre eux :

- **Convertisseur** : change le format d'un fichier (formats ci-dessous).
- **Compresseur** : réduit la taille d'un fichier **sans changer son format**. Images
  (qualité réduite pour JPG/WebP, redimensionnement pour PNG, minification maison pour SVG),
  audio (bitrate réduit, `-compression_level` pour FLAC sans perte, fréquence
  d'échantillonnage réduite pour WAV), vidéos (CRF réduit sur le même codec/conteneur, audio
  inchangé) et PDF (recompression des images JPEG intégrées, reconstruction objet par
  objet — renvoie le fichier tel quel plutôt que de risquer une corruption sur les PDF avec
  flux d'objets compressés ou générations d'objet non nulles), avec un niveau
  Léger/Moyen/Fort. Voir `public/compress.js`.
- **Inspecteur** : lit les propriétés d'un fichier (dimensions, durée, lignes/colonnes,
  nombre de sous-titres...) sans le modifier. Catégorie déduite de l'extension déposée, pas
  d'onglet Type de fichier à pré-choisir — y compris PDF (pages, métadonnées), ZIP (liste des
  fichiers, ratio, type détecté), polices TTF/OTF/WOFF/WOFF2 (famille, contours, nombre de
  glyphes), tags ID3 des MP3 (titre, artiste, album, année, genre, pochette) et codec vidéo
  des MP4/MOV (H.264, H.265/HEVC, VP9, AV1...). Voir `public/inspect.js`.
- **Comparateur** : seul mode à deux entrées (fichier A / fichier B). Images → diff pixel
  par pixel téléchargeable. Données/sous-titres → diff ligne à ligne (LCS), repli sur
  empreinte SHA-256 au-delà de 3000 lignes. Reste (audio/vidéo/xlsx) → empreinte SHA-256
  uniquement. Voir `public/compare.js`.

Le thème (clair/sombre) suit automatiquement les préférences de l'appareil. Les 5 derniers
fichiers convertis/compressés restent accessibles (re-téléchargeables) dans un historique
local sous le résultat (`public/history.js`, IndexedDB). Si la fenêtre est en arrière-plan
à la fin d'une conversion audio/vidéo, une notification native prévient.

En Convertisseur/Compresseur, déposer plusieurs fichiers à la fois affiche une liste de
résultats — téléchargement individuel par fichier, plus un bouton "Tout (.zip)" pour tout
récupérer d'un coup (aucun téléchargement automatique groupé). Les échecs individuels
restent visibles avec leur erreur, n'interrompent pas le reste du lot. Voir
`public/zip.js`.

## Formats supportés (Convertisseur)

- Images : SVG, PNG, JPG, WebP, GIF, BMP, HEIC en entrée ⇄ PNG/JPG/WebP/AVIF/ICO/TIFF/SVG en
  sortie (vectorisation raster → SVG incluse via ImageTracer.js, décodage HEIC via
  `heic2any`/libheif WASM)
- Audio : WAV, MP3, OGG, M4A, FLAC, AAC, WMA, Opus (moteur ffmpeg.wasm)
- Vidéo : MP4, WebM, MOV, MKV, AVI, FLV, OGV en entrée ⇄ les mêmes + GIF animé en sortie
  (moteur ffmpeg.wasm)
- Données : CSV ⇄ JSON ⇄ XLSX (SheetJS)
- Sous-titres : SRT ⇄ VTT ⇄ ASS (texte pur, aucune dépendance ; le style ASS — police,
  couleur, position — n'est pas préservé, non représentable en SRT/VTT)

## Structure

- `main.js` / `preload.js` — process principal Electron (fenêtre, menu natif, mise à jour
  automatique via `electron-updater`)
- `build/icon.png` — icône de l'application
- `build/license.txt`, `build/installer-*.bmp`, `build/dmg-background.png` — ressources de
  personnalisation des installateurs (voir plus haut)
- `public/convert.js` — conversion d'images (Canvas API + ImageTracer.js + heic2any + UTIF.js)
- `public/compress.js` — compression d'images (dont SVG)/audio/vidéos/PDF (même format en
  sortie)
- `public/data.js` — conversion de données (CSV/JSON/XLSX)
- `public/subtitles.js` — conversion de sous-titres SRT/VTT/ASS (texte pur)
- `public/history.js` — historique local des 5 derniers fichiers (IndexedDB)
- `public/inspect.js` — lecture des propriétés d'un fichier, sans le modifier (images,
  audio/vidéo, données, sous-titres, PDF, ZIP, polices)
- `public/compare.js` — diff entre deux fichiers (image, texte ligne à ligne, ou empreinte)
- `public/zip.js` — génération d'archives ZIP pour le traitement par lot
- `public/ffmpeg-engine.js` — chargement partagé du moteur ffmpeg.wasm
- `public/audio.js` / `public/video.js` — conversion audio/vidéo (ffmpeg.wasm)
- `public/app.js` — interface (mode, onglets par type, formats, glisser-déposer,
  progression, téléchargement, notifications, historique)
- `public/vendor/` — librairies vendorisées (ImageTracer.js, SheetJS, heic2any, UTIF.js,
  ffmpeg.wasm)
