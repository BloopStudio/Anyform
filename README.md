# Anyform

Convertisseur de formats de fichiers (images, données, audio, vidéo, sous-titres), 100%
local — bibliothèque Node.js. Développé par **BloopStudio**. Même code que
[`cli-converter`](https://github.com/TheDEMON78/Anyform/tree/cli-converter) (la ligne de
commande `anyform`), exposé ici comme package npm installable pour être appelé directement
depuis un autre programme Node, sans passer par un sous-processus.

D'autres façons d'utiliser Anyform :

| Branche | Description |
| --- | --- |
| [`web-converter`](https://github.com/TheDEMON78/Anyform/tree/web-converter) | App web, déployée sur [thedemon78.github.io/Anyform](https://thedemon78.github.io/Anyform/) |
| [`cli-converter`](https://github.com/TheDEMON78/Anyform/tree/cli-converter) | Outil en ligne de commande |
| [`browser-extension`](https://github.com/TheDEMON78/Anyform/tree/browser-extension) | Extension Chrome/Edge |
| [`desktop-app`](https://github.com/TheDEMON78/Anyform/tree/desktop-app) | Application de bureau Electron |

## Installation

```bash
npm install anyform
```

## Utilisation

```js
const anyform = require('anyform');
// ou : import anyform from 'anyform';

// Images — Buffer en entrée, Buffer en sortie (chaîne de caractères si la cible est SVG,
// issue de la vectorisation).
const fs = require('fs');
const input = fs.readFileSync('photo.png');
const webpBuffer = await anyform.convertImage(input, 'webp', { quality: 80 });
fs.writeFileSync('photo.webp', webpBuffer);

// Compression (même format, taille réduite) — retourne { buffer, ext } : ext peut différer
// de la source pour le HEIC/HEIF, décodé puis compressé en PNG.
const { buffer: compressedBuffer, ext } = await anyform.compressImage(input, 'png', 'strong');
fs.writeFileSync(`photo-compresse.${ext}`, compressedBuffer);

// Données — Buffer en entrée, Buffer en sortie.
const csv = fs.readFileSync('data.csv');
const xlsx = anyform.convertData(csv, 'csv', 'xlsx');
fs.writeFileSync('data.xlsx', xlsx);

// Audio/vidéo — chemins de fichiers (ffmpeg lit/écrit sur disque directement).
await anyform.convertMedia('musique.wav', 'musique.mp3');
await anyform.compressVideo('clip.mp4', 'clip-compresse.mp4', 'mp4', 'medium');

// Sous-titres — texte en entrée, texte en sortie.
const srt = fs.readFileSync('sous-titres.srt', 'utf8');
const vtt = anyform.convertSubtitle(srt, 'srt', 'vtt');

// Inspection et comparaison — chemins de fichiers, aucune modification du fichier source.
const infos = await anyform.inspectFile('photo.jpg', 'image', 'jpg');
const diff = await anyform.compareFiles('avant.png', 'apres.png', 'image');
```

Toutes les fonctions sont asynchrones sauf `convertData`, `convertSubtitle`, `parseSubtitle`,
`normalizeFormat`, `isSvgBuffer` et `isHeicBuffer` (traitement synchrone, sans I/O bloquante
notable). Voir `index.js` pour la liste complète des exports et leurs domaines.

## Formats supportés

- Images : SVG, PNG, JPG, WebP, TIFF, GIF, AVIF, ICO, HEIC/HEIF en entrée ⇄
  PNG/JPG/WebP/AVIF/TIFF/SVG en sortie (sharp + potrace pour la vectorisation raster → SVG,
  `heic-convert` pour le décodage HEIC/HEIF)
- Données : CSV ⇄ JSON ⇄ XLSX (SheetJS, build patché sans vulnérabilité connue)
- Audio : WAV, MP3, OGG, FLAC, AAC, M4A, WMA, Opus
- Vidéo : MP4, WebM, MOV, AVI, MKV, FLV, OGV
- Sous-titres : SRT ⇄ VTT ⇄ ASS (texte pur, aucune dépendance)

Audio et vidéo passent par le binaire `ffmpeg` statique fourni par `ffmpeg-static` (installé
automatiquement avec le package, aucune install système requise).

## Langue des messages

Les messages d'erreur générés par la bibliothèque (`err.message`) suivent la même détection
que le CLI : `$LC_ALL`/`$LANG`/`$LANGUAGE` de l'environnement, anglais si l'un commence par
`en`, français sinon. Pour forcer une langue, définir la variable d'environnement avant
d'importer le module :

```js
process.env.LANG = 'en_US.UTF-8';
const anyform = require('anyform');
```

`anyform.t(key, vars)` et `anyform.getLanguage()` sont aussi exposés directement, au cas où
l'appelant veut afficher ses propres messages dans la même langue.

## Structure

- `index.js` — point d'entrée public, ré-exporte les fonctions de `lib/`
- `lib/convert.js` — conversion/compression d'images (sharp + potrace)
- `lib/data.js` — conversion de données (SheetJS)
- `lib/media.js` — conversion et compression audio/vidéo (ffmpeg-static)
- `lib/subtitles.js` — conversion de sous-titres SRT/VTT/ASS (texte pur)
- `lib/inspect.js` — lecture des propriétés d'un fichier, sans le modifier
- `lib/compare.js` — diff entre deux fichiers (image, texte ligne à ligne, ou empreinte)
- `lib/i18n.js` — traduction FR/EN des messages d'erreur
