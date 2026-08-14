/**
 * Inspecteur : lit les propriétés d'un fichier (dimensions, durée, nombre de lignes...)
 * sans le modifier ni produire de fichier de sortie. Volontairement léger : contrairement
 * au Convertisseur/Compresseur, ça n'a pas besoin de charger ffmpeg.wasm — la durée et la
 * résolution audio/vidéo viennent des métadonnées natives du navigateur
 * (`<audio>`/`<video>`, événement `loadedmetadata`), pas d'un décodage complet du fichier.
 */

function formatDuration(seconds) {
  if (!Number.isFinite(seconds)) return t('inspect.durationUnknown');
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

function formatDate(timestamp) {
  return new Date(timestamp).toLocaleString(getLanguage() === 'en' ? 'en-US' : 'fr-FR');
}

// Charge un fichier audio/vidéo dans un élément média caché le temps de lire ses
// métadonnées (durée, dimensions pour la vidéo), puis libère l'URL objet créée.
function readMediaMetadata(file, tag) {
  return new Promise((resolve, reject) => {
    const el = document.createElement(tag);
    const url = URL.createObjectURL(file);
    el.preload = 'metadata';
    el.src = url;
    el.onloadedmetadata = () => {
      const meta = { duration: el.duration };
      if (tag === 'video') {
        meta.width = el.videoWidth;
        meta.height = el.videoHeight;
      }
      URL.revokeObjectURL(url);
      resolve(meta);
    };
    el.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error(t('error.mediaUnreadable')));
    };
  });
}

// Échantillonne l'image sur un petit canvas (32×32, coût constant quelle que soit la taille
// d'origine) et regarde si un pixel a un canal alpha < 255 — suffisant pour détecter la
// transparence sans analyser l'image en pleine résolution.
function detectAlpha(img) {
  const size = 32;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(img, 0, 0, size, size);
  const data = ctx.getImageData(0, 0, size, size).data;
  for (let i = 3; i < data.length; i += 4) {
    if (data[i] < 255) return true;
  }
  return false;
}

function gcd(a, b) {
  return b === 0 ? a : gcd(b, a % b);
}

function aspectRatioLabel(width, height) {
  const d = gcd(width, height) || 1;
  return `${width / d}:${height / d}`;
}

// Lit uniquement les tags TIFF nécessaires (dimensions, profondeur, nombre de pages) via
// UTIF.decode() — pas de décodage des pixels, contrairement à UTIF.decodeImage() utilisé
// pour l'export : on n'a besoin que des métadonnées ici.
async function inspectTiff(file) {
  const buffer = await file.arrayBuffer();
  const ifds = UTIF.decode(buffer);
  const items = [];
  const first = ifds[0] || {};
  const width = first.t256 ? first.t256[0] : null;
  const height = first.t257 ? first.t257[0] : null;
  if (width && height) {
    items.push({ label: t('inspect.dimensions'), value: `${width} × ${height} px` });
    items.push({ label: t('inspect.ratio'), value: (width / height).toFixed(3) });
  }
  if (first.t258) items.push({ label: t('inspect.bitDepth'), value: `${first.t258[0]}-bit` });
  if (ifds.length > 1) items.push({ label: t('inspect.tiffPages'), value: String(ifds.length) });
  // Un fichier TIFF est déjà structuré comme un bloc EXIF (même format d'IFD) : le header
  // TIFF commence dès l'octet 0, pas besoin de le chercher comme pour un JPEG.
  items.push(...exifItems(readExif(buffer, 0)));
  return items;
}

const EXIF_TYPE_SIZES = { 1: 1, 2: 1, 3: 2, 4: 4, 5: 8, 6: 1, 7: 1, 8: 2, 9: 4, 10: 8, 11: 4, 12: 8 };

function readExifAscii(view, offset, size) {
  let out = '';
  for (let i = 0; i < size - 1; i++) {
    const c = view.getUint8(offset + i);
    if (c === 0) break;
    out += String.fromCharCode(c);
  }
  return out;
}

function readExifRational(view, offset, littleEndian) {
  const num = view.getUint32(offset, littleEndian);
  const den = view.getUint32(offset + 4, littleEndian);
  return den !== 0 ? num / den : 0;
}

// Parcourt un IFD TIFF/EXIF (2 octets de nombre d'entrées, puis 12 octets par entrée) et
// retourne les tags demandés (tagNames: {tag: nomDeSortie}), plus les offsets des sous-IFD
// Exif (0x8769) et GPS (0x8825) s'ils sont présents.
function readExifIfd(view, tiffStart, ifdOffset, littleEndian, tagNames) {
  const out = {};
  let subExifOffset = null;
  let subGpsOffset = null;
  const count = view.getUint16(tiffStart + ifdOffset, littleEndian);
  for (let i = 0; i < count; i++) {
    const entryOff = tiffStart + ifdOffset + 2 + i * 12;
    const tag = view.getUint16(entryOff, littleEndian);
    const type = view.getUint16(entryOff + 2, littleEndian);
    const valueCount = view.getUint32(entryOff + 4, littleEndian);
    const totalSize = (EXIF_TYPE_SIZES[type] || 1) * valueCount;
    const dataOffset = totalSize <= 4 ? entryOff + 8 : tiffStart + view.getUint32(entryOff + 8, littleEndian);

    if (tag === 0x8769) { subExifOffset = view.getUint32(entryOff + 8, littleEndian); continue; }
    if (tag === 0x8825) { subGpsOffset = view.getUint32(entryOff + 8, littleEndian); continue; }

    const name = tagNames[tag];
    if (!name) continue;
    if (type === 2) out[name] = readExifAscii(view, dataOffset, totalSize);
    else if (type === 5 || type === 10) out[name] = readExifRational(view, dataOffset, littleEndian);
    else if (type === 3) out[name] = view.getUint16(dataOffset, littleEndian);
    else if (type === 4 || type === 9) out[name] = view.getUint32(dataOffset, littleEndian);
    else if (type === 1) out[name] = view.getUint8(dataOffset);
  }
  return { tags: out, subExifOffset, subGpsOffset };
}

function readExifGps(view, tiffStart, gpsOffset, littleEndian) {
  const count = view.getUint16(tiffStart + gpsOffset, littleEndian);
  let latRef, lonRef, lat, lon;
  for (let i = 0; i < count; i++) {
    const entryOff = tiffStart + gpsOffset + 2 + i * 12;
    const tag = view.getUint16(entryOff, littleEndian);
    if (tag === 0x0001) latRef = String.fromCharCode(view.getUint8(entryOff + 8));
    else if (tag === 0x0003) lonRef = String.fromCharCode(view.getUint8(entryOff + 8));
    else if (tag === 0x0002 || tag === 0x0004) {
      // GPSLatitude/GPSLongitude : 3 RATIONAL (degrés, minutes, secondes), toujours en dehors
      // de l'entrée (24 octets > 4) donc son offset pointe vers un vrai offset dans le fichier.
      const off = tiffStart + view.getUint32(entryOff + 8, littleEndian);
      const deg = readExifRational(view, off, littleEndian);
      const min = readExifRational(view, off + 8, littleEndian);
      const sec = readExifRational(view, off + 16, littleEndian);
      const decimal = deg + min / 60 + sec / 3600;
      if (tag === 0x0002) lat = decimal; else lon = decimal;
    }
  }
  if (lat === undefined || lon === undefined) return null;
  return { lat: latRef === 'S' ? -lat : lat, lon: lonRef === 'W' ? -lon : lon };
}

// Lit les tags EXIF utiles (appareil, date de prise de vue, réglages, GPS) directement dans
// la structure TIFF/EXIF, sans dépendance externe — même approche que le parsing ICO/TIFF
// déjà en place : on ne lit que les octets nécessaires, pas de décodage d'image complet.
// `tiffStart` est l'offset du header TIFF ("II"/"MM" + 42) dans le buffer : 0 pour un fichier
// TIFF, l'offset après "Exif\0\0" pour le bloc EXIF embarqué dans un JPEG.
function readExif(buffer, tiffStart) {
  if (tiffStart === null || tiffStart + 8 > buffer.byteLength) return null;
  const view = new DataView(buffer);
  const byteOrder = view.getUint16(tiffStart, false);
  if (byteOrder !== 0x4949 && byteOrder !== 0x4d4d) return null;
  const littleEndian = byteOrder === 0x4949;
  const ifd0Offset = view.getUint32(tiffStart + 4, littleEndian);

  const { tags: ifd0Tags, subExifOffset, subGpsOffset } = readExifIfd(view, tiffStart, ifd0Offset, littleEndian, {
    0x010f: 'make',
    0x0110: 'model',
    0x0112: 'orientation',
    0x0132: 'dateTime',
  });

  let exifTags = {};
  if (subExifOffset) {
    exifTags = readExifIfd(view, tiffStart, subExifOffset, littleEndian, {
      0x9003: 'dateTimeOriginal',
      0x829a: 'exposureTime',
      0x829d: 'fNumber',
      0x8827: 'iso',
      0x920a: 'focalLength',
      0xa434: 'lensModel',
    }).tags;
  }

  const gps = subGpsOffset ? readExifGps(view, tiffStart, subGpsOffset, littleEndian) : null;
  return { ...ifd0Tags, ...exifTags, gps };
}

function formatExifDateTime(str) {
  const m = /^(\d{4}):(\d{2}):(\d{2})\s+(\d{2}):(\d{2}):(\d{2})/.exec(str || '');
  if (!m) return null;
  const [, y, mo, d, h, mi, s] = m;
  return formatDate(new Date(`${y}-${mo}-${d}T${h}:${mi}:${s}`).getTime());
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

// Cherche le segment APP1 "Exif\0\0" dans les marqueurs JPEG (après le SOI 0xFFD8) et retourne
// l'offset du header TIFF qui suit immédiatement — null si absent (JPEG sans EXIF, ex. capture
// d'écran ou image ré-exportée par un outil qui les a supprimées).
function findJpegExifOffset(view) {
  if (view.byteLength < 4 || view.getUint16(0, false) !== 0xffd8) return null;
  let offset = 2;
  while (offset < view.byteLength - 4) {
    if (view.getUint8(offset) !== 0xff) break;
    const marker = view.getUint8(offset + 1);
    if (marker === 0xd8 || marker === 0xd9 || (marker >= 0xd0 && marker <= 0xd7)) { offset += 2; continue; }
    if (marker === 0xda) break; // Start of Scan : fin des marqueurs, début des données image compressées
    const length = view.getUint16(offset + 2, false);
    if (marker === 0xe1 && offset + 10 <= view.byteLength) {
      const tag = String.fromCharCode(...new Uint8Array(view.buffer, offset + 4, 6));
      if (tag === 'Exif\0\0') return offset + 10;
    }
    offset += 2 + length;
  }
  return null;
}

// Parse l'en-tête ICONDIR (6 octets) + les ICONDIRENTRY (16 octets chacune) directement,
// sans décoder aucune image embarquée — le format expose déjà la liste des tailles en clair.
async function inspectIco(file) {
  const buffer = await file.arrayBuffer();
  const view = new DataView(buffer);
  const count = view.getUint16(4, true);
  const sizes = [];
  for (let i = 0; i < count; i++) {
    const offset = 6 + i * 16;
    const w = view.getUint8(offset) || 256;
    const h = view.getUint8(offset + 1) || 256;
    sizes.push(`${w}×${h}`);
  }
  return [
    { label: t('inspect.icoCount'), value: String(count) },
    { label: t('inspect.icoSizes'), value: sizes.join(', ') },
  ];
}

async function inspectImage(file) {
  const items = [];
  if (isSvgFile(file)) {
    const text = await readFileAsText(file);
    // Un SVG n'a pas forcément de dimensions en pixels (unités relatives, viewBox
    // seul...) : on affiche ce qu'on trouve dans les attributs width/height/viewBox du
    // <svg> racine, sans tenter de le rasteriser juste pour l'inspecter.
    const widthMatch = /width="([\d.]+)/.exec(text);
    const heightMatch = /height="([\d.]+)/.exec(text);
    const viewBoxMatch = /viewBox="([^"]+)"/.exec(text);
    if (widthMatch && heightMatch) items.push({ label: t('inspect.declaredDimensions'), value: `${widthMatch[1]} × ${heightMatch[1]}` });
    if (viewBoxMatch) items.push({ label: 'viewBox', value: viewBoxMatch[1] });
    items.push({ label: t('inspect.type'), value: t('inspect.typeVector') });
    return items;
  }

  const ext = extensionOf(file);
  if (ext === 'tiff' || ext === 'tif') return inspectTiff(file);
  if (ext === 'ico') return inspectIco(file);

  const sourceBlob = isHeicFile(file) ? await heicToPngBlob(file) : file;
  const dataUrl = await readFileAsDataUrl(sourceBlob);
  const img = await loadImage(dataUrl);
  items.push({ label: t('inspect.dimensions'), value: `${img.naturalWidth} × ${img.naturalHeight} px` });
  items.push({ label: t('inspect.ratio'), value: (img.naturalWidth / img.naturalHeight).toFixed(3) });
  items.push({ label: t('inspect.hasAlpha'), value: t(detectAlpha(img) ? 'inspect.yes' : 'inspect.no') });
  if (isHeicFile(file)) items.push({ label: t('inspect.note'), value: t('inspect.heicNote') });
  if (ext === 'jpg' || ext === 'jpeg') {
    const buffer = await file.arrayBuffer();
    const tiffStart = findJpegExifOffset(new DataView(buffer));
    if (tiffStart !== null) items.push(...exifItems(readExif(buffer, tiffStart)));
  }
  return items;
}

async function inspectPdf(file) {
  const buffer = await file.arrayBuffer();
  // Latin-1 : chaque octet devient un caractère, ce qui préserve les offsets binaires exacts
  // (utile pour rester cohérent même à travers des flux compressés) tout en permettant des
  // regex texte sur les parties non compressées du fichier (mots-clés, dictionnaires) — la
  // même logique « lire juste ce qu'il faut » que pour ICO/TIFF, sans dépendance type pdf.js.
  const text = new TextDecoder('latin1').decode(buffer);
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
    items.push({ label: t('inspect.pdf.created'), value: formatDate(creationDate.getTime()) });
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

const ZIP_EOCD_SIG = 0x06054b50;
const ZIP_CD_SIG = 0x02014b50;
const ZIP_EOCD64_LOCATOR_SIG = 0x07064b50;
const ZIP_EOCD64_SIG = 0x06064b50;

// Le commentaire final de l'archive (jusqu'à 65535 octets) peut décaler l'EOCD par rapport à
// la toute fin du fichier : on cherche sa signature en repartant de la fin.
function findZipEocd(view) {
  const start = view.byteLength - 22;
  const minOffset = Math.max(0, start - 65557);
  for (let i = start; i >= minOffset; i--) {
    if (view.getUint32(i, true) === ZIP_EOCD_SIG) return i;
  }
  return -1;
}

async function inspectZip(file) {
  const buffer = await file.arrayBuffer();
  const view = new DataView(buffer);
  const eocdOffset = findZipEocd(view);
  if (eocdOffset === -1) return [{ label: t('inspect.zip.fileCount'), value: t('inspect.zip.invalid') }];

  let entryCount = view.getUint16(eocdOffset + 10, true);
  let cdOffset = view.getUint32(eocdOffset + 16, true);

  // ZIP64 : les champs classiques valent 0xFFFF/0xFFFFFFFF quand l'archive dépasse leurs
  // limites ; les vraies valeurs sont dans l'enregistrement ZIP64 EOCD, localisé juste avant
  // l'EOCD classique via son "locator" (20 octets fixes).
  if (entryCount === 0xffff || cdOffset === 0xffffffff) {
    const locatorOffset = eocdOffset - 20;
    if (locatorOffset >= 0 && view.getUint32(locatorOffset, true) === ZIP_EOCD64_LOCATOR_SIG) {
      const eocd64Offset = Number(view.getBigUint64(locatorOffset + 8, true));
      if (view.getUint32(eocd64Offset, true) === ZIP_EOCD64_SIG) {
        entryCount = Number(view.getBigUint64(eocd64Offset + 32, true));
        cdOffset = Number(view.getBigUint64(eocd64Offset + 48, true));
      }
    }
  }

  const names = [];
  let totalCompressed = 0;
  let totalUncompressed = 0;
  let folderCount = 0;
  const decoder = new TextDecoder('utf-8');
  let offset = cdOffset;
  for (let i = 0; i < entryCount && offset >= 0 && offset + 46 <= buffer.byteLength; i++) {
    if (view.getUint32(offset, true) !== ZIP_CD_SIG) break;
    const compressedSize = view.getUint32(offset + 20, true);
    const uncompressedSize = view.getUint32(offset + 24, true);
    const nameLen = view.getUint16(offset + 28, true);
    const extraLen = view.getUint16(offset + 30, true);
    const commentLen = view.getUint16(offset + 32, true);
    const name = decoder.decode(new Uint8Array(buffer, offset + 46, nameLen));
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

// Décode l'audio via l'API Web Audio (native, pas ffmpeg.wasm) pour lire le nombre de
// canaux et la fréquence d'échantillonnage — des infos que les métadonnées de <audio> ne
// donnent pas. Certains codecs exotiques peuvent échouer à décoder : dans ce cas on garde
// juste durée/débit (déjà lus via <audio>) sans faire planter toute l'inspection.
async function readAudioSignalInfo(file) {
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    const ctx = new AudioCtx();
    try {
      const buffer = await file.arrayBuffer();
      const audioBuffer = await ctx.decodeAudioData(buffer.slice(0));
      return { channels: audioBuffer.numberOfChannels, sampleRate: audioBuffer.sampleRate };
    } finally {
      ctx.close();
    }
  } catch {
    return null;
  }
}

function channelsLabel(n) {
  if (n === 1) return t('inspect.mono');
  if (n === 2) return t('inspect.stereo');
  return t('inspect.channelsN', { n });
}

async function inspectAudio(file) {
  const meta = await readMediaMetadata(file, 'audio');
  const items = [{ label: t('inspect.duration'), value: formatDuration(meta.duration) }];
  if (Number.isFinite(meta.duration) && meta.duration > 0) {
    const kbps = Math.round((file.size * 8) / meta.duration / 1000);
    items.push({ label: t('inspect.avgBitrate'), value: `${kbps} kbps` });
  }
  const signal = await readAudioSignalInfo(file);
  if (signal) {
    items.push({ label: t('inspect.channels'), value: channelsLabel(signal.channels) });
    items.push({ label: t('inspect.sampleRate'), value: `${signal.sampleRate} Hz` });
  }
  return items;
}

async function inspectVideo(file) {
  const meta = await readMediaMetadata(file, 'video');
  const items = [
    { label: t('inspect.duration'), value: formatDuration(meta.duration) },
    { label: t('inspect.resolution'), value: `${meta.width} × ${meta.height} px` },
  ];
  if (meta.width && meta.height) {
    items.push({ label: t('inspect.aspectRatio'), value: aspectRatioLabel(meta.width, meta.height) });
  }
  if (Number.isFinite(meta.duration) && meta.duration > 0) {
    const kbps = Math.round((file.size * 8) / meta.duration / 1000);
    items.push({ label: t('inspect.avgBitrate'), value: `${kbps} kbps` });
  }
  return items;
}

// Devine le type dominant de chaque colonne en échantillonnant jusqu'à 50 lignes de
// données (au-delà, le coût de tout parcourir sur un gros fichier ne changerait rien à la
// pertinence du résultat). Lit les cellules directement dans `sheet` (pas le tableau plat
// de sheet_to_json) : un CSV comme "2020-01-15" est reconnu par SheetJS comme un nombre
// (cell.t === 'n', sans format de date associé puisque le CSV n'a pas de mise en forme) —
// seul cell.w (le texte d'origine formaté) garde encore l'apparence de date à tester.
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

async function inspectData(file) {
  const workbook = await fileToWorkbook(file);
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

async function inspectSubtitle(file) {
  const text = await file.text();
  const ext = extensionOf(file);
  const cues = parseSubtitle(text, ext);
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
 * @param {File} file
 * @param {'image'|'data'|'audio'|'video'|'subtitle'|'document'|'archive'} category
 * @returns {Promise<Array<{label: string, value: string}>>}
 */
async function inspectFile(file, category) {
  const generic = [
    { label: t('inspect.name'), value: file.name },
    { label: t('inspect.size'), value: formatBytes(file.size) },
    { label: t('inspect.lastModified'), value: formatDate(file.lastModified) },
  ];

  let specific = [];
  if (category === 'image') specific = await inspectImage(file);
  else if (category === 'audio') specific = await inspectAudio(file);
  else if (category === 'video') specific = await inspectVideo(file);
  else if (category === 'data') specific = await inspectData(file);
  else if (category === 'subtitle') specific = await inspectSubtitle(file);
  else if (category === 'document') specific = await inspectPdf(file);
  else if (category === 'archive') specific = await inspectZip(file);

  return [...generic, ...specific];
}
