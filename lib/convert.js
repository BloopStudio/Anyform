const sharp = require('sharp');
const ImageTracer = require('imagetracerjs');
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
 * Trace un buffer raster (PNG/JPG/...) vers du SVG vectoriel via ImageTracer.js — même
 * bibliothèque que web/desktop/extension (`public/vendor/imagetracer.js`), pour un rendu
 * cohérent sur toutes les plateformes. Remplace l'ancienne dépendance `potrace`, qui traînait
 * `jimp@0.14` (abandonné, ~60 paquets transitifs, CVE modérée sur `phin`) juste pour décoder
 * l'image — sharp (déjà une dépendance) fait ce décodage nativement, sans rien de plus.
 * `options` suit le format d'ImageTracer (voir sa doc `options.md`), pas celui de potrace.
 */
async function traceToSvg(buffer, options = {}) {
  const { data, info } = await sharp(buffer).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const imgd = { width: info.width, height: info.height, data };
  return ImageTracer.imagedataToSVG(imgd, options);
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

const COMPRESSIBLE_IMAGE_FORMATS = ['png', 'jpg', 'jpeg', 'webp', 'gif', 'svg'];
const COMPRESS_QUALITY_BY_LEVEL = { light: 82, medium: 60, strong: 40 };
const COMPRESS_SCALE_BY_LEVEL = { light: 1, medium: 0.85, strong: 0.65 };

// Minification SVG "maison" : pas d'équivalent complet à un outil comme SVGO, mais les
// gains les plus sûrs (commentaires, espaces, précision décimale, éléments purement
// descriptifs sans effet visuel) sans risquer de casser le rendu.
function minifySvgText(text, level) {
  // La déclaration XML (ex. <?xml version="1.0" encoding="UTF-8"?>) est mise de côté avant
  // la réduction de précision décimale : "1.0" s'y ferait sinon arrondir en "1", invalide.
  const xmlDeclMatch = /^\s*<\?xml[^>]*\?>\s*/.exec(text);
  const xmlDecl = xmlDeclMatch ? xmlDeclMatch[0].trim() : '';
  let out = xmlDeclMatch ? text.slice(xmlDeclMatch[0].length) : text;

  out = out.replace(/<!--[\s\S]*?-->/g, '');
  out = out.replace(/>\s+</g, '><').replace(/[ \t\r\n]+/g, ' ').trim();

  const precision = level === 'strong' ? 1 : level === 'medium' ? 2 : 3;
  out = out.replace(/-?\d+\.\d+/g, (m) => String(parseFloat(parseFloat(m).toFixed(precision))));

  if (level !== 'light') {
    out = out
      .replace(/<title>[\s\S]*?<\/title>/gi, '')
      .replace(/<desc>[\s\S]*?<\/desc>/gi, '')
      .replace(/<metadata>[\s\S]*?<\/metadata>/gi, '');
  }
  if (level === 'strong') {
    out = out.replace(/<g[^>]*>\s*<\/g>/gi, '');
  }
  return xmlDecl ? xmlDecl + out : out;
}

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

  if (ext === 'svg' || isSvgBuffer(buffer)) {
    const minified = minifySvgText(buffer.toString('utf8'), level);
    return { buffer: Buffer.from(minified, 'utf8'), ext: 'svg' };
  }

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

const PDF_JPEG_QUALITY_BY_LEVEL = { light: 82, medium: 60, strong: 40 };
const PDF_MIN_IMAGE_BYTES = 8192; // pas la peine de recompresser de petites icônes internes

/**
 * Compresse un PDF en recompressant les images JPEG (DCTDecode) qu'il contient, sans
 * bibliothèque PDF : reconstruit le fichier objet par objet — chaque objet non modifié est
 * recopié tel quel, seuls les objets image retenus sont réécrits avec leur nouveau flux
 * JPEG (recompressé via sharp) et une /Length à jour, puis une table de références croisées
 * fraîche est régénérée avec les nouveaux offsets. Portage direct de la version navigateur
 * (public/compress.js), qui utilise Canvas pour le ré-encodage JPEG là où sharp fait le même
 * travail ici — même logique de reconstruction sinon. Voir ce fichier pour le détail des
 * limites (PDF avec flux d'objets compressés /ObjStm ou génération d'objet non nulle : rendu
 * tel quel plutôt que de risquer un fichier corrompu).
 * @param {Buffer} inputBuffer
 * @param {'light'|'medium'|'strong'} [level]
 * @returns {Promise<Buffer>}
 */
async function compressPdf(inputBuffer, level = 'medium') {
  const bytes = inputBuffer;
  const text = bytes.toString('latin1');
  const quality = PDF_JPEG_QUALITY_BY_LEVEL[level] ?? PDF_JPEG_QUALITY_BY_LEVEL.medium;

  if (/\/Type\s*\/ObjStm\b/.test(text)) return inputBuffer;

  const objRe = /(\d+)\s+(\d+)\s+obj([\s\S]*?)endobj/g;
  const objects = [];
  let m;
  let maxObjNum = 0;
  while ((m = objRe.exec(text))) {
    const num = parseInt(m[1], 10);
    if (m[2] !== '0') return inputBuffer; // génération non nulle : cas rare, non géré
    maxObjNum = Math.max(maxObjNum, num);
    objects.push({ num, body: m[3], absoluteStart: m.index, byteLength: m[0].length });
  }
  if (!objects.length) return inputBuffer;

  for (const obj of objects) {
    if (!/\/Subtype\s*\/Image/.test(obj.body) || !/\/Filter\s*\/DCTDecode/.test(obj.body)) continue;
    const lengthMatch = /\/Length\s+(\d+)/.exec(obj.body);
    if (!lengthMatch) continue; // /Length en référence indirecte (N 0 R) : pas géré
    const length = parseInt(lengthMatch[1], 10);
    const streamIdx = obj.body.indexOf('stream');
    if (streamIdx === -1) continue;
    let dataStart;
    if (obj.body[streamIdx + 6] === '\r' && obj.body[streamIdx + 7] === '\n') dataStart = streamIdx + 8;
    else if (obj.body[streamIdx + 6] === '\n') dataStart = streamIdx + 7;
    else continue;
    if (dataStart + length > obj.body.length || length < PDF_MIN_IMAGE_BYTES) continue;

    const bodyAbsoluteStart = obj.absoluteStart + (obj.byteLength - obj.body.length - 'endobj'.length);
    const absoluteDataStart = bodyAbsoluteStart + dataStart;
    obj.dictText = obj.body.slice(0, streamIdx);
    obj.originalJpeg = bytes.slice(absoluteDataStart, absoluteDataStart + length);
  }

  let anyChanged = false;
  for (const obj of objects) {
    if (!obj.originalJpeg) continue;
    let newJpeg;
    try {
      newJpeg = await sharp(obj.originalJpeg).jpeg({ quality }).toBuffer();
    } catch {
      obj.originalJpeg = null; // pas décodable (CMJN, profil exotique...) : copié tel quel
      continue;
    }
    if (newJpeg.length >= obj.originalJpeg.length) {
      obj.originalJpeg = null; // aucun gain : copié tel quel
      continue;
    }
    obj.newJpeg = newJpeg;
    obj.newDictText = obj.dictText.replace(/\/Length\s+\d+/, `/Length ${newJpeg.length}`);
    anyChanged = true;
  }

  if (!anyChanged) return inputBuffer;

  const rootMatches = [...text.matchAll(/\/Root\s+(\d+)\s+0\s+R/g)];
  if (!rootMatches.length) return inputBuffer;
  const rootRef = rootMatches[rootMatches.length - 1][1];

  const parts = [Buffer.from('%PDF-1.4\n')];
  let offset = parts[0].length;
  const offsetByNum = new Map();

  for (const obj of objects) {
    offsetByNum.set(obj.num, offset);
    if (obj.newJpeg) {
      const objHeader = Buffer.from(`${obj.num} 0 obj${obj.newDictText}stream\n`);
      const footer = Buffer.from('\nendstream\nendobj\n');
      parts.push(objHeader, obj.newJpeg, footer);
      offset += objHeader.length + obj.newJpeg.length + footer.length;
    } else {
      const original = bytes.slice(obj.absoluteStart, obj.absoluteStart + obj.byteLength);
      const sep = Buffer.from('\n');
      parts.push(original, sep);
      offset += original.length + sep.length;
    }
  }

  const xrefOffset = offset;
  const size = maxObjNum + 1;
  let xrefText = `xref\n0 ${size}\n0000000000 65535 f \n`;
  for (let i = 1; i < size; i++) {
    xrefText += offsetByNum.has(i)
      ? `${String(offsetByNum.get(i)).padStart(10, '0')} 00000 n \n`
      : '0000000000 00001 f \n';
  }
  xrefText += `trailer\n<< /Size ${size} /Root ${rootRef} 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;
  parts.push(Buffer.from(xrefText));

  return Buffer.concat(parts);
}

module.exports = {
  convertImage,
  compressImage,
  compressPdf,
  traceToSvg,
  normalizeFormat,
  isSvgBuffer,
  isHeicBuffer,
  decodeHeic,
  COMPRESSIBLE_IMAGE_FORMATS,
  RASTER_FORMATS,
  SUPPORTED_OUTPUT_FORMATS,
};
