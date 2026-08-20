/**
 * Inspecteur : lit les propriétés d'un fichier (dimensions, durée, nombre de
 * lignes/colonnes, nombre de sous-titres...) sans le modifier. Portage de
 * public/inspect.js (web/desktop/extension) pour le CLI — même répartition par
 * catégorie, mais la durée/résolution audio/vidéo vient de `ffmpeg -i` (parsing de
 * stderr) au lieu des métadonnées natives du navigateur, qui n'existent pas ici.
 */

const fs = require('fs');
const zlib = require('zlib');
const { spawn } = require('child_process');
const sharp = require('sharp');
const ffmpegPath = require('ffmpeg-static');
const { bufferToWorkbook } = require('./data');
const { parseSubtitle } = require('./subtitles');
const XLSX = require('xlsx');
const { isHeicBuffer, decodeHeic, isSvgBuffer, extractPdfObjects } = require('./convert');
const { t, getLanguage } = require('./i18n');

// Formate un nombre de secondes en "M:SS" (pas de format HH:MM:SS : les durées affichées
// ici — médias, plage de sous-titres — dépassent rarement l'heure, et rester simple évite
// un "0:03:45" pour un cas courant).
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
      // Le nom de codec ffmpeg (h264, hevc, vp9, av1...) suit toujours immédiatement
      // "Video: " — capturé ici pour éviter un second appel ffmpeg/ffprobe.
      const videoCodecMatch = /Video:\s*([a-z0-9_]+)/.exec(stderr);
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
        videoCodec: videoCodecMatch ? videoCodecMatch[1] : null,
        sampleRate: audioMatch ? parseInt(audioMatch[1], 10) : null,
        channelLayout: audioMatch ? audioMatch[2] : null,
      });
    });
  });
}

// Noms lisibles pour les codecs les plus courants renvoyés par ffmpeg dans la ligne
// "Video: <codec> ...". Aligné sur MP4_CODEC_NAMES de public/inspect.js (web/desktop/
// extension) pour un libellé cohérent partout, même si la source d'info diffère (ffmpeg
// ici, lecture directe des box ISO-BMFF là-bas).
const VIDEO_CODEC_NAMES = {
  h264: 'H.264 (AVC)',
  hevc: 'H.265 (HEVC)',
  vp9: 'VP9',
  vp8: 'VP8',
  av1: 'AV1',
  mpeg4: 'MPEG-4 Visual',
  theora: 'Theora',
  mjpeg: 'Motion JPEG',
};

// PGCD par l'algorithme d'Euclide, utilisé pour réduire un ratio largeur/hauteur à sa
// forme la plus simple (ex. 1920×1080 -> 16:9).
function gcd(a, b) {
  return b === 0 ? a : gcd(b, a % b);
}

// Réduit des dimensions en ratio d'affichage lisible ("16:9", "4:3"...).
function aspectRatioLabel(width, height) {
  const d = gcd(width, height) || 1;
  return `${width / d}:${height / d}`;
}

// Traduit la disposition de canaux renvoyée par ffmpeg ("mono"/"stereo") en libellé
// localisé ; toute autre valeur (5.1, 7.1...) est affichée telle quelle, ffmpeg n'a pas de
// terme court traduisible pour ces configurations.
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

/**
 * Inspecte un fichier image : cas particuliers SVG (métadonnées dans le XML, pas de
 * décodage raster) et ICO (parsing manuel, voir inspectIco) traités séparément, sinon
 * dimensions/format/alpha lus via sharp (avec décodage HEIC préalable si besoin), puis
 * EXIF ajouté pour les JPEG/TIFF, seuls formats où sharp expose le bloc EXIF brut.
 */
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

// Le byte order TIFF/EXIF (little ou big-endian, voir readExif) s'applique à tous les
// entiers du bloc : ces deux lecteurs évitent de dupliquer le if/else à chaque lecture.
function readU16(buf, offset, littleEndian) {
  return littleEndian ? buf.readUInt16LE(offset) : buf.readUInt16BE(offset);
}

function readU32(buf, offset, littleEndian) {
  return littleEndian ? buf.readUInt32LE(offset) : buf.readUInt32BE(offset);
}

// Lit une chaîne EXIF de type ASCII (type 2), terminée par un octet nul — `size` inclut
// ce terminateur, d'où la boucle jusqu'à size - 1.
function readExifAscii(buf, offset, size) {
  let out = '';
  for (let i = 0; i < size - 1; i++) {
    const c = buf.readUInt8(offset + i);
    if (c === 0) break;
    out += String.fromCharCode(c);
  }
  return out;
}

// Un "rational" EXIF (types 5/10) est stocké comme deux UInt32 (numérateur, dénominateur) —
// utilisé notamment pour l'ouverture (fNumber), le temps d'exposition et les coordonnées GPS.
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

// Lit le sous-IFD GPS (tags 0x0001-0x0004 : référence + valeur pour latitude et longitude,
// chacune stockée en degrés/minutes/secondes) et le convertit en décimal signé (l'hémisphère
// Sud/Ouest étant négatif — d'où le signe appliqué par l'appelant readExif via latRef/lonRef).
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

// Convertit une date EXIF ("YYYY:MM:DD HH:MM:SS", séparateur ':' même pour la partie date)
// en date localisée lisible ; retourne null si la chaîne ne correspond pas au format attendu
// (champ absent ou vide sur certains appareils).
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

// Transforme les tags EXIF bruts lus par readExif en liste de { label, value } affichables,
// en ignorant silencieusement les champs absents (tous optionnels : un appareil peut ne pas
// renseigner l'objectif, le GPS, etc.).
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

// Décode une chaîne littérale PDF ("(...)") : traite les échappements standard (\n, \r, \t,
// parenthèses, antislash) et les échappements octaux (\ddd, 1 à 3 chiffres) définis par le
// spec PDF pour les caractères non imprimables.
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

// Décode une chaîne hexadécimale PDF ("<...>"), l'autre notation de chaîne autorisée par le
// spec en plus des littéraux entre parenthèses (pdfDecodeLiteralString).
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

// Extrait un champ du dictionnaire /Info du PDF (ex. /Title, /Author) par son nom de clé,
// en essayant d'abord la notation littérale puis hexadécimale (un même champ peut être
// écrit dans l'une ou l'autre selon le producteur du PDF), puis décode l'UTF-16 éventuel.
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
  const objects = extractPdfObjects(text).map((o) => o.body);
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

/**
 * Inspecte une archive ZIP en lisant uniquement sa table centrale (central directory) —
 * pas de décompression des fichiers, juste leurs entrées de métadonnées (nom, tailles).
 * Gère aussi le ZIP64 (voir plus bas) et détecte au passage certains formats basés sur ZIP
 * (Office, JAR, EPUB) à partir des noms de fichiers déjà collectés.
 */
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

const SFNT_VERSION_OTTO = 0x4f54544f; // 'OTTO' : contours PostScript/CFF plutôt que TrueType

// Table des index de table sfnt (TTF/OTF) : 12 octets d'en-tête (version + nombre de
// tables...) puis un enregistrement de 16 octets par table (tag, checksum, offset, taille).
function readSfntTables(buffer, base) {
  const numTables = buffer.readUInt16BE(base + 4);
  const tables = {};
  for (let i = 0; i < numTables; i++) {
    const rec = base + 12 + i * 16;
    const tag = buffer.toString('latin1', rec, rec + 4);
    tables[tag] = { offset: buffer.readUInt32BE(rec + 8), length: buffer.readUInt32BE(rec + 12) };
  }
  return tables;
}

// Lit le nom de famille (nameID 1) et le sous-style (nameID 2) dans la table 'name' —
// préfère la plate-forme Windows (3, Unicode BMP, encodé en UTF-16BE) si présente, sinon
// prend la première entrée trouvée (souvent Macintosh, en Latin-1).
function readFontNameTable(buffer, tableOffset) {
  const count = buffer.readUInt16BE(tableOffset + 2);
  const stringAreaOffset = tableOffset + buffer.readUInt16BE(tableOffset + 4);
  const found = {};
  const foundWin = {};
  for (let i = 0; i < count; i++) {
    const rec = tableOffset + 6 + i * 12;
    const platformID = buffer.readUInt16BE(rec);
    const nameID = buffer.readUInt16BE(rec + 6);
    if (nameID !== 1 && nameID !== 2) continue;
    const length = buffer.readUInt16BE(rec + 8);
    const strOffset = buffer.readUInt16BE(rec + 10);
    const start = stringAreaOffset + strOffset;
    const bytes = buffer.subarray(start, start + length);
    const text = platformID === 3 || platformID === 0 ? new TextDecoder('utf-16be').decode(bytes) : new TextDecoder('latin1').decode(bytes);
    if (!found[nameID]) found[nameID] = text;
    if (platformID === 3 && !foundWin[nameID]) foundWin[nameID] = text;
  }
  return { family: foundWin[1] || found[1] || null, subfamily: foundWin[2] || found[2] || null };
}

// Construit la liste d'items affichables commune aux polices sfnt (TTF/OTF) et WOFF, qui
// partagent la même structure de table 'name'/'maxp' une fois leur répertoire de tables lu —
// factorisé ici pour ne pas dupliquer la logique entre inspectSfntFont et inspectWoffFont.
function fontItemsFromTables(buffer, tables, formatLabel, outlineFormat) {
  const items = [
    { label: t('inspect.font.format'), value: formatLabel },
    { label: t('inspect.font.outlineFormat'), value: outlineFormat },
  ];
  if (tables.name) {
    const { family, subfamily } = readFontNameTable(buffer, tables.name.offset);
    if (family) items.push({ label: t('inspect.font.family'), value: subfamily ? `${family} (${subfamily})` : family });
  }
  if (tables.maxp) items.push({ label: t('inspect.font.glyphCount'), value: String(buffer.readUInt16BE(tables.maxp.offset + 4)) });
  items.push({ label: t('inspect.font.tables'), value: String(Object.keys(tables).length) });
  return items;
}

// Inspecte une police au format sfnt direct (TTF/OTF, pas de compression contrairement à
// WOFF/WOFF2) : le premier UInt32 du fichier distingue TrueType (0x00010000) d'OpenType/CFF
// ('OTTO').
function inspectSfntFont(buffer) {
  const version = buffer.readUInt32BE(0);
  const isCff = version === SFNT_VERSION_OTTO;
  const tables = readSfntTables(buffer, 0);
  return fontItemsFromTables(buffer, tables, isCff ? 'OpenType' : 'TrueType', isCff ? 'CFF' : 'TrueType');
}

// WOFF : header fixe de 44 octets, puis un répertoire de tables de 20 octets chacune (tag,
// offset, taille compressée, taille d'origine). Chaque table est individuellement compressée
// en zlib (RFC 1950, sauf si taille compressée = taille d'origine, auquel cas stockée telle
// quelle) — on ne décompresse que les tables utiles (name, maxp), pas la police entière.
function inspectWoffFont(buffer) {
  const flavor = buffer.readUInt32BE(4);
  const numTables = buffer.readUInt16BE(12);
  const dir = {};
  for (let i = 0; i < numTables; i++) {
    const rec = 44 + i * 20;
    const tag = buffer.toString('latin1', rec, rec + 4);
    dir[tag] = { offset: buffer.readUInt32BE(rec + 4), compLength: buffer.readUInt32BE(rec + 8), origLength: buffer.readUInt32BE(rec + 12) };
  }

  function extractTable(tag) {
    const entry = dir[tag];
    if (!entry) return null;
    const raw = buffer.subarray(entry.offset, entry.offset + entry.compLength);
    if (entry.compLength >= entry.origLength) return raw;
    return zlib.inflateSync(raw);
  }

  const items = [
    { label: t('inspect.font.format'), value: 'WOFF' },
    { label: t('inspect.font.outlineFormat'), value: flavor === SFNT_VERSION_OTTO ? 'CFF' : 'TrueType' },
    { label: t('inspect.font.tables'), value: String(numTables) },
  ];

  const nameBuf = extractTable('name');
  if (nameBuf) {
    const { family, subfamily } = readFontNameTable(nameBuf, 0);
    if (family) items.push({ label: t('inspect.font.family'), value: subfamily ? `${family} (${subfamily})` : family });
  }
  const maxpBuf = extractTable('maxp');
  if (maxpBuf) items.push({ label: t('inspect.font.glyphCount'), value: String(maxpBuf.readUInt16BE(4)) });

  return items;
}

// WOFF2 compresse l'intégralité de la police d'un bloc en Brotli (pas table par table comme
// WOFF), et réorganise même certaines tables (glyf/loca) pour mieux compresser — décoder ça
// sans une vraie dépendance WOFF2 serait un morceau largement plus gros que le reste de
// l'Inspecteur. On se limite donc aux infos lisibles dans l'en-tête, en clair.
function inspectWoff2Font(buffer) {
  const flavor = buffer.readUInt32BE(4);
  return [
    { label: t('inspect.font.format'), value: 'WOFF2' },
    { label: t('inspect.font.outlineFormat'), value: flavor === SFNT_VERSION_OTTO ? 'CFF' : 'TrueType' },
    { label: t('inspect.font.tables'), value: String(buffer.readUInt16BE(12)) },
    { label: t('inspect.font.note'), value: t('inspect.font.woff2LimitedNote') },
  ];
}

// Route vers le bon inspecteur de police selon les 4 premiers octets, qui portent une
// signature différente pour chaque conteneur (sfnt direct n'a pas de signature dédiée : il
// gagne par défaut une fois WOFF/WOFF2 exclus).
function inspectFont(buffer) {
  if (buffer.length < 4) return [];
  const signature = buffer.readUInt32BE(0);
  if (signature === 0x774f4646) return inspectWoffFont(buffer); // 'wOFF'
  if (signature === 0x774f4632) return inspectWoff2Font(buffer); // 'wOF2'
  return inspectSfntFont(buffer); // sfnt direct : TTF (0x00010000/'true') ou OTF ('OTTO')
}

// Décode un texte de frame ID3 selon son octet d'encodage (premier octet de la frame) :
// 0 = Latin-1, 1 = UTF-16 avec BOM, 2 = UTF-16BE sans BOM, 3 = UTF-8.
function id3DecodeText(bytes, encoding) {
  let text;
  if (encoding === 1) {
    const hasBom = bytes.length >= 2 && ((bytes[0] === 0xff && bytes[1] === 0xfe) || (bytes[0] === 0xfe && bytes[1] === 0xff));
    const little = !hasBom || bytes[0] === 0xff;
    text = new TextDecoder(little ? 'utf-16le' : 'utf-16be').decode(hasBom ? bytes.subarray(2) : bytes);
  } else if (encoding === 2) {
    text = new TextDecoder('utf-16be').decode(bytes);
  } else if (encoding === 3) {
    text = new TextDecoder('utf-8').decode(bytes);
  } else {
    text = new TextDecoder('latin1').decode(bytes);
  }
  return text.replace(/\0+$/, '').trim();
}

// Un entier "syncsafe" ID3v2 code 4 octets à 7 bits utiles chacun (bit de poids fort
// toujours à 0), pour qu'aucune séquence de la taille encodée ne ressemble à un octet de
// synchronisation MP3 (0xFF) — d'où les décalages de 21/14/7/0 bits au lieu de 24/16/8/0.
function id3ReadSyncsafeInt(buffer, offset) {
  return (buffer[offset] << 21) | (buffer[offset + 1] << 14) | (buffer[offset + 2] << 7) | buffer[offset + 3];
}

// Parcourt les frames ID3v2 (v2.3/v2.4 — la grande majorité des MP3 actuels ; v2.2, plus
// ancienne et rare avec ses ID de 3 caractères, n'est volontairement pas gérée). Ne lit que
// les frames texte utiles (titre, artiste, album, année, genre) plus la présence d'une
// pochette (APIC), sans extraire l'image elle-même.
function id3ParseV2(buffer) {
  if (buffer.length < 10) return null;
  if (buffer.toString('latin1', 0, 3) !== 'ID3') return null;
  const majorVersion = buffer[3];
  const tagSize = id3ReadSyncsafeInt(buffer, 6);
  const end = Math.min(10 + tagSize, buffer.length);

  const tags = {};
  let offset = 10;
  while (offset + 10 <= end) {
    const id = buffer.toString('latin1', offset, offset + 4);
    if (id === '\0\0\0\0') break;
    const frameSize = majorVersion >= 4 ? id3ReadSyncsafeInt(buffer, offset + 4) : buffer.readUInt32BE(offset + 4);
    const dataStart = offset + 10;
    if (frameSize <= 0 || dataStart + frameSize > buffer.length) break;
    const frameBytes = buffer.subarray(dataStart, dataStart + frameSize);

    if (id[0] === 'T' && id !== 'TXXX' && frameBytes.length > 1) {
      tags[id] = id3DecodeText(frameBytes.subarray(1), frameBytes[0]);
    } else if (id === 'APIC' && frameBytes.length > 1) {
      let p = 1;
      let mime = '';
      while (p < frameBytes.length && frameBytes[p] !== 0) {
        mime += String.fromCharCode(frameBytes[p]);
        p++;
      }
      tags.__coverMime = mime || 'image/*';
    }
    offset = dataStart + frameSize;
  }
  return tags;
}

// Repli ID3v1 (128 derniers octets, format fixe) pour les MP3 sans ID3v2 ou avec des champs
// manquants — ancien mais encore présent, notamment sur de vieux fichiers.
function id3ParseV1(buffer) {
  if (buffer.length < 128) return null;
  const tail = buffer.subarray(buffer.length - 128);
  if (tail.toString('latin1', 0, 3) !== 'TAG') return null;
  const field = (start, len) => tail.toString('latin1', start, start + len).replace(/\0+$/, '').trim();
  return { TIT2: field(3, 30), TPE1: field(33, 30), TALB: field(63, 30), TYER: field(93, 4) };
}

// Fusionne les tags ID3v2 et ID3v1 (v2 prioritaire, v1 en repli champ par champ) en liste
// d'items affichables — TYER (v2.3) et TDRC (v2.4) sont les deux noms possibles du tag
// "année" selon la version d'ID3v2, d'où le double essai.
function id3Items(buffer) {
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
  if (v2.__coverMime) {
    items.push({ label: t('inspect.id3.cover'), value: t('inspect.id3.coverPresent', { mime: v2.__coverMime }) });
  }
  return items;
}

/**
 * Inspecte un fichier audio ou vidéo via ffmpeg (probeMedia) et assemble les items propres
 * à chaque catégorie : résolution/ratio/codec pour la vidéo, canaux/fréquence pour l'audio,
 * plus les tags ID3 pour le MP3. Le débit moyen est estimé (taille totale / durée) plutôt
 * que lu depuis le flux, ffmpeg ne l'exposant pas directement dans sa sortie -i.
 */
async function inspectAudioOrVideo(filePath, category, sourceExt) {
  const meta = await probeMedia(filePath);
  const items = [{ label: t('inspect.duration'), value: formatDuration(meta.duration) }];
  if (category === 'video' && meta.width && meta.height) {
    items.push({ label: t('inspect.resolution'), value: `${meta.width} × ${meta.height} px` });
    items.push({ label: t('inspect.aspectRatio'), value: aspectRatioLabel(meta.width, meta.height) });
  }
  if (category === 'video' && meta.videoCodec) {
    items.push({ label: t('inspect.videoCodec'), value: VIDEO_CODEC_NAMES[meta.videoCodec] || meta.videoCodec });
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
  if (category === 'audio' && sourceExt === 'mp3') {
    items.push(...id3Items(fs.readFileSync(filePath)));
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

// Inspecte un fichier tabulaire (CSV/JSON/XLSX) : nombre de feuilles/lignes/colonnes,
// en-têtes de la première feuille, et type dominant par colonne (voir inferColumnTypes).
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

// Inspecte un fichier de sous-titres : nombre de cues, plage de temps couverte, et deux
// indicateurs de qualité (chevauchements, cues trop rapides — voir countOverlappingCues/
// countTooFastCues).
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
 * @param {'image'|'data'|'audio'|'video'|'subtitle'|'document'|'archive'|'font'} category
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
  else if (category === 'audio' || category === 'video') specific = await inspectAudioOrVideo(filePath, category, sourceExt);
  else if (category === 'data') specific = inspectData(fs.readFileSync(filePath), sourceExt);
  else if (category === 'subtitle') specific = inspectSubtitle(fs.readFileSync(filePath), sourceExt);
  else if (category === 'document') specific = inspectPdf(fs.readFileSync(filePath));
  else if (category === 'archive') specific = inspectZip(fs.readFileSync(filePath));
  else if (category === 'font') specific = inspectFont(fs.readFileSync(filePath));

  return [...generic, ...specific];
}

const BYTE_UNITS = { fr: ['o', 'Ko', 'Mo', 'Go'], en: ['B', 'KB', 'MB', 'GB'] };

// Formate une taille en octets vers l'unité la plus lisible (o/Ko/Mo/Go ou B/KB/MB/GB selon
// la langue), avec une décimale sous la barre des 10 pour garder une précision utile aux
// petites valeurs sans surcharger les grandes (ex. "1.5 Ko" mais "234 Mo").
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
