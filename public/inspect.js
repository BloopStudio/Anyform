/**
 * Inspecteur : lit les propriétés d'un fichier (dimensions, durée, nombre de lignes...)
 * sans le modifier ni produire de fichier de sortie. Volontairement léger : contrairement
 * au Convertisseur/Compresseur, ça n'a pas besoin de charger ffmpeg.wasm — la durée et la
 * résolution audio/vidéo viennent des métadonnées natives du navigateur
 * (`<audio>`/`<video>`, événement `loadedmetadata`), pas d'un décodage complet du fichier.
 */

/**
 * Formate une durée en secondes en "m:ss" affichable, ou un libellé "inconnue" si la valeur
 * n'est pas finie (durée non disponible pour ce fichier).
 */
function formatDuration(seconds) {
  if (!Number.isFinite(seconds)) return t('inspect.durationUnknown');
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

/**
 * Formate un timestamp en date/heure locale, dans le format propre à la langue active.
 */
function formatDate(timestamp) {
  return new Date(timestamp).toLocaleString(getLanguage() === 'en' ? 'en-US' : 'fr-FR');
}

// Débit moyen en kbps (taille du fichier / durée) : approximatif dès qu'il y a un
// conteneur, mais suffisant pour donner un ordre de grandeur. null si la durée n'est pas
// exploitable (fichier sans métadonnée de durée valide) — utilisé par inspectAudio et
// inspectVideo, tous deux basés sur les métadonnées natives lues par readMediaMetadata.
function averageBitrateItem(fileSize, duration) {
  if (!Number.isFinite(duration) || duration <= 0) return null;
  const kbps = Math.round((fileSize * 8) / duration / 1000);
  return { label: t('inspect.avgBitrate'), value: `${kbps} kbps` };
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

/**
 * Plus grand commun diviseur (Euclide), utilisé pour réduire un ratio largeur/hauteur à sa
 * forme la plus simple (ex. 1920/1080 -> 16:9).
 */
function gcd(a, b) {
  return b === 0 ? a : gcd(b, a % b);
}

/**
 * Formate des dimensions en ratio simplifié affichable ("16:9").
 */
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

/**
 * Lit une chaîne ASCII terminée par un octet nul (type EXIF 2) depuis un DataView.
 */
function readExifAscii(view, offset, size) {
  let out = '';
  for (let i = 0; i < size - 1; i++) {
    const c = view.getUint8(offset + i);
    if (c === 0) break;
    out += String.fromCharCode(c);
  }
  return out;
}

/**
 * Lit une valeur rationnelle EXIF (numérateur/dénominateur, 8 octets) et retourne le
 * quotient décimal (0 si le dénominateur est nul, pour éviter une division par zéro).
 */
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

/**
 * Parcourt le sous-IFD GPS d'un bloc EXIF et retourne la position en degrés décimaux
 * (latitude/longitude signées selon les références N/S/E/W), ou null si absente/incomplète.
 */
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

/**
 * Convertit une date EXIF ("YYYY:MM:DD HH:mm:ss") en date/heure locale formatée, ou null si
 * la chaîne ne correspond pas au format attendu.
 */
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

/**
 * Convertit les tags EXIF bruts (lus par readExif) en liste de {label, value} affichable,
 * en ne gardant que les champs présents et en les mettant en forme (ouverture "f/x.x",
 * temps d'exposition en fraction, etc.).
 */
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

/**
 * Inspecte un fichier image et retourne ses propriétés spécifiques (dimensions, ratio,
 * transparence, EXIF pour les JPEG...), en déléguant aux inspecteurs dédiés pour les
 * formats structurellement différents (TIFF, ICO) et en traitant le SVG à part (pas de
 * dimensions en pixels garanties).
 */
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

/**
 * Inspecte un PDF (version, nombre de pages, métadonnées du dictionnaire /Info, chiffrement,
 * présence probable de texte sélectionnable) sans dépendance type pdf.js — mêmes techniques
 * de lecture directe que le reste du fichier (TIFF/ICO/ZIP/fonts).
 */
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

/**
 * Décode une chaîne littérale PDF ("(...)") en résolvant ses échappements (\n, \r, \t,
 * parenthèses, antislash, séquences octales) — l'inverse de l'encodage utilisé pour écrire
 * ces valeurs dans le fichier.
 */
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

/**
 * Décode une chaîne hexadécimale PDF ("<...>") en la chaîne d'octets correspondante.
 */
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

/**
 * Cherche un champ du dictionnaire /Info du PDF (ex. "Title", "Author") sous sa forme
 * littérale ou hexadécimale, et retourne sa valeur décodée en texte — null si absent.
 */
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

/**
 * Inspecte une archive ZIP (nombre de fichiers/dossiers, tailles compressée/décompressée,
 * taux de compression, type détecté, liste des fichiers) en lisant directement sa structure
 * binaire (EOCD puis répertoire central), avec prise en charge de ZIP64 pour les grosses
 * archives.
 */
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

/**
 * Traduit un nombre de canaux audio en libellé lisible ("Mono", "Stéréo", ou "N canaux").
 */
function channelsLabel(n) {
  if (n === 1) return t('inspect.mono');
  if (n === 2) return t('inspect.stereo');
  return t('inspect.channelsN', { n });
}

// Décode un texte de frame ID3 selon son octet d'encodage (premier octet de la frame) :
// 0 = Latin-1, 1 = UTF-16 avec BOM, 2 = UTF-16BE sans BOM, 3 = UTF-8.
function id3DecodeText(bytes, encoding) {
  let text;
  if (encoding === 1) {
    const hasBom = bytes.length >= 2 && ((bytes[0] === 0xff && bytes[1] === 0xfe) || (bytes[0] === 0xfe && bytes[1] === 0xff));
    const little = !hasBom || bytes[0] === 0xff;
    text = new TextDecoder(little ? 'utf-16le' : 'utf-16be').decode(hasBom ? bytes.slice(2) : bytes);
  } else if (encoding === 2) {
    text = new TextDecoder('utf-16be').decode(bytes);
  } else if (encoding === 3) {
    text = new TextDecoder('utf-8').decode(bytes);
  } else {
    text = new TextDecoder('latin1').decode(bytes);
  }
  return text.replace(/ +$/, '').trim();
}

/**
 * Lit un entier "syncsafe" ID3v2 (4 octets, seuls les 7 bits bas de chaque octet sont
 * utilisés — évite qu'une taille de tag ne ressemble par accident à un octet de
 * synchronisation MP3) et le recompose en entier normal.
 */
function id3ReadSyncsafeInt(view, offset) {
  return (view.getUint8(offset) << 21) | (view.getUint8(offset + 1) << 14) | (view.getUint8(offset + 2) << 7) | view.getUint8(offset + 3);
}

// Parcourt les frames ID3v2 (v2.3/v2.4 — la grande majorité des MP3 actuels ; v2.2, plus
// ancienne et rare avec ses ID de 3 caractères, n'est volontairement pas gérée). Ne lit que
// les frames texte utiles (titre, artiste, album, année, genre) plus la présence d'une
// pochette (APIC), sans extraire l'image elle-même.
function id3ParseV2(buffer) {
  if (buffer.byteLength < 10) return null;
  const view = new DataView(buffer);
  if (String.fromCharCode(view.getUint8(0), view.getUint8(1), view.getUint8(2)) !== 'ID3') return null;
  const majorVersion = view.getUint8(3);
  const tagSize = id3ReadSyncsafeInt(view, 6);
  const end = Math.min(10 + tagSize, buffer.byteLength);

  const tags = {};
  let offset = 10;
  while (offset + 10 <= end) {
    const id = String.fromCharCode(view.getUint8(offset), view.getUint8(offset + 1), view.getUint8(offset + 2), view.getUint8(offset + 3));
    if (id === '\0\0\0\0') break;
    const frameSize = majorVersion >= 4 ? id3ReadSyncsafeInt(view, offset + 4) : view.getUint32(offset + 4, false);
    const dataStart = offset + 10;
    if (frameSize <= 0 || dataStart + frameSize > buffer.byteLength) break;
    const frameBytes = new Uint8Array(buffer, dataStart, frameSize);

    if (id[0] === 'T' && id !== 'TXXX' && frameBytes.length > 1) {
      tags[id] = id3DecodeText(frameBytes.slice(1), frameBytes[0]);
    } else if (id === 'APIC' && frameBytes.length > 1) {
      let p = 1;
      let mime = '';
      while (p < frameBytes.length && frameBytes[p] !== 0) { mime += String.fromCharCode(frameBytes[p]); p++; }
      tags.__coverMime = mime || 'image/*';
    }
    offset = dataStart + frameSize;
  }
  return tags;
}

// Repli ID3v1 (128 derniers octets, format fixe) pour les MP3 sans ID3v2 ou avec des champs
// manquants — ancien mais encore présent, notamment sur de vieux fichiers.
function id3ParseV1(buffer) {
  if (buffer.byteLength < 128) return null;
  const tail = new Uint8Array(buffer, buffer.byteLength - 128, 128);
  if (String.fromCharCode(tail[0], tail[1], tail[2]) !== 'TAG') return null;
  const field = (start, len) => new TextDecoder('latin1').decode(tail.slice(start, start + len)).replace(/ +$/, '').trim();
  return { TIT2: field(3, 30), TPE1: field(33, 30), TALB: field(63, 30), TYER: field(93, 4) };
}

/**
 * Lit les tags ID3 (v2 en priorité, repli sur v1) d'un MP3 et retourne les champs présents
 * (titre, artiste, album, année, genre, pochette) en liste {label, value} affichable.
 */
async function inspectId3Items(file) {
  const buffer = await file.arrayBuffer();
  const v2 = id3ParseV2(buffer) || {};
  const v1 = id3ParseV1(buffer) || {};
  const items = [];
  const title = v2.TIT2 || v1.TIT2;
  const artist = v2.TPE1 || v1.TPE1;
  const album = v2.TALB || v1.TALB;
  const year = v2.TYER || v2.TDRC || v1.TYER;
  if (title) items.push({ label: t('inspect.id3.title'), value: title });
  if (artist) items.push({ label: t('inspect.id3.artist'), value: artist });
  if (album) items.push({ label: t('inspect.id3.album'), value: album });
  if (year) items.push({ label: t('inspect.id3.year'), value: year });
  if (v2.TCON) items.push({ label: t('inspect.id3.genre'), value: v2.TCON });
  if (v2.__coverMime) items.push({ label: t('inspect.id3.cover'), value: t('inspect.id3.coverPresent', { mime: v2.__coverMime }) });
  return items;
}

/**
 * Inspecte un fichier audio : durée et débit moyen (métadonnées natives du navigateur),
 * canaux/fréquence d'échantillonnage (décodage Web Audio), tags ID3 pour les MP3.
 */
async function inspectAudio(file) {
  const meta = await readMediaMetadata(file, 'audio');
  const items = [{ label: t('inspect.duration'), value: formatDuration(meta.duration) }];
  const bitrate = averageBitrateItem(file.size, meta.duration);
  if (bitrate) items.push(bitrate);
  const signal = await readAudioSignalInfo(file);
  if (signal) {
    items.push({ label: t('inspect.channels'), value: channelsLabel(signal.channels) });
    items.push({ label: t('inspect.sampleRate'), value: `${signal.sampleRate} Hz` });
  }
  if (extensionOf(file) === 'mp3') items.push(...(await inspectId3Items(file)));
  return items;
}

const MP4_CODEC_NAMES = {
  avc1: 'H.264 (AVC)',
  avc3: 'H.264 (AVC)',
  hev1: 'H.265 (HEVC)',
  hvc1: 'H.265 (HEVC)',
  vp09: 'VP9',
  av01: 'AV1',
  mp4v: 'MPEG-4 Visual',
};

// Parcourt les box ISO-BMFF (moov > trak > mdia > minf > stbl > stsd) pour trouver le codec
// vidéo — sans décoder aucune image, juste la structure du conteneur. Ne cible que la piste
// dont le handler (mdia > hdlr) vaut "vide" : un stsd existe aussi pour la piste audio, avec
// un fourcc différent, qu'on doit explicitement éviter de retourner par erreur.
function findMp4VideoCodec(buffer) {
  const view = new DataView(buffer);

  // Découpe une plage d'octets en box ISO-BMFF de premier niveau (taille 4 octets, ou taille
  // étendue 64 bits si la taille classique vaut 1 — "largebox").
  function readBoxes(start, end) {
    const boxes = [];
    let offset = start;
    while (offset + 8 <= end) {
      let size = view.getUint32(offset, false);
      const type = String.fromCharCode(view.getUint8(offset + 4), view.getUint8(offset + 5), view.getUint8(offset + 6), view.getUint8(offset + 7));
      let headerSize = 8;
      if (size === 1) {
        if (offset + 16 > end) break;
        size = view.getUint32(offset + 8, false) * 2 ** 32 + view.getUint32(offset + 12, false);
        headerSize = 16;
      }
      if (size < headerSize) break;
      boxes.push({ type, start: offset + headerSize, end: offset + size });
      offset += size;
    }
    return boxes;
  }

  const findBox = (boxes, type) => boxes.find((b) => b.type === type);

  const moov = findBox(readBoxes(0, buffer.byteLength), 'moov');
  if (!moov) return null;
  for (const trak of readBoxes(moov.start, moov.end).filter((b) => b.type === 'trak')) {
    const mdia = findBox(readBoxes(trak.start, trak.end), 'mdia');
    if (!mdia) continue;
    const mdiaBoxes = readBoxes(mdia.start, mdia.end);
    const hdlr = findBox(mdiaBoxes, 'hdlr');
    if (!hdlr || hdlr.end - hdlr.start < 12) continue;
    const handlerType = String.fromCharCode(view.getUint8(hdlr.start + 8), view.getUint8(hdlr.start + 9), view.getUint8(hdlr.start + 10), view.getUint8(hdlr.start + 11));
    if (handlerType !== 'vide') continue;
    const minf = findBox(mdiaBoxes, 'minf');
    const stbl = minf && findBox(readBoxes(minf.start, minf.end), 'stbl');
    const stsd = stbl && findBox(readBoxes(stbl.start, stbl.end), 'stsd');
    if (!stsd) continue;
    const entryOffset = stsd.start + 8; // version(1)+flags(3)+entryCount(4), puis size(4)+fourcc(4) de la 1ère entrée
    if (entryOffset + 8 > stsd.end) continue;
    return String.fromCharCode(view.getUint8(entryOffset + 4), view.getUint8(entryOffset + 5), view.getUint8(entryOffset + 6), view.getUint8(entryOffset + 7));
  }
  return null;
}

/**
 * Inspecte un fichier vidéo : durée, résolution et ratio (métadonnées natives du
 * navigateur), débit moyen, et codec vidéo pour les conteneurs ISO-BMFF (MP4/MOV).
 */
async function inspectVideo(file) {
  const meta = await readMediaMetadata(file, 'video');
  const items = [
    { label: t('inspect.duration'), value: formatDuration(meta.duration) },
    { label: t('inspect.resolution'), value: `${meta.width} × ${meta.height} px` },
  ];
  if (meta.width && meta.height) {
    items.push({ label: t('inspect.aspectRatio'), value: aspectRatioLabel(meta.width, meta.height) });
  }
  const bitrate = averageBitrateItem(file.size, meta.duration);
  if (bitrate) items.push(bitrate);
  // Limité aux conteneurs ISO-BMFF (MP4/MOV, même famille de box) : WebM/MKV/AVI/FLV/OGV
  // utiliseraient un tout autre format de conteneur (EBML pour WebM/MKV notamment), non
  // couvert ici — le champ est simplement omis pour ces formats plutôt que d'échouer.
  const ext = extensionOf(file);
  if (ext === 'mp4' || ext === 'mov') {
    try {
      const codec = findMp4VideoCodec(await file.arrayBuffer());
      if (codec) items.push({ label: t('inspect.videoCodec'), value: MP4_CODEC_NAMES[codec] || codec });
    } catch {
      // Structure de conteneur inattendue : on n'affiche juste pas le codec plutôt que
      // de faire planter le reste de l'inspection.
    }
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

/**
 * Inspecte un fichier de données tabulaires : feuilles, nombre de lignes/colonnes, en-têtes
 * et type dominant de chaque colonne (sur la première feuille du classeur).
 */
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

/**
 * Compte les cues dont le débit de lecture dépasse MAX_READABLE_WPM mots/minute.
 */
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

/**
 * Inspecte un fichier de sous-titres : nombre de cues, premier/dernier timecode, plage
 * couverte, et deux indicateurs qualité (chevauchements, cues trop rapides à lire).
 */
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

const SFNT_VERSION_OTTO = 0x4f54544f; // 'OTTO' : contours PostScript/CFF plutôt que TrueType

// Table des index de table sfnt (TTF/OTF) : 12 octets d'en-tête (version + nombre de
// tables...) puis un enregistrement de 16 octets par table (tag, checksum, offset, taille).
function readSfntTables(view, base) {
  const numTables = view.getUint16(base + 4, false);
  const tables = {};
  for (let i = 0; i < numTables; i++) {
    const rec = base + 12 + i * 16;
    const tag = String.fromCharCode(view.getUint8(rec), view.getUint8(rec + 1), view.getUint8(rec + 2), view.getUint8(rec + 3));
    tables[tag] = { offset: view.getUint32(rec + 8, false), length: view.getUint32(rec + 12, false) };
  }
  return tables;
}

// Lit le nom de famille (nameID 1) et le sous-style (nameID 2) dans la table 'name' —
// préfère la plate-forme Windows (3, Unicode BMP, encodé en UTF-16BE) si présente, sinon
// prend la première entrée trouvée (souvent Macintosh, en Latin-1).
function readFontNameTable(view, buffer, tableOffset) {
  const count = view.getUint16(tableOffset + 2, false);
  const stringAreaOffset = tableOffset + view.getUint16(tableOffset + 4, false);
  const found = {};
  const foundWin = {};
  for (let i = 0; i < count; i++) {
    const rec = tableOffset + 6 + i * 12;
    const platformID = view.getUint16(rec, false);
    const nameID = view.getUint16(rec + 6, false);
    if (nameID !== 1 && nameID !== 2) continue;
    const length = view.getUint16(rec + 8, false);
    const strOffset = view.getUint16(rec + 10, false);
    const bytes = new Uint8Array(buffer, stringAreaOffset + strOffset, length);
    const text = (platformID === 3 || platformID === 0) ? new TextDecoder('utf-16be').decode(bytes) : new TextDecoder('latin1').decode(bytes);
    if (!found[nameID]) found[nameID] = text;
    if (platformID === 3 && !foundWin[nameID]) foundWin[nameID] = text;
  }
  return { family: foundWin[1] || found[1] || null, subfamily: foundWin[2] || found[2] || null };
}

/**
 * Construit la liste {label, value} commune aux polices SFNT (TTF/OTF) et WOFF, à partir
 * des tables déjà décodées : format, contours, famille (table 'name'), nombre de glyphes
 * (table 'maxp'), nombre de tables.
 */
function fontItemsFromTables(view, buffer, tables, formatLabel, outlineFormat) {
  const items = [
    { label: t('inspect.font.format'), value: formatLabel },
    { label: t('inspect.font.outlineFormat'), value: outlineFormat },
  ];
  if (tables.name) {
    const { family, subfamily } = readFontNameTable(view, buffer, tables.name.offset);
    if (family) items.push({ label: t('inspect.font.family'), value: subfamily ? `${family} (${subfamily})` : family });
  }
  if (tables.maxp) items.push({ label: t('inspect.font.glyphCount'), value: String(view.getUint16(tables.maxp.offset + 4, false)) });
  items.push({ label: t('inspect.font.tables'), value: String(Object.keys(tables).length) });
  return items;
}

/**
 * Inspecte une police SFNT directe (TTF/OTF, pas de compression WOFF/WOFF2) en lisant sa
 * version pour distinguer contours TrueType/CFF, puis ses tables.
 */
function inspectSfntFont(buffer) {
  const view = new DataView(buffer);
  const version = view.getUint32(0, false);
  const isCff = version === SFNT_VERSION_OTTO;
  const tables = readSfntTables(view, 0);
  return fontItemsFromTables(view, buffer, tables, isCff ? 'OpenType' : 'TrueType', isCff ? 'CFF' : 'TrueType');
}

// Décompresse un flux zlib (RFC 1950 — c'est le format "deflate" du Streams API du
// navigateur, à ne pas confondre avec "deflate-raw"/RFC 1951) : format utilisé par les
// tables WOFF individuellement compressées.
async function inflateZlib(bytes) {
  const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('deflate'));
  return new Response(stream).arrayBuffer();
}

// WOFF : header fixe de 44 octets, puis un répertoire de tables de 20 octets chacune (tag,
// offset, taille compressée, taille d'origine). Chaque table est individuellement compressée
// en zlib (sauf si taille compressée = taille d'origine, auquel cas stockée telle quelle) —
// on ne décompresse que les tables utiles (name, maxp), pas la police entière.
async function inspectWoffFont(buffer) {
  const view = new DataView(buffer);
  const flavor = view.getUint32(4, false);
  const numTables = view.getUint16(12, false);
  const dir = {};
  for (let i = 0; i < numTables; i++) {
    const rec = 44 + i * 20;
    const tag = String.fromCharCode(view.getUint8(rec), view.getUint8(rec + 1), view.getUint8(rec + 2), view.getUint8(rec + 3));
    dir[tag] = { offset: view.getUint32(rec + 4, false), compLength: view.getUint32(rec + 8, false), origLength: view.getUint32(rec + 12, false) };
  }

  // Extrait et décompresse (si besoin) une table WOFF par son tag, ou null si absente.
  async function extractTable(tag) {
    const entry = dir[tag];
    if (!entry) return null;
    if (entry.compLength >= entry.origLength) return buffer.slice(entry.offset, entry.offset + entry.origLength);
    return inflateZlib(new Uint8Array(buffer, entry.offset, entry.compLength));
  }

  const items = [
    { label: t('inspect.font.format'), value: 'WOFF' },
    { label: t('inspect.font.outlineFormat'), value: flavor === SFNT_VERSION_OTTO ? 'CFF' : 'TrueType' },
    { label: t('inspect.font.tables'), value: String(numTables) },
  ];

  const nameBuf = await extractTable('name');
  if (nameBuf) {
    const { family, subfamily } = readFontNameTable(new DataView(nameBuf), nameBuf, 0);
    if (family) items.push({ label: t('inspect.font.family'), value: subfamily ? `${family} (${subfamily})` : family });
  }
  const maxpBuf = await extractTable('maxp');
  if (maxpBuf) items.push({ label: t('inspect.font.glyphCount'), value: String(new DataView(maxpBuf).getUint16(4, false)) });

  return items;
}

// WOFF2 compresse l'intégralité de la police d'un bloc en Brotli (pas table par table comme
// WOFF), et réorganise même certaines tables (glyf/loca) pour mieux compresser — décoder ça
// sans une vraie dépendance WOFF2 serait un morceau largement plus gros que le reste de
// l'Inspecteur. On se limite donc aux infos lisibles dans l'en-tête, en clair.
function inspectWoff2Font(buffer) {
  const view = new DataView(buffer);
  const flavor = view.getUint32(4, false);
  return [
    { label: t('inspect.font.format'), value: 'WOFF2' },
    { label: t('inspect.font.outlineFormat'), value: flavor === SFNT_VERSION_OTTO ? 'CFF' : 'TrueType' },
    { label: t('inspect.font.tables'), value: String(view.getUint16(12, false)) },
    { label: t('inspect.font.note'), value: t('inspect.font.woff2LimitedNote') },
  ];
}

/**
 * Inspecte un fichier de police en dispatchant sur le bon décodeur selon sa signature
 * binaire (WOFF, WOFF2, ou SFNT direct pour TTF/OTF).
 */
async function inspectFont(file) {
  const buffer = await file.arrayBuffer();
  if (buffer.byteLength < 4) return [];
  const signature = new DataView(buffer).getUint32(0, false);
  if (signature === 0x774f4646) return inspectWoffFont(buffer); // 'wOFF'
  if (signature === 0x774f4632) return inspectWoff2Font(buffer); // 'wOF2'
  return inspectSfntFont(buffer); // sfnt direct : TTF (0x00010000/'true') ou OTF ('OTTO')
}

/**
 * Inspecte un fichier et retourne la liste de ses propriétés (label/valeur), en plus des
 * informations génériques communes à tous les fichiers (nom, taille, dernière modification).
 * @param {File} file
 * @param {'image'|'data'|'audio'|'video'|'subtitle'|'document'|'archive'|'font'} category
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
  else if (category === 'font') specific = await inspectFont(file);

  return [...generic, ...specific];
}
