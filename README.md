# converter

Convertisseur de formats de fichiers, avec une interface web (drag & drop).
Une branche `cli-converter` propose la même logique en ligne de commande.

## App web — 100% dans le navigateur

Aucune installation nécessaire : pas de Node, pas de serveur, pas de dépendances à
installer côté utilisateur. Toute la conversion (rasterisation d'un SVG, export
PNG/JPG/WebP, vectorisation raster → SVG) se fait en JavaScript directement dans le
navigateur, via `<canvas>` et [ImageTracer.js](https://github.com/jankovicsandras/imagetracerjs)
(vendorisé dans `public/vendor/`, aucun appel réseau externe).

Il suffit d'ouvrir `public/index.html`, ou de visiter la page déployée sur GitHub Pages,
de déposer un fichier, choisir le format cible, et cliquer sur "Convertir".

### Formats supportés (v1 — images)

- Entrée : SVG, PNG, JPG, WebP, GIF, BMP (tout ce que le navigateur sait décoder)
- Sortie : PNG, JPG, WebP, SVG (vectorisation pour les images raster)

D'autres formats de sortie (TIFF, AVIF, PDF...) et d'autres types de fichiers (documents,
audio, vidéo...) pourront être ajoutés par la suite.

## Déploiement sur GitHub Pages

Un workflow (`.github/workflows/deploy-pages.yml`) déploie automatiquement le contenu de
`public/` à chaque push sur `main`. Étape unique à faire une fois côté dépôt : dans
**Settings → Pages**, choisir la source **"GitHub Actions"**. Ensuite le site est mis à
jour automatiquement, et n'importe quel utilisateur peut l'utiliser juste avec un
navigateur, sans rien installer.

## Développement local

Pas de build nécessaire. Pour tester en local, servir simplement le dossier `public/` :

```bash
npx serve public
```

## Structure

- `public/convert.js` — logique de conversion (Canvas API + ImageTracer.js)
- `public/app.js` — interface (drag & drop, téléchargement du résultat)
- `public/vendor/imagetracer.js` — lib de vectorisation raster → SVG (domaine public)
