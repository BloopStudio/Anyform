const { spawn } = require('child_process');
const ffmpegPath = require('ffmpeg-static');

const SUPPORTED_AUDIO_FORMATS = ['wav', 'mp3', 'ogg', 'flac', 'aac', 'm4a', 'wma', 'opus'];
const SUPPORTED_VIDEO_FORMATS = ['mp4', 'webm', 'mov', 'avi', 'mkv', 'flv', 'ogv'];

/**
 * Convertit un fichier audio ou vidéo via le binaire ffmpeg statique (ffmpeg-static).
 * @param {string} inputPath
 * @param {string} outputPath
 */
function convertMedia(inputPath, outputPath) {
  return new Promise((resolve, reject) => {
    const ffmpeg = spawn(ffmpegPath, ['-y', '-i', inputPath, outputPath]);

    let stderr = '';
    ffmpeg.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
    });

    ffmpeg.on('error', reject);
    ffmpeg.on('close', (code) => {
      if (code === 0) return resolve();
      reject(new Error(`ffmpeg a échoué (code ${code}):\n${stderr.split('\n').slice(-15).join('\n')}`));
    });
  });
}

const CRF_BY_LEVEL = { light: 26, medium: 30, strong: 35 };
const QSCALE_BY_LEVEL = { light: 6, medium: 10, strong: 18 };

// -c:a copy : l'audio n'est pas retouché, la vidéo domine presque toujours la taille du
// fichier. Chaque conteneur garde son codec vidéo d'origine (pas de changement de format).
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

  return new Promise((resolve, reject) => {
    const ffmpeg = spawn(ffmpegPath, ['-y', '-i', inputPath, ...buildArgs(level), outputPath]);

    let stderr = '';
    ffmpeg.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
    });

    ffmpeg.on('error', reject);
    ffmpeg.on('close', (code) => {
      if (code === 0) return resolve();
      reject(new Error(`ffmpeg a échoué (code ${code}):\n${stderr.split('\n').slice(-15).join('\n')}`));
    });
  });
}

module.exports = {
  convertMedia,
  compressVideo,
  SUPPORTED_AUDIO_FORMATS,
  SUPPORTED_VIDEO_FORMATS,
};
