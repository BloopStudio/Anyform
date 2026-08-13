# Anyform — extension navigateur

Développée par **BloopStudio**. Extension Chrome/Edge (Manifest V3) qui reprend la logique
de l'app web : conversion d'images, de données (CSV/JSON/XLSX), d'audio et de vidéo, 100%
locale (rien n'est envoyé sur internet).

## Fonctionnalités

- **Popup** (icône de la barre d'outils) : même interface que l'app web — deux modes,
  **Convertisseur** et **Compresseur**, sélectionnables via un onglet en haut.
- **Menu contextuel** : clic droit sur une image dans une page → "Convertir cette image
  avec Anyform" → l'image s'ouvre dans un nouvel onglet avec le popup pré-rempli, il ne
  reste qu'à choisir le format de sortie.
- Thème clair/sombre automatique selon les préférences de l'appareil.
- Historique local des 5 derniers fichiers (nom, taille, bouton "Télécharger"), stocké dans
  IndexedDB — voir `history.js`.

## Formats supportés

**Convertisseur** — mêmes formats que l'app web : images (SVG/PNG/JPG/WebP/GIF/BMP/HEIC en
entrée, + AVIF/ICO/TIFF en sortie), données (CSV/JSON/XLSX), audio
(WAV/MP3/OGG/M4A/FLAC/AAC/WMA/Opus), vidéo (MP4/WebM/MOV/MKV/AVI/FLV/OGV + GIF animé en
sortie) via le moteur ffmpeg.wasm vendorisé localement, et sous-titres (SRT/VTT/ASS, texte
pur — voir `subtitles.js`).

**Compresseur** — réduit la taille d'un fichier sans changer son format, limité aux images
(PNG/JPG/WebP/HEIC), à l'audio et aux vidéos (voir `compress.js` : qualité réduite pour
JPG/WebP, redimensionnement pour PNG ; bitrate réduit pour l'audio compressé,
`-compression_level` pour FLAC, fréquence d'échantillonnage réduite pour WAV ; CRF réduit
pour la vidéo sur le même codec/conteneur).

**Pas de notification native** (contrairement au web/à l'app de bureau) : le popup se ferme
dès qu'on clique ailleurs, donc `document.hidden` ne devient jamais vrai pendant qu'une
conversion audio/vidéo tourne encore — la condition qui déclenche la notification ne peut
jamais se produire ici.

**Note CSP (Manifest V3)** : les Workers d'une extension n'héritent pas automatiquement de
la permission `wasm-unsafe-eval` de la page qui les crée — nécessaire pour que
WebAssembly.instantiate() fonctionne dans le Worker utilisé par ffmpeg.wasm. `manifest.json`
déclare donc explicitement `content_security_policy.extension_pages` avec
`wasm-unsafe-eval`. Sans cette déclaration, l'audio et la vidéo échouent silencieusement.

## Installation (développement)

1. `chrome://extensions` (ou `edge://extensions`)
2. Activer le "Mode développeur"
3. "Charger l'extension non empaquetée" → sélectionner le dossier `extension/`

## Permissions

- `contextMenus` : pour l'entrée de menu clic droit sur une image
- `storage` : pour transmettre l'image sélectionnée du menu contextuel vers le popup
- `downloads` : pour proposer le téléchargement du fichier converti
- `host_permissions: <all_urls>` : nécessaire pour pouvoir récupérer (fetch) l'image
  cliquée depuis n'importe quel site via le menu contextuel

## Structure

- `manifest.json` — déclaration de l'extension (MV3), CSP explicite pour `wasm-unsafe-eval`
- `background.js` — service worker : menu contextuel, récupération de l'image cliquée
- `popup.html` / `popup.js` / `popup.css` — interface de conversion
- `convert.js` / `data.js` — conversion image/données (identique à l'app web)
- `compress.js` — compression d'images/audio/vidéos (même format en sortie)
- `subtitles.js` — conversion de sous-titres SRT/VTT/ASS (texte pur)
- `history.js` — historique local des 5 derniers fichiers (IndexedDB)
- `ffmpeg-engine.js` / `audio.js` / `video.js` — conversion audio/vidéo (ffmpeg.wasm,
  chargé via `chrome.runtime.getURL()` plutôt que des blob URLs, bloquées par la CSP)
- `vendor/` — librairies vendorisées (ImageTracer.js, SheetJS, heic2any, UTIF.js,
  ffmpeg.wasm)
