# converter

Convertisseur de formats de fichiers, en ligne de commande.
Une branche `web-converter` propose la même logique via une interface web (drag & drop).

## Formats supportés (v1 — images)

- Entrée : SVG, PNG, JPG, WebP, TIFF, GIF, AVIF
- Sortie : PNG, JPG, WebP, TIFF, GIF, AVIF, SVG (vectorisation via `potrace` pour les images raster)

D'autres types de fichiers (documents, audio, vidéo...) pourront être ajoutés par la suite en
étendant `lib/convert.js`.

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
```

Options :

- `-t, --to <format>` (obligatoire) — format de sortie
- `-o, --out-dir <dir>` — dossier de sortie (par défaut : à côté du fichier source)
- `-q, --quality <number>` — qualité pour jpg/webp/avif
- `-d, --density <number>` — DPI utilisé pour rasteriser un SVG en entrée

## Structure

- `lib/convert.js` — logique de conversion (réutilisable, indépendante de la CLI)
- `bin/converter.js` — interface en ligne de commande
