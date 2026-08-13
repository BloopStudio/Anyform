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
  const heic = isHeicFile(file);
  const sourceBlob = heic ? await heicToPngBlob(file) : file;
  const ext = heic ? 'png' : extensionOf(file).replace(/^jpeg$/, 'jpg');
  const mime = COMPRESSIBLE_IMAGE_MIME[ext];

  if (!mime) {
    throw new Error(`Format non compressible : .${ext || '?'}. Formats supportés : PNG, JPG, WebP, HEIC.`);
  }

  const dataUrl = await readFileAsDataUrl(sourceBlob);
  const img = await loadImage(dataUrl);

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
        if (!blob) return reject(new Error('Échec de la compression.'));
        if (blob.type !== mime) return reject(new Error("Ton navigateur ne supporte pas la compression de ce format."));
        resolve(blob);
      },
      mime,
      quality
    );
  });
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
    throw new Error(`Format vidéo non compressible : .${ext}.`);
  }

  const ffmpeg = await loadFFmpeg(onProgress);

  const inName = `input.${ext}`;
  const outName = `output.${ext}`;

  await ffmpeg.writeFile(inName, new Uint8Array(await file.arrayBuffer()));
  await ffmpeg.exec(['-i', inName, ...buildArgs(level), outName]);
  const data = await ffmpeg.readFile(outName);

  await ffmpeg.deleteFile(inName);
  await ffmpeg.deleteFile(outName);

  return new Blob([data.buffer], { type: VIDEO_MIME[ext] || 'application/octet-stream' });
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
    throw new Error(`Format audio non compressible : .${ext}.`);
  }

  const ffmpeg = await loadFFmpeg(onProgress);

  const inName = `input.${ext}`;
  const outName = `output.${ext}`;

  await ffmpeg.writeFile(inName, new Uint8Array(await file.arrayBuffer()));
  await ffmpeg.exec(['-i', inName, ...buildArgs(level), outName]);
  const data = await ffmpeg.readFile(outName);

  await ffmpeg.deleteFile(inName);
  await ffmpeg.deleteFile(outName);

  return new Blob([data.buffer], { type: AUDIO_MIME[ext] || 'application/octet-stream' });
}
