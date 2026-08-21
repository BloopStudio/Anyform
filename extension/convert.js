/**
 * Logique de conversion d'images, 100% côté navigateur (Canvas API + ImageTracer.js +
 * heic2any pour HEIC + UTIF.js pour TIFF).
 * Aucune dépendance serveur : tout se passe en JS dans la page.
 */

const RASTER_MIME = {
  png: 'image/png',
  jpg: 'image/jpeg',
  webp: 'image/webp',
  avif: 'image/avif',
};

/**
 * Détecte un fichier SVG via son type MIME ou, à défaut (fichiers locaux souvent sans type
 * MIME fiable), son extension.
 */
function isSvgFile(file) {
  return file.type === 'image/svg+xml' || /\.svg$/i.test(file.name);
}

/**
 * Détecte un fichier HEIC/HEIF via son extension ou son type MIME — nécessaire pour savoir
 * s'il faut passer par heic2any avant tout traitement, Canvas ne sachant pas décoder ce
 * format nativement.
 */
function isHeicFile(file) {
  return /\.hei[cf]$/i.test(file.name) || file.type === 'image/heic' || file.type === 'image/heif';
}

/**
 * Détecte un fichier TIFF via son extension ou son type MIME — nécessaire pour savoir s'il
 * faut le décoder via UTIF.js plutôt qu'un `<img>` classique, aucun navigateur ne sachant
 * afficher du TIFF nativement (contrairement à HEIC, où seul le décodage manque : ici c'est
 * l'affichage lui-même qui est absent).
 */
function isTiffFile(file) {
  return /\.tiff?$/i.test(file.name) || file.type === 'image/tiff';
}

/**
 * Lit un fichier comme texte brut (utilisé pour le SVG, format texte).
 */
function readFileAsText(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error);
    reader.readAsText(file);
  });
}

/**
 * Charge une URL (data URL ou URL objet) dans un élément `<img>` et attend qu'elle soit
 * décodée, prête à être dessinée sur un canvas.
 */
function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(t('error.imageLoad')));
    img.src = src;
  });
}

/**
 * Charge un fichier/Blob dans un élément `<img>` décodé, via une URL objet plutôt qu'une
 * data URL base64 (FileReader.readAsDataURL) : évite l'encodage/décodage base64 et son
 * surcoût mémoire (~33% de plus que les octets bruts) — un vrai gain sur les grosses images.
 * L'URL objet est révoquée dès que l'image est chargée (ou en échec).
 */
async function loadImageFromBlob(blob) {
  const url = URL.createObjectURL(blob);
  try {
    return await loadImage(url);
  } finally {
    URL.revokeObjectURL(url);
  }
}

/**
 * Encode un Blob PNG dans un conteneur .ico minimal (une seule taille).
 */
async function pngBlobToIco(pngBlob, width, height) {
  const pngBytes = new Uint8Array(await pngBlob.arrayBuffer());
  const header = new ArrayBuffer(6 + 16);
  const view = new DataView(header);

  view.setUint16(0, 0, true); // reserved
  view.setUint16(2, 1, true); // type = icon
  view.setUint16(4, 1, true); // image count

  view.setUint8(6, width >= 256 ? 0 : width);
  view.setUint8(7, height >= 256 ? 0 : height);
  view.setUint8(8, 0); // palette
  view.setUint8(9, 0); // reserved
  view.setUint16(10, 1, true); // planes
  view.setUint16(12, 32, true); // bits per pixel
  view.setUint32(14, pngBytes.length, true); // size of PNG data
  view.setUint32(18, 22, true); // offset of PNG data

  return new Blob([header, pngBytes], { type: 'image/x-icon' });
}

/**
 * Encode les pixels d'un canvas en TIFF via UTIF.js.
 */
function canvasToTiffBlob(canvas) {
  const ctx = canvas.getContext('2d');
  const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const tiffBuffer = UTIF.encodeImage(data, canvas.width, canvas.height);
  return new Blob([tiffBuffer], { type: 'image/tiff' });
}

/**
 * Convertit un fichier HEIC/HEIF en PNG via heic2any (libheif WASM embarqué, hors-ligne).
 */
async function heicToPngBlob(file) {
  const result = await heic2any({ blob: file, toType: 'image/png' });
  return Array.isArray(result) ? result[0] : result;
}

/**
 * Calcule automatiquement un facteur d'agrandissement pour rasteriser un SVG (format
 * vectoriel sans résolution propre) : vise une plus grande dimension autour de 1024px pour
 * un rendu net, sans exploser la taille du fichier sur une petite icône (borné à 8x) ni
 * réduire un gros visuel déjà grand (borné à 1x minimum).
 */
function autoSvgScale(width, height) {
  const TARGET = 1024;
  const raw = TARGET / Math.max(width || TARGET, height || TARGET);
  return Math.min(8, Math.max(1, raw));
}

/**
 * Décode un TIFF via UTIF.js (aucun navigateur ne le fait nativement) et dessine ses pixels
 * sur un canvas hors-écran aux dimensions du fichier — utilisé comme source dessinable par
 * getSourceDrawable(), au lieu d'un `<img>` classique.
 */
async function tiffToCanvas(file) {
  const buffer = await file.arrayBuffer();
  const ifds = UTIF.decode(buffer);
  UTIF.decodeImage(buffer, ifds[0]);
  const rgba = UTIF.toRGBA8(ifds[0]);
  const { width, height } = ifds[0];

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const imageData = new ImageData(new Uint8ClampedArray(rgba.buffer, rgba.byteOffset, rgba.byteLength), width, height);
  // putImageData remplace les pixels sans passer par la compositing alpha du canvas — voir
  // getSourceDrawable() : drawInto() redessine ce canvas via drawImage plutôt que de
  // réutiliser putImageData, pour que le fond blanc JPEG (rasterize()) s'applique correctement.
  canvas.getContext('2d').putImageData(imageData, 0, 0);
  return canvas;
}

/**
 * Prépare l'image source (SVG, HEIC, TIFF ou raster classique) sous une forme dessinable de
 * façon uniforme sur un canvas cible via `drawInto(ctx)` (toujours `drawImage`, jamais
 * `putImageData`, pour que le fond blanc JPEG de rasterize() compose correctement avec la
 * transparence de la source) — chaque format a une façon différente d'obtenir ses pixels
 * (décodage `<img>` natif pour la plupart, UTIF.js pour le TIFF que le navigateur ne sait
 * pas afficher).
 */
async function getSourceDrawable(file, svg) {
  if (isTiffFile(file)) {
    const canvas = await tiffToCanvas(file);
    return { width: canvas.width, height: canvas.height, drawInto: (ctx) => ctx.drawImage(canvas, 0, 0) };
  }

  const sourceBlob = isHeicFile(file) ? await heicToPngBlob(file) : file;
  const img = await loadImageFromBlob(sourceBlob);
  const scale = svg ? autoSvgScale(img.naturalWidth, img.naturalHeight) : 1;
  const width = Math.max(1, Math.round((img.naturalWidth || 300) * scale));
  const height = Math.max(1, Math.round((img.naturalHeight || 300) * scale));
  return { width, height, drawInto: (ctx) => ctx.drawImage(img, 0, 0, width, height) };
}

/**
 * Dessine une image source (SVG, HEIC, TIFF ou raster) sur un canvas et retourne un blob
 * dans le format cible.
 */
async function rasterize(file, targetFormat, { quality = 0.9 } = {}) {
  const svg = isSvgFile(file);
  const { width, height, drawInto } = await getSourceDrawable(file, svg);

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');

  if (targetFormat === 'jpg') {
    // Le JPEG ne supporte pas la transparence : fond blanc par défaut.
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, width, height);
  }

  drawInto(ctx);

  if (targetFormat === 'tiff') {
    return canvasToTiffBlob(canvas);
  }

  const pngBlob = await new Promise((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error(t('error.pngEncode')))), 'image/png');
  });

  if (targetFormat === 'ico') {
    return pngBlobToIco(pngBlob, width, height);
  }

  if (targetFormat === 'png') {
    return pngBlob;
  }

  const mime = RASTER_MIME[targetFormat];
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) return reject(new Error(t('error.formatExportUnsupported', { format: targetFormat })));
        // Certains navigateurs retombent silencieusement sur du PNG si le format demandé
        // (ex: AVIF) n'est pas supporté à l'encodage, sans lever d'erreur.
        if (blob.type !== mime) {
          return reject(new Error(t('error.formatExportUnsupportedBrowser', { format: targetFormat })));
        }
        resolve(blob);
      },
      mime,
      quality
    );
  });
}

/**
 * Vectorise un fichier raster (PNG/JPG/...) en SVG via ImageTracer.js.
 */
function traceToSvg(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    try {
      ImageTracer.imageToSVG(
        url,
        (svgString) => {
          URL.revokeObjectURL(url);
          resolve(svgString);
        },
        'default'
      );
    } catch (err) {
      URL.revokeObjectURL(url);
      reject(err);
    }
  });
}

/**
 * Convertit un fichier vers le format cible et retourne un Blob prêt à télécharger.
 * @param {File} file
 * @param {'png'|'jpg'|'webp'|'avif'|'ico'|'tiff'|'svg'} targetFormat
 * @param {{quality?: number}} options
 */
async function convertFile(file, targetFormat, options = {}) {
  if (targetFormat === 'svg') {
    if (isSvgFile(file)) {
      const text = await readFileAsText(file);
      return new Blob([text], { type: 'image/svg+xml' });
    }
    const svgString = await traceToSvg(file);
    return new Blob([svgString], { type: 'image/svg+xml' });
  }

  return rasterize(file, targetFormat, options);
}
