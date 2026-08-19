# Anyform

Convertisseur de formats de fichiers, en ligne de commande. Développé par **BloopStudio**.
Une branche `web-converter` propose la même logique via une interface web (drag & drop),
déployée sur GitHub Pages.

## Formats supportés

- Images : SVG, PNG, JPG, WebP, TIFF, GIF, AVIF, ICO, HEIC/HEIF en entrée (sharp +
  imagetracerjs pour la vectorisation raster → SVG, `heic-convert` pour le décodage
  HEIC/HEIF)
- Données : CSV ⇄ JSON ⇄ XLSX (SheetJS, build patché sans vulnérabilité connue)
- Audio : WAV, MP3, OGG, FLAC, AAC, M4A, WMA, Opus
- Vidéo : MP4, WebM, MOV, AVI, MKV, FLV, OGV
- Sous-titres : SRT ⇄ VTT ⇄ ASS (texte pur, aucune dépendance)

Audio et vidéo passent par le binaire `ffmpeg` statique fourni par `ffmpeg-static` (installé
automatiquement avec `npm install`, aucune install système requise).

Le type de fichier (image/données/audio/vidéo/sous-titres) est détecté automatiquement à
partir de l'extension.

`anyform info` reconnaît en plus des formats que le Convertisseur ne gère pas — PDF, ZIP et
polices (TTF/OTF/WOFF/WOFF2) — car les inspecter n'a besoin que de lire leurs métadonnées,
sans notion de format de sortie équivalent.

## Convertisseur et Compresseur

En plus de la conversion (`-t/--to`), le CLI propose une compression sans changement de
format (`-c/--compress`) pour réduire la taille des images, de l'audio, des vidéos et des
PDF :

- Images compressibles : PNG, JPG, WebP, GIF (via `sharp`), SVG (minification maison —
  commentaires, espaces, précision décimale, title/desc/metadata) — le HEIC/HEIF est décodé
  puis compressé en PNG, comme sur les autres plateformes
- Audio compressible : MP3, OGG, M4A, AAC, Opus, WMA (bitrate réduit), FLAC
  (`-compression_level`, sans perte), WAV (fréquence d'échantillonnage réduite, PCM brut)
- Vidéos compressibles : MP4, WebM, MOV, MKV, AVI, FLV, OGV (via `ffmpeg`, codec/conteneur
  d'origine conservé, audio non retouché)
- PDF : reconstruction objet par objet — ne touche qu'aux images JPEG (DCTDecode) intégrées,
  recompressées via `sharp` à la qualité du niveau choisi ; renvoyé tel quel s'il utilise des
  flux d'objets compressés (`/ObjStm`) ou des générations d'objet non nulles, plutôt que de
  risquer un fichier corrompu
- Trois niveaux : `light`, `medium` (par défaut), `strong`

Le fichier compressé est écrit à côté avec le suffixe `-compresse` (le format de sortie ne
change jamais, sauf HEIC/HEIF → PNG). Les sous-titres n'ont pas de notion de "compression
sans changer de format" — non proposé pour cette catégorie.

## Inspecteur et Comparateur

Deux sous-commandes séparées (pas des options de la commande principale, car leur forme ne
rentre pas dans le modèle "un ou plusieurs fichiers → un format cible") :

```bash
anyform info photo.jpg
anyform info musique.wav --json
anyform diff avant.png apres.png
anyform diff a.csv b.csv --out diff.txt
```

- **`info <file>`** : affiche les propriétés d'un fichier (dimensions, durée, débit estimé,
  nombre de lignes/colonnes, nombre de sous-titres...) sans le modifier. `--json` pour une
  sortie machine-readable plutôt que du texte aligné. La durée/résolution audio/vidéo vient
  de `ffmpeg -i` (parsing de la sortie standard, comme `ffprobe`), pas d'un ffprobe séparé —
  le codec vidéo des MP4/MOV (H.264, H.265/HEVC, VP9, AV1...) en est extrait de la même
  façon. S'y ajoutent : les tags ID3v2/ID3v1 des MP3 (titre, artiste, album, année, genre,
  présence de pochette), les polices TTF/OTF/WOFF/WOFF2 (famille, contours TrueType/CFF,
  nombre de glyphes — WOFF2 limité aux infos d'en-tête, la compression Brotli entière n'est
  pas décodée), le nombre de pages et les métadonnées des PDF, et la liste des fichiers /
  ratio de compression des ZIP.
- **`diff <fileA> <fileB>`** : compare deux fichiers du même type. Images → diff pixel par
  pixel (PNG écrit sur disque, zones qui changent en rouge — `--out <path>` pour choisir où,
  par défaut `<fileA>-diff.png`). Données/sous-titres → diff ligne à ligne façon `git diff`
  (algorithme LCS), affichée sur stdout ou écrite dans `--out` si fourni ; au-delà de 3000
  lignes, repli automatique sur une comparaison d'empreinte SHA-256 (le coût de la diff
  deviendrait trop élevé). Reste (audio/vidéo/xlsx) : empreinte SHA-256 uniquement.

## Installation

```bash
npm install
npm link   # rend la commande `anyform` disponible globalement (optionnel)
```

## Utilisation

```bash
node bin/anyform.js image.svg -t png
node bin/anyform.js *.png -t webp -o ./out --quality 80
node bin/anyform.js photo.jpg -t svg
node bin/anyform.js data.csv -t xlsx
node bin/anyform.js musique.wav -t mp3
node bin/anyform.js clip.mov -t mp4
node bin/anyform.js photo.jpg -c -l strong
node bin/anyform.js clip.mp4 --compress --level light -o ./out
```

Ou, après `npm link` :

```bash
anyform image.svg -t png
```

Options :

- `-t, --to <format>` — format de sortie (incompatible avec `-c`)
- `-c, --compress` — compresse le(s) fichier(s) sans changer de format (incompatible avec `-t`)
- `-l, --level <level>` — niveau de compression : `light`, `medium` (par défaut), `strong`
- `-o, --out-dir <dir>` — dossier de sortie (par défaut : à côté du fichier source)
- `-q, --quality <number>` — qualité pour jpg/webp/avif (conversion)
- `-d, --density <number>` — DPI utilisé pour rasteriser un SVG en entrée

Il faut préciser exactement l'une des deux options `-t` ou `-c`.

## Structure

- `lib/convert.js` — conversion et compression d'images (sharp + imagetracerjs), compression PDF
- `lib/data.js` — conversion de données (SheetJS)
- `lib/media.js` — conversion et compression audio/vidéo (ffmpeg-static)
- `lib/subtitles.js` — conversion de sous-titres SRT/VTT/ASS (texte pur)
- `lib/inspect.js` — lecture des propriétés d'un fichier, sans le modifier (images,
  audio/vidéo, données, sous-titres, PDF, ZIP, polices)
- `lib/compare.js` — diff entre deux fichiers (image, texte ligne à ligne, ou empreinte)
- `bin/anyform.js` — interface en ligne de commande (détection de type, routage,
  sous-commandes `info`/`diff`)
