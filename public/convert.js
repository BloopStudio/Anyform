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

function isSvgFile(file) {
  return file.type === 'image/svg+xml' || /\.svg$/i.test(file.name);
}

function isHeicFile(file) {
  return /\.hei[cf]$/i.test(file.name) || file.type === 'image/heic' || file.type === 'image/heif';
}

function readFileAsText(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error);
    reader.readAsText(file);
  });
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Impossible de charger l'image (fichier corrompu ou non supporté)."));
    img.src = src;
  });
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
 * Dessine une image source (SVG, HEIC ou raster) sur un canvas et retourne un blob dans le
 * format cible.
 */
async function rasterize(file, targetFormat, { scale = 2, quality = 0.9 } = {}) {
  const svg = isSvgFile(file);
  const sourceBlob = isHeicFile(file) ? await heicToPngBlob(file) : file;
  const dataUrl = await readFileAsDataUrl(sourceBlob);
  const img = await loadImage(dataUrl);

  const width = Math.max(1, Math.round((img.naturalWidth || 300) * (svg ? scale : 1)));
  const height = Math.max(1, Math.round((img.naturalHeight || 300) * (svg ? scale : 1)));

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');

  if (targetFormat === 'jpg') {
    // Le JPEG ne supporte pas la transparence : fond blanc par défaut.
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, width, height);
  }

  ctx.drawImage(img, 0, 0, width, height);

  if (targetFormat === 'tiff') {
    return canvasToTiffBlob(canvas);
  }

  const pngBlob = await new Promise((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("Échec de l'encodage PNG intermédiaire."))), 'image/png');
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
        if (!blob) return reject(new Error(`Le navigateur ne supporte pas l'export en ${targetFormat}.`));
        // Certains navigateurs retombent silencieusement sur du PNG si le format demandé
        // (ex: AVIF) n'est pas supporté à l'encodage, sans lever d'erreur.
        if (blob.type !== mime) {
          return reject(new Error(`Ton navigateur ne supporte pas l'export en ${targetFormat}.`));
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
    readFileAsDataUrl(file)
      .then((dataUrl) => {
        ImageTracer.imageToSVG(dataUrl, (svgString) => resolve(svgString), 'default');
      })
      .catch(reject);
  });
}

/**
 * Convertit un fichier vers le format cible et retourne un Blob prêt à télécharger.
 * @param {File} file
 * @param {'png'|'jpg'|'webp'|'avif'|'ico'|'tiff'|'svg'} targetFormat
 * @param {{scale?: number, quality?: number}} options
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
