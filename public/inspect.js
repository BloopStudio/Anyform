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
  return items;
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
 * @param {'image'|'data'|'audio'|'video'|'subtitle'} category
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

  return [...generic, ...specific];
}
