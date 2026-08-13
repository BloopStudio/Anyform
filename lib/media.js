const { spawn } = require('child_process');
const ffmpegPath = require('ffmpeg-static');

const SUPPORTED_AUDIO_FORMATS = ['wav', 'mp3', 'ogg', 'flac', 'aac', 'm4a', 'wma', 'opus'];
const SUPPORTED_VIDEO_FORMATS = ['mp4', 'webm', 'mov', 'avi', 'mkv', 'flv', 'ogv'];

/**
 * Lance ffmpeg avec les arguments donnés (entre "-i input" et "output" déjà inclus) et
 * résout une fois le fichier de sortie écrit. Factorisé ici car convertMedia,
 * compressVideo et compressAudio ont exactement le même besoin : spawn + accumuler
 * stderr + résoudre/rejeter sur le code de sortie.
 * @param {string[]} args
 */
function runFfmpeg(args) {
  return new Promise((resolve, reject) => {
    // -y : écrase le fichier de sortie sans demander confirmation (sinon ffmpeg attend
    // une réponse sur stdin si le fichier existe déjà, et le process reste bloqué).
    const ffmpeg = spawn(ffmpegPath, ['-y', ...args]);

    let stderr = '';
    ffmpeg.stderr.on('data', (chunk) => {
      // ffmpeg écrit toute sa progression/ses logs sur stderr (même en cas de succès),
      // donc on accumule tout et on ne s'en sert que si le process échoue.
      stderr += chunk.toString();
    });

    ffmpeg.on('error', reject); // binaire introuvable / non exécutable
    ffmpeg.on('close', (code) => {
      if (code === 0) return resolve();
      // Les 15 dernières lignes suffisent : c'est là que se trouve l'erreur réelle
      // (les lignes précédentes sont la progression/les infos du flux d'entrée).
      reject(new Error(`ffmpeg a échoué (code ${code}):\n${stderr.split('\n').slice(-15).join('\n')}`));
    });
  });
}

/**
 * Convertit un fichier audio ou vidéo via le binaire ffmpeg statique (ffmpeg-static).
 * @param {string} inputPath
 * @param {string} outputPath
 */
function convertMedia(inputPath, outputPath) {
  return runFfmpeg(['-i', inputPath, outputPath]);
}

// CRF (Constant Rate Factor) : échelle de qualité du codec H.264/VP9, 0 = sans perte,
// 51 = qualité minimale ; plus la valeur est haute, plus le fichier est petit. QSCALE
// est l'équivalent pour Theora (échelle 2-31, même sens : plus haut = plus compressé).
const CRF_BY_LEVEL = { light: 26, medium: 30, strong: 35 };
const QSCALE_BY_LEVEL = { light: 6, medium: 10, strong: 18 };

// -c:a copy : l'audio n'est pas retouché, la vidéo domine presque toujours la taille du
// fichier. Chaque conteneur garde son codec vidéo d'origine (pas de changement de format,
// donc pas de -c:v libx265 sur un .mp4 par exemple, même si ce serait plus efficace).
const VIDEO_COMPRESS_ARGS = {
  mp4: (level) => ['-c:v', 'libx264', '-crf', String(CRF_BY_LEVEL[level]), '-preset', 'veryfast', '-c:a', 'copy'],
  mov: (level) => ['-c:v', 'libx264', '-crf', String(CRF_BY_LEVEL[level]), '-preset', 'veryfast', '-c:a', 'copy'],
  mkv: (level) => ['-c:v', 'libx264', '-crf', String(CRF_BY_LEVEL[level]), '-preset', 'veryfast', '-c:a', 'copy'],
  avi: (level) => ['-c:v', 'libx264', '-crf', String(CRF_BY_LEVEL[level]), '-preset', 'veryfast', '-c:a', 'copy'],
  flv: (level) => ['-c:v', 'libx264', '-crf', String(CRF_BY_LEVEL[level]), '-preset', 'veryfast', '-c:a', 'copy'],
  webm: (level) => ['-c:v', 'libvpx-vp9', '-crf', String(CRF_BY_LEVEL[level]), '-b:v', '0', '-c:a', 'copy'],
  ogv: (level) => ['-c:v', 'libtheora', '-qscale:v', String(QSCALE_BY_LEVEL[level]), '-c:a', 'copy'],
};

/**
 * Compresse une vidéo en conservant son conteneur/codec d'origine.
 * @param {string} inputPath
 * @param {string} outputPath
 * @param {string} ext
 * @param {'light'|'medium'|'strong'} [level]
 */
function compressVideo(inputPath, outputPath, ext, level = 'medium') {
  const buildArgs = VIDEO_COMPRESS_ARGS[ext];
  if (!buildArgs) {
    return Promise.reject(new Error(`Compression vidéo non supportée pour .${ext}.`));
  }
  return runFfmpeg(['-i', inputPath, ...buildArgs(level), outputPath]);
}

const AUDIO_BITRATE_BY_LEVEL = { light: 192, medium: 128, strong: 96 };
const FLAC_COMPRESSION_BY_LEVEL = { light: 5, medium: 8, strong: 12 };
const WAV_SAMPLE_RATE_BY_LEVEL = { light: 44100, medium: 32000, strong: 22050 };

// FLAC est sans perte : pas de curseur de bitrate, seulement un compromis taille/vitesse
// d'encodage (-compression_level), à qualité inchangée. WAV est du PCM brut sans aucune
// notion de compression : on réduit la fréquence d'échantillonnage à la place.
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
 * @param {string} inputPath
 * @param {string} outputPath
 * @param {string} ext
 * @param {'light'|'medium'|'strong'} [level]
 */
function compressAudio(inputPath, outputPath, ext, level = 'medium') {
  const buildArgs = AUDIO_COMPRESS_ARGS[ext];
  if (!buildArgs) {
    return Promise.reject(new Error(`Compression audio non supportée pour .${ext}.`));
  }
  return runFfmpeg(['-i', inputPath, ...buildArgs(level), outputPath]);
}

module.exports = {
  convertMedia,
  compressVideo,
  compressAudio,
  SUPPORTED_AUDIO_FORMATS,
  SUPPORTED_VIDEO_FORMATS,
};
