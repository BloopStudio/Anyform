const sharp = require('sharp');
const potrace = require('potrace');

const RASTER_FORMATS = ['png', 'jpg', 'jpeg', 'webp', 'tiff', 'gif', 'avif'];
const SUPPORTED_OUTPUT_FORMATS = [...RASTER_FORMATS, 'svg'];

function normalizeFormat(format) {
  const f = String(format || '').toLowerCase().replace(/^\./, '');
  return f === 'jpeg' ? 'jpg' : f;
}

function isSvgBuffer(buffer) {
  const head = buffer.slice(0, 1000).toString('utf8').trim().toLowerCase();
  return head.startsWith('<?xml') ? head.includes('<svg') : head.startsWith('<svg');
}

/**
 * Trace un buffer raster (PNG/JPG/...) vers du SVG vectoriel.
 */
function traceToSvg(buffer, options = {}) {
  return new Promise((resolve, reject) => {
    potrace.trace(buffer, options, (err, svg) => {
      if (err) return reject(err);
      resolve(svg);
    });
  });
}

/**
 * Convertit un fichier image d'un format vers un autre.
 * @param {Buffer} inputBuffer - contenu du fichier source
 * @param {string} outputFormat - 'png' | 'jpg' | 'webp' | 'tiff' | 'gif' | 'avif' | 'svg'
 * @param {object} [options] - { density, quality }
 * @returns {Promise<Buffer|string>} Buffer pour les formats raster, string pour svg
 */
async function convertImage(inputBuffer, outputFormat, options = {}) {
  const target = normalizeFormat(outputFormat);

  if (!SUPPORTED_OUTPUT_FORMATS.includes(target)) {
    throw new Error(`Format de sortie non supporté: ${outputFormat}`);
  }

  const sourceIsSvg = isSvgBuffer(inputBuffer);

  if (target === 'svg') {
    if (sourceIsSvg) {
      return inputBuffer.toString('utf8');
    }
    return traceToSvg(inputBuffer, options.trace || {});
  }

  // Sortie raster : sharp lit le SVG (avec densité pour la qualité) ou une image raster existante.
  let pipeline = sharp(inputBuffer, sourceIsSvg ? { density: options.density || 300 } : undefined);

  switch (target) {
    case 'jpg':
      pipeline = pipeline.jpeg({ quality: options.quality || 90 });
      break;
    case 'png':
      pipeline = pipeline.png();
      break;
    case 'webp':
      pipeline = pipeline.webp({ quality: options.quality || 90 });
      break;
    case 'tiff':
      pipeline = pipeline.tiff();
      break;
    case 'gif':
      pipeline = pipeline.gif();
      break;
    case 'avif':
      pipeline = pipeline.avif({ quality: options.quality || 90 });
      break;
  }

  return pipeline.toBuffer();
}

module.exports = {
  convertImage,
  traceToSvg,
  normalizeFormat,
  isSvgBuffer,
  RASTER_FORMATS,
  SUPPORTED_OUTPUT_FORMATS,
};
