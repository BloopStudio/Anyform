# converter

Convertisseur de formats de fichiers, avec une interface web (drag & drop).
Une branche `cli-converter` propose la même logique en ligne de commande.

## Formats supportés (v1 — images)

- Entrée : SVG, PNG, JPG, WebP, TIFF, GIF, AVIF
- Sortie : PNG, JPG, WebP, TIFF, GIF, AVIF, SVG (vectorisation via `potrace` pour les images raster)

D'autres types de fichiers (documents, audio, vidéo...) pourront être ajoutés par la suite en
étendant `lib/convert.js`.

## Démarrer l'app web

```bash
npm install
npm start
```

Puis ouvrir http://localhost:3000, déposer un fichier, choisir le format cible et cliquer sur
"Convertir".

## Structure

- `lib/convert.js` — logique de conversion (réutilisable, indépendante du serveur)
- `server.js` — serveur Express + endpoint `/api/convert`
- `public/` — interface web (HTML/CSS/JS vanilla)
