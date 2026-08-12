# converter

Convertisseur de formats de fichiers — commencé par les images (SVG ⇄ PNG/JPG/WebP), avec
d'autres formats et types de fichiers prévus par la suite (documents, données, audio, vidéo...).

Le projet se développe sur deux branches, chacune avec sa propre pull request :

- [`web-converter`](https://github.com/TheDEMON78/converter/pull/1) — app web 100% statique
  (drag & drop), tout tourne dans le navigateur, rien à installer, déployable gratuitement sur
  GitHub Pages.
- [`cli-converter`](https://github.com/TheDEMON78/converter/pull/2) — outil en ligne de commande
  (Node.js), pratique pour scripter des conversions en masse.

Les deux partagent la même approche : SVG/PNG/JPG/WebP en entrée, export raster ou vectorisation
(raster → SVG).

## Prochaines pistes

- ICO, HEIC, AVIF, TIFF en plus des formats déjà supportés
- Documents : PDF ⇄ images, Markdown ⇄ HTML/PDF
- Données : CSV ⇄ JSON ⇄ XLSX
- Audio/vidéo : WAV ⇄ MP3, MP4 ⇄ WebM
