# converter

Convertisseur de formats de fichiers, avec une interface web (drag & drop) déployée sur
GitHub Pages. Une branche [`cli-converter`](https://github.com/TheDEMON78/converter/pull/2)
propose la même logique en ligne de commande.

## App web — 100% dans le navigateur

Aucune installation nécessaire : pas de Node, pas de serveur, pas de dépendances à
installer côté utilisateur. Toute la conversion se fait en JavaScript directement dans le
navigateur (Canvas API, [ImageTracer.js](https://github.com/jankovicsandras/imagetracerjs)
vendorisé dans `public/vendor/`, aucun appel réseau externe pour les images).

Il suffit d'ouvrir `public/index.html`, ou de visiter la page déployée sur GitHub Pages,
de déposer un fichier, choisir le format cible, et cliquer sur "Convertir".

### Formats supportés

- Images : SVG, PNG, JPG, WebP, GIF, BMP, HEIC en entrée ⇄ PNG/JPG/WebP/AVIF/ICO/TIFF/SVG en
  sortie (vectorisation raster → SVG incluse, décodage HEIC via `heic2any`/libheif WASM
  embarqué, hors-ligne)
- Vidéo : MP4 ⇄ WebM (moteur ffmpeg.wasm chargé à la demande depuis un CDN)
- Données : CSV ⇄ JSON ⇄ XLSX
- Audio : WAV ⇄ MP3

D'autres formats (documents, archives...) pourront être ajoutés par la suite.

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

- `public/convert.js` — conversion d'images (Canvas API + ImageTracer.js)
- `public/data.js` — conversion de données (CSV/JSON/XLSX)
- `public/audio.js` — conversion audio (WAV/MP3)
- `public/app.js` — interface (drag & drop, téléchargement du résultat)
- `public/vendor/` — librairies vendorisées (ImageTracer.js, SheetJS, lamejs, heic2any, UTIF.js)
