const sharp = require('sharp');
const potrace = require('potrace');
const heicConvert = require('heic-convert');
const { t } = require('./i18n');

const RASTER_FORMATS = ['png', 'jpg', 'jpeg', 'webp', 'tiff', 'gif', 'avif', 'ico'];
const SUPPORTED_OUTPUT_FORMATS = [...RASTER_FORMATS, 'svg'];
const HEIC_BRANDS = ['heic', 'heix', 'hevc', 'hevx', 'heim', 'heis', 'hevm', 'hevs', 'mif1', 'msf1'];

function isHeicBuffer(buffer) {
  if (buffer.length < 12 || buffer.toString('ascii', 4, 8) !== 'ftyp') return false;
  return HEIC_BRANDS.includes(buffer.toString('ascii', 8, 12).toLowerCase());
}

/**
 * Décode un buffer HEIC/HEIF vers un buffer PNG (libheif via WASM, sans dépendance système).
 */
async function decodeHeic(buffer) {
  const output = await heicConvert({ buffer, format: 'PNG' });
  return Buffer.from(output);
}

/**
 * Encode un buffer PNG dans un conteneur .ico minimal (une seule taille).
 */
function pngBufferToIco(pngBuffer, width, height) {
  const header = Buffer.alloc(6 + 16);
  header.writeUInt16LE(0, 0); // reserved
  header.writeUInt16LE(1, 2); // type = icon
  header.writeUInt16LE(1, 4); // image count
  header.writeUInt8(width >= 256 ? 0 : width, 6);
  header.writeUInt8(height >= 256 ? 0 : height, 7);
  header.writeUInt8(0, 8); // palette
  header.writeUInt8(0, 9); // reserved
  header.writeUInt16LE(1, 10); // planes
  header.writeUInt16LE(32, 12); // bits per pixel
  header.writeUInt32LE(pngBuffer.length, 14); // size of PNG data
  header.writeUInt32LE(22, 18); // offset of PNG data
  return Buffer.concat([header, pngBuffer]);
}

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
    throw new Error(t('convert.errOutputFormatUnsupported', { format: outputFormat }));
  }

  if (isHeicBuffer(inputBuffer)) {
    inputBuffer = await decodeHeic(inputBuffer);
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

  if (target === 'ico') {
    const { data, info } = await pipeline.png().toBuffer({ resolveWithObject: true });
    return pngBufferToIco(data, info.width, info.height);
  }

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

const COMPRESSIBLE_IMAGE_FORMATS = ['png', 'jpg', 'jpeg', 'webp', 'gif'];
const COMPRESS_QUALITY_BY_LEVEL = { light: 82, medium: 60, strong: 40 };
const COMPRESS_SCALE_BY_LEVEL = { light: 1, medium: 0.85, strong: 0.65 };

/**
 * Compresse une image en conservant son format d'origine (exception : HEIC/HEIF, que sharp
 * ne sait pas ré-encoder — décodé puis compressé en PNG, comme sur le web/l'app de bureau).
 * @param {Buffer} inputBuffer
 * @param {string} sourceExt
 * @param {'light'|'medium'|'strong'} [level]
 * @returns {Promise<{buffer: Buffer, ext: string}>}
 */
async function compressImage(inputBuffer, sourceExt, level = 'medium') {
  let ext = normalizeFormat(sourceExt);
  let buffer = inputBuffer;

  if (ext === 'heic' || ext === 'heif' || isHeicBuffer(buffer)) {
    buffer = await decodeHeic(buffer);
    ext = 'png';
  }

  if (!COMPRESSIBLE_IMAGE_FORMATS.includes(ext)) {
    throw new Error(
      t('convert.errCompressUnsupported', { ext, supported: COMPRESSIBLE_IMAGE_FORMATS.join(', ') })
    );
  }

  const isLossy = ext === 'jpg' || ext === 'jpeg' || ext === 'webp';
  let pipeline = sharp(buffer);

  if (!isLossy) {
    const scale = COMPRESS_SCALE_BY_LEVEL[level] ?? 1;
    if (scale < 1) {
      const meta = await sharp(buffer).metadata();
      if (meta.width) pipeline = pipeline.resize(Math.max(1, Math.round(meta.width * scale)));
    }
  }

  const quality = COMPRESS_QUALITY_BY_LEVEL[level] ?? COMPRESS_QUALITY_BY_LEVEL.medium;

  switch (ext) {
    case 'jpg':
    case 'jpeg':
      pipeline = pipeline.jpeg({ quality });
      break;
    case 'webp':
      pipeline = pipeline.webp({ quality });
      break;
    case 'png':
      pipeline = pipeline.png();
      break;
    case 'gif':
      pipeline = pipeline.gif();
      break;
  }

  return { buffer: await pipeline.toBuffer(), ext };
}

module.exports = {
  convertImage,
  compressImage,
  traceToSvg,
  normalizeFormat,
  isSvgBuffer,
  isHeicBuffer,
  decodeHeic,
  COMPRESSIBLE_IMAGE_FORMATS,
  RASTER_FORMATS,
  SUPPORTED_OUTPUT_FORMATS,
};
