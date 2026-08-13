# Anyform

Convertisseur de formats de fichiers, en ligne de commande. Développé par **BloopStudio**.
Une branche `web-converter` propose la même logique via une interface web (drag & drop),
déployée sur GitHub Pages.

## Formats supportés

- Images : SVG, PNG, JPG, WebP, TIFF, GIF, AVIF, ICO, HEIC/HEIF en entrée (sharp + potrace
  pour la vectorisation raster → SVG, `heic-convert` pour le décodage HEIC/HEIF)
- Données : CSV ⇄ JSON ⇄ XLSX (SheetJS, build patché sans vulnérabilité connue)
- Audio : WAV, MP3, OGG, FLAC, AAC, M4A, WMA, Opus
- Vidéo : MP4, WebM, MOV, AVI, MKV, FLV, OGV
- Sous-titres : SRT ⇄ VTT ⇄ ASS (texte pur, aucune dépendance)

Audio et vidéo passent par le binaire `ffmpeg` statique fourni par `ffmpeg-static` (installé
automatiquement avec `npm install`, aucune install système requise).

Le type de fichier (image/données/audio/vidéo/sous-titres) est détecté automatiquement à
partir de l'extension.

## Convertisseur et Compresseur

En plus de la conversion (`-t/--to`), le CLI propose une compression sans changement de
format (`-c/--compress`) pour réduire la taille des images, de l'audio et des vidéos :

- Images compressibles : PNG, JPG, WebP, GIF (via `sharp`) — le HEIC/HEIF est décodé puis
  compressé en PNG, comme sur les autres plateformes
- Audio compressible : MP3, OGG, M4A, AAC, Opus, WMA (bitrate réduit), FLAC
  (`-compression_level`, sans perte), WAV (fréquence d'échantillonnage réduite, PCM brut)
- Vidéos compressibles : MP4, WebM, MOV, MKV, AVI, FLV, OGV (via `ffmpeg`, codec/conteneur
  d'origine conservé, audio non retouché)
- Trois niveaux : `light`, `medium` (par défaut), `strong`

Le fichier compressé est écrit à côté avec le suffixe `-compresse` (le format de sortie ne
change jamais, sauf HEIC/HEIF → PNG). Les sous-titres n'ont pas de notion de "compression
sans changer de format" — non proposé pour cette catégorie.

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

- `lib/convert.js` — conversion d'images (sharp + potrace)
- `lib/data.js` — conversion de données (SheetJS)
- `lib/media.js` — conversion et compression audio/vidéo (ffmpeg-static)
- `lib/subtitles.js` — conversion de sous-titres SRT/VTT/ASS (texte pur)
- `bin/anyform.js` — interface en ligne de commande (détection de type, routage)
