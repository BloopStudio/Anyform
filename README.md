# Anyform

![Incrémenter la version](https://github.com/BloopStudio/Anyform/actions/workflows/bump-version.yml/badge.svg)
![Déployer sur GitHub Pages](https://github.com/BloopStudio/Anyform/actions/workflows/deploy-pages.yml/badge.svg)

Développé par **BloopStudio**. Convertisseur de formats de fichiers (images, données,
audio, vidéo), 100% côté client, avec une interface web (drag & drop) déployée sur GitHub
Pages. Trois autres branches proposent la même logique sous d'autres formes :
[`cli-converter`](https://github.com/BloopStudio/Anyform/tree/cli-converter) (ligne de
commande), [`browser-extension`](https://github.com/BloopStudio/Anyform/tree/browser-extension)
(extension Chrome/Edge) et
[`desktop-app`](https://github.com/BloopStudio/Anyform/tree/desktop-app) (application de
bureau Electron).

**En ligne : [bloopstudio.github.io/Anyform](https://bloopstudio.github.io/Anyform/)**

## App web — 100% dans le navigateur

Aucune installation nécessaire : pas de Node, pas de serveur, pas de dépendances à
installer côté utilisateur. Toute la conversion se fait en JavaScript directement dans le
navigateur, tout est vendorisé localement dans `public/vendor/` — aucun appel réseau
externe, même pour la vidéo/l'audio (ffmpeg.wasm) ou le décodage HEIC.

Il suffit d'ouvrir `public/index.html`, ou de visiter la page déployée sur GitHub Pages, de
choisir le mode (**Convertisseur**, **Compresseur**, **Inspecteur** ou **Comparateur**), le
type de fichier (onglets Image/Données/Audio/Vidéo/Sous-titres/Document, quand le mode en a
besoin),
déposer un ou plusieurs fichiers, choisir le format cible, et cliquer sur "Convertir". Une
barre de progression suit les conversions audio/vidéo (moteur ffmpeg.wasm), et le résultat
s'affiche dans une carte dédiée avec téléchargement et bouton pour recommencer. Le thème
(clair/sombre) suit automatiquement les préférences de l'appareil et de la taille de la
fenêtre. Si l'onglet n'est plus visible à la fin d'une conversion audio/vidéo, une
notification native prévient (permission demandée au premier clic sur "Convertir").

### Traitement par lot

En Convertisseur/Compresseur, déposer plusieurs fichiers à la fois affiche une liste de
résultats — chacun avec son propre bouton "Télécharger" (aucun téléchargement automatique
groupé, qui déclencherait l'anti-popup du navigateur), plus un bouton "Tout (.zip)" pour
tout récupérer en une seule archive. Les échecs individuels (mauvais format, fichier
corrompu...) restent dans la liste avec leur erreur plutôt que d'interrompre le lot. Le ZIP
est généré en pur JavaScript (méthode "stored", pas de compression — inutile, les fichiers
produits par Anyform sont déjà dans leur format final) — voir `public/zip.js`. Un seul
fichier déposé garde le comportement d'origine (téléchargement automatique + carte
résultat).

### Quatre modes

- **Convertisseur** : change le format d'un fichier (formats ci-dessous).
- **Compresseur** : réduit la taille d'un fichier **sans changer son format** — images (PNG,
  JPG, WebP, HEIC, SVG — GIF/BMP exclus, Canvas ne sait pas les ré-encoder dans le
  navigateur), audio, vidéos et PDF, avec un niveau Léger/Moyen/Fort. Images raster : qualité
  réduite pour JPG/WebP, redimensionnement pour PNG (pas de curseur de qualité). SVG :
  minification maison (commentaires, espaces, précision décimale des nombres, title/desc/
  metadata, groupes vides supprimés selon le niveau) — pas un équivalent complet à SVGO.
  Audio : bitrate réduit pour les formats compressés, `-compression_level` pour FLAC (sans
  perte), fréquence d'échantillonnage réduite pour WAV (PCM brut, pas de notion de bitrate).
  Vidéo : CRF réduit sur le même codec/conteneur, audio inchangé. PDF : reconstruction
  objet par objet, ne touche qu'aux images JPEG (DCTDecode) intégrées, recompressées à la
  qualité du niveau choisi ; se contente de renvoyer le fichier tel quel s'il utilise des
  flux d'objets compressés (`/ObjStm`, PDF récents) ou des générations d'objet non nulles,
  plutôt que de risquer un fichier corrompu. Voir `public/compress.js`.
- **Inspecteur** : lit les propriétés d'un fichier (dimensions, durée, nombre de
  lignes/colonnes, nombre de sous-titres...) sans le modifier ni produire de fichier de
  sortie. Volontairement léger : la durée/résolution audio/vidéo vient des métadonnées
  natives du navigateur (`<audio>`/`<video>`), pas d'un décodage complet via ffmpeg.wasm.
  Pas d'onglet Type de fichier : la catégorie est déduite de l'extension du fichier déposé —
  y compris pour des formats que le Convertisseur ne gère pas : PDF (nombre de pages,
  métadonnées du document), ZIP (liste des fichiers, ratio de compression, type détecté —
  docx/xlsx/pptx, JAR, EPUB), polices TTF/OTF/WOFF/WOFF2 (famille, contours TrueType/CFF,
  nombre de glyphes — WOFF2 limité aux infos d'en-tête, la compression Brotli entière n'est
  pas décodée). Images : métadonnées EXIF (appareil, date, GPS...) quand présentes. Audio
  MP3 : tags ID3v2/ID3v1 (titre, artiste, album, année, genre, présence de pochette). Vidéo
  MP4/MOV : codec (H.264, H.265/HEVC, VP9, AV1...), lu directement dans les box ISO-BMFF.
  Voir `public/inspect.js`.
- **Comparateur** : seul mode à deux entrées (fichier A / fichier B). Images : diff pixel
  par pixel rendue dans une image téléchargeable (zones qui changent en rouge, reste en
  gris atténué), sur la zone commune si les dimensions diffèrent. Données/sous-titres :
  diff ligne à ligne façon `git diff` (algorithme LCS), avec repli sur une simple
  comparaison d'empreinte SHA-256 au-delà de 3000 lignes (le coût O(n×m) de la diff
  deviendrait trop lourd pour un onglet de navigateur). Tout le reste (audio, vidéo, XLSX) :
  comparaison par empreinte SHA-256 uniquement, pas de diff détaillée. Voir
  `public/compare.js`.

### Formats supportés (Convertisseur)

- Images : SVG, PNG, JPG, WebP, GIF, BMP, HEIC en entrée ⇄ PNG/JPG/WebP/AVIF/ICO/TIFF/SVG en
  sortie (vectorisation raster → SVG incluse via ImageTracer.js, décodage HEIC via
  `heic2any`/libheif WASM)
- Audio : WAV, MP3, OGG, M4A, FLAC, AAC, WMA, Opus (moteur ffmpeg.wasm)
- Vidéo : MP4, WebM, MOV, MKV, AVI, FLV, OGV en entrée ⇄ les mêmes + GIF animé en sortie
  (moteur ffmpeg.wasm)
- Données : CSV ⇄ JSON ⇄ XLSX (SheetJS)
- Sous-titres : SRT ⇄ VTT ⇄ ASS (texte pur, aucune dépendance) — l'ASS ne préserve que le
  texte et le minutage, pas le style (police, couleur, position) : non représentable en
  SRT/VTT, perdu dans les deux sens.

PDF, ZIP et polices (TTF/OTF/WOFF/WOFF2) sont pris en charge par l'Inspecteur (et le PDF
aussi par le Compresseur), mais pas par le Convertisseur — aucun de ces formats n'a de
format de sortie équivalent qui aurait du sens ici.

### Historique local

Les 5 derniers fichiers convertis/compressés restent accessibles (nom, taille, bouton
"Télécharger") dans un encart sous le résultat — stockés dans IndexedDB, jamais envoyés
nulle part, effaçables via "Vider". Voir `public/history.js`.

## Confidentialité

Aucune donnée n'est envoyée à un serveur, aucune collecte. Détails :
[politique de confidentialité](https://bloopstudio.github.io/Anyform/privacy.html).

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
- `public/privacy.html` — politique de confidentialité
- `public/vendor/` — librairies vendorisées (ImageTracer.js, SheetJS, heic2any, UTIF.js,
  ffmpeg.wasm)
