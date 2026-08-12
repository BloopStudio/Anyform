# Anyform — extension navigateur

Développée par **BloopStudio**. Extension Chrome/Edge (Manifest V3) qui reprend la logique
de l'app web : conversion d'images, de données (CSV/JSON/XLSX), d'audio et de vidéo, 100%
locale (rien n'est envoyé sur internet).

## Fonctionnalités

- **Popup** (icône de la barre d'outils) : même interface que l'app web (choisir le type,
  le format d'entrée, le format de sortie, déposer un fichier).
- **Menu contextuel** : clic droit sur une image dans une page → "Convertir cette image
  avec Anyform" → l'image s'ouvre dans un nouvel onglet avec le popup pré-rempli, il ne
  reste qu'à choisir le format de sortie.

## Formats supportés

Mêmes formats que l'app web : images (SVG/PNG/JPG/WebP/GIF/BMP/HEIC en entrée, +
AVIF/ICO/TIFF en sortie), données (CSV/JSON/XLSX), audio (WAV/MP3/OGG/M4A/FLAC/AAC/WMA/Opus)
et vidéo (MP4/WebM/MOV/MKV/AVI/FLV/OGV + GIF animé en sortie), via le moteur ffmpeg.wasm
vendorisé localement.

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
- `ffmpeg-engine.js` / `audio.js` / `video.js` — conversion audio/vidéo (ffmpeg.wasm,
  chargé via `chrome.runtime.getURL()` plutôt que des blob URLs, bloquées par la CSP)
- `vendor/` — librairies vendorisées (ImageTracer.js, SheetJS, heic2any, UTIF.js,
  ffmpeg.wasm)
