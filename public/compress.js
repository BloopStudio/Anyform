/**
 * Compression de fichiers : réduit la taille sans changer de format (contrairement à
 * convert.js/audio.js/video.js). Images via re-encodage Canvas, audio/vidéo via ffmpeg.wasm.
 */

// GIF et BMP ne sont pas dans cette liste : canvas.toBlob() ne sait pas les encoder dans
// la plupart des navigateurs (retombe silencieusement sur du PNG, vérifié avec Chromium) —
// pas la peine de proposer un format de compression qui échouera systématiquement.
const COMPRESSIBLE_IMAGE_MIME = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  webp: 'image/webp',
};

// JPG/WebP ont un curseur de qualité ; PNG n'en a pas, donc on réduit la résolution à la
// place pour alléger le fichier.
const IMAGE_QUALITY_BY_LEVEL = { light: 0.82, medium: 0.6, strong: 0.4 };
const IMAGE_SCALE_BY_LEVEL = { light: 1, medium: 0.85, strong: 0.65 };

/**
 * Compresse une image en conservant son format d'origine.
 * @param {File} file
 * @param {'light'|'medium'|'strong'} level
 */
async function compressImage(file, level = 'medium') {
  if (isSvgFile(file)) return compressSvg(file, level);

  const heic = isHeicFile(file);
  const sourceBlob = heic ? await heicToPngBlob(file) : file;
  const ext = heic ? 'png' : extensionOf(file).replace(/^jpeg$/, 'jpg');
  const mime = COMPRESSIBLE_IMAGE_MIME[ext];

  if (!mime) {
    throw new Error(t('error.compressUnsupportedFormat', { ext: ext || '?' }));
  }

  const img = await loadImageFromBlob(sourceBlob);

  const isLossy = mime === 'image/jpeg' || mime === 'image/webp';
  const scale = isLossy ? 1 : IMAGE_SCALE_BY_LEVEL[level] ?? 1;
  const width = Math.max(1, Math.round(img.naturalWidth * scale));
  const height = Math.max(1, Math.round(img.naturalHeight * scale));

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');

  if (mime === 'image/jpeg') {
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, width, height);
  }

  ctx.drawImage(img, 0, 0, width, height);

  const quality = isLossy ? IMAGE_QUALITY_BY_LEVEL[level] : undefined;

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) return reject(new Error(t('error.compressFailedGeneric')));
        if (blob.type !== mime) return reject(new Error(t('error.compressUnsupportedBrowser')));
        resolve(blob);
      },
      mime,
      quality
    );
  });
}

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
 * Compresse un SVG en le minifiant (reste un SVG, pas de rasterisation).
 * @param {File} file
 * @param {'light'|'medium'|'strong'} level
 */
async function compressSvg(file, level = 'medium') {
  const text = await readFileAsText(file);
  return new Blob([minifySvgText(text, level)], { type: 'image/svg+xml' });
}

const PDF_JPEG_QUALITY_BY_LEVEL = { light: 0.82, medium: 0.6, strong: 0.4 };
const PDF_MIN_IMAGE_BYTES = 8192; // pas la peine de recompresser de petites icônes internes

// Décode un JPEG déjà présent dans le PDF puis le ré-encode à une qualité plus faible, via
// Canvas — pas de vraie lib JPEG, juste ce que le navigateur sait déjà faire.
async function recompressJpegBytes(bytes, quality) {
  const blob = new Blob([bytes], { type: 'image/jpeg' });
  const url = URL.createObjectURL(blob);
  try {
    const img = await loadImage(url);
    const canvas = document.createElement('canvas');
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    canvas.getContext('2d').drawImage(img, 0, 0);
    const newBlob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', quality));
    return new Uint8Array(await newBlob.arrayBuffer());
  } finally {
    URL.revokeObjectURL(url);
  }
}

/**
 * Compresse un PDF en recompressant les images JPEG (DCTDecode) qu'il contient. N'utilise
 * aucune bibliothèque PDF : reconstruit le fichier objet par objet — chaque objet non
 * modifié est recopié tel quel, octet pour octet, seuls les objets image retenus sont
 * réécrits avec leur nouveau flux JPEG et une /Length à jour — puis une table de références
 * croisées classique est régénérée avec les nouveaux offsets (obligatoire : dès qu'un objet
 * change de taille, tous ceux qui le suivent changent de position dans le fichier).
 *
 * Volontairement PAS de mise à jour incrémentale (mécanisme standard du PDF, plus simple à
 * écrire) : elle ne fait qu'ajouter à la suite du fichier sans jamais retirer les anciennes
 * données, donc un fichier "compressé" de cette façon ne rétrécit jamais — inutile pour un
 * compresseur.
 *
 * Se limite aux PDF "classiques" (objets individuellement visibles via une recherche
 * "N G obj...endobj", génération 0) : un PDF utilisant des flux d'objets compressés
 * (PDF 1.5+, /Type /ObjStm) a des objets invisibles à cette recherche — les reconstruire
 * sans tous les connaître romprait le fichier, donc on ne touche à rien dans ce cas plutôt
 * que de risquer un PDF corrompu.
 * @param {File} file
 * @param {'light'|'medium'|'strong'} level
 */
// Découpe le texte latin1 d'un PDF en objets ("N G obj" ... "endobj") en repérant chaque
// en-tête d'objet par regex puis en cherchant le "endobj" suivant par simple recherche de
// sous-chaîne (indexOf), plutôt que par un unique motif glouton `obj([\s\S]*?)endobj` sur
// tout le texte : un PDF hostile truffé d'occurrences de "N G obj" sans "endobj"
// correspondant ferait alors rebalayer toute la fin du fichier à chaque tentative (coût
// quadratique — un PDF de quelques dizaines de Mo peut alors geler l'onglet plusieurs
// dizaines de secondes en plein thread principal). Ici `lastIndex` saute directement après
// chaque "endobj" trouvé, donc chaque octet du fichier n'est examiné qu'une fois au total
// (coût linéaire). Défini ici (compress.js charge avant inspect.js dans index.html) et
// réutilisé par inspectPdf (inspect.js).
function extractPdfObjects(text) {
  const objStartRe = /(\d+)\s+(\d+)\s+obj\b/g;
  const objects = [];
  let m;
  while ((m = objStartRe.exec(text))) {
    const bodyStart = objStartRe.lastIndex;
    const endIdx = text.indexOf('endobj', bodyStart);
    if (endIdx === -1) break; // PDF tronqué/malformé : on s'arrête là où le découpage reste fiable
    objects.push({
      num: parseInt(m[1], 10),
      gen: m[2],
      body: text.slice(bodyStart, endIdx),
      absoluteStart: m.index,
      byteLength: endIdx + 'endobj'.length - m.index,
    });
    objStartRe.lastIndex = endIdx + 'endobj'.length;
  }
  return objects;
}

async function compressPdf(file, level = 'medium') {
  const buffer = await file.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  const text = new TextDecoder('latin1').decode(buffer);
  const quality = PDF_JPEG_QUALITY_BY_LEVEL[level];

  if (/\/Type\s*\/ObjStm\b/.test(text)) return file;

  const objects = extractPdfObjects(text);
  if (!objects.length) return file;
  let maxObjNum = 0;
  for (const obj of objects) {
    if (obj.gen !== '0') return file; // génération non nulle : cas rare, on ne le gère pas
    maxObjNum = Math.max(maxObjNum, obj.num);
  }

  for (const obj of objects) {
    if (!/\/Subtype\s*\/Image/.test(obj.body) || !/\/Filter\s*\/DCTDecode/.test(obj.body)) continue;
    const lengthMatch = /\/Length\s+(\d+)/.exec(obj.body);
    if (!lengthMatch) continue; // /Length en référence indirecte (N 0 R) : pas géré, on saute
    const length = parseInt(lengthMatch[1], 10);
    const streamIdx = obj.body.indexOf('stream');
    if (streamIdx === -1) continue;
    let dataStart;
    if (obj.body[streamIdx + 6] === '\r' && obj.body[streamIdx + 7] === '\n') dataStart = streamIdx + 8;
    else if (obj.body[streamIdx + 6] === '\n') dataStart = streamIdx + 7;
    else continue;
    if (dataStart + length > obj.body.length || length < PDF_MIN_IMAGE_BYTES) continue;

    // La position de `body` dans `text` correspond exactement à sa position en octets dans
    // `bytes` : décodage latin1, un octet = un caractère, aucun décalage possible.
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
      newJpeg = await recompressJpegBytes(obj.originalJpeg, quality);
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

  if (!anyChanged) return file;

  const rootMatches = [...text.matchAll(/\/Root\s+(\d+)\s+0\s+R/g)];
  if (!rootMatches.length) return file;
  const rootRef = rootMatches[rootMatches.length - 1][1];

  const encoder = new TextEncoder();
  const header = encoder.encode('%PDF-1.4\n');
  const parts = [header];
  let offset = header.length;
  const offsetByNum = new Map();

  for (const obj of objects) {
    offsetByNum.set(obj.num, offset);
    if (obj.newJpeg) {
      const objHeader = encoder.encode(`${obj.num} 0 obj${obj.newDictText}stream\n`);
      const footer = encoder.encode('\nendstream\nendobj\n');
      parts.push(objHeader, obj.newJpeg, footer);
      offset += objHeader.length + obj.newJpeg.length + footer.length;
    } else {
      const original = bytes.slice(obj.absoluteStart, obj.absoluteStart + obj.byteLength);
      const sep = encoder.encode('\n');
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
      : '0000000000 00001 f \n'; // numéro d'objet absent (rare) : entrée libre pour ne pas décaler les suivantes
  }
  xrefText += `trailer\n<< /Size ${size} /Root ${rootRef} 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;
  parts.push(encoder.encode(xrefText));

  return new Blob(parts, { type: 'application/pdf' });
}

const VIDEO_CRF_BY_LEVEL = { light: 26, medium: 30, strong: 35 };
const VIDEO_QSCALE_BY_LEVEL = { light: 6, medium: 10, strong: 18 };

// -c:a copy : on ne retouche pas l'audio, la vidéo domine presque toujours la taille du
// fichier. Chaque conteneur garde son codec vidéo d'origine (pas de changement de format).
const VIDEO_COMPRESS_ARGS = {
  mp4: (level) => ['-c:v', 'libx264', '-crf', String(VIDEO_CRF_BY_LEVEL[level]), '-preset', 'veryfast', '-c:a', 'copy'],
  mov: (level) => ['-c:v', 'libx264', '-crf', String(VIDEO_CRF_BY_LEVEL[level]), '-preset', 'veryfast', '-c:a', 'copy'],
  mkv: (level) => ['-c:v', 'libx264', '-crf', String(VIDEO_CRF_BY_LEVEL[level]), '-preset', 'veryfast', '-c:a', 'copy'],
  avi: (level) => ['-c:v', 'libx264', '-crf', String(VIDEO_CRF_BY_LEVEL[level]), '-preset', 'veryfast', '-c:a', 'copy'],
  flv: (level) => ['-c:v', 'libx264', '-crf', String(VIDEO_CRF_BY_LEVEL[level]), '-preset', 'veryfast', '-c:a', 'copy'],
  webm: (level) => ['-c:v', 'libvpx-vp9', '-crf', String(VIDEO_CRF_BY_LEVEL[level]), '-b:v', '0', '-c:a', 'copy'],
  ogv: (level) => ['-c:v', 'libtheora', '-qscale:v', String(VIDEO_QSCALE_BY_LEVEL[level]), '-c:a', 'copy'],
};

/**
 * Compresse une vidéo en conservant son conteneur/codec d'origine.
 * @param {File} file
 * @param {'light'|'medium'|'strong'} level
 * @param {(percent: number) => void} [onProgress]
 */
async function compressVideo(file, level, onProgress) {
  const ext = extensionOf(file) || 'mp4';
  const buildArgs = VIDEO_COMPRESS_ARGS[ext];

  if (!buildArgs) {
    throw new Error(t('error.compressUnsupportedVideo', { ext }));
  }

  return runFfmpeg(file, ext, ext, buildArgs(level), onProgress, VIDEO_MIME[ext]);
}

const AUDIO_BITRATE_BY_LEVEL = { light: 192, medium: 128, strong: 96 };
const FLAC_COMPRESSION_BY_LEVEL = { light: 5, medium: 8, strong: 12 };
const WAV_SAMPLE_RATE_BY_LEVEL = { light: 44100, medium: 32000, strong: 22050 };

// FLAC est sans perte : pas de curseur de bitrate, seulement un compromis
// taille/vitesse d'encodage (-compression_level), à qualité inchangée. WAV est du PCM brut
// sans aucune notion de compression : on réduit la fréquence d'échantillonnage à la place,
// comme le redimensionnement pour les images sans curseur de qualité.
const AUDIO_COMPRESS_ARGS = {
  mp3: (level) => ['-c:a', 'libmp3lame', '-b:a', `${AUDIO_BITRATE_BY_LEVEL[level]}k`],
  ogg: (level) => ['-c:a', 'libvorbis', '-b:a', `${AUDIO_BITRATE_BY_LEVEL[level]}k`],
  m4a: (level) => ['-c:a', 'aac', '-b:a', `${AUDIO_BITRATE_BY_LEVEL[level]}k`],
  aac: (level) => ['-c:a', 'aac', '-b:a', `${AUDIO_BITRATE_BY_LEVEL[level]}k`],
  opus: (level) => ['-c:a', 'libopus', '-b:a', `${AUDIO_BITRATE_BY_LEVEL[level]}k`],
  wma: (level) => ['-c:a', 'wmav2', '-b:a', `${AUDIO_BITRATE_BY_LEVEL[level]}k`],
  flac: (level) => ['-c:a', 'flac', '-compression_level', String(FLAC_COMPRESSION_BY_LEVEL[level])],
  wav: (level) => ['-ar', String(WAV_SAMPLE_RATE_BY_LEVEL[level])],
};

/**
 * Compresse un fichier audio en conservant son format d'origine.
 * @param {File} file
 * @param {'light'|'medium'|'strong'} level
 * @param {(percent: number) => void} [onProgress]
 */
async function compressAudio(file, level, onProgress) {
  const ext = extensionOf(file) || 'mp3';
  const buildArgs = AUDIO_COMPRESS_ARGS[ext];

  if (!buildArgs) {
    throw new Error(t('error.compressUnsupportedAudio', { ext }));
  }

  return runFfmpeg(file, ext, ext, buildArgs(level), onProgress, AUDIO_MIME[ext]);
}
