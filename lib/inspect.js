/**
 * Inspecteur : lit les propriétés d'un fichier (dimensions, durée, nombre de
 * lignes/colonnes, nombre de sous-titres...) sans le modifier. Portage de
 * public/inspect.js (web/desktop/extension) pour le CLI — même répartition par
 * catégorie, mais la durée/résolution audio/vidéo vient de `ffmpeg -i` (parsing de
 * stderr) au lieu des métadonnées natives du navigateur, qui n'existent pas ici.
 */

const fs = require('fs');
const { spawn } = require('child_process');
const sharp = require('sharp');
const ffmpegPath = require('ffmpeg-static');
const { bufferToWorkbook } = require('./data');
const { parseSubtitle } = require('./subtitles');
const XLSX = require('xlsx');
const { isHeicBuffer, decodeHeic, isSvgBuffer } = require('./convert');
const { t, getLanguage } = require('./i18n');

function formatDuration(seconds) {
  if (!Number.isFinite(seconds)) return t('inspect.durationUnknown');
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

// ffmpeg n'a pas de mode "juste lire les métadonnées, ne rien écrire" : on lui donne
// "-i <fichier>" sans sortie, il échoue volontairement après avoir imprimé les infos du
// flux d'entrée sur stderr (comportement standard, utilisé par ffprobe en interne) — on
// parse cette sortie plutôt que de dépendre d'un binaire ffprobe séparé.
function probeMedia(filePath) {
  return new Promise((resolve, reject) => {
    const ffmpeg = spawn(ffmpegPath, ['-i', filePath]);
    let stderr = '';
    ffmpeg.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
    });
    ffmpeg.on('error', reject);
    ffmpeg.on('close', () => {
      const durationMatch = /Duration:\s*(\d+):(\d+):(\d+\.\d+)/.exec(stderr);
      const resolutionMatch = /Video:.*?(\d{2,5})x(\d{2,5})/.exec(stderr);
      // La ligne "Stream ...: Audio: ..." liste toujours "<Hz> Hz, <disposition>," (ex.
      // "44100 Hz, stereo,") — capturé ici pour éviter un second appel ffmpeg.
      const audioMatch = /Audio:.*?(\d+) Hz, ([a-z0-9.]+),/.exec(stderr);
      if (!durationMatch) {
        return reject(new Error(t('inspect.errMediaUnreadable')));
      }
      const duration =
        parseInt(durationMatch[1], 10) * 3600 + parseInt(durationMatch[2], 10) * 60 + parseFloat(durationMatch[3]);
      resolve({
        duration,
        width: resolutionMatch ? parseInt(resolutionMatch[1], 10) : null,
        height: resolutionMatch ? parseInt(resolutionMatch[2], 10) : null,
        sampleRate: audioMatch ? parseInt(audioMatch[1], 10) : null,
        channelLayout: audioMatch ? audioMatch[2] : null,
      });
    });
  });
}

function gcd(a, b) {
  return b === 0 ? a : gcd(b, a % b);
}

function aspectRatioLabel(width, height) {
  const d = gcd(width, height) || 1;
  return `${width / d}:${height / d}`;
}

function channelsLabel(layout) {
  if (layout === 'mono') return t('inspect.mono');
  if (layout === 'stereo') return t('inspect.stereo');
  return layout;
}

// Parse l'en-tête ICONDIR (6 octets) + les ICONDIRENTRY (16 octets chacune) directement,
// sans décoder aucune image embarquée — le format expose déjà la liste des tailles en clair.
// sharp ne sait pas lire l'ICO (format non supporté par libvips), d'où ce parsing manuel.
function inspectIco(buffer) {
  const count = buffer.readUInt16LE(4);
  const sizes = [];
  for (let i = 0; i < count; i++) {
    const offset = 6 + i * 16;
    const w = buffer.readUInt8(offset) || 256;
    const h = buffer.readUInt8(offset + 1) || 256;
    sizes.push(`${w}×${h}`);
  }
  return [
    { label: t('inspect.icoCount'), value: String(count) },
    { label: t('inspect.icoSizes'), value: sizes.join(', ') },
  ];
}

async function inspectImage(buffer, sourceExt) {
  const items = [];
  if (isSvgBuffer(buffer) || sourceExt === 'svg') {
    const text = buffer.toString('utf8');
    const widthMatch = /width="([\d.]+)/.exec(text);
    const heightMatch = /height="([\d.]+)/.exec(text);
    const viewBoxMatch = /viewBox="([^"]+)"/.exec(text);
    if (widthMatch && heightMatch) items.push({ label: t('inspect.declaredDimensions'), value: `${widthMatch[1]} × ${heightMatch[1]}` });
    if (viewBoxMatch) items.push({ label: 'viewBox', value: viewBoxMatch[1] });
    items.push({ label: t('inspect.type'), value: t('inspect.typeVector') });
    return items;
  }

  if (sourceExt === 'ico') return inspectIco(buffer);

  const sourceBuffer = isHeicBuffer(buffer) ? await decodeHeic(buffer) : buffer;
  const meta = await sharp(sourceBuffer).metadata();
  items.push({ label: t('inspect.dimensions'), value: `${meta.width} × ${meta.height} px` });
  items.push({ label: t('inspect.ratio'), value: (meta.width / meta.height).toFixed(3) });
  items.push({ label: t('inspect.format'), value: meta.format });
  items.push({ label: t('inspect.hasAlpha'), value: t(meta.hasAlpha ? 'inspect.yes' : 'inspect.no') });
  if (meta.bitsPerSample) items.push({ label: t('inspect.bitDepth'), value: `${meta.bitsPerSample}-bit` });
  if (meta.pages > 1) items.push({ label: t('inspect.tiffPages'), value: String(meta.pages) });
  if (isHeicBuffer(buffer)) items.push({ label: t('inspect.note'), value: t('inspect.heicNote') });
  if (sourceExt === 'tiff' || sourceExt === 'tif') {
    // Un fichier TIFF est déjà structuré comme un bloc EXIF (même format d'IFD) : le header
    // TIFF commence dès l'octet 0.
    items.push(...exifItems(readExif(buffer, 0)));
  } else if (sourceExt === 'jpg' || sourceExt === 'jpeg') {
    // sharp isole déjà le bloc EXIF brut ("Exif\0\0" + structure TIFF) sans qu'on ait à
    // parcourir les marqueurs JPEG nous-mêmes — le header TIFF commence toujours à l'octet 6.
    if (meta.exif) items.push(...exifItems(readExif(meta.exif, 6)));
  }
  return items;
}

const EXIF_TYPE_SIZES = { 1: 1, 2: 1, 3: 2, 4: 4, 5: 8, 6: 1, 7: 1, 8: 2, 9: 4, 10: 8, 11: 4, 12: 8 };

function readU16(buf, offset, littleEndian) {
  return littleEndian ? buf.readUInt16LE(offset) : buf.readUInt16BE(offset);
}

function readU32(buf, offset, littleEndian) {
  return littleEndian ? buf.readUInt32LE(offset) : buf.readUInt32BE(offset);
}

function readExifAscii(buf, offset, size) {
  let out = '';
  for (let i = 0; i < size - 1; i++) {
    const c = buf.readUInt8(offset + i);
    if (c === 0) break;
    out += String.fromCharCode(c);
  }
  return out;
}

function readExifRational(buf, offset, littleEndian) {
  const num = readU32(buf, offset, littleEndian);
  const den = readU32(buf, offset + 4, littleEndian);
  return den !== 0 ? num / den : 0;
}

// Parcourt un IFD TIFF/EXIF (2 octets de nombre d'entrées, puis 12 octets par entrée) et
// retourne les tags demandés (tagNames: {tag: nomDeSortie}), plus les offsets des sous-IFD
// Exif (0x8769) et GPS (0x8825) s'ils sont présents.
function readExifIfd(buf, tiffStart, ifdOffset, littleEndian, tagNames) {
  const out = {};
  let subExifOffset = null;
  let subGpsOffset = null;
  const count = readU16(buf, tiffStart + ifdOffset, littleEndian);
  for (let i = 0; i < count; i++) {
    const entryOff = tiffStart + ifdOffset + 2 + i * 12;
    const tag = readU16(buf, entryOff, littleEndian);
    const type = readU16(buf, entryOff + 2, littleEndian);
    const valueCount = readU32(buf, entryOff + 4, littleEndian);
    const totalSize = (EXIF_TYPE_SIZES[type] || 1) * valueCount;
    const dataOffset = totalSize <= 4 ? entryOff + 8 : tiffStart + readU32(buf, entryOff + 8, littleEndian);

    if (tag === 0x8769) { subExifOffset = readU32(buf, entryOff + 8, littleEndian); continue; }
    if (tag === 0x8825) { subGpsOffset = readU32(buf, entryOff + 8, littleEndian); continue; }

    const name = tagNames[tag];
    if (!name) continue;
    if (type === 2) out[name] = readExifAscii(buf, dataOffset, totalSize);
    else if (type === 5 || type === 10) out[name] = readExifRational(buf, dataOffset, littleEndian);
    else if (type === 3) out[name] = readU16(buf, dataOffset, littleEndian);
    else if (type === 4 || type === 9) out[name] = readU32(buf, dataOffset, littleEndian);
    else if (type === 1) out[name] = buf.readUInt8(dataOffset);
  }
  return { tags: out, subExifOffset, subGpsOffset };
}

function readExifGps(buf, tiffStart, gpsOffset, littleEndian) {
  const count = readU16(buf, tiffStart + gpsOffset, littleEndian);
  let latRef, lonRef, lat, lon;
  for (let i = 0; i < count; i++) {
    const entryOff = tiffStart + gpsOffset + 2 + i * 12;
    const tag = readU16(buf, entryOff, littleEndian);
    if (tag === 0x0001) latRef = String.fromCharCode(buf.readUInt8(entryOff + 8));
    else if (tag === 0x0003) lonRef = String.fromCharCode(buf.readUInt8(entryOff + 8));
    else if (tag === 0x0002 || tag === 0x0004) {
      const off = tiffStart + readU32(buf, entryOff + 8, littleEndian);
      const deg = readExifRational(buf, off, littleEndian);
      const min = readExifRational(buf, off + 8, littleEndian);
      const sec = readExifRational(buf, off + 16, littleEndian);
      const decimal = deg + min / 60 + sec / 3600;
      if (tag === 0x0002) lat = decimal; else lon = decimal;
    }
  }
  if (lat === undefined || lon === undefined) return null;
  return { lat: latRef === 'S' ? -lat : lat, lon: lonRef === 'W' ? -lon : lon };
}

// Lit les tags EXIF utiles (appareil, date de prise de vue, réglages, GPS) directement dans
// la structure TIFF/EXIF, sans dépendance externe — même approche que le parsing ICO déjà en
// place : on ne lit que les octets nécessaires, pas de décodage d'image complet. `tiffStart`
// est l'offset du header TIFF ("II"/"MM" + 42) dans le buffer : 0 pour un fichier TIFF, 6
// dans le buffer `meta.exif` isolé par sharp pour un JPEG (juste après "Exif\0\0").
function readExif(buffer, tiffStart) {
  if (tiffStart === null || tiffStart + 8 > buffer.length) return null;
  const byteOrder = buffer.readUInt16BE(tiffStart);
  if (byteOrder !== 0x4949 && byteOrder !== 0x4d4d) return null;
  const littleEndian = byteOrder === 0x4949;
  const ifd0Offset = readU32(buffer, tiffStart + 4, littleEndian);

  const { tags: ifd0Tags, subExifOffset, subGpsOffset } = readExifIfd(buffer, tiffStart, ifd0Offset, littleEndian, {
    0x010f: 'make',
    0x0110: 'model',
    0x0112: 'orientation',
    0x0132: 'dateTime',
  });

  let exifTags = {};
  if (subExifOffset) {
    exifTags = readExifIfd(buffer, tiffStart, subExifOffset, littleEndian, {
      0x9003: 'dateTimeOriginal',
      0x829a: 'exposureTime',
      0x829d: 'fNumber',
      0x8827: 'iso',
      0x920a: 'focalLength',
      0xa434: 'lensModel',
    }).tags;
  }

  const gps = subGpsOffset ? readExifGps(buffer, tiffStart, subGpsOffset, littleEndian) : null;
  return { ...ifd0Tags, ...exifTags, gps };
}

function formatExifDateTime(str) {
  const m = /^(\d{4}):(\d{2}):(\d{2})\s+(\d{2}):(\d{2}):(\d{2})/.exec(str || '');
  if (!m) return null;
  const [, y, mo, d, h, mi, s] = m;
  return new Date(`${y}-${mo}-${d}T${h}:${mi}:${s}`).toLocaleString(getLanguage() === 'en' ? 'en-US' : 'fr-FR');
}

const EXIF_ORIENTATION_KEYS = {
  1: 'inspect.exif.orientation.normal',
  2: 'inspect.exif.orientation.flipped',
  3: 'inspect.exif.orientation.rotated180',
  4: 'inspect.exif.orientation.flippedRotated180',
  5: 'inspect.exif.orientation.flippedRotated90cw',
  6: 'inspect.exif.orientation.rotated90cw',
  7: 'inspect.exif.orientation.flippedRotated90ccw',
  8: 'inspect.exif.orientation.rotated90ccw',
};

function exifItems(exif) {
  if (!exif) return [];
  const items = [];
  const camera = exif.make && exif.model && exif.model.toLowerCase().startsWith(exif.make.toLowerCase())
    ? exif.model
    : [exif.make, exif.model].filter(Boolean).join(' ');
  if (camera) items.push({ label: t('inspect.exif.camera'), value: camera });
  if (exif.lensModel) items.push({ label: t('inspect.exif.lens'), value: exif.lensModel });
  const dateTaken = formatExifDateTime(exif.dateTimeOriginal) || formatExifDateTime(exif.dateTime);
  if (dateTaken) items.push({ label: t('inspect.exif.dateTaken'), value: dateTaken });
  if (EXIF_ORIENTATION_KEYS[exif.orientation]) {
    items.push({ label: t('inspect.exif.orientation'), value: t(EXIF_ORIENTATION_KEYS[exif.orientation]) });
  }
  if (exif.fNumber) items.push({ label: t('inspect.exif.fNumber'), value: `f/${exif.fNumber.toFixed(1)}` });
  if (exif.exposureTime) {
    const value = exif.exposureTime < 1 ? `1/${Math.round(1 / exif.exposureTime)} s` : `${exif.exposureTime} s`;
    items.push({ label: t('inspect.exif.exposureTime'), value });
  }
  if (exif.iso) items.push({ label: t('inspect.exif.iso'), value: String(exif.iso) });
  if (exif.focalLength) items.push({ label: t('inspect.exif.focalLength'), value: `${exif.focalLength} mm` });
  if (exif.gps) items.push({ label: t('inspect.exif.gps'), value: `${exif.gps.lat.toFixed(5)}, ${exif.gps.lon.toFixed(5)}` });
  return items;
}

function pdfDecodeLiteralString(raw) {
  let out = '';
  for (let i = 0; i < raw.length; i++) {
    const c = raw[i];
    if (c !== '\\') { out += c; continue; }
    const next = raw[i + 1];
    if (next === 'n') { out += '\n'; i++; }
    else if (next === 'r') { out += '\r'; i++; }
    else if (next === 't') { out += '\t'; i++; }
    else if (next === '(' || next === ')' || next === '\\') { out += next; i++; }
    else if (/[0-7]/.test(next)) {
      const oct = /^[0-7]{1,3}/.exec(raw.slice(i + 1, i + 4))[0];
      out += String.fromCharCode(parseInt(oct, 8));
      i += oct.length;
    } else { out += next; i++; }
  }
  return out;
}

function pdfDecodeHexString(hex) {
  const clean = hex.replace(/\s/g, '');
  let out = '';
  for (let i = 0; i < clean.length; i += 2) out += String.fromCharCode(parseInt(clean.slice(i, i + 2), 16));
  return out;
}

// Le format PDF encode les chaînes non-ASCII (accents, etc.) en UTF-16BE avec un BOM
// \xFE\xFF en préfixe ; sans ce préfixe, le texte est déjà en Latin-1/PDFDocEncoding et n'a
// rien à décoder de plus.
function pdfDecodeUnicode(str) {
  if (str.charCodeAt(0) !== 0xfe || str.charCodeAt(1) !== 0xff) return str;
  let out = '';
  for (let i = 2; i < str.length; i += 2) out += String.fromCharCode((str.charCodeAt(i) << 8) | str.charCodeAt(i + 1));
  return out;
}

function pdfInfoField(text, key) {
  const literal = new RegExp(`/${key}\\s*\\(((?:[^()\\\\]|\\\\.)*)\\)`).exec(text);
  if (literal) return pdfDecodeUnicode(pdfDecodeLiteralString(literal[1]));
  const hex = new RegExp(`/${key}\\s*<([0-9A-Fa-f\\s]*)>`).exec(text);
  if (hex) return pdfDecodeUnicode(pdfDecodeHexString(hex[1]));
  return null;
}

// Format de date PDF : D:YYYYMMDDHHmmSS(+/-HH'mm' | Z), heure/minute/seconde optionnelles.
function pdfParseDate(str) {
  const m = /D:(\d{4})(\d{2})(\d{2})(\d{2})?(\d{2})?(\d{2})?/.exec(str || '');
  if (!m) return new Date(NaN);
  const [, y, mo, d, h = '00', mi = '00', s = '00'] = m;
  return new Date(`${y}-${mo}-${d}T${h}:${mi}:${s}`);
}

// Latin-1 : chaque octet devient un caractère, ce qui préserve les offsets binaires exacts
// tout en permettant des regex texte sur les parties non compressées du fichier (mots-clés,
// dictionnaires) — même logique « lire juste ce qu'il faut » que pour ICO/TIFF, sans
// dépendance type pdf.js.
function inspectPdf(buffer) {
  const text = buffer.toString('latin1');
  const items = [];

  const versionMatch = /^%PDF-(\d\.\d)/.exec(text);
  if (versionMatch) items.push({ label: t('inspect.pdf.version'), value: versionMatch[1] });

  // On découpe le texte en objets PDF (délimités par "N G obj" ... "endobj", toujours en
  // clair même dans un PDF dont les flux de contenu sont compressés) pour chercher le nœud
  // racine /Pages (qui porte le /Count total) et, en repli, compter les objets /Type /Page.
  const objects = [...text.matchAll(/\d+\s+\d+\s+obj([\s\S]*?)endobj/g)].map((m) => m[1]);
  const pageTreeCounts = objects
    .filter((body) => /\/Type\s*\/Pages\b/.test(body))
    .map((body) => /\/Count\s+(\d+)/.exec(body))
    .filter(Boolean)
    .map((m) => parseInt(m[1], 10));
  let pageCount = pageTreeCounts.length ? Math.max(...pageTreeCounts) : null;
  if (pageCount === null) {
    const pageObjectCount = objects.filter((body) => /\/Type\s*\/Page\b(?!s)/.test(body)).length;
    pageCount = pageObjectCount || null;
  }
  if (pageCount !== null) items.push({ label: t('inspect.pdf.pages'), value: String(pageCount) });

  const title = pdfInfoField(text, 'Title');
  const author = pdfInfoField(text, 'Author');
  const creator = pdfInfoField(text, 'Creator');
  const producer = pdfInfoField(text, 'Producer');
  if (title) items.push({ label: t('inspect.pdf.title'), value: title });
  if (author) items.push({ label: t('inspect.pdf.author'), value: author });
  if (creator) items.push({ label: t('inspect.pdf.creator'), value: creator });
  if (producer) items.push({ label: t('inspect.pdf.producer'), value: producer });

  const creationDateMatch = /\/CreationDate\s*\(([^)]*)\)/.exec(text);
  const creationDate = creationDateMatch ? pdfParseDate(creationDateMatch[1]) : null;
  if (creationDate && !Number.isNaN(creationDate.getTime())) {
    items.push({ label: t('inspect.pdf.created'), value: creationDate.toLocaleString(getLanguage() === 'en' ? 'en-US' : 'fr-FR') });
  }

  items.push({ label: t('inspect.pdf.encrypted'), value: t(/\/Encrypt\s/.test(text) ? 'inspect.yes' : 'inspect.no') });

  // Un PDF sans aucune ressource /Font n'a aucun texte à afficher : signe fort qu'il s'agit de
  // pages scannées (images pleine page). Heuristique best-effort : ne détecte pas une police
  // référencée uniquement dans un flux d'objets compressé (ObjStm, PDF récents), d'où le
  // libellé "probablement" plutôt qu'une affirmation certaine.
  const hasFontResource = /\/Type\s*\/Font\b/.test(text);
  items.push({
    label: t('inspect.pdf.hasText'),
    value: t(hasFontResource ? 'inspect.pdf.hasText.likely' : 'inspect.pdf.hasText.unlikely'),
  });

  return items;
}

const ZIP_EOCD_SIG = 0x06054b50;
const ZIP_CD_SIG = 0x02014b50;
const ZIP_EOCD64_LOCATOR_SIG = 0x07064b50;
const ZIP_EOCD64_SIG = 0x06064b50;

// Le commentaire final de l'archive (jusqu'à 65535 octets) peut décaler l'EOCD par rapport à
// la toute fin du fichier : on cherche sa signature en repartant de la fin.
function findZipEocd(buffer) {
  const start = buffer.length - 22;
  const minOffset = Math.max(0, start - 65557);
  for (let i = start; i >= minOffset; i--) {
    if (buffer.readUInt32LE(i) === ZIP_EOCD_SIG) return i;
  }
  return -1;
}

function inspectZip(buffer) {
  const eocdOffset = findZipEocd(buffer);
  if (eocdOffset === -1) return [{ label: t('inspect.zip.fileCount'), value: t('inspect.zip.invalid') }];

  let entryCount = buffer.readUInt16LE(eocdOffset + 10);
  let cdOffset = buffer.readUInt32LE(eocdOffset + 16);

  // ZIP64 : les champs classiques valent 0xFFFF/0xFFFFFFFF quand l'archive dépasse leurs
  // limites ; les vraies valeurs sont dans l'enregistrement ZIP64 EOCD, localisé juste avant
  // l'EOCD classique via son "locator" (20 octets fixes).
  if (entryCount === 0xffff || cdOffset === 0xffffffff) {
    const locatorOffset = eocdOffset - 20;
    if (locatorOffset >= 0 && buffer.readUInt32LE(locatorOffset) === ZIP_EOCD64_LOCATOR_SIG) {
      const eocd64Offset = Number(buffer.readBigUInt64LE(locatorOffset + 8));
      if (buffer.readUInt32LE(eocd64Offset) === ZIP_EOCD64_SIG) {
        entryCount = Number(buffer.readBigUInt64LE(eocd64Offset + 32));
        cdOffset = Number(buffer.readBigUInt64LE(eocd64Offset + 48));
      }
    }
  }

  const names = [];
  let totalCompressed = 0;
  let totalUncompressed = 0;
  let folderCount = 0;
  let offset = cdOffset;
  for (let i = 0; i < entryCount && offset >= 0 && offset + 46 <= buffer.length; i++) {
    if (buffer.readUInt32LE(offset) !== ZIP_CD_SIG) break;
    const compressedSize = buffer.readUInt32LE(offset + 20);
    const uncompressedSize = buffer.readUInt32LE(offset + 24);
    const nameLen = buffer.readUInt16LE(offset + 28);
    const extraLen = buffer.readUInt16LE(offset + 30);
    const commentLen = buffer.readUInt16LE(offset + 32);
    const name = buffer.toString('utf8', offset + 46, offset + 46 + nameLen);
    if (name.endsWith('/')) folderCount++;
    else names.push(name);
    totalCompressed += compressedSize;
    totalUncompressed += uncompressedSize;
    offset += 46 + nameLen + extraLen + commentLen;
  }

  const items = [
    { label: t('inspect.zip.fileCount'), value: String(names.length) },
    { label: t('inspect.zip.folderCount'), value: String(folderCount) },
    { label: t('inspect.zip.uncompressedSize'), value: formatBytes(totalUncompressed) },
    { label: t('inspect.zip.compressedSize'), value: formatBytes(totalCompressed) },
  ];
  if (totalUncompressed > 0) {
    const ratio = Math.round((1 - totalCompressed / totalUncompressed) * 100);
    items.push({ label: t('inspect.zip.ratio'), value: `${ratio}%` });
  }

  // Certaines archives ZIP ont un format interne reconnaissable : documents Office (docx/
  // xlsx/pptx), archives Java (jar), livres EPUB — utile à signaler puisqu'on a déjà la liste
  // des fichiers sous la main, sans coût supplémentaire.
  let detectedType = null;
  if (names.includes('[Content_Types].xml')) detectedType = t('inspect.zip.type.office');
  else if (names.some((n) => n.startsWith('META-INF/MANIFEST.MF'))) detectedType = t('inspect.zip.type.jar');
  else if (names.includes('mimetype')) detectedType = t('inspect.zip.type.epub');
  if (detectedType) items.push({ label: t('inspect.zip.detectedType'), value: detectedType });

  if (names.length) {
    const shown = names.slice(0, 20).join(', ');
    const more = names.length > 20 ? t('inspect.zip.andMore', { n: names.length - 20 }) : '';
    items.push({ label: t('inspect.zip.fileList'), value: shown + more });
  }

  return items;
}

async function inspectAudioOrVideo(filePath, category) {
  const meta = await probeMedia(filePath);
  const items = [{ label: t('inspect.duration'), value: formatDuration(meta.duration) }];
  if (category === 'video' && meta.width && meta.height) {
    items.push({ label: t('inspect.resolution'), value: `${meta.width} × ${meta.height} px` });
    items.push({ label: t('inspect.aspectRatio'), value: aspectRatioLabel(meta.width, meta.height) });
  }
  if (Number.isFinite(meta.duration) && meta.duration > 0) {
    const size = fs.statSync(filePath).size;
    const kbps = Math.round((size * 8) / meta.duration / 1000);
    items.push({ label: t('inspect.avgBitrate'), value: `${kbps} kbps` });
  }
  if (category === 'audio' && meta.channelLayout) {
    items.push({ label: t('inspect.channels'), value: channelsLabel(meta.channelLayout) });
  }
  if (category === 'audio' && meta.sampleRate) {
    items.push({ label: t('inspect.sampleRate'), value: `${meta.sampleRate} Hz` });
  }
  return items;
}

// Devine le type dominant de chaque colonne en échantillonnant jusqu'à 50 lignes de
// données. Lit les cellules directement dans `sheet` (pas le tableau plat de
// sheet_to_json) : un CSV comme "2020-01-15" est stocké par SheetJS comme un nombre sans
// format associé (le CSV n'a pas de mise en forme) — seul cell.w (le texte d'origine
// formaté) garde encore l'apparence de date à tester.
function inferColumnTypes(sheet, rows) {
  if (rows.length < 2) return null;
  const headers = rows[0];
  const columnCount = Math.max(...rows.map((r) => r.length));
  const sampleRowCount = Math.min(rows.length - 1, 50);
  const dominants = [];

  for (let c = 0; c < columnCount; c++) {
    const counts = { number: 0, date: 0, text: 0 };
    for (let r = 1; r <= sampleRowCount; r++) {
      const cell = sheet[XLSX.utils.encode_cell({ r, c })];
      if (!cell || cell.v === undefined || cell.v === '') continue;
      const looksLikeDate = cell.w && (/^\d{4}-\d{1,2}-\d{1,2}/.test(cell.w) || /^\d{1,2}\/\d{1,2}\/\d{2,4}$/.test(cell.w));
      if (cell.t === 'd' || looksLikeDate) counts.date++;
      else if (cell.t === 'n') counts.number++;
      else counts.text++;
    }
    const [type, hits] = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
    dominants.push(hits > 0 ? t(`inspect.type.${type}`) : '—');
  }

  return headers.map((h, i) => `${h || '?'}: ${dominants[i]}`).join(', ');
}

function inspectData(buffer, sourceExt) {
  const workbook = bufferToWorkbook(buffer, sourceExt);
  const items = [{ label: t('inspect.sheets'), value: workbook.SheetNames.join(', ') }];
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 });
  const columnCount = rows.length ? Math.max(...rows.map((r) => r.length)) : 0;
  items.push({ label: t('inspect.rows'), value: String(rows.length) });
  items.push({ label: t('inspect.columns'), value: String(columnCount) });
  if (rows.length) items.push({ label: t('inspect.headers'), value: rows[0].join(', ') });
  const columnTypes = inferColumnTypes(sheet, rows);
  if (columnTypes) items.push({ label: t('inspect.columnTypes'), value: columnTypes });
  return items;
}

// Deux vérifications qualité utiles pour du sous-titrage : des cues qui se chevauchent
// (bug fréquent d'export) et des cues trop denses en texte pour être lues dans le temps
// imparti (250 mots/minute est le seuil de lisibilité communément retenu en sous-titrage).
function countOverlappingCues(cues) {
  let count = 0;
  for (let i = 1; i < cues.length; i++) {
    if (cues[i].start < cues[i - 1].end) count++;
  }
  return count;
}

const MAX_READABLE_WPM = 250;

function countTooFastCues(cues) {
  let count = 0;
  for (const cue of cues) {
    const duration = cue.end - cue.start;
    if (duration <= 0) continue;
    const words = cue.text.trim().split(/\s+/).filter(Boolean).length;
    if ((words / duration) * 60 > MAX_READABLE_WPM) count++;
  }
  return count;
}

function inspectSubtitle(buffer, sourceExt) {
  const cues = parseSubtitle(buffer.toString('utf8'), sourceExt);
  const items = [{ label: t('inspect.subtitleCount'), value: String(cues.length) }];
  if (cues.length) {
    const first = cues[0].start;
    const last = Math.max(...cues.map((c) => c.end));
    items.push({ label: t('inspect.firstTimecode'), value: formatDuration(first) });
    items.push({ label: t('inspect.lastTimecode'), value: formatDuration(last) });
    items.push({ label: t('inspect.coveredRange'), value: formatDuration(last - first) });
    items.push({ label: t('inspect.overlappingCues'), value: String(countOverlappingCues(cues)) });
    items.push({ label: t('inspect.tooFastCues'), value: String(countTooFastCues(cues)) });
  }
  return items;
}

/**
 * Inspecte un fichier et retourne la liste de ses propriétés (label/valeur), en plus des
 * informations génériques communes à tous les fichiers (nom, taille, dernière modification).
 * @param {string} filePath
 * @param {'image'|'data'|'audio'|'video'|'subtitle'|'document'|'archive'} category
 * @param {string} sourceExt
 */
async function inspectFile(filePath, category, sourceExt) {
  const stat = fs.statSync(filePath);
  const generic = [
    { label: t('inspect.name'), value: require('path').basename(filePath) },
    { label: t('inspect.size'), value: formatBytes(stat.size) },
    { label: t('inspect.lastModified'), value: stat.mtime.toLocaleString(getLanguage() === 'en' ? 'en-US' : 'fr-FR') },
  ];

  let specific = [];
  if (category === 'image') specific = await inspectImage(fs.readFileSync(filePath), sourceExt);
  else if (category === 'audio' || category === 'video') specific = await inspectAudioOrVideo(filePath, category);
  else if (category === 'data') specific = inspectData(fs.readFileSync(filePath), sourceExt);
  else if (category === 'subtitle') specific = inspectSubtitle(fs.readFileSync(filePath), sourceExt);
  else if (category === 'document') specific = inspectPdf(fs.readFileSync(filePath));
  else if (category === 'archive') specific = inspectZip(fs.readFileSync(filePath));

  return [...generic, ...specific];
}

const BYTE_UNITS = { fr: ['o', 'Ko', 'Mo', 'Go'], en: ['B', 'KB', 'MB', 'GB'] };

function formatBytes(bytes) {
  const units = BYTE_UNITS[getLanguage()] || BYTE_UNITS.fr;
  if (bytes < 1024) return `${bytes} ${units[0]}`;
  let value = bytes / 1024;
  let unitIndex = 1;
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }
  return `${value.toFixed(value < 10 ? 1 : 0)} ${units[unitIndex]}`;
}

module.exports = { inspectFile };
