# converter

Convertisseur de formats de fichiers, en ligne de commande.
Une branche `web-converter` propose la même logique via une interface web (drag & drop),
déployée sur GitHub Pages.

## Formats supportés

- Images : SVG, PNG, JPG, WebP, TIFF, GIF, AVIF, ICO (sharp + potrace pour la vectorisation raster → SVG)
- Données : CSV ⇄ JSON ⇄ XLSX (SheetJS, build patché sans vulnérabilité connue)
- Audio : WAV, MP3, OGG, FLAC, AAC, M4A, WMA, Opus
- Vidéo : MP4, WebM, MOV, AVI, MKV, FLV, OGV

Audio et vidéo passent par le binaire `ffmpeg` statique fourni par `ffmpeg-static` (installé
automatiquement avec `npm install`, aucune install système requise).

Le type de fichier (image/données/audio/vidéo) est détecté automatiquement à partir de
l'extension.

## Installation

```bash
npm install
npm link   # rend la commande `converter` disponible globalement (optionnel)
```

## Utilisation

```bash
node bin/converter.js image.svg -t png
node bin/converter.js *.png -t webp -o ./out --quality 80
node bin/converter.js photo.jpg -t svg
node bin/converter.js data.csv -t xlsx
node bin/converter.js musique.wav -t mp3
node bin/converter.js clip.mov -t mp4
```

Options :

- `-t, --to <format>` (obligatoire) — format de sortie
- `-o, --out-dir <dir>` — dossier de sortie (par défaut : à côté du fichier source)
- `-q, --quality <number>` — qualité pour jpg/webp/avif
- `-d, --density <number>` — DPI utilisé pour rasteriser un SVG en entrée

## Structure

- `lib/convert.js` — conversion d'images (sharp + potrace)
- `lib/data.js` — conversion de données (SheetJS)
- `lib/media.js` — conversion audio/vidéo (ffmpeg-static)
- `bin/converter.js` — interface en ligne de commande (détection de type, routage)
