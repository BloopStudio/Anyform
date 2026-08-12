/**
 * Logique de conversion d'images, 100% côté navigateur (Canvas API + ImageTracer.js).
 * Aucune dépendance serveur : tout se passe en JS dans la page.
 */

const RASTER_MIME = {
  png: 'image/png',
  jpg: 'image/jpeg',
  webp: 'image/webp',
};

function isSvgFile(file) {
  return file.type === 'image/svg+xml' || /\.svg$/i.test(file.name);
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
 * Dessine une image source (SVG ou raster) sur un canvas et retourne un blob dans le format cible.
 */
async function rasterize(file, targetFormat, { scale = 2, quality = 0.9 } = {}) {
  const svg = isSvgFile(file);
  const dataUrl = await readFileAsDataUrl(file);
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

  const mime = RASTER_MIME[targetFormat];
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error(`Le navigateur ne supporte pas l'export en ${targetFormat}.`))),
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
 * @param {'png'|'jpg'|'webp'|'svg'} targetFormat
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
